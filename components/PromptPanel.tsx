import React, { useState } from 'react';
import { SparklesIcon, MagicWandIcon } from './Icons';
import { generateBatchPromptsText, optimizePrompt } from '../services/aiService';
import * as storage from '../services/storageService';
import { getSystemApiKey, getSelectedResolution } from '../services/geminiCoreService';
import { ModelSelector } from './ModelSelector';

interface PromptPanelProps {
    onGenerate: (
        prompts: string[],
        aspectRatio: string,
        resolution: string,
        outputMode: 'single' | 'couple',
        filenamePrefix: string,
        style?: string,
        shotType?: string
    ) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasApiKey: boolean;
    selectedImageCount: number;
    inputCounts?: { male: number, female: number, maleAcc: number, femaleAcc: number };
}

const aspectRatios = [
    { label: 'Vuông (1:1)', value: '1:1' },
    { label: 'Ngang (16:9)', value: '16:9' },
    { label: 'Dọc TikTok (9:16)', value: '9:16' }
];

const shotTypes = [
    'Chân dung (Portrait)',
    'Toàn cảnh (Landscape)',
    'Chụp lén (Candid)',
    'Flycam (Drone)',
    'Góc rộng (Wide Angle)',
    'Cận cảnh (Macro)',
    'Chụp studio chuyên nghiệp',
    'Điện ảnh (Cinematic)',
    'Góc thấp (Low angle)',
    'Góc nhìn thứ nhất (POV)',
    'Góc qua vai (Over-the-shoulder)',
    'Góc nghiêng (Dutch Angle)',
    'Mắt cá (Fish-eye)',
    'Từ trên cao (Bird\'s eye)',
    'Từ dưới đất (Worm\'s eye)',
    'Ngược sáng (Silhouette)',
    'Hiệu ứng Bokeh (Bokeh heavy)',
    'Nhòe chuyển động (Motion Blur)',
    'Phản chiếu (Reflection)',
    'Khung trong khung (Framed shot)'
];

const styles = [
    'Truyền thống H’Mông cổ điển',
    'H’Mông hiện đại – bản sắc kết hợp thời trang',
    'H’Mông cổ tích – Fantasy',
    'H’Mông 3D Animation',
    'H’Mông Cinematic – Điện ảnh 4K',
    'H’Mông Documentaries – Phong cách phim tài liệu',
    'H’Mông Watercolor – Sơn thủy màu nước',
    'H’Mông Manga – Anime Nhật Bản',
    'H’Mông Realistic Portrait – Siêu thực 8K',
    'H’Mông Cyberpunk – Tương lai kết hợp văn hóa',
    'Giấc mơ',
    'Ảo ảnh',
    'Chân thực',
    'Điện ảnh',
    'Studio chuyên nghiệp',
    'Thời trang'
];

export const parsePromptsFromText = (text: string): string[] => {
    if (!text || !text.trim()) return [];

    // 1. Try splitting by blank lines
    let prompts = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(p => p.length > 0);

    // 2. If only 1 block is found, check if it's formatted as a numbered or bulleted list
    if (prompts.length <= 1) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const listItems = text
            .split(/(?:\r?\n)+(?=(?:(?:\d+[\.\)]|Prompt\s*\d+[:\.]|\#+\s*Prompt\s*\d+)\s+))/i)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (listItems.length > 1) {
            prompts = listItems;
        } else if (lines.length > 1 && lines.every(l => /^(?:[-*•]|\d+[\.\)])/.test(l))) {
            prompts = lines;
        }
    }

    // 3. Clean up prefixes (e.g. "1. ", "Prompt 1: ", "- ")
    return prompts.map(p => p.replace(/^(?:[-*•]|\d+[\.\)]|Prompt\s*\d+[:\.])\s*/i, '').trim()).filter(p => p.length > 0);
};

