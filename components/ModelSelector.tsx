import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import {
    getSelectedResolution,
    setSelectedResolution,
    type ResolutionType
} from '../services/geminiCoreService';
import * as nineRouterService from '../services/nineRouterService';
import { SUPPORTED_IMAGE_MODELS, type SupportedImageModel } from '../services/nineRouterService';

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
    // Selected 9Router Image Model
    const [selectedModel, setSelectedModel] = useState<string>(() =>
        nineRouterService.getNineRouterImageModel()
    );

    // Selected Resolution
    const [selectedRes, setSelectedRes] = useState<ResolutionType>(() =>
        getSelectedResolution()
    );

    // Custom model input state
    const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
        const current = nineRouterService.getNineRouterImageModel();
        return !SUPPORTED_IMAGE_MODELS.some(m => m.id === current);
    });
    const [customModelText, setCustomModelText] = useState<string>(() => {
        const current = nineRouterService.getNineRouterImageModel();
        return SUPPORTED_IMAGE_MODELS.some(m => m.id === current) ? '' : current;
    });

    // Listen to real-time model changes from any modal/tab
    useEffect(() => {
        const handleModelChange = (e: any) => {
            const nextModel = e.detail?.model || nineRouterService.getNineRouterImageModel();
            setSelectedModel(nextModel);
            const isCustom = !SUPPORTED_IMAGE_MODELS.some(m => m.id === nextModel);
            setIsCustomMode(isCustom);
            if (isCustom) setCustomModelText(nextModel);
        };

        window.addEventListener('ninerouter-model-changed', handleModelChange);
        window.addEventListener('storage', handleModelChange);

        return () => {
            window.removeEventListener('ninerouter-model-changed', handleModelChange);
            window.removeEventListener('storage', handleModelChange);
        };
    }, []);

    // Active model info lookup
    const activeModelInfo = useMemo<SupportedImageModel | undefined>(() => {
        return SUPPORTED_IMAGE_MODELS.find(m => m.id === selectedModel);
    }, [selectedModel]);

    // Choose a predefined model tab
    const handleSelectModel = useCallback((modelId: string) => {
        setSelectedModel(modelId);
        setIsCustomMode(false);
        nineRouterService.setNineRouterImageModel(modelId);
        onModelChange?.(modelId);
    }, [onModelChange]);

    // Apply custom model
    const handleApplyCustomModel = useCallback(() => {
        const trimmed = customModelText.trim();
        if (!trimmed) return;
        setSelectedModel(trimmed);
        nineRouterService.setNineRouterImageModel(trimmed);
        onModelChange?.(trimmed);
    }, [customModelText, onModelChange]);

    // Handle resolution change
    const handleResolutionChange = useCallback((res: ResolutionType) => {
        setSelectedResolution(res);
        setSelectedRes(res);
        onResolutionChange?.(res);
    }, [onResolutionChange]);

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Header: Title + Active Model ID */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Model Tạo Ảnh
                    </label>
                    <span
                        className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md truncate max-w-[170px]"
                        title={selectedModel}
                    >
                        {selectedModel.replace('ag/', '')}
                    </span>
                </div>

                {/* Model Tabs Grid - Pure Text */}
                <div className="grid grid-cols-2 gap-1.5">
                    {SUPPORTED_IMAGE_MODELS.map((model) => {
                        const isSelected = selectedModel === model.id && !isCustomMode;
                        return (
                            <button
                                key={model.id}
                                type="button"
                                onClick={() => handleSelectModel(model.id)}
                                className={`group relative p-2.5 rounded-xl text-left transition-all duration-150 flex flex-col justify-between select-none ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/30 scale-[1.01]'
                                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 hover:border-indigo-300 shadow-xs'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1 w-full mb-1">
                                    <span className="text-xs font-bold truncate">
                                        {model.shortName}
                                    </span>
                                    <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap tracking-tight ${
                                            isSelected
                                                ? 'bg-white/20 text-white'
                                                : model.tagColor === 'emerald'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                                    : model.tagColor === 'purple'
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                                                        : model.tagColor === 'blue'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                                            : model.tagColor === 'amber'
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {model.tag}
                                    </span>
                                </div>
                                <span
                                    className={`text-[10px] line-clamp-1 leading-tight ${
                                        isSelected ? 'text-indigo-100' : 'text-slate-400 group-hover:text-slate-500'
                                    }`}
                                >
                                    {model.description}
                                </span>
                            </button>
                        );
                    })}

                    {/* Custom Model Tab - Pure Text */}
                    <button
                        type="button"
                        onClick={() => setIsCustomMode(!isCustomMode)}
                        className={`p-2.5 rounded-xl text-left transition-all duration-150 flex flex-col justify-between col-span-2 select-none ${
                            isCustomMode
                                ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md ring-1 ring-white/20'
                                : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold">
                                Model tùy chỉnh khác
                            </span>
                            <span
                                className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${
                                    isCustomMode ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                {isCustomMode ? 'Đang chọn' : 'Tự nhập'}
                            </span>
                        </div>
                    </button>
                </div>

                {/* Custom Model Input Drawer */}
                {isCustomMode && (
                    <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200/80 space-y-2 animate-fade-in mt-2">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Nhập Model ID từ 9Router
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={customModelText}
                                onChange={(e) => setCustomModelText(e.target.value)}
                                placeholder="Ví dụ: dall-e-3, flux-pro, ag/gemini-3.1-pro-high..."
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCustomModel}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                Áp dụng
                            </button>
                        </div>
                    </div>
                )}

                {/* Selected Model Description Callout - Pure Text */}
                <div className="p-2.5 bg-slate-50/90 border border-slate-200/70 rounded-xl text-[11px] text-slate-600 shadow-2xs mt-2">
                    <p className="leading-snug">
                        <strong className="text-slate-800 font-bold">
                            {activeModelInfo ? activeModelInfo.name : selectedModel}:{' '}
                        </strong>
                        <span className="text-slate-600">
                            {activeModelInfo
                                ? activeModelInfo.description
                                : 'Model 9Router tùy chỉnh được lưu sẵn cho mọi tác vụ tạo ảnh.'}
                        </span>
                    </p>
                </div>
            </div>

            {/* Resolution Selection - Pure Text */}
            {showResolution && (
                <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">
                        Độ phân giải xuất ra
                    </label>
                    <div className="flex gap-1.5">
                        {(['HD', 'FHD', '2K', '4K'] as ResolutionType[]).map((res) => {
                            const isSelected = selectedRes === res;
                            return (
                                <button
                                    key={res}
                                    type="button"
                                    onClick={() => handleResolutionChange(res)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                        isSelected
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm ring-1 ring-white/20'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
