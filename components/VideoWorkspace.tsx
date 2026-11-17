import React, { useState, useEffect } from 'react';
import { downloadImage, isNativePlatform, isElectronPlatform } from '../services/downloadService';
import type { ConsistencyQaReport } from '../services/consistencyQaService';

// Vector SVG Icons
const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const RefreshIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const LayersMergeIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
);

const PlayIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const FilmIcon = () => (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
);

const ClockIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const VideoIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const VIDEO_STAGE_PETALS = [
    { left: '14%', delay: '-1s', duration: '13s', size: 13 },
    { left: '29%', delay: '-6s', duration: '15s', size: 11 },
    { left: '46%', delay: '-3s', duration: '12s', size: 14 },
    { left: '64%', delay: '-9s', duration: '14s', size: 12 },
    { left: '79%', delay: '-4s', duration: '13s', size: 15 },
    { left: '89%', delay: '-11s', duration: '16s', size: 11 },
];

export interface VideoEntry {
    url: string;
    firstFrame?: string;
    createdAt: number;
    prompt?: string;
    modelUsed?: string;
    duration?: number;
    aspectRatio?: string;
    title?: string;
}

export interface VideoSceneItem {
    index: number;
    url: string;
    firstFrame?: string;
    prompt: string;
    modelUsed?: string;
    duration: number;
    aspectRatio: '16:9' | '9:16' | '1:1';
    qaReport?: ConsistencyQaReport | null;
    included: boolean;
    isRegenerating?: boolean;
}

interface VideoWorkspaceProps {
    videos: VideoEntry[];
    isLoading: boolean;
    loadingStatus: string;
    error: string | null;
    onDismissError?: () => void;
    sceneItems?: VideoSceneItem[];
    hasUnmergedChanges?: boolean;
    isMergingScenes?: boolean;
    onRegenerateScene?: (sceneIndex: number, editedPrompt: string) => void;
    onToggleSceneIncluded?: (sceneIndex: number) => void;
    onUpdateScenePrompt?: (sceneIndex: number, nextPrompt: string) => void;
    onRemergeScenes?: () => void;
}

const toPreviewImageSrc = (raw?: string): string | null => {
    if (!raw) return null;
    return raw.startsWith('data:') || /^https?:\/\//i.test(raw)
        ? raw
        : `data:image/png;base64,${raw}`;
};

