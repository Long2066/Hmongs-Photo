
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptPanel } from './components/PromptPanel';
import { IdPhotoPanel } from './components/IdPhotoPanel';
import { EditImagePanel } from './components/EditImagePanel';
import { UpscalePanel } from './components/UpscalePanel';
import { ProfileProPanel } from './components/ProfileProPanel';
import { RestorePhotoPanel } from './components/RestorePhotoPanel';
import { VideoPanel } from './components/VideoPanel';
import { VideoWorkspace, type VideoEntry } from './components/VideoWorkspace';
import { PosterStudioPanel } from './components/PosterStudioPanel';
import { PosterWorkspace } from './components/PosterWorkspace';
import { renderStudioPoster, POSTER_TEMPLATES, type PosterOptions, type PosterTemplateId } from './services/posterRenderService';
import { FlowEmbeddedPage } from './components/FlowEmbeddedPage';
import { ComparisonSlider } from './components/ComparisonSlider';
import { OutputDisplay } from './components/OutputDisplay';
import { generateImagesFromPromptsList, generateIdPhotos, editImage, editImages, upscaleImage, upscaleImages, generateProfilePic, generateProfilePics, mixMatchOutfit, relightImage, extractClothing, restoreOldPhoto, generateAiPoster, getUsedSystemKey, resetUsedSystemKey } from './services/aiService';
import { generateOpenRouterVideo } from './services/openRouterVideoService';
import { getVideoConfig, calculateVideoPriceVnd, getVideoModelMeta } from './services/videoConfigService';
import type { RestoreOptions } from './services/aiService';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { PackagesPage } from './components/PackagesPage';
import { ImagePreviewModal } from './components/ImagePreviewModal';
// ImageCropModal removed - using simpler ImagePreviewModal for all modes
import { ApiKeyModal } from './components/ApiKeyModal';
import { ActivityLog } from './components/ActivityLog';
import { DownloadHelpModal } from './components/DownloadHelpModal';
import { GoogleQuotaStationModal } from './components/GoogleQuotaStationModal';
import { Marquee } from './components/Marquee';
import { UpdateNotification } from './components/UpdateNotification';
import { NotificationPopup } from './components/NotificationPopup';
import { SupportHub } from './components/SupportHub';
import { A4PrintPreview } from './components/A4PrintPreview';
import { BottomNavigation } from './components/BottomNavigation';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import * as storage from './services/storageService';
import { downloadImage } from './services/downloadService';
import { subscribeToUserCredits, updateUserCredits } from './services/firebaseService';
import { refreshSubscription, consumeSubscriptionImages, consumeSubscriptionVideoSeconds } from './services/subscriptionService';
import { getSystemApiKey } from './services/geminiCoreService';
import { getCachedBalance } from './services/balanceService';
import * as firebaseService from './services/firebaseService';
import { APP_VERSION } from './services/appUpdateService';
import { checkDeviceAccountLimit, recordDeviceAccount } from './services/antiFraudService';
import * as nineRouterService from './services/nineRouterService';
import { auth } from './src/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import type { User, HistoryItem } from './types';

interface ImageState {
    base64: string;
    mimeType: string;
    id: number;
    fileName?: string;
}

// Data structure for each mode to persist state
interface ModeData {
    inputs: ImageState[];
    outputs: (string | null)[];
    prompts: string[];
    // Specific for Creative Mode
    creativeInputs?: {
        male: ImageState[];
        female: ImageState[];
        maleAcc: ImageState[];
        femaleAcc: ImageState[];
    };
    cleanedInputs?: (string | null)[];
}

const initialModeState: ModeData = {
    inputs: [],
    outputs: [],
    prompts: [],
    creativeInputs: { male: [], female: [], maleAcc: [], femaleAcc: [] },
    cleanedInputs: []
};

