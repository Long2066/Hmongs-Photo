import React, { useState, useEffect } from 'react';
import {
    POSTER_TEMPLATES,
    THEME_COLOR_PRESETS,
    YEARBOOK_QUOTE_PRESETS,
    PosterOptions,
    PosterTemplateId,
    PosterCategory,
    PosterAspectRatio,
    PosterTemplateMeta
} from '../services/posterRenderService';

interface PosterStudioPanelProps {
    onGeneratePoster: (options: PosterOptions, batchMode: 'single' | 'top4' | 'all', shuffleSeed: number) => void;
    isLoading: boolean;
    hasInputImage: boolean;
    inputCount: number;
    inputImages?: string[];
    onSwapInputs?: (i: number, j: number) => void;
    onRemoveInput?: (idx: number) => void;
    selectedTemplateId?: PosterTemplateId;
    onTemplateSelect?: (id: PosterTemplateId) => void;
}

const STORAGE_KEY_BRANDING = 'imagetool_poster_branding_v3';
const STORAGE_KEY_CATEGORY = 'imagetool_poster_active_category_v3';
const STORAGE_KEY_RATIO = 'imagetool_poster_active_ratio_v3';

interface SavedBranding {
    conceptName: string;
    studioName: string;
    slogan: string;
    hotline: string;
    yearTag: string;
    accentColor: string;
    quoteText: string;
    movieTitle: string;
    movieSubtitle: string;
    actors: string;
    platform: 'wetv' | 'vieon' | 'netflix' | 'cinema' | 'none';
    broadcastTime: string;
    releaseDate: string;
}

const DEFAULT_BRANDING: SavedBranding = {
    conceptName: 'Tuổi Học Trò',
    studioName: 'TNT MEDIA',
    slogan: 'TOP 10 KỶ YẾU CÓ TÂM',
    hotline: '094 191 59 68',
    yearTag: 'kỷ yếu 2025-2026',
    accentColor: '#e11d48',
    quoteText: 'Điều đẹp đẽ không phải tuổi thanh xuân, mà là trong tuổi thanh xuân đó có họ.',
    movieTitle: 'TÌNH YÊU ANH DÀNH CHO EM',
    movieSubtitle: 'One Of A Kind Romance',
    actors: 'TUẤN ANH  ✕  THU TRANG',
    platform: 'wetv',
    broadcastTime: '19:00 Mỗi ngày | TRỌN BỘ',
    releaseDate: '28.12.2026'
};

/**
 * Intelligent Dynamic Wireframe SVG Component
 * Generates accurate visual representations for all 60 templates
 */
