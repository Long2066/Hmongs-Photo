import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
    getSelectedResolution,
    setSelectedResolution,
    type ResolutionType
} from '../services/geminiCoreService';
import * as nineRouterService from '../services/nineRouterService';
import { SUPPORTED_IMAGE_MODELS } from '../services/nineRouterService';
import { isAdmin } from '../services/storageService';
import {
    SubscriptionPlan,
    getCachedUserPlan,
    getDailyFreeRemaining
} from '../services/firebaseService';
import {
    subscribeToSubscriptionPlansConfig,
    DEFAULT_SUBSCRIPTION_PLANS_CONFIG,
    isResolutionAllowedByConfig,
    formatVndCompact,
    type SubscriptionPlansConfig
} from '../services/subscriptionPlanConfigService';

interface ModelSelectorProps {
    onModelChange?: (modelId: string) => void;
    onResolutionChange?: (resolution: ResolutionType) => void;
    imageCount?: number;
    className?: string;
    showCostEstimate?: boolean;
    showResolution?: boolean;
    userBalance?: number;
}

export const ModelSelector: React.FC<ModelSelectorProps> = memo(({
    onModelChange,
    onResolutionChange,
    className = '',
    showResolution = true,
    userBalance: _propBalance
}) => {
    const [plansConfig, setPlansConfig] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS_CONFIG);
    const [selectionError, setSelectionError] = useState<string | null>(null);

    // User Balance & Plan State
    const [userPlan, setUserPlan] = useState<SubscriptionPlan>(() =>
        isAdmin() ? 'pro' : getCachedUserPlan()
    );
    const [freeRemaining, setFreeRemaining] = useState<number>(() =>
        getDailyFreeRemaining()
    );

    // Dynamic model pricing synced via Firebase
    const [pricingMap, setPricingMap] = useState<Record<string, boolean>>(() =>
        nineRouterService.getModelPricing()
    );

    // Effective Plan considering balance & admin status
    const effectivePlan: SubscriptionPlan = isAdmin() ? 'pro' : userPlan;

    // Helper: Determine if a model is Paid according to Firebase real-time sync or plan config
    const checkIsPaid = useCallback((modelId: string): boolean => {
        if (plansConfig.updatedAt > 0) {
            return !nineRouterService.isImageModelAllowedForPlan(modelId, 'free');
        }
        const clean = (modelId || '').replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim();
        if (pricingMap && pricingMap[clean] !== undefined) {
            return !!pricingMap[clean];
        }
        return nineRouterService.isModelPaid(clean);
    }, [pricingMap, plansConfig]);

    // Helper: Determine if a model requires an active paid package.
    const checkIsLocked = useCallback((modelId: string): boolean => {
        if (isAdmin()) return false;
        return !nineRouterService.isImageModelAllowedForPlan(modelId, effectivePlan);
    }, [effectivePlan, pricingMap, plansConfig]);

    // Selected Image Model
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        const current = nineRouterService.getNineRouterImageModel();
        return SUPPORTED_IMAGE_MODELS.some(m => m.id === current) ? current : SUPPORTED_IMAGE_MODELS[0].id;
    });

    // Selected Resolution
    const [selectedRes, setSelectedRes] = useState<ResolutionType>(() =>
        getSelectedResolution()
    );

    // Dropdown open/collapse state
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Custom model input toggle & state
    const [customModelInput, setCustomModelInput] = useState<string>('');
    const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

    // Current selected model object
    const currentModelObj = SUPPORTED_IMAGE_MODELS.find(m => m.id === selectedModel);

    // Subscribe to dynamic Admin subscription plans configuration
    useEffect(() => {
        return subscribeToSubscriptionPlansConfig((cfg) => {
            setPlansConfig(cfg);
            setFreeRemaining(getDailyFreeRemaining());
        });
    }, []);

    // Sync state with real-time events (Firebase config updates, balance changes, model changes)
    useEffect(() => {
        const handleModelChange = (e: any) => {
            const nextModel = e.detail?.model || nineRouterService.getNineRouterImageModel();
            setSelectedModel(nextModel);
        };

        const handlePricingChange = (e: any) => {
            const updated = e.detail?.pricing || nineRouterService.getModelPricing();
            console.log('[ModelSelector] Realtime pricing update from Firebase:', updated);
            setPricingMap({ ...updated });
        };

        const handleBalanceAndPlanChange = (e?: any) => {
            setUserPlan(isAdmin() ? 'pro' : getCachedUserPlan());
            setFreeRemaining(getDailyFreeRemaining());
        };

        window.addEventListener('ninerouter-model-changed', handleModelChange);
        window.addEventListener('ninerouter-pricing-changed', handlePricingChange);
        window.addEventListener('storage', handleBalanceAndPlanChange);
        window.addEventListener('user-balance-changed', handleBalanceAndPlanChange);

        const interval = setInterval(() => handleBalanceAndPlanChange(), 3000);

        return () => {
            window.removeEventListener('ninerouter-model-changed', handleModelChange);
            window.removeEventListener('ninerouter-pricing-changed', handlePricingChange);
            window.removeEventListener('storage', handleBalanceAndPlanChange);
            window.removeEventListener('user-balance-changed', handleBalanceAndPlanChange);
            clearInterval(interval);
        };
    }, []);

    // Dynamic auto-fallback: if the selected model is locked for the current package,
    // automatically fall back to the first available unlocked model
    useEffect(() => {
        if (checkIsLocked(selectedModel)) {
            const availableModel = SUPPORTED_IMAGE_MODELS.find(m => !checkIsLocked(m.id))?.id
                || plansConfig[effectivePlan]?.allowedImageModels?.[0]
                || 'gemini-3.1-flash-image';
            if (availableModel !== selectedModel && !checkIsLocked(availableModel)) {
                console.log(`[ModelSelector] Active model ${selectedModel} is locked for ${effectivePlan}. Switching to ${availableModel}`);
                setSelectedModel(availableModel);
                nineRouterService.setNineRouterImageModel(availableModel);
                onModelChange?.(availableModel);
            }
        }
    }, [selectedModel, checkIsLocked, effectivePlan, plansConfig, onModelChange]);

    // Enforce plan's maxResolution dynamically
    useEffect(() => {
        const maxPlanRes = plansConfig[effectivePlan]?.maxResolution || 'FHD';
        if (!isAdmin() && !isResolutionAllowedByConfig(selectedRes, effectivePlan, plansConfig)) {
            setSelectedResolution(maxPlanRes);
            setSelectedRes(maxPlanRes);
            onResolutionChange?.(maxPlanRes);
        }
    }, [effectivePlan, selectedRes, plansConfig, onResolutionChange]);

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

    // Choose a model
    const handleSelectModel = useCallback((modelId: string) => {
        if (checkIsLocked(modelId)) {
            const currentName = plansConfig[effectivePlan]?.name || effectivePlan;
            setSelectionError(`Model này không thuộc ${currentName}. Vui lòng chọn model khác hoặc nâng cấp gói tại Cấu hình & gói dịch vụ.`);
            return;
        }

        setSelectionError(null);
        setSelectedModel(modelId);
        nineRouterService.setNineRouterImageModel(modelId);
        onModelChange?.(modelId);
        setIsOpen(false);
    }, [checkIsLocked, effectivePlan, plansConfig, onModelChange]);

    // Handle resolution change
    const handleResolutionChange = useCallback((res: ResolutionType) => {
        const maxPlanRes = plansConfig[effectivePlan]?.maxResolution || 'FHD';
        if (!isAdmin() && !isResolutionAllowedByConfig(res, effectivePlan, plansConfig)) {
            const plusUnlocks = plansConfig.plus.enabled && isResolutionAllowedByConfig(res, 'plus', plansConfig);
            const targetPlan = plusUnlocks ? plansConfig.plus : plansConfig.pro;
            setSelectionError(`Độ phân giải ${res} chỉ dành cho ${targetPlan.name} (${formatVndCompact(targetPlan.price)}). ${plansConfig[effectivePlan]?.name || 'Gói hiện tại'} hỗ trợ tối đa mức ${maxPlanRes}.`);
            return;
        }

        setSelectionError(null);
        setSelectedResolution(res);
        setSelectedRes(res);
        onResolutionChange?.(res);
    }, [effectivePlan, plansConfig, onResolutionChange]);

    // Handle apply custom model ID
    const handleApplyCustomModel = useCallback(() => {
        const trimmed = customModelInput.trim();
        if (!trimmed) return;
        if (checkIsLocked(trimmed)) {
            setSelectionError(`Model "${trimmed}" không thuộc ${plansConfig[effectivePlan]?.name || 'gói hiện tại'}. Chọn ${plansConfig.pro.name} để mở toàn bộ model.`);
            return;
        }
        setSelectionError(null);
        setSelectedModel(trimmed);
        nineRouterService.setNineRouterImageModel(trimmed);
        onModelChange?.(trimmed);
        setIsOpen(false);
        setShowCustomInput(false);
        setCustomModelInput('');
    }, [customModelInput, checkIsLocked, effectivePlan, plansConfig, onModelChange]);

    const effectivePlanCfg = plansConfig[effectivePlan] || plansConfig.free;
    const maxPlanRes = effectivePlanCfg.maxResolution;

    if (!showResolution) {
        return null;
    }

    return (
        <div className={`space-y-3.5 ${className}`}>
            {/* Resolution Selection */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Độ phân giải xuất ra
                    </label>
                    {maxPlanRes !== '4K' && !isAdmin() && (
                        <span className="text-[10px] font-semibold text-slate-500">
                            Tối đa {maxPlanRes} ({effectivePlanCfg.name})
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {(['HD', 'FHD', '2K', '4K'] as ResolutionType[]).map((res) => {
                        const isSelected = selectedRes === res;
                        const isLockedRes = !isAdmin() && !isResolutionAllowedByConfig(res, effectivePlan, plansConfig);
                        const plusUnlocks = plansConfig.plus.enabled && isResolutionAllowedByConfig(res, 'plus', plansConfig);
                        const unlockBadge = plusUnlocks ? 'Plus' : 'Pro';

                        return (
                            <button
                                key={res}
                                type="button"
                                onClick={() => handleResolutionChange(res)}
                                title={isLockedRes ? `Nâng cấp ${plusUnlocks ? plansConfig.plus.name : plansConfig.pro.name} để mở khóa độ phân giải ${res}` : `Độ phân giải ${res}`}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[38px] ${
                                    isLockedRes
                                        ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-indigo-600 text-white border border-indigo-700 shadow-xs cursor-pointer'
                                            : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-400 shadow-xs cursor-pointer'
                                }`}
                            >
                                <span>{res}</span>
                                {isLockedRes && (
                                    <span className="text-[9px] font-semibold px-1 py-0.2 bg-slate-200 text-slate-600 rounded uppercase tracking-wider">
                                        {unlockBadge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
