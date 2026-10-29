
import React from 'react';
import { ErrorIcon, ImageIcon } from './Icons';

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

const OutputImage: React.FC<{ base64: string; index: number, prompt: string, meta?: { name: string, job: string }, onClick: () => void }> = ({ base64, index, prompt, meta, onClick }) => {
    return (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col gap-2 animate-fade-in group hover:-translate-y-1">
            <div
                className="relative w-full aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer"
                onClick={onClick}
            >
                <img src={`data:image/png;base64,${base64}`} alt={`Generated ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

                {/* Number Badge */}
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center font-bold text-slate-800 shadow-sm z-10 text-xs border border-white/50">
                    {index + 1}
                </div>

                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="bg-white/90 text-slate-900 px-3 py-1.5 rounded-full font-bold text-xs shadow-md transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        Xem ảnh
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                {meta ? (
                    <div className="text-center">
                        <h4 className="font-bold text-slate-800 text-xs truncate">{meta.name}</h4>
                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5 truncate">{meta.job}</p>
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight font-medium" title={prompt}>
                        {prompt || 'Đang xử lý prompt...'}
                    </p>
                )}
            </div>
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
        <div className="absolute inset-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center border-2 border-white/60">
            {/* Center dot */}
            <div className="w-3 h-3 bg-indigo-600 rounded-full z-20 shadow-sm"></div>
            {/* Hour Hand - rotates from center */}
            <div className="absolute w-[4px] h-[28%] bg-indigo-800 rounded-full animate-clock-hour" style={{ transformOrigin: 'center bottom', top: '22%', left: 'calc(50% - 2px)' }}></div>
            {/* Minute Hand - rotates from center */}
            <div className="absolute w-[3px] h-[35%] bg-indigo-500 rounded-full animate-clock-minute" style={{ transformOrigin: 'center bottom', top: '15%', left: 'calc(50% - 1.5px)' }}></div>
        </div>
    </div>
);

const LoadingSlot: React.FC<{ index: number }> = ({ index }) => (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 animate-pulse">
        <div className="w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shadow-inner relative overflow-hidden">
            <div className="flex flex-col items-center gap-2 z-10">
                <ClockLoader />
            </div>
        </div>
        <div className="bg-slate-100 rounded-lg h-8 w-full"></div>
    </div>
);


export const OutputDisplay: React.FC<OutputDisplayProps> = ({ outputImages, prompts, isLoading, loadingStatus, error, onImageClick, metadata, onReplaySlideshow }) => {
    // We consider it "active" if there are items in the output array (even if null) or if loading.
    const isActive = outputImages.length > 0;

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header / Status - More Compact */}
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center transition-all duration-500 relative ${isActive ? '' : 'min-h-[200px]'}`}>

                {/* REPLAY BUTTON (Top Right) */}
                {isActive && !isLoading && onReplaySlideshow && (
                    <button
                        onClick={onReplaySlideshow}
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-indigo-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all text-xs z-20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                        TRÌNH CHIẾU
                    </button>
                )}

                {isLoading ? (
                    <div className="animate-fade-in flex flex-col items-center">
                        <div className="mb-2">
                            <ClockLoader />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Vui lòng chờ ít phút</h3>
                    </div>
                ) : error ? (
                    <div className="text-red-500 flex flex-col items-center gap-2 animate-fade-in">
                        <div className="p-2 bg-red-50 rounded-full border border-red-100">
                            <ErrorIcon className="w-6 h-6" />
                        </div>
                        <span className="font-medium text-sm">{error}</span>
                    </div>
                ) : isActive ? (
                    <div className="animate-fade-in flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-full text-green-600 border border-green-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-slate-800">Hoàn thành!</h3>
                            <p className="text-slate-500 text-xs">Đã tạo {outputImages.filter(i => i).length} ảnh.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                        <ImageIcon className="w-12 h-12 opacity-40" />
                        <p className="text-slate-400 font-medium text-sm">Kết quả sẽ hiển thị tại đây</p>
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
                        } else {
                            const promptText = prompts && prompts[index] ? prompts[index] : "Ảnh được tạo từ AI";
                            const meta = metadata && metadata[index] ? metadata[index] : undefined;

                            return <OutputImage key={index} base64={image} index={index} prompt={promptText} meta={meta} onClick={() => onImageClick(image, index)} />;
                        }
                    })}
                </div>
            )}
        </div>
    );
};
