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

    const isExtensionMode = engine === 'flow_extension';
    const isFalMode = engine === 'fal_ai';

    const canSubmit = !isLoading && !isDisabled && hasInputImage;

    const handleExecuteGenerate = () => {
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
                            isExtensionMode && isExtensionInstalled
                                ? 'bg-emerald-400'
                                : isExtensionMode
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-indigo-400'
                        }`}
                    />
                    <span className="text-[10.5px] text-slate-300 font-mono font-medium">
                        {isExtensionMode && isExtensionInstalled
                            ? 'Extension OK'
                            : isExtensionMode
                            ? 'Cần Extension'
                            : 'Cloud'}
                    </span>
                </div>
            </div>

            {/* Engine Segmented Bar */}
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

            {/* Extension Setup Notice if not connected */}
            {isExtensionMode && !isExtensionInstalled && (
                <div className="p-3 rounded-xl bg-amber-50 ring-1 ring-amber-500/30 flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <span>🧩</span>
                            <span>Cài đặt Tiện ích Chrome để tự động gửi & nhận video</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowExtensionGuide(!showExtensionGuide)}
                            className="text-[10.5px] text-amber-800 underline font-semibold cursor-pointer"
                        >
                            {showExtensionGuide ? 'Ẩn' : 'Xem cách cài 10s'}
                        </button>
                    </div>

                    {showExtensionGuide && (
                        <div className="text-[11px] text-amber-900 bg-white/80 p-2.5 rounded-lg space-y-1 ring-1 ring-amber-500/20">
                            <div>1. Mở Chrome gõ: <code className="bg-amber-100 px-1 rounded font-mono select-all">chrome://extensions</code></div>
                            <div>2. Bật <b>"Chế độ dành cho nhà phát triển" (Developer mode)</b> góc trên phải.</div>
                            <div>3. Bấm <b>"Tải tiện ích đã giải nén" (Load unpacked)</b>.</div>
                            <div>4. Chọn thư mục: <code className="bg-amber-100 px-1 rounded font-mono select-all">D:\ToolMedia\extension-flow-bridge</code></div>
                        </div>
                    )}
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
                        <span>Đang khởi tạo (1/{outputCount})...</span>
                    </span>
                ) : !hasInputImage ? (
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                        <span className="text-base">🖼️</span>
                        <span>HÃY TẢI ÍT NHẤT 1 ẢNH NGUỒN</span>
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
        </div>
    );
};
