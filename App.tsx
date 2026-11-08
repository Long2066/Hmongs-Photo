
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
import { FlowEmbeddedPage } from './components/FlowEmbeddedPage';
import { ComparisonSlider } from './components/ComparisonSlider';
import { OutputDisplay } from './components/OutputDisplay';
import { generateImagesFromPromptsList, generateIdPhotos, editImage, editImages, upscaleImage, upscaleImages, generateProfilePic, generateProfilePics, mixMatchOutfit, relightImage, extractClothing, restoreOldPhoto, getUsedSystemKey, resetUsedSystemKey } from './services/aiService';
import { generateOpenRouterVideo } from './services/openRouterVideoService';
import { getVideoConfig } from './services/videoConfigService';
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
import { refreshSubscription, consumeSubscriptionImages } from './services/subscriptionService';
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
    const [currentSubscriptionPlan, setCurrentSubscriptionPlan] = useState<firebaseService.SubscriptionPlan>('free');
    const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);

    // --- MODE MANAGEMENT ---
    const [mode, setMode] = useState<'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore' | 'video'>('creative');
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
            setCurrentSubscriptionPlan('free');
            setSubscriptionExpiresAt(null);
            return;
        }
        // Use local cached balance initially
        setUserBalance(getCachedBalance());

        const unsubscribe = subscribeToUserCredits(currentUser.id, (balance, state) => {
            setRemainingPaidImages(state?.remainingImages ?? 0);
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
            if (requestedImages > entitlement.remainingImages) {
                setError(`Gói ${entitlement.plan === 'pro' ? 'Pro' : 'Plus'} chỉ còn ${entitlement.remainingImages} ảnh. Hãy giảm số ảnh hoặc chọn gói mới tại Cấu hình & gói dịch vụ.`);
                return false;
            }
            return true;
        }
        const modelId = nineRouterService.getNineRouterImageModel();
        if (nineRouterService.isModelPaid(modelId)) {
            setError('Mô hình này cần gói Plus hoặc Pro. Vui lòng chọn gói tại Cấu hình & gói dịch vụ.');
            return false;
        }
        const remainingFree = firebaseService.getDailyFreeRemaining(currentUser.id);
        const bonusImages = Math.floor(userBalance / firebaseService.IMAGE_COST_VND);
        if (requestedImages > remainingFree + bonusImages) {
            setError(`Bạn còn ${remainingFree} ảnh miễn phí hôm nay${bonusImages ? ` và ${bonusImages} ảnh thưởng` : ''}. Vui lòng giảm số ảnh hoặc chọn gói tại Cấu hình & gói dịch vụ.`);
            return false;
        }
        return true;
    }, [currentUser, currentSubscriptionPlan, userBalance]);

    // Paid packages consume image quotas; Free uses daily images first, then existing earned bonus images.
    const deductBalanceForVIP = async (imagesCount: number = 1, _generationType: string = 'image_generation') => {
        if (!currentUser || imagesCount <= 0 || storage.isAdmin()) return;
        if (currentSubscriptionPlan !== 'free') {
            await consumeSubscriptionImages(imagesCount);
            return;
        }
        const dailyUsed = Math.min(imagesCount, firebaseService.getDailyFreeRemaining(currentUser.id));
        if (dailyUsed) await firebaseService.incrementDailyFreeUsage(currentUser.id, dailyUsed);
        const bonusUsed = imagesCount - dailyUsed;
        if (bonusUsed) setUserBalance(await updateUserCredits(currentUser.id, bonusUsed * firebaseService.IMAGE_COST_VND, 'subtract'));
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
            }
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi.'); }
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
            }

        } catch (e: any) {
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

    // 3. Edit Image (Batch Support)
    const handleEditImage = useCallback(async (prompt: string, type: 'general' | 'mix' | 'relight' | 'extract', outputCount: number, extraData?: any) => {
        console.log('[DEBUG] handleEditImage called:', { prompt, type, outputCount });

        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        const inputs = modeStates['edit'].inputs;
        console.log('[DEBUG] Edit inputs length:', inputs.length);

        if (type !== 'mix' && inputs.length === 0) { setError("Vui lòng tải lên ảnh."); return; }
        if (type === 'mix' && inputs.length < 2) { setError("Vui lòng tải lên 2 ảnh để phối đồ."); return; }

        const actualCount = type === 'general' ? outputCount : 1;
        if (!await validateSubscriptionBeforeGenerate(actualCount)) return;

        console.log('[DEBUG] Starting edit generation...');
        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(outputCount).fill(null) }));

        const localResults: (string | null)[] = Array(outputCount).fill(null);

        try {
            let historyPrompt = prompt;

            if (type === 'general') {
                // Use batch editImages for multiple outputs
                await editImages(
                    apiKey,
                    { data: inputs[0].base64, mimeType: inputs[0].mimeType },
                    prompt,
                    outputCount,
                    (status) => setLoadingStatus(status),
                    (index, base64) => {
                        updateModeState((prev) => {
                            const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                        });
                        localResults[index] = base64;
                        if (autoDownload && base64) triggerDownload(base64, `edited_${index + 1}.png`);
                    }
                );
            } else if (type === 'mix') {
                setLoadingStatus('Đang phối đồ Mix & Match...');
                const result = await mixMatchOutfit(
                    apiKey,
                    { data: inputs[0].base64, mimeType: inputs[0].mimeType },
                    { data: inputs[1].base64, mimeType: inputs[1].mimeType }
                );
                localResults[0] = result;
                updateModeState(() => ({ outputs: [result] }));
                historyPrompt = "Outfit Mix & Match";
                if (autoDownload && result) triggerDownload(result, 'mix_match.png');
            } else if (type === 'relight') {
                setLoadingStatus('Đang thay đổi ánh sáng...');
                const result = await relightImage(apiKey, { data: inputs[0].base64, mimeType: inputs[0].mimeType }, extraData.lighting);
                localResults[0] = result;
                updateModeState(() => ({ outputs: [result] }));
                historyPrompt = `Relighting: ${extraData.lighting}`;
                if (autoDownload && result) triggerDownload(result, 'relighted.png');
            } else if (type === 'extract') {
                setLoadingStatus('Đang tách trang phục (Ghost Mannequin)...');
                const result = await extractClothing(apiKey, { data: inputs[0].base64, mimeType: inputs[0].mimeType });
                localResults[0] = result;
                updateModeState(() => ({ outputs: [result] }));
                historyPrompt = "Clothing Extraction";
                if (autoDownload && result) triggerDownload(result, 'extracted.png');
            }

            updateModeState(() => ({ prompts: [historyPrompt] }));
            const validImages = localResults.filter((img): img is string => img !== null);
            // Deduct credits for VIP users
            if (validImages.length > 0) {
                await deductBalanceForVIP(validImages.length, 'edit');
                saveHistory('Edit Tool', historyPrompt, validImages, type);
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
            updateModeState(() => ({ outputs: [result], prompts: ['Phục hồi ảnh cũ'] }));

            if (result) {
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
            }
        } catch (e) {
            console.error('[DEBUG] Restore error:', e);
            setError(e instanceof Error ? e.message : 'Lỗi phục hồi ảnh.');
            updateModeState(() => ({ outputs: [] }));
        }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, currentUser, validateSubscriptionBeforeGenerate]);

    // 8. Video Generation (OpenRouter Gemini Omni 1.2 Flash + Omni 1.1 Flash Fallback)
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
        const vConfig = await getVideoConfig();
        const pricePerVideo = vConfig.pricePerVideoVnd || 700;
        const totalCostVnd = pricePerVideo * count;

        if (!storage.isAdmin() && userBalance < totalCostVnd) {
            setError(`Số dư không đủ (${userBalance.toLocaleString('vi-VN')}đ). Cần ${totalCostVnd.toLocaleString('vi-VN')}đ để tạo ${count} video. Vui lòng nạp tiền vào tài khoản.`);
            setPackagesVisible(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        setIsMenuOpen(false);
        setLoadingStatus(`Đang gửi yêu cầu tạo ${count} video tới OpenRouter Gemini Omni Engine...`);
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

            // Deduct balance for non-admin VIP
            if (!storage.isAdmin() && currentUser && totalCostVnd > 0) {
                try {
                    const newBal = await updateUserCredits(currentUser.id, totalCostVnd, 'subtract');
                    setUserBalance(newBal);
                } catch (bErr) {
                    console.warn('Lỗi trừ số dư video:', bErr);
                }
            }

            const source = subMode === 'image_to_video' ? inputs[0] : undefined;
            const firstFrame = source
                ? source.base64.startsWith('data:') || /^https?:\/\//i.test(source.base64)
                    ? source.base64
                    : `data:${source.mimeType};base64,${source.base64}`
                : undefined;
            const createdAt = Date.now();
            setVideoEntries(previous => {
                const next = finalUrls.map(url => ({
                    url,
                    firstFrame,
                    createdAt,
                    prompt,
                    modelUsed: result.modelUsed,
                    duration: result.duration,
                    aspectRatio: result.aspectRatio
                }));
                return [...next, ...previous.filter(item => !finalUrls.includes(item.url))];
            });
            updateModeState(() => ({
                outputs: finalUrls,
                prompts: Array(finalUrls.length).fill(prompt),
            }));

            saveHistory('Video Omni AI', prompt, finalUrls, subMode === 'image_to_video' ? 'Image-to-Video' : 'Text-to-Video');
        } catch (e) {
            console.error('[Video Error]:', e);
            setError(e instanceof Error ? e.message : 'Lỗi tạo video OpenRouter.');
            updateModeState(() => ({ outputs: [] }));
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    }, [modeStates, saveHistory, userBalance, currentUser]);

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
                        label={mode === 'edit' ? "Ảnh đầu vào (Upload 2 ảnh nếu Mix đồ)" : mode === 'restore' ? "Ảnh cũ cần phục hồi" : "Ảnh đầu vào"}
                        onImagesChange={handleImagesChange}
                        maxImages={mode === 'edit' ? 2 : 1}
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
        if (mode === 'edit') return <EditImagePanel onGenerate={handleEditImage} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'upscale') return <UpscalePanel onGenerate={handleUpscale} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'profile_pro') return <ProfileProPanel onGenerate={handleProfilePro} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'restore') return <RestorePhotoPanel onGenerate={handleRestorePhoto} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
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
                    userBalance={userBalance}
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
        <div className="h-screen text-slate-900 font-sans antialiased flex flex-col selection:bg-violet-100 relative overflow-hidden bg-[#f4f3fb]">

            <Marquee />

            <Header
                user={currentUser}
                onLoginClick={() => setAuthModalOpen(true)}
                onLogout={handleLogout}
                onHistoryClick={() => { setPackagesVisible(false); setHistoryVisible(true); }}
                onQuotaStationClick={() => { setPackagesOrigin(isHistoryVisible); setHistoryVisible(false); setPackagesVisible(true); }}

                isHistoryVisible={isHistoryVisible}
                currentMode={mode}
                onModeChange={(nextMode) => {
                    setMode(nextMode);
                    if (nextMode !== 'creative') setIsAiConfigExpanded(true);
                }}
            />

            {isPackagesVisible ? (
                <main className="min-h-0 flex-1 overflow-y-auto bg-[#f4f3fb] custom-scrollbar">
                    <PackagesPage user={currentUser} onBack={() => { setPackagesVisible(false); setHistoryVisible(packagesOrigin); }} onBalanceUpdated={() => setUserBalance(getCachedBalance())} />
                </main>
            ) : (
            <>
            {/* Mobile: Vertical stacked layout. Desktop: Side by side */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">

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
                <main className="flex-1 overflow-y-auto bg-[#f4f3fb] flex flex-col w-full relative custom-scrollbar pb-24 lg:pb-0">
                    {isHistoryVisible && currentUser ? (
                        <div className="p-4 md:p-8 w-full max-w-7xl mx-auto animate-fade-in">
                            <ProfilePage user={currentUser} onBack={() => setHistoryVisible(false)} onImageClick={(url) => setSelectedImage({ url, index: 0 })} />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-3 lg:p-4 w-full h-full">

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

                            {/* Render Results based on CURRENT MODE State */}
                            {mode === 'video' ? (
                                <VideoWorkspace
                                    videos={videoEntries}
                                    isLoading={isLoading}
                                    loadingStatus={loadingStatus}
                                    error={error}
                                />
                            ) : (
                                <OutputDisplay
                                    outputImages={currentData.outputs}
                                    prompts={currentData.prompts}
                                    isLoading={isLoading}
                                    loadingStatus={loadingStatus}
                                    error={error}
                                    onImageClick={(url, idx) => setSelectedImage({ url, index: idx })}
                                />
                            )}

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

            {/* Support Hub - Bot + Feedback - Hidden on mobile to avoid overlap */}
            <div className="hidden lg:block">
                <SupportHub
                    userName={currentUser?.name}
                    userEmail={currentUser?.username}
                />
            </div>


        </div>
    );
};

export default App;