const TemplateWireframeSvg: React.FC<{ template: PosterTemplateMeta; activeColor: string }> = ({ template, activeColor }) => {
    const is916 = template.aspectRatio === '9:16';
    const stroke = activeColor;

    if (is916) {
        // Vertical 9:16 wireframe (viewBox 0 0 40 64)
        return (
            <svg viewBox="0 0 40 64" className="w-full h-full">
                <rect x="2" y="2" width="36" height="60" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                {template.id.includes('vogue') ? (
                    <>
                        <rect x="4" y="4" width="32" height="56" rx="2" fill="#334155" />
                        <rect x="6" y="8" width="28" height="6" rx="1" fill="#ffffff" />
                        <rect x="18" y="48" width="5" height="8" rx="0.5" fill="#94a3b8" />
                        <rect x="24" y="48" width="5" height="8" rx="0.5" fill="#94a3b8" />
                    </>
                ) : template.id.includes('bento') ? (
                    <>
                        <rect x="5" y="5" width="30" height="26" rx="2" fill={stroke} opacity="0.85" />
                        <rect x="5" y="34" width="14" height="12" rx="1.5" fill="#94a3b8" />
                        <rect x="21" y="34" width="14" height="12" rx="1.5" fill="#94a3b8" />
                        <rect x="5" y="48" width="14" height="11" rx="1.5" fill="#64748b" />
                        <rect x="21" y="48" width="14" height="11" rx="1.5" fill="#64748b" />
                    </>
                ) : template.id.includes('newspaper') ? (
                    <>
                        <rect x="4" y="4" width="32" height="56" rx="1.5" fill="#f6f1e8" stroke="#78350f" strokeWidth="0.8" />
                        <rect x="7" y="7" width="26" height="4" fill="#1e293b" />
                        <rect x="7" y="13" width="26" height="24" fill="#64748b" />
                        <rect x="7" y="40" width="8" height="16" fill="#94a3b8" />
                        <rect x="16" y="40" width="8" height="16" fill="#94a3b8" />
                        <rect x="25" y="40" width="8" height="16" fill="#94a3b8" />
                    </>
                ) : template.id.includes('music_player') ? (
                    <>
                        <rect x="4" y="4" width="32" height="56" rx="3" fill="#1e293b" />
                        <rect x="6" y="8" width="28" height="26" rx="2" fill={stroke} opacity="0.8" />
                        <rect x="6" y="36" width="13" height="12" rx="1.5" fill="#64748b" />
                        <rect x="21" y="36" width="13" height="12" rx="1.5" fill="#64748b" />
                        <circle cx="20" cy="54" r="4" fill="#ffffff" opacity="0.7" />
                    </>
                ) : template.id.includes('kdrama') ? (
                    <>
                        <rect x="4" y="4" width="32" height="56" rx="2" fill="#09090b" />
                        <rect x="6" y="6" width="13" height="26" rx="1" fill="#f43f5e" opacity="0.85" />
                        <rect x="21" y="6" width="13" height="26" rx="1" fill="#3b82f6" opacity="0.85" />
                        <rect x="6" y="34" width="28" height="24" rx="1" fill="#64748b" />
                        <rect x="8" y="30" width="24" height="4" rx="1" fill="#ffffff" />
                    </>
                ) : (
                    <>
                        <rect x="5" y="6" width="30" height="32" rx="2" fill={stroke} opacity="0.75" />
                        <rect x="5" y="41" width="14" height="17" rx="1.5" fill="#94a3b8" />
                        <rect x="21" y="41" width="14" height="17" rx="1.5" fill="#64748b" />
                    </>
                )}
            </svg>
        );
    }

    // Horizontal 16:9 wireframe (viewBox 0 0 64 38)
    return (
        <svg viewBox="0 0 64 38" className="w-full h-full">
            <rect x="2" y="2" width="60" height="34" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            {template.id.includes('widescreen') ? (
                <>
                    <rect x="4" y="4" width="56" height="30" rx="1" fill="#000000" />
                    <rect x="4" y="9" width="56" height="20" fill={stroke} opacity="0.8" />
                    <rect x="18" y="23" width="28" height="3" rx="1" fill="#fbbf24" />
                </>
            ) : template.id.includes('curved_film') ? (
                <>
                    <rect x="4" y="4" width="56" height="30" rx="2" fill="#e0e7ff" />
                    <path d="M4 22 Q 32 8, 60 20" stroke="#4338ca" strokeWidth="12" fill="none" opacity="0.9" />
                    <rect x="12" y="14" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="26" y="10" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="40" y="14" width="8" height="8" rx="1" fill="#ffffff" />
                </>
            ) : template.id.includes('wall_gallery') ? (
                <>
                    <rect x="4" y="4" width="56" height="30" rx="2" fill="#e2e8f0" />
                    <rect x="6" y="12" width="7" height="14" fill="#64748b" stroke="#92400e" strokeWidth="0.8" />
                    <rect x="16" y="9" width="9" height="20" fill="#64748b" stroke="#92400e" strokeWidth="0.8" />
                    <rect x="27" y="7" width="10" height="24" fill={stroke} opacity="0.8" stroke="#92400e" strokeWidth="1" />
                    <rect x="39" y="9" width="9" height="20" fill="#64748b" stroke="#92400e" strokeWidth="0.8" />
                    <rect x="51" y="12" width="7" height="14" fill="#64748b" stroke="#92400e" strokeWidth="0.8" />
                </>
            ) : template.id.includes('bento') ? (
                <>
                    <rect x="5" y="5" width="13" height="13" rx="1.5" fill="#f59e0b" />
                    <rect x="20" y="5" width="13" height="13" rx="1.5" fill="#d97706" />
                    <rect x="35" y="5" width="24" height="13" rx="1.5" fill={stroke} opacity="0.85" />
                    <rect x="5" y="20" width="17" height="13" rx="1.5" fill="#64748b" />
                    <rect x="24" y="20" width="17" height="13" rx="1.5" fill="#64748b" />
                    <rect x="43" y="20" width="16" height="13" rx="1.5" fill="#94a3b8" />
                </>
            ) : template.id.includes('timeline') || template.id.includes('contact_sheet') ? (
                <>
                    <rect x="4" y="4" width="56" height="30" rx="1" fill="#18181b" />
                    <rect x="6" y="8" width="7" height="22" rx="1" fill="#38bdf8" opacity="0.8" />
                    <rect x="15" y="8" width="7" height="22" rx="1" fill="#64748b" />
                    <rect x="24" y="8" width="7" height="22" rx="1" fill="#64748b" />
                    <rect x="33" y="8" width="7" height="22" rx="1" fill="#64748b" />
                    <rect x="42" y="8" width="7" height="22" rx="1" fill="#64748b" />
                    <rect x="51" y="8" width="7" height="22" rx="1" fill="#94a3b8" />
                </>
            ) : (
                <>
                    <rect x="5" y="5" width="26" height="28" rx="2" fill={stroke} opacity="0.8" />
                    <rect x="34" y="5" width="25" height="13" rx="1.5" fill="#64748b" />
                    <rect x="34" y="20" width="25" height="13" rx="1.5" fill="#94a3b8" />
                </>
            )}
        </svg>
    );
};

