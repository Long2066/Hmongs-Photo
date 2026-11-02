import React, { useState, useEffect } from 'react';
import { DownloadIcon } from './Icons';

interface DownloadHelpModalProps {
    onClose: () => void;
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;

export const DownloadHelpModal: React.FC<DownloadHelpModalProps> = ({ onClose }) => {
    const [downloadPath, setDownloadPath] = useState<string>('');
    const [isSelecting, setIsSelecting] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (isElectron) {
            (window as any).electronAPI.getDownloadPath().then((path: string) => {
                setDownloadPath(path || '');
            }).catch((err: any) => {
                console.error('Failed to get download path:', err);
            });
        }
    }, []);

    const handleSelectFolder = async () => {
        if (!isElectron) return;

        setIsSelecting(true);
        setStatusMsg(null);
        try {
            const result = await (window as any).electronAPI.selectDownloadFolder();
            if (result && result.success && result.path) {
                setDownloadPath(result.path);
                setStatusMsg({ text: 'Đã lưu thư mục tải về thành công! Mọi ảnh tạo mới sẽ tự động lưu vào đây.', type: 'success' });
            }
        } catch (error) {
            console.error('Failed to select folder:', error);
            setStatusMsg({ text: 'Không thể chọn thư mục. Vui lòng thử lại.', type: 'error' });
        } finally {
            setIsSelecting(false);
        }
    };

    const handleOpenFolder = async () => {
        if (!isElectron) return;
        try {
            await (window as any).electronAPI.openDownloadFolder();
        } catch (error) {
            console.error('Failed to open folder:', error);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden ring-1 ring-slate-900/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md text-white shadow-xs">
                            <DownloadIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Cấu hình thư mục tải về</h2>
                            <p className="text-indigo-100 text-xs">
                                {isElectron ? 'Chọn thư mục lưu ảnh tự động trên máy' : 'Hướng dẫn thay đổi vị trí lưu trên trình duyệt'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                        title="Đóng"
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
                            <div className="bg-emerald-50/80 border border-emerald-200/70 p-3.5 rounded-2xl flex gap-3 items-start">
                                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-emerald-900 leading-relaxed font-medium">
                                    Ứng dụng Desktop đã sẵn sàng lưu trực tiếp ảnh vào bất kỳ ổ đĩa hoặc thư mục nào (kể cả Google Drive, OneDrive).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                    Thư mục hiện tại
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={downloadPath}
                                        readOnly
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs font-mono select-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={handleSelectFolder}
                                        disabled={isSelecting}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 text-sm cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                        <span>{isSelecting ? 'Đang chọn...' : 'Chọn thư mục khác'}</span>
                                    </button>

                                    <button
                                        onClick={handleOpenFolder}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 font-bold rounded-xl shadow-xs transition-all text-sm cursor-pointer"
                                        title="Mở thư mục này trong File Explorer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        <span>Mở thư mục</span>
                                    </button>
                                </div>
                            </div>

                            {statusMsg && (
                                <div className={`p-3 rounded-xl text-xs font-semibold animate-fade-in ${
                                    statusMsg.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}>
                                    {statusMsg.text}
                                </div>
                            )}

                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    💡 <strong>Mẹo:</strong> Khi gạt bật công tắc <strong>"Tự động tải về"</strong>, tất cả ảnh được AI sinh ra sẽ được tự động lưu ngay lập tức vào thư mục trên mà không cần nhấn tải thủ công.
                                </p>
                            </div>
                        </div>
                    ) : (
                        // WEB MODE - Show instructions
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200/70 p-3 rounded-xl flex gap-3 items-start">
                                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-amber-800 leading-relaxed">
                                    Do chính sách bảo mật trình duyệt, website không thể tự ý đổi thư mục lưu file. Bạn cần cấu hình trong phần Cài đặt của trình duyệt.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-bold text-slate-800 text-sm">Cách thay đổi thư mục tải về:</h3>

                                <div className="group">
                                    <h4 className="flex items-center gap-2 font-semibold text-indigo-700 text-sm mb-1">
                                        <img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/googlechrome.svg" className="w-4 h-4" alt="Chrome" />
                                        Google Chrome / Cốc Cốc
                                    </h4>
                                    <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1 ml-1 font-medium">
                                        <li>Mở <strong>Cài đặt (Settings)</strong> qua biểu tượng 3 chấm ở góc trên</li>
                                        <li>Chọn mục <strong>Tệp đã tải xuống (Downloads)</strong></li>
                                        <li>Nhấn <strong>Thay đổi (Change)</strong> tại dòng <em>Vị trí lưu</em></li>
                                    </ol>
                                </div>

                                <div className="group border-t border-slate-100 pt-3">
                                    <h4 className="flex items-center gap-2 font-semibold text-blue-700 text-sm mb-1">
                                        <img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/microsoftedge.svg" className="w-4 h-4" alt="Edge" />
                                        Microsoft Edge
                                    </h4>
                                    <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1 ml-1 font-medium">
                                        <li>Mở <strong>Cài đặt</strong> → <strong>Tải xuống</strong></li>
                                        <li>Thay đổi đường dẫn tại mục <strong>Vị trí</strong></li>
                                    </ol>
                                </div>
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl">
                                <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                                    💡 <strong>Mẹo:</strong> Sử dụng bản Desktop (App EXE) để thoải mái chọn bất kỳ thư mục nào trên ổ cứng máy tính!
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-bold rounded-xl transition-all text-sm cursor-pointer"
                    >
                        Đã hiểu, đóng lại
                    </button>
                </div>
            </div>
        </div>
    );
};
