
import React, { useState, useEffect } from 'react';
import { AcademicCapIcon } from './Icons';
import { ModelSelector } from './ModelSelector';

interface DreamJobPanelProps {
    onGenerate: (prompts: string[], studentNames: string[]) => void;
    isLoading: boolean;
    isDisabled: boolean;
    inputImages: { base64: string, mimeType: string, fileName?: string }[];
}

const commonJobs = [
    'Bác sĩ (Doctor)',
    'Công an (Police Officer)',
    'Giáo viên (Teacher)',
    'Phi công (Pilot)',
    'Tiếp viên hàng không',
    'Doanh nhân (CEO)',
    'Kỹ sư (Engineer)',
    'Họa sĩ (Artist)',
    'Đầu bếp (Chef)',
    'Ca sĩ (Singer)',
    'Phi hành gia (Astronaut)',
    'Lính cứu hỏa (Firefighter)'
];

export const DreamJobPanel: React.FC<DreamJobPanelProps> = ({ onGenerate, isLoading, isDisabled, inputImages }) => {
    // Stores prompt for each image
    const [prompts, setPrompts] = useState<string[]>([]);
    // Stores student name for each image
    const [names, setNames] = useState<string[]>([]);

    // Logic to parse filenames: "Name - Job"
    useEffect(() => {
        const newPrompts: string[] = [];
        const newNames: string[] = [];

        inputImages.forEach((img, index) => {
            let extractedName = `Học sinh ${index + 1}`;
            let extractedJob = '';

            if (img.fileName) {
                // Split by hyphen or underscore or just take the name
                const parts = img.fileName.split(/[-_]/);
                if (parts.length >= 2) {
                    extractedName = parts[0].trim();
                    // Join the rest as the job description in case it has more hyphens
                    extractedJob = parts.slice(1).join(' ').trim();
                } else {
                    extractedName = img.fileName.trim();
                }
            }

            newNames.push(extractedName);
            // Preserve existing prompt if user typed it, otherwise use extracted job
            newPrompts.push(extractedJob);
        });

        setNames(newNames);
        // Only overwrite prompts if they are empty (initial load) to avoid overwriting user edits
        setPrompts(prev => {
            if (prev.length === 0 && newPrompts.some(p => p !== '')) return newPrompts;
            if (newPrompts.length !== prev.length) return newPrompts; // Array size changed
            return prev;
        });

    }, [inputImages]);

    const handlePromptChange = (index: number, value: string) => {
        const newPrompts = [...prompts];
        newPrompts[index] = value;
        setPrompts(newPrompts);
    };

    const handleNameChange = (index: number, value: string) => {
        const newNames = [...names];
        newNames[index] = value;
        setNames(newNames);
    };

    const handleQuickSelect = (index: number, job: string) => {
        handlePromptChange(index, job);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 flex gap-3 backdrop-blur-sm neon-border">
                <div className="bg-white p-2 rounded-full shadow-sm">
                    <AcademicCapIcon className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-sky-900 led-text">Ước Mơ Của Em</h3>
                    <p className="text-[10px] text-sky-700/80 mt-0.5 font-medium">Tự động nhận diện Tên & Nghề từ tên file (Ví dụ: Nguyen Van A - Cong An)</p>
                </div>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                ⭐ <strong>Mẹo:</strong> Đặt tên file ảnh là <code>"Họ Tên - Nghề nghiệp.jpg"</code> để hệ thống tự điền thông tin.
            </div>

            {/* Dynamic Inputs List */}
            <div className="space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                {inputImages.length === 0 && (
                    <div className="text-center p-8 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Chưa có ảnh nào. Vui lòng upload ảnh bên trái.
                    </div>
                )}

                {inputImages.map((_, index) => (
                    <div key={index} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-fade-in group hover:border-sky-300 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ảnh #{index + 1}</span>
                            <div className="flex items-center gap-2 w-2/3">
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Họ Tên:</span>
                                <input
                                    type="text"
                                    value={names[index] || ''}
                                    onChange={(e) => handleNameChange(index, e.target.value)}
                                    className="text-xs font-bold text-sky-700 bg-sky-50 border-none rounded px-2 py-1 w-full focus:ring-1 focus:ring-sky-500"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                value={prompts[index] || ''}
                                onChange={(e) => handlePromptChange(index, e.target.value)}
                                placeholder="Nhập nghề nghiệp mơ ước (VD: Bác sĩ)..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all font-medium placeholder:font-normal"
                            />
                        </div>
                        {/* Quick Select Chips */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {commonJobs.slice(0, 5).map(job => (
                                <button
                                    key={job}
                                    onClick={() => handleQuickSelect(index, job)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 text-[10px] rounded-md transition-colors"
                                >
                                    {job.split('(')[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Model Selector */}
            <div>
                <ModelSelector className="" imageCount={inputImages.length || 1} />
            </div>

            <div className="panel-action-wrapper">
                <button
                    onClick={() => onGenerate(prompts, names)}
                    disabled={isLoading || isDisabled || inputImages.length === 0 || prompts.every(p => !p.trim())}
                    className="w-full px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 animate-gradient-x text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/40 transition-all duration-300 disabled:opacity-50 transform active:scale-[0.98]"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Đang hiện thực hóa ước mơ...
                        </span>
                    ) : "BẮT ĐẦU"}
                </button>
            </div>
        </div>
    );
};
