import React, { useState } from 'react';
import { MicrophoneIcon } from './Icons';

interface TtsPanelProps {
  onGenerate: (text: string, voice: string) => void;
  isLoading: boolean;
  isDisabled: boolean;
}

const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export const TtsPanel: React.FC<TtsPanelProps> = ({ onGenerate, isLoading, isDisabled }) => {
    const [text, setText] = useState('');
    const [voice, setVoice] = useState(voices[0]);

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex gap-3">
                 <div className="bg-white p-2 rounded-full shadow-sm">
                    <MicrophoneIcon className="w-5 h-5 text-purple-600" />
                 </div>
                 <div>
                     <h3 className="text-sm font-bold text-purple-900">Text-to-Speech (TTS)</h3>
                     <p className="text-[10px] text-purple-700/80 mt-0.5 font-medium">Chuyển đổi văn bản thành giọng nói tự nhiên</p>
                 </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Văn bản đầu vào
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập nội dung cần đọc..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-slate-400"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Giọng đọc</label>
                <div className="grid grid-cols-3 gap-2">
                    {voices.map((v) => (
                        <button
                            key={v}
                            onClick={() => setVoice(v)}
                            className={`py-2 text-xs font-bold rounded-lg transition-all border ${voice === v ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'}`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={() => onGenerate(text, voice)}
                disabled={isLoading || isDisabled || !text.trim()}
                className="w-full mt-2 px-6 py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
            >
                 {isLoading ? (
                     <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Đang tạo giọng nói...
                     </span>
                 ) : "TẠO AUDIO"}
            </button>
        </div>
    );
};