const App: React.FC = () => {
    // --- GLOBAL STATE ---
    const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getLoggedInUser());
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [isHistoryVisible, setHistoryVisible] = useState(false);
    const [isPackagesVisible, setPackagesVisible] = useState(false);
    const [packagesOrigin, setPackagesOrigin] = useState(false);

    // Close profile cleanly & support mobile hardware/browser back button
    const handleCloseProfile = useCallback(() => {
        setHistoryVisible(false);
    }, []);

    useEffect(() => {
        if (!isHistoryVisible) return;
        try {
            window.history.pushState({ page: 'profile' }, '');
        } catch {}
        const handlePopState = () => {
            setHistoryVisible(false);
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isHistoryVisible]);
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [isQuotaStationOpen, setQuotaStationOpen] = useState(false);
    const [hasGeminiKey, setHasGeminiKey] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ url: string, index: number } | null>(null);
    const [isDownloadHelpOpen, setDownloadHelpOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAiConfigExpanded, setIsAiConfigExpanded] = useState(false);
    const [mobileActiveTab, setMobileActiveTab] = useState<'input' | 'config' | null>(null);
    const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    const [autoDownload, setAutoDownload] = useState<boolean>(() => {
        try {
            return localStorage.getItem('auto_download_enabled') === 'true';
        } catch {
            return false;
        }
    });
    const [appVersion, setAppVersion] = useState(APP_VERSION); // Sync with package.json & Electron
    const [isSupportBotOpen, setIsSupportBotOpen] = useState(false);
    const outputSectionRef = useRef<HTMLDivElement>(null);

    // Loading & Error (Global mostly, but could be per mode if needed)
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Presentation State

    // Restore Mode - Comparison Slider State
    const [isComparisonActive, setComparisonActive] = useState(false);
    const [comparisonData, setComparisonData] = useState<{ before: string; after: string } | null>(null);

    // ID Photo - A4 Print Preview State
    const [isA4PrintPreviewOpen, setA4PrintPreviewOpen] = useState(false);

    // VIP Balance State (VND instead of credits)
    const [userBalance, setUserBalance] = useState(0); // Legacy balance kept for compatibility; not spent on paid images
    const [remainingPaidImages, setRemainingPaidImages] = useState(0);
    const [remainingVideoSeconds, setRemainingVideoSeconds] = useState(0);
    const [currentSubscriptionPlan, setCurrentSubscriptionPlan] = useState<firebaseService.SubscriptionPlan>('free');
    const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);

    // --- MODE MANAGEMENT ---
    const [mode, setMode] = useState<'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore' | 'video' | 'poster'>('creative');
    const [posterTemplateId, setPosterTemplateId] = useState<PosterTemplateId>('creative_thanh_xuan_hoa_phuong');
    const [videoSubMode, setVideoSubMode] = useState<'text_to_video' | 'image_to_video'>('image_to_video');
    const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([]);

    // Persistent State for ALL Modes
    const [modeStates, setModeStates] = useState<Record<string, ModeData>>({
        creative: JSON.parse(JSON.stringify(initialModeState)),
        id_photo: JSON.parse(JSON.stringify(initialModeState)),
        edit: JSON.parse(JSON.stringify(initialModeState)),
        upscale: JSON.parse(JSON.stringify(initialModeState)),
        profile_pro: JSON.parse(JSON.stringify(initialModeState)),
        restore: JSON.parse(JSON.stringify(initialModeState)),
        video: JSON.parse(JSON.stringify(initialModeState)),
        poster: JSON.parse(JSON.stringify(initialModeState)),
    });

    // Helper to update current mode state - memoized to avoid stale closures
    const updateModeState = useCallback((updater: (prev: ModeData) => Partial<ModeData>) => {
        setModeStates(prev => ({
            ...prev,
            [mode]: { ...prev[mode], ...updater(prev[mode]) }
        }));
    }, [mode]);

    // Helper to access current state
    const currentData = modeStates[mode];

    const checkApiKey = useCallback(() => {
        setHasGeminiKey(nineRouterService.isNineRouterEnabled());
    }, []);

    // Record cloud visit on application mount
    useEffect(() => {
        firebaseService.recordCloudVisit();
    }, []);

    // Subscribe to Realtime Cloud AI Proxy Configuration from Admin Panel.
    // Syncs modelPricing, URL, API Key & ON/OFF switch in real time for all users (guests & authenticated)
    useEffect(() => {
        const unsubscribeProxy = firebaseService.subscribeToAiProxyConfig((config) => {
            console.log('[App] Received AI Proxy Cloud Config update:', config ? { enabled: config.enabled, url: config.url, pricing: config.modelPricing } : 'none');
            nineRouterService.updateNineRouterConfigFromCloud(config);
            setHasGeminiKey(nineRouterService.isNineRouterEnabled());
        });

        return () => {
            unsubscribeProxy();
        };
    }, []);

    // Realtime Presence Heartbeat (sync online status with admin & marquee)
    useEffect(() => {
        const cleanupPresence = firebaseService.startPresenceHeartbeat(
            currentUser?.id,
            currentUser?.name
        );
        return () => {
            cleanupPresence();
        };
    }, [currentUser?.id, currentUser?.name]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                // CRITICAL: Check email verification before allowing access
                if (!fbUser.emailVerified) {
                    // User exists but email not verified - do NOT allow access
                    console.log('User email not verified, signing out...');
                    await firebaseService.logoutUser();
                    storage.logoutUser();
                    setCurrentUser(null);
                    setAuthModalOpen(true);
                    return;
                }

                // Email is verified - allow access
                // Anti-fraud: Kiểm tra giới hạn tối đa 2 tài khoản trên mỗi thiết bị
                const deviceCheck = await checkDeviceAccountLimit(fbUser.email || '', fbUser.uid);
                if (!deviceCheck.allowed) {
                    console.warn('[AntiFraud] Device limit reached for:', fbUser.email);
                    await firebaseService.logoutUser();
                    storage.logoutUser();
                    setCurrentUser(null);
                    setAuthModalOpen(true);
                    return;
                }
                await recordDeviceAccount(fbUser.email || '', fbUser.uid);

                const user: User = {
                    id: fbUser.uid,
                    username: fbUser.email || '',
                    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                    avatar: fbUser.photoURL || `https://ui-avatars.com/api/?name=${fbUser.displayName || 'User'}&background=random`
                };

                // IMPORTANT: Save user to localStorage for PRO tier checks
                storage.updateUser(user);

                setCurrentUser(user);
                setAuthModalOpen(false);

                // Record user access for daily stats
                firebaseService.recordUserAccess(fbUser.uid, user.name);
            } else {
                storage.logoutUser();
                setCurrentUser(null);
            }
        });

        // Check for API keys
        checkApiKey();

        // Mobile viewport height fix - handles dynamic browser chrome on iOS/Android
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            setIsMobileScreen(window.innerWidth < 1024);
        };

        setViewportHeight();
        window.addEventListener('resize', setViewportHeight);
        window.addEventListener('orientationchange', setViewportHeight);

        // Auto-scroll to outputs on mobile after generation starts or media arrives
        const hasMedia = currentData.outputs.some(Boolean) || videoEntries.length > 0;
        if (isMobileScreen && (isLoading || hasMedia)) {
            const timer = setTimeout(() => {
                outputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: isLoading ? 'start' : 'nearest' });
            }, 180);
            return () => {
                window.removeEventListener('resize', setViewportHeight);
                window.removeEventListener('orientationchange', setViewportHeight);
                clearTimeout(timer);
            };
        }

        // Get app version
        const getVersion = async () => {
            try {
                const version = await (window as any).electronAPI?.getAppVersion?.();
                if (version) {
                    setAppVersion(version);
                }
            } catch (e) {
                console.log('Not in Electron or version API not available');
            }
        };
        getVersion();

        // Add dev shortcuts for testing (access in browser console)
        import('./services/antigravityService').then((antigravity) => {
            (window as any).testVeo = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9', duration = 5) => {
                console.log('🎬 Testing Veo 3.1 generation...');
                const result = await antigravity.testVeoGeneration(prompt, { aspectRatio, durationSeconds: duration });
                console.log('📋 Result:', result);
                return result;
            };
            (window as any).listModels = async () => {
                console.log('📋 Fetching available models from Antigravity...');
                const models = await antigravity.listAntigravityModels();
                console.log('✅ Available models:', models);
                return models;
            };
            (window as any).testAntigravity = async () => {
                console.log('🔌 Checking Antigravity connection...');
                const status = await antigravity.checkConnection();
                console.log('✅ Connection status:', status);
                return status;
            };
        });

        import('./services/nineRouterService').then((ninerouter) => {
            (window as any).testNineRouter = async (prompt: string, aspectRatio = '1:1') => {
                console.log('🎬 Testing 9Router generation...');
                const result = await ninerouter.generateImageViaNineRouter({ prompt, aspectRatio });
                console.log('📋 Result:', result);
                return result;
            };
            (window as any).checkNineRouter = async () => {
                console.log('🔌 Checking 9Router connection...');
                const status = await ninerouter.checkConnection();
                console.log('✅ Connection status:', status);
                return status;
            };
            console.log('🧪 Dev shortcuts loaded: window.testVeo(), window.listModels(), window.testAntigravity(), window.testNineRouter(), window.checkNineRouter()');
        });

        return () => {
            unsubscribe();
            window.removeEventListener('resize', setViewportHeight);
            window.removeEventListener('orientationchange', setViewportHeight);
        };
    }, [checkApiKey]);

    // Subscribe to user balance (VND) & Subscription Plan
    useEffect(() => {
        if (!currentUser) {
            setUserBalance(0);
            setRemainingPaidImages(0);
            setRemainingVideoSeconds(0);
            setCurrentSubscriptionPlan('free');
            setSubscriptionExpiresAt(null);
            return;
        }
        // Use local cached balance & video seconds initially
        setUserBalance(getCachedBalance());
        setRemainingVideoSeconds(firebaseService.getCachedRemainingVideoSeconds(currentUser.id));

        const unsubscribe = subscribeToUserCredits(currentUser.id, (balance, state) => {
            setRemainingPaidImages(state?.remainingImages ?? 0);
            setRemainingVideoSeconds(state?.remainingVideoSeconds ?? 0);
            setCurrentSubscriptionPlan(state?.plan ?? 'free');
            setSubscriptionExpiresAt(state?.planExpiresAt ?? null);
            setUserBalance(balance);
            // Cache balance to localStorage for isProUser() check
            localStorage.setItem('user_balance_' + currentUser.id, Math.floor(balance / 100).toString());
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Normalize legacy subscriptions exactly once on the authenticated server, including on return to a tab.
    useEffect(() => {
        if (!currentUser) return;
        const refresh = () => { void refreshSubscription().catch(error => console.warn('[Subscription] Unable to refresh:', error)); };
        refresh();
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [currentUser?.id]);

    // --- UTILITY ---
    const triggerDownload = async (base64: string, filename: string) => {
        try {
            await downloadImage(base64, filename);
            if (false) {



            }







        } catch (e) {
            console.error("Auto download failed:", e);
        }
    };

    const handleDownloadConfigClick = () => setDownloadHelpOpen(true);

    // --- INPUT HANDLERS (PERSISTENT) ---
    // Use mode in dependency array to ensure fresh closure when mode changes
    const handleImagesChange = useCallback((images: ImageState[]) => {
        setModeStates(prev => ({
            ...prev,
            [mode]: { ...prev[mode], inputs: images }
        }));
        setError(null);
    }, [mode]);

    // Specific handlers for Creative Mode
    const handleCreativeChange = useCallback((type: 'male' | 'female' | 'maleAcc' | 'femaleAcc', images: ImageState[]) => {
        setModeStates(prev => ({
            ...prev,
            [mode]: {
                ...prev[mode],
                creativeInputs: {
                    ...prev[mode].creativeInputs!,
                    [type]: images
                }
            }
        }));
    }, [mode]);

    // --- GENERATION HANDLERS ---

    const getApiKeyOrAlert = () => {
        resetUsedSystemKey();

        // Cấu hình Gateway is the sole AI engine
        if (nineRouterService.isNineRouterEnabled()) {
            return 'NINEROUTER_MODE';
        }

        setError('Hệ thống AI Gateway hiện đang tắt hoặc chưa được cấu hình từ Admin.');
        return null;
    };

    // Validate package images; Free keeps its daily allowance and already-earned bonus images.
    const validateSubscriptionBeforeGenerate = useCallback(async (requestedImages: number): Promise<boolean> => {
        if (!currentUser) return false;
        if (storage.isAdmin()) return true;
        if (currentSubscriptionPlan !== 'free') {
            let entitlement;
            try { entitlement = (await refreshSubscription()) ?? { plan: currentSubscriptionPlan, remainingImages: remainingPaidImages, planStartedAt: null, planExpiresAt: subscriptionExpiresAt, planAllowanceImages: firebaseService.SUBSCRIPTION_PLANS[currentSubscriptionPlan].totalImages }; } catch (error) {
                setError(error instanceof Error ? error.message : 'Không xác minh được lượt ảnh của gói. Vui lòng thử lại.');
                return false;
            }
            if (entitlement.plan === 'free' || !entitlement.planExpiresAt || entitlement.planExpiresAt <= Date.now()) {
                setError('Gói đã hết hạn 30 ngày. Vui lòng chọn gói mới tại Cấu hình & gói dịch vụ.');
                return false;
            }
            if (!nineRouterService.isImageModelAllowedForPlan(nineRouterService.getNineRouterImageModel(), entitlement.plan)) {
                setError('Model này không thuộc gói hiện tại. Plus mở GPT Image 2.5, Flare, Sunburst và GPT Image 2; Pro mở toàn bộ model.');
                return false;
            }
            if (entitlement.plan !== 'pro') {
                const bonusImgs = firebaseService.getCachedBonusImages(currentUser.id);
                if (requestedImages > entitlement.remainingImages + bonusImgs) {
                    setError(`Gói Plus chỉ còn ${entitlement.remainingImages} ảnh${bonusImgs ? ` (+${bonusImgs} ảnh thưởng)` : ''}. Hãy giảm số ảnh hoặc chọn gói mới tại Cấu hình & gói dịch vụ.`);
                    return false;
                }
            }
            return true;
        }
        const modelId = nineRouterService.getNineRouterImageModel();
        if (nineRouterService.isModelPaid(modelId)) {
            setError('Mô hình này cần gói Plus hoặc Pro. Vui lòng chọn gói tại Cấu hình & gói dịch vụ.');
            return false;
        }
        const remainingFree = firebaseService.getDailyFreeRemaining(currentUser.id);
        const approvedBonusImages = firebaseService.getCachedBonusImages(currentUser.id);
        const legacyBonusImages = Math.floor(userBalance / firebaseService.IMAGE_COST_VND);
        const bonusImages = approvedBonusImages + legacyBonusImages;
        if (requestedImages > remainingFree + bonusImages) {
            setError(`Bạn còn ${remainingFree} ảnh miễn phí hôm nay${bonusImages ? ` và ${bonusImages} ảnh thưởng` : ''}. Vui lòng giảm số ảnh hoặc chọn gói tại Cấu hình & gói dịch vụ.`);
            return false;
        }
        return true;
    }, [currentUser, currentSubscriptionPlan, userBalance]);

    // Paid packages consume bonusImages or package quota; Free uses daily images first, then bonusImages.
    const deductBalanceForVIP = async (imagesCount: number = 1, _generationType: string = 'image_generation') => {
        if (!currentUser || imagesCount <= 0 || storage.isAdmin()) return;
        let remainingToDeduct = imagesCount;

        if (currentSubscriptionPlan !== 'free') {
            if (currentSubscriptionPlan === 'pro') {
                return;
            }
            const availBonus = firebaseService.getCachedBonusImages(currentUser.id);
            if (availBonus > 0) {
                const fromBonus = Math.min(remainingToDeduct, availBonus);
                await firebaseService.consumeBonusImagesDirect(currentUser.id, fromBonus);
                remainingToDeduct -= fromBonus;
            }
            if (remainingToDeduct > 0) {
                await consumeSubscriptionImages(remainingToDeduct);
            }
            return;
        }

        const dailyUsed = Math.min(remainingToDeduct, firebaseService.getDailyFreeRemaining(currentUser.id));
        if (dailyUsed) {
            await firebaseService.incrementDailyFreeUsage(currentUser.id, dailyUsed);
            remainingToDeduct -= dailyUsed;
        }
        if (remainingToDeduct > 0) {
            const availBonus = firebaseService.getCachedBonusImages(currentUser.id);
            const fromBonus = Math.min(remainingToDeduct, availBonus);
            if (fromBonus > 0) {
                await firebaseService.consumeBonusImagesDirect(currentUser.id, fromBonus);
                remainingToDeduct -= fromBonus;
            }
        }
        if (remainingToDeduct > 0) {
            setUserBalance(await updateUserCredits(currentUser.id, remainingToDeduct * firebaseService.IMAGE_COST_VND, 'subtract'));
        }
    };

    // Update single output image after custom cropping
    const handleUpdateOutputImage = (newBase64: string, index: number) => {
        setModeStates(prev => {
            const currentOutputs = [...prev[mode].outputs];
            currentOutputs[index] = newBase64;
            return {
                ...prev,
                [mode]: {
                    ...prev[mode],
                    outputs: currentOutputs
                }
            };
        });
        setSelectedImage({ url: newBase64, index });
    };

    // Quick action: send any generated image to Image-to-Video mode
    const handleSendToVideo = useCallback((base64: string) => {
        const imageState: ImageState = {
            base64,
            mimeType: 'image/png',
            id: Date.now(),
            fileName: 'video_seed.png'
        };
        setMode('video');
        setVideoSubMode('image_to_video');
        setModeStates(prev => ({
            ...prev,
            video: {
                ...prev['video'],
                inputs: [imageState]
            }
        }));
        setSelectedImage(null);
    }, []);

    const saveHistory = async (type: string, prompt: string, images: string[], style: string = 'General') => {
        if (!currentUser) return;
        const historyItem: HistoryItem = {
            id: Date.now().toString(), // Will be ignored/overwritten by Firestore auto-ID or we can keep it as client ID
            prompt: prompt,
            aspectRatio: 'N/A',
            resolution: 'N/A',
            shotType: type,
            style: style,
            images: images,
            timestamp: Date.now()
        };
        await firebaseService.saveHistoryToFirestore(currentUser.id, historyItem);
        setHistoryRefreshTrigger(prev => prev + 1);
    };

    // 1. ID Photo
    const handleIdPhotoGenerate = useCallback(async (clothing: string, bgColor: string, aspectRatio: string, gender: string, hairstyle: string, clothingRef?: { data: string; mimeType: string }) => {
        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        // Read from current state
        const currentInputs = modeStates['id_photo'].inputs;
        if (currentInputs.length === 0) { setError("Vui lòng chọn 1 ảnh chân dung."); return; }

        if (!await validateSubscriptionBeforeGenerate(4)) return;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(4).fill(null), prompts: [] }));

        try {
            const imagePart = { data: currentInputs[0].base64, mimeType: currentInputs[0].mimeType };
            setLoadingStatus('Đang xử lý ảnh thẻ...');

            const localResults: (string | null)[] = Array(4).fill(null);

            const { prompts } = await generateIdPhotos(
                apiKey, imagePart, clothing, bgColor, aspectRatio, gender, hairstyle,
                (status) => setLoadingStatus(status),
                (index, base64) => {
                    updateModeState((prev) => {
                        const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                    });
                    localResults[index] = base64;
                    if (autoDownload && base64) triggerDownload(base64, `IDPhoto_${index + 1}.png`);
                },
                clothingRef // Pass the reference image from Firestore
            );
            updateModeState(() => ({ prompts }));

            // Deduct credits for VIP users based on successful images
            const successCount = localResults.filter(img => img !== null).length;
            const validImages = localResults.filter((img): img is string => img !== null);
            if (successCount > 0) {
                await deductBalanceForVIP(successCount, 'id_photo');
                // Save to history
                saveHistory('ID Photo', `Ảnh thẻ - ${clothing} - Nền ${bgColor}`, validImages, 'ID Photo');
            } else {
                updateModeState(() => ({ outputs: [] }));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi.');
            updateModeState(() => ({ outputs: [] }));
        }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, currentUser, autoDownload, validateSubscriptionBeforeGenerate]);


    // Cancel creative generation handler
    const handleCancelGenerate = useCallback(() => {
        if (abortControllerRef.current) {
            console.log('[App] Cancelling image generation by user request...');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setLoadingStatus('Đã dừng tạo ảnh theo yêu cầu.');
    }, []);

    // 2. Creative Mode
    const handleCreativeGenerate = useCallback(async (
        prompts: string[],
        aspectRatio: string,
        resolution: string,
        outputMode: 'single' | 'couple',
        filenamePrefix: string,
        style?: string,
        shotType?: string
    ) => {
        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        if (!await validateSubscriptionBeforeGenerate(prompts.length)) return;

        // Clamp resolution to FHD if user is not on Pro plan
        const effectivePlan = storage.isAdmin()
            ? 'pro'
            : currentSubscriptionPlan;
        const safeResolution = effectivePlan !== 'pro' && (resolution === '2K' || resolution === '4K')
            ? 'FHD'
            : resolution;

        // Read specific creative inputs
        const cInputs = modeStates['creative'].creativeInputs!;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(prompts.length).fill(null), prompts: prompts }));

        const localResults: (string | null)[] = Array(prompts.length).fill(null);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const maleParts = cInputs.male.map(img => ({ data: img.base64, mimeType: img.mimeType }));
            const femaleParts = cInputs.female.map(img => ({ data: img.base64, mimeType: img.mimeType }));
            const maleAccParts = cInputs.maleAcc.map(img => ({ data: img.base64, mimeType: img.mimeType }));
            const femaleAccParts = cInputs.femaleAcc.map(img => ({ data: img.base64, mimeType: img.mimeType }));

            const refImages = { male: maleParts, female: femaleParts, maleAccessories: maleAccParts, femaleAccessories: femaleAccParts };
            setLoadingStatus('Đang khởi động Model...');

            await generateImagesFromPromptsList(
                apiKey, prompts, refImages, aspectRatio, safeResolution,
                (status) => setLoadingStatus(status),
                (index, base64) => {
                    updateModeState((prev) => {
                        const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                    });
                    localResults[index] = base64;
                    if (autoDownload && base64) triggerDownload(base64, `${filenamePrefix}_${index + 1}.png`);
                },
                style,
                shotType,
                outputMode,
                abortController.signal
            );

            const validImages = localResults.filter((img): img is string => img !== null);

            // Deduct credits for VIP users based on successful images
            if (validImages.length > 0) {
                await deductBalanceForVIP(validImages.length, 'image_generation');
                saveHistory('Creative Batch', prompts[0], validImages, outputMode);
            } else {
                updateModeState(() => ({ outputs: [] }));
            }

        } catch (e: any) {
            const hasAny = localResults.some(img => img !== null);
            if (!hasAny) {
                updateModeState(() => ({ outputs: [] }));
            }
            if (abortController.signal.aborted || e?.name === 'AbortError' || e?.message?.includes('aborted')) {
                console.log('[App] Creative generation aborted cleanly by user');
                setLoadingStatus('Đã dừng tạo ảnh theo yêu cầu.');
            } else {
                setError(e instanceof Error ? e.message : 'Lỗi.');
            }
        } finally {
            abortControllerRef.current = null;
            setIsLoading(false);
            if (!abortController.signal.aborted) {
                setLoadingStatus('');
            }
        }
    }, [modeStates, currentUser, autoDownload, userBalance, validateSubscriptionBeforeGenerate]);

    // 3. Edit Image (Batch 1-to-1 Support, max 10 images)
    const handleEditImage = useCallback(async (prompt: string, type: 'general' | 'mix' | 'relight' | 'extract', _outputCount: number, extraData?: any) => {
        console.log('[DEBUG] handleEditImage called:', { prompt, type });

        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        const inputs = modeStates['edit'].inputs;
        console.log('[DEBUG] Edit inputs length:', inputs.length);

        if (type !== 'mix' && inputs.length === 0) { setError("Vui lòng tải lên từ 1 đến 10 ảnh đầu vào."); return; }
        if (type === 'mix' && inputs.length < 2) { setError("Vui lòng tải lên 2 ảnh vào Slot 1 và Slot 2 để phối đồ."); return; }

        // 1-to-1 Mapping: input count equals output count (mix requires 2 inputs -> 1 output)
        const actualCount = type === 'mix' ? 1 : inputs.length;
        if (!await validateSubscriptionBeforeGenerate(actualCount)) return;

        console.log(`[DEBUG] Starting 1-to-1 edit generation for ${actualCount} slots...`);
        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(actualCount).fill(null) }));

        const localResults: (string | null)[] = Array(actualCount).fill(null);

        try {
            let historyPrompt = prompt;

            if (type === 'mix') {
                setLoadingStatus('Đang phối đồ Mix & Match (Slot 1 + Slot 2)...');
                const result = await mixMatchOutfit(
                    apiKey,
                    { data: inputs[0].base64, mimeType: inputs[0].mimeType },
                    { data: inputs[1].base64, mimeType: inputs[1].mimeType }
                );
                localResults[0] = result;
                updateModeState(() => ({ outputs: [result] }));
                historyPrompt = "Outfit Mix & Match";
                if (autoDownload && result) triggerDownload(result, 'mix_match.png');
            } else {
                // Strict 1-to-1 Mapping: input slot i -> output slot i
                for (let i = 0; i < inputs.length; i++) {
                    const inputPart = { data: inputs[i].base64, mimeType: inputs[i].mimeType };

                    if (type === 'general') {
                        setLoadingStatus(`Đang chỉnh sửa ảnh Slot ${i + 1}/${inputs.length}...`);
                        try {
                            const result = await editImage(apiKey, inputPart, prompt);
                            localResults[i] = result;
                            updateModeState((prev) => {
                                const n = [...prev.outputs];
                                n[i] = result;
                                return { outputs: n };
                            });
                            if (autoDownload && result) triggerDownload(result, `edited_slot_${i + 1}.png`);
                        } catch (err) {
                            console.error(`[Edit] Failed slot ${i + 1}:`, err);
                        }
                    } else if (type === 'relight') {
                        const styleLabel = extraData?.lighting || 'studio';
                        setLoadingStatus(`Đang đổi ánh sáng ảnh Slot ${i + 1}/${inputs.length}...`);
                        try {
                            const result = await relightImage(apiKey, inputPart, styleLabel);
                            localResults[i] = result;
                            updateModeState((prev) => {
                                const n = [...prev.outputs];
                                n[i] = result;
                                return { outputs: n };
                            });
                            if (autoDownload && result) triggerDownload(result, `relighted_slot_${i + 1}.png`);
                        } catch (err) {
                            console.error(`[Relight] Failed slot ${i + 1}:`, err);
                        }
                    } else if (type === 'extract') {
                        setLoadingStatus(`Đang tách trang phục ảnh Slot ${i + 1}/${inputs.length}...`);
                        try {
                            const result = await extractClothing(apiKey, inputPart);
                            localResults[i] = result;
                            updateModeState((prev) => {
                                const n = [...prev.outputs];
                                n[i] = result;
                                return { outputs: n };
                            });
                            if (autoDownload && result) triggerDownload(result, `extracted_slot_${i + 1}.png`);
                        } catch (err) {
                            console.error(`[Extract] Failed slot ${i + 1}:`, err);
                        }
                    }

                    // Small polite delay between multiple requests to respect rate limits
                    if (i < inputs.length - 1) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                historyPrompt = type === 'general' ? prompt : type === 'relight' ? `Relighting: ${extraData?.lighting}` : "Clothing Extraction";
            }

            updateModeState(() => ({ prompts: Array(actualCount).fill(historyPrompt) }));
            const validImages = localResults.filter((img): img is string => img !== null);
            // Deduct credits for VIP users for valid generated images
            if (validImages.length > 0) {
                await deductBalanceForVIP(validImages.length, 'edit');
                saveHistory('Edit Tool', historyPrompt, validImages, type);
            } else {
                updateModeState(() => ({ outputs: [] }));
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi xử lý.'); updateModeState(() => ({ outputs: [] })); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, autoDownload, currentUser, validateSubscriptionBeforeGenerate]);

    // 4. Upscale Image (Batch Support)
    const handleUpscale = useCallback(async (resolution: '2K' | '4K', outputCount: number) => {
        const apiKey = getApiKeyOrAlert();
        const inputs = modeStates['upscale'].inputs;
        if (!apiKey || inputs.length === 0) return;

        if (!await validateSubscriptionBeforeGenerate(outputCount)) return;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(outputCount).fill(null) }));

        const localResults: (string | null)[] = Array(outputCount).fill(null);

        try {
            const imagePart = { data: inputs[0].base64, mimeType: inputs[0].mimeType };

            await upscaleImages(
                apiKey,
                imagePart,
                resolution,
                outputCount,
                (status) => setLoadingStatus(status),
                (index, base64) => {
                    updateModeState((prev) => {
                        const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                    });
                    localResults[index] = base64;
                    if (autoDownload && base64) triggerDownload(base64, `upscale_${resolution}_${index + 1}.png`);
                }
            );

            updateModeState(() => ({ prompts: [`Upscaled to ${resolution}`] }));
            const validImages = localResults.filter((img): img is string => img !== null);
            // Deduct credits for VIP users
            if (validImages.length > 0) {
                await deductBalanceForVIP(validImages.length, 'upscale');
                saveHistory('Upscale', `Upscaled to ${resolution}`, validImages, 'High Quality');
            } else {
                updateModeState(() => ({ outputs: [] }));
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi nâng cấp.'); updateModeState(() => ({ outputs: [] })); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, autoDownload, currentUser, validateSubscriptionBeforeGenerate]);

    // 5. Profile Pro (Batch Support)
    const handleProfilePro = useCallback(async (style: string, platform: string, resolution: '2K' | '4K', outputCount: number) => {
        const apiKey = getApiKeyOrAlert();
        const inputs = modeStates['profile_pro'].inputs;
        if (!apiKey || inputs.length === 0) return;

        if (!await validateSubscriptionBeforeGenerate(outputCount)) return;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(outputCount).fill(null) }));

        const localResults: (string | null)[] = Array(outputCount).fill(null);

        try {
            const imagePart = { data: inputs[0].base64, mimeType: inputs[0].mimeType };

            await generateProfilePics(
                apiKey,
                imagePart,
                style,
                platform,
                resolution,
                outputCount,
                (status) => setLoadingStatus(status),
                (index, base64) => {
                    updateModeState((prev) => {
                        const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                    });
                    localResults[index] = base64;
                    if (autoDownload && base64) triggerDownload(base64, `profile_${platform}_${index + 1}.png`);
                }
            );

            updateModeState(() => ({ prompts: [`Profile: ${style} for ${platform}`] }));
            const validImages = localResults.filter((img): img is string => img !== null);
            // Deduct credits for VIP users
            if (validImages.length > 0) {
                await deductBalanceForVIP(validImages.length, 'profile_pro');
                saveHistory('Profile Pro', `Profile: ${style} for ${platform}`, validImages, style);
            } else {
                updateModeState(() => ({ outputs: [] }));
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi tạo profile.'); updateModeState(() => ({ outputs: [] })); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, autoDownload, currentUser, validateSubscriptionBeforeGenerate]);

    // 7. Restore Old Photo
    const handleRestorePhoto = useCallback(async (options: RestoreOptions) => {
        console.log('[DEBUG] handleRestorePhoto called with options:', options);

        const apiKey = getApiKeyOrAlert();
        const inputs = modeStates['restore'].inputs;
        console.log('[DEBUG] Restore inputs length:', inputs.length, ', API key found:', !!apiKey);

        if (!apiKey || inputs.length === 0) {
            setError("Vui lòng tải lên ảnh cũ cần phục hồi.");
            return;
        }

        if (!await validateSubscriptionBeforeGenerate(1)) return;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: [null] }));

        try {
            const imagePart = { data: inputs[0].base64, mimeType: inputs[0].mimeType };
            console.log('[DEBUG] Calling restoreOldPhoto API...');

            const result = await restoreOldPhoto(
                apiKey,
                imagePart,
                options,
                (status) => {
                    console.log('[DEBUG] Status update:', status);
                    setLoadingStatus(status);
                }
            );

            console.log('[DEBUG] restoreOldPhoto result:', !!result, result?.substring(0, 50) + '...');

            if (result) {
                updateModeState(() => ({ outputs: [result], prompts: ['Phục hồi ảnh cũ'] }));
                if (autoDownload) triggerDownload(result, 'restored_photo.png');
                // Store comparison data for slider
                setComparisonData({
                    before: inputs[0].base64,
                    after: result
                });
                setComparisonActive(true);

                // Deduct credits for VIP users
                await deductBalanceForVIP(1, 'restore');
                saveHistory('Phục Hồi Ảnh', 'Phục hồi ảnh cũ', [result], 'Restoration');
            } else {
                updateModeState(() => ({ outputs: [] }));
            }
        } catch (e) {
            console.error('[DEBUG] Restore error:', e);
            setError(e instanceof Error ? e.message : 'Lỗi phục hồi ảnh.');
            updateModeState(() => ({ outputs: [] }));
        }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, currentUser, validateSubscriptionBeforeGenerate]);

    // 8. Video Generation (Idea.ai Vivix W1 + OpenRouter Grok / Wan 3.0)
    const handleVideoGenerate = useCallback(async (
        prompt: string,
        aspectRatio: '16:9' | '9:16' | '1:1',
        subMode: 'text_to_video' | 'image_to_video',
        model?: string,
        outputCount: number = 1,
        duration: number = 5
    ) => {
        const inputs = modeStates['video'].inputs;
        if (subMode === 'image_to_video' && inputs.length === 0) {
            setError('Vui lòng tải lên 1 ảnh để làm chuyển động video.');
            return;
        }

        const count = Math.max(1, Math.min(3, outputCount || 1));
        const modelMeta = getVideoModelMeta(model);
        const totalSecondsNeeded = duration * count;

        if (!storage.isAdmin()) {
            let effectiveVideoSec = remainingVideoSeconds;
            try {
                const refreshed = await refreshSubscription();
                if (refreshed && Number.isSafeInteger(refreshed.remainingVideoSeconds)) {
                    effectiveVideoSec = refreshed.remainingVideoSeconds;
                    setRemainingVideoSeconds(effectiveVideoSec);
                }
            } catch {
                // fallback to current state
            }

            if (effectiveVideoSec < totalSecondsNeeded) {
                const planLabel = currentSubscriptionPlan === 'pro' ? 'Pro' : currentSubscriptionPlan === 'plus' ? 'Plus' : 'Free';
                setError(
                    effectiveVideoSec <= 0
                        ? `Bạn đã dùng hết số giây tạo video của gói ${planLabel}. Vui lòng nâng cấp gói Plus (60s) hoặc Pro (180s) tại Cấu hình & gói dịch vụ.`
                        : `Số giây video còn lại (${effectiveVideoSec}s) không đủ để tạo ${count} video × ${duration}s (${totalSecondsNeeded}s). Vui lòng chọn thời lượng ngắn hơn hoặc nâng cấp gói.`
                );
                setPackagesVisible(true);
                return;
            }
        }

        setIsLoading(true);
        setError(null);
        setIsMenuOpen(false);
        setLoadingStatus(`Đang gửi yêu cầu tạo ${count} video tới ${modelMeta.shortName} (${duration}s • ${aspectRatio})...`);
        setVideoEntries([]);
        updateModeState(() => ({
            outputs: Array(count).fill(null),
            prompts: Array(count).fill(prompt),
        }));

        try {
            const inputImageBase64 = subMode === 'image_to_video' && inputs.length > 0
                ? inputs[0].base64
                : undefined;

            const result = await generateOpenRouterVideo({
                prompt,
                aspectRatio,
                duration,
                modelOverride: model === 'auto' ? undefined : model,
                outputCount: count,
                inputImageBase64,
                onProgress: (status) => setLoadingStatus(status),
            });

            const finalUrls = (result.urls && result.urls.length > 0 ? result.urls : [result.url])
                .filter((url): url is string => typeof url === 'string' && url.length > 0);
            if (finalUrls.length === 0) throw new Error('Dịch vụ chưa trả về video. Vui lòng thử lại.');

            // Trừ số giây tạo video thực tế đã tạo thành công (Free 8s / Plus 60s / Pro 180s)
            const consumedSeconds = (result.duration || duration) * finalUrls.length;
            if (!storage.isAdmin() && currentUser && consumedSeconds > 0) {
                try {
                    const updatedEntitlement = await consumeSubscriptionVideoSeconds(consumedSeconds);
                    setRemainingVideoSeconds(updatedEntitlement.remainingVideoSeconds);
                    setCurrentSubscriptionPlan(updatedEntitlement.plan);
                } catch (vErr) {
                    console.warn('Lỗi trừ số giây video:', vErr);
                }
            }

            const source = subMode === 'image_to_video' ? inputs[0] : undefined;
            const firstFrame = source
                ? source.base64.startsWith('data:') || /^https?:\/\//i.test(source.base64)
                    ? source.base64
                    : `data:${source.mimeType};base64,${source.base64}`
                : undefined;
            const createdAt = Date.now();
            setVideoEntries(
                finalUrls.map(url => ({
                    url,
                    firstFrame,
                    createdAt,
                    prompt,
                    modelUsed: result.modelUsed,
                    duration: result.duration,
                    aspectRatio: result.aspectRatio
                }))
            );
            updateModeState(() => ({
                outputs: finalUrls,
                prompts: Array(finalUrls.length).fill(prompt),
            }));

            saveHistory('Video Omni AI', prompt, finalUrls, subMode === 'image_to_video' ? 'Image-to-Video' : 'Text-to-Video');
        } catch (e) {
            console.error('[Video Error]:', e);
            const msg = e instanceof Error ? e.message : 'Lỗi tạo video AI.';
            setError(msg === 'Failed to fetch' ? 'Lỗi kết nối mạng khi tải dữ liệu video (Failed to fetch). Vui lòng thử lại.' : msg);
            setVideoEntries([]);
            updateModeState(() => ({ outputs: [] }));
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    }, [modeStates, saveHistory, remainingVideoSeconds, currentSubscriptionPlan, currentUser]);

    // 9. Poster Studio Generation (Client-Side High-DPI Canvas Engine - 0 API cost)
    const handleSwapPosterInputs = useCallback((i: number, j: number) => {
        setModeStates(prev => {
            const list = [...(prev['poster']?.inputs || [])];
            if (i < 0 || j < 0 || i >= list.length || j >= list.length) return prev;
            const temp = list[i];
            list[i] = list[j];
            list[j] = temp;
            return {
                ...prev,
                poster: { ...prev.poster, inputs: list }
            };
        });
    }, []);

    const handleRemovePosterInput = useCallback((idx: number) => {
        setModeStates(prev => {
            const list = (prev['poster']?.inputs || []).filter((_, i) => i !== idx);
            return {
                ...prev,
                poster: { ...prev.poster, inputs: list }
            };
        });
    }, []);

    // 9A. AI Poster Generation via Selected Model (Generative AI - like ChatGPT)
    const handleAiPosterGenerate = useCallback(async (
        topicPrompt: string,
        aspectRatio: string = '9:16',
        brandingInfo?: { studioName?: string; conceptName?: string; yearTag?: string; hotline?: string }
    ) => {
        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        const inputs = modeStates['poster']?.inputs || [];
        if (inputs.length === 0) {
            setError('Vui lòng tải lên từ 1 đến 10 ảnh đầu vào ở khung bên trái để AI thiết kế Poster.');
            return;
        }

        if (!await validateSubscriptionBeforeGenerate(1)) return;

        setIsLoading(true);
        setError(null);
        setIsMenuOpen(false);
        setModeStates(prev => ({
            ...prev,
            poster: { ...prev.poster, outputs: [null], prompts: [topicPrompt] }
        }));
        setLoadingStatus('AI đang phân tích ảnh tham chiếu và sáng tạo Poster đa tầng...');

        try {
            const referenceParts = inputs.slice(0, 10).map((img, idx) => ({
                data: img.base64.replace(/^data:image\/[a-z]+;base64,/i, ''),
                mimeType: img.mimeType || 'image/jpeg',
                label: idx === 0 ? 'Hero Primary Subject' : `Secondary Subject ${idx + 1}`
            }));

            const studio = brandingInfo?.studioName || 'Music Studio';
            const concept = brandingInfo?.conceptName || 'Sinh viên';
            const yearTag = brandingInfo?.yearTag || 'Kỉ niệm 2026';
            const hotline = brandingInfo?.hotline || '0342 733 640';

            const fullDesignPrompt = `*** HIGH-END STUDIO GRAPHIC POSTER DESIGN (RATIO: ${aspectRatio}) ***
Create an authentic, ultra-high-end studio graphic poster featuring the exact character(s)/subject(s) from the attached reference photo(s).
THEME & MOOD: ${topicPrompt}.

MASTERFUL MULTI-LAYER GRAPHIC COMPOSITION:
1. HERO SUBJECT: Feature the primary character(s) from Reference Photo 1 as the prominent, high-fashion hero subject with authentic face, hair, and clothing faithfully preserved.
2. ARTISTIC SECONDARY ACCENTS: Naturally incorporate multi-photo frames matching the theme (such as tilted Polaroid photo cards showing other angles, a curved 3D 35mm film strip, ripped kraft paper stickers, or lush red royal poinciana blossoms).
3. IN-IMAGE NATIVE TYPOGRAPHY & BRANDING:
   - Primary title in elegant high-contrast serif: "${studio}"
   - Sub-headline with dashes: "— ${yearTag} —"
   - Graceful flowing script: "${concept}"
   - A luxury metallic gold pill button or banner: "Hotline: ${hotline}"
4. LIGHTING & REALISM: Realistic studio rim lighting, authentic shadows cast by the text and stickers, depth of field, 8K ultra-sharp details.`;

            const rawResult = await generateAiPoster(apiKey, referenceParts, fullDesignPrompt, aspectRatio);
            if (rawResult) {
                const formattedResult = rawResult.startsWith('data:') || rawResult.startsWith('http')
                    ? rawResult
                    : `data:image/png;base64,${rawResult}`;

                setModeStates(prev => ({
                    ...prev,
                    poster: { ...prev.poster, outputs: [formattedResult], prompts: [topicPrompt] }
                }));
                await deductBalanceForVIP(1, 'poster');
                saveHistory('AI Poster Studio', topicPrompt, [formattedResult], studio);
                if (autoDownload) triggerDownload(formattedResult, `ai_poster_${Date.now()}.png`);
            } else {
                throw new Error('AI không tạo được poster. Vui lòng kiểm tra lại prompt hoặc model.');
            }
        } catch (e: any) {
            console.error('[AI Poster] Error:', e);
            setError(e?.message || 'Có lỗi xảy ra trong quá trình tạo poster AI.');
            setModeStates(prev => ({
                ...prev,
                poster: { ...prev.poster, outputs: [] }
            }));
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    }, [modeStates, getApiKeyOrAlert, validateSubscriptionBeforeGenerate, deductBalanceForVIP, saveHistory, autoDownload]);

    const handleGeneratePoster = useCallback(async (
        options: PosterOptions,
        batchMode: 'single' | 'top4' | 'all',
        shuffleSeed: number = 0
    ) => {
        const inputs = modeStates['poster']?.inputs || [];
        if (inputs.length === 0) {
            setError('Vui lòng tải lên ít nhất 1 ảnh ở khung "Dữ liệu đầu vào" để ghép Poster.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setIsMenuOpen(false);

        const rawSources = inputs.map((img) =>
            img.base64.startsWith('data:') ? img.base64 : `data:${img.mimeType};base64,${img.base64}`
        );
        const arrangedSources = shuffleSeed === 0
            ? rawSources
            : rawSources.map((_, i) => rawSources[(i + shuffleSeed) % rawSources.length]);

        const filtered = POSTER_TEMPLATES.filter(
            (t) => (!options.category || t.category === options.category) && (!options.aspectRatio || t.aspectRatio === options.aspectRatio)
        );
        const targetTemplateIds: PosterTemplateId[] =
            batchMode === 'single'
                ? [options.templateId]
                : batchMode === 'top4'
                ? filtered.slice(0, 4).map((t) => t.id)
                : filtered.map((t) => t.id);

        try {
            const results: (string | null)[] = [];
            const labels: string[] = [];

            for (let i = 0; i < targetTemplateIds.length; i++) {
                const tplId = targetTemplateIds[i];
                const meta = POSTER_TEMPLATES.find((t) => t.id === tplId);
                setLoadingStatus(`Đang kết xuất ${meta?.name || tplId} (${i + 1}/${targetTemplateIds.length})...`);

                const renderedUrl = await renderStudioPoster(arrangedSources, {
                    ...options,
                    templateId: tplId,
                    resolution: batchMode === 'all' ? 'HD' : options.resolution
                });
                results.push(renderedUrl);
                labels.push(meta?.name || tplId);

                if (autoDownload && batchMode === 'single' && renderedUrl) {
                    triggerDownload(renderedUrl, `poster_${tplId}.jpg`);
                }
            }

            setModeStates(prev => ({
                ...prev,
                poster: { ...prev.poster, outputs: results, prompts: labels }
            }));

            const validOutputs = results.filter((r): r is string => r !== null);
            if (validOutputs.length > 0) {
                saveHistory(
                    'Poster Studio',
                    `Ghép Poster: ${labels[0]}${validOutputs.length > 1 ? ` (+${validOutputs.length - 1} mẫu)` : ''}`,
                    validOutputs.slice(0, 4),
                    options.conceptName || 'Poster'
                );
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi kết xuất poster.');
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    }, [modeStates, autoDownload, saveHistory]);

    const handleLogout = async () => {
        await firebaseService.logoutUser();
        storage.logoutUser();
        setCurrentUser(null);
        setHistoryVisible(false);
        setPackagesVisible(false);
        setAuthModalOpen(false);
    };

    // --- RENDER INPUT SECTION ---
    const renderInputs = () => {
        const mState = modeStates[mode];

        if (mode === 'creative') {
            return (
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <ImageUploader label="Nam" onImagesChange={(imgs) => handleCreativeChange('male', imgs)} maxImages={1} compact />
                    <ImageUploader label="Nữ" onImagesChange={(imgs) => handleCreativeChange('female', imgs)} maxImages={1} compact />
                    <ImageUploader label="PK Nam" onImagesChange={(imgs) => handleCreativeChange('maleAcc', imgs)} maxImages={1} compact />
                    <ImageUploader label="PK Nữ" onImagesChange={(imgs) => handleCreativeChange('femaleAcc', imgs)} maxImages={1} compact />
                </div>
            );
        } else if (['id_photo', 'edit', 'upscale', 'profile_pro', 'restore'].includes(mode)) {
            return (
                <div className="p-3">
                    <ImageUploader
                        label={mode === 'edit' ? "Ảnh đầu vào (Tối đa 10 ảnh • 1 Input = 1 Output)" : mode === 'restore' ? "Ảnh cũ cần phục hồi" : "Ảnh đầu vào"}
                        onImagesChange={handleImagesChange}
                        maxImages={mode === 'edit' ? 10 : 1}
                    />
                </div>
            );
        } else if (mode === 'video') {
            return (
                <div className="p-3">
                    <ImageUploader
                        label="Ảnh nguồn tạo video (I2V)"
                        onImagesChange={handleImagesChange}
                        maxImages={1}
                    />
                </div>
            );
        } else if (mode === 'poster') {
            return (
                <div className="p-3">
                    <ImageUploader
                        key="poster-uploader"
                        label="Ảnh ghép Poster (Tối đa 10 ảnh • Chọn từ #1 đến #10)"
                        onImagesChange={handleImagesChange}
                        maxImages={10}
                    />
                </div>
            );
        }
        return <div className="p-4 text-xs text-slate-400 text-center italic">Chế độ này không cần ảnh đầu vào.</div>;
    };

    // --- RENDER CONFIG PANEL ---
    const renderConfig = () => {
        const mState = modeStates[mode];
        const creativeInputs = mState.creativeInputs!;
        const totalCreative = creativeInputs.male.length + creativeInputs.female.length + creativeInputs.maleAcc.length + creativeInputs.femaleAcc.length;

        if (mode === 'creative') {
            const creativeRefImages = {
                male: creativeInputs.male.map(img => ({ data: img.base64, mimeType: img.mimeType })),
                female: creativeInputs.female.map(img => ({ data: img.base64, mimeType: img.mimeType })),
                maleAccessories: creativeInputs.maleAcc.map(img => ({ data: img.base64, mimeType: img.mimeType })),
                femaleAccessories: creativeInputs.femaleAcc.map(img => ({ data: img.base64, mimeType: img.mimeType }))
            };
            return <PromptPanel onGenerate={handleCreativeGenerate} onCancel={handleCancelGenerate} isLoading={isLoading} isDisabled={!currentUser} hasApiKey={hasGeminiKey} selectedImageCount={totalCreative} inputCounts={{ male: creativeInputs.male.length, female: creativeInputs.female.length, maleAcc: creativeInputs.maleAcc.length, femaleAcc: creativeInputs.femaleAcc.length }} refImages={creativeRefImages} />;
        }
        if (mode === 'id_photo') return <IdPhotoPanel onGenerate={handleIdPhotoGenerate} isLoading={isLoading} isDisabled={!currentUser} hasApiKey={hasGeminiKey} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'edit') return <EditImagePanel onGenerate={handleEditImage} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} inputCount={mState.inputs.length} />;
        if (mode === 'upscale') return <UpscalePanel onGenerate={handleUpscale} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'profile_pro') return <ProfileProPanel onGenerate={handleProfilePro} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'restore') return <RestorePhotoPanel onGenerate={handleRestorePhoto} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'poster') {
            return (
                <PosterStudioPanel
                    onAiGeneratePoster={handleAiPosterGenerate}
                    onGeneratePoster={handleGeneratePoster}
                    isLoading={isLoading}
                    isDisabled={!currentUser}
                    hasInputImage={mState.inputs.length > 0}
                    inputCount={mState.inputs.length}
                    inputImages={mState.inputs.map(img => img.base64)}
                    onSwapInputs={handleSwapPosterInputs}
                    onRemoveInput={handleRemovePosterInput}
                    selectedTemplateId={posterTemplateId}
                    onTemplateSelect={setPosterTemplateId}
                />
            );
        }
        if (mode === 'video') {
            return (
                <VideoPanel
                    subMode={videoSubMode}
                    onSubModeChange={setVideoSubMode}
                    onGenerate={handleVideoGenerate}
                    onImagesChange={handleImagesChange}
                    isLoading={isLoading}
                    isDisabled={!currentUser}
                    hasInputImage={mState.inputs.length > 0}
                    inputImagePreview={mState.inputs[0]?.base64}
                    remainingVideoSeconds={remainingVideoSeconds}
                    userPlan={currentSubscriptionPlan}
                    isAdmin={storage.isAdmin()}
                    onRequestTopUp={() => setPackagesVisible(true)}
                />
            );
        }
        return null;
    };

    // --- AUTH GATE: Bắt buộc đăng nhập / đăng ký mới cho vào giao diện bên trong tool ---
    if (!currentUser) {
        return (
            <div className="h-screen w-screen overflow-hidden bg-slate-900 flex items-center justify-center relative select-none">
                {/* Background ambient lighting */}
                <div className="fixed inset-0 z-0 animate-gradient-flow opacity-30 pointer-events-none"></div>
                <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/30 to-pink-600/30 rounded-full blur-[140px] pointer-events-none"></div>

                <AuthModal
                    onAuthSuccess={(user) => {
                        setCurrentUser(user);
                        setAuthModalOpen(false);
                    }}
                    isBlocking={true}
                    appVersion={appVersion}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-[100dvh] lg:h-screen lg:h-[100dvh] w-full text-slate-900 font-sans antialiased flex flex-col selection:bg-violet-100 relative overflow-x-hidden lg:overflow-hidden bg-[#f4f3fb]">

            <Marquee />

            <Header
                user={currentUser}
                onLoginClick={() => setAuthModalOpen(true)}
                onLogout={handleLogout}
                onHistoryClick={() => { setPackagesVisible(false); setHistoryVisible(true); }}
                onBackFromProfile={handleCloseProfile}
                onQuotaStationClick={() => { setPackagesOrigin(isHistoryVisible); setHistoryVisible(false); setPackagesVisible(true); }}
                onBotClick={() => setIsSupportBotOpen(true)}
                isHistoryVisible={isHistoryVisible}
                currentMode={mode}
                onModeChange={(nextMode) => {
                    setError(null);
                    setMode(nextMode);
                    setHistoryVisible(false);
                    if (nextMode !== 'creative') setIsAiConfigExpanded(true);
                }}
            />

            {isPackagesVisible ? (
                <main className="min-h-0 flex-1 overflow-y-auto bg-[#f4f3fb] custom-scrollbar pb-36 lg:pb-0">
                    <PackagesPage user={currentUser} onBack={() => { setPackagesVisible(false); setHistoryVisible(packagesOrigin); }} onBalanceUpdated={() => setUserBalance(getCachedBalance())} />
                </main>
            ) : (
            <>
            {/* Mobile: Vertical stacked layout. Desktop: Side by side */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden relative z-10 min-h-0 w-full">

                {/* Desktop Bento Sidebar */}
                <aside className="hidden lg:flex lg:static lg:w-[356px] xl:w-[372px] lg:h-full lg:flex-shrink-0 w-full bg-[#f7f6fd] border-r border-indigo-100/80 flex-col overflow-hidden p-3 gap-3">

                    {/* Card 1: Mode Title & Auto Download Toggle */}
                    <div
                        className="p-3.5 rounded-2xl bg-white border border-indigo-100/90 shadow-[0_2px_12px_rgba(99,102,241,0.06)] flex-shrink-0 cursor-pointer lg:cursor-default"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="w-1 h-4 bg-violet-600 rounded-full"></span>
                                <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                                    {mode === 'creative' && 'Sáng tạo vô hạn'}
                                    {mode === 'id_photo' && 'Ảnh thẻ chuyên nghiệp'}
                                    {mode === 'edit' && 'Chỉnh sửa AI'}
                                    {mode === 'upscale' && 'Siêu phân giải'}
                                    {mode === 'profile_pro' && 'Xây dựng thương hiệu'}
                                    {mode === 'restore' && 'Phục hồi ảnh cũ'}
                                    {mode === 'poster' && 'Ghép Poster Studio'}
                                    {mode === 'video' && 'Tạo Video AI'}
                                </h2>
                            </div>
                            <button className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className={`w-5 h-5 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>

                        {/* Auto Download Toggle */}
                        <div className="flex items-center justify-between bg-[#faf9ff] border border-indigo-100/80 p-2.5 rounded-xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2.5">
                                <div className="bg-white p-1.5 rounded-lg text-violet-600 shadow-2xs border border-indigo-100/90">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800 leading-tight">Tự động tải về</h4>
                                    <button onClick={handleDownloadConfigClick} className="text-[11px] text-violet-600 hover:text-violet-700 font-semibold hover:underline leading-tight">Cấu hình thư mục</button>
                                </div>
                            </div>
                            <label htmlFor="toggle" className={`relative inline-flex items-center w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 flex-shrink-0 ${autoDownload ? 'bg-violet-600' : 'bg-slate-300'}`}>
                                <input
                                    type="checkbox"
                                    name="toggle"
                                    id="toggle"
                                    checked={autoDownload}
                                    onChange={(e) => { const val = e.target.checked; setAutoDownload(val); try { localStorage.setItem('auto_download_enabled', String(val)); } catch {} }}
                                    className="sr-only"
                                />
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full shadow-sm transition-transform duration-200 ${autoDownload ? 'translate-x-6' : 'translate-x-1'}`} />
                            </label>
                        </div>
                    </div>

                    {/* Scrollable Bento Cards Area */}
                    <div className={`flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-0.5 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
                        {(!isMobileScreen || isMenuOpen) && (
                            <>
                                {/* Card 2: Dữ liệu đầu vào */}
                                <div className="bg-white rounded-2xl border border-indigo-100/90 shadow-[0_2px_12px_rgba(99,102,241,0.06)] p-3.5">
                                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 bg-violet-600 rounded-full"></span>
                                        Dữ liệu đầu vào
                                    </h3>
                                    <div className="mt-1">
                                        {renderInputs()}
                                    </div>
                                </div>

                                {/* Card 3: Cấu hình AI (Accordion) */}
                                <div className="bg-white rounded-2xl border border-indigo-100/90 shadow-[0_2px_12px_rgba(99,102,241,0.06)] overflow-hidden" data-video-config={mode === 'video' ? '' : undefined}>
                                    <button
                                        type="button"
                                        onClick={() => setIsAiConfigExpanded(!isAiConfigExpanded)}
                                        className="w-full flex items-center justify-between p-3.5 text-left hover:bg-violet-50/40 transition-colors cursor-pointer"
                                    >
                                        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 bg-violet-600 rounded-full"></span>
                                            Cấu hình AI
                                        </span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={2.2}
                                            stroke="currentColor"
                                            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isAiConfigExpanded ? 'rotate-180 text-violet-600' : ''}`}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isAiConfigExpanded && (
                                        <div className="px-3 pb-3 pt-1 border-t border-indigo-50 animate-fade-in">
                                            {renderConfig()}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    <div className={`pt-1 pb-0.5 text-center flex-shrink-0 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
                        <p className="text-[11px] text-slate-500 font-medium tracking-wide">ImageTool v{appVersion} © Studio Edition</p>
                    </div>
                </aside>

                {/* MAIN CONTENT AREA - Scenic Studio Canvas */}
                <main className="flex-1 lg:overflow-y-auto overscroll-contain bg-[#f4f3fb] flex flex-col w-full relative custom-scrollbar pb-28 lg:pb-8 min-h-0">
                    {isHistoryVisible && currentUser ? (
                        <div className="p-3 sm:p-4 md:p-8 w-full max-w-7xl mx-auto animate-fade-in">
                            <ProfilePage user={currentUser} onBack={handleCloseProfile} onImageClick={(url) => setSelectedImage({ url, index: 0 })} />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-3 sm:p-4 w-full min-h-full h-auto">

                            {/* MOBILE INLINE: Inputs + Config + Generate Button */}
                            {isMobileScreen && (
                                <div className="lg:hidden space-y-4 mb-4">
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100">
                                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-violet-600 rounded-full"></span>
                                            Dữ liệu đầu vào
                                        </h3>
                                        <div>
                                            {renderInputs()}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100" data-video-config={mode === 'video' ? '' : undefined}>
                                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-violet-600 rounded-full"></span>
                                            Cấu hình AI
                                        </h3>
                                        {renderConfig()}
                                    </div>
                                </div>
                            )}

                            {/* Render Results based on CURRENT MODE State - with outputSectionRef */}
                            <div ref={outputSectionRef} className="w-full flex-1 flex flex-col min-h-0">
                                {mode === 'video' ? (
                                    <VideoWorkspace
                                        key="video"
                                        videos={videoEntries}
                                        isLoading={isLoading}
                                        loadingStatus={loadingStatus}
                                        error={error}
                                        onDismissError={() => setError(null)}
                                    />
                                ) : mode === 'poster' ? (
                                    <PosterWorkspace
                                        key="poster"
                                        outputImages={currentData.outputs}
                                        prompts={currentData.prompts}
                                        isLoading={isLoading}
                                        loadingStatus={loadingStatus}
                                        error={error}
                                        onImageClick={(url, idx) => setSelectedImage({ url, index: idx })}
                                        onDismissError={() => setError(null)}
                                        hasInputImages={currentData.inputs.length > 0}
                                        onQuickPickTemplate={(id) => {
                                            setPosterTemplateId(id as PosterTemplateId);
                                            setIsAiConfigExpanded(true);
                                        }}
                                    />
                                ) : (
                                    <OutputDisplay
                                        key={mode}
                                        outputImages={currentData.outputs}
                                        prompts={currentData.prompts}
                                        isLoading={isLoading}
                                        loadingStatus={loadingStatus}
                                        error={error}
                                        onImageClick={(url, idx) => setSelectedImage({ url, index: idx })}
                                        onDismissError={() => setError(null)}
                                    />
                                )}
                            </div>

                            {/* Professional Print Button for ID Photo Mode (A4 / A5 / A6 / A7) */}
                            {mode === 'id_photo' && !isLoading && currentData.outputs.some(img => img !== null) && (
                                <div className="flex justify-center mt-4">
                                    <button
                                        onClick={() => setA4PrintPreviewOpen(true)}
                                        className="flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer text-sm tracking-wide"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        <span>🖨️ IN ẢNH THẺ CHUYÊN NGHIỆP (A4 / A5 / A6 / A7)</span>
                                    </button>
                                </div>
                            )}

                        </div>
                    )}
                </main>
            </div>
            </>
            )}

            {isQuotaStationOpen && currentUser && (
                <GoogleQuotaStationModal
                    isOpen={isQuotaStationOpen}
                    onClose={() => setQuotaStationOpen(false)}
                    user={currentUser}
                    onBalanceUpdated={() => {
                        setUserBalance(getCachedBalance());
                    }}
                />
            )}

            {isApiKeyModalOpen && <ApiKeyModal onClose={() => setApiKeyModalOpen(false)} />}

            {isAuthModalOpen && (
                <AuthModal
                    onClose={() => setAuthModalOpen(false)}
                    onAuthSuccess={(user) => {
                        setCurrentUser(user);
                        setAuthModalOpen(false);
                    }}
                    isBlocking={false}
                    appVersion={appVersion}
                />
            )}
            {selectedImage && (
                <ImagePreviewModal
                    base64={selectedImage.url}
                    index={selectedImage.index}
                    onClose={() => setSelectedImage(null)}
                    onUpdateImage={handleUpdateOutputImage}
                    onSendToVideo={handleSendToVideo}
                />
            )}
            {isDownloadHelpOpen && <DownloadHelpModal onClose={() => setDownloadHelpOpen(false)} />}
            {isA4PrintPreviewOpen && (
                <A4PrintPreview
                    images={currentData.outputs.filter((img): img is string => img !== null)}
                    onClose={() => setA4PrintPreviewOpen(false)}
                />
            )}

            {/* Auto-update notification (only shows in Electron) */}
            <UpdateNotification />

            {/* Admin Notification Popup */}
            {currentUser && <NotificationPopup userId={currentUser.id} />}

            {/* Support Hub - Bot + Feedback - Available on both PC and Mobile */}
            <SupportHub
                userName={currentUser?.name}
                userEmail={currentUser?.username}
                isBotOpenExternal={isSupportBotOpen}
                onBotCloseExternal={() => setIsSupportBotOpen(false)}
            />


        </div>
    );
};

export default App;
