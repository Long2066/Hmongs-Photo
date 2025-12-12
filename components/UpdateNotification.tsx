import React, { useState, useEffect } from 'react';

interface UpdateInfo {
    version: string;
}

interface UpdateProgress {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

export const UpdateNotification: React.FC = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateDownloaded, setUpdateDownloaded] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [newVersion, setNewVersion] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [currentVersion, setCurrentVersion] = useState<string>('');

    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        // Get current version
        window.electronAPI.getAppVersion().then(setCurrentVersion);

        // Listen for update events
        window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
            setUpdateAvailable(true);
            setNewVersion(info.version);
        });

        window.electronAPI.onUpdateProgress((progress: UpdateProgress) => {
            setDownloadProgress(Math.round(progress.percent));
        });

        window.electronAPI.onUpdateDownloaded(() => {
            setUpdateDownloaded(true);
            setIsDownloading(false);
        });

        window.electronAPI.onUpdateError((err: string) => {
            setError(err);
            setIsDownloading(false);
        });
    }, []);

    const handleDownload = async () => {
        if (!window.electronAPI) return;
        setIsDownloading(true);
        setError('');
        await window.electronAPI.downloadUpdate();
    };

    const handleInstall = () => {
        if (!window.electronAPI) return;
        window.electronAPI.installUpdate();
    };

    // Don't render anything if not in Electron or no update available
    if (!isElectron || (!updateAvailable && !updateDownloaded)) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-sm">
                {updateDownloaded ? (
                    // Update downloaded, ready to install
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Sẵn sàng cài đặt!</h4>
                                <p className="text-xs text-slate-500">Phiên bản {newVersion}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleInstall}
                            className="w-full py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors text-sm"
                        >
                            Cài đặt và khởi động lại
                        </button>
                    </div>
                ) : isDownloading ? (
                    // Downloading
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Đang tải xuống...</h4>
                                <p className="text-xs text-slate-500">{downloadProgress}%</p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${downloadProgress}%` }}
                            ></div>
                        </div>
                    </div>
                ) : (
                    // Update available
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Có bản cập nhật mới!</h4>
                                <p className="text-xs text-slate-500">
                                    {currentVersion} → {newVersion}
                                </p>
                            </div>
                        </div>
                        {error && (
                            <p className="text-xs text-red-500">{error}</p>
                        )}
                        <button
                            onClick={handleDownload}
                            className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                        >
                            Tải xuống ngay
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
