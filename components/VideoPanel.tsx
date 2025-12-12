import React, { useState } from 'react';
import { VideoCameraIcon } from './Icons';

interface VideoPanelProps {
  onGenerate: (prompt: string, aspectRatio: '16:9' | '9:16') => void;
  isLoading: boolean;
  isDisabled: boolean;
  hasInputImage: boolean;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({ onGenerate, isLoading, isDisabled, hasInputImage }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex gap-3">
                 <div className="bg-white p-2 rounded-full shadow-sm">
                    <VideoCameraIcon className="w-5 h-5 text-rose-600" />
                 </div>
                 <div>
                     <h3 className="text-sm font-bold text-rose-900">Tạo Video (Veo AI)</h3>
                     <p className="text-[10px] text-rose-700/80 mt-0.5 font-medium">Biến ảnh tĩnh thành video sống động</p>
                 </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Mô tả chuyển động
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Mô tả video bạn muốn tạo (Ví dụ: Camera zoom chậm vào nhân vật, gió thổi tóc bay...)"
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all placeholder:text-slate-400"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tỷ lệ khung hình</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setAspectRatio('16:9')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${aspectRatio === '16:9' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Ngang (16:9)
                    </button>
                    <button
                        onClick={() => setAspectRatio('9:16')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${aspectRatio === '9:16' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Dọc (9:16)
                    </button>
                </div>
            </div>

            <button
                onClick={() => onGenerate(prompt, aspectRatio)}
                disabled={isLoading || isDisabled || !hasInputImage || !prompt.trim()}
                className="w-full mt-2 px-6 py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
            >
                 {isLoading ? (
                     <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Đang tạo video...
                     </span>
                 ) : "BẮT ĐẦU TẠO VIDEO"}
            </button>
        </div>
    );
};