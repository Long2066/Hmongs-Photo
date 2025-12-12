
import React, { useState, useEffect } from 'react';
import * as storage from '../services/storageService';
import { ApiKeyInfo } from '../services/storageService';
import { validateGeminiKey } from '../services/aiService';
import { ExternalLinkIcon, ChevronRightIcon, KeyIcon, ArrowLeftIcon, TrashIcon } from './Icons';

interface ApiKeyModalProps {
    onClose: () => void;
}

type ModalView = 'input' | 'guide';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
    const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
    const [view, setView] = useState<ModalView>('input');
    const [validatingIndex, setValidatingIndex] = useState<number | null>(null);

    useEffect(() => {
        const storedKeys = storage.getApiKeys('gemini');
        if (storedKeys.length > 0) {
            setKeys(storedKeys);
        } else {
            // Check legacy single key
            const legacyKey = localStorage.getItem('api_key_gemini');
            if (legacyKey) {
                setKeys([{ key: legacyKey, status: 'unchecked' }]);
            } else {
                setKeys([{ key: '', status: 'unchecked' }]);
            }
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

    const getStatusText = (status: ApiKeyInfo['status']) => {
        switch (status) {
            case 'valid': return '✓ Hợp lệ';
            case 'invalid': return '✗ Không hợp lệ';
            case 'quota_exceeded': return '⚠ Hết quota';
            default: return '○ Chưa kiểm tra';
        }
    };

    // Function to open link in incognito (Electron) or new tab (web)
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
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/40"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                            <KeyIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                {view === 'input' ? 'Cấu hình API Key' : 'Hướng dẫn lấy Key'}
                            </h2>
                            <p className="text-xs text-slate-500">Tối đa 5 keys, tự động xoay vòng</p>
                        </div>
                    </div>
                    {view === 'guide' && (
                        <button onClick={() => setView('input')} className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                            <ArrowLeftIcon className="w-4 h-4" /> Quay lại
                        </button>
                    )}
                </div>

                <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {view === 'input' ? (
                        <div className="animate-fade-in space-y-4">
                            {/* API Keys List */}
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
                                            placeholder="Nhập API Key..."
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs"
                                        />
                                        <button
                                            onClick={() => handleValidateKey(index)}
                                            disabled={validatingIndex === index || !keyInfo.key.trim()}
                                            className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50 text-xs font-bold"
                                        >
                                            {validatingIndex === index ? '...' : 'Test'}
                                        </button>
                                        {keys.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveKey(index)}
                                                className="px-2 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add Key Button */}
                            {keys.length < 5 && (
                                <button
                                    onClick={handleAddKey}
                                    className="w-full p-2.5 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-medium"
                                >
                                    + Thêm Key ({keys.length}/5)
                                </button>
                            )}

                            {/* Guide Button */}
                            <button
                                onClick={() => setView('guide')}
                                className="w-full mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl flex items-center justify-between group hover:shadow-md transition-all cursor-pointer text-left"
                            >
                                <div>
                                    <h4 className="font-bold text-amber-800 text-sm">Chưa có Key?</h4>
                                    <p className="text-xs text-amber-600 mt-0.5">Xem hướng dẫn lấy miễn phí</p>
                                </div>
                                <div className="bg-white p-2 rounded-full text-amber-500 shadow-sm group-hover:scale-110 transition-transform">
                                    <ChevronRightIcon className="w-4 h-4" />
                                </div>
                            </button>

                            {/* Save Button */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Đóng
                                </button>
                                <button
                                    onClick={handleSaveAll}
                                    className="px-5 py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                                >
                                    Lưu tất cả
                                </button>
                            </div>
                        </div>
                    ) : (
                        // --- GUIDE VIEW ---
                        <div className="animate-fade-in space-y-3">
                            {isElectron ? (
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-xs text-green-800 mb-4">
                                    ✅ <strong>Tự động mở ẩn danh:</strong> Các bước 2, 3, 5 sẽ tự động mở trong trình duyệt ẩn danh.
                                </div>
                            ) : (
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800 mb-4">
                                    💡 <strong>Mẹo quan trọng:</strong> Chuột phải vào các nút bên dưới và chọn <strong>"Mở trong tab ẩn danh"</strong> để tránh lưu cache cũ.
                                </div>
                            )}

                            {/* Step 1 */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">BƯỚC 1</span>
                                    <span className="text-xs font-semibold text-slate-600">Mở Gmail (Ẩn danh)</span>
                                </div>
                                <LinkButton
                                    step={1}
                                    href="https://mail.google.com/mail/u/0/?pli=1#inbox"
                                    label="Mở Hộp thư Gmail"
                                    colorClass="bg-red-50 text-red-700 hover:bg-red-100"
                                    icon={<img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/gmail.svg" className="w-4 h-4 opacity-70" alt="Gmail" />}
                                />
                            </div>

                            {/* Step 2 */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">BƯỚC 2</span>
                                    <span className="text-xs font-semibold text-slate-600">Đăng nhập Firefox Relay</span>
                                </div>
                                <LinkButton
                                    step={2}
                                    href="https://relay.firefox.com/accounts/profile/"
                                    label="Truy cập Firefox Relay"
                                    colorClass="bg-orange-50 text-orange-700 hover:bg-orange-100"
                                    icon={<img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/firefoxbrowser.svg" className="w-4 h-4 opacity-70" alt="Firefox" />}
                                />
                            </div>

                            {/* Step 3 */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">BƯỚC 3</span>
                                    <span className="text-xs font-semibold text-slate-600">Đăng ký Google Skills</span>
                                </div>
                                <LinkButton
                                    step={3}
                                    href="https://www.skills.google/users/sign_up"
                                    label="Trang đăng ký Skills"
                                    colorClass="bg-blue-50 text-blue-700 hover:bg-blue-100"
                                    icon={<img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/google.svg" className="w-4 h-4 opacity-70" alt="Google" />}
                                />
                            </div>

                            {/* Step 4 (Text) */}
                            <div className="bg-yellow-50 border border-yellow-200 p-2.5 rounded-xl text-center">
                                <span className="block text-[10px] font-bold text-yellow-600 uppercase mb-1">BƯỚC 4: LƯU Ý</span>
                                <p className="text-xs font-medium text-yellow-800">
                                    Copy link xác nhận từ Gmail và dán vào Tab ẩn danh của Bước 3.
                                </p>
                            </div>

                            {/* Step 5 */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">BƯỚC 5</span>
                                    <span className="text-xs font-semibold text-slate-600">Kích hoạt</span>
                                </div>
                                <LinkButton
                                    step={5}
                                    href="https://www.skills.google/focuses/86504?catalog_rank=%7B%22rank%22%3A5%2C%22num_filters%22%3A0%2C%22has_search%22%3Atrue%7D&parent=catalog&search_id=54131613"
                                    label="Kích hoạt tại đây"
                                    colorClass="bg-green-50 text-green-700 hover:bg-green-100"
                                    icon={<img src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/8.8.0/googlescholar.svg" className="w-4 h-4 opacity-70" alt="Skills" />}
                                />
                            </div>

                            <div className="text-center pt-2">
                                <p className="text-xs text-slate-400 italic">
                                    * Các bước còn lại làm theo video hướng dẫn.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
