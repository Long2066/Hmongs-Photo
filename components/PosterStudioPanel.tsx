import React, { useState, useEffect } from 'react';
import {
    POSTER_TEMPLATES,
    THEME_COLOR_PRESETS,
    PosterOptions,
    PosterTemplateId
} from '../services/posterRenderService';

interface PosterStudioPanelProps {
    onGeneratePoster: (options: PosterOptions, batchMode: 'single' | 'top4' | 'all10', shuffleSeed: number) => void;
    isLoading: boolean;
    hasInputImage: boolean;
    inputCount: number;
    selectedTemplateId?: PosterTemplateId;
    onTemplateSelect?: (id: PosterTemplateId) => void;
}

const STORAGE_KEY_BRANDING = 'imagetool_poster_branding_v1';

interface SavedBranding {
    conceptName: string;
    studioName: string;
    slogan: string;
    hotline: string;
    yearTag: string;
    accentColor: string;
}

const DEFAULT_BRANDING: SavedBranding = {
    conceptName: 'Dormitory',
    studioName: 'TNT MEDIA',
    slogan: 'TOP 10 KỶ YẾU CÓ TÂM',
    hotline: '094 191 59 68',
    yearTag: 'kỷ yếu 2025-2026',
    accentColor: '#e11d48'
};

/** Mini Wireframe SVG Preview showing the exact layout structure of each of the 10 templates */
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
                    <g transform="rotate(-3 50 20)">
                        <rect x="43" y="11" width="14" height="18" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                        <rect x="45" y="13" width="10" height="11" fill="#64748b" />
                    </g>
                    <g transform="rotate(5 22 42)">
                        <rect x="12" y="34" width="16" height="18" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                        <rect x="14" y="36" width="12" height="11" fill="#64748b" />
                    </g>
                    <g transform="rotate(-4 44 42)">
                        <rect x="36" y="34" width="16" height="18" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                        <rect x="38" y="36" width="12" height="11" fill="#94a3b8" />
                    </g>
                </svg>
            );
        case 'cinema_film_strip':
            return (
                <svg viewBox="0 0 64 64" className="w-full h-full">
                    <rect x="10" y="4" width="44" height="56" rx="2" fill="#09090b" />
                    <rect x="12" y="8" width="3" height="4" fill="#ffffff" />
                    <rect x="12" y="18" width="3" height="4" fill="#ffffff" />
                    <rect x="12" y="28" width="3" height="4" fill="#ffffff" />
                    <rect x="12" y="38" width="3" height="4" fill="#ffffff" />
                    <rect x="12" y="48" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="8" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="18" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="28" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="38" width="3" height="4" fill="#ffffff" />
                    <rect x="49" y="48" width="3" height="4" fill="#ffffff" />
                    <rect x="17" y="8" width="30" height="11" rx="1" fill="#f59e0b" opacity="0.7" />
                    <rect x="17" y="21" width="30" height="11" rx="1" fill="#64748b" />
                    <rect x="17" y="34" width="30" height="11" rx="1" fill="#64748b" />
                    <rect x="17" y="47" width="30" height="10" rx="1" fill="#94a3b8" />
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
                    <rect x="30" y="48" width="11" height="2" rx="1" fill="#ffffff" />
                </svg>
            );
    }
};

