import React, { useState } from 'react';
import { downloadImage, isElectronPlatform } from '../services/downloadService';
import { ErrorIcon } from './Icons';
import { StudioHeroStage } from './StudioHeroStage';

interface OutputDisplayProps {
    outputImages: (string | null)[];
    prompts: string[];
    isLoading: boolean;
    loadingStatus: string;
    error: string | null;
    onImageClick: (base64: string, index: number) => void;
    metadata?: { name: string, job: string }[];
    titlePrefix?: string; // Tiêu đề / Tên file output nhập từ input
    onReplaySlideshow?: () => void;
    onDismissError?: () => void;
}

const isVideoUrl = (url: string | null): boolean => {
    if (!url) return false;
    return url.endsWith('.mp4') || url.includes('/files/') || url.includes('filename=video.mp4') || (url.startsWith('http') && url.includes('vid_'));
};

const OutputVideo: React.FC<{ url: string; index: number; prompt: string; title?: string }> = ({ url, index, prompt, title }) => {
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<{ text: string; success: boolean } | null>(null);

    const videoTitle = (title && title.trim()) ? title.trim() : `Video_${index + 1}`;
    const cleanFileName = videoTitle.replace(/[/\\?%*:|"<>]/g, '_');
    const downloadFileName = cleanFileName.toLowerCase().endsWith('.mp4') ? cleanFileName : `${cleanFileName}.mp4`;

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        setDownloading(true);
        try {
            const res = await downloadImage(url, downloadFileName);
            setDownloadStatus({
                text: res.message || (res.success ? 'Đã lưu video thành công.' : 'Không thể lưu video.'),
                success: res.success
            });
            setTimeout(() => setDownloadStatus(null), 3500);
        } catch (err: any) {
            setDownloadStatus({
                text: err?.message || 'Không thể tải video.',
                success: false
            });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 animate-fade-in ring-1 ring-slate-900/5 col-span-full max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 max-w-[65%]">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                    <span className="text-xs font-bold text-slate-900 tracking-tight uppercase truncate" title={videoTitle}>
                        🎬 {videoTitle}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {downloadStatus && (
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border animate-fade-in ${
                            downloadStatus.success
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                        }`}>
                            {downloadStatus.text}
                        </span>
                    )}
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{downloading ? 'Đang lưu...' : 'Tải Video MP4'}</span>
                    </button>
                </div>
            </div>

            <div className="relative w-full rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-900/10 shadow-inner">
                <video
                    src={url}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                >
                    Trình duyệt của bạn không hỗ trợ phát thẻ video.
                </video>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    <strong className="text-slate-900 font-bold">Kịch bản: </strong>
                    {prompt || 'Video AI Studio'}
                </p>
            </div>
        </div>
    );
};

const OutputImage: React.FC<{ base64: string; index: number; titlePrefix?: string; onClick: () => void }> = ({ base64, index, titlePrefix, onClick }) => {
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

    const imgSrc = base64.startsWith('data:') || base64.startsWith('http')
        ? base64
        : `data:image/png;base64,${base64}`;

    const label = titlePrefix && titlePrefix.trim()
        ? `${titlePrefix.trim()}_${index + 1}`
        : `#${index + 1}`;

    const handleQuickDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (downloading) return;
        setDownloading(true);
        try {
            const filename = `${label.replace(/[/\\?%*:|"<>]/g, '_')}.png`;
            const res = await downloadImage(base64, filename);
            setDownloadStatus(res.success ? '✓' : '✕');
            setTimeout(() => setDownloadStatus(null), 2500);
        } catch (err) {
            console.error('Quick download image error:', err);
            setDownloadStatus('✕');
            setTimeout(() => setDownloadStatus(null), 2500);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 transition-shadow hover:shadow-md">
            <button
                type="button"
                onClick={onClick}
                aria-label={`Xem chi tiết ảnh ${label}`}
                className="relative flex aspect-square min-h-[44px] w-full cursor-pointer items-center justify-center overflow-hidden bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 active:scale-[0.99]"
            >
                <img src={imgSrc} alt={label} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />

                {/* Title / Number Badge */}
                <span className="absolute left-2 top-2 z-10 flex h-7 max-w-[65%] items-center justify-center rounded-lg bg-white/95 px-2 font-mono text-xs font-bold tabular-nums text-slate-900 shadow-sm border border-slate-200 truncate" title={label}>
                    {label}
                </span>

                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-slate-900/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-900 shadow-sm">Xem chi tiết</span>
                </span>
            </button>

            {/* Quick Download Button (Top Right) */}
            <button
                type="button"
                onClick={handleQuickDownload}
                disabled={downloading}
                aria-label={`Tải ảnh ${label}`}
                title={`Tải ảnh ${label} về máy`}
                className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm border border-slate-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 active:scale-95 transition-all cursor-pointer"
            >
                {downloadStatus ? (
                    <span className={`text-xs font-bold ${downloadStatus === '✓' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {downloadStatus}
                    </span>
                ) : downloading ? (
                    <svg className="w-3.5 h-3.5 animate-spin text-violet-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                )}
            </button>
        </div>
    );
};

// STYLISH CLOCK LOADER - Large Professional size
const ClockLoader: React.FC = () => (
    <div className="relative w-28 h-28">
        {/* Outer Ring */}
        <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
            <defs>
                <linearGradient id="clockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(200,200,255,0.25)" strokeWidth="6" />
            <path d="M50 5 A45 45 0 0 1 95 50" fill="none" stroke="url(#clockGradient)" strokeWidth="6" strokeLinecap="round" />
        </svg>

        {/* Clock Face & Hands */}
        <div className="absolute inset-3 bg-white rounded-full shadow-md flex items-center justify-center border-2 border-indigo-100">
            {/* Center dot */}
            <div className="w-3 h-3 bg-violet-600 rounded-full z-20 shadow-sm"></div>
            {/* Hour Hand - rotates from center */}
            <div className="absolute w-[4px] h-[28%] bg-indigo-800 rounded-full animate-clock-hour" style={{ transformOrigin: 'center bottom', top: '22%', left: 'calc(50% - 2px)' }}></div>
            {/* Minute Hand - rotates from center */}
            <div className="absolute w-[3px] h-[35%] bg-violet-500 rounded-full animate-clock-minute" style={{ transformOrigin: 'center bottom', top: '15%', left: 'calc(50% - 1.5px)' }}></div>
        </div>
    </div>
);

const LoadingSlot: React.FC<{ index: number }> = ({ index }) => (
    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-2 animate-pulse relative">
        <span className="absolute left-2.5 top-2.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-lg bg-indigo-50 font-mono text-[11px] font-bold text-indigo-700 border border-indigo-200 shadow-2xs">
            #{index + 1}
        </span>
        <div className="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shadow-inner relative overflow-hidden">
            <div className="flex flex-col items-center gap-2 z-10">
                <ClockLoader />
            </div>
        </div>
        <div className="bg-slate-50 rounded-lg h-7 w-full flex items-center justify-center border border-slate-100">
            <span className="text-[10px] text-slate-600 font-bold">Đang xử lý Slot #{index + 1}...</span>
        </div>
    </div>
);

export const OutputDisplay: React.FC<OutputDisplayProps> = ({
    outputImages,
    prompts,
    isLoading,
    loadingStatus,
    error,
    onImageClick,
    metadata,
    titlePrefix,
    onReplaySlideshow,
    onDismissError
}) => {
    const [batchDownloading, setBatchDownloading] = useState(false);
    const [batchProgress, setBatchProgress] = useState<string | null>(null);

    const hasCompletedImages = outputImages.some(img => img !== null);
    const completedImages = outputImages.filter((img): img is string => img !== null && !isVideoUrl(img));
    const isActive = isLoading ? outputImages.length > 0 : hasCompletedImages;

    const handleBatchDownloadAll = async () => {
        if (batchDownloading || completedImages.length === 0) return;
        setBatchDownloading(true);
        try {
            for (let i = 0; i < completedImages.length; i++) {
                setBatchProgress(`${i + 1}/${completedImages.length}`);
                const paddedIdx = String(i + 1).padStart(2, '0');
                const rawName = titlePrefix && titlePrefix.trim() ? `${titlePrefix.trim()}_${paddedIdx}.png` : `Image_${paddedIdx}.png`;
                await downloadImage(completedImages[i], rawName);
                await new Promise(r => setTimeout(r, 350));
            }
            setBatchProgress('✓ Xong');
            setTimeout(() => setBatchProgress(null), 3000);
        } catch (e) {
            console.error('Batch download error:', e);
        } finally {
            setBatchDownloading(false);
        }
    };

    if (!isLoading && !isActive) {
        return (
            <div className="relative flex-1 flex flex-col w-full min-h-full h-auto animate-fade-in">
                <StudioHeroStage />
                {error && (
                    <div
                        role="alert"
                        className="absolute top-4 left-4 right-4 z-20 max-w-2xl mx-auto rounded-2xl bg-white/95 backdrop-blur-md p-4 text-xs sm:text-sm font-semibold leading-relaxed text-rose-700 border border-rose-200 shadow-lg flex items-start justify-between gap-3 animate-fade-in"
                    >
                        <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 shrink-0 p-1 bg-rose-50 rounded-full border border-rose-200">
                                <ErrorIcon className="w-4 h-4 text-rose-600" />
                            </div>
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
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in pb-8">
            {/* Header / Status */}
            <div className="bg-white rounded-2xl shadow-xs border border-indigo-100/90 ring-1 ring-slate-900/5 p-6 flex flex-col items-center justify-center text-center transition-all duration-300 relative">

                {/* Header Action Buttons */}
                {isActive && !isLoading && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto mt-3 sm:mt-0 sm:absolute sm:top-4 sm:right-4 z-20">
                        {isElectronPlatform() && (
                            <button
                                type="button"
                                onClick={() => (window as any).electronAPI?.openDirectory?.()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl shadow-xs transition-all text-xs cursor-pointer border border-slate-200 active:scale-95"
                                title="Mở thư mục lưu trên máy tính"
                            >
                                📁 Mở thư mục lưu
                            </button>
                        )}

                        {completedImages.length > 1 && (
                            <button
                                type="button"
                                onClick={handleBatchDownloadAll}
                                disabled={batchDownloading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-all text-xs cursor-pointer active:scale-95"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>{batchDownloading ? `Đang lưu (${batchProgress})...` : `Tải tất cả ảnh (${completedImages.length})`}</span>
                            </button>
                        )}

                        {onReplaySlideshow && (
                            <button
                                type="button"
                                onClick={onReplaySlideshow}
                                className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white font-bold rounded-xl shadow-xs hover:bg-violet-700 transition-all text-xs cursor-pointer active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                </svg>
                                TRÌNH CHIẾU
                            </button>
                        )}
                    </div>
                )}

                {isLoading ? (
                    <div className="animate-fade-in flex flex-col items-center max-w-md mx-auto text-center px-4">
                        <div className="mb-2.5">
                            <ClockLoader />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">
                            {loadingStatus || 'Vui lòng chờ ít phút'}
                        </h3>
                        <p className="text-xs text-amber-600 font-semibold animate-pulse mt-0.5">
                            ⚡ Hệ thống AI đang xử lý theo thời gian thực... Vui lòng không đóng tab
                        </p>
                    </div>
                ) : error ? (
                    <div className="text-red-600 flex flex-col items-center gap-2 animate-fade-in">
                        <div className="p-2 bg-red-50 rounded-full border border-red-200">
                            <ErrorIcon className="w-6 h-6 text-red-600" />
                        </div>
                        <span className="font-semibold text-sm">{error}</span>
                    </div>
                ) : (
                    <div className="animate-fade-in flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-base font-bold text-slate-900">
                                Hoàn thành{titlePrefix ? `: ${titlePrefix}` : ''}!
                            </h3>
                            <p className="text-slate-600 text-xs font-medium">
                                Đã tạo thành công {outputImages.filter(i => i).length} {outputImages.some(i => i && isVideoUrl(i)) ? 'video điện ảnh' : 'ảnh chuẩn nét'}.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Dynamic Grid - Responsive based on output count */}
            {outputImages.length > 0 && (
                <div className={`
                    grid gap-4 
                    ${outputImages.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : ''}
                    ${outputImages.length === 2 ? 'grid-cols-2 max-w-2xl mx-auto' : ''}
                    ${outputImages.length === 3 ? 'grid-cols-3 max-w-3xl mx-auto' : ''}
                    ${outputImages.length === 4 ? 'grid-cols-2 md:grid-cols-4 max-w-4xl mx-auto' : ''}
                    ${outputImages.length >= 5 && outputImages.length <= 6 ? 'grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto' : ''}
                    ${outputImages.length >= 7 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : ''}
                `}>
                    {outputImages.map((image, index) => {
                        if (image === null) {
                            return <LoadingSlot key={index} index={index} />;
                        } else if (isVideoUrl(image)) {
                            const promptText = prompts && prompts[index] ? prompts[index] : "Video AI Studio";
                            return <OutputVideo key={index} url={image} index={index} prompt={promptText} title={titlePrefix} />;
                        } else {
                            return <OutputImage key={index} base64={image} index={index} titlePrefix={titlePrefix} onClick={() => onImageClick(image, index)} />;
                        }
                    })}
                </div>
            )}
        </div>
    );
};
