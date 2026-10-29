import React, { useState, useEffect } from 'react';
import { UserCircleIcon } from './Icons';
import { ModelSelector } from './ModelSelector';
import { getActiveTemplates, ClothingTemplate, GENDER_LABELS, CATEGORY_LABELS } from '../services/clothingTemplateService';

interface IdPhotoPanelProps {
    onGenerate: (clothing: string, bgColor: string, aspectRatio: string, gender: string, hairstyle: string, clothingRef?: { data: string; mimeType: string }) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasApiKey: boolean;
    hasInputImage: boolean;
}

// --- CONFIGURATION DATA ---

const genders = [
    { id: 'male', label: 'Nam' },
    { id: 'female', label: 'Nữ' }
];

const hairstyles = {
    male: [
        { id: 'original', label: 'Giữ nguyên tóc gốc' },
        { id: 'side_part', label: 'Side Part (7/3)' },
        { id: 'undercut', label: 'Undercut gọn gàng' },
        { id: 'pompadour', label: 'Vuốt ngược (Pompadour)' },
        { id: 'buzz_cut', label: 'Đầu đinh (Buzz Cut)' },
        { id: 'korean_layer', label: 'Layer Hàn Quốc' },
    ],
    female: [
        { id: 'original', label: 'Giữ nguyên tóc gốc' },
        { id: 'long_straight', label: 'Dài thẳng tự nhiên' },
        { id: 'bob_cut', label: 'Tóc ngắn (Bob)' },
        { id: 'bun', label: 'Búi cao gọn gàng' },
        { id: 'ponytail', label: 'Buộc đuôi ngựa' },
        { id: 'wavy', label: 'Xoăn sóng nhẹ' },
    ]
};

// Fallback clothing options (used when Firestore has no data)
const fallbackClothingOptions = {
    male: [
        { id: 'shirt_white_textured', label: 'Sơ mi trắng (Gấm/Sần)' },
        { id: 'suit_black_striped_tie', label: 'Vest đen + Cà vạt sọc' },
        { id: 'suit_no_tie', label: 'Vest đen (Không nơ)' },
    ],
    female: [
        { id: 'ao_dai_white', label: 'Áo dài trắng' },
        { id: 'shirt_white_female', label: 'Sơ mi trắng nữ' },
        { id: 'suit_female', label: 'Vest nữ công sở' },
    ]
};

const bgColors = [
    { id: 'blue', label: 'Xanh dương', class: 'bg-blue-600' },
    { id: 'white', label: 'Trắng', class: 'bg-white border border-slate-200' },
    { id: 'grey', label: 'Xám sáng', class: 'bg-gray-300' },
    { id: 'transparent', label: 'Trong suốt', class: 'bg-[length:16px_16px] bg-[repeating-conic-gradient(#d1d5db_0%_25%,#fff_0%_50%)]' },
];

const aspectRatios = [
    { label: '3x4 (Dọc)', value: '3:4' },
    { label: '4x6 (Dọc)', value: '2:3' },
    { label: 'Vuông (1:1)', value: '1:1' },
];

