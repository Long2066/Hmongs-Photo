import React, { useState, useRef } from 'react';

interface A4PrintPreviewProps {
    images: string[]; // base64 images
    onClose: () => void;
}

// ID photo sizes in cm
const PHOTO_SIZES = [
    { id: '2x3', label: '2x3 cm', width: 2, height: 3 },
    { id: '3x4', label: '3x4 cm', width: 3, height: 4 },
    { id: '4x6', label: '4x6 cm', width: 4, height: 6 },
];

// A4 dimensions in cm (210mm x 297mm)
const A4_WIDTH_CM = 21;
const A4_HEIGHT_CM = 29.7;

// Conversion: 1cm = 37.8px at 96dpi
const CM_TO_PX = 37.8;

interface CroppedImage {
    base64: string;
    sizeId: string;
    width: number;
    height: number;
}

export const A4PrintPreview: React.FC<A4PrintPreviewProps> = ({ images, onClose }) => {
    const [croppedImages, setCroppedImages] = useState<CroppedImage[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [selectedSize, setSelectedSize] = useState(PHOTO_SIZES[1]); // Default 3x4
    const printRef = useRef<HTMLDivElement>(null);

    // Add image with selected size to A4 sheet
    const addToSheet = (imageIndex: number, size: typeof PHOTO_SIZES[0]) => {
        const newImage: CroppedImage = {
            base64: images[imageIndex],
            sizeId: size.id,
            width: size.width,
            height: size.height,
        };
        setCroppedImages(prev => [...prev, newImage]);
        setSelectedImageIndex(null);
    };

    // Remove image from sheet
    const removeFromSheet = (index: number) => {
        setCroppedImages(prev => prev.filter((_, i) => i !== index));
    };

    // Print the A4 sheet
    const handlePrint = () => {
        if (!printRef.current) return;

        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>In Ảnh Thẻ - ImageTool</title>
                <style>
                    @page {
                        size: A4;
                        margin: 5mm;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        width: 210mm;
                        min-height: 297mm;
                        padding: 5mm;
                        background: white;
                    }
                    .print-container {
                        display: flex;
                        flex-wrap: wrap;
                        align-content: flex-start;
                        gap: 2mm;
                    }
                    .photo-item {
                        display: inline-block;
                        border: 0.5px solid #ccc;
                    }
                    .photo-item img {
                        display: block;
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    ${croppedImages.map(img => `
                        <div class="photo-item" style="width: ${img.width}cm; height: ${img.height}cm;">
                            <img src="data:image/png;base64,${img.base64}" alt="ID Photo" />
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    // Quick add all images with same size
    const addAllImages = (size: typeof PHOTO_SIZES[0]) => {
        const newImages: CroppedImage[] = images.map(img => ({
            base64: img,
            sizeId: size.id,
            width: size.width,
            height: size.height,
        }));
        setCroppedImages(prev => [...prev, ...newImages]);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">📄 Xem trước In Ảnh Thẻ A4</h2>
                        <p className="text-xs text-white/80">Thêm ảnh vào tờ A4 và in trực tiếp</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel - Source Images */}
                    <div className="w-1/3 border-r border-slate-200 p-4 overflow-y-auto bg-slate-50">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Ảnh gốc ({images.length})</h3>

                        {/* Quick add all */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            {PHOTO_SIZES.map(size => (
                                <button
                                    key={size.id}
                                    onClick={() => addAllImages(size)}
                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                                >
                                    + Tất cả {size.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative group">
                                    <img
                                        src={`data:image/png;base64,${img}`}
                                        alt={`Photo ${idx + 1}`}
                                        className="w-full aspect-[3/4] object-cover rounded-lg border-2 border-slate-200 cursor-pointer hover:border-indigo-500 transition-colors"
                                        onClick={() => setSelectedImageIndex(idx)}
                                    />
                                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                                        #{idx + 1}
                                    </div>

                                    {/* Size buttons on hover */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                                        {PHOTO_SIZES.map(size => (
                                            <button
                                                key={size.id}
                                                onClick={() => addToSheet(idx, size)}
                                                className="px-2 py-1 bg-white text-slate-800 text-[10px] font-bold rounded hover:bg-indigo-500 hover:text-white transition-colors"
                                            >
                                                {size.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel - A4 Preview */}
                    <div className="flex-1 p-4 overflow-y-auto bg-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-700">
                                Tờ A4 ({croppedImages.length} ảnh)
                            </h3>
                            <div className="flex gap-2">
                                {croppedImages.length > 0 && (
                                    <button
                                        onClick={() => setCroppedImages([])}
                                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        Xóa tất cả
                                    </button>
                                )}
                                <button
                                    onClick={handlePrint}
                                    disabled={croppedImages.length === 0}
                                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    IN A4
                                </button>
                            </div>
                        </div>

                        {/* A4 Paper Preview */}
                        <div
                            ref={printRef}
                            className="bg-white shadow-xl rounded-lg mx-auto border border-slate-300"
                            style={{
                                width: `${A4_WIDTH_CM * CM_TO_PX * 0.4}px`,
                                minHeight: `${A4_HEIGHT_CM * CM_TO_PX * 0.4}px`,
                                padding: '8px',
                            }}
                        >
                            <div className="flex flex-wrap gap-1 content-start">
                                {croppedImages.map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group border border-slate-300 overflow-hidden cursor-pointer hover:border-red-400 transition-colors"
                                        style={{
                                            width: `${img.width * CM_TO_PX * 0.4}px`,
                                            height: `${img.height * CM_TO_PX * 0.4}px`,
                                        }}
                                        onClick={() => removeFromSheet(idx)}
                                    >
                                        <img
                                            src={`data:image/png;base64,${img.base64}`}
                                            alt={`Print ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-red-500/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-bold">
                                            {img.width}x{img.height}
                                        </div>
                                    </div>
                                ))}

                                {croppedImages.length === 0 && (
                                    <div className="w-full h-48 flex flex-col items-center justify-center text-slate-400">
                                        <svg className="w-12 h-12 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-xs font-medium">Click vào ảnh bên trái để thêm vào đây</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="mt-4 bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                            <p className="text-xs text-indigo-700 font-medium">
                                💡 <strong>Hướng dẫn:</strong> Click vào ảnh để chọn kích cỡ và thêm vào A4. Click vào ảnh trên A4 để xóa. Bấm "IN A4" để in.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
