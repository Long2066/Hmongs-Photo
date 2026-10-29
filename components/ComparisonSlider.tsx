import React, { useState, useRef, useCallback } from 'react';
import { DownloadIcon } from './Icons';

interface ComparisonSliderProps {
    beforeImage: string; // base64
    afterImage: string; // base64
    onDownload: () => void;
    onClose: () => void;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
    beforeImage,
    afterImage,
    onDownload,
    onClose
}) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMouseDown = useCallback(() => {
        isDragging.current = true;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging.current || !containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        let clientX: number;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(percentage);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const clientX = e.touches[0].clientX;
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(percentage);
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <span className="text-amber-400">✨</span>
                    So Sánh Trước & Sau Phục Hồi
                </h2>
                <div className="flex gap-3">
                    <button
                        onClick={onDownload}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-amber-500/40 transition-all flex items-center gap-2"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Tải Ảnh Phục Hồi
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition-all"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* Comparison Container */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div
                    ref={containerRef}
                    className="relative max-w-[90vw] max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl cursor-ew-resize select-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                >
                    {/* After Image (Background - Full) */}
                    <img
                        src={`data:image/png;base64,${afterImage}`}
                        alt="Sau phục hồi"
                        className="w-full h-auto max-h-[80vh] object-contain"
                        draggable={false}
                    />

                    {/* Before Image (Clipped) */}
                    <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                    >
                        <img
                            src={`data:image/png;base64,${beforeImage}`}
                            alt="Trước phục hồi"
                            className="w-full h-auto max-h-[80vh] object-contain"
                            draggable={false}
                        />
                    </div>

                    {/* Slider Line */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
                        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                    >
                        {/* Handle */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                            <div className="flex gap-0.5">
                                <div className="w-0.5 h-4 bg-slate-400 rounded-full" />
                                <div className="w-0.5 h-4 bg-slate-400 rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 text-white text-xs font-bold rounded-full backdrop-blur-sm">
                        TRƯỚC
                    </div>
                    <div className="absolute top-4 right-4 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                        SAU
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="text-center pb-4 text-white/60 text-sm">
                👆 Kéo thanh gạt để so sánh | 📥 Nhấn "Tải Ảnh Phục Hồi" để lưu
            </div>
        </div>
    );
};
