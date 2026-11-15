import React, { useState, useEffect } from 'react';
import { downloadImage, isNativePlatform, isElectronPlatform } from '../services/downloadService';

// Vector SVG Icons
const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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

interface VideoWorkspaceProps {
    videos: VideoEntry[];
    isLoading: boolean;
    loadingStatus: string;
    error: string | null;
    onDismissError?: () => void;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({
    videos,
    isLoading,
    loadingStatus,
    error,
    onDismissError
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

    const frameSrc = active?.firstFrame
        ? active.firstFrame.startsWith('data:') || /^https?:\/\//i.test(active.firstFrame)
            ? active.firstFrame
            : `data:image/png;base64,${active.firstFrame}`
        : null;

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

    if (!isLoading && !active) {
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
                    <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin" />
                        <span className="text-amber-600"><FilmIcon /></span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                        {loadingStatus || 'Vui lòng chờ...'}
                    </h3>

                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700">
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
        </section>
    );
};
