import React, { useState, useEffect } from 'react';
import {
    POSTER_TEMPLATES,
    THEME_COLOR_PRESETS,
    YEARBOOK_QUOTE_PRESETS,
    PosterOptions,
    PosterTemplateId,
    PosterCategory
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

const STORAGE_KEY_BRANDING = 'imagetool_poster_branding_v2';
const STORAGE_KEY_CATEGORY = 'imagetool_poster_active_category';

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

/** Mini Wireframe SVG Preview showing the exact layout structure of each template */
const TemplateWireframeSvg: React.FC<{ id: PosterTemplateId; activeColor: string }> = ({ id, activeColor }) => {
    const stroke = activeColor;
    switch (id) {
        case 'tnt_wood_classic':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="8" y="8" width="22" height="6" rx="1.5" fill={stroke} opacity="0.85" />
                    <rect x="38" y="8" width="18" height="6" rx="1.5" fill={stroke} opacity="0.5" />
                    <rect x="8" y="18" width="14" height="14" rx="2" fill="#94a3b8" />
                    <rect x="25" y="18" width="14" height="14" rx="2" fill="#94a3b8" />
                    <rect x="42" y="18" width="14" height="14" rx="2" fill="#94a3b8" />
                    <rect x="8" y="35" width="31" height="16" rx="1.5" fill="#d97706" opacity="0.8" stroke="#92400e" strokeWidth="2" />
                    <rect x="42" y="35" width="14" height="16" rx="2" fill="#64748b" />
                    <rect x="8" y="54" width="48" height="4" rx="2" fill="#cbd5e1" />
                </svg>
            );
        case 'bff_thanh_xuan':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="8" width="56" height="48" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="6" y="10" width="24" height="14" fill="#64748b" opacity="0.85" />
                    <rect x="6" y="25" width="24" height="14" fill="#475569" opacity="0.85" />
                    <rect x="6" y="40" width="24" height="14" fill="#64748b" opacity="0.85" />
                    <rect x="31" y="10" width="27" height="44" rx="1" fill={stroke} opacity="0.75" />
                </svg>
            );
        case 'bento_catalog_8':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="8" y="8" width="23" height="23" rx="3" fill={stroke} opacity="0.8" />
                    <rect x="33" y="8" width="23" height="7" rx="2" fill="#475569" />
                    <rect x="33" y="17" width="11" height="14" rx="2" fill="#94a3b8" />
                    <rect x="45" y="17" width="11" height="14" rx="2" fill="#94a3b8" />
                    <rect x="8" y="33" width="11" height="11" rx="2" fill="#94a3b8" />
                    <rect x="21" y="33" width="10" height="11" rx="2" fill="#94a3b8" />
                    <rect x="33" y="33" width="23" height="11" rx="2" fill="#64748b" />
                    <rect x="8" y="46" width="23" height="10" rx="2" fill="#64748b" />
                    <rect x="33" y="46" width="23" height="10" rx="2" fill="#64748b" />
                </svg>
            );
        case 'kyyeu_tuoi_hoc_tro_aloha':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
                    <rect x="8" y="8" width="48" height="5" rx="1.5" fill="#d97706" />
                    <rect x="8" y="16" width="14" height="22" rx="2" fill="#b45309" />
                    <rect x="25" y="16" width="14" height="13" rx="2" fill="#d97706" />
                    <rect x="42" y="16" width="14" height="18" rx="2" fill="#d97706" />
                    <rect x="25" y="31" width="14" height="16" rx="2" fill="#f59e0b" />
                    <rect x="42" y="36" width="14" height="11" rx="2" fill="#b45309" />
                    <rect x="8" y="49" width="48" height="7" rx="2" fill="#78350f" />
                </svg>
            );
        case 'kyyeu_cuon_film_sotay':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="3" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1" />
                    <line x1="8" y1="16" x2="56" y2="16" stroke="#bfdbfe" strokeWidth="0.8" />
                    <line x1="8" y1="28" x2="56" y2="28" stroke="#bfdbfe" strokeWidth="0.8" />
                    <line x1="8" y1="40" x2="56" y2="40" stroke="#bfdbfe" strokeWidth="0.8" />
                    <g transform="rotate(-6 22 25)">
                        <rect x="13" y="17" width="18" height="16" rx="1" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />
                        <rect x="15" y="19" width="14" height="12" fill="#3b82f6" opacity="0.75" />
                    </g>
                    <g transform="rotate(5 42 27)">
                        <rect x="33" y="19" width="18" height="16" rx="1" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />
                        <rect x="35" y="21" width="14" height="12" fill="#64748b" />
                    </g>
                    <rect x="42" y="44" width="10" height="12" rx="1" fill="#059669" />
                </svg>
            );
        case 'kyyeu_nang_xien_bff':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="3" fill="#29180c" />
                    <rect x="8" y="8" width="14" height="10" fill="#f59e0b" opacity="0.8" />
                    <rect x="8" y="20" width="14" height="10" fill="#78350f" />
                    <rect x="8" y="32" width="14" height="10" fill="#d97706" />
                    <rect x="24" y="8" width="16" height="16" fill="#fef3c7" opacity="0.9" />
                    <rect x="24" y="26" width="16" height="16" fill="#b45309" />
                    <rect x="42" y="8" width="14" height="10" fill="#78350f" />
                    <rect x="42" y="20" width="14" height="10" fill="#f59e0b" />
                    <rect x="42" y="32" width="14" height="10" fill="#d97706" />
                    <rect x="8" y="44" width="23" height="12" fill="#d97706" opacity="0.75" />
                    <rect x="33" y="44" width="23" height="12" fill="#fef3c7" opacity="0.8" />
                </svg>
            );
        case 'kyyeu_dai_phim_uon_luon':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#e0e7ff" />
                    <path d="M4 36 Q 32 16, 60 32" stroke="#4338ca" strokeWidth="18" fill="none" opacity="0.9" />
                    <rect x="14" y="24" width="8" height="12" rx="1" fill="#ffffff" />
                    <rect x="28" y="20" width="8" height="12" rx="1" fill="#ffffff" />
                    <rect x="42" y="24" width="8" height="12" rx="1" fill="#ffffff" />
                </svg>
            );
        case 'kyyeu_scrapbook_vintage':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="8" width="56" height="48" rx="3" fill="#334155" />
                    <line x1="4" y1="34" x2="60" y2="34" stroke="#dc2626" strokeWidth="2.5" />
                    <rect x="8" y="12" width="20" height="18" rx="1" fill="#faf6ee" stroke="#78350f" strokeWidth="0.8" />
                    <rect x="32" y="14" width="14" height="18" rx="1" fill="#faf6ee" stroke="#78350f" strokeWidth="0.8" />
                    <rect x="14" y="36" width="16" height="16" rx="1" fill="#faf6ee" stroke="#78350f" strokeWidth="0.8" />
                    <rect x="34" y="36" width="14" height="16" rx="1" fill="#faf6ee" stroke="#78350f" strokeWidth="0.8" />
                </svg>
            );
        case 'kyyeu_youth_dream_co':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="8" y="8" width="12" height="12" rx="2" fill="#3f2e24" />
                    <rect x="8" y="22" width="12" height="14" rx="2" fill="#94a3b8" />
                    <rect x="22" y="8" width="34" height="28" rx="2" fill="#10b981" opacity="0.85" />
                    <rect x="8" y="39" width="32" height="17" rx="2" fill="#64748b" />
                    <rect x="42" y="39" width="14" height="10" rx="2" fill="#94a3b8" />
                    <rect x="42" y="51" width="14" height="5" rx="1.5" fill="#3f2e24" />
                </svg>
            );
        case 'kyyeu_khi_ta_con_tre_tennis':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="3" fill="#0f766e" />
                    <rect x="8" y="4" width="48" height="18" fill="#f59e0b" opacity="0.7" />
                    <rect x="8" y="42" width="48" height="18" fill="#0284c7" opacity="0.7" />
                    <g transform="rotate(-6 24 30)">
                        <rect x="16" y="22" width="16" height="16" fill="#ffffff" />
                        <rect x="18" y="24" width="12" height="11" fill="#64748b" />
                    </g>
                    <g transform="rotate(7 40 32)">
                        <rect x="32" y="24" width="16" height="16" fill="#ffffff" />
                        <rect x="34" y="26" width="12" height="11" fill="#64748b" />
                    </g>
                </svg>
            );
        case 'movie_wetv_romance':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="4" fill="#0f172a" />
                    <circle cx="20" cy="18" r="6" fill="#f43f5e" opacity="0.6" />
                    <circle cx="44" cy="24" r="8" fill="#fbbf24" opacity="0.4" />
                    <rect x="12" y="10" width="40" height="34" rx="2" fill="#64748b" opacity="0.5" />
                    <rect x="16" y="46" width="32" height="4" rx="1" fill="#ffffff" />
                    <rect x="22" y="52" width="20" height="4" rx="2" fill="#f97316" />
                </svg>
            );
        case 'movie_kdrama_split':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="3" fill="#09090b" />
                    <rect x="10" y="6" width="21" height="26" rx="1" fill="#f43f5e" opacity="0.8" />
                    <rect x="33" y="6" width="21" height="26" rx="1" fill="#3b82f6" opacity="0.8" />
                    <rect x="10" y="34" width="44" height="24" rx="1" fill="#64748b" />
                    <rect x="14" y="30" width="36" height="6" rx="1.5" fill="#ffffff" />
                </svg>
            );
        case 'movie_pastel_dream':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="3" fill="#bae6fd" />
                    <circle cx="22" cy="16" r="7" fill="#ffffff" opacity="0.6" />
                    <circle cx="42" cy="22" r="9" fill="#fbcfe8" opacity="0.7" />
                    <rect x="12" y="10" width="40" height="36" rx="2" fill="#64748b" opacity="0.5" />
                    <rect x="16" y="48" width="32" height="5" rx="1.5" fill="#f472b6" />
                </svg>
            );
        case 'movie_vieon_fireworks':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="3" fill="#052e16" />
                    <rect x="12" y="8" width="12" height="4" rx="2" fill="#22c55e" />
                    <circle cx="18" cy="24" r="1.5" fill="#86efac" />
                    <circle cx="44" cy="18" r="2" fill="#86efac" />
                    <circle cx="36" cy="34" r="1.5" fill="#86efac" />
                    <rect x="12" y="14" width="40" height="32" rx="2" fill="#64748b" opacity="0.4" />
                    <rect x="16" y="48" width="32" height="4" rx="1" fill="#ffffff" />
                </svg>
            );
        case 'movie_dong_thoai':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="3" fill="#e5decf" />
                    <rect x="12" y="8" width="40" height="22" rx="1" fill="#b45309" opacity="0.6" />
                    <line x1="32" y1="26" x2="32" y2="44" stroke="#451a03" strokeWidth="2" />
                    <circle cx="32" cy="28" r="7" fill="#15803d" opacity="0.8" />
                    <rect x="12" y="38" width="40" height="20" rx="1" fill="#78350f" opacity="0.6" />
                    <rect x="20" y="52" width="24" height="4" rx="1" fill="#1c1917" />
                </svg>
            );
        case 'grid_10_max':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="8" y="4" width="48" height="56" rx="4" fill="#0f172a" />
                    <rect x="12" y="8" width="40" height="4" rx="1" fill={stroke} />
                    <rect x="12" y="14" width="19" height="14" rx="2" fill="#64748b" />
                    <rect x="33" y="14" width="19" height="14" rx="2" fill="#64748b" />
                    <rect x="12" y="30" width="12" height="11" rx="1.5" fill="#94a3b8" />
                    <rect x="26" y="30" width="12" height="11" rx="1.5" fill="#94a3b8" />
                    <rect x="40" y="30" width="12" height="11" rx="1.5" fill="#94a3b8" />
                    <rect x="12" y="43" width="7" height="11" rx="1" fill="#cbd5e1" />
                    <rect x="20.2" y="43" width="7" height="11" rx="1" fill="#cbd5e1" />
                    <rect x="28.5" y="43" width="7" height="11" rx="1" fill="#cbd5e1" />
                    <rect x="36.8" y="43" width="7" height="11" rx="1" fill="#cbd5e1" />
                    <rect x="45" y="43" width="7" height="11" rx="1" fill="#cbd5e1" />
                </svg>
            );
        case 'magazine_vogue':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="10" y="4" width="44" height="56" rx="3" fill="#334155" />
                    <rect x="14" y="8" width="36" height="8" rx="1" fill="#ffffff" opacity="0.9" />
                    <rect x="14" y="48" width="12" height="6" fill="#ffffff" />
                    <rect x="29" y="42" width="7" height="12" rx="1" fill="#cbd5e1" />
                    <rect x="37" y="42" width="7" height="12" rx="1" fill="#cbd5e1" />
                    <rect x="45" y="42" width="7" height="12" rx="1" fill="#cbd5e1" />
                </svg>
            );
        case 'polaroid_moodboard':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#fef3c7" stroke="#fde68a" strokeWidth="1" />
                    <g transform="rotate(-6 18 20)">
                        <rect x="9" y="10" width="15" height="18" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                        <rect x="11" y="12" width="11" height="11" fill="#94a3b8" />
                    </g>
                    <g transform="rotate(4 34 19)">
                        <rect x="26" y="10" width="15" height="18" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                        <rect x="28" y="12" width="11" height="11" fill={stroke} opacity="0.7" />
                    </g>
                </svg>
            );
        case 'cinema_film_strip':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="10" y="4" width="44" height="56" rx="2" fill="#09090b" />
                    <rect x="12" y="8" width="3" height="4" fill="#ffffff" />
                    <rect x="12" y="24" width="3" height="4" fill="#ffffff" />
                    <rect x="12" y="40" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="8" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="24" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="40" width="3" height="4" fill="#ffffff" />
                    <rect x="17" y="8" width="30" height="14" rx="1" fill="#f59e0b" opacity="0.8" />
                    <rect x="17" y="26" width="30" height="14" rx="1" fill="#64748b" />
                </svg>
            );
        case 'newspaper_retro':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="10" y="4" width="44" height="56" rx="2" fill="#f6f1e8" stroke="#78350f" strokeWidth="1.5" />
                    <rect x="14" y="8" width="36" height="5" fill="#1e293b" />
                    <rect x="14" y="16" width="36" height="20" fill="#94a3b8" />
                    <rect x="14" y="39" width="36" height="3" fill="#475569" />
                    <rect x="14" y="45" width="11" height="11" fill="#64748b" />
                    <rect x="26.5" y="45" width="11" height="11" fill="#64748b" />
                    <rect x="39" y="45" width="11" height="11" fill="#64748b" />
                </svg>
            );
        case 'wall_gallery_5':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="10" width="56" height="44" rx="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="8" y="24" width="7" height="12" fill="#64748b" stroke="#92400e" strokeWidth="1.5" />
                    <rect x="17" y="21" width="9" height="18" fill="#64748b" stroke="#92400e" strokeWidth="1.5" />
                    <rect x="28" y="17" width="10" height="26" fill={stroke} opacity="0.8" stroke="#92400e" strokeWidth="2" />
                    <rect x="40" y="21" width="9" height="18" fill="#64748b" stroke="#92400e" strokeWidth="1.5" />
                    <rect x="51" y="24" width="7" height="12" fill="#64748b" stroke="#92400e" strokeWidth="1.5" />
                </svg>
            );
        case 'story_9_16_music':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="16" y="4" width="32" height="56" rx="5" fill="#1e293b" />
                    <rect x="20" y="9" width="24" height="20" rx="3" fill={stroke} opacity="0.8" />
                    <rect x="20" y="31" width="11" height="10" rx="2" fill="#94a3b8" />
                    <rect x="33" y="31" width="11" height="10" rx="2" fill="#94a3b8" />
                    <rect x="20" y="44" width="24" height="11" rx="3" fill="#ffffff" opacity="0.2" />
                    <circle cx="25" cy="49.5" r="3" fill="#ffffff" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="4" y="4" width="56" height="56" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                    <rect x="12" y="12" width="40" height="40" rx="3" fill={stroke} opacity="0.75" />
                </svg>
            );
    }
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
    // 1. Category Switcher State (Kỷ Yếu vs Phim Ảnh)
    const [activeCategory, setActiveCategory] = useState<PosterCategory>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_CATEGORY);
            if (saved === 'ky_yeu' || saved === 'phim_anh') return saved;
        } catch {
            // Safe
        }
        return 'ky_yeu';
    });

    const [internalTemplateId, setInternalTemplateId] = useState<PosterTemplateId>('tnt_wood_classic');
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

    // Save branding & category automatically
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(branding));
        } catch {
            // Safe
        }
    }, [branding]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_CATEGORY, activeCategory);
        } catch {
            // Safe
        }
    }, [activeCategory]);

    // Filter templates by current category
    const categoryTemplates = POSTER_TEMPLATES.filter((t) => t.category === activeCategory);
    const currentTemplate = POSTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || categoryTemplates[0];

    // Ensure selected template matches active category
    const handleSwitchCategory = (cat: PosterCategory) => {
        setActiveCategory(cat);
        const match = POSTER_TEMPLATES.find((t) => t.category === cat);
        if (match && currentTemplate.category !== cat) {
            setSelectedTemplateId(match.id);
        }
    };

    const buildOptions = (): PosterOptions => ({
        templateId: selectedTemplateId,
        category: activeCategory,
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
            {/* Top Category Tabs (Kỷ Yếu vs Phim Ảnh) */}
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
                    <span>Kỷ Yếu Học Đường ({POSTER_TEMPLATES.filter((t) => t.category === 'ky_yeu').length})</span>
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
                    <span>Poster Phim Ảnh ({POSTER_TEMPLATES.filter((t) => t.category === 'phim_anh').length})</span>
                </button>
            </div>

            {/* Smart Photo Slot Manager (Khay Gán Ảnh Trực Quan Theo Từng Ô) */}
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

            {/* 1. Chọn Mẫu Poster (Phân theo chủ đề) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        1. Chọn Mẫu ({categoryTemplates.length} Mẫu {activeCategory === 'ky_yeu' ? 'Kỷ Yếu' : 'Phim Ảnh'})
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-500/20">
                        Khổ {currentTemplate.aspectRatio}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[310px] overflow-y-auto pr-1 scrollbar-thin">
                    {categoryTemplates.map((tpl) => {
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
                                    <div className="w-11 h-11 rounded-lg bg-slate-100 p-0.5 flex-shrink-0 overflow-hidden ring-1 ring-slate-900/5">
                                        <TemplateWireframeSvg id={tpl.id} activeColor={branding.accentColor} />
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
                        {/* Concept Name with Quick Picks */}
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
                                placeholder="Tuổi Học Trò / Thanh Xuân Rực Rỡ..."
                                className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        {/* Quote Selector / Preset */}
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

                        {/* Studio & Year */}
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

                        {/* Slogan & Hotline */}
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
                        {/* Movie Title */}
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

                        {/* Subtitle / English Tagline */}
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

                        {/* OTT Streaming Platform Logo Selector */}
                        <div>
                            <span className="block text-[10px] font-semibold text-slate-600 mb-1">Logo Nền Tảng / Kênh Phát Sóng</span>
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

                        {/* Broadcast Time & Release Date */}
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

            {/* 3. Màu Chủ Đạo & Căn Khung Khuôn Mặt */}
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

                {/* AI Căn Khung Mặt + Độ Phân Giải */}
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
                            : `Xuất Poster "${currentTemplate.name}"`}
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
                        <span>Xuất Toàn Bộ Mẫu ({categoryTemplates.length})</span>
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