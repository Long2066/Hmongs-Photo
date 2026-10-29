import React, { useState } from 'react';
import { SparklesIcon } from './Icons';
import { ModelSelector } from './ModelSelector';

interface UpscalePanelProps {
    onGenerate: (resolution: '2K' | '4K', outputCount: number) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
}

const outputCounts = [1, 2, 4, 6, 8];

export const UpscalePanel: React.FC<UpscalePanelProps> = ({ onGenerate, isLoading, isDisabled, hasInputImage }) => {
    const [resolution, setResolution] = useState<'2K' | '4K'>('4K');
    const [outputCount, setOutputCount] = useState(1);

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-cyan-50/50 p-4 rounded-xl border border-cyan-100 flex gap-3 backdrop-blur-sm neon-border">
                <div className="bg-white p-2 rounded-full shadow-sm">
                    <SparklesIcon className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-cyan-900 led-text">Tăng Chất Lượng Ảnh (AI Upscale)</h3>
                    <p className="text-[10px] text-cyan-700/80 mt-0.5 font-medium">Làm nét, khử nhiễu, nâng độ phân giải lên 2K/4K</p>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Độ phân giải mục tiêu</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['2K', '4K'] as const).map((res) => (
                        <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${resolution === res ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-cyan-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {res}
                        </button>
                    ))}
                </div>
            </div>

            {/* Output Count Selector */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Số lượng đầu ra</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {outputCounts.map((count) => (
                        <button
                            key={count}
                            onClick={() => setOutputCount(count)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${outputCount === count ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-cyan-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {count}
                        </button>
                    ))}
                </div>
            </div>

            {/* Model Selector - hide resolution as we have our own */}
            <div>
                <ModelSelector className="" imageCount={outputCount} showResolution={false} />
            </div>

            <div className="panel-action-wrapper">
                <button
                    onClick={() => onGenerate(resolution, outputCount)}
                    disabled={isLoading || isDisabled || !hasInputImage}
                    className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 animate-gradient-x text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/40 transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Đang làm nét ảnh...
                        </span>
                    ) : `NÂNG CẤP ${outputCount} ẢNH NGAY`}
                </button>
            </div>
        </div>
    );
};