export const PosterStudioPanel: React.FC<PosterStudioPanelProps> = ({
    onGeneratePoster,
    isLoading,
    hasInputImage,
    inputCount,
    selectedTemplateId: externalTemplateId,
    onTemplateSelect
}) => {
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

    // Persist studio branding automatically
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(branding));
        } catch {
            // Safe ignore
        }
    }, [branding]);

    const currentTemplate = POSTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || POSTER_TEMPLATES[0];

    const buildOptions = (): PosterOptions => ({
        templateId: selectedTemplateId,
        conceptName: branding.conceptName,
        studioName: branding.studioName,
        slogan: branding.slogan,
        hotline: branding.hotline,
        yearTag: branding.yearTag,
        accentColor: branding.accentColor,
        resolution,
        cropBiasY
    });

    const handleTriggerSingle = () => {
        if (!hasInputImage || isLoading) return;
        onGeneratePoster(buildOptions(), 'single', shuffleSeed);
    };

    const handleTriggerBatch4 = () => {
        if (!hasInputImage || isLoading) return;
        onGeneratePoster(buildOptions(), 'top4', shuffleSeed);
    };

    const handleTriggerAll10 = () => {
        if (!hasInputImage || isLoading) return;
        onGeneratePoster(buildOptions(), 'all10', shuffleSeed);
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Hero Intro Card */}
            <div className="bg-slate-50/80 p-3.5 rounded-2xl ring-1 ring-slate-900/5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-lg flex-shrink-0">
                    🖼️
                </div>
                <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">
                        Ghép Poster Studio (0đ • Siêu Tốc)
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Nhận tối đa <strong className="text-violet-700 font-semibold">10 ảnh</strong>, tích hợp AI tự động khóa khuôn mặt & mũ trên cả ảnh ngang/dọc, không bị cắt mất đầu.
                    </p>
                </div>
            </div>

            {/* 1. Chọn 10 kiểu Poster Studio */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        1. Chọn Kiểu Poster (10 Mẫu)
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-500/20">
                        {currentTemplate.aspectRatio}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {POSTER_TEMPLATES.map((tpl) => {
                        const isSelected = tpl.id === selectedTemplateId;
                        return (
                            <button
                                key={tpl.id}
                                type="button"
                                onClick={() => setSelectedTemplateId(tpl.id)}
                                className={`group relative flex flex-col p-2 rounded-xl text-left transition-all duration-150 cursor-pointer min-h-[44px] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
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
                                        <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full mb-0.5 ${
                                            isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {tpl.badge}
                                        </span>
                                        <p className={`text-[11px] font-semibold leading-tight truncate ${
                                            isSelected ? 'text-violet-950' : 'text-slate-900'
                                        }`}>
                                            {tpl.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                            {tpl.recommendedImages}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Selected Template Detail Pill */}
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-900/5">
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">{currentTemplate.name}:</strong> {currentTemplate.description}
                    </p>
                </div>
            </div>

            {/* 2. Thông tin Studio & Thương hiệu */}
            <div className="space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    2. Thông tin Studio & Chữ Poster
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Tên Concept</span>
                        <input
                            type="text"
                            value={branding.conceptName}
                            onChange={(e) => setBranding((prev) => ({ ...prev, conceptName: e.target.value }))}
                            placeholder="Dormitory / Thanh Xuân..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow"
                        />
                    </div>
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Niên khóa / Tag</span>
                        <input
                            type="text"
                            value={branding.yearTag}
                            onChange={(e) => setBranding((prev) => ({ ...prev, yearTag: e.target.value }))}
                            placeholder="kỷ yếu 2025-2026"
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Tên Studio</span>
                        <input
                            type="text"
                            value={branding.studioName}
                            onChange={(e) => setBranding((prev) => ({ ...prev, studioName: e.target.value }))}
                            placeholder="TNT MEDIA..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow"
                        />
                    </div>
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Hotline / Zalo</span>
                        <input
                            type="text"
                            value={branding.hotline}
                            onChange={(e) => setBranding((prev) => ({ ...prev, hotline: e.target.value }))}
                            placeholder="094 191 59 68"
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow"
                        />
                    </div>
                </div>

                <div>
                    <span className="block text-[10px] font-semibold text-slate-600 mb-1">Slogan Chân Trang</span>
                    <input
                        type="text"
                        value={branding.slogan}
                        onChange={(e) => setBranding((prev) => ({ ...prev, slogan: e.target.value }))}
                        placeholder="TOP 10 KỶ YẾU CÓ TÂM"
                        className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow"
                    />
                </div>
            </div>

            {/* 3. Màu Chủ Đạo & Căn Khung */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        3. Tone Màu Chủ Đạo
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

                {/* Căn Khung Khuôn Mặt + Độ Phân Giải */}
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

                {/* Primary Action */}
                <button
                    type="button"
                    onClick={handleTriggerSingle}
                    disabled={isLoading || !hasInputImage}
                    className={`w-full min-h-[44px] py-3 px-4 rounded-xl font-semibold text-xs uppercase tracking-wider text-white transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] shadow-sm ${
                        isLoading || !hasInputImage
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-violet-500/25'
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
                        onClick={handleTriggerAll10}
                        disabled={isLoading || !hasInputImage}
                        className="min-h-[44px] px-3 py-2 rounded-xl font-semibold text-[11px] text-slate-700 bg-white ring-1 ring-slate-900/10 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <span>🎨</span>
                        <span>Xuất Cả 10 Kiểu</span>
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
