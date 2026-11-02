import React, { useState, useEffect, useRef } from 'react';
import {
    getVideoEngine,
    setVideoEngine,
    VideoEngine,
    checkFlowExtensionInstalled,
    getVideoPreset,
    setVideoPreset,
    getVideoResolution,
    setVideoResolution,
    getVideoDuration,
    setVideoDuration,
    isElectronApp,
    listElectronProfiles,
    addElectronProfile,
    importElectronFlowCookies,
    openExternalFlowUrl,
    removeElectronProfile,
    ElectronFlowProfile,
} from '../services/geminiVideoService';

import {
    getFalApiKey,
    getSavedFalModel,
} from '../services/falVideoService';

export interface VideoPanelProps {
    subMode: 'text_to_video' | 'image_to_video';
    onSubModeChange: (subMode: 'text_to_video' | 'image_to_video') => void;
    onGenerate: (
        prompt: string,
        aspectRatio: '16:9' | '9:16',
        subMode: 'text_to_video' | 'image_to_video',
        model: string,
        outputCount: number
    ) => void;
    onImagesChange?: (images: { base64: string; mimeType: string; id: number; fileName?: string }[]) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputImagePreview?: string;
}

// 1. Models matching Google Flow Tool App (Screenshot 3)
const FLOW_MODEL_OPTIONS = [
    {
        id: 'Omni 1.1 Flash',
        name: 'Omni 1.1 Flash',
        badge: 'Linh hoạt',
        desc: 'Nhanh & Linh hoạt (360p/720p, tối đa 10s)',
    },
    {
        id: 'Veo 3.1 - Lite',
        name: 'Veo 3.1 - Lite',
        badge: 'Điện ảnh',
        desc: 'Chuyển động mượt mà điện ảnh (720p, 8s)',
    },
    {
        id: 'Veo 3.1 - Fast',
        name: 'Veo 3.1 - Fast',
        badge: 'Tối ưu',
        desc: 'Tốc độ kết xuất tối ưu (720p, 8s)',
    },
];

// 2. Presets matching Google Flow Tool App (Screenshot 4)
const MOTION_PRESETS = [
    {
        id: 'Chân dung tự nhiên',
        icon: '😊',
        title: 'Chân dung tự nhiên',
        desc: 'Chớp mắt, tóc bay, mỉm cười nhẹ',
        samplePrompt: 'Chân dung tự nhiên: chủ thể chớp mắt nhẹ nhàng, tà áo và làn tóc khẽ bay trong gió, nụ cười tươi tắn tự nhiên nhìn về phía máy ảnh',
    },
    {
        id: 'Camera Pan điện ảnh',
        icon: '🎬',
        title: 'Camera Pan điện ảnh',
        desc: 'Góc lia máy mượt, chiều sâu trường ảnh',
        samplePrompt: 'Camera pan điện ảnh: góc quay lia ngang từ từ tạo chiều sâu trường ảnh mượt mà, ánh sáng điện ảnh cinematic 4k bao quát cả nhân vật và không gian',
    },
    {
        id: 'Bước đi Fashion Runway',
        icon: '🚶',
        title: 'Bước đi Fashion Runway',
        desc: 'Bước đi tự tin, chuyển động vải áo vạt bay',
        samplePrompt: 'Bước đi Fashion Runway: bước đi phong thái tự tin uyển chuyển, chuyển động tà áo và nếp vải tung bay theo từng bước chân đầy cuốn hút',
    },
    {
        id: 'Gió & Ngoại cảnh phiêu lãng',
        icon: '🍃',
        title: 'Gió & Ngoại cảnh phiêu lãng',
        desc: 'Gió cuốn lá/vạt áo, ánh sáng đổi hướng',
        samplePrompt: 'Gió & ngoại cảnh phiêu lãng: cơn gió nhẹ thổi qua làm rung rinh hoa lá xung quanh, vạt áo lay động nhẹ nhàng, vệt nắng hoàng hôn đổi hướng lãng mạn',
    },
    {
        id: 'Slow Push-in (Tiến gần)',
        icon: '🔍',
        title: 'Slow Push-in (Tiến gần)',
        desc: 'Tiến sát cảm xúc vào chủ thể',
        samplePrompt: 'Slow push-in: máy quay chuyển động chậm rãi tiến gần dần về phía khuôn mặt chủ thể, ánh mắt lấp lánh cảm xúc chân thực',
    },
];

