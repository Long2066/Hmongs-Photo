import React, { useState } from 'react';
import { downloadImage } from '../services/downloadService';
import { POSTER_TEMPLATES } from '../services/posterRenderService';

interface PosterWorkspaceProps {
    outputImages: (string | null)[];
    prompts: string[];
    isLoading: boolean;
    loadingStatus: string;
    error: string | null;
    onImageClick: (url: string, index: number) => void;
    onDismissError?: () => void;
    onQuickPickTemplate?: (templateId: string) => void;
    hasInputImages: boolean;
}

export const PosterWorkspace: React.FC<PosterWorkspaceProps> = ({
    outputImages,
    prompts,
    isLoading,
    loadingStatus,
    error,
    onImageClick,
    onDismissError,
    onQuickPickTemplate,
    hasInputImages
}) => {
    const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const validImages = outputImages.filter((img): img is string => img !== null);
    const hasOutputs = validImages.length > 0;

    const handleDownload = async (url: string, index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setDownloadingIdx(index);
        try {
            const promptTitle = prompts[index] || `poster_studio_${index + 1}`;
            const safeName = `${promptTitle.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase()}.png`;
            await downloadImage(url, safeName);
        } catch (err) {
            console.error('Download error:', err);
        } finally {
            setDownloadingIdx(null);
        }
    };

    const handleCopy = async (url: string, index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            if (navigator.clipboard && (window as any).ClipboardItem) {
                await navigator.clipboard.write([
                    new (window as any).ClipboardItem({ [blob.type]: blob })
                ]);
                setCopiedIdx(index);
                setTimeout(() => setCopiedIdx(null), 2500);
            }
        } catch (err) {
            console.warn('Copy failed, downloading instead:', err);
        }
    };

    const [workspaceCategory, setWorkspaceCategory] = useState<'ky_yeu' | 'phim_anh'>('ky_yeu');
    const filteredTemplates = POSTER_TEMPLATES.filter(t => t.category === workspaceCategory);

    // =========================================================================
    // Empty State: Interactive Guide & Template Showcase
    // =========================================================================
    if (!isLoading && !hasOutputs) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in text-center max-w-4xl mx-auto w-full">
                {/* Error Banner */}
                {error && (
                    <div
                        role="alert"
                        className="w-full mb-6 rounded-2xl bg-white p-4 text-xs sm:text-sm font-semibold text-rose-700 ring-1 ring-rose-200 shadow-sm flex items-center justify-between gap-3 animate-fade-in"
                    >
                        <div className="flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                        {onDismissError && (
                            <button
                                type="button"
                                onClick={onDismissError}
                                className="px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                                Đóng
                            </button>
                        )}
                    </div>
                )}

                {/* Hero Icon Badge */}
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-violet-500/25 mb-4">
                    🖼️
                </div>

                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    Ghép Poster & Catalog Studio (Kỷ Yếu & Phim Ảnh)
                </h2>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 max-w-xl mx-auto">
                    Biến 1–10 ảnh chụp thành các tấm poster kỷ yếu, poster phim lãng mạn, K-Drama và bìa tạp chí chỉ trong <strong className="text-slate-900 font-semibold">0.3 giây</strong>. Tự động căn khung khuôn mặt bằng AI, không cắt mất đầu.
                </p>

                {/* 3 Simple Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-6 text-left">
                    <div className="p-3.5 rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-xs">
                        <span className="w-6 h-6 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs flex items-center justify-center font-mono mb-2">
                            1
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">Tải 1–10 ảnh</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            Kéo thả ảnh kỷ yếu/couple vào khung tải ảnh bên trái (hỗ trợ tối đa 10 ảnh).
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-xs">
                        <span className="w-6 h-6 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs flex items-center justify-center font-mono mb-2">
                            2
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">Chọn chủ đề & mẫu</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            Phân rõ 2 chủ đề: Kỷ yếu học đường (15 mẫu) hoặc Poster phim ảnh điện ảnh (7 mẫu).
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-xs">
                        <span className="w-6 h-6 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs flex items-center justify-center font-mono mb-2">
                            3
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">Xuất ảnh 2K</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            Bấm nút Xuất Poster Studio để nhận ảnh nét căng kèm thông tin thương hiệu của bạn.
                        </p>
                    </div>
                </div>

                {/* Category Switcher for Quick Badges */}
                <div className="mt-6 flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setWorkspaceCategory('ky_yeu')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            workspaceCategory === 'ky_yeu' ? 'bg-white text-violet-700 shadow-2xs' : 'text-slate-600'
                        }`}
                    >
                        🎓 Kỷ Yếu ({POSTER_TEMPLATES.filter(t => t.category === 'ky_yeu').length} mẫu)
                    </button>
                    <button
                        type="button"
                        onClick={() => setWorkspaceCategory('phim_anh')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            workspaceCategory === 'phim_anh' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-600'
                        }`}
                    >
                        🎬 Phim Ảnh ({POSTER_TEMPLATES.filter(t => t.category === 'phim_anh').length} mẫu)
                    </button>
                </div>

                {/* Quick Preset Badges */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
                    {filteredTemplates.map((tpl) => (
                        <button
                            key={tpl.id}
                            type="button"
                            onClick={() => onQuickPickTemplate?.(tpl.id)}
                            className="px-2.5 py-1 rounded-lg bg-white ring-1 ring-slate-900/10 hover:ring-violet-400 hover:text-violet-700 text-[10.5px] font-medium text-slate-700 transition-all cursor-pointer"
                        >
                            {tpl.name}
                        </button>
                    ))}
                </div>

                {!hasInputImages && (
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold ring-1 ring-violet-500/20">
                        <span>👈</span>
                        <span>Hãy tải lên ảnh ở khung bên trái để bắt đầu tạo poster</span>
                    </div>
                )}
            </div>
        );
    }

    // =========================================================================
    // Active / Loading State: Display Generated Poster(s)
    // =========================================================================
    return (
        <div className="w-full flex-1 flex flex-col gap-5 p-2 sm:p-4 animate-fade-in max-w-7xl mx-auto">
            {/* Header Status Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-900/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl flex-shrink-0 ring-1 ring-emerald-500/20">
                        ✓
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                            {isLoading ? 'Đang kết xuất Poster...' : `Đã hoàn thành ${validImages.length} Poster Studio`}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isLoading
                                ? (loadingStatus || 'Vui lòng chờ trong giây lát...')
                                : 'Độ phân giải cao 2K sắc nét • Nhấn vào ảnh để phóng to toàn màn hình'}
                        </p>
                    </div>
                </div>

                {/* Batch Action Help */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                        Định dạng: PNG HD/2K
                    </span>
                </div>
            </div>

            {/* Error banner if any */}
            {error && (
                <div
                    role="alert"
                    className="rounded-2xl bg-white p-4 text-xs sm:text-sm font-semibold text-rose-700 ring-1 ring-rose-200 shadow-sm flex items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                    {onDismissError && (
                        <button
                            type="button"
                            onClick={onDismissError}
                            className="px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                            Đóng
                        </button>
                    )}
                </div>
            )}

            {/* Posters Grid */}
            <div
                className={`grid gap-6 ${
                    validImages.length === 1
                        ? 'grid-cols-1 max-w-2xl mx-auto w-full'
                        : validImages.length === 2
                        ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto w-full'
                        : validImages.length <= 4
                        ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto w-full'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full'
                }`}
            >
                {validImages.map((imgUrl, idx) => {
                    const promptLabel = prompts[idx] || `Poster #${idx + 1}`;
                    const isDownloading = downloadingIdx === idx;
                    const isCopied = copiedIdx === idx;

                    return (
                        <div
                            key={idx}
                            className="group flex flex-col rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5 hover:shadow-md hover:ring-slate-900/10 transition-all duration-200"
                        >
                            {/* Card Header */}
                            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-md bg-violet-100 text-violet-700 font-mono text-[10.5px] font-bold flex items-center justify-center flex-shrink-0">
                                        #{idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                        {promptLabel}
                                    </span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Studio HD
                                </span>
                            </div>

                            {/* Image Container with subtle exhibition matting */}
                            <div
                                onClick={() => onImageClick(imgUrl, idx)}
                                className="relative rounded-xl overflow-hidden bg-slate-950/5 flex items-center justify-center cursor-pointer group-hover:opacity-95 transition-opacity"
                            >
                                <img
                                    src={imgUrl}
                                    alt={promptLabel}
                                    className="w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-[1.01]"
                                    loading="lazy"
                                />

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-slate-900/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-xs text-xs font-bold text-slate-900 shadow-md">
                                        🔍 Xem Toàn Màn Hình
                                    </span>
                                </div>
                            </div>

                            {/* Card Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={(e) => handleDownload(imgUrl, idx, e)}
                                    disabled={isDownloading}
                                    className="min-h-[40px] px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>{isDownloading ? '⏳' : '📥'}</span>
                                    <span>{isDownloading ? 'Đang lưu...' : 'Tải Poster 2K'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => handleCopy(imgUrl, idx, e)}
                                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>{isCopied ? '✓' : '📋'}</span>
                                    <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
