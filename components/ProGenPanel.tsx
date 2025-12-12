import React, { useState } from 'react';
import { MagicWandIcon } from './Icons';

interface ProGenPanelProps {
  onGenerate: (prompt: string, size: '1K' | '2K' | '4K') => void;
  isLoading: boolean;
  isDisabled: boolean;
}

export const ProGenPanel: React.FC<ProGenPanelProps> = ({ onGenerate, isLoading, isDisabled }) => {
    const [prompt, setPrompt] = useState('');
    const [size, setSize] = useState<'1K' | '2K' | '4K'>('2K');

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex gap-3">
                 <div className="bg-white p-2 rounded-full shadow-sm">
                    <MagicWandIcon className="w-5 h-5 text-amber-600" />
                 </div>
                 <div>
                     <h3 className="text-sm font-bold text-amber-900">Nano Banana Pro Gen</h3>
                     <p className="text-[10px] text-amber-700/80 mt-0.5 font-medium">Tạo ảnh chất lượng cực cao (Lên tới 4K)</p>
                 </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Mô tả ảnh (Prompt)
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Mô tả chi tiết bức ảnh bạn muốn tạo..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kích thước ảnh</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['1K', '2K', '4K'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setSize(s)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${size === s ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={() => onGenerate(prompt, size)}
                disabled={isLoading || isDisabled || !prompt.trim()}
                className="w-full mt-2 px-6 py-4 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
            >
                 {isLoading ? (
                     <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Đang tạo ảnh Pro...
                     </span>
                 ) : "TẠO ẢNH CHẤT LƯỢNG CAO"}
            </button>
        </div>
    );
};