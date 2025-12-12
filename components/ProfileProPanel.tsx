
import React, { useState } from 'react';
import { UserCircleIcon } from './Icons';

interface ProfileProPanelProps {
  onGenerate: (style: string, platform: string, resolution: '2K' | '4K') => void;
  isLoading: boolean;
  isDisabled: boolean;
  hasInputImage: boolean;
}

const styles = [
    'Doanh nhân (Corporate)',
    'Sáng tạo (Creative)',
    'Tối giản (Minimalist)',
    'Sang trọng (Luxury)',
    'Thân thiện (Friendly)',
    'Ngoài trời (Outdoor)',
    'Tech/Startup Founder'
];

const platforms = [
    { id: 'LinkedIn', label: 'LinkedIn' },
    { id: 'Facebook', label: 'Facebook' },
    { id: 'Zalo', label: 'Zalo' },
    { id: 'Instagram', label: 'Instagram' },
    { id: 'Tinder', label: 'Tinder/Dating' },
    { id: 'CV', label: 'CV/Resume' }
];

export const ProfileProPanel: React.FC<ProfileProPanelProps> = ({ onGenerate, isLoading, isDisabled, hasInputImage }) => {
    const [style, setStyle] = useState(styles[0]);
    const [platform, setPlatform] = useState(platforms[0].id);
    const [resolution, setResolution] = useState<'2K' | '4K'>('2K');

    return (
        <div className="flex flex-col gap-5">
            <div className="bg-fuchsia-50/50 p-4 rounded-xl border border-fuchsia-100 flex gap-3 backdrop-blur-sm neon-border">
                 <div className="bg-white p-2 rounded-full shadow-sm">
                    <UserCircleIcon className="w-5 h-5 text-fuchsia-600" />
                 </div>
                 <div>
                     <h3 className="text-sm font-bold text-fuchsia-900 led-text">Ảnh Profile Pro</h3>
                     <p className="text-[10px] text-fuchsia-700/80 mt-0.5 font-medium">Avatar chuẩn tỷ lệ 1:1 cho MXH & CV</p>
                 </div>
            </div>

            {/* Platform */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nền tảng sử dụng</label>
                <div className="grid grid-cols-3 gap-2">
                    {platforms.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPlatform(p.id)}
                            className={`px-2 py-2.5 text-xs font-bold rounded-lg transition-all border ${platform === p.id ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Style */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phong cách</label>
                <div className="relative group">
                    <select 
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 outline-none appearance-none cursor-pointer transition-all"
                    >
                        {styles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Resolution */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Độ phân giải</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['2K', '4K'] as const).map((res) => (
                        <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${resolution === res ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {res}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={() => onGenerate(style, platform, resolution)}
                disabled={isLoading || isDisabled || !hasInputImage}
                className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 animate-gradient-x text-white font-bold rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/40 transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
            >
                 {isLoading ? (
                     <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Đang thiết kế...
                     </span>
                 ) : "TẠO PROFILE CHUYÊN NGHIỆP"}
            </button>
        </div>
    );
};