export const VideoPanel: React.FC<VideoPanelProps> = ({
    subMode,
    onSubModeChange,
    onGenerate,
    onImagesChange,
    isLoading,
    isDisabled,
    hasInputImage,
    inputImagePreview,
}) => {
    // Engine State: 'flow_extension' (Default) vs 'fal_ai' vs 'flow_local'
    const [engine, setEngineState] = useState<VideoEngine>(() => getVideoEngine());

    // Electron Multi-Profile State
    const isElectron = isElectronApp();
    const [profiles, setProfiles] = useState<ElectronFlowProfile[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('auto');
    const [isLoggingInGoogle, setIsLoggingInGoogle] = useState<boolean>(false);
    const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
    const [addAccountTab, setAddAccountTab] = useState<'chrome' | 'cookie'>('chrome');
    const [cookieInputText, setCookieInputText] = useState<string>('');
    const [cookieEmailText, setCookieEmailText] = useState<string>('');
    const [isSubmittingCookie, setIsSubmittingCookie] = useState<boolean>(false);
    const [chromeAuthStatusText, setChromeAuthStatusText] = useState<string>('');

    useEffect(() => {
        if (isElectron) {
            listElectronProfiles().then(setProfiles);

            // Pre-warm Video Server 8100 when opening Video panel
            const api = (window as any).electronAPI;
            if (api?.flowProfileEnsureServer) {
                api.flowProfileEnsureServer().catch(() => {});
            } else if (api?.invoke) {
                api.invoke('flow-profile:ensure-server').catch(() => {});
            }

            if (api?.onFlowAuthStatus) {
                const unsubscribe = api.onFlowAuthStatus((data: any) => {
                    if (data?.message) {
                        setChromeAuthStatusText(data.message);
                    }
                });
                return () => {
                    if (typeof unsubscribe === 'function') unsubscribe();
                };
            }
        }
    }, [isElectron]);

    const handleOpenAddAccountModal = () => {
        setShowAddAccountModal(true);
        setChromeAuthStatusText('');
    };

    const handleStartChromeLogin = async () => {
        setIsLoggingInGoogle(true);
        setChromeAuthStatusText('Đang mở trình duyệt Chrome... Vui lòng đăng nhập Gmail trên cửa sổ vừa mở.');
        try {
            const res = await addElectronProfile();
            if (res.success && res.profile) {
                const updated = await listElectronProfiles();
                setProfiles(updated);
                setSelectedProfileId(res.profile.id);
                setShowAddAccountModal(false);
                setChromeAuthStatusText('');
                alert(`Đã kết nối tài khoản Google: ${res.profile.email} thành công!`);
            } else if (res.error) {
                alert(`Lỗi kết nối: ${res.error}`);
            }
        } catch (e: any) {
            alert(`Lỗi: ${e.message || 'Không thể mở trình duyệt Chrome'}`);
        } finally {
            setIsLoggingInGoogle(false);
        }
    };

    const handleImportCookies = async () => {
        if (!cookieInputText.trim()) {
            alert('Vui lòng dán chuỗi Cookie hoặc JSON từ Cookie-Editor!');
            return;
        }
        setIsSubmittingCookie(true);
        try {
            const res = await importElectronFlowCookies(cookieInputText.trim(), cookieEmailText.trim());
            if (res.success && res.profile) {
                const updated = await listElectronProfiles();
                setProfiles(updated);
                setSelectedProfileId(res.profile.id);
                setCookieInputText('');
                setCookieEmailText('');
                setShowAddAccountModal(false);
                alert(`Đã kết nối tài khoản Google: ${res.profile.email} thành công!`);
            } else {
                alert(`Lỗi nạp Cookie: ${res.error || 'Cookie không hợp lệ hoặc đã hết hạn'}`);
            }
        } catch (e: any) {
            alert(`Lỗi: ${e.message || 'Lỗi khi nhập Cookie'}`);
        } finally {
            setIsSubmittingCookie(false);
        }
    };

    const handleRemoveGoogleAccount = async (profileId: string) => {
        await removeElectronProfile(profileId);
        const updated = await listElectronProfiles();
        setProfiles(updated);
        if (selectedProfileId === profileId) {
            setSelectedProfileId('auto');
        }
    };

    // Extension Specific State
    const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(false);
    const [showExtensionGuide, setShowExtensionGuide] = useState<boolean>(false);

    // Synchronized Parameters matching Google Flow Tool App (Screenshots 3, 4, 5)
    const [selectedFlowModel, setSelectedFlowModel] = useState<string>('Veo 3.1 - Lite');
    const [selectedPreset, setSelectedPresetState] = useState<string>(() => getVideoPreset());
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [resolution, setResolutionState] = useState<'360p' | '720p'>(() => getVideoResolution());
    const [duration, setDurationState] = useState<'4s' | '6s' | '8s' | '10s'>(() => getVideoDuration());
    const [outputCount, setOutputCount] = useState<number>(1);
    const [prompt, setPrompt] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // Direct hidden file input for 100% reliable image picking
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ensure mode is synced to image_to_video
    useEffect(() => {
        if (subMode !== 'image_to_video') {
            onSubModeChange('image_to_video');
        }
    }, [subMode, onSubModeChange]);

    const handleSwitchEngine = (newEngine: VideoEngine) => {
        setEngineState(newEngine);
        setVideoEngine(newEngine);
    };

    const handleSelectPreset = (pId: string, sample: string) => {
        setSelectedPresetState(pId);
        setVideoPreset(pId);
        if (!prompt.trim()) {
            setPrompt(sample);
        }
    };

    const handleSelectResolution = (res: '360p' | '720p') => {
        setResolutionState(res);
        setVideoResolution(res);
    };

    const handleSelectDuration = (dur: '4s' | '6s' | '8s' | '10s') => {
        setDurationState(dur);
        setVideoDuration(dur);
    };

    // Detect Extension
    useEffect(() => {
        let mounted = true;
        const check = async () => {
            const installed = await checkFlowExtensionInstalled();
            if (mounted) setIsExtensionInstalled(installed);
        };
        check();

        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'FLOW_BRIDGE_PONG') {
                if (mounted) setIsExtensionInstalled(true);
            }
        };
        window.addEventListener('message', handler);
        return () => {
            mounted = false;
            window.removeEventListener('message', handler);
        };
    }, []);

    // Auto-detect image aspect ratio from uploaded preview
    useEffect(() => {
        if (!inputImagePreview) return;
        const src = inputImagePreview.startsWith('data:')
            ? inputImagePreview
            : `data:image/png;base64,${inputImagePreview}`;
        const img = new Image();
        img.onload = () => {
            if (img.naturalWidth > img.naturalHeight) {
                setAspectRatio('16:9');
            } else if (img.naturalHeight > img.naturalWidth) {
                setAspectRatio('9:16');
            }
        };
        img.src = src;
    }, [inputImagePreview]);

    // Handle File processing
    const processFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn tệp hình ảnh (PNG, JPG, WEBP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const fullUrl = e.target?.result as string;
            if (!fullUrl) return;
            const base64 = fullUrl.includes(',') ? fullUrl.split(',')[1] : fullUrl;

            if (onImagesChange) {
                onImagesChange([
                    {
                        base64,
                        mimeType: file.type || 'image/png',
                        id: Date.now(),
                        fileName: file.name,
                    },
                ]);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDirectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
        // Reset file input value so re-selecting same file triggers change
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleTriggerImageUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleRemoveImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onImagesChange) {
            onImagesChange([]);
        }
    };

    // Drag & Drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    // Global Paste (Ctrl+V) listener when on this panel
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) {
                        processFile(file);
                        break;
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [onImagesChange]);

    const isProfileMode = engine === 'flow_profile';
    const isExtensionMode = engine === 'flow_extension';
    const isFalMode = engine === 'fal_ai';

    const canSubmit = !isLoading && !isDisabled && hasInputImage;

    const handleExecuteGenerate = () => {
        if (isElectron) {
            if (profiles.length === 0 && !isFalMode) {
                alert('Vui lòng bấm "Thêm Gmail" để kết nối tài khoản Google trước khi tạo video!');
                return;
            }
        } else if (isExtensionMode && !isExtensionInstalled) {
            setShowExtensionGuide(true);
            alert('Vui lòng cài đặt Tiện ích vip-imagetools trên Chrome để tạo video tự động (hoặc nhấn F5 nếu bạn vừa cài xong). Hãy xem hướng dẫn tải và cài đặt ở khung bên trên!');
            return;
        }

        const finalPrompt =
            prompt.trim() ||
            MOTION_PRESETS.find((p) => p.id === selectedPreset)?.samplePrompt ||
            'Chuyển động tự nhiên';
        const activeModel = isExtensionMode
            ? selectedFlowModel
            : isFalMode
            ? getSavedFalModel()
            : selectedFlowModel;
        onGenerate(finalPrompt, aspectRatio, 'image_to_video', activeModel, outputCount);
    };

    return (
        <div className="flex flex-col gap-4 p-1 animate-fade-in select-none">
            {/* Hidden native input for 100% reliable file selection */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleDirectFileChange}
            />

            {/* Header: VIDEOTOOL PRO (Matching Google Flow Screenshot 3) */}
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-xs text-xl">
                        🎬
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black tracking-wide text-white font-mono">
                                VIDEOTOOL PRO
                            </span>
                            <span className="px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30">
                                AI Video Lab
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-300 font-medium">
                            Chuyển hóa ảnh tĩnh thành video điện ảnh mượt mà
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <span
                        className={`w-2.5 h-2.5 rounded-full ${
                            isElectron
                                ? profiles.length > 0
                                    ? 'bg-emerald-400'
                                    : 'bg-amber-400 animate-pulse'
                                : isExtensionMode && isExtensionInstalled
                                ? 'bg-emerald-400'
                                : isExtensionMode
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-indigo-400'
                        }`}
                    />
                    <span className="text-[10.5px] text-slate-300 font-mono font-medium">
                        {isElectron
                            ? profiles.length > 0
                                ? `${profiles.length} Acc sẵn sàng`
                                : 'Cần thêm Gmail'
                            : isExtensionMode && isExtensionInstalled
                            ? 'Extension OK'
                            : isExtensionMode
                            ? 'Cần Extension'
                            : 'Cloud'}
                    </span>
                </div>
            </div>

            {/* Engine Segmented Bar */}
            {isElectron ? (
                <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-xl ring-1 ring-slate-900/5">
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_profile')}
                        className={`min-h-[38px] flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                            engine === 'flow_profile'
                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Hồ sơ tài khoản Google lưu trực tiếp trên máy"
                    >
                        <span>👤</span>
                        <span className="truncate">Google Veo</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_extension')}
                        className={`min-h-[38px] flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                            engine === 'flow_extension'
                                ? 'bg-white text-amber-600 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Tiện ích mở rộng vip-imagetools trên Chrome"
                    >
                        <span>🧩</span>
                        <span className="truncate">Extension</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('fal_ai')}
                        className={`min-h-[38px] flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                            isFalMode
                                ? 'bg-white text-purple-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Tạo video siêu nhanh qua Fal.ai Cloud"
                    >
                        <span>🚀</span>
                        <span className="truncate">Fal.ai Cloud</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_local')}
                        className={`min-h-[38px] flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                            engine === 'flow_local'
                                ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Chạy qua server flow-py-main port 8100"
                    >
                        <span>💻</span>
                        <span className="truncate">Server PC</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl ring-1 ring-slate-900/5">
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_extension')}
                        className={`min-h-[40px] flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            isExtensionMode
                                ? 'bg-white text-amber-600 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>🧩</span>
                        <span className="truncate">Google Flow</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('fal_ai')}
                        className={`min-h-[40px] flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            isFalMode
                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>🚀</span>
                        <span className="truncate">Fal.ai Cloud</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_local')}
                        className={`min-h-[40px] flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            engine === 'flow_local'
                                ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>💻</span>
                        <span className="truncate">Server PC (.vbs)</span>
                    </button>
                </div>
            )}

            {/* Electron Multi-Profile Account Manager */}
            {isElectron && (engine === 'flow_profile' || engine === 'flow_extension') && (
                <div className="p-3.5 rounded-2xl bg-slate-50 ring-1 ring-slate-900/5 flex flex-col gap-3 animate-fade-in shadow-xs">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">👥</span>
                            <span className="text-xs font-bold text-slate-900">
                                Hồ sơ Tài khoản Google ({profiles.length})
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setAddAccountTab('cookie');
                                    handleOpenAddAccountModal();
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg ring-1 ring-amber-500/20 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title="Dán cookie tài khoản Google Flow nhanh 5s"
                            >
                                <span>📋</span>
                                <span>Dán Cookie</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAddAccountTab('chrome');
                                    handleOpenAddAccountModal();
                                }}
                                disabled={isLoggingInGoogle}
                                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg ring-1 ring-indigo-500/20 flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                            >
                                <span>➕</span>
                                <span>{isLoggingInGoogle ? 'Đang mở đăng nhập...' : 'Thêm Gmail'}</span>
                            </button>
                        </div>
                    </div>

                    {profiles.length === 0 ? (
                        <div className="p-3.5 rounded-xl bg-amber-50/80 ring-1 ring-amber-500/20 flex flex-col gap-2.5">
                            <div className="flex items-start gap-2">
                                <span className="text-lg shrink-0">🔑</span>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-amber-950">Chưa kết nối tài khoản Google</span>
                                    <span className="text-[11px] text-amber-800 leading-relaxed">
                                        Đăng nhập an toàn qua Chrome hoặc dán Cookie 1 lần duy nhất. Ứng dụng tự động lưu hồ sơ độc lập để tạo video Veo 3.1!
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddAccountTab('chrome');
                                        handleOpenAddAccountModal();
                                    }}
                                    disabled={isLoggingInGoogle}
                                    className="py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                                >
                                    <span>🌐</span>
                                    <span>Mở Chrome đăng nhập</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddAccountTab('cookie');
                                        handleOpenAddAccountModal();
                                    }}
                                    className="py-2.5 bg-white hover:bg-slate-50 text-slate-800 ring-1 ring-slate-900/10 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                                >
                                    <span>📋</span>
                                    <span>Dán Cookie (Nhanh 5s)</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedProfileId('auto')}
                                    className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer ${
                                        selectedProfileId === 'auto'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    🔄 Tự động xoay vòng ({profiles.length})
                                </button>
                                {profiles.map((p) => (
                                    <div
                                        key={p.id}
                                        className={`group px-2.5 py-1 text-[11px] rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                                            selectedProfileId === p.id
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProfileId(p.id)}
                                            className="cursor-pointer truncate max-w-[130px]"
                                            title={p.email}
                                        >
                                            {p.email.split('@')[0]}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGoogleAccount(p.id)}
                                            className="text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5"
                                            title="Xóa tài khoản này"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] text-slate-500 italic">
                                * Tài khoản được lưu trên máy của bạn, phiên tự động duy trì an toàn 100%.
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Extension Setup Notice if not connected */}
            {!isElectron && isExtensionMode && !isExtensionInstalled && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 ring-1 ring-amber-500/30 flex flex-col gap-3 animate-fade-in shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🧩</span>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-amber-950">
                                    Cần cài đặt Tiện ích "vip-imagetools"
                                </span>
                                <span className="text-[11px] text-amber-800">
                                    Để tự động gửi lệnh tạo video Veo 3.1 từ tài khoản Google của bạn
                                </span>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 shrink-0">
                            Chưa kết nối
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href="/vip-imagetools.zip"
                            download="vip-imagetools.zip"
                            className="flex-1 min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                            <span>📥</span>
                            <span>Tải Bổ Trợ (.zip)</span>
                        </a>
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText('chrome://extensions/');
                                alert('Đã sao chép "chrome://extensions/". Hãy mở tab mới trên Chrome và dán vào thanh địa chỉ để cài đặt tiện ích!');
                            }}
                            className="min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl ring-1 ring-slate-900/10 shadow-xs transition-all cursor-pointer"
                        >
                            <span>📋</span>
                            <span>Copy link cài đặt</span>
                        </button>
                    </div>

                    <div className="text-[11.5px] text-slate-700 bg-white/90 p-2.5 rounded-xl space-y-1.5 ring-1 ring-amber-500/20">
                        <div className="font-bold text-amber-900 text-xs mb-1">Cách cài đặt nhanh trong 10 giây:</div>
                        <div className="flex items-start gap-1.5">
                            <span className="font-bold text-amber-600 shrink-0">1.</span>
                            <span>Bấm nút <b>Tải Bổ Trợ (.zip)</b> ở trên và giải nén thư mục trên máy tính.</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                            <span className="font-bold text-amber-600 shrink-0">2.</span>
                            <span>Mở Chrome dán <code className="bg-amber-100 text-amber-950 px-1 py-0.5 rounded font-mono select-all">chrome://extensions</code> và bật <b>"Chế độ cho nhà phát triển"</b> (Developer Mode) góc trên phải.</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                            <span className="font-bold text-amber-600 shrink-0">3.</span>
                            <span>Bấm nút <b>"Tải tiện ích đã giải nén"</b> (Load unpacked) và chọn thư mục vừa giải nén.</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                            <span className="font-bold text-amber-600 shrink-0">4.</span>
                            <span>Quay lại tab này và bấm <b>F5 (Tải lại trang)</b> để hoàn tất kết nối!</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. MODEL VIDEO AI SECTION (Screenshot 3) */}
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Model Video AI
                </span>
                <div className="flex flex-col gap-2">
                    {FLOW_MODEL_OPTIONS.map((m) => {
                        const isSelected = selectedFlowModel === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setSelectedFlowModel(m.id)}
                                className={`p-3 rounded-2xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm ring-2 ring-amber-400'
                                        : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold truncate">{m.name}</span>
                                        <span
                                            className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {m.badge}
                                        </span>
                                    </div>
                                    <span
                                        className={`text-[11px] line-clamp-1 mt-0.5 ${
                                            isSelected ? 'text-amber-100 font-medium' : 'text-slate-500'
                                        }`}
                                    >
                                        {m.desc}
                                    </span>
                                </div>
                                <span className="text-base shrink-0 font-bold">
                                    {isSelected ? '✓' : ''}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. ẢNH NGUỒN TẠO VIDEO (I2V) (Screenshot 3) */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-amber-500 text-sm">🖼️</span>
                        <span>Ảnh nguồn tạo video (I2V)</span>
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono font-bold ring-1 ring-amber-500/20">
                        {hasInputImage ? '1/5 Ảnh' : '0/5 Ảnh'}
                    </span>
                </div>

                {hasInputImage && inputImagePreview ? (
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-900/10 shadow-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-slate-900/10 shadow-2xs">
                                <img
                                    src={
                                        inputImagePreview.startsWith('data:')
                                            ? inputImagePreview
                                            : `data:image/png;base64,${inputImagePreview}`
                                    }
                                    alt="First Frame"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                    Khung hình gốc (First Frame)
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    AI sẽ biến ảnh này thành video sống động
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono text-[11px] font-bold">
                                {aspectRatio}
                            </span>
                            <button
                                type="button"
                                onClick={handleTriggerImageUpload}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                title="Chọn ảnh khác"
                            >
                                Đổi ảnh
                            </button>
                            <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer text-xs"
                                title="Xóa ảnh"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={handleTriggerImageUpload}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`rounded-2xl border-2 border-dashed p-4 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group ${
                            isDragging
                                ? 'border-amber-500 bg-amber-50/70 scale-[1.01]'
                                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/70 hover:border-amber-400'
                        }`}
                    >
                        <div className="bg-white p-3 rounded-xl ring-1 ring-slate-900/5 shadow-2xs flex flex-col items-center justify-center gap-1.5 w-full max-w-[200px]">
                            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                                Thêm ảnh nguồn
                            </span>
                            <div className="flex items-center justify-center gap-2 text-slate-400 text-lg group-hover:text-amber-500 transition-colors">
                                <span>🖼️</span>
                                <span>📄</span>
                                <span>📋</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 italic max-w-xs leading-relaxed">
                            Bấm để chọn ảnh từ máy, kéo thả ảnh vào đây, hoặc nhấn <b>Ctrl + V</b> để dán.
                        </p>
                    </div>
                )}
            </div>

            {/* 3. PRESET CHUYỂN ĐỘNG (Screenshot 4) */}
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-amber-500 text-sm">🔗</span>
                    <span>Preset chuyển động</span>
                </span>
                <div className="flex flex-col gap-2">
                    {MOTION_PRESETS.map((p) => {
                        const isSelected = selectedPreset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectPreset(p.id, p.samplePrompt)}
                                className={`p-3 rounded-2xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                                    isSelected
                                        ? 'bg-amber-50/40 text-slate-900 ring-2 ring-amber-500 shadow-xs'
                                        : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                                            isSelected
                                                ? 'bg-amber-500 text-white shadow-2xs'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {p.icon}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-slate-900 truncate">
                                            {p.title}
                                        </span>
                                        <span className="text-[11px] text-slate-500 truncate mt-0.5">
                                            {p.desc}
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center justify-center">
                                    {isSelected ? (
                                        <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center text-amber-500 font-black text-xs">
                                            ✓
                                        </div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border border-slate-300" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 4. TỈ LỆ KHUNG HÌNH (Screenshot 4 & 5) */}
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Tỉ lệ khung hình
                </span>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setAspectRatio('16:9')}
                        className={`min-h-[48px] p-2.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-center ${
                            aspectRatio === '16:9'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs font-bold'
                                : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                        }`}
                    >
                        <span className="text-xs font-mono font-bold">16:9</span>
                        <span
                            className={`text-[10.5px] ${
                                aspectRatio === '16:9' ? 'text-amber-100' : 'text-slate-500'
                            }`}
                        >
                            Ngang (Youtube/Phim)
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setAspectRatio('9:16')}
                        className={`min-h-[48px] p-2.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-center ${
                            aspectRatio === '9:16'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs font-bold'
                                : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                        }`}
                    >
                        <span className="text-xs font-mono font-bold">9:16</span>
                        <span
                            className={`text-[10.5px] ${
                                aspectRatio === '9:16' ? 'text-amber-100' : 'text-slate-500'
                            }`}
                        >
                            Dọc (Reels/TikTok)
                        </span>
                    </button>
                </div>
            </div>

            {/* 5. ĐỘ PHÂN GIẢI & 6. THỜI LƯỢNG (Screenshot 5) */}
            <div className="grid grid-cols-2 gap-2.5">
                {/* Độ phân giải */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Độ phân giải video
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleSelectResolution('360p')}
                            className={`min-h-[48px] p-2 rounded-2xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                resolution === '360p'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-xs'
                                    : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                            }`}
                        >
                            <span className="text-xs font-mono font-bold">360p</span>
                            <span
                                className={`text-[9.5px] ${
                                    resolution === '360p' ? 'text-amber-100' : 'text-slate-500'
                                }`}
                            >
                                Xem trước nhanh
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectResolution('720p')}
                            className={`min-h-[48px] p-2 rounded-2xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                resolution === '720p'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-xs'
                                    : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                            }`}
                        >
                            <span className="text-xs font-mono font-bold">720p</span>
                            <span
                                className={`text-[9.5px] ${
                                    resolution === '720p' ? 'text-amber-100' : 'text-slate-500'
                                }`}
                            >
                                Chuẩn sắc nét HD
                            </span>
                        </button>
                    </div>
                </div>

                {/* Thời lượng video */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Thời lượng video
                        </span>
                        <span className="text-xs font-bold text-amber-600 font-mono">
                            {duration.replace('s', ' Giây')}
                        </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {(['4s', '6s', '8s', '10s'] as const).map((dur) => (
                            <button
                                key={dur}
                                type="button"
                                onClick={() => handleSelectDuration(dur)}
                                className={`min-h-[48px] rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center ${
                                    duration === dur
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                                }`}
                            >
                                {dur}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 7. SỐ LƯỢNG BIẾN THỂ MỖI ẢNH (Screenshot 5) */}
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Số lượng biến thể mỗi ảnh
                </span>
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((cnt) => (
                        <button
                            key={cnt}
                            type="button"
                            onClick={() => setOutputCount(cnt)}
                            className={`min-h-[42px] rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center ${
                                outputCount === cnt
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white text-slate-800 ring-1 ring-slate-900/10 hover:bg-slate-50'
                            }`}
                        >
                            {cnt} video
                        </button>
                    ))}
                </div>
            </div>

            {/* 8. KỊCH BẢN & PROMPT BỔ SUNG (Screenshot 5) */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Kịch bản & Prompt bổ sung
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            const cur = MOTION_PRESETS.find((p) => p.id === selectedPreset);
                            if (cur) setPrompt(cur.samplePrompt);
                        }}
                        className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10.5px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    >
                        <span>🪄</span>
                        <span>AI Ý TƯỞNG</span>
                    </button>
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Nhập thêm chi tiết chuyển động (vd: Chủ thể quay sang nhìn máy ảnh, gió thổi tóc bay nhè nhẹ, nụ...)"
                    rows={3}
                    className="w-full bg-white ring-1 ring-slate-900/10 rounded-2xl p-3 text-slate-900 text-xs leading-relaxed focus:ring-2 focus:ring-amber-500/40 outline-none transition-all placeholder:text-slate-400"
                />
            </div>

            {/* 9. SUBMIT BUTTON (Screenshot 3 & Screenshot 2) */}
            <button
                type="button"
                onClick={handleExecuteGenerate}
                disabled={!canSubmit}
                className={`w-full min-h-[50px] mt-1 px-6 py-3.5 font-bold text-sm tracking-wide rounded-2xl shadow-md transition-all duration-200 transform active:scale-[0.98] cursor-pointer ${
                    !canSubmit
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25 hover:shadow-amber-500/35 focus:ring-2 focus:ring-amber-500/40'
                }`}
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span>Đang xử lý Video ({outputCount} video)...</span>
                    </span>
                ) : !hasInputImage ? (
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                        <span className="text-base">🖼️</span>
                        <span>HÃY TẢI ÍT NHẤT 1 ẢNH NGUỒN</span>
                    </span>
                ) : isExtensionMode && !isExtensionInstalled ? (
                    <span className="flex items-center justify-center gap-2 text-amber-100">
                        <span className="text-base">🧩</span>
                        <span>CẦN CÀI BỔ TRỢ ĐỂ TẠO VIDEO (BẤM ĐỂ XEM CÁCH CÀI)</span>
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <span>🎬</span>
                        <span>
                            TẠO CHUYỂN ĐỘNG VIDEO ({selectedFlowModel.replace(' - ', ' ')} • {duration})
                        </span>
                    </span>
                )}
            </button>

            {/* Modal: Thêm / Kết nối Tài khoản Google cho Veo 3.1 */}
            {showAddAccountModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div
                        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden flex flex-col animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-xl shadow-xs">
                                    🔑
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-sm font-bold tracking-tight text-white">
                                        Kết nối Tài khoản Google (Veo 3.1)
                                    </h3>
                                    <span className="text-[11px] text-slate-300">
                                        Đăng nhập 1 lần để tạo video không giới hạn trên Google Flow
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isLoggingInGoogle && !isSubmittingCookie) {
                                        setShowAddAccountModal(false);
                                    }
                                }}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm cursor-pointer transition-all"
                                title="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200">
                            <button
                                type="button"
                                onClick={() => setAddAccountTab('chrome')}
                                className={`py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    addAccountTab === 'chrome'
                                        ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>🌐</span>
                                <span>Mở Chrome (Khuyên dùng)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAddAccountTab('cookie')}
                                className={`py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    addAccountTab === 'cookie'
                                        ? 'bg-white text-amber-700 shadow-xs ring-1 ring-slate-900/5'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>📋</span>
                                <span>Dán Cookie (Nhanh 5s)</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 flex flex-col gap-4">
                            {addAccountTab === 'chrome' ? (
                                <div className="flex flex-col gap-3.5">
                                    <div className="p-3.5 rounded-2xl bg-indigo-50/80 ring-1 ring-indigo-500/20 flex items-start gap-3">
                                        <span className="text-2xl shrink-0 mt-0.5">💡</span>
                                        <div className="flex flex-col gap-1 text-[11.5px] text-slate-700 leading-relaxed">
                                            <span className="font-bold text-indigo-950 text-xs">
                                                Đăng nhập trực tiếp qua trình duyệt Chrome thật
                                            </span>
                                            <p>
                                                Trình duyệt Chrome trên máy tính của bạn sẽ tự động mở trang Google Flow. Bạn chỉ cần nhập mật khẩu Gmail bình thường (hỗ trợ 100% 2FA, Passkey, không bao giờ bị Google chặn bảo mật).
                                            </p>
                                            <p className="text-[10.5px] text-indigo-800 font-semibold mt-1">
                                                * Sau khi đăng nhập thành công vào Google Flow, Tool sẽ tự động nhận diện và lưu hồ sơ ngay lập tức!
                                            </p>
                                        </div>
                                    </div>

                                    {chromeAuthStatusText && (
                                        <div className="p-3 rounded-xl bg-amber-50 ring-1 ring-amber-500/30 flex items-center gap-2.5 text-xs text-amber-900 animate-pulse">
                                            <span className="text-base">⏳</span>
                                            <span className="font-medium">{chromeAuthStatusText}</span>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleStartChromeLogin}
                                            disabled={isLoggingInGoogle}
                                            className="w-full min-h-[46px] py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                                        >
                                            {isLoggingInGoogle ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    <span>Đang chờ bạn đăng nhập trên Chrome...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-base">🚀</span>
                                                    <span>Mở trình duyệt Chrome để đăng nhập</span>
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[10.5px] text-center text-slate-400 italic">
                                            Nếu Chrome không tự bật hoặc bạn dùng trình duyệt khác, hãy chuyển sang tab "Dán Cookie" ở trên.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800">
                                            Dán chuỗi Cookie hoặc JSON Cookie-Editor:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={openExternalFlowUrl}
                                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>🔗</span>
                                            <span>Mở flow.google.com</span>
                                        </button>
                                    </div>

                                    <textarea
                                        value={cookieInputText}
                                        onChange={(e) => setCookieInputText(e.target.value)}
                                        placeholder="Dán Cookie tại đây... (Ví dụ: __Secure-1PSID=...; SID=... hoặc định dạng JSON từ tiện ích Cookie-Editor)"
                                        rows={4}
                                        className="w-full bg-slate-50 ring-1 ring-slate-900/10 rounded-2xl p-3 text-slate-900 text-xs font-mono leading-relaxed focus:bg-white focus:ring-2 focus:ring-amber-500/40 outline-none transition-all placeholder:text-slate-400"
                                    />

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-700">
                                            Email tài khoản (Tùy chọn, để dễ phân biệt):
                                        </label>
                                        <input
                                            type="email"
                                            value={cookieEmailText}
                                            onChange={(e) => setCookieEmailText(e.target.value)}
                                            placeholder="vidu@gmail.com"
                                            className="w-full bg-slate-50 ring-1 ring-slate-900/10 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-amber-500/40 outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 ring-1 ring-slate-900/5 space-y-1 text-[11px] text-slate-600 leading-relaxed">
                                        <div className="font-bold text-slate-800 text-xs mb-1">Cách lấy Cookie trong 5 giây:</div>
                                        <div>1. Mở <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono">flow.google.com</code> trên Chrome đã đăng nhập.</div>
                                        <div>2. Cài tiện ích <b>Cookie-Editor</b> trên Chrome, mở lên và bấm <b>Export ➔ JSON</b> (hoặc Copy Header).</div>
                                        <div>3. Dán vào ô trên và bấm <b>Lưu và Kết nối</b>.</div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleImportCookies}
                                        disabled={isSubmittingCookie || !cookieInputText.trim()}
                                        className="w-full min-h-[44px] py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                                    >
                                        {isSubmittingCookie ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>Đang kiểm tra và lưu Cookie...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>💾</span>
                                                <span>Xác nhận & Lưu tài khoản</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setShowAddAccountModal(false)}
                                disabled={isLoggingInGoogle || isSubmittingCookie}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 cursor-pointer transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
