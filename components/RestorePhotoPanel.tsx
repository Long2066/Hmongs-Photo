import React, { useState } from 'react';
import { SparklesIcon, MagicWandIcon } from './Icons';
import { ModelSelector } from './ModelSelector';

interface RestorePhotoPanelProps {
    onGenerate: (options: {
        enhancementLevel: 'light' | 'medium' | 'strong';
        colorMode: 'auto' | 'warm' | 'cool' | 'sepia';
        faceEnhance: boolean;
    }) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
}

const enhancementLevels = [
    { id: 'light', label: 'Nhẹ', desc: 'Giữ nguyên cảm giác vintage' },
    { id: 'medium', label: 'Vừa', desc: 'Cân bằng giữa cũ và mới' },
    { id: 'strong', label: 'Mạnh', desc: 'Phục hồi hoàn toàn như mới' }
] as const;

const colorModes = [
    { id: 'auto', label: 'Tự động', desc: 'AI tự chọn màu phù hợp' },
    { id: 'warm', label: 'Ấm', desc: 'Tông màu vàng ấm' },
    { id: 'cool', label: 'Lạnh', desc: 'Tông màu xanh mát' },
    { id: 'sepia', label: 'Giữ Sepia', desc: 'Giữ tông nâu cổ điển' }
] as const;

export const RestorePhotoPanel: React.FC<RestorePhotoPanelProps> = ({
    onGenerate,
    isLoading,
    isDisabled,
    hasInputImage
}) => {
    const [enhancementLevel, setEnhancementLevel] = useState<'light' | 'medium' | 'strong'>('medium');
    const [colorMode, setColorMode] = useState<'auto' | 'warm' | 'cool' | 'sepia'>('auto');
    const [faceEnhance, setFaceEnhance] = useState(true);

    const handleGenerate = () => {
        onGenerate({
            enhancementLevel,
            colorMode,
            faceEnhance
        });
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200/80 flex gap-3 shadow-xs ring-1 ring-amber-500/10">
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-full shadow-lg">
                    <MagicWandIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-amber-900">Phục Hồi Ảnh Cũ</h3>
                    <p className="text-[10px] text-amber-700/80 mt-0.5 font-medium">
                        AI tự động nhận diện • Tô màu • 8K Ultra Sharp
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>✨ Tính năng:</strong> AI sẽ tự động nhận diện giới tính, độ tuổi,
                    ngoại hình và phục hồi ảnh cũ về chất lượng 8K sắc nét với màu sắc tự nhiên.
                </p>
            </div>

            {/* Enhancement Level */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Mức Độ Phục Hồi
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {enhancementLevels.map((level) => (
                        <button
                            key={level.id}
                            onClick={() => setEnhancementLevel(level.id)}
                            className={`p-3 rounded-xl border transition-all text-center ${enhancementLevel === level.id
                                ? 'bg-amber-50 border-amber-400 shadow-sm ring-2 ring-amber-200'
                                : 'bg-white border-slate-200 hover:border-amber-300'
                                }`}
                        >
                            <span className={`text-sm font-bold block ${enhancementLevel === level.id ? 'text-amber-700' : 'text-slate-600'
                                }`}>
                                {level.label}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1 block">{level.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Color Mode */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Chế Độ Màu Sắc
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {colorModes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setColorMode(mode.id)}
                            className={`p-3 rounded-xl border transition-all text-left ${colorMode === mode.id
                                ? 'bg-amber-50 border-amber-400 shadow-sm ring-2 ring-amber-200'
                                : 'bg-white border-slate-200 hover:border-amber-300'
                                }`}
                        >
                            <span className={`text-xs font-bold block ${colorMode === mode.id ? 'text-amber-700' : 'text-slate-600'
                                }`}>
                                {mode.label}
                            </span>
                            <span className="text-[10px] text-slate-500">{mode.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Face Enhance Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                    <span className="text-xs font-bold text-slate-700 block">Cải Thiện Khuôn Mặt</span>
                    <span className="text-[10px] text-slate-500">Làm rõ mắt, da, và chi tiết mặt</span>
                </div>
                <button
                    onClick={() => setFaceEnhance(!faceEnhance)}
                    className={`relative w-12 h-6 rounded-full transition-all ${faceEnhance ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${faceEnhance ? 'left-6' : 'left-0.5'
                        }`} />
                </button>
            </div>

            {/* Model Selector */}
            <div>
                <ModelSelector className="" imageCount={1} />
            </div>

            {/* Generate Button */}
            <div className="panel-action-wrapper mt-1">
                {(() => {
                    const isRestoreDisabled = isLoading || isDisabled || !hasInputImage;
                    return (
                        <button
                            onClick={handleGenerate}
                            disabled={isRestoreDisabled}
                            className={`w-full px-6 py-3.5 font-bold text-xs sm:text-sm rounded-xl transition-all duration-150 select-none shadow-sm ${
                                isRestoreDisabled
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200/90 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] text-white shadow-amber-500/25 ring-1 ring-amber-500/20 cursor-pointer'
                            }`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Đang phục hồi ảnh...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <SparklesIcon className="w-5 h-5" />
                                    PHỤC HỒI ẢNH NGAY
                                </span>
                            )}
                        </button>
                    );
                })()}
            </div>

            {/* Tip */}
            <p className="text-[10px] text-slate-400 text-center">
                💡 Mẹo: Ảnh càng rõ nét ban đầu, kết quả phục hồi càng tốt
            </p>
        </div>
    );
};
