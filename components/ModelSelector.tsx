import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
    getSelectedResolution,
    setSelectedResolution,
    type ResolutionType
} from '../services/geminiCoreService';
import * as nineRouterService from '../services/nineRouterService';
import { SUPPORTED_IMAGE_MODELS } from '../services/nineRouterService';
import { getCachedBalance } from '../services/balanceService';
import { isAdmin } from '../services/storageService';
import {
    SubscriptionPlan,
    FREE_ALLOWED_MODEL,
    FREE_DAILY_IMAGE_LIMIT,
    IMAGE_COST_VND,
    getCachedUserPlan,
    getDailyFreeRemaining,
    resolveEffectivePlan
} from '../services/firebaseService';

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
    userBalance: propBalance
}) => {
    // User Balance & Plan State
    const [userBalance, setUserBalance] = useState<number>(() =>
        propBalance !== undefined ? propBalance : getCachedBalance()
    );
    const [userPlan, setUserPlan] = useState<SubscriptionPlan>(() =>
        isAdmin() ? 'pro' : getCachedUserPlan()
    );
    const [freeRemaining, setFreeRemaining] = useState<number>(() =>
        getDailyFreeRemaining()
    );

    // Effective Plan considering balance & admin status
    const effectivePlan: SubscriptionPlan = isAdmin()
        ? 'pro'
        : resolveEffectivePlan(userPlan, userBalance);

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

    // Sync state with real-time events
    useEffect(() => {
        const handleModelChange = (e: any) => {
            const nextModel = e.detail?.model || nineRouterService.getNineRouterImageModel();
            setSelectedModel(nextModel);
        };

        const handleBalanceAndPlanChange = (e?: any) => {
            const nextBal = e?.detail?.balance !== undefined
                ? e.detail.balance
                : propBalance !== undefined
                    ? propBalance
                    : getCachedBalance();
            setUserBalance(nextBal);
            setUserPlan(isAdmin() ? 'pro' : getCachedUserPlan());
            setFreeRemaining(getDailyFreeRemaining());
        };

        window.addEventListener('ninerouter-model-changed', handleModelChange);
        window.addEventListener('storage', handleBalanceAndPlanChange);
        window.addEventListener('user-balance-changed', handleBalanceAndPlanChange);

        const interval = setInterval(() => handleBalanceAndPlanChange(), 3000);

        return () => {
            window.removeEventListener('ninerouter-model-changed', handleModelChange);
            window.removeEventListener('storage', handleBalanceAndPlanChange);
            window.removeEventListener('user-balance-changed', handleBalanceAndPlanChange);
            clearInterval(interval);
        };
    }, [propBalance]);

    useEffect(() => {
        if (propBalance !== undefined) {
            setUserBalance(propBalance);
        }
    }, [propBalance]);

    // Enforce Free tier model restriction (only GPT Image 1.5 allowed on Free)
    useEffect(() => {
        if (effectivePlan === 'free' && selectedModel !== FREE_ALLOWED_MODEL) {
            setSelectedModel(FREE_ALLOWED_MODEL);
            nineRouterService.setNineRouterImageModel(FREE_ALLOWED_MODEL);
            onModelChange?.(FREE_ALLOWED_MODEL);
        }
    }, [effectivePlan, selectedModel, onModelChange]);

    // Enforce Free & Plus resolution restriction (max FHD; 2K and 4K are Pro only)
    useEffect(() => {
        if (effectivePlan !== 'pro' && (selectedRes === '2K' || selectedRes === '4K')) {
            setSelectedResolution('FHD');
            setSelectedRes('FHD');
            onResolutionChange?.('FHD');
        }
    }, [effectivePlan, selectedRes, onResolutionChange]);

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
        if (effectivePlan === 'free' && modelId !== FREE_ALLOWED_MODEL) {
            alert('Gói Free chỉ hỗ trợ model GPT Image 1.5 (tối đa 20 ảnh/ngày). Vui lòng nâng cấp Gói Plus (50.000đ) hoặc Gói Pro (100.000đ) tại Trang cá nhân để mở khóa toàn bộ model AI!');
            return;
        }

        setSelectedModel(modelId);
        nineRouterService.setNineRouterImageModel(modelId);
        onModelChange?.(modelId);
        setIsOpen(false);
    }, [effectivePlan, onModelChange]);

    // Handle resolution change
    const handleResolutionChange = useCallback((res: ResolutionType) => {
        const isHighRes = res === '2K' || res === '4K';
        if (isHighRes && effectivePlan !== 'pro') {
            alert('Độ phân giải 2K và 4K chỉ dành cho Gói Pro (100.000đ). Gói Free và Gói Plus hỗ trợ tối đa mức FHD. Vui lòng nâng cấp Gói Pro trong Trang cá nhân để mở khóa!');
            return;
        }

        setSelectedResolution(res);
        setSelectedRes(res);
        onResolutionChange?.(res);
    }, [effectivePlan, onResolutionChange]);

    // Handle apply custom model ID
    const handleApplyCustomModel = useCallback(() => {
        const trimmed = customModelInput.trim();
        if (!trimmed) return;
        if (effectivePlan === 'free' && trimmed !== FREE_ALLOWED_MODEL) {
            alert('Gói Free chỉ hỗ trợ model GPT 1.5. Vui lòng nâng cấp Gói Plus hoặc Pro.');
            return;
        }
        setSelectedModel(trimmed);
        nineRouterService.setNineRouterImageModel(trimmed);
        onModelChange?.(trimmed);
        setIsOpen(false);
        setShowCustomInput(false);
        setCustomModelInput('');
    }, [customModelInput, effectivePlan, onModelChange]);

    return (
        <div className={`space-y-3.5 ${className}`}>
            {/* Header: Title & Active Tier Badge */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Model Tạo Ảnh
                    </label>
                    <span className="text-[11px] font-semibold">
                        {effectivePlan === 'free' ? (
                            <span className="text-amber-700 font-mono tabular-nums">
                                Gói Free: Còn {freeRemaining}/{FREE_DAILY_IMAGE_LIMIT} ảnh hôm nay
                            </span>
                        ) : effectivePlan === 'plus' ? (
                            <span className="text-emerald-700 font-mono tabular-nums">
                                Gói Plus • {IMAGE_COST_VND}đ/ảnh
                            </span>
                        ) : (
                            <span className="text-indigo-600 font-mono tabular-nums">
                                Gói Pro • {IMAGE_COST_VND}đ/ảnh
                            </span>
                        )}
                    </span>
                </div>

                {/* Collapsible Dropdown Selector */}
                <div className={`relative ${isOpen ? 'z-40' : 'z-10'}`} ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsOpen(prev => !prev)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left bg-white border transition-all duration-150 shadow-xs group select-none cursor-pointer min-h-[44px] ${
                            isOpen
                                ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'border-slate-300/90 ring-1 ring-slate-900/5 hover:border-slate-400 hover:bg-slate-50/80'
                        }`}
                        aria-expanded={isOpen}
                    >
                        <div className="flex items-center gap-2 truncate min-w-0">
                            <span className="text-xs sm:text-[13px] font-semibold text-slate-800 truncate">
                                {currentModelObj ? currentModelObj.name : selectedModel.replace('ag/', '').replace('openrouter/', '')}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider ${
                                selectedModel === FREE_ALLOWED_MODEL && effectivePlan === 'free'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                                {effectivePlan === 'free' ? 'Gói Free' : '500đ/ảnh'}
                            </span>
                        </div>

                        <svg
                            className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Floating Dropdown Overlay */}
                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-slate-900/5 p-1 z-50 animate-fade-in">
                            <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-0.5">
                                {SUPPORTED_IMAGE_MODELS.map((model) => {
                                    const isSelected = selectedModel === model.id;
                                    const isLocked = effectivePlan === 'free' && model.id !== FREE_ALLOWED_MODEL;

                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            disabled={isLocked}
                                            onClick={() => handleSelectModel(model.id)}
                                            className={`w-full px-3 py-2 rounded-lg text-left transition-all flex items-center justify-between gap-2 min-h-[40px] ${
                                                isLocked
                                                    ? 'opacity-45 cursor-not-allowed bg-slate-50/70 select-none'
                                                    : isSelected
                                                        ? 'bg-indigo-50 text-indigo-700 font-bold cursor-pointer'
                                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 font-medium cursor-pointer'
                                            }`}
                                            title={isLocked ? 'Cần gói Plus hoặc Pro để mở khóa model này' : model.description}
                                        >
                                            <div className="flex items-center gap-2 truncate min-w-0">
                                                <span className="text-xs truncate">
                                                    {model.name}
                                                </span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider ${
                                                    isLocked
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                        : model.id === FREE_ALLOWED_MODEL
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                }`}>
                                                    {isLocked ? 'Plus / Pro' : model.id === FREE_ALLOWED_MODEL ? 'Free / 500đ' : 'Plus / Pro'}
                                                </span>
                                            </div>

                                            {isLocked ? (
                                                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            ) : isSelected ? (
                                                <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Optional Custom Model Input Box (Plus/Pro only) */}
                            {effectivePlan !== 'free' && (
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
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Resolution Selection */}
            {showResolution && (
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Độ phân giải xuất ra
                        </label>
                        {effectivePlan !== 'pro' && (
                            <span className="text-[10px] font-semibold text-slate-500">
                                Tối đa FHD ({effectivePlan === 'plus' ? 'Gói Plus' : 'Gói Free'})
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {(['HD', 'FHD', '2K', '4K'] as ResolutionType[]).map((res) => {
                            const isSelected = selectedRes === res;
                            const isLockedRes = (res === '2K' || res === '4K') && effectivePlan !== 'pro';

                            return (
                                <button
                                    key={res}
                                    type="button"
                                    onClick={() => handleResolutionChange(res)}
                                    title={isLockedRes ? 'Nâng cấp Gói Pro (100.000đ) để mở khóa độ phân giải 2K/4K' : `Độ phân giải ${res}`}
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
                                            Pro
                                        </span>
                                    )}
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
