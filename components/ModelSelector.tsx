import React, { memo, useCallback, useState, useEffect } from 'react';
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

    // Choose a predefined model tab
    const handleSelectModel = useCallback((modelId: string) => {
        setSelectedModel(modelId);
        nineRouterService.setNineRouterImageModel(modelId);
        onModelChange?.(modelId);
    }, [onModelChange]);

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
                        const isSelected = selectedModel === model.id;
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
