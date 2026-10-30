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
            {/* Header: Title + Active Model ID */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Model Tạo Ảnh
                    </label>
                    <span
                        className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md truncate max-w-[170px]"
                        title={selectedModel}
                    >
                        {selectedModel.replace('ag/', '').replace('openrouter/', '')}
                    </span>
                </div>

                {/* Collapsible Dropdown Selector */}
                <div className="relative" ref={dropdownRef}>
                    {/* Collapsed Trigger Button - Min 46px touch target */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(prev => !prev)}
                        className={`w-full flex items-center justify-between p-2.5 sm:p-3 min-h-[46px] rounded-xl text-left bg-white border transition-all duration-150 shadow-xs group select-none ${
                            isOpen
                                ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/80'
                        }`}
                        aria-expanded={isOpen}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {/* Status Indicator */}
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"></span>

                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                        {currentModelObj ? currentModelObj.name : selectedModel}
                                    </span>
                                    {currentModelObj && (
                                        <span
                                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap tracking-tight ${
                                                currentModelObj.tagColor === 'emerald'
                                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                                    : currentModelObj.tagColor === 'blue'
                                                        ? 'bg-blue-50 text-blue-800 border border-blue-300'
                                                        : currentModelObj.tagColor === 'purple'
                                                            ? 'bg-purple-50 text-purple-800 border border-purple-300'
                                                            : 'bg-indigo-50 text-indigo-800 border border-indigo-300'
                                            }`}
                                        >
                                            {currentModelObj.tag}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate leading-snug mt-0.5">
                                    {currentModelObj ? currentModelObj.description : 'Model ID tùy chỉnh'}
                                </p>
                            </div>
                        </div>

                        {/* Chevron Icon & Action hint */}
                        <div className="flex items-center gap-1 flex-shrink-0 pl-1 text-slate-400 group-hover:text-slate-700">
                            <span className="text-[10px] font-semibold hidden sm:inline text-slate-500">
                                {isOpen ? 'Thu gọn' : 'Đổi model'}
                            </span>
                            <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {/* Expanded Model List */}
                    {isOpen && (
                        <div className="mt-2 bg-white border border-slate-300 rounded-xl shadow-lg p-2 space-y-1.5 animate-fade-in z-30">
                            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                                <span>Chọn model chuẩn ảnh (100% hoạt động)</span>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomInput(v => !v)}
                                    className="text-indigo-600 cursor-pointer hover:underline text-[10px] normal-case font-bold"
                                >
                                    {showCustomInput ? 'Ẩn tự nhập' : '+ Nhập ID khác'}
                                </button>
                            </div>

                            {/* Optional Custom Model Input Box */}
                            {showCustomInput && (
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex gap-1.5 animate-fade-in">
                                    <input
                                        type="text"
                                        value={customModelInput}
                                        onChange={(e) => setCustomModelInput(e.target.value)}
                                        placeholder="Nhập ID model (vd: dall-e-3, flux-pro)..."
                                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-indigo-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyCustomModel}
                                        className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-all shadow-xs"
                                    >
                                        Áp dụng
                                    </button>
                                </div>
                            )}

                            {/* List of Models */}
                            <div className="space-y-1 max-h-[290px] overflow-y-auto custom-scrollbar">
                                {SUPPORTED_IMAGE_MODELS.map((model) => {
                                    const isSelected = selectedModel === model.id;
                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => handleSelectModel(model.id)}
                                            className={`w-full p-2.5 rounded-xl text-left transition-all duration-150 flex items-start justify-between gap-2 min-h-[44px] ${
                                                isSelected
                                                    ? 'bg-indigo-50/90 border border-indigo-300 shadow-xs'
                                                    : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                    <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                                                        {model.name}
                                                    </span>
                                                    <span
                                                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap tracking-tight ${
                                                            model.tagColor === 'emerald'
                                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                                                : model.tagColor === 'blue'
                                                                    ? 'bg-blue-50 text-blue-800 border border-blue-300'
                                                                    : model.tagColor === 'purple'
                                                                        ? 'bg-purple-50 text-purple-800 border border-purple-300'
                                                                        : 'bg-indigo-50 text-indigo-800 border border-indigo-300'
                                                        }`}
                                                    >
                                                        {model.tag}
                                                    </span>
                                                </div>
                                                <p className={`text-[11px] leading-snug line-clamp-2 ${isSelected ? 'text-indigo-700 font-medium' : 'text-slate-600'}`}>
                                                    {model.description}
                                                </p>
                                            </div>

                                            {/* Selected Checkmark */}
                                            {isSelected && (
                                                <div className="p-1 rounded-full bg-indigo-600 text-white flex-shrink-0 mt-0.5 shadow-xs">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
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
