import React, { useState, useEffect, useCallback } from 'react';
import {
    checkForUpdate,
    checkAndApplySilentOta,
    openDownloadPage,
    downloadAndInstallApk,
    ApkInstaller,
    isMobilePlatform,
    isElectronPlatform,
    UpdateInfo
} from '../services/appUpdateService';

interface ElectronUpdateInfo {
    version: string;
}

interface ElectronUpdateProgress {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}

export const UpdateNotification: React.FC = () => {
    // Common state
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [newVersion, setNewVersion] = useState<string>('');
    const [currentVersion, setCurrentVersion] = useState<string>('');
    const [dismissed, setDismissed] = useState(false);

    // Mobile-specific state
    const [isOtaUpdate, setIsOtaUpdate] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [releaseNotes, setReleaseNotes] = useState<string>('');
    const [mobileDownloading, setMobileDownloading] = useState(false);
    const [mobileProgress, setMobileProgress] = useState(0);
    const [otaToastVersion, setOtaToastVersion] = useState<string | null>(null);

    // Electron-specific state
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string>('');
    const [noUpdateToast, setNoUpdateToast] = useState(false);

    const isElectron = isElectronPlatform();
    const isMobile = isMobilePlatform();

    const triggerMobileAutoUpdate = useCallback(async (isManual = false) => {
        if (!isMobile) return;

        // 1. Try silent Over-The-Air update first (NO manual APK install needed!)
        try {
            const ota = await checkAndApplySilentOta(true);
            if (ota.updated) {
                setOtaToastVersion(ota.version || null);
                setTimeout(() => setOtaToastVersion(null), 4500);
                return;
            }
        } catch {}

        // 2. Fallback check: if native binary APK update is required or manual check requested
        const info: UpdateInfo = await checkForUpdate();
        setCurrentVersion(info.currentVersion);
        if (info.hasUpdate) {
            setUpdateAvailable(true);
            setIsOtaUpdate(info.isOta);
            setNewVersion(info.latestVersion);
            setDownloadUrl(info.downloadUrl);
            setReleaseNotes(info.releaseNotes);
            setDismissed(false);
        } else if (isManual) {
            setNoUpdateToast(true);
            setTimeout(() => setNoUpdateToast(false), 3500);
        }
    }, [isMobile]);

    // Check for updates on mount and whenever network connects
    useEffect(() => {
        // For Electron - built-in auto-updater (autoDownload = true)
        if (isElectron && (window as any).electronAPI) {
            const api = (window as any).electronAPI;
            api.getAppVersion().then(setCurrentVersion);

            api.onUpdateAvailable((info: ElectronUpdateInfo) => {
                setUpdateAvailable(true);
                setNewVersion(info.version);
                setIsDownloading(true);
            });

            api.onUpdateNotAvailable?.(() => {
                setNoUpdateToast(true);
                setTimeout(() => setNoUpdateToast(false), 3500);
            });

            api.onUpdateProgress((progress: ElectronUpdateProgress) => {
                setIsDownloading(true);
                setDownloadProgress(Math.round(progress.percent));
            });

            api.onUpdateDownloaded(() => {
                setUpdateDownloaded(true);
                setIsDownloading(false);
            });

            api.onUpdateError((err: string) => {
                setError(err);
                setIsDownloading(false);
            });
        }

        // For Mobile Android - silent OTA when internet is available
        if (isMobile) {
            triggerMobileAutoUpdate(false);

            const handleOnline = () => {
                console.log('[AppUpdate] Network online -> auto updating silently...');
                triggerMobileAutoUpdate(false);
            };
            const handleManualCheck = () => {
                triggerMobileAutoUpdate(true);
            };
            const handleOtaApplied = (e: any) => {
                if (e?.detail?.version) {
                    setOtaToastVersion(e.detail.version);
                    setTimeout(() => setOtaToastVersion(null), 4500);
                }
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('check-app-update', handleManualCheck);
            window.addEventListener('ota-update-applied', handleOtaApplied);
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('check-app-update', handleManualCheck);
                window.removeEventListener('ota-update-applied', handleOtaApplied);
            };
        }
    }, [isElectron, isMobile, triggerMobileAutoUpdate]);

    // Electron actions
    const handleElectronDownload = async () => {
        if (!(window as any).electronAPI) return;
        setIsDownloading(true);
        setError('');
        await (window as any).electronAPI.downloadUpdate();
    };

    const handleElectronInstall = () => {
        if (!(window as any).electronAPI) return;
        (window as any).electronAPI.installUpdate();
    };

    // Mobile fallback update handler
    const handleMobileUpdate = async () => {
        if (isOtaUpdate && downloadUrl) {
            setMobileDownloading(true);
            setMobileProgress(40);
            try {
                await ApkInstaller.applyOtaUpdate({
                    bundleUrl: downloadUrl,
                    version: newVersion,
                    reloadNow: true
                });
                setMobileProgress(100);
                return;
            } catch (err: any) {
                setError(err?.message || 'Cập nhật OTA thất bại.');
            } finally {
                setMobileDownloading(false);
            }
            return;
        }

        if (!downloadUrl) {
            openDownloadPage();
            return;
        }

        setMobileDownloading(true);
        setError('');
        setMobileProgress(5);

        try {
            const res = await downloadAndInstallApk(downloadUrl, (percent) => {
                setMobileProgress(percent);
            });

            if (!res.success && res.message) {
                setError(res.message);
            }
        } catch (err: any) {
            setError(err?.message || 'Có lỗi xảy ra khi tải bản cập nhật.');
            openDownloadPage(downloadUrl);
        } finally {
            setMobileDownloading(false);
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
    };

    // Show silent OTA success toast
    if (otaToastVersion) {
        return (
            <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-[9999] bg-emerald-950/95 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500/40 animate-fade-in text-xs sm:text-sm backdrop-blur-md">
                <span className="text-emerald-400 text-lg">⚡</span>
                <span>Đã tự động nâng cấp lên phiên bản mới nhất (<strong>v{otaToastVersion}</strong>)</span>
            </div>
        );
    }

    if (!updateAvailable && !updateDownloaded) {
        if (noUpdateToast) {
            return (
                <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-[9999] bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-fade-in text-xs sm:text-sm backdrop-blur-md">
                    <span className="text-emerald-400 text-lg">✓</span>
                    <span>Bạn đang ở phiên bản mới nhất (<strong>v{currentVersion}</strong>)</span>
                </div>
            );
        }
        return null;
    }

    if (dismissed && !isElectron) return null;

    // RENDER UPDATE MODAL (Only when user interaction is required, e.g., Electron restart or binary APK update)
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
            <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200/90 ${isElectron ? 'p-8 max-w-lg' : 'p-6 max-w-sm'} w-full animate-fade-in`}>

                {/* Header */}
                <div className="text-center mb-5">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3 ring-4 ring-indigo-50">
                        <svg className="w-8 h-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Đã có phiên bản mới
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                        {updateDownloaded ? '🎉 Sẵn sàng cập nhật!' : 'Cập nhật ImageTool'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                        <span className="font-semibold text-slate-600">v{currentVersion || '2.25.42'}</span>
                        <span className="mx-2 text-indigo-400 font-bold">→</span>
                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">v{newVersion}</span>
                    </p>
                </div>

                {/* Progress Area */}
                {isElectron ? (
                    <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 rounded-2xl p-5 mb-5 border border-indigo-100">
                        {updateDownloaded ? (
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-800 font-bold text-sm">Đã tải tự động hoàn tất!</p>
                                <p className="text-slate-500 text-xs mt-0.5">Nhấn để khởi động lại và áp dụng phiên bản mới.</p>
                            </div>
                        ) : isDownloading ? (
                            <div className="text-center">
                                <p className="text-slate-700 font-semibold text-xs mb-2">Đang tự động tải bản cập nhật...</p>
                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-indigo-600 font-extrabold text-base mt-1.5">{downloadProgress}%</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-slate-700 font-medium text-xs">
                                    Phiên bản mới đã sẵn sàng với nhiều cải tiến hiệu năng.
                                </p>
                            </div>
                        )}
                        {error && (
                            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-red-600 text-xs font-medium">❌ {error}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-2xl p-4 mb-4 border border-indigo-100/80">
                        {mobileDownloading ? (
                            <div className="text-center py-1">
                                <p className="text-slate-700 font-bold text-xs mb-2 flex items-center justify-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                                    Đang tải bản cập nhật...
                                </p>
                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 h-2.5 rounded-full transition-all duration-200"
                                        style={{ width: `${mobileProgress}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-1.5">
                                    <span>Tự động áp dụng khi xong</span>
                                    <span className="text-indigo-600 font-bold">{mobileProgress}%</span>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-700 font-semibold text-xs leading-relaxed">
                                    ✨ Phiên bản nâng cấp lõi hệ thống mới đã sẵn sàng cài đặt.
                                </p>
                                {releaseNotes && (
                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 italic">
                                        "{releaseNotes.trim()}"
                                    </p>
                                )}
                            </div>
                        )}
                        {error && (
                            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-600 text-xs font-medium">{error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {isElectron ? (
                        updateDownloaded ? (
                            <button
                                onClick={handleElectronInstall}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer active:scale-95"
                            >
                                Cài đặt và khởi động lại ngay
                            </button>
                        ) : isDownloading ? (
                            <button disabled className="w-full py-3 bg-slate-200 text-slate-500 font-bold rounded-xl cursor-not-allowed text-sm">
                                Đang tự động tải ({downloadProgress}%)...
                            </button>
                        ) : (
                            <button
                                onClick={handleElectronDownload}
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer active:scale-95"
                            >
                                Cập nhật ngay
                            </button>
                        )
                    ) : (
                        mobileDownloading ? (
                            <button disabled className="w-full py-3 bg-indigo-100 text-indigo-500 font-bold rounded-xl text-xs flex items-center justify-center gap-2">
                                <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                                Đang tải và cài đặt...
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleDismiss}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                                >
                                    Để sau
                                </button>
                                <button
                                    onClick={handleMobileUpdate}
                                    className="flex-2 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <span>⚡ Cập nhật ngay</span>
                                </button>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
