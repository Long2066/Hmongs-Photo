import React, { useState, useMemo, useRef } from 'react';

export interface A4PrintPreviewProps {
    images: string[]; // base64 images
    onClose: () => void;
    initialSizeId?: string; // '3x4' | '4x6' | '2x3' | '3.5x4.5' | '5x5'
    initialPaperId?: PaperSizeId;
}

export type PaperSizeId = 'A4' | 'A5' | 'A6' | 'A7';
export type Orientation = 'portrait' | 'landscape';
export type CutLineStyle = 'hairline' | 'corner' | 'dashed' | 'none';

export interface PaperFormat {
    id: PaperSizeId;
    name: string;
    widthMm: number;
    heightMm: number;
    description: string;
    badge: string;
}

export const PAPER_FORMATS: PaperFormat[] = [
    { id: 'A4', name: 'Khổ A4', widthMm: 210, heightMm: 297, description: '210 × 297 mm', badge: 'Chuẩn Lab / Văn phòng' },
    { id: 'A5', name: 'Khổ A5', widthMm: 148, heightMm: 210, description: '148 × 210 mm', badge: 'Nửa tờ A4' },
    { id: 'A6', name: 'Khổ A6 (10×15 cm)', widthMm: 105, heightMm: 148, description: '105 × 148 mm', badge: 'Giấy ảnh Canon Selphy / Epson' },
    { id: 'A7', name: 'Khổ A7', widthMm: 74, heightMm: 105, description: '74 × 105 mm', badge: 'Khổ mini bỏ ví' },
];

export interface IdPhotoDimension {
    id: string;
    name: string;
    widthMm: number;
    heightMm: number;
    description: string;
}

export const ID_PHOTO_DIMENSIONS: IdPhotoDimension[] = [
    { id: '3x4', name: '3 × 4 cm', widthMm: 30, heightMm: 40, description: 'CCCD, Bằng lái, Hồ sơ xin việc' },
    { id: '4x6', name: '4 × 6 cm', widthMm: 40, heightMm: 60, description: 'Hộ chiếu Passport, Visa chuẩn' },
    { id: '2x3', name: '2 × 3 cm', widthMm: 20, heightMm: 30, description: 'Thẻ học sinh, sinh viên, y tế' },
    { id: '3.5x4.5', name: '3.5 × 4.5 cm', widthMm: 35, heightMm: 45, description: 'Visa Châu Âu / Schengen, Nhật, Hàn' },
    { id: '5x5', name: '5 × 5 cm (2×2")', widthMm: 50, heightMm: 50, description: 'Visa Mỹ / US, Quốc tế' },
];

interface SelectedImageConfig {
    selected: boolean;
    copies: number;
    sizeId: string;
}

const getImageSrc = (b64: string): string => {
    if (b64.startsWith('data:')) return b64;
    const isPng = b64.startsWith('iVBORw0KGgo');
    return `data:image/${isPng ? 'png' : 'jpeg'};base64,${b64}`;
};

