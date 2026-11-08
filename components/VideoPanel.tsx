import React, { useState, useEffect } from 'react';
import { subscribeToVideoConfig, getVideoConfig, OpenRouterVideoConfig, DEFAULT_VIDEO_CONFIG } from '../services/videoConfigService';

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

const ShieldCheckIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
    userBalance?: number;
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
    userBalance = 0,
    onRequestTopUp
}) => {
    const [videoConfig, setVideoConfig] = useState<OpenRouterVideoConfig>(DEFAULT_VIDEO_CONFIG);

    const [selectedModel, setSelectedModel] = useState<string>('auto');
    const [isModelCollapsed, setIsModelCollapsed] = useState<boolean>(false);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [duration, setDuration] = useState<number>(5);
    const [outputCount, setOutputCount] = useState<number>(1);
    const [prompt, setPrompt] = useState<string>('');

    // Subscribe to video configuration changes
    useEffect(() => {
        getVideoConfig().then(cfg => {
            setVideoConfig(cfg);
            if (cfg.defaultDuration) setDuration(cfg.defaultDuration);
            if (cfg.defaultAspectRatio) setAspectRatio(cfg.defaultAspectRatio);
        });

        const unsub = subscribeToVideoConfig(newCfg => {
            setVideoConfig(newCfg);
        });

        return () => unsub();
    }, []);

    // Auto-detect aspect ratio from uploaded preview image
    useEffect(() => {
        if (!inputImagePreview) return;
        const src = inputImagePreview.startsWith('data:')
            ? inputImagePreview
            : `data:image/png;base64,${inputImagePreview}`;
        const img = new Image();
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio > 1.25) {
                setAspectRatio('16:9');
            } else if (ratio < 0.8) {
                setAspectRatio('9:16');
            } else {
                setAspectRatio('1:1');
            }
        };
        img.src = src;
    }, [inputImagePreview]);

    // Calculate total cost
    const pricePerVideo = videoConfig.pricePerVideoVnd || 700;
    const totalCost = pricePerVideo * outputCount;
    const hasEnoughBalance = userBalance >= totalCost;

    const handleSubmit = () => {
        if (isDisabled || isLoading) return;

        if (subMode === 'image_to_video' && !hasInputImage) {
            alert('Vui lòng tải lên 1 ảnh nguồn ở khung tải ảnh phía trên để tạo video.');
            return;
        }

        if (!hasEnoughBalance) {
            if (onRequestTopUp) {
                onRequestTopUp();
            } else {
                alert(`Số dư hiện tại (${userBalance.toLocaleString('vi-VN')}đ) không đủ để tạo video (${totalCost.toLocaleString('vi-VN')}đ). Vui lòng nạp thêm vào tài khoản.`);
            }
            return;
        }

        const finalPrompt = prompt.trim() || 'Chuyển động tự nhiên mượt mà điện ảnh 4K';
        const modelToUse = selectedModel === 'auto' ? videoConfig.primaryModel : selectedModel;

        onGenerate(finalPrompt, aspectRatio, subMode, modelToUse, outputCount, duration);
    };

    return (
        <div className="flex flex-col gap-4 select-none animate-fade-in">
            {/* 1. MODEL SELECTION (Collapsible / Thu gọn được) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 transition-all">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setIsModelCollapsed(!isModelCollapsed)}
                        className="flex items-center gap-2 group cursor-pointer focus-visible:outline-none"
                    >
                        <span className="text-indigo-600"><LayersIcon /></span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                            Mô hình Video AI
                        </span>
                        <svg
                            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform duration-200 ${
                                isModelCollapsed ? '-rotate-90' : 'rotate-0'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                            <ShieldCheckIcon />
                            Auto-Failover
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsModelCollapsed(!isModelCollapsed)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                            {isModelCollapsed ? 'Mở rộng ▾' : 'Thu gọn ▴'}
                        </button>
                    </div>
                </div>

                {/* Collapsed Compact State */}
                {isModelCollapsed ? (
                    <div
                        onClick={() => setIsModelCollapsed(false)}
                        className="mt-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 flex items-center justify-between cursor-pointer transition-all group"
                        title="Nhấp để mở rộng và đổi mô hình"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span className="text-xs font-bold text-slate-800">
                                {selectedModel === 'auto'
                                    ? 'Tự động tối ưu (Omni 1.2 → 1.1)'
                                    : 'Gemini Omni 1.2 Flash (Chính)'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                selectedModel === 'auto' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                                {selectedModel === 'auto' ? 'Khuyên dùng' : '15s + Audio'}
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 group-hover:text-indigo-600 flex items-center gap-0.5">
                            Đổi mô hình ▾
                        </span>
                    </div>
                ) : (
                    /* Expanded 2 Models */
                    <div className="space-y-2 mt-3 animate-fade-in">
                        {/* Auto Mode */}
                        <button
                            type="button"
                            onClick={() => setSelectedModel('auto')}
                            className={`w-full min-h-[44px] p-3 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                selectedModel === 'auto'
                                    ? 'bg-indigo-50/80 border-2 border-indigo-600 text-indigo-950 shadow-xs'
                                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold">Tự động tối ưu (Khuyến dùng)</span>
                                    <span className="text-[9.5px] px-1.5 py-0.5 rounded font-bold bg-indigo-100 text-indigo-700">
                                        Omni 1.2 &rarr; 1.1
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-500 mt-0.5">
                                    Ưu tiên Gemini Omni 1.2 Flash, tự động đổi sang 1.1 Flash nếu bận
                                </span>
                            </div>
                            <span className="text-indigo-600 font-bold text-sm shrink-0">
                                {selectedModel === 'auto' ? '✓' : ''}
                            </span>
                        </button>

                        {/* Direct Omni 1.2 Flash */}
                        <button
                            type="button"
                            onClick={() => setSelectedModel('google/gemini-omni-1.2-flash')}
                            className={`w-full min-h-[44px] p-3 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                selectedModel === 'google/gemini-omni-1.2-flash'
                                    ? 'bg-amber-50/80 border-2 border-amber-600 text-amber-950 shadow-xs'
                                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold">Gemini Omni 1.2 Flash (Chính)</span>
                                    <span className="text-[9.5px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                        Max 15s + Audio
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-500 mt-0.5">
                                    Bản nâng cấp mới nhất, render video sắc nét kèm âm thanh sống động
                                </span>
                            </div>
                            <span className="text-amber-600 font-bold text-sm shrink-0">
                                {selectedModel === 'google/gemini-omni-1.2-flash' ? '✓' : ''}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* 2. MOTION PROMPT (No presets as requested) */}
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
                    rows={4}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none bg-slate-50/50 leading-relaxed"
                />
            </div>

            {/* 3. ASPECT RATIO & DURATION */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                            Tỷ lệ khung hình
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { id: '16:9', label: '16:9', sub: 'Ngang' },
                                { id: '9:16', label: '9:16', sub: 'TikTok' },
                                { id: '1:1', label: '1:1', sub: 'Vuông' }
                            ].map((ratio) => (
                                <button
                                    key={ratio.id}
                                    type="button"
                                    onClick={() => setAspectRatio(ratio.id as any)}
                                    className={`min-h-[44px] py-1.5 px-2 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center border ${
                                        aspectRatio === ratio.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="text-xs font-mono font-bold">{ratio.label}</span>
                                    <span className={`text-[9.5px] ${aspectRatio === ratio.id ? 'text-indigo-100' : 'text-slate-500'}`}>
                                        {ratio.sub}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                Thời lượng
                            </label>
                            <span className="text-xs font-bold text-amber-600 font-mono">
                                {duration}s
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { sec: 5, label: '5 Giây' },
                                { sec: 10, label: '10 Giây' },
                                { sec: 15, label: '15 Giây' }
                            ].map((dur) => (
                                <button
                                    key={dur.sec}
                                    type="button"
                                    onClick={() => setDuration(dur.sec)}
                                    className={`min-h-[44px] py-1.5 px-2 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center border ${
                                        duration === dur.sec
                                            ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="text-xs font-mono font-bold">{dur.sec}s</span>
                                    <span className={`text-[9.5px] ${duration === dur.sec ? 'text-amber-100' : 'text-slate-500'}`}>
                                        {dur.sec === 15 ? 'Max' : dur.sec === 5 ? 'Nhanh' : 'Chuẩn'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Số lượng video render
                        </span>
                        <span className="text-xs font-bold text-indigo-600 font-mono">
                            {outputCount} video
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((cnt) => (
                            <button
                                key={cnt}
                                type="button"
                                onClick={() => setOutputCount(cnt)}
                                className={`min-h-[40px] rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center border ${
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

            {/* 4. PRICING & BALANCE SUMMARY */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl p-4 border border-indigo-100 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="text-amber-500"><CoinsIcon /></span>
                        <span>Đơn giá niêm yết:</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                        {pricePerVideo.toLocaleString('vi-VN')}đ / video
                    </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Số dư khả dụng của bạn:</span>
                    <span className={`font-mono font-bold tabular-nums ${hasEnoughBalance ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {userBalance.toLocaleString('vi-VN')}đ
                    </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-indigo-100 text-xs font-bold">
                    <span className="text-slate-900">Tổng thanh toán:</span>
                    <span className="font-mono text-sm text-indigo-700">
                        {totalCost.toLocaleString('vi-VN')}đ ({outputCount} video)
                    </span>
                </div>

                {!hasEnoughBalance && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
                        <span>Số dư không đủ để tạo video.</span>
                        {onRequestTopUp && (
                            <button
                                type="button"
                                onClick={onRequestTopUp}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 cursor-pointer transition-colors"
                            >
                                Nạp tiền ngay
                            </button>
                        )}
                    </div>
                )}

                {!hasInputImage && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center gap-2">
                        <span>💡 Vui lòng tải ảnh nguồn ở khung trên để bắt đầu tạo video.</span>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || isDisabled || (!hasInputImage && subMode === 'image_to_video')}
                    className={`min-h-[48px] w-full rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                        hasEnoughBalance && (hasInputImage || subMode !== 'image_to_video')
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Đang dựng video qua Omni 1.2...</span>
                        </>
                    ) : !hasEnoughBalance ? (
                        <>
                            <CoinsIcon />
                            <span>Nạp thêm { (totalCost - userBalance).toLocaleString('vi-VN') }đ để tạo video</span>
                        </>
                    ) : !hasInputImage && subMode === 'image_to_video' ? (
                        <span>Chờ tải ảnh nguồn ở trên...</span>
                    ) : (
                        <>
                            <PlayIcon />
                            <span>Bắt đầu tạo video ({totalCost.toLocaleString('vi-VN')}đ)</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
