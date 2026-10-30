import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
    getSelectedResolution,
    setSelectedResolution,
    type ResolutionType
} from '../services/geminiCoreService';
import * as nineRouterService from '../services/nineRouterService';
import { SUPPORTED_IMAGE_MODELS } from '../services/nineRouterService';

interface ModelSelectorProps {
    onModelChange?: (modelId: string) => void;
    onResolutionChange?: (resolution: ResolutionType) => void;
    imageCount?: number;
    className?: string;
    showCostEstimate?: boolean;
    showResolution?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = memo(({
    onModelChange,
    onResolutionChange,
    className = '',
    showResolution = true
}) => {
    // Selected Image Model
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        const current = nineRouterService.getNineRouterImageModel();
        return SUPPORTED_IMAGE_MODELS.some(m => m.id === current) ? current : SUPPORTED_IMAGE_MODELS[0].id;
    });

    // Selected Resolution
    const [selectedRes, setSelectedRes] = useState<ResolutionType>(() =>
        getSelectedResolution()
    );

    // Dropdown open/collapse state (default collapsed for ultra-clean UI)
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Custom model input toggle & state
    const [customModelInput, setCustomModelInput] = useState<string>('');
    const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

    // Current selected model object
    const currentModelObj = SUPPORTED_IMAGE_MODELS.find(m => m.id === selectedModel);

    // Listen to real-time model changes from any modal/tab
    useEffect(() => {
        const handleModelChange = (e: any) => {
            const nextModel = e.detail?.model || nineRouterService.getNineRouterImageModel();
            setSelectedModel(nextModel);
        };

        window.addEventListener('ninerouter-model-changed', handleModelChange);
        window.addEventListener('storage', handleModelChange);

        return () => {
            window.removeEventListener('ninerouter-model-changed', handleModelChange);
            window.removeEventListener('storage', handleModelChange);
        };
    }, []);

    // Outside click listener to auto-close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Choose a predefined model
    const handleSelectModel = useCallback((modelId: string) => {
        setSelectedModel(modelId);
        nineRouterService.setNineRouterImageModel(modelId);
        onModelChange?.(modelId);
        setIsOpen(false); // Auto-collapse on selection for clean UX
    }, [onModelChange]);

    // Handle resolution change
    const handleResolutionChange = useCallback((res: ResolutionType) => {
        setSelectedResolution(res);
        setSelectedRes(res);
        onResolutionChange?.(res);
    }, [onResolutionChange]);

    // Handle apply custom model ID
    const handleApplyCustomModel = useCallback(() => {
        const trimmed = customModelInput.trim();
        if (!trimmed) return;
        setSelectedModel(trimmed);
        nineRouterService.setNineRouterImageModel(trimmed);
        onModelChange?.(trimmed);
        setIsOpen(false);
        setShowCustomInput(false);
        setCustomModelInput('');
    }, [customModelInput, onModelChange]);

    return (
        <div className={`space-y-3.5 ${className}`}>
            {/* Header: Title */}
            <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                    Model Tạo Ảnh
                </label>

                {/* Collapsible Dropdown Selector - Dạng nổi (Floating Overlay) */}
                <div className={`relative ${isOpen ? 'z-40' : 'z-10'}`} ref={dropdownRef}>
                    {/* Collapsed Trigger Button - Gọn nhất, chỉ hiển thị mỗi tên model */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(prev => !prev)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left bg-white border transition-all duration-150 shadow-xs group select-none cursor-pointer ${
                            isOpen
                                ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/80'
                        }`}
                        aria-expanded={isOpen}
                    >
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                            {currentModelObj ? currentModelObj.name : selectedModel.replace('ag/', '').replace('openrouter/', '')}
                        </span>

                        {/* Chevron Icon */}
                        <svg
                            className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Floating Dropdown Overlay (Lồng lên trên, dạng nổi, không đẩy xuống dưới) */}
                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-slate-900/5 p-1 z-50 animate-fade-in">
                            {/* List of Models - Gọn gàng chỉ hiển thị tên model */}
                            <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-0.5">
                                {SUPPORTED_IMAGE_MODELS.map((model) => {
                                    const isSelected = selectedModel === model.id;
                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => handleSelectModel(model.id)}
                                            className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between gap-2 min-h-[38px] cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                                            }`}
                                        >
                                            <span className="text-xs truncate">
                                                {model.name}
                                            </span>

                                            {/* Selected Checkmark */}
                                            {isSelected && (
                                                <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Optional Custom Model Input Box */}
                            <div className="border-t border-slate-100 mt-1 pt-1 px-1">
                                {!showCustomInput ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowCustomInput(true);
                                        }}
                                        className="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50/70 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <span className="text-sm leading-none font-bold">+</span>
                                        <span>Nhập ID model khác...</span>
                                    </button>
                                ) : (
                                    <div className="p-1 flex gap-1.5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={customModelInput}
                                            onChange={(e) => setCustomModelInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCustomModel(); }}
                                            placeholder="vd: gpt-image-2.5, gpt-image-1.5..."
                                            className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleApplyCustomModel}
                                            className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                                        >
                                            Lưu
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Resolution Selection - Pure Text */}
            {showResolution && (
                <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
                        Độ phân giải xuất ra
                    </label>
                    <div className="flex gap-2">
                        {(['HD', 'FHD', '2K', '4K'] as ResolutionType[]).map((res) => {
                            const isSelected = selectedRes === res;
                            return (
                                <button
                                    key={res}
                                    type="button"
                                    onClick={() => handleResolutionChange(res)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white border border-indigo-700 shadow-xs'
                                            : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-400 shadow-xs'
                                    }`}
                                >
                                    {res}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
