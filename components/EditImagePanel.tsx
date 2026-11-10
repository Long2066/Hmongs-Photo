
import React, { useState } from 'react';
import { MagicWandIcon, ShirtIcon } from './Icons';
import * as storage from '../services/storageService';
import { optimizePrompt } from '../services/aiService';
import { ModelSelector } from './ModelSelector';

interface EditImagePanelProps {
    onGenerate: (prompt: string, type: 'general' | 'mix' | 'relight' | 'extract', outputCount: number, extraData?: any) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputCount?: number;
}

const lightingStyles = [
    { id: 'hoang_hon', label: 'Hoàng hôn (Sunset)' },
    { id: 'studio', label: 'Studio chuyên nghiệp' },
    { id: 'neon', label: 'Neon Cyberpunk' },
    { id: 'rung_toi', label: 'Rừng tối (Mystery)' },
    { id: 'ban_dem', label: 'Ban đêm (City Bokeh)' }
];

export const EditImagePanel: React.FC<EditImagePanelProps> = ({ onGenerate, isLoading, isDisabled, hasInputImage, inputCount = 0 }) => {
    const [tab, setTab] = useState<'general' | 'mix' | 'relight' | 'extract'>('general');
    const [prompt, setPrompt] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [selectedLight, setSelectedLight] = useState(lightingStyles[0].id);

    // 1-to-1 mapping: output count exactly equals input count (or 1 for mix)
    const effectiveOutputCount = tab === 'mix' ? 1 : Math.max(1, inputCount);

    const handleOptimize = async () => {
        if (!prompt.trim()) return;
        const apiKey = localStorage.getItem('ninerouter_enabled') === 'true'
            ? 'NINEROUTER_MODE'
            : storage.getApiKey('gemini') || 'NINEROUTER_MODE';

        setIsOptimizing(true);
        try {
            const result = await optimizePrompt(apiKey, prompt);
            setPrompt(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200/80 flex gap-3 shadow-xs ring-1 ring-emerald-500/10">
                <div className="bg-white p-2 rounded-full shadow-sm">
                    <MagicWandIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-emerald-900">Studio Chỉnh Sửa AI</h3>
                    <p className="text-[10px] text-emerald-700/80 mt-0.5 font-medium">Ánh xạ 1:1 Hàng loạt (Tối đa 10 ảnh)</p>
                </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
                <button onClick={() => setTab('general')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'general' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Chỉnh sửa</button>
                <button onClick={() => setTab('mix')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'mix' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Outfit Mix</button>
                <button onClick={() => setTab('relight')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'relight' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Relighting</button>
                <button onClick={() => setTab('extract')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'extract' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Tách đồ</button>
            </div>

            {/* 1-to-1 Mapping Status Banner */}
            {tab !== 'mix' ? (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-800">
                            {inputCount > 0 ? (
                                <>Đã nạp <span className="text-emerald-700 font-extrabold">{inputCount}</span> ảnh ➔ Xuất tương ứng <span className="text-emerald-700 font-extrabold">{inputCount}</span> ảnh</>
                            ) : (
                                <>Chưa nạp ảnh đầu vào (Tối đa 10 ảnh)</>
                            )}
                        </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                        {inputCount}/10 Slot
                    </span>
                </div>
            ) : null}

            {/* Model Selector */}
            <div>
                <ModelSelector className="" imageCount={effectiveOutputCount} />
            </div>

            {tab === 'general' && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                        <span>Mô tả chỉnh sửa (Áp dụng cho tất cả Slot)</span>
                        <button onClick={handleOptimize} disabled={isOptimizing} className="text-emerald-500 hover:text-emerald-700 text-[10px] flex items-center gap-1 font-bold">
                            {isOptimizing ? '...' : 'Auto Optimize Prompt'} <MagicWandIcon className="w-3 h-3" />
                        </button>
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ví dụ: Thêm bộ lọc retro hoàng hôn, xóa người lạ ở nền, làm nét khuôn mặt..."
                        rows={4}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                    />
                    <div className="panel-action-wrapper mt-1">
                        {(() => {
                            const isGenDisabled = isLoading || isDisabled || !hasInputImage || !prompt.trim();
                            return (
                                <button
                                    onClick={() => onGenerate(prompt, 'general', effectiveOutputCount)}
                                    disabled={isGenDisabled}
                                    className={`w-full px-6 py-3.5 font-bold text-xs sm:text-sm rounded-xl transition-all duration-150 select-none shadow-sm ${
                                        isGenDisabled
                                            ? 'bg-slate-100 text-slate-400 border border-slate-200/90 cursor-not-allowed shadow-none'
                                            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-emerald-600/25 ring-1 ring-emerald-600/20 cursor-pointer'
                                    }`}
                                >
                                    {isLoading
                                        ? "Đang xử lý..."
                                        : inputCount === 0
                                            ? "Vui lòng tải lên ảnh (Tối đa 10 ảnh)"
                                            : `TẠO ${inputCount} ẢNH CHỈNH SỬA (SLOT 1–${inputCount})`}
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}

            {tab === 'mix' && (
                <div className="animate-fade-in">
                    <p className="text-xs text-slate-500 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        ⚠️ Chế độ này yêu cầu bạn tải lên <strong>2 ảnh</strong> vào Slot 1 và Slot 2 ở menu bên trái.
                        AI sẽ lấy trang phục từ 2 ảnh này để phối hợp lại thành 1 ảnh mới.
                    </p>
                    <div className="panel-action-wrapper mt-1">
                        {(() => {
                            const isMixDisabled = isLoading || isDisabled || inputCount < 2;
                            return (
                                <button
                                    onClick={() => onGenerate('', 'mix', 1)}
                                    disabled={isMixDisabled}
                                    className={`w-full px-6 py-3.5 font-bold text-xs sm:text-sm rounded-xl transition-all duration-150 select-none shadow-sm ${
                                        isMixDisabled
                                            ? 'bg-slate-100 text-slate-400 border border-slate-200/90 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 active:scale-[0.98] text-white shadow-orange-500/25 ring-1 ring-orange-500/20 cursor-pointer'
                                    }`}
                                >
                                    {isLoading ? "Đang phối đồ..." : inputCount < 2 ? "Cần nạp 2 ảnh (Slot 1 & 2)" : "MIX & MATCH OUTFIT"}
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}

            {tab === 'relight' && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chọn ánh sáng môi trường</label>
                    <div className="grid grid-cols-1 gap-2">
                        {lightingStyles.map(l => (
                            <button
                                key={l.id}
                                onClick={() => setSelectedLight(l.id)}
                                className={`p-3 rounded-lg text-left text-xs font-bold border transition-all ${selectedLight === l.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                    <div className="panel-action-wrapper mt-1">
                        {(() => {
                            const isRelightDisabled = isLoading || isDisabled || !hasInputImage;
                            return (
                                <button
                                    onClick={() => onGenerate('', 'relight', effectiveOutputCount, { lighting: selectedLight })}
                                    disabled={isRelightDisabled}
                                    className={`w-full px-6 py-3.5 font-bold text-xs sm:text-sm rounded-xl transition-all duration-150 select-none shadow-sm ${
                                        isRelightDisabled
                                            ? 'bg-slate-100 text-slate-400 border border-slate-200/90 cursor-not-allowed shadow-none'
                                            : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-blue-600/25 ring-1 ring-blue-600/20 cursor-pointer'
                                    }`}
                                >
                                    {isLoading
                                        ? "Đang đổi ánh sáng..."
                                        : inputCount === 0
                                            ? "Vui lòng tải lên ảnh (Tối đa 10 ảnh)"
                                            : `ĐỔI ÁNH SÁNG CHO ${inputCount} ẢNH (SLOT 1–${inputCount})`}
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}

            {tab === 'extract' && (
                <div className="animate-fade-in">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col gap-3 items-center text-center mb-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600">
                            <ShirtIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="font-bold text-indigo-900 text-sm">Tách Trang Phục Thông Minh</h4>
                            <p className="text-xs text-indigo-700 mt-1">
                                AI sẽ loại bỏ người mẫu và nền, chỉ giữ lại quần áo ở dạng
                                <strong> "Ghost Mannequin"</strong> (Ma nơ canh tàng hình) cho từng ảnh đầu vào.
                            </p>
                        </div>
                    </div>

                    <div className="panel-action-wrapper mt-1">
                        {(() => {
                            const isExtractDisabled = isLoading || isDisabled || !hasInputImage;
                            return (
                                <button
                                    onClick={() => onGenerate('', 'extract', effectiveOutputCount)}
                                    disabled={isExtractDisabled}
                                    className={`w-full px-6 py-3.5 font-bold text-xs sm:text-sm rounded-xl transition-all duration-150 select-none shadow-sm ${
                                        isExtractDisabled
                                            ? 'bg-slate-100 text-slate-400 border border-slate-200/90 cursor-not-allowed shadow-none'
                                            : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-indigo-600/25 ring-1 ring-indigo-600/20 cursor-pointer'
                                    }`}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Đang tách trang phục...
                                        </span>
                                    ) : inputCount === 0 ? "Vui lòng tải lên ảnh (Tối đa 10 ảnh)" : `TÁCH ĐỒ CHO ${inputCount} ẢNH (SLOT 1–${inputCount})`}
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};