export const IdPhotoPanel: React.FC<IdPhotoPanelProps> = ({ onGenerate, isLoading, isDisabled, hasApiKey, hasInputImage }) => {
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [selectedClothing, setSelectedClothing] = useState('');
    const [selectedHairstyle, setSelectedHairstyle] = useState('original');
    const [selectedBg, setSelectedBg] = useState(bgColors[0].id);
    const [aspectRatio, setAspectRatio] = useState('3:4');

    // Firestore clothing templates
    const [clothingTemplates, setClothingTemplates] = useState<ClothingTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<ClothingTemplate | null>(null);

    // Load clothing templates from Firestore
    useEffect(() => {
        const loadTemplates = async () => {
            setLoadingTemplates(true);
            try {
                const templates = await getActiveTemplates();
                setClothingTemplates(templates);
                console.log('[IdPhotoPanel] Loaded', templates.length, 'clothing templates from Firestore');
            } catch (error) {
                console.error('[IdPhotoPanel] Error loading templates:', error);
            }
            setLoadingTemplates(false);
        };
        loadTemplates();
    }, []);

    // Filter templates by gender
    const filteredTemplates = clothingTemplates.filter(t =>
        t.gender === gender || t.gender === 'unisex'
    );

    // Use Firestore templates or fallback
    const hasFirestoreTemplates = filteredTemplates.length > 0;

    useEffect(() => {
        if (hasFirestoreTemplates) {
            // Select first Firestore template
            setSelectedTemplate(filteredTemplates[0]);
            setSelectedClothing(filteredTemplates[0].id);
        } else {
            // Fallback to hardcoded options
            setSelectedClothing(fallbackClothingOptions[gender][0].id);
            setSelectedTemplate(null);
        }
        setSelectedHairstyle('original');
    }, [gender, clothingTemplates]);

    const handleSelectTemplate = (template: ClothingTemplate) => {
        setSelectedTemplate(template);
        setSelectedClothing(template.id);
    };

    const handleGenerate = () => {
        if (!isLoading && !isDisabled && hasInputImage) {
            // If using Firestore template, pass the image reference
            if (selectedTemplate && selectedTemplate.imageBase64) {
                onGenerate(
                    selectedTemplate.name, // Use name as clothing description
                    selectedBg,
                    aspectRatio,
                    gender,
                    selectedHairstyle,
                    { data: selectedTemplate.imageBase64, mimeType: 'image/jpeg' }
                );
            } else {
                // Fallback - no reference image
                onGenerate(selectedClothing, selectedBg, aspectRatio, gender, selectedHairstyle);
            }
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex gap-3 backdrop-blur-sm">
                <div className="bg-white p-2 rounded-full shadow-sm">
                    <UserCircleIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-indigo-900">Chế độ Ảnh thẻ Pro</h3>
                    <p className="text-[10px] text-indigo-700/80 mt-0.5 font-medium">
                        Giữ nguyên khuôn mặt • Thay đổi trang phục & Tóc
                        {hasFirestoreTemplates && (
                            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">
                                ✓ {filteredTemplates.length} mẫu trang phục
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* 1. Gender */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">1. Giới tính</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {genders.map((g) => (
                        <button
                            key={g.id}
                            onClick={() => setGender(g.id as 'male' | 'female')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all
                            ${gender === g.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Hairstyle */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">2. Kiểu tóc</label>
                <div className="relative group">
                    <select
                        value={selectedHairstyle}
                        onChange={(e) => setSelectedHairstyle(e.target.value)}
                        className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                    >
                        {hairstyles[gender].map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                    </select>
                </div>
            </div>

            {/* 3. Clothing - Dynamic from Firestore or Fallback */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    3. Trang phục
                    {loadingTemplates && <span className="ml-2 text-indigo-500 font-normal">Đang tải...</span>}
                </label>

                {hasFirestoreTemplates ? (
                    // Firestore templates with image preview
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {filteredTemplates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => handleSelectTemplate(template)}
                                className={`relative rounded-xl border overflow-hidden text-left transition-all group
                                ${selectedTemplate?.id === template.id
                                        ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-md'
                                        : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
                            >
                                {/* Image */}
                                <div className="aspect-[3/4] bg-slate-100 overflow-hidden">
                                    {template.thumbnailBase64 ? (
                                        <img
                                            src={`data:image/jpeg;base64,${template.thumbnailBase64}`}
                                            alt={template.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                    ) : template.imageBase64 ? (
                                        <img
                                            src={`data:image/jpeg;base64,${template.imageBase64}`}
                                            alt={template.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <span className="text-2xl">👔</span>
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <div className="p-2 bg-white">
                                    <p className="text-xs font-semibold text-slate-700 truncate">{template.name}</p>
                                    <p className="text-[10px] text-slate-400">{CATEGORY_LABELS[template.category]}</p>
                                </div>

                                {/* Selected indicator */}
                                {selectedTemplate?.id === template.id && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    // Fallback: Simple list without images
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {fallbackClothingOptions[gender].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => {
                                    setSelectedClothing(opt.id);
                                    setSelectedTemplate(null);
                                }}
                                className={`px-4 py-3 rounded-xl border text-left text-xs font-semibold transition-all
                                ${selectedClothing === opt.id
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        <p className="text-[10px] text-amber-600 italic px-2 py-1 bg-amber-50 rounded-lg">
                            💡 Thêm trang phục mẫu trong Admin Panel để có ảnh đẹp hơn
                        </p>
                    </div>
                )}
            </div>

            {/* 4. Background */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">4. Màu nền</label>
                <div className="flex gap-3">
                    {bgColors.map((bg) => (
                        <button
                            key={bg.id}
                            onClick={() => setSelectedBg(bg.id)}
                            className={`w-10 h-10 rounded-full ${bg.class} shadow-sm transition-transform hover:scale-110 border border-slate-200 ring-offset-2
                            ${selectedBg === bg.id ? 'ring-2 ring-indigo-500' : ''}`}
                            title={bg.label}
                        />
                    ))}
                </div>
            </div>

            {/* 5. Aspect Ratio */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">5. Tỷ lệ ảnh</label>
                <div className="relative group">
                    <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                    >
                        {aspectRatios.map(ar => <option key={ar.value} value={ar.value}>{ar.label}</option>)}
                    </select>
                </div>
            </div>

            {/* 6. Model AI */}
            <div>
                <ModelSelector className="" imageCount={4} />
            </div>

            <div className="panel-action-wrapper">
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || isDisabled || !hasInputImage}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 animate-gradient-x text-white font-bold rounded-xl hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Đang xử lý...
                        </span>
                    ) : "TẠO ẢNH THẺ NGAY"}
                </button>
            </div>
        </div>
    );
};