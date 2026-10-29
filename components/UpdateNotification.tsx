import React, { useState, useEffect } from 'react';
import { checkForUpdate, openDownloadPage, isMobilePlatform, isElectronPlatform, UpdateInfo } from '../services/appUpdateService';

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

    // Electron-specific state
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string>('');

    const isElectron = isElectronPlatform();
    const isMobile = isMobilePlatform();

    // Check for updates on mount
    useEffect(() => {
        // For Electron - use built-in auto-updater
        if (isElectron && (window as any).electronAPI) {
            const api = (window as any).electronAPI;
            api.getAppVersion().then(setCurrentVersion);

            api.onUpdateAvailable((info: ElectronUpdateInfo) => {
                setUpdateAvailable(true);
                setNewVersion(info.version);
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
            checkForUpdate().then((info: UpdateInfo) => {
                setCurrentVersion(info.currentVersion);
                if (info.hasUpdate) {
                    setUpdateAvailable(true);
                    setNewVersion(info.latestVersion);
                    setDownloadUrl(info.downloadUrl);
                    setReleaseNotes(info.releaseNotes);
                }
            });
        }
    }, [isElectron, isMobile]);

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

    // Mobile: Open download page
    const handleMobileDownload = () => {
        openDownloadPage(downloadUrl || undefined);
        setDismissed(true);
    };

    // Dismiss notification (mobile only)
    const handleDismiss = () => {
        setDismissed(true);
    };

    // Don't render if no update or dismissed
    if (!updateAvailable && !updateDownloaded) return null;
    if (dismissed && !isElectron) return null;

    // RENDER UPDATE MODAL
    return (
        <div className={`fixed ${isElectron ? 'inset-0 z-[9999]' : 'bottom-20 lg:bottom-4 right-4 z-[100]'} flex items-center justify-center ${isElectron ? 'bg-black/80 backdrop-blur-md' : ''}`}>
            <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 ${isElectron ? 'p-8 max-w-lg w-full mx-4' : 'p-5 max-w-sm w-full mx-4'} animate-fade-in`}>

                {/* Header */}
                <div className={`text-center ${isElectron ? 'mb-6' : 'mb-4'}`}>
                    <div className={`${isElectron ? 'w-20 h-20' : 'w-14 h-14'} mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3`}>
                        <svg className={`${isElectron ? 'w-10 h-10' : 'w-7 h-7'} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                    <h2 className={`${isElectron ? 'text-2xl' : 'text-lg'} font-extrabold text-slate-800`}>
                        {updateDownloaded ? '🎉 Sẵn sàng cài đặt!' : '⚡ Phiên bản mới!'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        <span className="font-medium text-slate-600">v{currentVersion}</span>
                        <span className="mx-2">→</span>
                        <span className="font-bold text-indigo-600">v{newVersion}</span>
                    </p>
                </div>

                {/* Content Area */}
                {isElectron ? (
                    // Electron: Full update UI
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 mb-6 border border-indigo-100">
                        {updateDownloaded ? (
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-700 font-medium">
                                    Bản cập nhật đã tải xuống!<br />
                                    <span className="text-slate-500 text-sm">Nhấn nút để cài đặt.</span>
                                </p>
                            </div>
                        ) : isDownloading ? (
                            <div className="text-center">
                                <p className="text-slate-700 font-medium mb-3">Đang tải xuống...</p>
                                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-indigo-600 font-bold text-lg mt-2">{downloadProgress}%</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-slate-700 font-medium">
                                    Có phiên bản mới với nhiều cải tiến!
                                </p>
                            </div>
                        )}
                        {error && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-red-600 text-sm font-medium">❌ {error}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // Mobile: Simple message
                    <div className="bg-indigo-50 rounded-xl p-3 mb-4 text-center">
                        <p className="text-slate-600 text-sm">
                            Có bản cập nhật mới! Tải về để trải nghiệm tốt hơn.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className={isElectron ? '' : 'flex gap-2'}>
                    {isElectron ? (
                        // Electron buttons
                        updateDownloaded ? (
                            <button
                                onClick={handleElectronInstall}
                                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all text-lg"
                            >
                                Cài đặt và khởi động lại
                            </button>
                        ) : isDownloading ? (
                            <button disabled className="w-full py-4 bg-slate-300 text-slate-500 font-bold rounded-xl cursor-not-allowed">
                                Đang tải xuống...
                            </button>
                        ) : (
                            <button
                                onClick={handleElectronDownload}
                                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all text-lg"
                            >
                                Tải xuống ngay
                            </button>
                        )
                    ) : (
                        // Mobile buttons
                        <>
                            <button
                                onClick={handleDismiss}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                            >
                                Để sau
                            </button>
                            <button
                                onClick={handleMobileDownload}
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                            >
                                Tải về
                            </button>
                        </>
                    )}
                </div>

                {/* Mandatory notice for Electron only */}
                {isElectron && (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-slate-400">
                            ⚠️ Việc cập nhật là <span className="font-bold text-red-500">BẮT BUỘC</span> để đảm bảo tính năng và bảo mật.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

