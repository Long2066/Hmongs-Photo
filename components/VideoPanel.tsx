import React, { useState, useEffect } from 'react';
import {
    subscribeToVideoConfig,
    getVideoConfig,
    OpenRouterVideoConfig,
    DEFAULT_VIDEO_CONFIG,
    OPENROUTER_VIDEO_MODELS,
    getVideoModelMeta,
    isVideoModelProviderEnabled
} from '../services/videoConfigService';
import type { SubscriptionPlan } from '../services/firebaseService';

// Vector SVG Icons
const SparklesIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

const LayersIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const PlayIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const LockClosedIcon = () => (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);

const CoinsIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M9 9h6a2 2 0 012 2v2a2 2 0 01-2 2H9" />
    </svg>
);

const RotateCcwIcon = () => (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

export interface VideoPanelProps {
    subMode: 'text_to_video' | 'image_to_video';
    onSubModeChange: (subMode: 'text_to_video' | 'image_to_video') => void;
    onGenerate: (
        prompt: string,
        aspectRatio: '16:9' | '9:16' | '1:1',
        subMode: 'text_to_video' | 'image_to_video',
        model: string,
        outputCount: number,
        duration: number
    ) => void;
    onImagesChange?: (images: { base64: string; mimeType: string; id: number; fileName?: string }[]) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputImagePreview?: string;
    remainingVideoSeconds?: number;
    userPlan?: SubscriptionPlan;
    isAdmin?: boolean;
    onRequestTopUp?: () => void;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
    subMode,
    onSubModeChange: _onSubModeChange,
    onGenerate,
    onImagesChange: _onImagesChange,
    isLoading,
    isDisabled,
    hasInputImage,
    inputImagePreview,
    remainingVideoSeconds = 0,
    userPlan = 'free',
    isAdmin = false,
    onRequestTopUp
}) => {
    const [videoConfig, setVideoConfig] = useState<OpenRouterVideoConfig>(DEFAULT_VIDEO_CONFIG);

    const [selectedModel, setSelectedModel] = useState<string>(OPENROUTER_VIDEO_MODELS[0].id);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [duration, setDuration] = useState<number>(5);
    const [outputCount, setOutputCount] = useState<number>(1);
    const [prompt, setPrompt] = useState<string>('');

    const activeModelMeta = getVideoModelMeta(selectedModel);
    const isCurrentModelEnabled = isVideoModelProviderEnabled(selectedModel, videoConfig);
    const enabledModels = OPENROUTER_VIDEO_MODELS.filter(m => isVideoModelProviderEnabled(m.id, videoConfig));
    const anyProviderEnabled = enabledModels.length > 0;

    // Subscribe to video configuration changes from Admin Panel
    useEffect(() => {
        const applyConfigDefaults = (cfg: OpenRouterVideoConfig, isInitial: boolean) => {
            setVideoConfig(cfg);
            if (isInitial && cfg.defaultAspectRatio) {
                setAspectRatio(cfg.defaultAspectRatio);
            }
            if (isInitial && cfg.primaryModel && isVideoModelProviderEnabled(cfg.primaryModel, cfg)) {
                setSelectedModel(cfg.primaryModel);
            }
        };

        getVideoConfig().then(cfg => {
            applyConfigDefaults(cfg, true);
        });

        const unsub = subscribeToVideoConfig(newCfg => {
            applyConfigDefaults(newCfg, false);
        });

        return () => unsub();
    }, []);

    // Nếu nguồn (idea.ai hoặc OpenRouter) của model đang chọn bị Admin tắt -> tự động chuyển sang model đang bật
    useEffect(() => {
        if (!isVideoModelProviderEnabled(selectedModel, videoConfig)) {
            if (videoConfig.primaryModel && isVideoModelProviderEnabled(videoConfig.primaryModel, videoConfig)) {
                setSelectedModel(videoConfig.primaryModel);
            } else {
                const firstEnabled = OPENROUTER_VIDEO_MODELS.find(m => isVideoModelProviderEnabled(m.id, videoConfig));
                if (firstEnabled) {
                    setSelectedModel(firstEnabled.id);
                }
            }
        }
    }, [videoConfig, selectedModel]);

    // Khi người dùng đổi Model: tự động kiểm tra và khóa/chuyển về Tỷ lệ & Thời lượng được hỗ trợ
    useEffect(() => {
        if (!activeModelMeta.supportedAspectRatios.includes(aspectRatio)) {
            setAspectRatio(activeModelMeta.supportedAspectRatios[0]);
        }
        if (!activeModelMeta.supportedDurations.includes(duration)) {
            setDuration(activeModelMeta.supportedDurations[0]);
        }
    }, [selectedModel, activeModelMeta, aspectRatio, duration]);

    // Auto-detect aspect ratio from uploaded preview image (chỉ chọn tỷ lệ nếu model hiện tại hỗ trợ)
    useEffect(() => {
        if (!inputImagePreview) return;
        const src = inputImagePreview.startsWith('data:')
            ? inputImagePreview
            : `data:image/png;base64,${inputImagePreview}`;
        const img = new Image();
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            let detected: '16:9' | '9:16' | '1:1' = '16:9';
            if (ratio > 1.25) {
                detected = '16:9';
            } else if (ratio < 0.8) {
                detected = '9:16';
            } else {
                detected = '1:1';
            }
            if (activeModelMeta.supportedAspectRatios.includes(detected)) {
                setAspectRatio(detected);
            }
        };
        img.src = src;
    }, [inputImagePreview, activeModelMeta]);

    // Calculate video seconds needed based on duration & outputCount
    const totalSecondsNeeded = duration * outputCount;
    const hasEnoughSeconds = isAdmin || remainingVideoSeconds >= totalSecondsNeeded;
    const planLabel = userPlan === 'pro' ? 'Gói Pro' : userPlan === 'plus' ? 'Gói Plus' : 'Gói Free';

    const handleSubmit = () => {
        if (isDisabled || isLoading || !anyProviderEnabled || !isCurrentModelEnabled) return;

        if (subMode === 'image_to_video' && !hasInputImage) {
            alert('Vui lòng tải lên 1 ảnh nguồn ở khung tải ảnh phía trên để tạo video.');
            return;
        }

        if (!hasEnoughSeconds) {
            if (onRequestTopUp) {
                onRequestTopUp();
            } else {
                alert(`Số giây video còn lại (${remainingVideoSeconds}s) không đủ để tạo video (${totalSecondsNeeded}s). Vui lòng nâng cấp gói Plus (60s) hoặc Pro (180s).`);
            }
            return;
        }

        const finalPrompt = prompt.trim() || 'Chuyển động tự nhiên mượt mà điện ảnh, giữ nét khuôn mặt chân thực';
        onGenerate(finalPrompt, aspectRatio, subMode, activeModelMeta.id, outputCount, duration);
    };

    return (
        <div className="flex flex-col gap-4 select-none animate-fade-in">
            {/* 1. COMPACT MODEL SELECTION (Vivix W1 / Grok video / Wan 3.0) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 transition-all">
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-indigo-600"><LayersIcon /></span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Mô Hình Video AI
                        </span>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-600">
                        {activeModelMeta.name}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {OPENROUTER_VIDEO_MODELS.map((model) => {
                        const isProviderEnabled = isVideoModelProviderEnabled(model.id, videoConfig);
                        const isSelected = selectedModel === model.id && isProviderEnabled;
                        return (
                            <button
                                key={model.id}
                                type="button"
                                disabled={!isProviderEnabled}
                                onClick={() => isProviderEnabled && setSelectedModel(model.id)}
                                title={
                                    isProviderEnabled
                                        ? model.name
                                        : `Mô hình ${model.name} hiện đang tạm tắt trên Admin`
                                }
                                className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                                    !isProviderEnabled
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed select-none'
                                        : isSelected
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs cursor-pointer'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                                }`}
                            >
                                {!isProviderEnabled && <LockClosedIcon />}
                                <span className="truncate">{model.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. MOTION PROMPT */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500"><SparklesIcon /></span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Mô tả chuyển động (Motion Prompt)
                        </span>
                    </div>
                    {prompt && (
                        <button
                            type="button"
                            onClick={() => setPrompt('')}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                        >
                            <RotateCcwIcon />
                            Xóa prompt
                        </button>
                    )}
                </div>

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Nhập mô tả hành động, góc lia máy hoặc chuyển động (ví dụ: Làn tóc khẽ bay trong gió, mỉm cười nhìn ống kính, camera lia chậm tạo chiều sâu cinematic...)"
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none bg-slate-50/50 leading-relaxed"
                />
            </div>

            {/* 3. ASPECT RATIO & DURATION (Khóa tự động các mục model không hỗ trợ) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3.5">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Tỷ lệ khung hình
                        </label>
                        <span className="text-[11px] font-mono font-bold text-indigo-600">
                            {aspectRatio}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: '16:9' as const, label: '16:9', sub: 'Ngang' },
                            { id: '9:16' as const, label: '9:16', sub: 'TikTok' },
                            { id: '1:1' as const, label: '1:1', sub: 'Vuông' }
                        ].map((ratio) => {
                            const isSupported = activeModelMeta.supportedAspectRatios.includes(ratio.id);
                            const isSelected = aspectRatio === ratio.id;
                            return (
                                <button
                                    key={ratio.id}
                                    type="button"
                                    disabled={!isSupported}
                                    onClick={() => isSupported && setAspectRatio(ratio.id)}
                                    title={isSupported ? `Tỷ lệ ${ratio.label} (${ratio.sub})` : `Mô hình ${activeModelMeta.shortName} không hỗ trợ tỷ lệ ${ratio.label}`}
                                    className={`min-h-[44px] py-1.5 px-2 rounded-xl text-center transition-all flex flex-col items-center justify-center border ${
                                        !isSupported
                                            ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs cursor-pointer'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                                    }`}
                                >
                                    <span className="text-xs font-mono font-bold flex items-center gap-1">
                                        {!isSupported && <LockClosedIcon />}
                                        {ratio.label}
                                    </span>
                                    <span className={`text-[9.5px] ${isSelected && isSupported ? 'text-indigo-100' : 'text-slate-500'}`}>
                                        {isSupported ? ratio.sub : 'Đã khóa'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Thời lượng video
                        </label>
                        <span className="text-xs font-bold text-amber-600 font-mono tabular-nums">
                            {duration} giây / video
                        </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {[
                            { sec: 3, sub: 'Ngắn' },
                            { sec: 5, sub: 'Nhanh' },
                            { sec: 10, sub: 'Chuẩn' },
                            { sec: 15, sub: 'Dài' }
                        ].map((dur) => {
                            const isSupported = activeModelMeta.supportedDurations.includes(dur.sec);
                            const isSelected = duration === dur.sec;
                            return (
                                <button
                                    key={dur.sec}
                                    type="button"
                                    disabled={!isSupported}
                                    onClick={() => isSupported && setDuration(dur.sec)}
                                    title={isSupported ? `Thời lượng ${dur.sec} giây` : `Mô hình ${activeModelMeta.shortName} chỉ hỗ trợ ${activeModelMeta.supportedDurations.map(d => `${d}s`).join(', ')}`}
                                    className={`min-h-[44px] py-1.5 px-1.5 rounded-xl text-center transition-all flex flex-col items-center justify-center border ${
                                        !isSupported
                                            ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs cursor-pointer'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                                    }`}
                                >
                                    <span className="text-xs font-mono font-bold flex items-center gap-0.5 tabular-nums">
                                        {!isSupported && <LockClosedIcon />}
                                        {dur.sec}s
                                    </span>
                                    <span className={`text-[9.5px] ${isSelected && isSupported ? 'text-amber-100' : 'text-slate-500'}`}>
                                        {isSupported ? dur.sub : 'Khóa'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Số lượng video render
                        </span>
                        <span className="text-xs font-bold text-indigo-600 font-mono tabular-nums">
                            {outputCount} video
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((cnt) => (
                            <button
                                key={cnt}
                                type="button"
                                onClick={() => setOutputCount(cnt)}
                                className={`min-h-[44px] rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center border ${
                                    outputCount === cnt
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {cnt} Video
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. VIDEO SECONDS QUOTA SUMMARY */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl p-4 border border-indigo-100 shadow-sm flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Mô hình đang chọn:</span>
                    <span className="font-bold text-slate-900">
                        {activeModelMeta.shortName} ({duration}s • {aspectRatio})
                    </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="text-amber-500"><CoinsIcon /></span>
                        <span>Thời lượng tiêu thụ:</span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-slate-900">
                        {totalSecondsNeeded} giây ({outputCount} video × {duration}s)
                    </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-indigo-100">
                    <span className="text-slate-700 font-semibold">Số giây video còn lại ({planLabel}):</span>
                    <span className={`font-mono text-sm font-bold tabular-nums ${hasEnoughSeconds ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isAdmin ? 'Không giới hạn' : `${remainingVideoSeconds} giây`}
                    </span>
                </div>

                {!anyProviderEnabled && (
                    <div className="p-2.5 rounded-xl bg-slate-200/80 border border-slate-300 text-slate-700 text-xs flex items-center gap-2 font-medium">
                        <LockClosedIcon />
                        <span>Tất cả nguồn tạo video hiện đang tạm tắt trên trang Admin.</span>
                    </div>
                )}

                {!hasEnoughSeconds && anyProviderEnabled && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
                        <span>
                            {remainingVideoSeconds <= 0
                                ? `Đã hết số giây tạo video (${planLabel}).`
                                : `Còn ${remainingVideoSeconds}s, cần ${totalSecondsNeeded}s để tạo video.`}
                        </span>
                        {onRequestTopUp && (
                            <button
                                type="button"
                                onClick={onRequestTopUp}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 cursor-pointer transition-colors shrink-0"
                            >
                                Nâng cấp gói
                            </button>
                        )}
                    </div>
                )}

                {!hasInputImage && anyProviderEnabled && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2">
                        <span>💡 Vui lòng tải ảnh nguồn ở khung trên để bắt đầu tạo video.</span>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || isDisabled || !anyProviderEnabled || !isCurrentModelEnabled || (!hasInputImage && subMode === 'image_to_video')}
                    className={`min-h-[48px] w-full rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                        hasEnoughSeconds && anyProviderEnabled && (hasInputImage || subMode !== 'image_to_video')
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Đang kết xuất qua {activeModelMeta.shortName}...</span>
                        </>
                    ) : !anyProviderEnabled ? (
                        <>
                            <LockClosedIcon />
                            <span>Tính năng tạo video đang tạm khóa</span>
                        </>
                    ) : !hasEnoughSeconds ? (
                        <>
                            <LockClosedIcon />
                            <span>
                                {remainingVideoSeconds <= 0
                                    ? 'Hết giây tạo video • Nâng cấp gói'
                                    : `Thiếu ${totalSecondsNeeded - remainingVideoSeconds}s video • Nâng cấp gói`}
                            </span>
                        </>
                    ) : !hasInputImage && subMode === 'image_to_video' ? (
                        <span>Chờ tải ảnh nguồn ở trên...</span>
                    ) : (
                        <>
                            <PlayIcon />
                            <span>Bắt đầu tạo video (-{totalSecondsNeeded} giây)</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
