
import React, { useState } from 'react';
import { MagicWandIcon, ShirtIcon } from './Icons';
import * as storage from '../services/storageService';
import { optimizePrompt } from '../services/aiService';

interface EditImagePanelProps {
  onGenerate: (prompt: string, type: 'general' | 'mix' | 'relight' | 'extract', extraData?: any) => void;
  isLoading: boolean;
  isDisabled: boolean;
  hasInputImage: boolean;
}

const lightingStyles = [
    { id: 'hoang_hon', label: 'Hoàng hôn (Sunset)' },
    { id: 'studio', label: 'Studio chuyên nghiệp' },
    { id: 'neon', label: 'Neon Cyberpunk' },
    { id: 'rung_toi', label: 'Rừng tối (Mystery)' },
    { id: 'ban_dem', label: 'Ban đêm (City Bokeh)' }
];

export const EditImagePanel: React.FC<EditImagePanelProps> = ({ onGenerate, isLoading, isDisabled, hasInputImage }) => {
    const [tab, setTab] = useState<'general' | 'mix' | 'relight' | 'extract'>('general');
    const [prompt, setPrompt] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [selectedLight, setSelectedLight] = useState(lightingStyles[0].id);

    const handleOptimize = async () => {
        if (!prompt.trim()) return;
        const apiKey = storage.getApiKey('gemini');
        if (!apiKey) return;
        
        setIsOptimizing(true);
        try {
            const result = await optimizePrompt(apiKey, prompt);
            setPrompt(result);
        } catch(e) {
            console.error(e);
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex gap-3 backdrop-blur-sm">
                 <div className="bg-white p-2 rounded-full shadow-sm">
                    <MagicWandIcon className="w-5 h-5 text-emerald-600" />
                 </div>
                 <div>
                     <h3 className="text-sm font-bold text-emerald-900">Studio Chỉnh Sửa AI</h3>
                     <p className="text-[10px] text-emerald-700/80 mt-0.5 font-medium">Nano Banana Engine</p>
                 </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
                <button onClick={() => setTab('general')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'general' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Chỉnh sửa</button>
                <button onClick={() => setTab('mix')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'mix' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Outfit Mix</button>
                <button onClick={() => setTab('relight')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'relight' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Relighting</button>
                <button onClick={() => setTab('extract')} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all ${tab === 'extract' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Tách đồ</button>
            </div>

            {tab === 'general' && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                        <span>Mô tả chỉnh sửa</span>
                        <button onClick={handleOptimize} disabled={isOptimizing} className="text-emerald-500 hover:text-emerald-700 text-[10px] flex items-center gap-1 font-bold">
                            {isOptimizing ? '...' : 'Auto Optimize Prompt'} <MagicWandIcon className="w-3 h-3"/>
                        </button>
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ví dụ: Thêm bộ lọc retro, Xóa người ở nền, Làm cho trời tối..."
                        rows={4}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                    />
                    <button
                        onClick={() => onGenerate(prompt, 'general')}
                        disabled={isLoading || isDisabled || !hasInputImage || !prompt.trim()}
                        className="w-full mt-4 px-6 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                    >
                        {isLoading ? "Đang xử lý..." : "THỰC HIỆN CHỈNH SỬA"}
                    </button>
                </div>
            )}

            {tab === 'mix' && (
                <div className="animate-fade-in">
                    <p className="text-xs text-slate-500 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        ⚠️ Chế độ này yêu cầu bạn tải lên <strong>2 ảnh</strong> vào ô "Ảnh đầu vào" ở menu bên trái. 
                        AI sẽ lấy trang phục từ ảnh 1 và ảnh 2 để phối hợp lại.
                    </p>
                    <button
                        onClick={() => onGenerate('', 'mix')}
                        disabled={isLoading || isDisabled}
                        className="w-full mt-2 px-6 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                    >
                        {isLoading ? "Đang phối đồ..." : "MIX & MATCH OUTFIT"}
                    </button>
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
                     <button
                        onClick={() => onGenerate('', 'relight', { lighting: selectedLight })}
                        disabled={isLoading || isDisabled || !hasInputImage}
                        className="w-full mt-4 px-6 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                    >
                        {isLoading ? "Đang đổi ánh sáng..." : "THAY ĐỔI ÁNH SÁNG"}
                    </button>
                </div>
            )}

            {tab === 'extract' && (
                <div className="animate-fade-in">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col gap-3 items-center text-center mb-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600">
                             <ShirtIcon className="w-8 h-8"/>
                        </div>
                        <div>
                            <h4 className="font-bold text-indigo-900 text-sm">Tách Trang Phục Thông Minh</h4>
                            <p className="text-xs text-indigo-700 mt-1">
                                AI sẽ loại bỏ người mẫu và nền, chỉ giữ lại quần áo ở dạng 
                                <strong> "Ghost Mannequin"</strong> (Ma nơ canh tàng hình).
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => onGenerate('', 'extract')}
                        disabled={isLoading || isDisabled || !hasInputImage}
                        className="w-full mt-2 px-6 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Đang tách trang phục...
                            </span>
                        ) : "TÁCH TRANG PHỤC NGAY"}
                    </button>
                </div>
            )}
        </div>
    );
};
