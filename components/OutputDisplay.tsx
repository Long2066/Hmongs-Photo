import React, { useState } from 'react';
import { downloadImage } from '../services/downloadService';
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
    onReplaySlideshow?: () => void;
}

const isVideoUrl = (url: string | null): boolean => {
    if (!url) return false;
    return url.endsWith('.mp4') || url.includes('/files/') || url.includes('filename=video.mp4') || (url.startsWith('http') && url.includes('vid_'));
};

const OutputVideo: React.FC<{ url: string; index: number; prompt: string }> = ({ url, index, prompt }) => {
    const [downloading, setDownloading] = useState(false);
    const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        setDownloading(true);
        try {
            const res = await downloadImage(url, `veo_video_${index + 1}.mp4`);
            if (res.message) {
                setDownloadMsg(res.message);
                setTimeout(() => setDownloadMsg(null), 3500);
            }
        } catch (err: any) {
            console.error('Download video error:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 animate-fade-in ring-1 ring-slate-900/5 col-span-full max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-800 tracking-tight uppercase">Veo AI Video #{index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                    {downloadMsg && (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 animate-fade-in">
                            {downloadMsg}
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
                    {prompt || 'Video được tạo từ Veo 3.1 AI'}
                </p>
            </div>
        </div>
    );
};

const OutputImage: React.FC<{ base64: string; index: number, onClick: () => void }> = ({ base64, index, onClick }) => {
    const imgSrc = base64.startsWith('data:') || base64.startsWith('http')
        ? base64
        : `data:image/png;base64,${base64}`;

    return (
        <div className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 transition-shadow hover:shadow-md">
            <button
                type="button"
                onClick={onClick}
                aria-label={`Xem chi tiết ảnh ${index + 1}`}
                className="relative flex aspect-square min-h-[44px] w-full cursor-pointer items-center justify-center overflow-hidden bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 active:scale-[0.99]"
            >
                <img src={imgSrc} alt={`Ảnh được tạo ${index + 1}`} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />

                {/* Number Badge */}
                <span className="absolute left-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center rounded-lg bg-white/95 px-1 font-mono text-xs font-bold tabular-nums text-slate-900 shadow-sm">
                    {index + 1}
                </span>

                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-slate-900/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-900 shadow-sm">Xem chi tiết</span>
                </span>
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
    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-2 animate-pulse">
        <div className="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shadow-inner relative overflow-hidden">
            <div className="flex flex-col items-center gap-2 z-10">
                <ClockLoader />
            </div>
        </div>
        <div className="bg-slate-100 rounded-lg h-8 w-full"></div>
    </div>
);

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ outputImages, prompts, isLoading, loadingStatus, error, onImageClick, metadata, onReplaySlideshow }) => {
    const isActive = outputImages.length > 0;

    if (!isLoading && !error && !isActive) {
        return (
            <div className="flex-1 flex flex-col w-full h-full">
                <StudioHeroStage />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header / Status - More Compact */}
            <div className="bg-white rounded-2xl shadow-xs border border-indigo-100/90 ring-1 ring-slate-900/5 p-6 flex flex-col items-center justify-center text-center transition-all duration-300 relative">

                {/* REPLAY BUTTON (Top Right) */}
                {isActive && !isLoading && onReplaySlideshow && (
                    <button
                        onClick={onReplaySlideshow}
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white font-bold rounded-xl shadow-xs hover:bg-violet-700 transition-all text-xs z-20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                        TRÌNH CHIẾU
                    </button>
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
                            <h3 className="text-base font-bold text-slate-900">Hoàn thành!</h3>
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
                            const promptText = prompts && prompts[index] ? prompts[index] : "Video Veo AI";
                            return <OutputVideo key={index} url={image} index={index} prompt={promptText} />;
                        } else {
                            return <OutputImage key={index} base64={image} index={index} onClick={() => onImageClick(image, index)} />;
                        }
                    })}
                </div>
            )}
        </div>
    );
};
