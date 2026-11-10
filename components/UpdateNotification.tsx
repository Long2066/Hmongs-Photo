import React, { useState, useEffect, useCallback } from 'react';
import {
    checkForUpdate,
    openDownloadPage,
    downloadAndInstallApk,
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
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [releaseNotes, setReleaseNotes] = useState<string>('');
    const [mobileDownloading, setMobileDownloading] = useState(false);
    const [mobileProgress, setMobileProgress] = useState(0);

    // Electron-specific state
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string>('');
    const [noUpdateToast, setNoUpdateToast] = useState(false);

    const isElectron = isElectronPlatform();
    const isMobile = isMobilePlatform();

    const triggerMobileCheck = useCallback(() => {
        if (!isMobile) return;
        checkForUpdate().then((info: UpdateInfo) => {
            setCurrentVersion(info.currentVersion);
            if (info.hasUpdate) {
                setUpdateAvailable(true);
                setNewVersion(info.latestVersion);
                setDownloadUrl(info.downloadUrl);
                setReleaseNotes(info.releaseNotes);
            }
        });
    }, [isMobile]);

    // Check for updates on mount and whenever network becomes available
    useEffect(() => {
        // For Electron - use built-in auto-updater
        if (isElectron && (window as any).electronAPI) {
            const api = (window as any).electronAPI;
            api.getAppVersion().then(setCurrentVersion);

            api.onUpdateAvailable((info: ElectronUpdateInfo) => {
                setUpdateAvailable(true);
                setNewVersion(info.version);
            });

            api.onUpdateNotAvailable?.(() => {
                setNoUpdateToast(true);
                setTimeout(() => setNoUpdateToast(false), 3500);
            });

            api.onUpdateProgress((progress: ElectronUpdateProgress) => {
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

        // For Mobile - check GitHub Releases
        if (isMobile) {
            triggerMobileCheck();

            // Auto check when network reconnects ("auto cập nhật khi có mạng")
            const handleOnline = () => {
                console.log('[AppUpdate] Network connected, auto-checking for updates...');
                triggerMobileCheck();
            };
            const handleManualCheck = () => {
                checkForUpdate().then((info: UpdateInfo) => {
                    setCurrentVersion(info.currentVersion);
                    if (info.hasUpdate) {
                        setUpdateAvailable(true);
                        setNewVersion(info.latestVersion);
                        setDownloadUrl(info.downloadUrl);
                        setReleaseNotes(info.releaseNotes);
                    } else {
                        setNoUpdateToast(true);
                        setTimeout(() => setNoUpdateToast(false), 3500);
                    }
                });
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('check-app-update', handleManualCheck);
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('check-app-update', handleManualCheck);
            };
        }
    }, [isElectron, isMobile, triggerMobileCheck]);

    // Electron: Download update
    const handleElectronDownload = async () => {
        if (!(window as any).electronAPI) return;
        setIsDownloading(true);
        setError('');
        await (window as any).electronAPI.downloadUpdate();
    };

    // Electron: Install update
    const handleElectronInstall = () => {
        if (!(window as any).electronAPI) return;
        (window as any).electronAPI.installUpdate();
    };

    // Mobile: Download & Install APK seamlessly in-app
    const handleMobileUpdate = async () => {
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

    // Dismiss notification (mobile only)
    const handleDismiss = () => {
        setDismissed(true);
    };

    // Don't render if no update or dismissed
    if (!updateAvailable && !updateDownloaded) {
        if (noUpdateToast) {
            return (
                <div className="fixed bottom-6 right-6 z-[9999] bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-fade-in text-sm backdrop-blur-md">
                    <span className="text-emerald-400 text-lg">✓</span>
                    <span>Bạn đang ở phiên bản mới nhất (<strong>v{currentVersion}</strong>)</span>
                </div>
            );
        }
        return null;
    }
    if (dismissed && !isElectron) return null;

    // RENDER UPDATE MODAL
    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4`}>
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
                        {updateDownloaded ? '🎉 Sẵn sàng cài đặt!' : 'Cập nhật ImageTool'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                        <span className="font-semibold text-slate-600">v{currentVersion || '2.25.39'}</span>
                        <span className="mx-2 text-indigo-400 font-bold">→</span>
                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">v{newVersion}</span>
                    </p>
                </div>

                {/* Progress / Status Area */}
                {isElectron ? (
                    // Electron: Full update UI
                    <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 rounded-2xl p-5 mb-5 border border-indigo-100">
                        {updateDownloaded ? (
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-800 font-bold text-sm">
                                    Bản cập nhật đã tải xong!
                                </p>
                                <p className="text-slate-500 text-xs mt-0.5">Nhấn để cài đặt và khởi động lại.</p>
                            </div>
                        ) : isDownloading ? (
                            <div className="text-center">
                                <p className="text-slate-700 font-semibold text-xs mb-2">Đang tải bản cập nhật...</p>
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
                                    Phiên bản mới bổ sung nhiều tính năng và tối ưu tốc độ.
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
                    // Mobile: In-app progress & notification
                    <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-2xl p-4 mb-4 border border-indigo-100/80">
                        {mobileDownloading ? (
                            <div className="text-center py-1">
                                <p className="text-slate-700 font-bold text-xs mb-2 flex items-center justify-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                                    Đang tải gói cài đặt APK...
                                </p>
                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 h-2.5 rounded-full transition-all duration-200"
                                        style={{ width: `${mobileProgress}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-1.5">
                                    <span>Tự động kích hoạt khi xong</span>
                                    <span className="text-indigo-600 font-bold">{mobileProgress}%</span>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-700 font-semibold text-xs leading-relaxed">
                                    ✨ Phiên bản mới đã sẵn sàng cài đặt. Cập nhật ngay để trải nghiệm các tính năng mượt mà nhất!
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
                                Cài đặt và khởi động lại
                            </button>
                        ) : isDownloading ? (
                            <button disabled className="w-full py-3 bg-slate-200 text-slate-500 font-bold rounded-xl cursor-not-allowed text-sm">
                                Đang tải xuống...
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
                        // Mobile: 1-touch in-app update
                        mobileDownloading ? (
                            <button disabled className="w-full py-3 bg-indigo-100 text-indigo-500 font-bold rounded-xl text-xs flex items-center justify-center gap-2">
                                <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                                Đang tải và chuẩn bị cài đặt...
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
