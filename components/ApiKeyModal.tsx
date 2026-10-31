import React, { useState, useEffect, useRef } from 'react';
import * as nineRouterService from '../services/nineRouterService';
import { KeyIcon } from './Icons';

interface ApiKeyModalProps {
    onClose: () => void;
}

const ADMIN_PASSWORD = 'Long2006@123#00011@#';

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
    // Admin Authentication State
    const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
    const [adminPasswordInput, setAdminPasswordInput] = useState('');
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // Cấu hình State
    const [nineRouterEnabled, setNineRouterEnabledState] = useState(() => nineRouterService.isNineRouterEnabled());
    const [nineRouterUrl, setNineRouterUrlState] = useState(() => nineRouterService.getNineRouterUrl());
    const [nineRouterApiKey, setNineRouterApiKeyState] = useState(() => nineRouterService.getNineRouterApiKey());
    
    const [isConnected, setIsConnected] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [isSavedFeedback, setIsSavedFeedback] = useState(false);

    // Initial connection test
    useEffect(() => {
        checkConnection(nineRouterUrl, nineRouterApiKey);
    }, []);

    // Auto-focus admin password input on open if locked ("Bấm vào chìa khóa là yêu cầu nhập mật khẩu ngay")
    useEffect(() => {
        if (!isAdminUnlocked) {
            const timer = setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [isAdminUnlocked]);

    const checkConnection = async (targetUrl?: string, targetKey?: string) => {
        const urlToCheck = targetUrl !== undefined ? targetUrl : nineRouterUrl;
        const keyToCheck = targetKey !== undefined ? targetKey : nineRouterApiKey;

        setIsChecking(true);
        setErrorMessage(null);

        try {
            const status = await nineRouterService.checkConnection(urlToCheck, keyToCheck);
            setIsConnected(status.connected);
            if (!status.connected) {
                setErrorMessage(status.errorMessage || 'Không thể kết nối tới Cấu hình');
            }
        } catch (err: any) {
            setIsConnected(false);
            setErrorMessage(err?.message || 'Lỗi kết nối Cấu hình');
        } finally {
            setIsChecking(false);
        }
    };

    const handleToggleEnabled = () => {
        const next = !nineRouterEnabled;
        setNineRouterEnabledState(next);
        nineRouterService.setNineRouterEnabled(next);
    };

    const handleUnlockAdmin = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = adminPasswordInput.trim();
        if (trimmed === ADMIN_PASSWORD) {
            setIsAdminUnlocked(true);
            setAuthError(null);
            setAdminPasswordInput('');
        } else {
            setAuthError('Mật khẩu quản trị viên không chính xác. Vui lòng thử lại!');
            passwordInputRef.current?.focus();
            passwordInputRef.current?.select();
        }
    };

    const handleLockAdmin = () => {
        setIsAdminUnlocked(false);
        setAdminPasswordInput('');
        setAuthError(null);
        setShowKey(false);
    };

    const focusPasswordInput = () => {
        if (!isAdminUnlocked) {
            passwordInputRef.current?.focus();
            passwordInputRef.current?.select();
        }
    };

    const handleSave = () => {
        if (!isAdminUnlocked) {
            focusPasswordInput();
            return;
        }

        nineRouterService.setNineRouterEnabled(nineRouterEnabled);
        nineRouterService.setNineRouterUrl(nineRouterUrl);
        nineRouterService.setNineRouterApiKey(nineRouterApiKey);

        setIsSavedFeedback(true);
        setTimeout(() => {
            setIsSavedFeedback(false);
            onClose();
        }, 600);
    };

    const applyUrlPreset = (presetUrl: string) => {
        if (!isAdminUnlocked) {
            focusPasswordInput();
            return;
        }
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
                                Cấu hình
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cổng định tuyến AI tập trung tốc độ cao
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Đóng"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">

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
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 cursor-pointer ${
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
                                        {nineRouterEnabled ? 'Cấu hình đang BẬT' : 'Cấu hình đang TẮT'}
                                    </span>
                                    <p className="text-[11px] text-slate-500">
                                        {isConnected
                                            ? 'Sẵn sàng xử lý tác vụ tạo ảnh'
                                            : nineRouterEnabled
                                                ? 'Chưa kết nối tới máy chủ Cấu hình'
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
                                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 active:scale-95 disabled:opacity-50 cursor-pointer"
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

                    {/* MỤC YÊU CẦU MẬT KHẨU ADMIN ĐỂ HIỂN THỊ HẾT */}
                    {!isAdminUnlocked ? (
                        <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/80 rounded-2xl ring-1 ring-amber-500/15 shadow-xs animate-fade-in">
                            <div className="flex items-start gap-2.5 mb-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <KeyIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                                        Mục Yêu cầu Mật khẩu Admin
                                    </span>
                                    <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                                        Cấu hình này đang được bảo vệ dưới dạng mật mã ****. Nhập mật khẩu để hiển thị toàn bộ cho quản trị viên.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleUnlockAdmin} className="mt-3">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            ref={passwordInputRef}
                                            type={showAdminPassword ? 'text' : 'password'}
                                            value={adminPasswordInput}
                                            onChange={(e) => {
                                                setAdminPasswordInput(e.target.value);
                                                if (authError) setAuthError(null);
                                            }}
                                            placeholder="Nhập mật khẩu admin..."
                                            className={`w-full bg-white border ${
                                                authError
                                                    ? 'border-red-400 ring-2 ring-red-400/20'
                                                    : 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                            } rounded-xl pl-3 pr-9 py-2 text-xs font-mono text-slate-800 outline-none transition-all placeholder:text-slate-400`}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                            title={showAdminPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                        >
                                            {showAdminPassword ? (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                    >
                                        <KeyIcon className="w-3.5 h-3.5" />
                                        <span>Mở khóa</span>
                                    </button>
                                </div>

                                {authError && (
                                    <p className="text-red-600 text-[11px] font-semibold mt-2 flex items-center gap-1 animate-fade-in">
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>{authError}</span>
                                    </p>
                                )}
                            </form>
                        </div>
                    ) : (
                        <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between ring-1 ring-emerald-500/10 shadow-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-xs font-bold text-emerald-900">
                                    Chế độ Quản trị viên (Admin) — Toàn bộ cấu hình đã hiển thị
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleLockAdmin}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="Khóa lại"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>Khóa lại</span>
                            </button>
                        </div>
                    )}

                    {/* Inputs Section */}
                    <div className="space-y-4">
                        {/* 1. Endpoint URL */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Cấu hình API Endpoint
                                    </label>
                                    {!isAdminUnlocked && (
                                        <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                            <KeyIcon className="w-2.5 h-2.5" />
                                            <span>Mật mã ****</span>
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                    <button
                                        type="button"
                                        onClick={() => isAdminUnlocked ? applyUrlPreset('https://753c-158-178-235-87.ngrok-free.app/v1') : focusPasswordInput()}
                                        disabled={!isAdminUnlocked}
                                        className={`font-semibold px-2 py-0.5 rounded-md transition-colors ${
                                            isAdminUnlocked
                                                ? 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 cursor-pointer'
                                                : 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-60'
                                        }`}
                                    >
                                        Cloudflare
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => isAdminUnlocked ? applyUrlPreset('http://127.0.0.1:8317/v1') : focusPasswordInput()}
                                        disabled={!isAdminUnlocked}
                                        className={`font-semibold px-2 py-0.5 rounded-md transition-colors ${
                                            isAdminUnlocked
                                                ? 'text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 cursor-pointer'
                                                : 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-60'
                                        }`}
                                    >
                                        Localhost
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={isAdminUnlocked ? nineRouterUrl : '************************************************'}
                                    onChange={(e) => isAdminUnlocked && setNineRouterUrlState(e.target.value)}
                                    onClick={!isAdminUnlocked ? focusPasswordInput : undefined}
                                    readOnly={!isAdminUnlocked}
                                    placeholder="https://753c-158-178-235-87.ngrok-free.app/v1"
                                    className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-mono transition-all ${
                                        isAdminUnlocked
                                            ? 'bg-slate-50/70 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400'
                                            : 'bg-slate-100/80 border-slate-200 text-slate-400 tracking-widest cursor-pointer select-none'
                                    }`}
                                />
                                {!isAdminUnlocked && (
                                    <button
                                        type="button"
                                        onClick={focusPasswordInput}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-600 p-1 cursor-pointer"
                                        title="Bấm vào chìa khóa để nhập mật khẩu"
                                    >
                                        <KeyIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. API Key */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Cấu hình API Key
                                    </label>
                                    {!isAdminUnlocked && (
                                        <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                            <KeyIcon className="w-2.5 h-2.5" />
                                            <span>Mật mã ****</span>
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-400 italic">Bắt buộc đối với kết nối từ xa / VPS</span>
                            </div>
                            <div className="relative">
                                <input
                                    type={!isAdminUnlocked ? 'text' : (showKey ? 'text' : 'password')}
                                    value={isAdminUnlocked ? nineRouterApiKey : '****************'}
                                    onChange={(e) => isAdminUnlocked && setNineRouterApiKeyState(e.target.value)}
                                    onClick={!isAdminUnlocked ? focusPasswordInput : undefined}
                                    readOnly={!isAdminUnlocked}
                                    placeholder="Nhập API Key Cấu hình..."
                                    className={`w-full border rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono transition-all ${
                                        isAdminUnlocked
                                            ? 'bg-slate-50/70 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400'
                                            : 'bg-slate-100/80 border-slate-200 text-slate-400 tracking-widest cursor-pointer select-none'
                                    }`}
                                />
                                {isAdminUnlocked ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
                                ) : (
                                    <button
                                        type="button"
                                        onClick={focusPasswordInput}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-600 p-1 cursor-pointer"
                                        title="Bấm vào chìa khóa để nhập mật khẩu"
                                    >
                                        <KeyIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Open Dashboard Link */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isAdminUnlocked) {
                                        focusPasswordInput();
                                        return;
                                    }
                                    const base = (nineRouterUrl || '').replace(/\/v1\/?$/, '');
                                    const dashboardUrl = base ? `${base}/management.html#/auth-files/` : 'https://753c-158-178-235-87.ngrok-free.app/management.html#/auth-files/';
                                    window.open(dashboardUrl, '_blank');
                                }}
                                className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border ${
                                    isAdminUnlocked
                                        ? 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border-slate-200/60 active:scale-[0.98] cursor-pointer'
                                        : 'bg-slate-50 text-slate-400 border-slate-200/40 hover:bg-slate-100/60 cursor-pointer'
                                }`}
                            >
                                {!isAdminUnlocked ? (
                                    <KeyIcon className="w-4 h-4 text-amber-500" />
                                ) : (
                                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                )}
                                <span>{isAdminUnlocked ? 'Mở trang Cấu hình Dashboard' : 'Mở trang Cấu hình Dashboard (Cần mật khẩu Admin)'}</span>
                                {isAdminUnlocked && (
                                    <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-slate-50/80 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        onClick={isAdminUnlocked ? handleSave : focusPasswordInput}
                        className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            isAdminUnlocked
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 hover:shadow-emerald-500/30'
                                : 'bg-slate-500 hover:bg-slate-600'
                        }`}
                    >
                        {isSavedFeedback ? (
                            <>
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Đã lưu!</span>
                            </>
                        ) : (
                            <>
                                {!isAdminUnlocked && <KeyIcon className="w-3.5 h-3.5" />}
                                <span>{isAdminUnlocked ? 'Lưu cấu hình' : 'Nhập mật khẩu để lưu'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
