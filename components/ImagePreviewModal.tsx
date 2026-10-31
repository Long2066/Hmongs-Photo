import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DownloadIcon } from './Icons';
import { downloadImage } from '../services/downloadService';

interface ImagePreviewModalProps {
    base64: string;
    index: number;
    onClose: () => void;
    onUpdateImage?: (newBase64: string, index: number) => void;
}

interface AspectRatioOption {
    id: string;
    label: string;
    value: number;
    subLabel: string;
}

const CROP_RATIOS: AspectRatioOption[] = [
    { id: '3:4', label: '3x4', value: 3 / 4, subLabel: 'Chuẩn ảnh thẻ' },
    { id: '2:3', label: '4x6', value: 2 / 3, subLabel: 'Hộ chiếu / CCCD' },
    { id: '1:1', label: '1:1', value: 1, subLabel: 'Vuông / Visa Mỹ' },
    { id: '9:16', label: '9:16', value: 9 / 16, subLabel: 'Dọc TikTok' },
    { id: '16:9', label: '16:9', value: 16 / 9, subLabel: 'Ngang' }
];

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
    base64,
    index,
    onClose,
    onUpdateImage
}) => {
    // Current base64 image (supports immediate in-modal preview of cropped image)
    const [currentBase64, setCurrentBase64] = useState<string>(base64);

    // View mode: 'preview' (standard view) or 'crop' (interactive crop studio)
    const [viewMode, setViewMode] = useState<'preview' | 'crop'>('preview');

    // Download feedback
    const [downloadStatus, setDownloadStatus] = useState<{ message: string; success: boolean } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    // Crop settings
    const [selectedRatio, setSelectedRatio] = useState<AspectRatioOption>(CROP_RATIOS[0]); // default 3:4
    const [zoom, setZoom] = useState<number>(1.0);
    const [rotation, setRotation] = useState<number>(0);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [showGuidelines, setShowGuidelines] = useState<boolean>(true);

    // Image & frame dimensions
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 360, height: 420 });

    const imgRef = useRef<HTMLImageElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const imageSrc = currentBase64.startsWith('data:')
        ? currentBase64
        : `data:image/png;base64,${currentBase64}`;

    // Load image natural dimensions & pick smart default ratio
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });

            // Auto-detect matching ratio if possible
            const naturalRatio = img.naturalWidth / img.naturalHeight;
            if (Math.abs(naturalRatio - 0.75) < 0.08) {
                setSelectedRatio(CROP_RATIOS[0]); // 3:4
            } else if (Math.abs(naturalRatio - 0.667) < 0.08) {
                setSelectedRatio(CROP_RATIOS[1]); // 4:6 (2:3)
            } else if (Math.abs(naturalRatio - 1.0) < 0.08) {
                setSelectedRatio(CROP_RATIOS[2]); // 1:1
            }
        };
        img.src = imageSrc;
    }, [imageSrc]);

    // Update viewport size dynamically
    useEffect(() => {
        const updateViewport = () => {
            const availW = Math.min(window.innerWidth - 32, 540);
            const availH = Math.min(window.innerHeight - 300, 480);
            setViewportSize({ width: Math.max(260, availW), height: Math.max(300, availH) });
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    // Calculate crop frame dimensions based on chosen aspect ratio and viewport
    const calculateFrameSize = useCallback(() => {
        const maxW = viewportSize.width - 24;
        const maxH = viewportSize.height - 24;
        const ratio = selectedRatio.value;

        let frameW: number;
        let frameH: number;

        if (ratio <= 1) {
            // Portrait
            frameH = Math.min(maxH, 440);
            frameW = frameH * ratio;
            if (frameW > maxW) {
                frameW = maxW;
                frameH = frameW / ratio;
            }
        } else {
            // Landscape
            frameW = Math.min(maxW, 460);
            frameH = frameW / ratio;
            if (frameH > maxH) {
                frameH = maxH;
                frameW = frameH * ratio;
            }
        }

        return {
            frameW: Math.round(frameW),
            frameH: Math.round(frameH)
        };
    }, [viewportSize, selectedRatio]);

    const { frameW, frameH } = calculateFrameSize();

    // Calculate effective image dimensions considering rotation
    const isSideways = rotation === 90 || rotation === 270;
    const effW = isSideways ? naturalSize.height : naturalSize.width;
    const effH = isSideways ? naturalSize.width : naturalSize.height;

    // Scale and bounds
    const baseScale = effW > 0 && effH > 0 ? Math.max(frameW / effW, frameH / effH) : 1;
    const activeScale = baseScale * zoom;
    const dispW = effW * activeScale;
    const dispH = effH * activeScale;

    // Strict clamping so image completely fills the crop frame
    const minPanX = frameW - dispW;
    const maxPanX = 0;
    const minPanY = frameH - dispH;
    const maxPanY = 0;

    const safePanX = Math.min(maxPanX, Math.max(minPanX, pan.x));
    const safePanY = Math.min(maxPanY, Math.max(minPanY, pan.y));

    // Reset pan and zoom to center
    const handleResetCenter = () => {
        setZoom(1.0);
        setRotation(0);
        setPan({
            x: (frameW - effW * baseScale) / 2,
            y: (frameH - effH * baseScale) / 2
        });
    };

    // Re-center when ratio or rotation changes
    useEffect(() => {
        if (effW > 0 && effH > 0) {
            setPan({
                x: (frameW - effW * baseScale * zoom) / 2,
                y: (frameH - effH * baseScale * zoom) / 2
            });
        }
    }, [selectedRatio, rotation, frameW, frameH]);

    // Mouse drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { x: safePanX, y: safePanY };
    };

    // Touch drag handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            isDraggingRef.current = true;
            dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            panStartRef.current = { x: safePanX, y: safePanY };
        }
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            setPan({
                x: panStartRef.current.x + dx,
                y: panStartRef.current.y + dy
            });
        };

        const handleGlobalTouchMove = (e: TouchEvent) => {
            if (!isDraggingRef.current || e.touches.length !== 1) return;
            const dx = e.touches[0].clientX - dragStartRef.current.x;
            const dy = e.touches[0].clientY - dragStartRef.current.y;
            setPan({
                x: panStartRef.current.x + dx,
                y: panStartRef.current.y + dy
            });
        };

        const handleGlobalEnd = () => {
            isDraggingRef.current = false;
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalEnd);
        window.addEventListener('touchmove', handleGlobalTouchMove);
        window.addEventListener('touchend', handleGlobalEnd);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalEnd);
            window.removeEventListener('touchmove', handleGlobalTouchMove);
            window.removeEventListener('touchend', handleGlobalEnd);
        };
    }, []);

    // Mouse wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom(prev => Math.min(3.5, Math.max(1.0, Number((prev + delta).toFixed(2)))));
    };

    // High quality canvas slice and export
    const generateCroppedData = (): { dataUrl: string; base64: string } | null => {
        if (!imgRef.current || naturalSize.width === 0) return null;

        const img = imgRef.current;

        // Step 1: Render oriented image on an offscreen canvas
        const srcCanvas = document.createElement('canvas');
        if (rotation % 360 === 0) {
            srcCanvas.width = naturalSize.width;
            srcCanvas.height = naturalSize.height;
            const ctx = srcCanvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
        } else {
            const rad = (rotation * Math.PI) / 180;
            if (rotation === 90 || rotation === 270) {
                srcCanvas.width = naturalSize.height;
                srcCanvas.height = naturalSize.width;
            } else {
                srcCanvas.width = naturalSize.width;
                srcCanvas.height = naturalSize.height;
            }
            const ctx = srcCanvas.getContext('2d')!;
            ctx.translate(srcCanvas.width / 2, srcCanvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2);
        }

        // Step 2: Calculate crop coordinates on the source canvas
        const cropX = Math.max(0, -safePanX / activeScale);
        const cropY = Math.max(0, -safePanY / activeScale);
        const cropW = frameW / activeScale;
        const cropH = frameH / activeScale;

        // Step 3: Target canvas with ultra-sharp resolution
        const exportCanvas = document.createElement('canvas');
        const minTargetDimension = 1200;
        const multiplier = Math.max(1, minTargetDimension / Math.min(cropW, cropH));
        exportCanvas.width = Math.round(cropW * multiplier);
        exportCanvas.height = Math.round(cropH * multiplier);

        const exportCtx = exportCanvas.getContext('2d')!;
        exportCtx.imageSmoothingEnabled = true;
        exportCtx.imageSmoothingQuality = 'high';

        exportCtx.drawImage(
            srcCanvas,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            exportCanvas.width,
            exportCanvas.height
        );

        const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
        const rawBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        return { dataUrl, base64: rawBase64 };
    };

    // Apply crop to current view and update parent gallery
    const handleApplyCrop = () => {
        setIsApplying(true);
        try {
            const result = generateCroppedData();
            if (result) {
                setCurrentBase64(result.base64);
                if (onUpdateImage) {
                    onUpdateImage(result.base64, index);
                }
                setViewMode('preview');
                setDownloadStatus({
                    message: '✓ Đã căn cắt và cập nhật ảnh thẻ thành công!',
                    success: true
                });
                setTimeout(() => setDownloadStatus(null), 3000);
            }
        } catch (err) {
            console.error('Crop Apply Error:', err);
            setDownloadStatus({
                message: 'Lỗi khi cắt ảnh. Vui lòng thử lại!',
                success: false
            });
        } finally {
            setIsApplying(false);
        }
    };

    // Crop and immediately download
    const handleCropAndDownload = async () => {
        setIsDownloading(true);
        try {
            const result = generateCroppedData();
            if (result) {
                setCurrentBase64(result.base64);
                if (onUpdateImage) {
                    onUpdateImage(result.base64, index);
                }
                const filename = `anh_the_${selectedRatio.id.replace(':', 'x')}_${index + 1}.png`;
                const dlResult = await downloadImage(result.base64, filename);
                setDownloadStatus({
                    message: dlResult.success ? `✓ Đã tải ảnh cắt (${selectedRatio.label}) về máy!` : dlResult.message,
                    success: dlResult.success
                });
                setViewMode('preview');
                setTimeout(() => setDownloadStatus(null), 3500);
            }
        } catch (err) {
            console.error('Crop & Download Error:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    // Standard download of current image
    const handleDownloadCurrent = async () => {
        setIsDownloading(true);
        setDownloadStatus(null);
        const result = await downloadImage(currentBase64, `anh_the_${index + 1}.png`);
        setDownloadStatus({
            message: result.message,
            success: result.success
        });
        setIsDownloading(false);
        if (result.success) {
            setTimeout(() => setDownloadStatus(null), 3000);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in p-3 sm:p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-4xl h-full flex flex-col justify-center items-center gap-3"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Toast Notification */}
                {downloadStatus && (
                    <div
                        className={`fixed top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-xl z-[120] animate-fade-in flex items-center gap-2 ${
                            downloadStatus.success ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                    >
                        <span>{downloadStatus.message}</span>
                    </div>
                )}

                {/* Close Top Right X Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/25 text-white rounded-full h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center text-xl transition-all z-20 cursor-pointer shadow-lg"
                    title="Đóng cửa sổ"
                    aria-label="Close"
                >
                    &times;
                </button>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* MODE 1: STANDARD PREVIEW VIEW */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {viewMode === 'preview' && (
                    <div className="flex flex-col items-center justify-center gap-4 w-full animate-fade-in">
                        {/* Image Frame */}
                        <div className="relative w-auto h-auto max-h-[68vh] max-w-full rounded-2xl shadow-2xl overflow-hidden bg-slate-900 border border-white/10 ring-1 ring-white/5">
                            <img
                                src={imageSrc}
                                alt="Full preview"
                                className="block max-h-[68vh] w-auto h-auto object-contain select-none"
                            />
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-center mt-1">
                            {/* Căn cắt ảnh Button */}
                            <button
                                onClick={() => {
                                    handleResetCenter();
                                    setViewMode('crop');
                                }}
                                className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-sm rounded-full transition-all shadow-lg shadow-indigo-600/25 min-h-[44px] cursor-pointer"
                                title="Mở công cụ căn chỉnh tỉ lệ và cắt ảnh thẻ"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.097l.951.238a.75.75 0 01.558.91l-.238.951a4.5 4.5 0 01-1.379 2.068l-5.325 1.628a4.323 4.323 0 01-2.48.097l-.951-.238a.75.75 0 01-.558-.91l.238-.951z" />
                                </svg>
                                <span>Cắt ảnh tùy chỉnh</span>
                            </button>

                            {/* Tải xuống Button */}
                            <button
                                onClick={handleDownloadCurrent}
                                disabled={isDownloading}
                                className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-95 text-white font-semibold text-sm rounded-full transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50 min-h-[44px] cursor-pointer"
                            >
                                {isDownloading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Đang tải...</span>
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-4 h-4" />
                                        <span>Tải xuống</span>
                                    </>
                                )}
                            </button>

                            {/* Đóng Button */}
                            <button
                                onClick={onClose}
                                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-sm rounded-full transition-all border border-slate-700 min-h-[44px] cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* MODE 2: INTERACTIVE CUSTOM CROP STUDIO */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {viewMode === 'crop' && (
                    <div className="w-full max-w-2xl bg-slate-900/95 border border-white/15 rounded-3xl p-3 sm:p-5 shadow-2xl flex flex-col items-center gap-3 animate-fade-in">
                        {/* Header: Ratio Selector & Guideline Toggle */}
                        <div className="w-full flex items-center justify-between gap-2 flex-wrap border-b border-white/10 pb-3">
                            {/* Ratios Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Tỉ lệ:</span>
                                {CROP_RATIOS.map(ratio => {
                                    const isSel = selectedRatio.id === ratio.id;
                                    return (
                                        <button
                                            key={ratio.id}
                                            type="button"
                                            onClick={() => setSelectedRatio(ratio)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[36px] cursor-pointer ${
                                                isSel
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/5'
                                            }`}
                                            title={`${ratio.label} (${ratio.subLabel})`}
                                        >
                                            <span>{ratio.label}</span>
                                            <span className="text-[10px] opacity-75 ml-1 hidden md:inline">({ratio.subLabel})</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Guideline Toggle Button */}
                            <button
                                type="button"
                                onClick={() => setShowGuidelines(!showGuidelines)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 min-h-[36px] cursor-pointer ${
                                    showGuidelines
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-white/5'
                                }`}
                                title="Bật/Tắt vạch căn ảnh thẻ chuẩn quốc tế"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                </svg>
                                <span>{showGuidelines ? 'Vạch căn: BẬT' : 'Vạch căn: TẮT'}</span>
                            </button>
                        </div>

                        {/* Interactive Crop Viewport */}
                        <div
                            ref={viewportRef}
                            onWheel={handleWheel}
                            className="relative flex items-center justify-center overflow-hidden bg-slate-950/80 rounded-2xl border border-white/10 select-none"
                            style={{ width: '100%', height: viewportSize.height }}
                        >
                            {/* Backdrop Mask */}
                            <div className="absolute inset-0 bg-black/60 pointer-events-none z-10" />

                            {/* Fixed Aspect Ratio Frame */}
                            <div
                                onMouseDown={handleMouseDown}
                                onTouchStart={handleTouchStart}
                                className="relative rounded-lg shadow-2xl overflow-hidden z-20 cursor-grab active:cursor-grabbing border-2 border-cyan-400/90 ring-4 ring-cyan-500/15"
                                style={{ width: frameW, height: frameH }}
                            >
                                {/* Rendered Transform Layer */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        width: effW,
                                        height: effH,
                                        transformOrigin: '0 0',
                                        transform: `translate3d(${safePanX}px, ${safePanY}px, 0) scale(${activeScale})`,
                                        userSelect: 'none',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <img
                                        src={imageSrc}
                                        alt="Target"
                                        draggable={false}
                                        style={{
                                            width: naturalSize.width,
                                            height: naturalSize.height,
                                            maxWidth: 'none',
                                            maxHeight: 'none',
                                            transformOrigin: 'center center',
                                            transform: isSideways
                                                ? `translate(${(effW - naturalSize.width) / 2}px, ${(effH - naturalSize.height) / 2}px) rotate(${rotation}deg)`
                                                : rotation !== 0
                                                ? `rotate(${rotation}deg)`
                                                : 'none'
                                        }}
                                    />
                                </div>

                                {/* Studio ID Photo Alignment Guidelines */}
                                {showGuidelines && (
                                    <div className="absolute inset-0 pointer-events-none z-30">
                                        {/* Center Vertical Axis */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-cyan-400/40 -translate-x-1/2" />

                                        {/* Crown / Top of Head Line (~18%) */}
                                        <div className="absolute top-[18%] left-2 right-2 border-t border-dashed border-cyan-400/80 flex items-center justify-end">
                                            <span className="text-[9px] font-bold text-cyan-200 bg-slate-900/90 px-1 rounded -mt-2 shadow-xs">
                                                Đỉnh đầu
                                            </span>
                                        </div>

                                        {/* Eye Level Line (~42%) */}
                                        <div className="absolute top-[42%] left-2 right-2 border-t border-dashed border-amber-400/80 flex items-center justify-end">
                                            <span className="text-[9px] font-bold text-amber-200 bg-slate-900/90 px-1 rounded -mt-2 shadow-xs">
                                                Tầm mắt
                                            </span>
                                        </div>

                                        {/* Chin / Shoulder Line (~75%) */}
                                        <div className="absolute top-[75%] left-2 right-2 border-t border-dashed border-emerald-400/80 flex items-center justify-end">
                                            <span className="text-[9px] font-bold text-emerald-200 bg-slate-900/90 px-1 rounded -mt-2 shadow-xs">
                                                Cằm / Vai
                                            </span>
                                        </div>

                                        {/* Face Oval Silhouette */}
                                        <div className="absolute top-[18%] bottom-[25%] left-[20%] right-[20%] border border-dashed border-cyan-400/30 rounded-[50%]" />
                                    </div>
                                )}

                                {/* Corner Viewfinder Markers */}
                                <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-300 pointer-events-none z-30" />
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-300 pointer-events-none z-30" />
                                <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-300 pointer-events-none z-30" />
                                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-300 pointer-events-none z-30" />
                            </div>

                            {/* Hint overlay */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] text-slate-300 pointer-events-none">
                                Kéo ảnh để căn vị trí • Cuộn chuột hoặc thanh trượt để phóng to
                            </div>
                        </div>

                        {/* Controls Toolbar: Zoom, Rotate & Center */}
                        <div className="w-full flex items-center justify-between gap-3 flex-wrap bg-slate-800/60 p-2.5 rounded-2xl border border-white/5">
                            {/* Zoom Controls */}
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                <span className="text-xs text-slate-400 font-medium">Zoom:</span>
                                <button
                                    type="button"
                                    onClick={() => setZoom(prev => Math.max(1.0, Number((prev - 0.1).toFixed(2))))}
                                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-sm cursor-pointer"
                                    title="Thu nhỏ"
                                >
                                    -
                                </button>
                                <input
                                    type="range"
                                    min="1.0"
                                    max="3.0"
                                    step="0.05"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                />
                                <button
                                    type="button"
                                    onClick={() => setZoom(prev => Math.min(3.0, Number((prev + 0.1).toFixed(2))))}
                                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-sm cursor-pointer"
                                    title="Phóng to"
                                >
                                    +
                                </button>
                                <span className="text-xs font-mono font-semibold text-indigo-400 min-w-[42px] text-right">
                                    {Math.round(zoom * 100)}%
                                </span>
                            </div>

                            {/* Extra tools: Rotate & Reset */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
                                    title="Xoay 90 độ"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                    <span>Xoay</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetCenter}
                                    className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
                                    title="Đặt lại vị trí giữa và zoom gốc"
                                >
                                    <span>↺ Đặt lại</span>
                                </button>
                            </div>
                        </div>

                        {/* Bottom Actions: Cancel, Apply Crop & Crop+Download */}
                        <div className="w-full flex items-center justify-end gap-2.5 flex-wrap pt-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('preview')}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm transition-all border border-slate-700 min-h-[44px] cursor-pointer"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="button"
                                onClick={handleApplyCrop}
                                disabled={isApplying}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                            >
                                {isApplying ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Đang cắt...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                        <span>Áp dụng cắt</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleCropAndDownload}
                                disabled={isDownloading}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-95 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                            >
                                {isDownloading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Đang tải...</span>
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-4 h-4" />
                                        <span>Cắt & Tải về</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
