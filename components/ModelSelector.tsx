import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
    getSelectedResolution,
    setSelectedResolution,
    type ResolutionType
} from '../services/geminiCoreService';
import * as nineRouterService from '../services/nineRouterService';
import { SUPPORTED_IMAGE_MODELS, isModelPaid, getModelPricing } from '../services/nineRouterService';
import { getCachedBalance } from '../services/balanceService';
import { isProUser } from '../services/storageService';

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
    // User Balance & Access State
    const [userBalance, setUserBalance] = useState<number>(() =>
        propBalance !== undefined ? propBalance : getCachedBalance()
    );
    const [isPro, setIsPro] = useState<boolean>(() => isProUser());
    const [pricing, setPricing] = useState<Record<string, boolean>>(() => getModelPricing());

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

    // Check if user is out of balance
    const isOutOfBalance = userBalance <= 0 && !isPro;

    // Listen to real-time model changes, pricing changes, and balance updates
    useEffect(() => {
        const handleModelChange = (e: any) => {
            const nextModel = e.detail?.model || nineRouterService.getNineRouterImageModel();
            setSelectedModel(nextModel);
        };

        const handlePricingChange = (e: any) => {
            setPricing(e.detail?.pricing || getModelPricing());
        };

        const handleBalanceChange = () => {
            if (propBalance === undefined) {
                setUserBalance(getCachedBalance());
            }
            setIsPro(isProUser());
        };

        window.addEventListener('ninerouter-model-changed', handleModelChange);
        window.addEventListener('ninerouter-pricing-changed', handlePricingChange);
        window.addEventListener('storage', handleBalanceChange);
        window.addEventListener('user-balance-changed', handleBalanceChange);

        const interval = setInterval(handleBalanceChange, 3000);

        return () => {
            window.removeEventListener('ninerouter-model-changed', handleModelChange);
            window.removeEventListener('ninerouter-pricing-changed', handlePricingChange);
            window.removeEventListener('storage', handleBalanceChange);
            window.removeEventListener('user-balance-changed', handleBalanceChange);
            clearInterval(interval);
        };
    }, [propBalance]);

    // Keep balance state synced if prop passed
    useEffect(() => {
        if (propBalance !== undefined) {
            setUserBalance(propBalance);
        }
    }, [propBalance]);

    // Auto-fallback if currently selected model is paid and user is out of balance
    useEffect(() => {
        const currentIsPaid = pricing[selectedModel] !== undefined
            ? pricing[selectedModel]
            : isModelPaid(selectedModel);

        if (currentIsPaid && isOutOfBalance) {
            // Find first free model
            const freeModel = SUPPORTED_IMAGE_MODELS.find(m => {
                const paid = pricing[m.id] !== undefined ? pricing[m.id] : isModelPaid(m.id);
                return !paid;
            }) || SUPPORTED_IMAGE_MODELS[0];

            if (freeModel && freeModel.id !== selectedModel) {
                console.log(`[ModelSelector] Model ${selectedModel} is paid but balance is 0. Auto-fallback to ${freeModel.id}`);
                setSelectedModel(freeModel.id);
                nineRouterService.setNineRouterImageModel(freeModel.id);
                onModelChange?.(freeModel.id);
            }
        }
    }, [isOutOfBalance, pricing, selectedModel, onModelChange]);

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
        const paid = pricing[modelId] !== undefined ? pricing[modelId] : isModelPaid(modelId);
        if (paid && isOutOfBalance) {
            alert(`Model này là Trả phí. Số dư của bạn hiện là 0đ. Vui lòng nạp thêm để mở khóa hoặc chọn model Miễn phí.`);
            return;
        }

        setSelectedModel(modelId);
        nineRouterService.setNineRouterImageModel(modelId);
        onModelChange?.(modelId);
        setIsOpen(false); // Auto-collapse on selection for clean UX
    }, [onModelChange, pricing, isOutOfBalance]);

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

    const isCurrentPaid = currentModelObj
        ? (pricing[currentModelObj.id] !== undefined ? pricing[currentModelObj.id] : isModelPaid(currentModelObj.id))
        : isModelPaid(selectedModel);

    return (
        <div className={`space-y-3.5 ${className}`}>
            {/* Header: Title */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Model Tạo Ảnh
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                        {isOutOfBalance ? (
                            <span className="text-amber-700 font-semibold">Số dư: 0đ (Khóa model trả phí)</span>
                        ) : (
                            <span className="text-slate-600">Đồng bộ Cloud</span>
                        )}
                    </span>
                </div>

                {/* Collapsible Dropdown Selector - Dạng nổi (Floating Overlay) */}
                <div className={`relative ${isOpen ? 'z-40' : 'z-10'}`} ref={dropdownRef}>
                    {/* Collapsed Trigger Button */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(prev => !prev)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left bg-white border transition-all duration-150 shadow-xs group select-none cursor-pointer ${
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
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                isCurrentPaid
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                                {isCurrentPaid ? 'Trả phí' : 'Miễn phí'}
                            </span>
                        </div>

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

                    {/* Floating Dropdown Overlay */}
                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-slate-900/5 p-1 z-50 animate-fade-in">
                            {/* List of Models */}
                            <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-0.5">
                                {SUPPORTED_IMAGE_MODELS.map((model) => {
                                    const isSelected = selectedModel === model.id;
                                    const paid = pricing[model.id] !== undefined
                                        ? pricing[model.id]
                                        : isModelPaid(model.id);
                                    const isLocked = paid && isOutOfBalance;

                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            disabled={isLocked}
                                            onClick={() => handleSelectModel(model.id)}
                                            className={`w-full px-3 py-2 rounded-lg text-left transition-all flex items-center justify-between gap-2 min-h-[38px] ${
                                                isLocked
                                                    ? 'opacity-40 cursor-not-allowed bg-slate-50/70 select-none grayscale'
                                                    : isSelected
                                                        ? 'bg-indigo-50 text-indigo-700 font-bold cursor-pointer'
                                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 font-medium cursor-pointer'
                                            }`}
                                            title={isLocked ? 'Model trả phí - Số dư của bạn là 0đ' : model.description}
                                        >
                                            <div className="flex items-center gap-2 truncate min-w-0">
                                                <span className="text-xs truncate">
                                                    {model.name}
                                                </span>
                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex-shrink-0 tracking-wider ${
                                                    isLocked
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                        : paid
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    {isLocked ? 'Khóa (0đ)' : paid ? 'Trả phí' : 'Miễn phí'}
                                                </span>
                                            </div>

                                            {/* Selected Checkmark or Lock Icon */}
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
