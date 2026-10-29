import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DownloadIcon } from './Icons';

interface ImageCropModalProps {
    base64: string;
    index: number;
    onClose: () => void;
    onSave?: (croppedBase64: string) => void;
}

// Preset aspect ratios
const ASPECT_RATIOS = [
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '3:2', value: 3 / 2 },
    { label: '2:3', value: 2 / 3 },
    { label: 'Tự do', value: 0 }, // Free crop
];

interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
    base64,
    index,
    onClose,
    onSave
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const [selectedRatio, setSelectedRatio] = useState<number>(1); // Default 1:1
    const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
    const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

    // Load image and initialize crop area
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            setImageSize({ width: img.width, height: img.height });

            // Calculate display size (max 600px)
            const maxSize = 500;
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            const displayW = img.width * scale;
            const displayH = img.height * scale;
            setDisplaySize({ width: displayW, height: displayH });

            // Initialize crop area based on aspect ratio
            initCropArea(displayW, displayH, selectedRatio);
        };
        img.src = `data:image/png;base64,${base64}`;
    }, [base64]);

    // Update crop area when ratio changes
    useEffect(() => {
        if (displaySize.width > 0) {
            initCropArea(displaySize.width, displaySize.height, selectedRatio);
        }
    }, [selectedRatio, displaySize]);

    const initCropArea = (imgW: number, imgH: number, ratio: number) => {
        if (ratio === 0) {
            // Free crop - use full image
            setCropArea({ x: 0, y: 0, width: imgW, height: imgH });
            return;
        }

        // Calculate max crop area that fits aspect ratio
        let cropW, cropH;
        if (imgW / imgH > ratio) {
            // Image is wider than ratio
            cropH = imgH * 0.8;
            cropW = cropH * ratio;
        } else {
            // Image is taller than ratio
            cropW = imgW * 0.8;
            cropH = cropW / ratio;
        }

        // Center the crop area
        const x = (imgW - cropW) / 2;
        const y = (imgH - cropH) / 2;

        setCropArea({ x, y, width: cropW, height: cropH });
    };

    // Mouse events for dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on resize handle (bottom-right corner)
        const handleSize = 20;
        if (
            x >= cropArea.x + cropArea.width - handleSize &&
            y >= cropArea.y + cropArea.height - handleSize
        ) {
            setIsResizing(true);
        } else if (
            x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height
        ) {
            setIsDragging(true);
        }

        setDragStart({ x, y });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging && !isResizing) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;

        if (isDragging) {
            // Move crop area
            let newX = cropArea.x + dx;
            let newY = cropArea.y + dy;

            // Bounds check
            newX = Math.max(0, Math.min(newX, displaySize.width - cropArea.width));
            newY = Math.max(0, Math.min(newY, displaySize.height - cropArea.height));

            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        } else if (isResizing) {
            // Resize crop area
            let newW = cropArea.width + dx;
            let newH = cropArea.height + dy;

            // Maintain aspect ratio if not free crop
            if (selectedRatio !== 0) {
                newH = newW / selectedRatio;
            }

            // Min size
            newW = Math.max(50, newW);
            newH = Math.max(50, newH);

            // Bounds check
            if (cropArea.x + newW > displaySize.width) newW = displaySize.width - cropArea.x;
            if (cropArea.y + newH > displaySize.height) {
                newH = displaySize.height - cropArea.y;
                if (selectedRatio !== 0) newW = newH * selectedRatio;
            }

            setCropArea(prev => ({ ...prev, width: newW, height: newH }));
        }

        setDragStart({ x, y });
    }, [isDragging, isResizing, dragStart, cropArea, displaySize, selectedRatio]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // Generate cropped image
    const generateCroppedImage = (): string | null => {
        if (!imageRef.current || !canvasRef.current) return null;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Calculate actual crop coordinates on original image
        const scaleX = imageSize.width / displaySize.width;
        const scaleY = imageSize.height / displaySize.height;

        const actualX = cropArea.x * scaleX;
        const actualY = cropArea.y * scaleY;
        const actualW = cropArea.width * scaleX;
        const actualH = cropArea.height * scaleY;

        // Set canvas size to cropped dimensions
        canvas.width = actualW;
        canvas.height = actualH;

        // Draw cropped portion
        ctx.drawImage(
            imageRef.current,
            actualX, actualY, actualW, actualH,
            0, 0, actualW, actualH
        );

        // Get base64 without data URL prefix
        const dataUrl = canvas.toDataURL('image/png');
        return dataUrl.replace('data:image/png;base64,', '');
    };

    const handlePreview = () => {
        const cropped = generateCroppedImage();
        if (cropped) {
            setCroppedPreview(cropped);
        }
    };

    const handleDownload = () => {
        const cropped = generateCroppedImage();
        if (!cropped) return;

        const link = document.createElement('a');
        link.href = `data:image/png;base64,${cropped}`;
        link.download = `${index + 1}_cropped.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSave = () => {
        const cropped = generateCroppedImage();
        if (cropped && onSave) {
            onSave(cropped);
        }
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl p-6 flex flex-col items-center gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">✂️ Cắt ảnh</h2>
                    <p className="text-slate-400 text-sm">Kéo để di chuyển, kéo góc để thay đổi kích thước</p>
                </div>

                {/* Aspect Ratio Buttons */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {ASPECT_RATIOS.map((ratio) => (
                        <button
                            key={ratio.label}
                            onClick={() => setSelectedRatio(ratio.value)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${selectedRatio === ratio.value
                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            {ratio.label}
                        </button>
                    ))}
                </div>

                {/* Crop Area */}
                <div className="flex gap-6 items-start">
                    {/* Main Image with Crop Overlay */}
                    <div
                        ref={containerRef}
                        className="relative cursor-move select-none"
                        style={{ width: displaySize.width, height: displaySize.height }}
                        onMouseDown={handleMouseDown}
                    >
                        {/* Background Image (dimmed) */}
                        <img
                            src={`data:image/png;base64,${base64}`}
                            alt="Original"
                            className="absolute inset-0 opacity-30"
                            style={{ width: displaySize.width, height: displaySize.height }}
                            draggable={false}
                        />

                        {/* Crop Window (bright) */}
                        <div
                            className="absolute overflow-hidden border-2 border-white shadow-2xl"
                            style={{
                                left: cropArea.x,
                                top: cropArea.y,
                                width: cropArea.width,
                                height: cropArea.height,
                            }}
                        >
                            <img
                                src={`data:image/png;base64,${base64}`}
                                alt="Crop preview"
                                style={{
                                    width: displaySize.width,
                                    height: displaySize.height,
                                    marginLeft: -cropArea.x,
                                    marginTop: -cropArea.y,
                                }}
                                draggable={false}
                            />
                        </div>

                        {/* Corner guides */}
                        <div
                            className="absolute border-2 border-dashed border-white/50 pointer-events-none"
                            style={{
                                left: cropArea.x,
                                top: cropArea.y,
                                width: cropArea.width,
                                height: cropArea.height,
                            }}
                        >
                            {/* Grid lines */}
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                                {[...Array(9)].map((_, i) => (
                                    <div key={i} className="border border-white/20" />
                                ))}
                            </div>
                        </div>

                        {/* Resize Handle */}
                        <div
                            className="absolute w-6 h-6 bg-white rounded-full cursor-se-resize shadow-lg border-2 border-indigo-500"
                            style={{
                                left: cropArea.x + cropArea.width - 12,
                                top: cropArea.y + cropArea.height - 12,
                            }}
                        />
                    </div>

                    {/* Preview Panel */}
                    {croppedPreview && (
                        <div className="bg-slate-800 rounded-xl p-4 max-w-[300px]">
                            <p className="text-white text-sm font-medium mb-2">Xem trước</p>
                            <img
                                src={`data:image/png;base64,${croppedPreview}`}
                                alt="Cropped preview"
                                className="rounded-lg max-w-full max-h-[200px] object-contain"
                            />
                        </div>
                    )}
                </div>

                {/* Dimensions Info */}
                <div className="text-slate-400 text-xs">
                    Kích thước crop: {Math.round(cropArea.width * (imageSize.width / displaySize.width))} x {Math.round(cropArea.height * (imageSize.height / displaySize.height))} px
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePreview}
                        className="px-6 py-3 bg-slate-700 text-white font-bold rounded-full hover:bg-slate-600 transition-all"
                    >
                        👁️ Xem trước
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-full hover:from-indigo-600 hover:to-purple-600 hover:scale-105 transition-all shadow-lg"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Tải xuống
                    </button>
                    {onSave && (
                        <button
                            onClick={handleSave}
                            className="px-8 py-3.5 bg-green-500 text-white font-bold rounded-full hover:bg-green-600 hover:scale-105 transition-all shadow-lg"
                        >
                            ✓ Lưu
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-8 py-3.5 bg-slate-800/80 text-white font-bold rounded-full hover:bg-slate-700 transition-all backdrop-blur-sm border border-slate-700"
                    >
                        Đóng
                    </button>
                </div>

                {/* Hidden canvas for cropping */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 bg-white/10 text-white rounded-full h-12 w-12 flex items-center justify-center text-2xl hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};
