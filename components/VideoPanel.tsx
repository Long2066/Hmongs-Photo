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
import { MAX_STORY_SCENES, summarizeVideoPromptLines } from '../services/scenePromptUtils';
import type { VideoFrameFitMode } from '../services/videoFidelityUtils';
import type { SubscriptionPlan } from '../services/firebaseService';
import {
    DEFAULT_SUBSCRIPTION_PLANS_CONFIG,
    SubscriptionPlansConfig,
    subscribeToSubscriptionPlansConfig
} from '../services/subscriptionPlanConfigService';
import {
    CONCURRENCY_OPTIONS,
    CONCURRENCY_EVENT,
    ConcurrencySetting,
    getConcurrencySetting,
    setConcurrencySetting
} from '../services/concurrencyService';

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

export interface VideoFidelityPanelOptions {
    frameFitMode: VideoFrameFitMode;
    autoQaEnabled: boolean;
    strictMotionLock: boolean;
}

export interface VideoPanelProps {
    subMode: 'text_to_video' | 'image_to_video';
    onSubModeChange: (subMode: 'text_to_video' | 'image_to_video') => void;
    onGenerate: (
        prompt: string,
        aspectRatio: '16:9' | '9:16' | '1:1',
        subMode: 'text_to_video' | 'image_to_video',
        model: string,
        outputCount: number,
        duration: number,
        title?: string,
        fidelityOptions?: VideoFidelityPanelOptions
    ) => void;
    onImagesChange?: (images: { base64: string; mimeType: string; id: number; fileName?: string }[]) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputImageCount?: number;
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
    inputImageCount = 0,
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
    const [videoTitle, setVideoTitle] = useState<string>('Tap_1');
    const [prompt, setPrompt] = useState<string>('');
    const [formError, setFormError] = useState<string>('');
    const [plansConfig, setPlansConfig] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS_CONFIG);
    const [videoConcurrency, setVideoConcurrency] = useState<ConcurrencySetting>(() => getConcurrencySetting('video'));
    const [frameFitMode, setFrameFitMode] = useState<VideoFrameFitMode>('safe_contain');
    const [autoQaEnabled, setAutoQaEnabled] = useState<boolean>(true);
    const [strictMotionLock, setStrictMotionLock] = useState<boolean>(true);

    useEffect(() => subscribeToSubscriptionPlansConfig(setPlansConfig), []);

    useEffect(() => {
        const handleConcurrencySync = (ev: Event) => {
            const custom = ev as CustomEvent<{ kind?: string; setting?: ConcurrencySetting }>;
            if (custom.detail?.kind === 'video' && custom.detail.setting !== undefined) {
                setVideoConcurrency(custom.detail.setting);
            }
        };
        window.addEventListener(CONCURRENCY_EVENT, handleConcurrencySync);
        return () => window.removeEventListener(CONCURRENCY_EVENT, handleConcurrencySync);
    }, []);

    const handleSelectVideoConcurrency = (val: ConcurrencySetting) => {
        setVideoConcurrency(val);
        setConcurrencySetting('video', val);
    };

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

    // Tự động tính số phân cảnh dựa trên số ảnh đầu vào (1 đến 40 ảnh)
    const effectiveScenes = subMode === 'image_to_video'
        ? Math.max(1, Math.min(MAX_STORY_SCENES, inputImageCount || (hasInputImage ? 1 : 1)))
        : 1;

    const promptSummary = summarizeVideoPromptLines(prompt, effectiveScenes);
    const wanModelEnabled = isVideoModelProviderEnabled('alibaba/wan-3.0', videoConfig);

    // Calculate video seconds needed based on duration & effectiveScenes
    const totalSecondsNeeded = duration * effectiveScenes;
    const hasEnoughSeconds = isAdmin || remainingVideoSeconds >= totalSecondsNeeded;
    const planLabel = plansConfig[userPlan]?.name || (userPlan === 'pro' ? 'Gói Pro' : userPlan === 'plus' ? 'Gói Plus' : 'Gói Free');

    const handleSubmit = () => {
        if (isDisabled || isLoading || !anyProviderEnabled || !isCurrentModelEnabled) return;
        setFormError('');

        if (subMode === 'image_to_video' && !hasInputImage) {
            setFormError(`Vui lòng tải lên từ 1 đến ${MAX_STORY_SCENES} ảnh nguồn ở khung tải ảnh phía trên để tạo video.`);
            return;
        }

        if (!hasEnoughSeconds) {
            if (onRequestTopUp) {
                onRequestTopUp();
            } else {
                setFormError(`Số giây video còn lại (${remainingVideoSeconds}s) không đủ (${totalSecondsNeeded}s cho ${effectiveScenes} cảnh). Vui lòng nâng cấp ${plansConfig.plus.name} (${plansConfig.plus.videoSeconds}s) hoặc ${plansConfig.pro.name} (${plansConfig.pro.videoSeconds}s).`);
            }
            return;
        }

        const rawUserPrompt = prompt.trim() || 'Chuyển động tự nhiên mượt mà điện ảnh, sắc nét chân thực';
        onGenerate(rawUserPrompt, aspectRatio, subMode, activeModelMeta.id, 1, duration, videoTitle.trim() || 'Video_Series', {
            frameFitMode,
            autoQaEnabled,
            strictMotionLock
        });
    };

    return (
        <div className="flex flex-col gap-4 select-none animate-fade-in">
            {/* 1. COMPACT MODEL SELECTION (Vivix W1 / Grok video / Wan 3.0) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 transition-all">
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-indigo-600"><LayersIcon /></span>
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Mô Hình Video AI
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {activeModelMeta.supportsAudio && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md ring-1 ring-emerald-200">
                                🔊 Có Audio
                            </span>
                        )}
                        <span className="text-[11px] font-bold text-indigo-600">
                            {activeModelMeta.name}
                        </span>
                    </div>
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
                                        ? `${model.name}${model.supportsAudio ? ' (Hỗ trợ giọng nói & âm thanh)' : ''}`
                                        : `Mô hình ${model.name} hiện đang tạm tắt trên Admin`
                                }
                                className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] ${
                                    !isProviderEnabled
                                        ? 'bg-slate-100 ring-1 ring-slate-200 text-slate-400 opacity-60 cursor-not-allowed select-none'
                                        : isSelected
                                        ? 'bg-indigo-600 text-white ring-1 ring-indigo-600 shadow-xs'
                                        : 'bg-slate-50 ring-1 ring-slate-200/80 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {!isProviderEnabled && <LockClosedIcon />}
                                <span className="truncate">{model.name}</span>
                                {model.supportsAudio && isProviderEnabled && (
                                    <span className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-emerald-600'}`} aria-hidden="true">
                                        🔊
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. TIÊU ĐỀ VIDEO & OUTPUT TITLE (Khớp 100% khi xuất file) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-indigo-600">🎬</span>
                        <span>Tiêu đề Video / Tên tập phim</span>
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md ring-1 ring-emerald-200">
                        Khớp output 100%
                    </span>
                </div>
                <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Nhập tiêu đề video / tên phim (ví dụ: Phim_Tap_1, Ky_Yeu_Thanh_Xuan...)"
                    className="w-full px-3 py-2.5 rounded-xl ring-1 ring-slate-200 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/60"
                />
                <p className="text-[11px] text-slate-500 leading-tight">
                    File video hoàn chỉnh xuất ra sẽ được đặt tên chính xác là <strong className="text-slate-800 font-mono">{(videoTitle.trim() || 'Video_Series').replace(/[/\\?%*:|"<>]/g, '_')}.mp4</strong>.
                </p>
            </div>

            {/* 3. MOTION PROMPT (1 DÒNG = 1 CẢNH + HỖ TRỢ "no voice") */}
            <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500"><SparklesIcon /></span>
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Kịch bản chuyển động &amp; Lời thoại
                        </span>
                    </div>
                    {prompt && (
                        <button
                            type="button"
                            onClick={() => setPrompt('')}
                            className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <RotateCcwIcon />
                            Xóa prompt
                        </button>
                    )}
                </div>

                {/* Live Line-to-Scene & Voice Alignment Badges */}
                {(effectiveScenes > 1 || promptSummary.lineCount > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {promptSummary.effectiveMode === 'matched' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10.5px] font-semibold font-mono tabular-nums">
                                ✓ Khớp {promptSummary.lineCount}/{effectiveScenes} cảnh
                            </span>
                        )}
                        {promptSummary.effectiveMode === 'shared' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-[10.5px] font-semibold tabular-nums">
                                1 mô tả chung cho {effectiveScenes} cảnh
                            </span>
                        )}
                        {promptSummary.effectiveMode === 'partial' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-[10.5px] font-semibold tabular-nums">
                                Khớp {promptSummary.lineCount}/{effectiveScenes} cảnh (cảnh sau chuyển động tự nhiên)
                            </span>
                        )}
                        {promptSummary.effectiveMode === 'overflow' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-[10.5px] font-semibold tabular-nums">
                                Dư {promptSummary.lineCount - effectiveScenes} dòng (chỉ dùng {effectiveScenes} dòng đầu)
                            </span>
                        )}
                        {promptSummary.noVoiceCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200 text-[10.5px] font-semibold font-mono tabular-nums">
                                🔇 {promptSummary.noVoiceCount} cảnh no voice
                            </span>
                        )}
                    </div>
                )}

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={"Mỗi dòng = 1 cảnh theo đúng thứ tự ảnh (#1, #2, #3...):\nThức dậy vươn vai bên nhà gỗ, nói \"Chào buổi sáng\"\nRa sân cho gà ăn giữa tiếng gà kêu, no voice\nĐi bộ lên nương rẫy giữa sương sớm, no voice"}
                    rows={5}
                    className="w-full p-3 rounded-xl ring-1 ring-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-y min-h-[110px] max-h-[320px] bg-slate-50/60 leading-relaxed"
                />

                <p className="text-[11px] text-slate-600 leading-relaxed">
                    Mỗi dòng tương ứng <strong className="font-mono text-slate-800">1 cảnh</strong> (<span className="font-mono">Dòng 1 → Ảnh #1</span>). Cảnh nào không muốn nhân vật nói chuyện, hãy thêm từ khóa <code className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono font-bold">no voice</code> (vẫn giữ nguyên âm thanh môi trường tự nhiên).
                </p>

                {!activeModelMeta.supportsAudio && wanModelEnabled && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/90 ring-1 ring-amber-200 px-2.5 py-2 text-[11px] text-amber-900">
                        <span className="leading-snug">
                            💡 Muốn video có lời thoại &amp; âm thanh môi trường thật, hãy dùng <strong>Wan 3.0</strong>.
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedModel('alibaba/wan-3.0')}
                            className="shrink-0 min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] cursor-pointer transition-colors active:scale-[0.98]"
                        >
                            Chọn Wan 3.0
                        </button>
                    </div>
                )}
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
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Luồng render song song
                        </label>
                        <span className="text-[11px] font-bold text-indigo-700 font-mono tabular-nums">
                            {videoConcurrency === 'auto' ? 'Tự động (8–10 cảnh)' : `${videoConcurrency} luồng`}
                        </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 bg-slate-100 p-1 rounded-xl ring-1 ring-slate-900/5">
                        {CONCURRENCY_OPTIONS.map((opt) => {
                            const isActive = videoConcurrency === opt;
                            return (
                                <button
                                    key={String(opt)}
                                    type="button"
                                    onClick={() => handleSelectVideoConcurrency(opt)}
                                    className={`min-h-[44px] sm:min-h-[38px] rounded-lg text-[11px] font-mono font-bold tabular-nums transition-all cursor-pointer active:scale-[0.97] ${
                                        isActive
                                            ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/10'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                    }`}
                                >
                                    {opt === 'auto' ? 'Auto' : `x${opt}`}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 3B. IDENTITY & FRAME LOCK CONTROLS */}
            <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 space-y-3">
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Khớp ảnh gốc vào khung hình
                        </label>
                        <span className="text-[10.5px] font-semibold text-indigo-700">
                            {frameFitMode === 'safe_contain' ? 'Không cắt đầu' : 'Lấp đầy'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl ring-1 ring-slate-900/5">
                        <button
                            type="button"
                            onClick={() => setFrameFitMode('safe_contain')}
                            className={`min-h-[44px] sm:min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                frameFitMode === 'safe_contain'
                                    ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/10'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Giữ trọn Đầu &amp; Áo
                        </button>
                        <button
                            type="button"
                            onClick={() => setFrameFitMode('smart_face_crop')}
                            className={`min-h-[44px] sm:min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                frameFitMode === 'smart_face_crop'
                                    ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/10'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Lấp đầy (Face Crop)
                        </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                        {frameFitMode === 'safe_contain'
                            ? 'Tự đệm nền mờ nghệ thuật khi khác tỷ lệ để không cắt đầu hoặc mất trang phục.'
                            : 'Tự nhận diện khuôn mặt và căn lề an toàn để lấp đầy khung video.'}
                    </p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={autoQaEnabled}
                        onClick={() => setAutoQaEnabled(v => !v)}
                        className={`w-full min-h-[44px] flex items-center justify-between gap-3 rounded-xl p-2.5 text-left transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            autoQaEnabled
                                ? 'bg-emerald-50/80 ring-1 ring-emerald-500/25'
                                : 'bg-slate-50 ring-1 ring-slate-900/5 hover:bg-slate-100'
                        }`}
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${autoQaEnabled ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                                <span className="text-xs font-bold text-slate-900">
                                    Khóa 100% Nhân Vật &amp; Hậu Kiểm (Auto-QA)
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-600 leading-snug">
                                Kiểm tra 3 frame (đầu/giữa/cuối) ≥ 85%, cảnh lệch tự render lại.
                            </p>
                        </div>
                        <span
                            aria-hidden="true"
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                autoQaEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                                    autoQaEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </span>
                    </button>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={strictMotionLock}
                        onClick={() => setStrictMotionLock(v => !v)}
                        className="w-full min-h-[44px] flex items-center justify-between gap-3 rounded-xl p-2.5 text-left bg-slate-50/90 ring-1 ring-slate-900/5 hover:bg-slate-100/80 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block">
                                Ổn định chuyển động chống méo mặt
                            </span>
                            <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                                Giữ chuyển động máy quay dịu, cấm đổi trang phục &amp; xoay gắt góc mặt.
                            </p>
                        </div>
                        <span
                            aria-hidden="true"
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                strictMotionLock ? 'bg-indigo-600' : 'bg-slate-300'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                                    strictMotionLock ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </span>
                    </button>
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
                        {totalSecondsNeeded} giây ({effectiveScenes} cảnh × {duration}s)
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

                {formError && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-50 ring-1 ring-rose-900/10 text-rose-700 text-xs font-semibold leading-relaxed">
                        {formError}
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
                            <span>{effectiveScenes > 1 ? `Bắt đầu tạo & ghép ${effectiveScenes} cảnh (-${totalSecondsNeeded}s)` : `Bắt đầu tạo video (-${totalSecondsNeeded}s)`}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