export const PosterStudioPanel: React.FC<PosterStudioPanelProps> = ({
    onGeneratePoster,
    isLoading,
    hasInputImage,
    inputCount,
    inputImages = [],
    onSwapInputs,
    onRemoveInput,
    selectedTemplateId: externalTemplateId,
    onTemplateSelect
}) => {
    // 1. Tầng 1: Chủ Đề (Kỷ Yếu vs Phim Ảnh)
    const [activeCategory, setActiveCategory] = useState<PosterCategory>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_CATEGORY);
            if (saved === 'ky_yeu' || saved === 'phim_anh') return saved;
        } catch {
            // Safe
        }
        return 'ky_yeu';
    });

    // 2. Tầng 2: Tỷ Lệ Màn Hình (9:16 Dọc vs 16:9 Ngang)
    const [activeAspectRatio, setActiveAspectRatio] = useState<PosterAspectRatio>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_RATIO);
            if (saved === '9:16' || saved === '16:9') return saved;
        } catch {
            // Safe
        }
        return '9:16';
    });

    const [internalTemplateId, setInternalTemplateId] = useState<PosterTemplateId>('kyyeu_916_film_sotay');
    const selectedTemplateId = externalTemplateId ?? internalTemplateId;

    const setSelectedTemplateId = (id: PosterTemplateId) => {
        setInternalTemplateId(id);
        onTemplateSelect?.(id);
    };

    const [branding, setBranding] = useState<SavedBranding>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_BRANDING);
            if (raw) return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
        } catch {
            // Safe ignore
        }
        return DEFAULT_BRANDING;
    });

    const [resolution, setResolution] = useState<'HD' | '2K'>('2K');
    const [cropBiasY, setCropBiasY] = useState<number>(0.3);
    const [shuffleSeed, setShuffleSeed] = useState<number>(0);

    // Save branding, category & aspect ratio automatically
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(branding));
        } catch {}
    }, [branding]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_CATEGORY, activeCategory);
        } catch {}
    }, [activeCategory]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_RATIO, activeAspectRatio);
        } catch {}
    }, [activeAspectRatio]);

    // Filter templates strictly by BOTH category and aspect ratio (Always exactly 15 templates!)
    const activeTemplates = POSTER_TEMPLATES.filter(
        (t) => t.category === activeCategory && t.aspectRatio === activeAspectRatio
    );
    const currentTemplate = POSTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || activeTemplates[0];

    // Ensure selected template stays in active category & ratio
    const handleSwitchCategory = (cat: PosterCategory) => {
        setActiveCategory(cat);
        const match = POSTER_TEMPLATES.find((t) => t.category === cat && t.aspectRatio === activeAspectRatio);
        if (match) setSelectedTemplateId(match.id);
    };

    const handleSwitchRatio = (ratio: PosterAspectRatio) => {
        setActiveAspectRatio(ratio);
        const match = POSTER_TEMPLATES.find((t) => t.category === activeCategory && t.aspectRatio === ratio);
        if (match) setSelectedTemplateId(match.id);
    };

    const buildOptions = (): PosterOptions => ({
        templateId: selectedTemplateId,
        category: activeCategory,
        aspectRatio: activeAspectRatio,
        conceptName: branding.conceptName,
        studioName: branding.studioName,
        slogan: branding.slogan,
        hotline: branding.hotline,
        yearTag: branding.yearTag,
        accentColor: branding.accentColor,
        resolution,
        cropBiasY,
        quoteText: branding.quoteText,
        movieTitle: branding.movieTitle,
        movieSubtitle: branding.movieSubtitle,
        actors: branding.actors,
        platform: branding.platform,
        broadcastTime: branding.broadcastTime,
        releaseDate: branding.releaseDate
    });

    const handleTriggerSingle = () => {
        if (!hasInputImage || isLoading) return;
        onGeneratePoster(buildOptions(), 'single', shuffleSeed);
    };

    const handleTriggerBatch4 = () => {
        if (!hasInputImage || isLoading) return;
        onGeneratePoster(buildOptions(), 'top4', shuffleSeed);
    };

    const handleTriggerAll = () => {
        if (!hasInputImage || isLoading) return;
        onGeneratePoster(buildOptions(), 'all', shuffleSeed);
    };

    return (
        <div className="flex flex-col gap-4 text-slate-800">
            {/* TẦNG 1: Chọn Chủ Đề (Kỷ Yếu vs Phim Ảnh) */}
            <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 shadow-2xs">
                <button
                    type="button"
                    onClick={() => handleSwitchCategory('ky_yeu')}
                    className={`flex-1 min-h-[42px] py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeCategory === 'ky_yeu'
                            ? 'bg-white text-violet-700 shadow-sm ring-1 ring-slate-900/5'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span className="text-base">🎓</span>
                    <span>Kỷ Yếu Học Đường (30 Mẫu)</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleSwitchCategory('phim_anh')}
                    className={`flex-1 min-h-[42px] py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeCategory === 'phim_anh'
                            ? 'bg-white text-rose-600 shadow-sm ring-1 ring-slate-900/5'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span className="text-base">🎬</span>
                    <span>Poster Phim Ảnh (30 Mẫu)</span>
                </button>
            </div>

            {/* TẦNG 2: Bộ Lọc Tỷ Lệ Màn Hình (9:16 Dọc vs 16:9 Ngang) */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl ring-1 ring-slate-900/5">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider pl-1.5 hidden sm:inline">
                    Tỷ lệ:
                </span>
                <button
                    type="button"
                    onClick={() => handleSwitchRatio('9:16')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeAspectRatio === '9:16'
                            ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-900/10'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>📱</span>
                    <span>Khổ Dọc 9:16 (15 Mẫu)</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleSwitchRatio('16:9')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeAspectRatio === '16:9'
                            ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-900/10'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>🖥️</span>
                    <span>Khổ Ngang 16:9 (15 Mẫu)</span>
                </button>
            </div>

            {/* Khay Gán Ảnh Trực Quan Theo Từng Ô (Slot Manager) */}
            {inputCount > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl ring-1 ring-slate-900/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🎞️</span>
                            <span>Khay Sắp Xếp Ảnh ({inputCount} ảnh đã tải)</span>
                        </span>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                            inputCount >= currentTemplate.idealSlots
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20'
                        }`}>
                            Khuyến nghị: {currentTemplate.idealSlots} ảnh
                        </span>
                    </div>

                    <p className="text-[10.5px] text-slate-500 leading-snug">
                        Bấm mũi tên <strong className="text-slate-700">← →</strong> để hoán đổi vị trí ảnh theo đúng từng ô thiết kế:
                    </p>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                        {inputImages.slice(0, 10).map((imgBase64, idx) => {
                            const label = currentTemplate.slotLabels[idx] || `Ô #${idx + 1}`;
                            return (
                                <div
                                    key={idx}
                                    className="flex-shrink-0 w-20 flex flex-col items-center bg-white p-1 rounded-xl ring-1 ring-slate-900/10 shadow-2xs group relative"
                                >
                                    <div className="relative w-full h-16 rounded-lg overflow-hidden bg-slate-100 mb-1">
                                        <img
                                            src={imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}`}
                                            alt={`Slot ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-slate-900/80 text-white text-[9px] font-mono font-bold flex items-center justify-center rounded">
                                            #{idx + 1}
                                        </span>
                                        {onRemoveInput && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveInput(idx)}
                                                className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                title="Xóa ảnh này"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Slot Role Label */}
                                    <span className="text-[9px] font-medium text-slate-600 text-center truncate w-full px-0.5 mb-1" title={label}>
                                        {label}
                                    </span>

                                    {/* Swap Left / Right Buttons */}
                                    {onSwapInputs && (
                                        <div className="flex items-center justify-between w-full px-0.5">
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={() => onSwapInputs(idx, idx - 1)}
                                                className="w-4 h-4 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-slate-100"
                                                title="Đổi sang trái"
                                            >
                                                ←
                                            </button>
                                            <button
                                                type="button"
                                                disabled={idx === inputCount - 1}
                                                onClick={() => onSwapInputs(idx, idx + 1)}
                                                className="w-4 h-4 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-slate-100"
                                                title="Đổi sang phải"
                                            >
                                                →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 1. Chọn Mẫu Trong Nhóm 15 Mẫu Hiện Tại */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        1. Danh Sách 15 Mẫu ({activeAspectRatio})
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-500/20">
                        Khổ {currentTemplate.aspectRatio}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[310px] overflow-y-auto pr-1 scrollbar-thin">
                    {activeTemplates.map((tpl) => {
                        const isSelected = tpl.id === selectedTemplateId;
                        return (
                            <button
                                key={tpl.id}
                                type="button"
                                onClick={() => setSelectedTemplateId(tpl.id)}
                                className={`group relative flex flex-col p-2 rounded-xl text-left transition-all duration-150 cursor-pointer min-h-[46px] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                                    isSelected
                                        ? 'bg-violet-50/90 ring-2 ring-violet-600 shadow-xs'
                                        : 'bg-white ring-1 ring-slate-900/10 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-start gap-2 w-full">
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 p-0.5 flex-shrink-0 overflow-hidden ring-1 ring-slate-900/5 flex items-center justify-center">
                                        <TemplateWireframeSvg template={tpl} activeColor={branding.accentColor} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className={`inline-block text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full mb-0.5 ${
                                            isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {tpl.badge}
                                        </span>
                                        <p className={`text-[11px] font-semibold leading-tight truncate ${
                                            isSelected ? 'text-violet-950' : 'text-slate-900'
                                        }`}>
                                            {tpl.name}
                                        </p>
                                        <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">
                                            {tpl.recommendedImages}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Selected Template Description Pill */}
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-900/5">
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">{currentTemplate.name}:</strong> {currentTemplate.description}
                    </p>
                </div>
            </div>

            {/* 2. Form Tùy Chỉnh Chữ Động Theo Chủ Đề */}
            <div className="space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    2. Tùy Chỉnh Chữ Poster ({activeCategory === 'ky_yeu' ? 'Kỷ Yếu' : 'Phim Ảnh'})
                </label>

                {activeCategory === 'ky_yeu' ? (
                    /* Form Kỷ Yếu */
                    <div className="space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-slate-600">Tên Concept / Lớp</span>
                                <div className="flex items-center gap-1">
                                    {['Tuổi Học Trò', 'Thanh Xuân', '12A4', 'Dormitory'].map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setBranding((prev) => ({ ...prev, conceptName: tag }))}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer font-medium"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input
                                type="text"
                                value={branding.conceptName}
                                onChange={(e) => setBranding((prev) => ({ ...prev, conceptName: e.target.value }))}
                                placeholder="Tuổi Học Trò / Thanh Xuân..."
                                className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-slate-600">Câu Trích Dẫn / Thơ Thanh Xuân</span>
                                <span className="text-[9.5px] text-violet-600 font-semibold">Gợi ý câu hay</span>
                            </div>
                            <select
                                value={branding.quoteText}
                                onChange={(e) => setBranding((prev) => ({ ...prev, quoteText: e.target.value }))}
                                className="w-full min-h-[36px] px-2.5 py-1 text-[11px] font-medium text-slate-800 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-1"
                            >
                                {YEARBOOK_QUOTE_PRESETS.map((q, idx) => (
                                    <option key={idx} value={q}>
                                        {q}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={branding.quoteText}
                                onChange={(e) => setBranding((prev) => ({ ...prev, quoteText: e.target.value }))}
                                placeholder="Tự nhập câu thơ/châm ngôn thanh xuân..."
                                className="w-full min-h-[36px] px-2.5 py-1 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Studio / Tên Trường</span>
                                <input
                                    type="text"
                                    value={branding.studioName}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, studioName: e.target.value }))}
                                    placeholder="TNT MEDIA / THPT Chu Văn An..."
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Niên khóa / Năm</span>
                                <input
                                    type="text"
                                    value={branding.yearTag}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, yearTag: e.target.value }))}
                                    placeholder="kỷ yếu 2025-2026"
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Slogan Chân Trang</span>
                                <input
                                    type="text"
                                    value={branding.slogan}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, slogan: e.target.value }))}
                                    placeholder="TOP 10 KỶ YẾU CÓ TÂM"
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Hotline / Zalo</span>
                                <input
                                    type="text"
                                    value={branding.hotline}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, hotline: e.target.value }))}
                                    placeholder="094 191 59 68"
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Form Phim Ảnh */
                    <div className="space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-slate-600">Tên Phim Chính (Movie Title)</span>
                                <div className="flex items-center gap-1">
                                    {['TÌNH YÊU ANH DÀNH CHO EM', 'ĐỒNG THOẠI', 'TIẾNG YÊU NÀY'].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setBranding((prev) => ({ ...prev, movieTitle: t }))}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer font-medium truncate max-w-[100px]"
                                        >
                                            {t.slice(0, 10)}...
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input
                                type="text"
                                value={branding.movieTitle}
                                onChange={(e) => setBranding((prev) => ({ ...prev, movieTitle: e.target.value }))}
                                placeholder="TÌNH YÊU ANH DÀNH CHO EM / ĐỒNG THOẠI..."
                                className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Tagline / Tên Phụ Tiếng Anh</span>
                                <input
                                    type="text"
                                    value={branding.movieSubtitle}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, movieSubtitle: e.target.value }))}
                                    placeholder="One Of A Kind Romance / Chung Đôi..."
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Diễn Viên / Cặp Đôi Chính</span>
                                <input
                                    type="text"
                                    value={branding.actors}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, actors: e.target.value }))}
                                    placeholder="Tuấn Anh ✕ Thu Trang..."
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                        </div>

                        <div>
                            <span className="block text-[10px] font-semibold text-slate-600 mb-1">Logo Kênh / Nền Tảng Chiếu</span>
                            <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl">
                                {[
                                    { id: 'wetv', label: 'WeTV' },
                                    { id: 'vieon', label: 'VieON' },
                                    { id: 'netflix', label: 'Netflix' },
                                    { id: 'cinema', label: 'Cinema' },
                                    { id: 'none', label: 'Tắt Logo' }
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setBranding((prev) => ({ ...prev, platform: p.id as any }))}
                                        className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                                            branding.platform === p.id
                                                ? 'bg-white text-rose-600 shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Lịch Chiếu / Giờ Phát Sóng</span>
                                <input
                                    type="text"
                                    value={branding.broadcastTime}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, broadcastTime: e.target.value }))}
                                    placeholder="19:00 Mỗi ngày trên VieON..."
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                            <div>
                                <span className="block text-[10px] font-semibold text-slate-600 mb-1">Ngày Công Chiếu</span>
                                <input
                                    type="text"
                                    value={branding.releaseDate}
                                    onChange={(e) => setBranding((prev) => ({ ...prev, releaseDate: e.target.value }))}
                                    placeholder="28.12.2026"
                                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Màu Sắc & AI Căn Khung */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        3. Tone Màu Nhấn
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {THEME_COLOR_PRESETS.map((preset) => {
                            const active = branding.accentColor.toLowerCase() === preset.hex.toLowerCase();
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setBranding((prev) => ({ ...prev, accentColor: preset.hex }))}
                                    title={preset.name}
                                    className={`w-8 h-8 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                                        active ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'ring-1 ring-slate-900/10 hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: preset.hex }}
                                    aria-label={preset.name}
                                >
                                    {active && (
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">AI Căn Khung Mặt</span>
                        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                            {[
                                { label: 'Mũ/Đầu', val: 0.15 },
                                { label: 'AI Chuẩn', val: 0.3 },
                                { label: 'Ngực', val: 0.5 }
                            ].map((opt) => (
                                <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => setCropBiasY(opt.val)}
                                    className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
                                        cropBiasY === opt.val
                                            ? 'bg-white text-slate-900 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Độ phân giải</span>
                        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                            {(['HD', '2K'] as const).map((res) => (
                                <button
                                    key={res}
                                    type="button"
                                    onClick={() => setResolution(res)}
                                    className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
                                        resolution === res
                                            ? 'bg-white text-violet-700 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {res === '2K' ? '2K Nét' : 'HD'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Action Buttons */}
            <div className="space-y-2.5 pt-1">
                {!hasInputImage && (
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-medium ring-1 ring-amber-200/80 flex items-center gap-2">
                        <span>💡</span>
                        <span>Hãy tải lên 1 đến 10 ảnh ở khung phía trên để ghép Poster.</span>
                    </div>
                )}

                {/* Primary Action Button */}
                <button
                    type="button"
                    onClick={handleTriggerSingle}
                    disabled={isLoading || !hasInputImage}
                    className={`w-full min-h-[44px] py-3 px-4 rounded-xl font-semibold text-xs uppercase tracking-wider text-white transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] shadow-sm ${
                        isLoading || !hasInputImage
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            : activeCategory === 'ky_yeu'
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-violet-500/25'
                            : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25'
                    }`}
                >
                    <span>✨</span>
                    <span>
                        {isLoading
                            ? 'Đang kết xuất Poster...'
                            : `Xuất Poster "${currentTemplate.name}" (${activeAspectRatio})`}
                    </span>
                </button>

                {/* Secondary Actions Row */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleTriggerBatch4}
                        disabled={isLoading || !hasInputImage}
                        className="min-h-[44px] px-3 py-2 rounded-xl font-semibold text-[11px] text-slate-700 bg-white ring-1 ring-slate-900/10 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <span>⚡</span>
                        <span>Thử 4 Mẫu Hot</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleTriggerAll}
                        disabled={isLoading || !hasInputImage}
                        className="min-h-[44px] px-3 py-2 rounded-xl font-semibold text-[11px] text-slate-700 bg-white ring-1 ring-slate-900/10 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <span>🎨</span>
                        <span>Xuất Toàn Bộ 15 Mẫu ({activeAspectRatio})</span>
                    </button>
                </div>

                {/* Shuffle Button when >1 image */}
                {inputCount > 1 && (
                    <button
                        type="button"
                        onClick={() => {
                            const nextSeed = shuffleSeed + 1;
                            setShuffleSeed(nextSeed);
                            onGeneratePoster(buildOptions(), 'single', nextSeed);
                        }}
                        disabled={isLoading}
                        className="w-full min-h-[40px] px-3 py-2 rounded-xl font-medium text-[11px] text-violet-700 bg-violet-50 hover:bg-violet-100/80 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <span>🔀</span>
                        <span>Đảo vị trí {inputCount} ảnh & Tạo lại</span>
                    </button>
                )}
            </div>
        </div>
    );
};
