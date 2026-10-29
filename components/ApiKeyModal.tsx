
import React, { useState, useEffect, useCallback } from 'react';
import * as storage from '../services/storageService';
import { ApiKeyInfo, AIProvider, isProUser, isAdmin, getUseProApi, setUseProApi as saveUseProApi } from '../services/storageService';
import { validateGeminiKey } from '../services/aiService';
import { subscribeToUserCredits } from '../services/firebaseService';
import { GEMINI_VIP_MODEL, formatVND } from '../services/geminiCoreService';
import { CreditsPurchaseModal } from './CreditsPurchaseModal';
import { ExternalLinkIcon, ChevronRightIcon, KeyIcon, ArrowLeftIcon, TrashIcon } from './Icons';
import { auth } from '../src/firebaseConfig';
import * as antigravityService from '../services/antigravityService';
import * as geminiOAuthService from '../services/geminiOAuthService';
import * as nineRouterService from '../services/nineRouterService';

interface ApiKeyModalProps {
    onClose: () => void;
}

type ModalView = 'input' | 'guide';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
    const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
    const [view, setView] = useState<ModalView>('input');
    const [isPro, setIsPro] = useState(false);
    const [useProApi, setUseProApi] = useState(false);
    const [userBalance, setUserBalance] = useState(0); // VND balance
    const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [validatingIndex, setValidatingIndex] = useState<number | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserEmail, setCurrentUserEmail] = useState('');

    // Antigravity state
    const [antigravityEnabled, setAntigravityEnabled] = useState(false);
    const [antigravityConnected, setAntigravityConnected] = useState(false);
    const [antigravityChecking, setAntigravityChecking] = useState(false);
    const [antigravityUpdateInfo, setAntigravityUpdateInfo] = useState<antigravityService.AntigravityUpdateInfo | null>(null);
    const [antigravityInstalled, setAntigravityInstalled] = useState<boolean | null>(null); // null = checking
    const [antigravityUpdating, setAntigravityUpdating] = useState(false);
    const [antigravityUpdateProgress, setAntigravityUpdateProgress] = useState<number>(0);
    const [antigravityUpdateStatus, setAntigravityUpdateStatus] = useState<string>('');

    // NineRouter state
    const [nineRouterEnabled, setNineRouterEnabledState] = useState(false);
    const [nineRouterUrl, setNineRouterUrlState] = useState('');
    const [nineRouterApiKey, setNineRouterApiKeyState] = useState('');
    const [nineRouterImageModel, setNineRouterImageModelState] = useState('');
    const [nineRouterTextModel, setNineRouterTextModelState] = useState('');
    const [nineRouterConnected, setNineRouterConnected] = useState(false);
    const [nineRouterChecking, setNineRouterChecking] = useState(false);
    const [nineRouterErrorMessage, setNineRouterErrorMessage] = useState<string | null>(null);

    // Google OAuth state
    const [oauthEnabled, setOauthEnabled] = useState(false);
    const [oauthEmail, setOauthEmail] = useState<string | null>(null);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [geminiCliInstalled, setGeminiCliInstalled] = useState<boolean | null>(null);

    useEffect(() => {
        // Load Gemini keys
        const storedKeys = storage.getApiKeys('gemini');
        if (storedKeys.length > 0) {
            setKeys(storedKeys);
        } else {
            const legacyKey = localStorage.getItem('api_key_gemini');
            if (legacyKey) {
                setKeys([{ key: legacyKey, status: 'unchecked' }]);
            } else {
                setKeys([{ key: '', status: 'unchecked' }]);
            }
        }

        // Check PRO status
        setIsPro(isProUser());

        // Load PRO API preference
        setUseProApi(getUseProApi());

        // Load Antigravity preference
        setAntigravityEnabled(antigravityService.isAntigravityEnabled());

        // Check Antigravity connection
        checkAntigravityConnection();

        // Check Antigravity installation and updates
        checkAntigravityInstallation();
        checkAntigravityUpdates();

        // Load NineRouter settings
        setNineRouterEnabledState(nineRouterService.isNineRouterEnabled());
        setNineRouterUrlState(nineRouterService.getNineRouterUrl());
        setNineRouterApiKeyState(nineRouterService.getNineRouterApiKey());
        setNineRouterImageModelState(nineRouterService.getNineRouterImageModel());
        setNineRouterTextModelState(nineRouterService.getNineRouterTextModel());
        checkNineRouterConnection();

        // Load Google OAuth state
        setOauthEnabled(geminiOAuthService.isOAuthEnabled());
        setOauthEmail(geminiOAuthService.getOAuthEmail());
        checkGeminiCli();
    }, []);

    const checkAntigravityConnection = async () => {
        setAntigravityChecking(true);
        console.log('[Antigravity UI] Checking connection...');
        try {
            // Force refresh - clear cache first
            const status = await antigravityService.refreshConnectionStatus();
            console.log('[Antigravity UI] Connection status:', status);
            setAntigravityConnected(status.connected);
            // NOTE: We no longer auto-enable when connected.
            // User's toggle preference is respected.
        } catch (err) {
            console.error('[Antigravity UI] Connection check error:', err);
            setAntigravityConnected(false);
        }
        setAntigravityChecking(false);
    };

    const handleAntigravityToggle = () => {
        const newValue = !antigravityEnabled;
        setAntigravityEnabled(newValue);
        antigravityService.setAntigravityEnabled(newValue);
        if (newValue) {
            setNineRouterEnabledState(false);
            nineRouterService.setNineRouterEnabled(false);
        }
    };

    const checkNineRouterConnection = async (targetUrl?: string, targetKey?: string) => {
        const urlToCheck = targetUrl !== undefined ? targetUrl : nineRouterUrl;
        const keyToCheck = targetKey !== undefined ? targetKey : nineRouterApiKey;

        setNineRouterChecking(true);
        setNineRouterErrorMessage(null);
        console.log('[NineRouter UI] Checking connection...', { urlToCheck, keyLength: keyToCheck.length });

        // Auto-save form values immediately
        if (urlToCheck) nineRouterService.setNineRouterUrl(urlToCheck);
        nineRouterService.setNineRouterApiKey(keyToCheck);
        if (nineRouterImageModel) nineRouterService.setNineRouterImageModel(nineRouterImageModel);
        if (nineRouterTextModel) nineRouterService.setNineRouterTextModel(nineRouterTextModel);

        try {
            const status = await nineRouterService.checkConnection(urlToCheck, keyToCheck);
            console.log('[NineRouter UI] Connection status:', status);
            setNineRouterConnected(status.connected);
            if (!status.connected) {
                setNineRouterErrorMessage(status.errorMessage || 'Không thể kết nối');
            }
        } catch (err: any) {
            console.error('[NineRouter UI] Connection check error:', err);
            setNineRouterConnected(false);
            setNineRouterErrorMessage(err?.message || 'Lỗi kết nối tới 9Router');
        }
        setNineRouterChecking(false);
    };

    const handleNineRouterToggle = () => {
        const newValue = !nineRouterEnabled;
        setNineRouterEnabledState(newValue);
        nineRouterService.setNineRouterEnabled(newValue);
        if (newValue) {
            setAntigravityEnabled(false);
            antigravityService.setAntigravityEnabled(false);
        }
    };

    // --- Google OAuth Handlers ---
    const checkGeminiCli = async () => {
        if (!isElectron) return;
        const result = await geminiOAuthService.checkGeminiCliInstalled();
        setGeminiCliInstalled(result.installed || result.hasEnvVars || false);
    };

    const handleOAuthLogin = async () => {
        setOauthLoading(true);
        setOauthError(null);
        try {
            const result = await geminiOAuthService.startGoogleOAuth();
            if (result.success) {
                setOauthEnabled(true);
                setOauthEmail(result.email || null);
            } else {
                setOauthError(result.error || 'Đăng nhập thất bại');
            }
        } catch (err: any) {
            setOauthError(err.message || 'Đăng nhập thất bại');
        }
        setOauthLoading(false);
    };

    const handleOAuthLogout = async () => {
        setOauthLoading(true);
        await geminiOAuthService.logoutOAuth();
        setOauthEnabled(false);
        setOauthEmail(null);
        setOauthLoading(false);
    };

    const checkAntigravityInstallation = async () => {
        const installed = await antigravityService.isAntigravityInstalled();
        setAntigravityInstalled(installed);

        // Try to detect version if installed
        if (installed) {
            await antigravityService.detectInstalledVersion();
        }
    };

    const checkAntigravityUpdates = async () => {
        // Only check if we should (rate limited to once per 24h)
        if (!antigravityService.shouldCheckForUpdates()) {
            return;
        }

        const updateInfo = await antigravityService.checkForAntigravityUpdates();
        if (updateInfo) {
            setAntigravityUpdateInfo(updateInfo);

            // If connected and update available, save current version
            if (antigravityConnected && !updateInfo.hasUpdate) {
                antigravityService.saveInstalledVersion(updateInfo.latestVersion);
            }
        }
    };

    const handleAntigravityAutoUpdate = async () => {
        if (!antigravityUpdateInfo?.windowsDownloadUrl) {
            // Fallback to browser download if no direct download link
            window.open(antigravityUpdateInfo?.downloadUrl || 'https://github.com/lbjlaq/Antigravity-Manager/releases', '_blank');
            return;
        }

        setAntigravityUpdating(true);
        setAntigravityUpdateProgress(0);
        setAntigravityUpdateStatus('Đang chuẩn bị...');

        try {
            const result = await antigravityService.autoUpdateAntigravity(
                antigravityUpdateInfo.windowsDownloadUrl,
                {
                    onProgress: (progress) => {
                        setAntigravityUpdateProgress(progress.percent);
                        setAntigravityUpdateStatus(`Đang tải: ${progress.percent}%`);
                    },
                    onStatus: (status) => {
                        setAntigravityUpdateStatus(status.message);
                        if (status.status === 'complete') {
                            setAntigravityUpdating(false);
                            setAntigravityUpdateInfo(null); // Clear update banner
                            // Refresh installation check
                            setTimeout(() => {
                                checkAntigravityInstallation();
                                checkAntigravityConnection();
                            }, 3000);
                        } else if (status.status === 'error') {
                            setAntigravityUpdating(false);
                        }
                    }
                }
            );

            if (!result.success && result.error?.includes('Not in Electron')) {
                // Opened browser instead, just close the loading state
                setAntigravityUpdating(false);
                setAntigravityUpdateStatus('');
            }
        } catch (error) {
            console.error('[Antigravity] Auto-update error:', error);
            setAntigravityUpdating(false);
            setAntigravityUpdateStatus('Lỗi cập nhật');
        }
    };

    // Subscribe to user credits
    useEffect(() => {
        const user = auth.currentUser;
        if (user) {
            setCurrentUserId(user.uid);
            setCurrentUserName(user.displayName || '');
            setCurrentUserEmail(user.email || '');

            const unsubscribe = subscribeToUserCredits(user.uid, (balance) => {
                setUserBalance(balance);
                if (balance > 0) setIsPro(true);
            });
            return () => unsubscribe();
        }
    }, []);

    const handleKeyChange = (index: number, value: string) => {
        const newKeys = [...keys];
        newKeys[index] = { key: value, status: 'unchecked' };
        setKeys(newKeys);
    };

    const handleAddKey = () => {
        if (keys.length < 5) {
            setKeys([...keys, { key: '', status: 'unchecked' }]);
        }
    };

    const handleRemoveKey = (index: number) => {
        if (keys.length > 1) {
            const newKeys = keys.filter((_, i) => i !== index);
            setKeys(newKeys);
        }
    };

    const handleValidateKey = async (index: number) => {
        const key = keys[index].key.trim();
        if (!key) return;

        setValidatingIndex(index);
        try {
            const result = await validateGeminiKey(key);
            const newKeys = [...keys];
            if (result.isValid) {
                newKeys[index] = { ...newKeys[index], status: 'valid', lastChecked: Date.now() };
            } else if (result.isQuota) {
                newKeys[index] = { ...newKeys[index], status: 'quota_exceeded', lastChecked: Date.now() };
            } else {
                newKeys[index] = { ...newKeys[index], status: 'invalid', lastChecked: Date.now() };
            }
            setKeys(newKeys);
        } catch {
            const newKeys = [...keys];
            newKeys[index] = { ...newKeys[index], status: 'invalid', lastChecked: Date.now() };
            setKeys(newKeys);
        }
        setValidatingIndex(null);
    };

    const handleSaveAll = () => {
        const validKeys = keys.filter(k => k.key.trim());
        storage.saveApiKeys('gemini', validKeys);
        saveUseProApi(useProApi);
        nineRouterService.setNineRouterUrl(nineRouterUrl);
        nineRouterService.setNineRouterApiKey(nineRouterApiKey);
        nineRouterService.setNineRouterImageModel(nineRouterImageModel);
        nineRouterService.setNineRouterTextModel(nineRouterTextModel);
        nineRouterService.setNineRouterEnabled(nineRouterEnabled);
        onClose();
    };

    const getStatusColor = (status: ApiKeyInfo['status']) => {
        switch (status) {
            case 'valid': return 'bg-green-100 text-green-700 border-green-200';
            case 'invalid': return 'bg-red-100 text-red-700 border-red-200';
            case 'quota_exceeded': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusText = (status: ApiKeyInfo['status'] | 'unchecked') => {
        switch (status) {
            case 'valid': return '✓ Hợp lệ';
            case 'invalid': return '✗ Không hợp lệ';
            case 'quota_exceeded': return '⚠ Hết quota';
            default: return '○ Chưa kiểm tra';
        }
    };

    const handleOpenLink = async (url: string) => {
        if (isElectron && (window as any).electronAPI?.openIncognito) {
            await (window as any).electronAPI.openIncognito(url);
        } else {
            window.open(url, '_blank');
        }
    };

    const LinkButton: React.FC<{ href: string; label: string; icon?: React.ReactNode; colorClass?: string; step: number }> =
        ({ href, label, icon, colorClass = "bg-slate-100 text-slate-700 hover:bg-slate-200", step }) => (
            <button
                onClick={() => handleOpenLink(href)}
                className={`flex items-center justify-between p-3 rounded-xl transition-all font-medium text-sm w-full group ${colorClass}`}
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isElectron && [2, 3, 5].includes(step) && (
                        <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded">Ẩn danh</span>
                    )}
                    <ExternalLinkIcon className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                </div>
            </button>
        );

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/40"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                                <KeyIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    {view === 'input' ? 'Cấu hình API Key Gemini' : 'Hướng dẫn lấy Key'}
                                </h2>
                                <p className="text-xs text-slate-500">Nhập API key để sử dụng tính năng AI</p>
                            </div>
                        </div>
                        {view === 'guide' && (
                            <button onClick={() => setView('input')} className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                                <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                            </button>
                        )}
                    </div>

                    <div className="p-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {view === 'input' ? (
                            <div className="animate-fade-in space-y-6">
                                {/* PRO Tier Section - TEMPORARILY DISABLED */}
                                {/* 
                                  VIP Feature is temporarily disabled.
                                  To re-enable, remove the false && condition below.
                                */}
                                {false && (
                                    <div className={`p-4 rounded-xl border-2 shadow-lg ${isPro ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-amber-300' : 'bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-slate-300'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">{isPro ? '👑' : '🔒'}</span>
                                                <div>
                                                    <h3 className={`text-sm font-bold ${isPro ? 'text-amber-800' : 'text-slate-700'}`}>Hệ thống VIP (Direct)</h3>
                                                    <p className={`text-[10px] ${isPro ? 'text-amber-600' : 'text-slate-500'}`}>
                                                        {isPro ? 'Dùng API hệ thống ổn định' : 'Nâng cấp VIP để dùng API không giới hạn'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow ${isPro ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white' : 'bg-slate-400 text-white'}`}>
                                                {isPro ? 'PRO' : 'FREE'}
                                            </span>
                                        </div>

                                        {isPro && userBalance > 0 ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => {
                                                                const newValue = !useProApi;
                                                                setUseProApi(newValue);
                                                                saveUseProApi(newValue);
                                                            }}
                                                            className={`relative w-12 h-6 rounded-full transition-all ${useProApi ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                        >
                                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${useProApi ? 'left-6' : 'left-0.5'}`} />
                                                        </button>
                                                        <div>
                                                            <span className="text-sm font-medium text-amber-800">
                                                                {useProApi ? 'Đang dùng API VIP' : 'Bật để dùng API VIP'}
                                                            </span>
                                                            <p className="text-[10px] text-amber-600">Model: {GEMINI_VIP_MODEL}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-amber-700">{formatVND(userBalance)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setPurchaseModalOpen(true)}
                                                    className="w-full py-2 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 font-bold text-xs rounded-lg hover:from-amber-200 hover:to-yellow-200 transition-all flex items-center justify-center gap-2 border border-amber-200"
                                                >
                                                    <span>💳</span>
                                                    <span>Nạp thêm tiền</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <button
                                                    onClick={() => setPurchaseModalOpen(true)}
                                                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold text-sm rounded-lg hover:from-amber-600 hover:to-yellow-600 shadow-lg transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>💳</span>
                                                    <span>Nạp tiền VIP</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* NineRouter Section */}
                                <div className={`p-4 rounded-xl border-2 shadow-lg ${nineRouterConnected ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300' : 'bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">⚡</span>
                                            <div>
                                                <h3 className={`text-sm font-bold ${nineRouterConnected ? 'text-emerald-800' : 'text-slate-700'}`}>9Router Gateway</h3>
                                                <p className={`text-[10px] ${nineRouterConnected ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                    Kết nối API sang 9Router chạy local
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {nineRouterChecking ? (
                                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-300 text-white animate-pulse">
                                                    Đang kiểm tra...
                                                </span>
                                            ) : (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow ${nineRouterConnected ? 'bg-green-500 text-white' : 'bg-slate-400 text-white'}`}>
                                                    {nineRouterConnected ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {nineRouterErrorMessage && (
                                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-[10px] text-red-700 font-medium">
                                                ❌ {nineRouterErrorMessage}
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleNineRouterToggle}
                                                    className={`relative w-12 h-6 rounded-full transition-all ${nineRouterEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nineRouterEnabled ? 'left-6' : 'left-0.5'}`} />
                                                </button>
                                                <div>
                                                    <span className={`text-sm font-medium ${nineRouterEnabled ? 'text-emerald-800' : 'text-slate-600'}`}>
                                                        {nineRouterEnabled ? '9Router đang BẬT' : 'Bật 9Router'}
                                                    </span>
                                                    <p className="text-[10px] text-slate-500">
                                                        {nineRouterConnected
                                                            ? '✅ Đã kết nối - sẵn sàng sử dụng'
                                                            : nineRouterEnabled
                                                                ? '⚠️ Chưa kết nối - hãy bật 9Router local'
                                                                : 'Định tuyến thông minh qua 9Router'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => checkNineRouterConnection(nineRouterUrl, nineRouterApiKey)}
                                                disabled={nineRouterChecking}
                                                className={`px-2 py-1 text-xs rounded-lg transition-colors ${nineRouterChecking ? 'bg-slate-200' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
                                                title="Kiểm tra kết nối"
                                            >
                                                {nineRouterChecking ? '⏳' : '🔄'}
                                            </button>
                                        </div>

                                        {/* Configuration Details */}
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase">9Router API Endpoint</label>
                                                <input
                                                    type="text"
                                                    placeholder="http://127.0.0.1:20128/v1"
                                                    value={nineRouterUrl}
                                                    onChange={(e) => setNineRouterUrlState(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase">9Router API Key (Tùy chọn)</label>
                                                <input
                                                    type="password"
                                                    placeholder="Nhập 9Router API Key nếu có..."
                                                    value={nineRouterApiKey}
                                                    onChange={(e) => setNineRouterApiKeyState(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Image Model</label>
                                                    <input
                                                        type="text"
                                                        placeholder="ag/gemini-3.1-flash-image"
                                                        value={nineRouterImageModel}
                                                        onChange={(e) => setNineRouterImageModelState(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Text Model</label>
                                                    <input
                                                        type="text"
                                                        placeholder="ag/gemini-3-flash"
                                                        value={nineRouterTextModel}
                                                        onChange={(e) => setNineRouterTextModelState(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dashboard button */}
                                        <button
                                            onClick={() => window.open(nineRouterUrl.replace(/\/v1\/?$/, '') || 'http://localhost:20128', '_blank')}
                                            className="w-full py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 font-bold text-xs rounded-lg hover:from-emerald-200 hover:to-teal-200 transition-all flex items-center justify-center gap-2 border border-emerald-200"
                                        >
                                            <span>📊</span>
                                            <span>Mở 9Router Dashboard</span>
                                            <ExternalLinkIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                {/* Antigravity Manager Section */}
                                <div className={`p-4 rounded-xl border-2 shadow-lg ${antigravityConnected ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-purple-300' : 'bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">🚀</span>
                                            <div>
                                                <h3 className={`text-sm font-bold ${antigravityConnected ? 'text-purple-800' : 'text-slate-700'}`}>Antigravity Manager</h3>
                                                <p className={`text-[10px] ${antigravityConnected ? 'text-purple-600' : 'text-slate-500'}`}>
                                                    Dùng Google Account thay API Key
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {antigravityChecking ? (
                                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-300 text-white animate-pulse">
                                                    Đang kiểm tra...
                                                </span>
                                            ) : (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow ${antigravityConnected ? 'bg-green-500 text-white' : antigravityInstalled ? 'bg-orange-400 text-white' : 'bg-slate-400 text-white'}`}>
                                                    {antigravityConnected ? 'ONLINE' : antigravityInstalled ? 'OFFLINE' : 'CHƯA CÀI'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Update Notification Banner */}
                                    {(antigravityUpdateInfo?.hasUpdate || antigravityUpdating) && (
                                        <div className="mb-3 p-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                                            {antigravityUpdating ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg animate-spin">⏳</span>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-green-700">{antigravityUpdateStatus}</p>
                                                            <div className="w-full bg-green-200 rounded-full h-1.5 mt-1">
                                                                <div
                                                                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                                                    style={{ width: `${antigravityUpdateProgress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">🆕</span>
                                                        <div>
                                                            <p className="text-xs font-bold text-green-700">
                                                                Phiên bản mới: v{antigravityUpdateInfo?.latestVersion}
                                                            </p>
                                                            <p className="text-[10px] text-green-600">
                                                                {antigravityUpdateInfo?.currentVersion
                                                                    ? `Hiện tại: v${antigravityUpdateInfo.currentVersion}`
                                                                    : 'Có bản cập nhật mới!'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={handleAntigravityAutoUpdate}
                                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                                                            title="Tự động tải và cài đặt"
                                                        >
                                                            🚀 Cập nhật tự động
                                                        </button>
                                                        <button
                                                            onClick={() => window.open(antigravityUpdateInfo?.downloadUrl, '_blank')}
                                                            className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                                            title="Mở trang download"
                                                        >
                                                            📥
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Installation Warning */}
                                    {!antigravityConnected && (
                                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-[10px] text-amber-700 font-medium">
                                                ⚠️ <strong>Lưu ý:</strong> Cần cài đặt và cấu hình <strong>Antigravity Tool</strong> trước khi sử dụng tính năng tạo ảnh miễn phí.
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleAntigravityToggle}
                                                    className={`relative w-12 h-6 rounded-full transition-all ${antigravityEnabled ? 'bg-purple-500' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${antigravityEnabled ? 'left-6' : 'left-0.5'}`} />
                                                </button>
                                                <div>
                                                    <span className={`text-sm font-medium ${antigravityEnabled ? 'text-purple-800' : 'text-slate-600'}`}>
                                                        {antigravityEnabled ? 'Antigravity đang BẬT' : 'Bật Antigravity'}
                                                    </span>
                                                    <p className="text-[10px] text-slate-500">
                                                        {antigravityConnected
                                                            ? '✅ Đã kết nối - sẵn sàng sử dụng'
                                                            : antigravityEnabled
                                                                ? '⚠️ Chưa kết nối - hãy bật Antigravity app'
                                                                : 'Pool nhiều Google Account'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={checkAntigravityConnection}
                                                disabled={antigravityChecking}
                                                className={`px-2 py-1 text-xs rounded-lg transition-colors ${antigravityChecking ? 'bg-slate-200' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'}`}
                                                title="Kiểm tra kết nối"
                                            >
                                                {antigravityChecking ? '⏳' : '🔄'}
                                            </button>
                                        </div>

                                        {/* Installation Check & Download & Open Buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    await checkAntigravityInstallation();
                                                    await checkAntigravityConnection();
                                                }}
                                                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border border-slate-200"
                                            >
                                                <span>🔍</span>
                                                <span>Kiểm tra</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (isElectron && (window as any).electronAPI?.antigravityOpenApp) {
                                                        const result = await (window as any).electronAPI.antigravityOpenApp();
                                                        if (result.success) {
                                                            // Auto-check connection after delay
                                                            setTimeout(() => checkAntigravityConnection(), 3000);
                                                        } else {
                                                            alert('Không tìm thấy Antigravity! Vui lòng cài đặt.');
                                                        }
                                                    } else {
                                                        antigravityService.openAntigravityDownload();
                                                    }
                                                }}
                                                disabled={antigravityInstalled === false}
                                                className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-xs rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span>🚀</span>
                                                <span>Mở Antigravity</span>
                                            </button>
                                            <button
                                                onClick={() => antigravityService.openAntigravityDownload()}
                                                className="flex-1 py-2 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 font-bold text-xs rounded-lg hover:from-purple-200 hover:to-indigo-200 transition-all flex items-center justify-center gap-2 border border-purple-200"
                                            >
                                                <span>📥</span>
                                                <span>Tải xuống</span>
                                                <ExternalLinkIcon className="w-3 h-3" />
                                            </button>
                                        </div>

                                        {/* AUTO-DETECT Button */}
                                        <button
                                            onClick={async () => {
                                                setAntigravityChecking(true);
                                                const result = await antigravityService.autoDetectAntigravity((msg) => {
                                                    console.log(msg);
                                                });
                                                if (result.found) {
                                                    setAntigravityConnected(true);
                                                    if (!result.authRequired || result.apiKey) {
                                                        setAntigravityEnabled(true);
                                                        antigravityService.setAntigravityEnabled(true);
                                                    }
                                                } else {
                                                    setAntigravityConnected(false);
                                                }
                                                setAntigravityChecking(false);
                                                await checkAntigravityConnection();
                                            }}
                                            disabled={antigravityChecking}
                                            className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-sm rounded-lg hover:from-green-600 hover:to-emerald-600 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <span>🔎</span>
                                            <span>{antigravityChecking ? 'Đang quét...' : 'Tự động phát hiện'}</span>
                                        </button>

                                        {/* API Key Input (for when auth is required) */}
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="API Key (từ Antigravity Tools)"
                                                defaultValue={antigravityService.getSavedApiKey()}
                                                onChange={(e) => antigravityService.setAntigravityApiKey(e.target.value)}
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                                            />
                                            <button
                                                onClick={checkAntigravityConnection}
                                                disabled={antigravityChecking}
                                                className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors font-medium"
                                            >
                                                {antigravityChecking ? '...' : 'Test'}
                                            </button>
                                        </div>

                                        {/* Installation Status */}
                                        {antigravityInstalled !== null && (
                                            <div className={`p-2 rounded-lg text-xs font-medium ${antigravityInstalled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                                                {antigravityInstalled
                                                    ? `✅ Đã cài đặt Antigravity${antigravityService.getInstalledVersion() ? ` (v${antigravityService.getInstalledVersion()})` : ''}`
                                                    : '❌ Chưa phát hiện Antigravity - Vui lòng tải và cài đặt'}
                                            </div>
                                        )}

                                        {/* Custom URL Input */}
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="URL (vd: http://127.0.0.1:8045)"
                                                defaultValue={antigravityService.getAntigravityUrl()}
                                                onChange={(e) => antigravityService.setAntigravityUrl(e.target.value)}
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                                            />
                                            <button
                                                onClick={checkAntigravityConnection}
                                                disabled={antigravityChecking}
                                                className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors font-medium"
                                            >
                                                {antigravityChecking ? '...' : 'Kết nối'}
                                            </button>
                                        </div>

                                        <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg space-y-1">
                                            <p>💡 <strong>Hướng dẫn:</strong></p>
                                            <ol className="list-decimal list-inside space-y-0.5 ml-2">
                                                <li>Tải và cài đặt <strong>Antigravity Manager</strong></li>
                                                <li>Mở app và thêm <strong>Google Account</strong></li>
                                                <li>Vào tab <strong>"API 反代"</strong> hoặc <strong>"API Proxy"</strong></li>
                                                <li>Nhấn <strong>Start</strong> để bật server</li>
                                                <li>Quay lại đây và nhấn <strong>🔄 Kết nối</strong></li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>

                                {/* Google OAuth Section */}
                                {isElectron && (
                                    <div className={`p-4 rounded-xl border-2 shadow-lg ${
                                        oauthEnabled
                                            ? 'bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 border-blue-300'
                                            : 'bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-slate-200'
                                    }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">🔑</span>
                                                <div>
                                                    <h3 className={`text-sm font-bold ${oauthEnabled ? 'text-blue-800' : 'text-slate-700'}`}>
                                                        Google OAuth (Gemini)
                                                    </h3>
                                                    <p className={`text-[10px] ${oauthEnabled ? 'text-blue-600' : 'text-slate-500'}`}>
                                                        Đăng nhập Google thay vì nhập API Key
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow ${
                                                oauthEnabled
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-slate-400 text-white'
                                            }`}>
                                                {oauthEnabled ? 'CONNECTED' : 'OFF'}
                                            </span>
                                        </div>

                                        {/* Warning */}
                                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-[10px] text-amber-700 font-medium">
                                                ⚠️ <strong>Lưu ý:</strong> Đây là tích hợp <strong>không chính thức</strong>. Có rủi ro bị Google hạn chế tài khoản. Nên dùng tài khoản phụ.
                                            </p>
                                        </div>



                                        {/* Error Display */}
                                        {oauthError && (
                                            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                                                <p className="text-[10px] text-red-700 font-medium">❌ {oauthError}</p>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {oauthEnabled && oauthEmail ? (
                                                /* Logged In State */
                                                <>
                                                    <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">✅</span>
                                                            <div>
                                                                <p className="text-xs font-bold text-green-700">Đã kết nối</p>
                                                                <p className="text-[10px] text-green-600 font-mono">{oauthEmail}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={handleOAuthLogout}
                                                            disabled={oauthLoading}
                                                            className="px-3 py-1.5 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors font-medium disabled:opacity-50"
                                                        >
                                                            {oauthLoading ? '...' : '🚪 Đăng xuất'}
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                /* Logged Out State */
                                                <button
                                                    onClick={handleOAuthLogin}
                                                    disabled={oauthLoading}
                                                    className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-sm rounded-lg hover:from-blue-600 hover:to-cyan-600 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {oauthLoading ? (
                                                        <>
                                                            <span className="animate-spin">⏳</span>
                                                            <span>Đang chờ đăng nhập...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>🔐</span>
                                                            <span>Đăng nhập bằng Google</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                                            <p>💡 Đăng nhập bằng tài khoản Google để sử dụng Gemini API miễn phí (không cần API Key).</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-slate-400">
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Hoặc tự nhập Key cá nhân</span>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                </div>

                                <div className="space-y-4">
                                    {keys.map((keyInfo, index) => (
                                        <div key={index} className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500">Key #{index + 1}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(keyInfo.status)}`}>
                                                    {getStatusText(keyInfo.status)}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    value={keyInfo.key}
                                                    onChange={(e) => handleKeyChange(index, e.target.value)}
                                                    placeholder="Nhập Gemini API Key..."
                                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs"
                                                />
                                                <button
                                                    onClick={() => handleValidateKey(index)}
                                                    disabled={validatingIndex === index || !keyInfo.key.trim()}
                                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50 text-xs font-bold transition-colors"
                                                >
                                                    {validatingIndex === index ? '...' : 'Test'}
                                                </button>
                                                {keys.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveKey(index)}
                                                        className="px-2 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {keys.length < 5 && (
                                        <button
                                            onClick={handleAddKey}
                                            className="w-full p-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all text-sm font-medium active:scale-95"
                                        >
                                            + Thêm API Key mới ({keys.length}/5)
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setView('guide')}
                                        className="w-full mt-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl flex items-center justify-between group hover:shadow-md transition-all cursor-pointer text-left"
                                    >
                                        <div>
                                            <h4 className="font-bold text-indigo-800 text-sm">Chưa có API Key?</h4>
                                            <p className="text-xs text-indigo-600 mt-0.5">Xem hướng dẫn lấy Key miễn phí 100%</p>
                                        </div>
                                        <div className="bg-white p-2 rounded-full text-indigo-500 shadow-sm group-hover:translate-x-1 transition-transform">
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </div>
                                    </button>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={onClose}
                                        className="px-6 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Đóng
                                    </button>
                                    <button
                                        onClick={handleSaveAll}
                                        className="px-8 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                    >
                                        Lưu cấu hình
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in space-y-4 pb-4">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800">
                                    💡 <strong>Mẹo:</strong> Dùng trình duyệt ẩn danh để đăng ký Key mới nhanh hơn.
                                </div>

                                {[
                                    { step: 1, title: 'Mở Gmail', label: 'Mở Hộp thư Gmail', href: 'https://mail.google.com/', icon: '📧' },
                                    { step: 2, title: 'Firefox Relay', label: 'Đăng nhập FF Relay', href: 'https://relay.firefox.com/', icon: '🦊' },
                                    { step: 3, title: 'Google Skills', label: 'Trang đăng ký Skills', href: 'https://www.skills.google/users/sign_up', icon: '🎓' },
                                    { step: 4, title: 'Lưu ý', description: 'Copy link xác nhận từ Gmail dán vào Tab ẩn danh Bước 3.', type: 'note' },
                                    { step: 5, title: 'Kích hoạt', label: 'Trang kích hoạt API', href: 'https://www.skills.google/focuses/86504?catalog_rank=%7B%22rank%22%3A5%2C%22num_filters%22%3A0%2C%22has_search%22%3Atrue%7D&parent=catalog&search_id=54131613', icon: '🚀' }
                                ].map((item, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">BƯỚC {item.step}</span>
                                            <span className="text-xs font-semibold text-slate-600">{item.title}</span>
                                        </div>
                                        {item.type === 'note' ? (
                                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs font-medium text-amber-800">
                                                {item.description}
                                            </div>
                                        ) : (
                                            <LinkButton
                                                step={item.step}
                                                href={item.href}
                                                label={item.label}
                                                icon={<span className="text-sm">{item.icon}</span>}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isPurchaseModalOpen && currentUserId && (
                <CreditsPurchaseModal
                    userId={currentUserId}
                    userName={currentUserName}
                    userEmail={currentUserEmail}
                    currentBalance={userBalance}
                    onClose={() => setPurchaseModalOpen(false)}
                    onSuccess={(newBalance) => {
                        setUserBalance(newBalance);
                        if (newBalance > 0) setIsPro(true);
                    }}
                />
            )}
        </>
    );
};
