import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import {
    AVAILABLE_IMAGE_MODELS,
    getSelectedImageModel,
    setSelectedImageModel,
    getSelectedResolution,
    setSelectedResolution,
    getSupportedResolutions,
    calculateCost,
    formatVND,
    type ResolutionType,
    type ModelConfig
} from '../services/geminiCoreService';
import { isProUser, getUseProApi } from '../services/storageService';
import * as antigravityService from '../services/antigravityService';

interface ModelSelectorProps {
    onModelChange?: (modelId: string) => void;
    onResolutionChange?: (resolution: ResolutionType) => void;
    imageCount?: number; // For cost estimation
    className?: string;
    showCostEstimate?: boolean;
    showResolution?: boolean; // Whether to show resolution selector (default: true)
}

// Memoized component to prevent unnecessary re-renders
export const ModelSelector: React.FC<ModelSelectorProps> = memo(({
    onModelChange,
    onResolutionChange,
    imageCount = 1,
    className = '',
    showCostEstimate = true,
    showResolution = true
}) => {
    const [selectedModel, setSelectedModelState] = useState(getSelectedImageModel);
    const [selectedRes, setSelectedResState] = useState<ResolutionType>(getSelectedResolution);

    // VIP status with real-time sync
    // NOTE: Antigravity and NineRouter users are treated as VIP (can use all models/features)
    const [isVipUser, setIsVipUser] = useState(() => {
        const isAntigravity = antigravityService.isAntigravityEnabled();
        const isNineRouter = localStorage.getItem('ninerouter_enabled') === 'true';
        return isAntigravity || isNineRouter || (isProUser() && getUseProApi());
    });

    // Track if specifically using Antigravity (for UI indicator)
    const [isAntigravityActive, setIsAntigravityActive] = useState(() =>
        antigravityService.isAntigravityEnabled()
    );
    const [isNineRouterActive, setIsNineRouterActive] = useState(() =>
        localStorage.getItem('ninerouter_enabled') === 'true'
    );

    // Listen for VIP status changes, Antigravity, and NineRouter changes
    useEffect(() => {
        const handleVipChange = () => {
            const isAntigravity = antigravityService.isAntigravityEnabled();
            const isNineRouter = localStorage.getItem('ninerouter_enabled') === 'true';
            const newVipStatus = isAntigravity || isNineRouter || (isProUser() && getUseProApi());
            setIsVipUser(newVipStatus);
            setIsAntigravityActive(isAntigravity);
            setIsNineRouterActive(isNineRouter);
            console.log('[ModelSelector] VIP status updated:', newVipStatus, '(Antigravity:', isAntigravity, ', NineRouter:', isNineRouter, ')');
        };

        window.addEventListener('vip-status-changed', handleVipChange);
        window.addEventListener('antigravity-status-changed', handleVipChange);
        window.addEventListener('ninerouter-status-changed', handleVipChange);
        // Also listen for storage changes (for multi-tab sync)
        window.addEventListener('storage', handleVipChange);

        return () => {
            window.removeEventListener('vip-status-changed', handleVipChange);
            window.removeEventListener('antigravity-status-changed', handleVipChange);
            window.removeEventListener('ninerouter-status-changed', handleVipChange);
            window.removeEventListener('storage', handleVipChange);
        };
    }, []);

    // Get current model config
    const currentModel = useMemo(() =>
        AVAILABLE_IMAGE_MODELS.find(m => m.id === selectedModel),
        [selectedModel]
    );

    // Get available resolutions for current model
    const availableResolutions = useMemo(() =>
        getSupportedResolutions(selectedModel),
        [selectedModel]
    );

    // Calculate cost estimate
    const costEstimate = useMemo(() =>
        calculateCost(selectedModel, imageCount, selectedRes),
        [selectedModel, imageCount, selectedRes]
    );

    // Handle model change
    const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const modelId = e.target.value;
        const model = AVAILABLE_IMAGE_MODELS.find(m => m.id === modelId);

        // Prevent non-VIP users from selecting VIP-only models
        if (model?.vipOnly && !isVipUser) {
            return;
        }

        setSelectedImageModel(modelId);
        setSelectedModelState(modelId);

        // Auto-adjust resolution if not supported
        const newResolutions = getSupportedResolutions(modelId);
        if (!newResolutions.includes(selectedRes)) {
            const newRes = newResolutions[newResolutions.length - 1]; // Pick highest available
            setSelectedResolution(newRes);
            setSelectedResState(newRes);
            onResolutionChange?.(newRes);
        }

        onModelChange?.(modelId);
    }, [isVipUser, selectedRes, onModelChange, onResolutionChange]);

    // Handle resolution change
    const handleResolutionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const res = e.target.value as ResolutionType;
        setSelectedResolution(res);
        setSelectedResState(res);
        onResolutionChange?.(res);
    }, [onResolutionChange]);

    // Get available models based on VIP status
    const availableModels = useMemo(() =>
        AVAILABLE_IMAGE_MODELS.map(model => ({
            ...model,
            disabled: model.vipOnly && !isVipUser
        })),
        [isVipUser]
    );

    // Speed icon
    const getSpeedIcon = (speed: ModelConfig['speed']) => {
        switch (speed) {
            case 'fast': return '⚡';
            case 'medium': return '🔄';
            case 'slow': return '🎯';
        }
    };

    return (
        <div className={`model-selector space-y-3 ${className}`}>
            {/* Model Selection */}
            <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                    🤖 Model AI
                </label>
                <div className="relative">
                    <select
                        value={selectedModel}
                        onChange={handleModelChange}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 
                                   focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none
                                   cursor-pointer transition-colors hover:border-slate-300"
                    >
                        {availableModels.map(model => (
                            <option
                                key={model.id}
                                value={model.id}
                                disabled={model.disabled}
                            >
                                {getSpeedIcon(model.speed)} {model.name} - {isVipUser ? `${formatVND(model.pricePerImage)}/ảnh` : 'Miễn phí'}
                                {model.disabled ? ' 🔒' : model.vipOnly ? ' ⭐' : ''}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                {currentModel && (
                    <p className="text-[10px] text-slate-500 mt-1">
                        {currentModel.description} • Max: {currentModel.maxResolution}
                    </p>
                )}
            </div>

            {/* Resolution Selection - only show if showResolution is true */}
            {showResolution && (
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                        📐 Độ phân giải
                    </label>
                    <div className="flex gap-2">
                        {(['HD', 'FHD', '2K', '4K'] as ResolutionType[]).map(res => {
                            const isSupported = availableResolutions.includes(res);
                            const isSelected = selectedRes === res;
                            return (
                                <button
                                    key={res}
                                    onClick={() => {
                                        if (isSupported) {
                                            setSelectedResolution(res);
                                            setSelectedResState(res);
                                            onResolutionChange?.(res);
                                        }
                                    }}
                                    disabled={!isSupported}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all
                                    ${isSelected
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : isSupported
                                                ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                        }`}
                                >
                                    {res}
                                    {!isSupported && <span className="ml-1">🔒</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Cost Estimate - Only show when VIP mode is enabled (not Antigravity) */}
            {isVipUser && !isAntigravityActive && showCostEstimate && costEstimate && imageCount > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-amber-800">💰 Ước tính chi phí VIP</p>
                            <p className="text-[10px] text-amber-600 mt-0.5">
                                {imageCount} ảnh × {formatVND(costEstimate.pricePerImage)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-extrabold text-amber-700">
                                {costEstimate.formattedTotal}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Antigravity VIP Mode Message */}
            {isAntigravityActive && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🚀</span>
                        <div>
                            <p className="text-xs font-bold text-purple-700">Antigravity VIP Mode</p>
                            <p className="text-[10px] text-purple-600 mt-0.5">
                                Tất cả model VIP đã mở khóa! • Đang dùng Google Account miễn phí ✨
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Free Key Message - Show when not VIP and not Antigravity */}
            {!isVipUser && !isAntigravityActive && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🆓</span>
                        <div>
                            <p className="text-xs font-bold text-green-700">Đang dùng Key miễn phí</p>
                            <p className="text-[10px] text-green-600 mt-0.5">
                                Tất cả tính năng đều miễn phí với API Key cá nhân •
                                <span className="text-amber-600"> Nạp VIP để mở khóa Imagen 3.0 và Gemini 3 Pro ⭐</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
