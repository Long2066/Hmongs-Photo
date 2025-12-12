import React, { useState, useEffect } from 'react';
import { DownloadIcon } from './Icons';

interface DownloadHelpModalProps {
    onClose: () => void;
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

export const DownloadHelpModal: React.FC<DownloadHelpModalProps> = ({ onClose }) => {
    const [downloadPath, setDownloadPath] = useState<string>('');
    const [isSelecting, setIsSelecting] = useState(false);

    useEffect(() => {
        if (isElectron) {
            (window as any).electronAPI.getDownloadPath().then((path: string) => {
                setDownloadPath(path);
            });
        }
    }, []);

    const handleSelectFolder = async () => {
        if (!isElectron) return;

        setIsSelecting(true);
        try {
            const result = await (window as any).electronAPI.selectDownloadFolder();
            if (result.success) {
                setDownloadPath(result.path);
            }
        } catch (error) {
            console.error('Failed to select folder:', error);
        }
        setIsSelecting(false);
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/40"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <DownloadIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Cấu hình thư mục tải về</h2>
                            <p className="text-indigo-100 text-xs">
                                {isElectron ? 'Chọn thư mục lưu ảnh' : 'Hướng dẫn thay đổi vị trí lưu'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-full transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {isElectron ? (
                        // ELECTRON MODE - Native folder picker
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-100 p-3 rounded-xl flex gap-3 items-start">
                                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-green-800">
                                    Bạn có thể chọn thư mục lưu ảnh tùy ý khi sử dụng app desktop.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">Thư mục hiện tại</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={downloadPath}
                                        readOnly
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm font-mono"
                                    />
                                    <button
                                        onClick={handleSelectFolder}
                                        disabled={isSelecting}
                                        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
                                    >
                                        {isSelecting ? '...' : 'Chọn thư mục'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl">
                                <p className="text-xs text-slate-500">
                                    💡 <strong>Mẹo:</strong> Ảnh sẽ được lưu trực tiếp vào thư mục bạn chọn khi bật "Tự động tải về".
                                </p>
                            </div>
                        </div>
                    ) : (
                        // WEB MODE - Show instructions
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3 items-start">
                                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-amber-800 leading-relaxed">
                                    Do chính sách bảo mật, trình duyệt web <strong>không cho phép</strong> website tự ý thay đổi thư mục lưu. Bạn cần thực hiện trong phần Cài đặt của trình duyệt.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-bold text-slate-800 text-sm">Cách thay đổi thủ công:</h3>

                                <div className="group">
                                    <h4 className="flex items-center gap-2 font-semibold text-indigo-700 text-sm mb-1">
                                        <img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/googlechrome.svg" className="w-4 h-4" alt="Chrome" />
                                        Google Chrome / Cốc Cốc
                                    </h4>
                                    <ol className="list-decimal list-inside text-xs text-slate-600 space-y-0.5 ml-1">
                                        <li>Vào <strong>Cài đặt (Settings)</strong> (dấu 3 chấm góc phải)</li>
                                        <li>Chọn mục <strong>Tệp đã tải xuống (Downloads)</strong></li>
                                        <li>Nhấn <strong>Thay đổi (Change)</strong> tại mục Vị trí</li>
                                    </ol>
                                </div>

                                <div className="group border-t border-slate-100 pt-3">
                                    <h4 className="flex items-center gap-2 font-semibold text-blue-700 text-sm mb-1">
                                        <img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/microsoftedge.svg" className="w-4 h-4" alt="Edge" />
                                        Microsoft Edge
                                    </h4>
                                    <ol className="list-decimal list-inside text-xs text-slate-600 space-y-0.5 ml-1">
                                        <li>Vào <strong>Cài đặt</strong> → <strong>Tải xuống</strong></li>
                                        <li>Thay đổi đường dẫn tại mục <strong>Vị trí</strong></li>
                                    </ol>
                                </div>
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                                <p className="text-xs text-indigo-800">
                                    💡 <strong>Mẹo:</strong> Sử dụng app Desktop (EXE) để có thể chọn thư mục tải về tùy ý!
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                    >
                        Đã hiểu, đóng lại
                    </button>
                </div>
            </div>
        </div>
    );
};