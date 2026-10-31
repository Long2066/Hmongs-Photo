
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptPanel } from './components/PromptPanel';
import { IdPhotoPanel } from './components/IdPhotoPanel';
import { EditImagePanel } from './components/EditImagePanel';
import { UpscalePanel } from './components/UpscalePanel';
import { ProfileProPanel } from './components/ProfileProPanel';
import { RestorePhotoPanel } from './components/RestorePhotoPanel';
import { ComparisonSlider } from './components/ComparisonSlider';
import { OutputDisplay } from './components/OutputDisplay';
import { generateImagesFromPromptsList, generateIdPhotos, editImage, editImages, upscaleImage, upscaleImages, generateProfilePic, generateProfilePics, mixMatchOutfit, relightImage, extractClothing, restoreOldPhoto, getUsedSystemKey, resetUsedSystemKey } from './services/aiService';
import type { RestoreOptions } from './services/aiService';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { ImagePreviewModal } from './components/ImagePreviewModal';
// ImageCropModal removed - using simpler ImagePreviewModal for all modes
import { ApiKeyModal } from './components/ApiKeyModal';
import { ActivityLog } from './components/ActivityLog';
import { DownloadHelpModal } from './components/DownloadHelpModal';
import { Marquee } from './components/Marquee';
import { UpdateNotification } from './components/UpdateNotification';
import { NotificationPopup } from './components/NotificationPopup';
import { SupportHub } from './components/SupportHub';
import { A4PrintPreview } from './components/A4PrintPreview';
import { CreditsConfirmDialog } from './components/CreditsConfirmDialog';
import { BottomNavigation } from './components/BottomNavigation';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import * as storage from './services/storageService';
import { subscribeToUserCredits, updateUserCredits } from './services/firebaseService';
import { getSystemApiKey, getModelConfig, getSelectedImageModel, formatVND } from './services/geminiCoreService';
import { deductBalance, getCachedBalance, addUsageRecord } from './services/balanceService';
import * as firebaseService from './services/firebaseService';
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
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [hasGeminiKey, setHasGeminiKey] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ url: string, index: number } | null>(null);
    const [isDownloadHelpOpen, setDownloadHelpOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mobileActiveTab, setMobileActiveTab] = useState<'input' | 'config' | null>(null);
    const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    const [autoDownload, setAutoDownload] = useState(false);
    const [appVersion, setAppVersion] = useState('2.0.0'); // Default version

    // Loading & Error (Global mostly, but could be per mode if needed)
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Presentation State

    // Restore Mode - Comparison Slider State
    const [isComparisonActive, setComparisonActive] = useState(false);
    const [comparisonData, setComparisonData] = useState<{ before: string; after: string } | null>(null);

    // ID Photo - A4 Print Preview State
    const [isA4PrintPreviewOpen, setA4PrintPreviewOpen] = useState(false);

    // VIP Balance State (VND instead of credits)
    const [userBalance, setUserBalance] = useState(0); // VND
    const [isCreditsDialogOpen, setCreditsDialogOpen] = useState(false);
    const [pendingGeneration, setPendingGeneration] = useState<{ imageCount: number; callback: () => void } | null>(null);

    // --- MODE MANAGEMENT ---
    const [mode, setMode] = useState<'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro' | 'restore'>('creative');

    // Persistent State for ALL Modes
    const [modeStates, setModeStates] = useState<Record<string, ModeData>>({
        creative: JSON.parse(JSON.stringify(initialModeState)),
        id_photo: JSON.parse(JSON.stringify(initialModeState)),
        edit: JSON.parse(JSON.stringify(initialModeState)),
        upscale: JSON.parse(JSON.stringify(initialModeState)),
        profile_pro: JSON.parse(JSON.stringify(initialModeState)),
        restore: JSON.parse(JSON.stringify(initialModeState)),
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
    // Firestore rules require an authenticated user, so (re)subscribe once the user is logged in.
    useEffect(() => {
        if (!currentUser?.id) return;
        const unsubscribeProxy = firebaseService.subscribeToAiProxyConfig((config) => {
            console.log('[App] Received AI Proxy Cloud Config update:', config ? { enabled: config.enabled, url: config.url } : 'none');
            nineRouterService.updateNineRouterConfigFromCloud(config);
            setHasGeminiKey(nineRouterService.isNineRouterEnabled());
        });

        return () => {
            unsubscribeProxy();
        };
    }, [currentUser?.id]);

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
            return;
        }
        // Use local cached balance initially
        setUserBalance(getCachedBalance());

        const unsubscribe = subscribeToUserCredits(currentUser.id, (balance) => {
            setUserBalance(balance);
            // Cache balance to localStorage for isProUser() check
            localStorage.setItem('user_balance_' + currentUser.id, Math.floor(balance / 100).toString());
        });

        return () => unsubscribe();
    }, [currentUser]);

    // --- UTILITY ---
    const triggerDownload = (base64: string, filename: string) => {
        try {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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

    // Check if VIP mode needs credits confirmation (skip if using own Gemini key)
    const checkCreditsAndProceed = (imageCount: number, generationCallback: () => void) => {
        const hasUserGeminiKey = !!storage.getApiKey('gemini');
        const isVipMode = storage.isProUser() && storage.getUseProApi();

        // If user has their own Gemini key, skip credits check
        if (hasUserGeminiKey || !isVipMode) {
            generationCallback();
            return;
        }

        // VIP mode without user key - need credits
        if (isVipMode) {
            setPendingGeneration({ imageCount, callback: generationCallback });
            setCreditsDialogOpen(true);
        }
    };

    // Handle balance confirmation (VND)
    const handleCreditsConfirm = async () => {
        if (!pendingGeneration || !currentUser) return;

        const modelId = getSelectedImageModel();
        const model = getModelConfig(modelId);
        const pricePerImage = model?.pricePerImage || 120;
        const balanceNeeded = pendingGeneration.imageCount * pricePerImage;

        if (userBalance < balanceNeeded) {
            setError(`Không đủ số dư. Cần ${formatVND(balanceNeeded)}, hiện có ${formatVND(userBalance)}.`);
            setCreditsDialogOpen(false);
            setPendingGeneration(null);
            return;
        }

        // Deduct balance and proceed
        await updateUserCredits(currentUser.id, balanceNeeded, 'subtract');
        setCreditsDialogOpen(false);

        // Execute the pending generation
        pendingGeneration.callback();
        setPendingGeneration(null);
    };

    const handleCreditsCancel = () => {
        setCreditsDialogOpen(false);
        setPendingGeneration(null);
    };

    // Validate subscription plan quota & model before generation
    const validateSubscriptionBeforeGenerate = useCallback((requestedImages: number): boolean => {
        if (!currentUser) return false;
        if (storage.isAdmin()) return true;

        const effectivePlan = firebaseService.resolveEffectivePlan(
            firebaseService.getCachedUserPlan(currentUser.id),
            userBalance
        );

        if (effectivePlan === 'free') {
            // Force GPT 1.5 model for Free tier
            const activeModel = nineRouterService.getNineRouterImageModel();
            if (activeModel !== firebaseService.FREE_ALLOWED_MODEL) {
                nineRouterService.setNineRouterImageModel(firebaseService.FREE_ALLOWED_MODEL);
            }

            const remainingFree = firebaseService.getDailyFreeRemaining(currentUser.id);
            if (remainingFree <= 0) {
                setError(`Bạn đã sử dụng hết ${firebaseService.FREE_DAILY_IMAGE_LIMIT} ảnh miễn phí trong ngày của Gói Free. Vui lòng vào Trang cá nhân nâng cấp Gói Plus (50.000đ) hoặc Gói Pro (100.000đ) để tiếp tục tạo ảnh không giới hạn!`);
                return false;
            }
            if (requestedImages > remainingFree) {
                setError(`Gói Free của bạn chỉ còn ${remainingFree}/${firebaseService.FREE_DAILY_IMAGE_LIMIT} ảnh miễn phí hôm nay (bạn đang chọn tạo ${requestedImages} ảnh). Vui lòng giảm số lượng ảnh hoặc nâng cấp Gói Plus / Pro tại Trang cá nhân.`);
                return false;
            }
            return true;
        }

        // Plus or Pro tier: costs 500 VND / image
        const requiredVND = requestedImages * firebaseService.IMAGE_COST_VND;
        if (userBalance < requiredVND) {
            setError(`Số dư hiện tại (${formatVND(userBalance)}) không đủ để tạo ${requestedImages} ảnh (cần ${formatVND(requiredVND)} — 500đ/ảnh). Vui lòng vào Trang cá nhân mua thêm Gói Plus hoặc Gói Pro.`);
            return false;
        }

        return true;
    }, [currentUser, userBalance]);

    // Deduct balance (500đ/image for Plus & Pro) or increment daily Free counter after successful generation
    const deductBalanceForVIP = async (imagesCount: number = 1, generationType: string = 'image_generation') => {
        if (!currentUser || imagesCount <= 0) return;
        if (storage.isAdmin() && userBalance <= 0) return;

        const effectivePlan = firebaseService.resolveEffectivePlan(
            firebaseService.getCachedUserPlan(currentUser.id),
            userBalance
        );

        if (effectivePlan === 'free') {
            await firebaseService.incrementDailyFreeUsage(currentUser.id, imagesCount);
            console.log(`[FREE PLAN] Used ${imagesCount} free image(s) today.`);
            return;
        }

        const pricePerImage = firebaseService.IMAGE_COST_VND; // 500 VND / image
        const totalCost = imagesCount * pricePerImage;
        const modelId = nineRouterService.getNineRouterImageModel();

        console.log(`[SUBSCRIPTION ${effectivePlan.toUpperCase()}] Deducting ${formatVND(totalCost)} (${pricePerImage}đ x ${imagesCount} ảnh)`);

        // Deduct from local balance and add usage record
        deductBalance(totalCost, {
            modelId,
            modelName: modelId,
            imageCount: imagesCount,
            pricePerImage,
            resolution: effectivePlan === 'plus' ? 'FHD' : '4K',
            type: generationType as any
        });

        // Also update Firestore
        try {
            const nextBal = await updateUserCredits(currentUser.id, totalCost, 'subtract');
            setUserBalance(nextBal);
        } catch (err) {
            console.error('[BALANCE] Failed to sync with Firestore:', err);
        }
    };

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

        if (!validateSubscriptionBeforeGenerate(4)) return;

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

        if (!validateSubscriptionBeforeGenerate(prompts.length)) return;

        // Clamp resolution to FHD if user is not on Pro plan
        const effectivePlan = storage.isAdmin()
            ? 'pro'
            : firebaseService.resolveEffectivePlan(firebaseService.getCachedUserPlan(currentUser?.id), userBalance);
        const safeResolution = effectivePlan !== 'pro' && (resolution === '2K' || resolution === '4K')
            ? 'FHD'
            : resolution;

        // Read specific creative inputs
        const cInputs = modeStates['creative'].creativeInputs!;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(prompts.length).fill(null), prompts: prompts }));

        const localResults: (string | null)[] = Array(prompts.length).fill(null);

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
                shotType
            );

            const validImages = localResults.filter((img): img is string => img !== null);

            // Deduct credits for VIP users based on successful images
            if (validImages.length > 0) {
                await deductBalanceForVIP(validImages.length, 'image_generation');
                saveHistory('Creative Batch', prompts[0], validImages, outputMode);
            }

        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi.'); }
        finally { setIsLoading(false); setLoadingStatus(''); }
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
        if (!validateSubscriptionBeforeGenerate(actualCount)) return;

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

        if (!validateSubscriptionBeforeGenerate(outputCount)) return;

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

        if (!validateSubscriptionBeforeGenerate(outputCount)) return;

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

        if (!validateSubscriptionBeforeGenerate(1)) return;

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

    const handleLogout = async () => {
        await firebaseService.logoutUser();
        storage.logoutUser();
        setCurrentUser(null);
        setHistoryVisible(false);
        setAuthModalOpen(false);
    };

    // --- RENDER INPUT SECTION ---
    const renderInputs = () => {
        const mState = modeStates[mode];

        if (mode === 'creative') {
            return (
                <div className="grid grid-cols-2 gap-2 p-3">
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
            return <PromptPanel onGenerate={handleCreativeGenerate} isLoading={isLoading} isDisabled={!currentUser} hasApiKey={hasGeminiKey} selectedImageCount={totalCreative} inputCounts={{ male: creativeInputs.male.length, female: creativeInputs.female.length, maleAcc: creativeInputs.maleAcc.length, femaleAcc: creativeInputs.femaleAcc.length }} refImages={creativeRefImages} />;
        }
        if (mode === 'id_photo') return <IdPhotoPanel onGenerate={handleIdPhotoGenerate} isLoading={isLoading} isDisabled={!currentUser} hasApiKey={hasGeminiKey} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'edit') return <EditImagePanel onGenerate={handleEditImage} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'upscale') return <UpscalePanel onGenerate={handleUpscale} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'profile_pro') return <ProfileProPanel onGenerate={handleProfilePro} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'restore') return <RestorePhotoPanel onGenerate={handleRestorePhoto} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
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
        <div className="h-screen text-slate-900 font-sans antialiased flex flex-col selection:bg-indigo-100 relative overflow-hidden bg-slate-100">

            <Marquee />

            <Header
                user={currentUser}
                onLoginClick={() => setAuthModalOpen(true)}
                onLogout={handleLogout}
                onHistoryClick={() => setHistoryVisible(true)}

                isHistoryVisible={isHistoryVisible}
                currentMode={mode}
                onModeChange={setMode}
            />

            {/* Mobile: Vertical stacked layout. Desktop: Side by side */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">

                {/* INPUT PANEL - Always visible, collapsible on mobile */}
                {/* Desktop Sidebar - Hidden on mobile (using bottom navigation instead) */}
                <aside className="hidden lg:flex lg:static lg:w-[380px] lg:h-full lg:flex-shrink-0 w-full bg-white border-r border-slate-200/90 shadow-xs flex-col overflow-hidden">

                    {/* Collapsible Header - Tap to expand/collapse on mobile */}
                    <div
                        className="p-3 border-b border-slate-200 flex-shrink-0 bg-white cursor-pointer lg:cursor-default"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {/* Mode Indicator with expand/collapse toggle */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                                    {mode === 'creative' && 'Sáng tạo vô hạn'}
                                    {mode === 'id_photo' && 'Ảnh thẻ chuyên nghiệp'}
                                    {mode === 'edit' && 'Chỉnh sửa AI'}
                                    {mode === 'upscale' && 'Siêu phân giải'}
                                    {mode === 'profile_pro' && 'Xây dựng thương hiệu'}
                                    {mode === 'restore' && 'Phục hồi ảnh cũ'}
                                </h2>
                            </div>
                            {/* Mobile expand/collapse indicator */}
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

                        {/* Auto Download Toggle - Always visible */}
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl shadow-xs ring-1 ring-slate-900/5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2.5">
                                <div className="bg-white p-1.5 rounded-lg text-indigo-600 shadow-xs border border-slate-200/80">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800">Tự động tải về</h4>
                                    <button onClick={handleDownloadConfigClick} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold hover:underline">Cấu hình thư mục</button>
                                </div>
                            </div>
                            <div className="relative inline-block w-9 h-5 align-middle select-none">
                                <input type="checkbox" name="toggle" id="toggle" checked={autoDownload} onChange={(e) => setAutoDownload(e.target.checked)} className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-4 checked:border-indigo-600 shadow-sm top-0.5" />
                                <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${autoDownload ? 'bg-indigo-600' : 'bg-slate-300'}`}></label>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content Area - Expandable on mobile */}
                    <div className={`flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
                        {(!isMobileScreen || isMenuOpen) && (
                            <>
                                {/* Input Section */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 px-1">
                                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                                        Dữ liệu đầu vào
                                    </h3>
                                    <div className="bg-slate-50 rounded-xl border border-slate-200/90 p-1 overflow-hidden shadow-xs ring-1 ring-slate-900/5">
                                        {renderInputs()}
                                    </div>
                                </div>

                                {/* Config Section */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                                        Cấu hình AI
                                    </h3>
                                    <div className="bg-white">
                                        {renderConfig()}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Sidebar Footer - Hidden on mobile when collapsed */}
                    <div className={`p-3 bg-slate-50 border-t border-slate-200 text-center flex-shrink-0 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
                        <p className="text-[11px] text-slate-600 font-semibold tracking-wide">ImageTool v{appVersion} © Studio Edition</p>
                    </div>
                </aside>

                {/* MAIN CONTENT AREA - Solid crisp canvas */}
                <main className="flex-1 overflow-y-auto bg-slate-100 flex flex-col w-full relative custom-scrollbar pb-24 lg:pb-0">
                    {isHistoryVisible && currentUser ? (
                        <div className="p-4 md:p-8 w-full max-w-7xl mx-auto animate-fade-in">
                            <ProfilePage user={currentUser} onBack={() => setHistoryVisible(false)} onImageClick={(url) => setSelectedImage({ url, index: 0 })} />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-4 md:p-8 w-full h-full">

                            {/* MOBILE INLINE: Inputs + Config + Generate Button - only mounted when actually on mobile screen */}
                            {isMobileScreen && (
                                <div className="lg:hidden space-y-4 mb-6">
                                    {/* Mobile Inputs Section */}
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Ảnh đầu vào
                                        </h3>
                                        <div className="bg-slate-50/50 rounded-xl overflow-hidden">
                                            {renderInputs()}
                                        </div>
                                    </div>

                                    {/* Mobile Config Section */}
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Cấu hình AI
                                        </h3>
                                        {renderConfig()}
                                    </div>
                                </div>
                            )}

                            {/* Render Results based on CURRENT MODE State */}
                            
                            <OutputDisplay
                                outputImages={currentData.outputs}
                                prompts={currentData.prompts}
                                isLoading={isLoading}
                                loadingStatus={loadingStatus}
                                error={error}
                                onImageClick={(url, idx) => setSelectedImage({ url, index: idx })}
                            />

                            {/* A4 Print Button for ID Photo Mode */}
                            {mode === 'id_photo' && !isLoading && currentData.outputs.some(img => img !== null) && (
                                <div className="flex justify-center mt-4">
                                    <button
                                        onClick={() => setA4PrintPreviewOpen(true)}
                                        className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-95"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        📄 IN ẢNH THẺ A4
                                    </button>
                                </div>
                            )}


                        </div>
                    )}
                </main>
            </div>

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
                <ImagePreviewModal base64={selectedImage.url} index={selectedImage.index} onClose={() => setSelectedImage(null)} />
            )}
            {isDownloadHelpOpen && <DownloadHelpModal onClose={() => setDownloadHelpOpen(false)} />}

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
