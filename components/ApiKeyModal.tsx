import React, { useState, useEffect } from 'react';
import * as nineRouterService from '../services/nineRouterService';

interface ApiKeyModalProps {
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
    // Cấu hình State
    const [nineRouterEnabled, setNineRouterEnabledState] = useState(() => nineRouterService.isNineRouterEnabled());
    const [nineRouterUrl, setNineRouterUrlState] = useState(() => nineRouterService.getNineRouterUrl());
    const [nineRouterApiKey] = useState(() => nineRouterService.getNineRouterApiKey());
    
    const [isConnected, setIsConnected] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSavedFeedback, setIsSavedFeedback] = useState(false);

    // Native Gateway & Muse in-process status
    const [nativeStatus, setNativeStatus] = useState<any>(null);
    const [manualCookieInput, setManualCookieInput] = useState('');
    const [showGoogleList, setShowGoogleList] = useState(false);
    const [showMuseList, setShowMuseList] = useState(true);
    const [isDeletingAccId, setIsDeletingAccId] = useState<string | null>(null);

    // Trạng thái kiểm tra toàn diện
    const [testResult, setTestResult] = useState<{
        status: 'idle' | 'testing' | 'success' | 'error';
        message: string;
        details?: string[];
    }>({ status: 'idle', message: '' });

    const refreshNativeStatus = async () => {
        try {
            if (window.electronAPI?.getNativeGatewayStatus) {
                const st = await window.electronAPI.getNativeGatewayStatus();
                setNativeStatus(st);
                return st;
            }
            // Fallback for browser mode: check health via direct HTTP fetch
            const res8317 = await fetch('http://127.0.0.1:8317/health').then(r => r.json()).catch(() => null);
            const res18610 = await fetch('http://127.0.0.1:18610/health').then(r => r.json()).catch(() => null);
            let museAccounts: any[] = [];
            try {
                const accResp = await fetch('http://127.0.0.1:18610/admin/accounts', {
                    headers: { 'Authorization': 'Bearer 123456' }
                });
                if (accResp.ok) {
                    const accJson = await accResp.json();
                    museAccounts = accJson.data || [];
                }
            } catch { }

            const activeMuse = museAccounts.filter(a => a.status === 'active' || (a.enabled !== false && a.status !== 'invalid' && a.status !== 'expired')).length;

            const fallbackSt = {
                port8317: res8317?.status === 'ok',
                port18610: res18610?.status === 'ok',
                googleAccounts: new Array(res8317?.accounts || 0).fill({ email: 'Tài khoản Google' }),
                museStatus: {
                    configured: res18610?.configured || museAccounts.length > 0,
                    accountsCount: museAccounts.length || res18610?.accounts || 0,
                    activeAccountsCount: activeMuse,
                    accounts: museAccounts
                }
            };
            setNativeStatus(fallbackSt);
            return fallbackSt;
        } catch {
            return null;
        }
    };

    // Initial connection test
    useEffect(() => {
        const activeUrl = nineRouterService.getNineRouterUrl();
        setNineRouterUrlState(activeUrl);
        checkConnection(activeUrl, nineRouterApiKey);
        refreshNativeStatus();
        let unsub: (() => void) | undefined;
        if (window.electronAPI?.onQuotaOAuthCaptured) {
            unsub = window.electronAPI.onQuotaOAuthCaptured(async () => {
                setTimeout(refreshNativeStatus, 1500);
            });
        }
        return () => { if (unsub) unsub(); };
    }, []);

    const handleSaveManualCookie = async () => {
        if (!manualCookieInput.trim()) return;
        let jar: Record<string, string> = {};
        const str = manualCookieInput.trim();
        if (str.startsWith('{') || str.startsWith('[')) {
            try {
                const parsed = JSON.parse(str);
                if (Array.isArray(parsed)) {
                    parsed.forEach((c: any) => { if (c.name && c.value) jar[c.name] = c.value; });
                } else {
                    jar = parsed;
                }
            } catch { }
        } else if (str.includes('=')) {
            str.split(';').forEach(pair => {
                const [k, ...v] = pair.trim().split('=');
                if (k && v.length) jar[k.trim()] = v.join('=').trim();
            });
        } else if (str.length > 20) {
            jar['hatch_sess'] = str;
        }

        if (Object.keys(jar).length > 0) {
            try {
                if (window.electronAPI?.museSaveCookies) {
                    const res = await window.electronAPI.museSaveCookies(jar);
                    if (res && res.error) {
                        alert(`Lỗi lưu cookie Muse: ${res.error}`);
                        return;
                    }
                } else {
                    const cookieStr = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
                    const resp = await fetch('http://127.0.0.1:18610/admin/accounts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer 123456'
                        },
                        body: JSON.stringify({
                            cookies: cookieStr,
                            label: `ImageTool-${new Date().toLocaleDateString('vi-VN')}`
                        })
                    });
                    if (!resp.ok) {
                        const err = await resp.text();
                        alert(`Lỗi lưu cookie: ${err}`);
                        return;
                    }
                }
                setManualCookieInput('');
                await refreshNativeStatus();
                alert('Đã lưu và kích hoạt tài khoản Muse thành công!');
            } catch (saveErr: any) {
                alert(`Lỗi lưu cookie: ${saveErr?.message || saveErr}`);
            }
        } else {
            alert('Không thể nhận diện định dạng cookie. Vui lòng dán chuỗi cookie (có hatch_sess=...) hoặc chuỗi token hatch_sess.');
        }
    };

    const handleDeleteMuseAccount = async (id: string, label?: string) => {
        if (!confirm(`Bạn có chắc muốn xóa tài khoản Muse "${label || id}"?`)) return;
        setIsDeletingAccId(id);
        try {
            if (window.electronAPI?.museDeleteAccount) {
                await window.electronAPI.museDeleteAccount(id);
            } else {
                await fetch(`http://127.0.0.1:18610/admin/accounts/${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer 123456' }
                });
            }
            await refreshNativeStatus();
        } catch (e: any) {
            alert(`Lỗi khi xóa tài khoản: ${e?.message || e}`);
        } finally {
            setIsDeletingAccId(null);
        }
    };

    const handleGoogleLogin = async () => {
        if (window.electronAPI?.googleLogin) {
            await window.electronAPI.googleLogin();
        } else {
            window.open('http://127.0.0.1:51121', '_blank');
        }
        const pollTimer = setInterval(async () => {
            await refreshNativeStatus();
        }, 2000);
        setTimeout(() => clearInterval(pollTimer), 30000);
    };

    const checkConnection = async (targetUrl?: string, targetKey?: string) => {
        const urlToCheck = targetUrl !== undefined ? targetUrl : nineRouterUrl;
        const keyToCheck = targetKey !== undefined ? targetKey : nineRouterApiKey;

        setIsChecking(true);
        setErrorMessage(null);

        try {
            const status = await nineRouterService.checkConnection(urlToCheck, keyToCheck);
            const currentActualUrl = nineRouterService.getNineRouterUrl();
            if (currentActualUrl !== nineRouterUrl) {
                setNineRouterUrlState(currentActualUrl);
            }
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

    // Kiểm tra toàn diện hệ thống (Google CLI, Muse Gateway, Tài khoản)
    const handleRunFullCheck = async () => {
        setTestResult({ status: 'testing', message: 'Đang kiểm tra toàn bộ hệ thống...' });

        try {
            const st = await refreshNativeStatus();
            const routerStatus = await nineRouterService.checkConnection(nineRouterUrl, nineRouterApiKey);
            setIsConnected(routerStatus.connected);

            const errors: string[] = [];
            const successes: string[] = [];

            // 1. Google CLI (Port 8317)
            if (st?.port8317) {
                const googleCount = st.googleAccounts?.length || 0;
                if (googleCount > 0) {
                    successes.push(`Google CLI (Cổng 8317): Hoạt động tốt (${googleCount} tài khoản sẵn sàng)`);
                } else {
                    errors.push(`Google CLI (Cổng 8317): Đang mở nhưng chưa có tài khoản Google nào`);
                }
            } else {
                errors.push(`Google CLI (Cổng 8317): Mất kết nối hoặc dịch vụ chưa khởi động`);
            }

            // 2. Muse Gateway (Port 18610)
            if (st?.port18610) {
                const totalMuse = st.museStatus?.accountsCount || 0;
                const activeMuse = st.museStatus?.activeAccountsCount || 0;
                if (totalMuse === 0) {
                    errors.push(`Muse Gateway (Cổng 18610): Chưa có tài khoản Muse nào (hãy dán cookie)`);
                } else if (activeMuse === 0) {
                    errors.push(`Muse Gateway (Cổng 18610): Toàn bộ ${totalMuse} tài khoản Muse đã hết hạn hoặc lỗi`);
                } else {
                    successes.push(`Muse Gateway (Cổng 18610): Hoạt động tốt (${activeMuse}/${totalMuse} tài khoản hoạt động)`);
                }
            } else {
                errors.push(`Muse Gateway (Cổng 18610): Mất kết nối hoặc cổng chưa khởi động`);
            }

            // 3. Định tuyến Router
            if (routerStatus.connected) {
                successes.push(`Định tuyến AI: Kết nối thành công`);
            } else {
                errors.push(`Định tuyến AI: ${routerStatus.errorMessage || 'Không thể kết nối'}`);
            }

            if (errors.length === 0) {
                setTestResult({
                    status: 'success',
                    message: 'Thành công! Mọi kết nối đều hoạt động tốt.'
                });
            } else {
                setTestResult({
                    status: 'error',
                    message: 'Kiểm tra phát hiện sự cố cần xử lý:',
                    details: errors
                });
            }
        } catch (err: any) {
            setTestResult({
                status: 'error',
                message: 'Lỗi trong quá trình kiểm tra:',
                details: [err?.message || 'Không thể hoàn tất kiểm tra hệ thống.']
            });
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

        setIsSavedFeedback(true);
        setTimeout(() => {
            setIsSavedFeedback(false);
            onClose();
        }, 400);
    };

    const isCoreOnline = Boolean(nativeStatus?.port8317 && nativeStatus?.port18610);

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
                                            ? 'Sẵn sàng xử lý tác vụ tạo ảnh & video'
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

                    {/* CỔNG TÍCH HỢP NỘI BỘ ALL-IN-ONE */}
                    <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-teal-50/50 border border-indigo-200/70 rounded-2xl ring-1 ring-indigo-500/15 shadow-xs">
                        
                        {/* Header Lõi Nội Bộ: Tối giản, chỉ hiển thị đúng 1 nút xanh (đỏ nếu lỗi) */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    ⚡
                                </div>
                                <h3 className="text-xs font-bold text-slate-900 leading-tight">
                                    Lõi Nội Bộ All-in-One (Nhúng sẵn trong App)
                                </h3>
                            </div>
                            <div className="flex items-center">
                                {isCoreOnline ? (
                                    <span
                                        className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shadow-sm inline-block cursor-help"
                                        title="Lõi nội bộ đang kết nối tốt (Cổng 8317 & 18610 online)"
                                    />
                                ) : (
                                    <span
                                        className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-100 shadow-sm inline-block cursor-help"
                                        title="Lõi nội bộ mất kết nối hoặc cổng chưa khởi động"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Google Accounts */}
                            <div className="bg-white/95 p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                                            <span>🔵 Google / Gemini (CLI)</span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
                                                {nativeStatus?.googleAccounts?.length || 0} Acc
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Port 8317
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            {nativeStatus?.googleAccounts?.length
                                                ? `Đã nhận ${nativeStatus.googleAccounts.length} tài khoản (Auto-rotation)`
                                                : 'Chưa có tài khoản nào'}
                                        </p>
                                        {Boolean(nativeStatus?.googleAccounts?.length) && (
                                            <button
                                                type="button"
                                                onClick={() => setShowGoogleList(!showGoogleList)}
                                                className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                                            >
                                                {showGoogleList ? 'Thu gọn' : 'Chi tiết'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Danh sách acc Google chi tiết */}
                                    {showGoogleList && nativeStatus?.googleAccounts && (
                                        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200/70 max-h-32 overflow-y-auto space-y-1 text-[11px] animate-fade-in custom-scrollbar">
                                            {nativeStatus.googleAccounts.map((acc: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between text-slate-700 bg-white px-2 py-1 rounded border border-slate-100 shadow-2xs">
                                                    <span className="truncate max-w-[170px] font-mono text-[10px] font-medium" title={acc.email}>{acc.email || `Tài khoản ${idx + 1}`}</span>
                                                    <span className="text-[9px] font-bold text-emerald-600 shrink-0">🟢 Sẵn sàng</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Sẵn sàng
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleGoogleLogin}
                                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer"
                                    >
                                        + Thêm Acc Google
                                    </button>
                                </div>
                            </div>

                            {/* Muse Account */}
                            <div className="bg-white/95 p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                                            <span>🟣 Muse AI Media</span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/80">
                                                {nativeStatus?.museStatus?.accountsCount || (nativeStatus?.museStatus?.configured ? 1 : 0)} Acc
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                Port 18610
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-medium">
                                            {nativeStatus?.museStatus?.accountsCount ? (
                                                nativeStatus?.museStatus?.activeAccountsCount > 0 ? (
                                                    <span className="text-emerald-700 font-semibold">
                                                        🟢 {nativeStatus.museStatus.activeAccountsCount}/{nativeStatus.museStatus.accountsCount} tài khoản sẵn sàng
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-700 font-semibold">
                                                        ⚠️ {nativeStatus.museStatus.accountsCount} tài khoản đã hết hạn cookie
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-slate-500">Chưa có tài khoản nào</span>
                                            )}
                                        </p>
                                        {Boolean(nativeStatus?.museStatus?.accounts?.length) && (
                                            <button
                                                type="button"
                                                onClick={() => setShowMuseList(!showMuseList)}
                                                className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
                                            >
                                                {showMuseList ? 'Thu gọn' : 'Chi tiết'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Danh sách acc Muse: Acc lỗi báo màu cam và có nút xóa acc */}
                                    {showMuseList && nativeStatus?.museStatus?.accounts && (
                                        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200/70 max-h-36 overflow-y-auto space-y-1 text-[11px] animate-fade-in custom-scrollbar">
                                            {nativeStatus.museStatus.accounts.map((acc: any, idx: number) => {
                                                const isErr = acc.status !== 'active';
                                                return (
                                                    <div key={acc.id || idx} className="flex items-center justify-between text-slate-700 bg-white px-2 py-1 rounded border border-slate-100 shadow-2xs gap-2">
                                                        <span className="truncate flex-1 font-mono text-[10px] font-medium" title={acc.label || acc.id}>
                                                            {acc.label || acc.id}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {isErr ? (
                                                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded flex items-center gap-1" title={acc.last_error || 'Tài khoản lỗi hoặc hết hạn'}>
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                    Lỗi
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    Hoạt động
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMuseAccount(acc.id, acc.label)}
                                                                disabled={isDeletingAccId === acc.id}
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                title="Xóa tài khoản này khỏi hệ thống"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Duy nhất chỗ dán cookie Muse trên giao diện */}
                                <div className="mt-2.5 pt-2 border-t border-slate-100">
                                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                                        Dán Cookie Muse:
                                    </label>
                                    <div className="flex gap-1.5">
                                        <input
                                            type="text"
                                            value={manualCookieInput}
                                            onChange={(e) => setManualCookieInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveManualCookie(); }}
                                            placeholder="hatch_sess=... hoặc chuỗi cookie"
                                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSaveManualCookie}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer shrink-0"
                                        >
                                            Lưu
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hộp hiển thị kết quả kiểm tra hệ thống */}
                    {testResult.status === 'testing' && (
                        <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-blue-700 text-xs flex items-center gap-2 animate-fade-in">
                            <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            <span className="font-semibold">Đang kiểm tra toàn bộ kết nối CLI, Muse và tài khoản...</span>
                        </div>
                    )}

                    {testResult.status === 'success' && (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs animate-fade-in space-y-1.5">
                            <div className="flex items-center gap-2 font-bold text-emerald-900 text-[13px]">
                                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{testResult.message}</span>
                            </div>
                            {testResult.details && testResult.details.length > 0 && (
                                <ul className="pl-6 list-disc space-y-0.5 text-[11px] text-emerald-700 font-medium">
                                    {testResult.details.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {testResult.status === 'error' && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs animate-fade-in space-y-1.5">
                            <div className="flex items-center gap-2 font-bold text-rose-900 text-[13px]">
                                <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>{testResult.message}</span>
                            </div>
                            {testResult.details && testResult.details.length > 0 && (
                                <ul className="pl-6 list-disc space-y-0.5 text-[11px] text-rose-700 font-medium">
                                    {testResult.details.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-slate-50/80 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                        Đóng
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleRunFullCheck}
                            disabled={testResult.status === 'testing'}
                            className="px-4 py-2.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                            {testResult.status === 'testing' ? (
                                <>
                                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                    </svg>
                                    <span>Đang kiểm tra...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Kiểm Tra</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20"
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
        </div>
    );
};
