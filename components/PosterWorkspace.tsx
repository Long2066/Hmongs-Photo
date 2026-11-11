import React, { useState, useEffect } from 'react';
import { downloadImage } from '../services/downloadService';
import { POSTER_TEMPLATES } from '../services/posterRenderService';

// ─────────────────────────────────────────────────────────────
// Cinematic Phantom Canvas – hiển thị khi AI đang tạo poster
// ─────────────────────────────────────────────────────────────
const PHASES = [
    { emoji: '🧠', text: 'Đang phân tích ảnh tham chiếu & thần thái nhân vật...' },
    { emoji: '📐', text: 'Đang dàn trang bố cục đa tầng (Filmstrip & Polaroid)...' },
    { emoji: '🎨', text: 'Đang hoà sắc điện ảnh & nhúng typography nghệ thuật...' },
    { emoji: '✨', text: 'Đang phủ ánh sáng & hoàn thiện poster, sắp xuất hiện...' },
];

interface PosterPhantomCanvasProps {
    loadingStatus?: string;
    aspectRatio?: string;
}

const PosterPhantomCanvas: React.FC<PosterPhantomCanvasProps> = ({ loadingStatus, aspectRatio }) => {
    const activeRatio = aspectRatio || (typeof window !== 'undefined' ? localStorage.getItem('imagetool_ai_poster_ratio_v1') || '9:16' : '9:16');
    const [phase, setPhase] = useState(0);
    const [scan, setScan] = useState(false);

    useEffect(() => {
        const id = setInterval(() => {
            setPhase(p => (p < PHASES.length - 1 ? p + 1 : p));
        }, 5500);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const kick = setTimeout(() => setScan(true), 80);
        const interval = setInterval(() => {
            setScan(prev => !prev);
        }, 2500);
        return () => {
            clearTimeout(kick);
            clearInterval(interval);
        };
    }, []);

    const current = PHASES[phase];
    const isHorizontal = activeRatio === '16:9';
    const isSquare = activeRatio === '1:1';

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in text-center max-w-4xl mx-auto w-full">
            {/* Ambient Backlight Glow */}
            <div className="relative flex items-center justify-center">
                <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-indigo-600/20 rounded-3xl blur-2xl opacity-75 animate-pulse" />

                {/* Poster Frame Silhouette */}
                <div
                    className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20 transition-all duration-500"
                    style={{
                        width: isHorizontal ? 'min(540px, 92vw)' : isSquare ? 'min(360px, 85vw)' : 'min(320px, 80vw)',
                        aspectRatio: isHorizontal ? '16/9' : isSquare ? '1/1' : '9/16',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #0f172a 100%)',
                    }}
                >
                    {/* Subtle grid pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                            backgroundSize: '20px 20px',
                        }}
                    />

                    {/* Ghost layout blocks */}
                    <div className="absolute inset-0 flex flex-col p-4 sm:p-5 gap-3 justify-between">
                        {/* Top: Studio logo & badge */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-white/15 animate-pulse ring-1 ring-white/10" />
                                <div className="h-3.5 w-24 rounded-md bg-white/20 animate-pulse" />
                            </div>
                            <div className="h-5 w-16 rounded-full bg-white/10 animate-pulse" />
                        </div>

                        {/* Middle: Main Hero Photo Frame + Polaroid Accents */}
                        <div className="flex-1 flex gap-2.5 items-stretch min-h-0 my-1">
                            {/* Main Subject Frame */}
                            <div className="flex-1 rounded-2xl bg-white/10 animate-pulse ring-1 ring-white/15 relative overflow-hidden flex items-center justify-center">
                                <div className="text-white/20 text-3xl select-none">✦</div>
                            </div>

                            {/* Secondary Polaroid/Filmstrip column (on vertical posters) */}
                            {!isHorizontal && (
                                <div className="w-1/3 flex flex-col gap-2">
                                    {[0, 1].map((i) => (
                                        <div
                                            key={i}
                                            className="flex-1 rounded-xl bg-white/10 animate-pulse ring-1 ring-white/10"
                                            style={{
                                                animationDelay: `${(i + 1) * 0.2}s`,
                                                transform: `rotate(${i === 0 ? 2 : -2}deg)`,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Bottom: Typography Title & Pill Hotline */}
                        <div className="flex flex-col gap-2 items-center">
                            <div className="h-3.5 w-32 rounded-md bg-white/20 animate-pulse" />
                            <div className="h-6 w-44 rounded-lg bg-gradient-to-r from-white/30 to-white/15 animate-pulse" />
                            <div className="h-6 w-36 rounded-full bg-amber-400/20 ring-1 ring-amber-300/30 animate-pulse mt-1" />
                        </div>
                    </div>

                    {/* Cinematic Scanline Beam (moving vertical ray of light) */}
                    <div
                        className="absolute inset-x-0 h-28 pointer-events-none transition-all duration-[2400ms] ease-in-out"
                        style={{
                            top: scan ? 'calc(100% - 7rem)' : '-7rem',
                            background: 'linear-gradient(to bottom, transparent, rgba(167,139,250,0.2) 40%, rgba(244,114,182,0.3) 50%, rgba(167,139,250,0.2) 60%, transparent)',
                            filter: 'blur(3px)',
                        }}
                    />

                    {/* Sparkle Badges */}
                    <div className="absolute top-3 right-3 text-amber-300 text-sm animate-pulse select-none">✦</div>
                    <div className="absolute bottom-3 left-3 text-violet-300 text-xs animate-pulse select-none" style={{ animationDelay: '0.8s' }}>✦</div>
                </div>
            </div>

            {/* Dynamic Status & Guidance */}
            <div className="mt-6 flex flex-col items-center gap-2 max-w-md mx-auto">
                {/* Phase Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold ring-1 ring-violet-500/20 shadow-2xs">
                    <span>{current.emoji}</span>
                    <span>{current.text}</span>
                </div>

                {/* Subtitle with ping indicator */}
                <p className="text-sm font-bold text-slate-800 flex items-center justify-center gap-2 mt-1">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600" />
                    </span>
                    <span>Vui lòng chờ trong giây lát</span>
                </p>

                <p className="text-xs text-slate-500">
                    {loadingStatus && loadingStatus !== current.text ? loadingStatus : 'AI đang hoàn thiện các tầng chi tiết & ánh sáng'}
                </p>

                {/* 4-Step Progress Indicator */}
                <div className="flex items-center gap-1.5 mt-2">
                    {PHASES.map((_, i) => (
                        <div
                            key={i}
                            className={`rounded-full transition-all duration-500 ${
                                i <= phase
                                    ? 'w-6 h-1.5 bg-violet-600'
                                    : 'w-2 h-1.5 bg-slate-200'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

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
    const [workspaceRatio, setWorkspaceRatio] = useState<'9:16' | '16:9'>('9:16');
    const filteredTemplates = POSTER_TEMPLATES.filter(
        (t) => t.category === workspaceCategory && t.aspectRatio === workspaceRatio
    );

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

                {/* Category & Ratio Switchers for Quick Badges */}
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setWorkspaceCategory('ky_yeu')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                workspaceCategory === 'ky_yeu' ? 'bg-white text-violet-700 shadow-2xs' : 'text-slate-600'
                            }`}
                        >
                            🎓 Kỷ Yếu (30)
                        </button>
                        <button
                            type="button"
                            onClick={() => setWorkspaceCategory('phim_anh')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                workspaceCategory === 'phim_anh' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-600'
                            }`}
                        >
                            🎬 Phim Ảnh (30)
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setWorkspaceRatio('9:16')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                workspaceRatio === '9:16' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                            }`}
                        >
                            📱 Khổ Dọc 9:16 (15)
                        </button>
                        <button
                            type="button"
                            onClick={() => setWorkspaceRatio('16:9')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                workspaceRatio === '16:9' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                            }`}
                        >
                            🖥️ Khổ Ngang 16:9 (15)
                        </button>
                    </div>
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
    // Loading State: Cinematic Phantom Canvas
    // =========================================================================
    if (isLoading && !hasOutputs) {
        return <PosterPhantomCanvas loadingStatus={loadingStatus} />;
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
