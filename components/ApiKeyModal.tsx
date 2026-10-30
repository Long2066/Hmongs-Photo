import React, { useState, useEffect } from 'react';
import * as nineRouterService from '../services/nineRouterService';
import { SUPPORTED_IMAGE_MODELS } from '../services/nineRouterService';

interface ApiKeyModalProps {
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
    // 9Router State
    const [nineRouterEnabled, setNineRouterEnabledState] = useState(() => nineRouterService.isNineRouterEnabled());
    const [nineRouterUrl, setNineRouterUrlState] = useState(() => nineRouterService.getNineRouterUrl());
    const [nineRouterApiKey, setNineRouterApiKeyState] = useState(() => nineRouterService.getNineRouterApiKey());
    const [nineRouterImageModel, setNineRouterImageModelState] = useState(() => nineRouterService.getNineRouterImageModel());
    const [nineRouterTextModel, setNineRouterTextModelState] = useState(() => nineRouterService.getNineRouterTextModel());
    
    const [isConnected, setIsConnected] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [isSavedFeedback, setIsSavedFeedback] = useState(false);

    // Initial connection test
    useEffect(() => {
        checkConnection(nineRouterUrl, nineRouterApiKey);
    }, []);

    const checkConnection = async (targetUrl?: string, targetKey?: string) => {
        const urlToCheck = targetUrl !== undefined ? targetUrl : nineRouterUrl;
        const keyToCheck = targetKey !== undefined ? targetKey : nineRouterApiKey;

        setIsChecking(true);
        setErrorMessage(null);

        try {
            const status = await nineRouterService.checkConnection(urlToCheck, keyToCheck);
            setIsConnected(status.connected);
            if (!status.connected) {
                setErrorMessage(status.errorMessage || 'Không thể kết nối tới 9Router');
            }
        } catch (err: any) {
            setIsConnected(false);
            setErrorMessage(err?.message || 'Lỗi kết nối tới 9Router');
        } finally {
            setIsChecking(false);
        }
    };

    const handleToggleEnabled = () => {
        const next = !nineRouterEnabled;
        setNineRouterEnabledState(next);
        nineRouterService.setNineRouterEnabled(next);
    };

    const handleSave = () => {
        nineRouterService.setNineRouterEnabled(nineRouterEnabled);
        nineRouterService.setNineRouterUrl(nineRouterUrl);
        nineRouterService.setNineRouterApiKey(nineRouterApiKey);
        nineRouterService.setNineRouterImageModel(nineRouterImageModel);
        nineRouterService.setNineRouterTextModel(nineRouterTextModel);

        setIsSavedFeedback(true);
        setTimeout(() => {
            setIsSavedFeedback(false);
            onClose();
        }, 600);
    };

    const applyUrlPreset = (presetUrl: string) => {
        setNineRouterUrlState(presetUrl);
        checkConnection(presetUrl, nineRouterApiKey);
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/60 ring-1 ring-slate-900/5 animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20 ring-1 ring-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                Cấu hình 9Router Gateway
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cổng định tuyến AI tập trung tốc độ cao
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Đóng"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">

                    {/* Status & Toggle Card */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        isConnected
                            ? 'bg-emerald-50/60 border-emerald-200/80 ring-1 ring-emerald-500/10'
                            : 'bg-slate-50/80 border-slate-200/80'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleToggleEnabled}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${
                                        nineRouterEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block w-5 h-5 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${
                                            nineRouterEnabled ? 'translate-x-6.5' : 'translate-x-0.5'
                                        }`}
                                    />
                                </button>
                                <div>
                                    <span className={`text-sm font-bold ${nineRouterEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {nineRouterEnabled ? '9Router đang BẬT' : '9Router đang TẮT'}
                                    </span>
                                    <p className="text-[11px] text-slate-500">
                                        {isConnected
                                            ? 'Sẵn sàng xử lý tác vụ tạo ảnh'
                                            : nineRouterEnabled
                                                ? 'Chưa kết nối tới Gateway'
                                                : 'Bật để kích hoạt kết nối'}
                                    </p>
                                </div>
                            </div>

                            {/* Status Badge + Refresh */}
                            <div className="flex items-center gap-2">
                                {isChecking ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200/70 text-slate-600 animate-pulse">
                                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        Kiểm tra...
                                    </span>
                                ) : isConnected ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200/60 shadow-xs">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                        ONLINE
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-700">
                                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                        OFFLINE
                                    </span>
                                )}

                                <button
                                    onClick={() => checkConnection(nineRouterUrl, nineRouterApiKey)}
                                    disabled={isChecking}
                                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 active:scale-95 disabled:opacity-50"
                                    title="Kiểm tra lại kết nối"
                                >
                                    <svg className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Error Message Notice */}
                        {errorMessage && (
                            <div className="mt-3 p-3 bg-red-50/90 border border-red-200/80 rounded-xl text-red-700 text-xs flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="leading-relaxed font-medium">{errorMessage}</span>
                            </div>
                        )}
                    </div>