export const PromptPanel: React.FC<PromptPanelProps> = ({ onGenerate, isLoading, isDisabled, hasApiKey, selectedImageCount, inputCounts = { male: 0, female: 0, maleAcc: 0, femaleAcc: 0 } }) => {
    const [topic, setTopic] = useState('');
    const [quantity, setQuantity] = useState(2);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [shotType, setShotType] = useState(shotTypes[0]);
    const [style, setStyle] = useState(styles[0]);
    const [outputMode, setOutputMode] = useState<'single' | 'couple'>('single');
    const [filenamePrefix, setFilenamePrefix] = useState('ImageTool');

    // New State for Batch Prompts
    const [generatedPromptText, setGeneratedPromptText] = useState('');
    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [step, setStep] = useState<1 | 2>(1); // 1: Topic Config, 2: Review Prompts

    // Helper to get API key - prefers NineRouter, then Antigravity, then system key for PRO users
    const getApiKeyForPrompts = (): string | null => {
        // PRIORITY -0.5: NineRouter mode
        const nineRouterEnabled = localStorage.getItem('ninerouter_enabled') === 'true';
        if (nineRouterEnabled) {
            return 'NINEROUTER_MODE';
        }

        // PRIORITY 0: Antigravity mode
        const antigravityEnabled = localStorage.getItem('antigravity_enabled') === 'true';
        if (antigravityEnabled) {
            return 'ANTIGRAVITY_MODE';
        }

        // PRIORITY 1: PRO mode - use system key
        if (storage.isProUser() && storage.getUseProApi()) {
            const systemKey = getSystemApiKey();
            if (systemKey) return systemKey;
        }
        // Fallback to user's key
        return storage.getApiKey('gemini');
    };

    // Check if any API key is available (NineRouter, Antigravity, PRO or user's own)
    const hasAnyApiKey = (): boolean => {
        // NineRouter enabled = OK
        const nineRouterEnabled = localStorage.getItem('ninerouter_enabled') === 'true';
        if (nineRouterEnabled) return true;

        // Antigravity enabled = OK
        const antigravityEnabled = localStorage.getItem('antigravity_enabled') === 'true';
        if (antigravityEnabled) return true;

        // PRO mode = OK
        if (storage.isProUser() && storage.getUseProApi()) return true;

        // User has their own key = OK
        return !!storage.getApiKey('gemini');
    };

    const handleOptimizeTopic = async () => {
        if (!topic.trim()) return;
        const apiKey = getApiKeyForPrompts();
        if (!apiKey) { alert("Cần API Key hoặc bật PRO mode."); return; }

        setIsOptimizing(true);
        try {
            const optimized = await optimizePrompt(apiKey, topic);
            setTopic(optimized);
        } catch (e: any) {
            const message = e?.message || 'Lỗi không xác định';
            alert(`Lỗi tối ưu hóa: ${message}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleGeneratePrompts = async () => {
        if (!topic.trim()) return;

        const apiKey = getApiKeyForPrompts();
        if (!apiKey) return;

        setIsGeneratingPrompts(true);
        try {
            const text = await generateBatchPromptsText(apiKey, topic, quantity, shotType, style, outputMode, inputCounts);
            setGeneratedPromptText(text);
            setStep(2);
        } catch (e: any) {
            const message = e?.message || 'Lỗi không xác định';
            alert(`Lỗi tạo prompt: ${message}`);
        } finally {
            setIsGeneratingPrompts(false);
        }
    };

    const handleFinalGenerate = () => {
        let prompts = parsePromptsFromText(generatedPromptText);
        if (prompts.length === 0) {
            alert("Danh sách prompt trống!");
            return;
        }

        // If user requested quantity > 1 but only 1 prompt is present, replicate it
        // so that the full batch of images is generated as requested
        if (prompts.length === 1 && quantity > 1) {
            prompts = Array.from({ length: quantity }, () => prompts[0]);
        }

        // Use resolution from ModelSelector (centralized)
        const selectedResolution = getSelectedResolution();
        onGenerate(prompts, aspectRatio, selectedResolution, outputMode, filenamePrefix, style, shotType);
        setStep(1); // Reset to start after launching
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Step Indicator */}
            <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-400 tracking-wide">
                <span className={`px-2 py-0.5 rounded transition-all ${step === 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500'}`}>1. CẤU HÌNH</span>
                <span className="text-slate-300 animate-pulse">➜</span>
                <span className={`px-2 py-0.5 rounded transition-all ${step === 2 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500'}`}>2. TẠO ẢNH</span>
            </div>

            {/* Topic Input - Always visible but disabled in step 2 */}
            <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex justify-between">
                    <span>Chủ đề (AI PROMPT WRITER)</span>
                    <button
                        onClick={handleOptimizeTopic}
                        disabled={isOptimizing || !topic.trim()}
                        className="text-indigo-500 hover:text-white hover:bg-indigo-500 font-semibold text-[9px] bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                        {isOptimizing ? <span className="animate-spin">✨</span> : <MagicWandIcon className="w-2.5 h-2.5" />}
                        {isOptimizing ? 'Đang tối ưu...' : 'Auto Optimize Prompt'}
                    </button>
                </label>
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Mô tả ý tưởng... (Ví dụ: Cô gái H'Mông đang thêu vải bên hiên nhà gỗ...)"
                    rows={2}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2 text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-100 backdrop-blur-sm"
                    disabled={step === 2}
                />
            </div>

            {/* Config Grid - Hidden in Step 2 to focus on Prompts */}
            {step === 1 && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                    {/* Output Mode */}
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Chế độ Output
                        </label>
                        <div className="flex bg-slate-100/50 p-0.5 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setOutputMode('single')}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all duration-300 ${outputMode === 'single' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                                Ảnh đơn (Riêng)
                            </button>
                            <button
                                onClick={() => setOutputMode('couple')}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all duration-300 ${outputMode === 'couple' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                                Ảnh đôi (Ghép)
                            </button>
                        </div>
                    </div>

                    {/* Model Selector */}
                    <div className="col-span-2">
                        <ModelSelector className="" imageCount={quantity} />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Số lượng: <span className="text-indigo-600 font-extrabold text-sm ml-1">{quantity}</span>
                            </label>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                        />
                        {selectedImageCount > 0 && (
                            <div className="flex items-start gap-1.5 mt-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded-md backdrop-blur-sm">
                                <svg className="w-3 h-3 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-[9px] text-indigo-700 font-medium leading-tight">
                                    Đã chọn {selectedImageCount} ảnh mẫu. Output sẽ tuân thủ trang phục & phụ kiện.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Style */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Phong cách</label>
                        <div className="relative group">
                            <select
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                className="w-full p-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {styles.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Shot Type */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Góc chụp</label>
                        <div className="relative group">
                            <select
                                value={shotType}
                                onChange={(e) => setShotType(e.target.value)}
                                className="w-full p-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {shotTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Filename Config */}
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Tên file output
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={filenamePrefix}
                                onChange={(e) => setFilenamePrefix(e.target.value)}
                                placeholder="Nhập tên file..."
                                className="w-full p-2 pl-7 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                            <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.965 3.129V2.75z" />
                                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Aspect Ratio - Resolution is already in ModelSelector */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Tỷ lệ</label>
                        <div className="relative group">
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full p-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {aspectRatios.map(ar => <option key={ar.value} value={ar.value}>{ar.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: PROMPT REVIEW AREA */}
            {step === 2 && (() => {
                const parsedCount = parsePromptsFromText(generatedPromptText).length;
                const willGenerateCount = parsedCount === 1 && quantity > 1 ? quantity : parsedCount;
                return (
                    <div className="animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Review Prompt ({parsedCount} prompt • Sẽ vẽ {willGenerateCount} ảnh)
                            </label>
                            <button
                                onClick={() => setStep(1)}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                            >
                                Quay lại cấu hình
                            </button>
                        </div>
                        <textarea
                            value={generatedPromptText}
                            onChange={(e) => setGeneratedPromptText(e.target.value)}
                            rows={10}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500/50 outline-none shadow-inner custom-scrollbar leading-relaxed"
                            placeholder="Prompts sẽ xuất hiện ở đây..."
                        />
                        <div className="text-[10px] text-slate-400 italic">
                            * Mỗi prompt được phân cách bởi dòng trống hoặc đánh số (1., 2.). Hệ thống sẽ vẽ đủ {willGenerateCount} ảnh.
                        </div>
                    </div>
                );
            })()}

            {/* ACTION BUTTONS - Sticky at bottom */}
            <div className="panel-action-wrapper">
                {step === 1 ? (
                    <button
                        onClick={handleGeneratePrompts}
                        disabled={isGeneratingPrompts || isDisabled || !topic.trim() || !hasAnyApiKey()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transform active:scale-[0.98]"
                    >
                        {isGeneratingPrompts ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Đang viết Prompt...</span>
                            </>
                        ) : (
                            <>
                                <MagicWandIcon className="w-4 h-4" />
                                <span>BƯỚC 1: TẠO PROMPT</span>
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleFinalGenerate}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-gradient-x text-white font-bold text-xs rounded-lg hover:shadow-lg hover:shadow-indigo-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <span>Đang xử lý...</span>
                        ) : (
                            <>
                                <SparklesIcon className="w-4 h-4 animate-spin-slow" />
                                <span>BƯỚC 2: TIẾN HÀNH VẼ</span>
                            </>
                        )}
                    </button>
                )}

                {!hasAnyApiKey() && (
                    <div className="text-center text-amber-600 text-[10px] font-medium bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center justify-center gap-2 mt-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        Bật Antigravity, PRO mode, hoặc nhập API Key
                    </div>
                )}
            </div>
        </div>
    );
};