export const A4PrintPreview: React.FC<A4PrintPreviewProps> = ({
    images,
    onClose,
    initialSizeId,
    initialPaperId
}) => {
    // 1. Paper Format & Orientation
    const [paperId, setPaperId] = useState<PaperSizeId>(initialPaperId || 'A4');
    const [orientation, setOrientation] = useState<Orientation>('portrait');

    // 2. Global Size & Options
    const [globalSizeId, setGlobalSizeId] = useState<string>(initialSizeId || '3x4');
    const [cutLineStyle, setCutLineStyle] = useState<CutLineStyle>('hairline');
    const [marginMm, setMarginMm] = useState<number>(5);
    const [gapMm, setGapMm] = useState<number>(2);

    // 3. Image Selection & Copies state per image
    const [imageConfigs, setImageConfigs] = useState<Record<number, SelectedImageConfig>>(() => {
        const initial: Record<number, SelectedImageConfig> = {};
        images.forEach((_, idx) => {
            initial[idx] = {
                selected: true,
                copies: 4, // Mặc định 4 bản mỗi ảnh
                sizeId: initialSizeId || '3x4'
            };
        });
        return initial;
    });

    const [isPrinting, setIsPrinting] = useState(false);
    const sheetContainerRef = useRef<HTMLDivElement>(null);

    // Active paper dimensions (accounting for orientation)
    const currentPaper = useMemo(() => {
        const p = PAPER_FORMATS.find(item => item.id === paperId) || PAPER_FORMATS[0];
        const w = orientation === 'portrait' ? p.widthMm : p.heightMm;
        const h = orientation === 'portrait' ? p.heightMm : p.widthMm;
        return { ...p, currentWidthMm: w, currentHeightMm: h };
    }, [paperId, orientation]);

    // Active photo dimension helper
    const getDimension = (sizeId: string): IdPhotoDimension => {
        return ID_PHOTO_DIMENSIONS.find(d => d.id === sizeId) || ID_PHOTO_DIMENSIONS[0];
    };

    // Flattened array of images to display on the sheet
    const sheetPhotos = useMemo(() => {
        const list: Array<{
            imageIndex: number;
            base64: string;
            size: IdPhotoDimension;
        }> = [];

        images.forEach((imgBase64, idx) => {
            const cfg = imageConfigs[idx];
            if (cfg && cfg.selected && cfg.copies > 0) {
                const dim = getDimension(cfg.sizeId || globalSizeId);
                for (let i = 0; i < cfg.copies; i++) {
                    list.push({
                        imageIndex: idx,
                        base64: imgBase64,
                        size: dim
                    });
                }
            }
        });

        return list;
    }, [images, imageConfigs, globalSizeId]);

    // Calculate maximum photos that can fit on this paper size
    const maxCapacity = useMemo(() => {
        const dim = getDimension(globalSizeId);
        const availW = currentPaper.currentWidthMm - 2 * marginMm;
        const availH = currentPaper.currentHeightMm - 2 * marginMm;
        if (availW <= 0 || availH <= 0) return 0;

        const cols = Math.floor((availW + gapMm) / (dim.widthMm + gapMm));
        const rows = Math.floor((availH + gapMm) / (dim.heightMm + gapMm));
        return Math.max(0, cols * rows);
    }, [currentPaper, marginMm, gapMm, globalSizeId]);

    // Toggle select all images
    const handleToggleSelectAll = (select: boolean) => {
        setImageConfigs(prev => {
            const next = { ...prev };
            images.forEach((_, idx) => {
                next[idx] = {
                    ...next[idx],
                    selected: select
                };
            });
            return next;
        });
    };

    // Change global size and apply to all selected
    const handleGlobalSizeChange = (newSizeId: string) => {
        setGlobalSizeId(newSizeId);
        setImageConfigs(prev => {
            const next = { ...prev };
            images.forEach((_, idx) => {
                next[idx] = {
                    ...next[idx],
                    sizeId: newSizeId
                };
            });
            return next;
        });
    };

    // Auto-fill sheet evenly among selected images
    const handleAutoFillSheet = () => {
        const selectedIndices = images
            .map((_, idx) => idx)
            .filter(idx => imageConfigs[idx]?.selected);

        if (selectedIndices.length === 0 || maxCapacity <= 0) return;

        const baseCopies = Math.floor(maxCapacity / selectedIndices.length);
        const remainder = maxCapacity % selectedIndices.length;

        setImageConfigs(prev => {
            const next = { ...prev };
            selectedIndices.forEach((idx, i) => {
                next[idx] = {
                    ...next[idx],
                    copies: baseCopies + (i < remainder ? 1 : 0),
                    sizeId: globalSizeId
                };
            });
            return next;
        });
    };

    // Update individual image copies
    const updateCopies = (idx: number, delta: number) => {
        setImageConfigs(prev => {
            const current = prev[idx]?.copies || 0;
            const updated = Math.max(0, current + delta);
            return {
                ...prev,
                [idx]: {
                    ...prev[idx],
                    copies: updated,
                    selected: updated > 0 ? true : prev[idx].selected
                }
            };
        });
    };

    // Reset copies to 0
    const handleClearAll = () => {
        setImageConfigs(prev => {
            const next = { ...prev };
            images.forEach((_, idx) => {
                next[idx] = { ...next[idx], copies: 0 };
            });
            return next;
        });
    };

    // Professional Print Handler: Creates print-ready iframe with high-res styling
    const handlePrint = () => {
        if (sheetPhotos.length === 0) {
            alert('Vui lòng chọn ít nhất 1 ảnh thẻ để in!');
            return;
        }

        setIsPrinting(true);

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.title = 'In Ảnh Thẻ Chuyên Nghiệp';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            setIsPrinting(false);
            return;
        }

        const borderCss = cutLineStyle === 'hairline'
            ? 'border: 0.2mm solid #cbd5e1;'
            : cutLineStyle === 'dashed'
                ? 'border: 0.3mm dashed #94a3b8;'
                : cutLineStyle === 'corner'
                    ? 'box-shadow: 0 0 0 0.2mm #cbd5e1;'
                    : 'border: none;';

        const printHtml = `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="utf-8">
                <title>In Ảnh Thẻ - ImageTool Studio (${paperId})</title>
                <style>
                    @page {
                        size: ${paperId} ${orientation};
                        margin: 0;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        width: ${currentPaper.currentWidthMm}mm;
                        min-height: ${currentPaper.currentHeightMm}mm;
                        background: #ffffff;
                        padding: ${marginMm}mm;
                        display: block;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .sheet-grid {
                        display: flex;
                        flex-wrap: wrap;
                        align-content: flex-start;
                        gap: ${gapMm}mm;
                        width: 100%;
                    }
                    .photo-card {
                        display: inline-block;
                        position: relative;
                        background: #ffffff;
                        overflow: hidden;
                        ${borderCss}
                        page-break-inside: avoid;
                    }
                    .photo-card img {
                        display: block;
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        image-rendering: -webkit-optimize-contrast;
                        image-rendering: high-quality;
                    }
                    ${cutLineStyle === 'corner' ? `
                    .photo-card::before, .photo-card::after {
                        content: '';
                        position: absolute;
                        width: 2mm;
                        height: 2mm;
                        pointer-events: none;
                        border-color: #64748b;
                        border-style: solid;
                    }
                    .photo-card::before {
                        top: 0; left: 0;
                        border-width: 0.3mm 0 0 0.3mm;
                    }
                    .photo-card::after {
                        bottom: 0; right: 0;
                        border-width: 0 0.3mm 0.3mm 0;
                    }
                    ` : ''}
                </style>
            </head>
            <body>
                <div class="sheet-grid">
                    ${sheetPhotos.map(item => `
                        <div class="photo-card" style="width: ${item.size.widthMm}mm; height: ${item.size.heightMm}mm;">
                            <img src="${getImageSrc(item.base64)}" alt="ID Photo" />
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `;

        doc.open();
        doc.write(printHtml);
        doc.close();

        iframe.contentWindow?.focus();
        setTimeout(() => {
            try {
                iframe.contentWindow?.print();
            } catch (err) {
                console.error('[Print] Print dialog failed:', err);
            } finally {
                setIsPrinting(false);
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 2000);
            }
        }, 600);
    };

    // Preview scale for the paper on screen
    // Fit comfortably in the right preview pane
    const previewScale = useMemo(() => {
        // Base: 1mm = ~3.78px on screen.
        // We scale so A4 (297mm) fits in ~520px height
        const maxPreviewHeightPx = 540;
        const scale = maxPreviewHeightPx / (currentPaper.currentHeightMm * 3.78);
        return Math.min(0.65, Math.max(0.4, scale));
    }, [currentPaper]);

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[150] flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[96vh] overflow-hidden flex flex-col border border-slate-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Studio In Ảnh Thẻ Chuyên Nghiệp</h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                    {paperId} · {orientation === 'portrait' ? 'Dọc' : 'Ngang'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">Tự động dàn trang A4/A5/A6/A7, chọn số lượng, đường cắt chuẩn tiệm ảnh & in trực tiếp</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                        title="Đóng cửa sổ"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body: Split 2 columns (Settings & Live Preview) */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                    {/* LEFT COLUMN: Controls & Settings (5 cols) */}
                    <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar bg-slate-50/60">

                        {/* SECTION 1: Paper Format & Orientation */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span>📄</span> 1. Chọn Khổ Giấy In
                                </span>
                                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('portrait')}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${orientation === 'portrait' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Dọc
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('landscape')}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${orientation === 'landscape' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Ngang
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {PAPER_FORMATS.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setPaperId(item.id)}
                                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                                            paperId === item.id
                                                ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold ${paperId === item.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                {item.name}
                                            </span>
                                            {paperId === item.id && (
                                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                            )}
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{item.description}</div>
                                        <div className="text-[10px] text-slate-400 truncate mt-1">{item.badge}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SECTION 2: Photo Size & Selection */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span>✂️</span> 2. Kích Thước Ảnh Thẻ
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                    Đang chứa: <strong>{sheetPhotos.length}</strong> / tối đa ~<strong>{maxCapacity}</strong>
                                </span>
                            </div>

                            {/* Standard Dimensions Dropdown/Pills */}
                            <div className="grid grid-cols-3 gap-1.5 mb-3">
                                {ID_PHOTO_DIMENSIONS.map(dim => (
                                    <button
                                        key={dim.id}
                                        type="button"
                                        onClick={() => handleGlobalSizeChange(dim.id)}
                                        className={`p-2 rounded-lg border text-center transition-all ${
                                            globalSizeId === dim.id
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-1 ring-emerald-300'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium'
                                        }`}
                                        title={dim.description}
                                    >
                                        <div className="text-xs">{dim.name}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Batch Action Buttons */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleAutoFillSheet}
                                    className="flex-1 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                                    title="Tự động xếp số lượng tối đa kín tờ giấy đã chọn"
                                >
                                    <span>⚡</span> Xếp Kín Trang ({maxCapacity} ảnh)
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClearAll}
                                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                                    title="Xóa hết để chọn lại từ đầu"
                                >
                                    Xóa hết
                                </button>
                            </div>
                        </div>

                        {/* SECTION 3: Individual Photo Selection & Copy Counts */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span>📸</span> 3. Chọn Ảnh & Số Bản In
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleSelectAll(true)}
                                        className="text-[11px] text-indigo-600 hover:underline font-semibold"
                                    >
                                        Chọn tất cả
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleSelectAll(false)}
                                        className="text-[11px] text-slate-500 hover:underline font-semibold"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>

                            {/* Image Grid with Checkboxes and Stepper */}
                            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto custom-scrollbar p-1">
                                {images.map((imgBase64, idx) => {
                                    const cfg = imageConfigs[idx] || { selected: true, copies: 4, sizeId: globalSizeId };
                                    return (
                                        <div
                                            key={idx}
                                            className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                                                cfg.selected && cfg.copies > 0
                                                    ? 'bg-slate-50/80 border-indigo-300 ring-1 ring-indigo-200'
                                                    : 'bg-white border-slate-200 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cfg.selected}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setImageConfigs(prev => ({
                                                            ...prev,
                                                            [idx]: {
                                                                ...prev[idx],
                                                                selected: checked,
                                                                copies: checked && (prev[idx]?.copies || 0) === 0 ? 4 : prev[idx]?.copies || 0
                                                            }
                                                        }));
                                                    }}
                                                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <div className="relative w-14 h-18 rounded-lg overflow-hidden bg-slate-200 border border-slate-200 flex-shrink-0">
                                                    <img
                                                        src={getImageSrc(imgBase64)}
                                                        alt={`Ảnh ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded font-bold">
                                                        #{idx + 1}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-800">Ảnh thẻ {idx + 1}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                        {getDimension(cfg.sizeId || globalSizeId).name}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quantity Stepper */}
                                            <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-200">
                                                <span className="text-[11px] font-semibold text-slate-600">Số lượng:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCopies(idx, -1)}
                                                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-6 text-center font-mono font-bold text-xs text-slate-900 tabular-nums">
                                                        {cfg.copies}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCopies(idx, 1)}
                                                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SECTION 4: Professional Cutting & Spacing Options */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                                <span>📐</span> 4. Tùy Chọn Cắt & Căn Lề
                            </span>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đường cắt ảnh:</label>
                                    <select
                                        value={cutLineStyle}
                                        onChange={(e) => setCutLineStyle(e.target.value as CutLineStyle)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                                    >
                                        <option value="hairline">Viền mảnh (Dễ cắt kéo/dao)</option>
                                        <option value="corner">Dấu chữ thập ở 4 góc</option>
                                        <option value="dashed">Nét đứt mờ</option>
                                        <option value="none">Không viền (Tràn ảnh)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Khoảng cách ảnh:</label>
                                    <select
                                        value={gapMm}
                                        onChange={(e) => setGapMm(Number(e.target.value))}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                                    >
                                        <option value={1}>1 mm (Khít nhất)</option>
                                        <option value={2}>2 mm (Chuẩn Studio)</option>
                                        <option value={3}>3 mm (Thoải mái)</option>
                                        <option value={5}>5 mm (Rộng rãi)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Live Interactive Paper Preview (7 cols) */}
                    <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col items-center justify-between bg-slate-100/70 overflow-y-auto custom-scrollbar">

                        {/* Preview Top Header info */}
                        <div className="w-full flex items-center justify-between mb-3 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">Khung xem trước trang in:</span>
                                <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono font-semibold">
                                    {currentPaper.currentWidthMm} × {currentPaper.currentHeightMm} mm
                                </span>
                            </div>
                            <span className="text-slate-500 italic">
                                * Hiển thị tỉ lệ chuẩn thực tế 100%
                            </span>
                        </div>

                        {/* SHEET PREVIEW CONTAINER */}
                        <div className="flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
                            <div
                                ref={sheetContainerRef}
                                className="bg-white shadow-2xl rounded-sm border border-slate-300 relative transition-all duration-200"
                                style={{
                                    width: `${currentPaper.currentWidthMm * 3.78 * previewScale}px`,
                                    minHeight: `${currentPaper.currentHeightMm * 3.78 * previewScale}px`,
                                    padding: `${marginMm * 3.78 * previewScale}px`,
                                    boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                                }}
                            >
                                {/* Sheet Grid of Photos */}
                                <div
                                    className="flex flex-wrap content-start w-full h-full"
                                    style={{
                                        gap: `${gapMm * 3.78 * previewScale}px`
                                    }}
                                >
                                    {sheetPhotos.map((item, idx) => {
                                        const cardW = item.size.widthMm * 3.78 * previewScale;
                                        const cardH = item.size.heightMm * 3.78 * previewScale;

                                        return (
                                            <div
                                                key={idx}
                                                className={`relative group bg-slate-100 overflow-hidden transition-all ${
                                                    cutLineStyle === 'hairline'
                                                        ? 'border border-slate-300'
                                                        : cutLineStyle === 'dashed'
                                                            ? 'border border-dashed border-slate-400'
                                                            : 'border-0'
                                                }`}
                                                style={{
                                                    width: `${cardW}px`,
                                                    height: `${cardH}px`
                                                }}
                                                title={`Ảnh thẻ ${item.size.name} - Click để bớt 1 bản in`}
                                                onClick={() => updateCopies(item.imageIndex, -1)}
                                            >
                                                <img
                                                    src={getImageSrc(item.base64)}
                                                    alt={`Photo ${idx + 1}`}
                                                    className="w-full h-full object-cover select-none pointer-events-none"
                                                />

                                                {/* Corner Marks overlay if selected */}
                                                {cutLineStyle === 'corner' && (
                                                    <>
                                                        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-600 pointer-events-none"></div>
                                                        <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-600 pointer-events-none"></div>
                                                        <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-600 pointer-events-none"></div>
                                                        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-600 pointer-events-none"></div>
                                                    </>
                                                )}

                                                {/* Hover Delete Action Overlay */}
                                                <div className="absolute inset-0 bg-red-600/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[10px] font-bold">
                                                    <span>Xóa 1</span>
                                                </div>

                                                {/* Small badge dimension */}
                                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center font-mono py-0.2 opacity-0 group-hover:opacity-100">
                                                    {item.size.name}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Empty State when no photos selected */}
                                    {sheetPhotos.length === 0 && (
                                        <div className="w-full py-20 flex flex-col items-center justify-center text-slate-400">
                                            <svg className="w-16 h-16 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-sm font-semibold text-slate-600">Trang in đang trống</p>
                                            <p className="text-xs text-slate-400 mt-1">Hãy tích chọn ảnh và tăng số lượng ở cột bên trái</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Studio Action Bar */}
                        <div className="w-full mt-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-slate-600 text-center sm:text-left">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>🖨️</span> Sẵn sàng in {sheetPhotos.length} ảnh thẻ lên tờ {paperId}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    Hộp thoại máy in sẽ mở để bạn chọn máy in (Canon, Epson...), khay giấy ảnh & in trực tiếp.
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors"
                                >
                                    Đóng
                                </button>

                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    disabled={sheetPhotos.length === 0 || isPrinting}
                                    className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPrinting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            <span>Đang chuẩn bị in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                            </svg>
                                            <span>TIẾN HÀNH IN / CHỌN MÁY IN</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default A4PrintPreview;