const getSceneQaBadge = (qaReport?: ConsistencyQaReport | null) => {
    if (!qaReport) return null;
    const score = `${qaReport.overallScore}%`;
    const tooltip = `Khuôn mặt: ${qaReport.faceScore}% | Trang phục: ${qaReport.outfitScore}% | Giải phẫu/Khớp chuyển động: ${qaReport.anatomyScore}%`;
    if (qaReport.status === 'passed') {
        return {
            text: `✓ Khớp ${score}`,
            tooltip,
            className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
        };
    }
    if (qaReport.status === 'repaired') {
        return {
            text: `✨ Đã tự sửa ${score}`,
            tooltip,
            className: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20'
        };
    }
    if (qaReport.status === 'warning') {
        return {
            text: `⚠ Lệch (${score})`,
            tooltip,
            className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/25'
        };
    }
    return {
        text: 'Chờ hậu kiểm',
        tooltip: qaReport.reasonSummary || 'Chưa kết nối Vision QA',
        className: 'bg-white text-slate-500 ring-1 ring-slate-200'
    };
};

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({
    videos,
    isLoading,
    loadingStatus,
    error,
    onDismissError,
    sceneItems = [],
    hasUnmergedChanges = false,
    isMergingScenes = false,
    onRegenerateScene,
    onToggleSceneIncluded,
    onUpdateScenePrompt,
    onRemergeScenes
}) => {
    const [selectedUrl, setSelectedUrl] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<{ text: string; success: boolean } | null>(null);
    const [renderTime, setRenderTime] = useState(0);
    const [codecNotice, setCodecNotice] = useState<string | null>(null);

    // Live render stopwatch
    useEffect(() => {
        let timer: any = null;
        if (isLoading) {
            setRenderTime(0);
            timer = setInterval(() => {
                setRenderTime(prev => prev + 1);
            }, 1000);
        } else {
            setRenderTime(0);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isLoading]);

    const active = videos.find(item => item.url === selectedUrl) || videos[0];

    const frameSrc = toPreviewImageSrc(active?.firstFrame);
    const includedScenesCount = sceneItems.filter(item => item.included && Boolean(item.url)).length;
    const anySceneRegenerating = sceneItems.some(item => item.isRegenerating);
    const totalSelectedDuration = sceneItems
        .filter(item => item.included && Boolean(item.url))
        .reduce((sum, item) => sum + (item.duration || 0), 0);

    const handleDownload = async () => {
        if (!active || downloading) return;
        setDownloading(true);
        setDownloadStatus(null);

        try {
            const rawTitle = (active.title && active.title.trim())
                ? active.title.trim()
                : `ImageTool_Video_${active.createdAt}`;
            const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_');
            const filename = cleanTitle.toLowerCase().endsWith('.mp4') ? cleanTitle : `${cleanTitle}.mp4`;
            
            const result = await downloadImage(active.url, filename);
            setDownloadStatus({
                text: result.message || (result.success ? 'Đã lưu video thành công.' : 'Không thể lưu video.'),
                success: result.success
            });
        } catch (err: any) {
            setDownloadStatus({
                text: err?.message || 'Không thể tải video.',
                success: false
            });
        } finally {
            setDownloading(false);
        }
    };

    const formatSeconds = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!isLoading && !active && sceneItems.length === 0) {
        return (
            <div className="flex-1 flex flex-col w-full min-h-full h-auto animate-fade-in" aria-label="Khung chiếu Video Studio">
                <div className="relative w-full h-full min-h-[360px] sm:min-h-[480px] lg:min-h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(79,70,229,0.10)] ring-1 ring-indigo-200/70 flex items-center justify-center select-none bg-[#cfe9ff]">
                    <img
                        src="/video.png"
                        alt="Không gian xem video sẽ xuất hiện tại đây"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
                    />
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden="true">
                        {VIDEO_STAGE_PETALS.map((petal, idx) => (
                            <span
                                key={idx}
                                className="absolute -top-6 rounded-tl-full rounded-br-full bg-gradient-to-br from-pink-100 via-pink-300 to-rose-400/85 shadow-2xs"
                                style={{
                                    left: petal.left,
                                    width: `${petal.size}px`,
                                    height: `${petal.size * 0.7}px`,
                                    opacity: 0.82,
                                    animation: `auth-petal-fall ${petal.duration} linear infinite`,
                                    animationDelay: petal.delay,
                                }}
                            />
                        ))}
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="absolute top-4 left-4 right-4 z-20 max-w-2xl mx-auto rounded-2xl bg-white/95 backdrop-blur-md p-4 text-xs sm:text-sm font-semibold leading-relaxed text-rose-700 border border-rose-200 shadow-lg flex items-start justify-between gap-3 animate-fade-in"
                        >
                            <div className="flex items-start gap-2.5">
                                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold">
                                    !
                                </span>
                                <span className="break-words">{error}</span>
                            </div>
                            {onDismissError && (
                                <button
                                    type="button"
                                    onClick={onDismissError}
                                    aria-label="Đóng thông báo lỗi"
                                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                                >
                                    Đóng
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <section className="w-full max-w-5xl mx-auto space-y-5 animate-fade-in" aria-label="Khung chiếu Video Studio">
            {/* Error Message */}
            {error && (
                <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-xs sm:text-sm font-semibold leading-relaxed text-rose-800 border border-rose-200 shadow-2xs flex items-start justify-between gap-3">
                    <span className="break-words">{error}</span>
                    {onDismissError && (
                        <button
                            type="button"
                            onClick={onDismissError}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                            Đóng
                        </button>
                    )}
                </div>
            )}

            {/* In-Progress State */}
            {isLoading && (
                <div role="status" className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 text-center animate-fade-in">
                    <div className="relative w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin" />
                        <span className="text-amber-600"><FilmIcon /></span>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700">
                        <span className="text-amber-600"><ClockIcon /></span>
                        <span>Thời gian đã xử lý: {formatSeconds(renderTime)}</span>
                    </div>

                    <div className="mt-5 h-2 w-full max-w-md mx-auto overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-full bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse" />
                    </div>
                </div>
            )}

            {/* Active Video Player Stage */}
            {active ? (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-5 rounded-2xl bg-slate-900 p-4 sm:p-6 shadow-sm border border-slate-800 text-white mb-6">
                        {/* Video Player Main View */}
                        <div className="min-w-0 flex flex-col gap-3">
                            <div className="relative overflow-hidden rounded-xl bg-black border border-slate-800 shadow-inner flex flex-col items-center justify-center">
                                <video
                                    key={active.url}
                                    src={active.url}
                                    controls
                                    playsInline
                                    autoPlay
                                    loop
                                    preload="metadata"
                                    onLoadedMetadata={(e) => {
                                        const v = e.currentTarget;
                                        if (v.duration > 0 && v.videoWidth === 0) {
                                            setCodecNotice('Trình duyệt webview hiện tại không hỗ trợ giải mã hình ảnh video này (chỉ phát tiếng). Vui lòng bấm "Tải video MP4 về máy" để mở trọn vẹn bằng ứng dụng video của máy.');
                                        } else {
                                            setCodecNotice(null);
                                        }
                                    }}
                                    onError={() => {
                                        setCodecNotice('Không thể phát video trực tiếp trong ứng dụng. Vui lòng bấm "Tải video MP4 về máy" bên dưới để mở.');
                                    }}
                                    className="max-h-[520px] w-full object-contain bg-black"
                                >
                                    Trình duyệt không hỗ trợ xem video này trực tiếp.
                                </video>
                                {codecNotice && (
                                    <div className="w-full bg-amber-950/80 border-t border-amber-600/40 p-2.5 text-[11px] text-amber-200 text-center font-medium leading-relaxed">
                                        ⚠️ {codecNotice}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Video Metadata & Download Panel */}
                        <div className="flex min-w-0 flex-col justify-between gap-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                        Ảnh khung hình gốc
                                    </span>
                                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                                        Hoàn tất render
                                    </span>
                                </div>

                                {frameSrc ? (
                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                                        <img
                                            src={frameSrc}
                                            alt="Khung hình gốc"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-video w-full rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-xs text-slate-400">
                                        Tạo từ văn bản (Không có ảnh gốc)
                                    </div>
                                )}

                                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                                    {active.title && (
                                        <div className="flex items-center justify-between text-slate-300">
                                            <span>Tiêu đề video:</span>
                                            <span className="font-bold text-amber-400 truncate max-w-[180px]">{active.title}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-slate-300">
                                        <span>Định dạng xuất:</span>
                                        <span className="font-mono font-bold text-white">MP4 (H.264)</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-300">
                                        <span>Thời gian tạo:</span>
                                        <span className="font-mono text-white">
                                            {new Date(active.createdAt).toLocaleTimeString('vi-VN')}
                                        </span>
                                    </div>
                                    {active.modelUsed && (
                                        <div className="flex items-center justify-between text-slate-300">
                                            <span>Mô hình xử lý:</span>
                                            <span className="font-mono text-[11px] text-amber-300 truncate max-w-[160px]">
                                                {active.modelUsed.split('/').pop()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="min-h-[46px] w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <DownloadIcon />
                                    <span>{downloading ? 'Đang lưu video...' : 'Tải video MP4 về máy'}</span>
                                </button>

                                {isElectronPlatform() && (
                                    <button
                                        type="button"
                                        onClick={() => (window as any).electronAPI?.openDownloadFolder()}
                                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                                    >
                                        <span>📁 Mở thư mục lưu video</span>
                                    </button>
                                )}

                                {downloadStatus && (
                                    <div
                                        role="status"
                                        className={`text-xs text-center font-medium p-2.5 rounded-xl border animate-fade-in ${
                                            downloadStatus.success
                                                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                                                : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                                        }`}
                                    >
                                        {downloadStatus.text}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {/* Bàn Duyệt Phân Cảnh & Ghép Lại MP4 */}
            {sceneItems.length > 0 && (
                <div
                    className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-900/5 space-y-5 animate-fade-in"
                    aria-label="Bàn Duyệt Phân Cảnh Video"
                >
                    {/* Header & Remerge Control */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
                                    Bàn Duyệt Phân Cảnh (Cảnh #1..#{sceneItems.length})
                                </h2>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold tabular-nums bg-slate-100 text-slate-700">
                                    {includedScenesCount}/{sceneItems.length} cảnh chọn ghép · {totalSelectedDuration}s
                                </span>
                                {hasUnmergedChanges && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 ring-1 ring-amber-600/20">
                                        Có phân cảnh mới chưa ghép vào MP4
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                                Kiểm tra từng phân cảnh, chỉnh sửa lời nhắc để tạo lại riêng cảnh bị lệch, rồi ghép lại MP4 hoàn chỉnh không tốn thêm giây video.
                            </p>
                        </div>

                        {onRemergeScenes && (
                            <button
                                type="button"
                                onClick={onRemergeScenes}
                                disabled={isMergingScenes || isLoading || anySceneRegenerating || includedScenesCount === 0}
                                className={`min-h-[44px] shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    hasUnmergedChanges
                                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/20'
                                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                                }`}
                            >
                                {isMergingScenes ? (
                                    <>
                                        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                        <span>Đang ghép lại MP4...</span>
                                    </>
                                ) : (
                                    <>
                                        <LayersMergeIcon />
                                        <span>Ghép lại MP4 hoàn chỉnh</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Scene Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sceneItems.map((scene) => {
                            const sceneFrameSrc = toPreviewImageSrc(scene.firstFrame);
                            const qaBadge = getSceneQaBadge(scene.qaReport);
                            const promptInputId = `video-scene-prompt-${scene.index}`;

                            return (
                                <article
                                    key={scene.index}
                                    className={`rounded-2xl p-3.5 sm:p-4 ring-1 transition-all duration-150 space-y-3 ${
                                        scene.included
                                            ? 'bg-slate-50/75 ring-slate-900/5'
                                            : 'bg-slate-100/75 opacity-75 ring-slate-900/10'
                                    }`}
                                >
                                    {/* Card Header: Scene Number, QA Score Badge, Include Toggle */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white text-slate-900 ring-1 ring-slate-200 text-xs font-semibold tabular-nums font-mono shadow-2xs">
                                                Cảnh #{scene.index + 1}
                                            </span>
                                            {qaBadge && (
                                                <span
                                                    title={qaBadge.tooltip}
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums font-mono ${qaBadge.className}`}
                                                >
                                                    {qaBadge.text}
                                                </span>
                                            )}
                                        </div>

                                        {onToggleSceneIncluded && (
                                            <button
                                                type="button"
                                                aria-pressed={scene.included}
                                                disabled={isMergingScenes || scene.isRegenerating}
                                                onClick={() => onToggleSceneIncluded(scene.index)}
                                                className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    scene.included
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/25 hover:bg-emerald-100/70'
                                                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span
                                                    className={`w-2 h-2 rounded-full ${
                                                        scene.included ? 'bg-emerald-500' : 'bg-slate-300'
                                                    }`}
                                                />
                                                <span>{scene.included ? 'Đưa vào MP4' : 'Bỏ qua cảnh'}</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* 2-Column Visual Comparison: Reference Frame vs Rendered Clip */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 ring-1 ring-slate-900/10">
                                            {sceneFrameSrc ? (
                                                <img
                                                    src={sceneFrameSrc}
                                                    alt={`Ảnh gốc Cảnh ${scene.index + 1}`}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 px-2 text-center">
                                                    Không có ảnh gốc
                                                </div>
                                            )}
                                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-semibold tracking-wide">
                                                Ảnh gốc
                                            </span>
                                        </div>

                                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-slate-900/10">
                                            {scene.url ? (
                                                <video
                                                    key={scene.url}
                                                    src={scene.url}
                                                    controls
                                                    playsInline
                                                    preload="metadata"
                                                    className="w-full h-full object-contain bg-black"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400">
                                                    Chưa có clip
                                                </div>
                                            )}
                                            {scene.isRegenerating && (
                                                <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-2 text-center">
                                                    <span className="w-6 h-6 rounded-full border-2 border-indigo-300/40 border-t-indigo-400 animate-spin" />
                                                    <span className="text-[11px] font-semibold">Đang tạo lại & Auto-QA...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Defect Warning Reason (when Auto-QA flagged warning) */}
                                    {scene.qaReport?.status === 'warning' && scene.qaReport.reasonSummary && (
                                        <div className="rounded-xl bg-amber-50/90 ring-1 ring-amber-500/25 px-3 py-2 text-xs font-medium text-amber-900 leading-relaxed">
                                            ⚠ {scene.qaReport.reasonSummary}
                                        </div>
                                    )}

                                    {/* Editable Scene Prompt */}
                                    <div className="space-y-1">
                                        <label
                                            htmlFor={promptInputId}
                                            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                                        >
                                            Lời nhắc phân cảnh #{scene.index + 1}
                                        </label>
                                        <textarea
                                            id={promptInputId}
                                            rows={2}
                                            value={scene.prompt}
                                            disabled={!onUpdateScenePrompt || scene.isRegenerating || isMergingScenes}
                                            onChange={(e) => onUpdateScenePrompt?.(scene.index, e.target.value)}
                                            placeholder="Nhập mô tả chuyển động hoặc thoại cho phân cảnh này..."
                                            className="w-full rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 resize-y"
                                        />
                                    </div>

                                    {/* Card Footer: Scene Metadata & Individual Regenerate CTA */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                        <span className="text-xs text-slate-500 tabular-nums font-mono">
                                            {scene.duration}s · {scene.aspectRatio}
                                        </span>

                                        {onRegenerateScene && (
                                            <button
                                                type="button"
                                                disabled={isLoading || isMergingScenes || scene.isRegenerating}
                                                onClick={() => onRegenerateScene(scene.index, scene.prompt)}
                                                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 active:scale-[0.98] shadow-2xs transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {scene.isRegenerating ? (
                                                    <>
                                                        <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin" />
                                                        <span>Đang tạo lại...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshIcon />
                                                        <span>
                                                            Tạo lại riêng Cảnh #{scene.index + 1} (-{scene.duration}s)
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
};