                    {/* Inputs Section */}
                    <div className="space-y-4">
                        {/* 1. Endpoint URL */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    9Router API Endpoint
                                </label>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                    <button
                                        type="button"
                                        onClick={() => applyUrlPreset('http://158.178.235.87:20128/v1')}
                                        className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                                    >
                                        VPS Cloud
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyUrlPreset('http://127.0.0.1:20128/v1')}
                                        className="text-slate-600 hover:text-slate-800 font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                    >
                                        Localhost
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                value={nineRouterUrl}
                                onChange={(e) => setNineRouterUrlState(e.target.value)}
                                placeholder="http://158.178.235.87:20128/v1"
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        {/* 2. API Key */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    9Router API Key
                                </label>
                                <span className="text-[10px] text-slate-400 italic">Bắt buộc đối với kết nối từ xa / VPS</span>
                            </div>
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={nineRouterApiKey}
                                    onChange={(e) => setNineRouterApiKeyState(e.target.value)}
                                    placeholder="Nhập 9Router API Key..."
                                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    title={showKey ? 'Ẩn key' : 'Hiện key'}
                                >
                                    {showKey ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* 3. Image Model & Text Model */}
                        <div className="space-y-3 pt-1">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Image Model (Vẽ ảnh)
                                    </label>
                                    <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 truncate max-w-[200px]">
                                        {nineRouterImageModel}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                                    {SUPPORTED_IMAGE_MODELS.map((m) => {
                                        const isSelected = nineRouterImageModel === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setNineRouterImageModelState(m.id)}
                                                className={`p-2 rounded-xl text-left transition-all flex flex-col justify-between ${
                                                    isSelected
                                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-xs ring-1 ring-white/20'
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-1 w-full">
                                                    <span className="text-xs truncate flex items-center gap-1">
                                                        <span>{m.icon}</span>
                                                        <span>{m.shortName}</span>
                                                    </span>
                                                    <span className={`text-[8px] px-1 py-0.5 rounded font-bold whitespace-nowrap ${
                                                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                                                    }`}>
                                                        {m.tag}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <input
                                    type="text"
                                    value={nineRouterImageModel}
                                    onChange={(e) => setNineRouterImageModelState(e.target.value)}
                                    placeholder="Hoặc tự gõ Model ID tùy chỉnh..."
                                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Text Model (Soạn Prompt)
                                    </label>
                                    <span className="text-[10px] font-mono text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 truncate max-w-[200px]">
                                        {nineRouterTextModel}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    {[
                                        { id: 'claude-sonnet-4-6', name: 'Claude 4.6', icon: '⭐', tag: 'Chi tiết' },
                                        { id: 'gpt-5.6-sol', name: 'GPT 5.6', icon: '💎', tag: 'Thông minh' },
                                        { id: 'gemini-3-flash', name: 'Flash', icon: '⚡', tag: 'Nhanh' }
                                    ].map((m) => {
                                        const isSelected = nineRouterTextModel === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setNineRouterTextModelState(m.id)}
                                                className={`p-2 rounded-xl text-left transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-xs'
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}
                                            >
                                                <span className="text-xs truncate flex items-center gap-1">
                                                    <span>{m.icon}</span>
                                                    <span>{m.name}</span>
                                                </span>
                                                <span className={`text-[8px] px-1 py-0.5 rounded font-bold whitespace-nowrap ${
                                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                                                }`}>
                                                    {m.tag}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <input
                                    type="text"
                                    value={nineRouterTextModel}
                                    onChange={(e) => setNineRouterTextModelState(e.target.value)}
                                    placeholder="Hoặc tự gõ Text Model ID..."
                                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Open Dashboard Link */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const dashboardUrl = nineRouterUrl.replace(/\/v1\/?$/, '') || 'http://158.178.235.87:20128';
                                    window.open(dashboardUrl, '_blank');
                                }}
                                className="w-full py-2.5 px-4 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200/60 active:scale-[0.98]"
                            >
                                <span>📊</span>
                                <span>Mở trang 9Router Dashboard</span>
                                <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-slate-50/80 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all active:scale-95"
                    >
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                        {isSavedFeedback ? (
                            <>
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Đã lưu!</span>
                            </>
                        ) : (
                            <span>Lưu cấu hình</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
