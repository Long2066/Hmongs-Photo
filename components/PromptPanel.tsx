import React, { useEffect, useRef, useState } from 'react';
import { MagicWandIcon } from './Icons';
import { generateBatchPromptsText, optimizePrompt, type IdentityPreservationMode } from '../services/aiService';
import { extractSceneLines, MAX_STORY_SCENES } from '../services/scenePromptUtils';
import type { CreativeRefImages } from '../services/aiService';
import * as storage from '../services/storageService';
import { getSystemApiKey, getSelectedResolution } from '../services/geminiCoreService';
import { ModelSelector } from './ModelSelector';
import {
    CONCURRENCY_OPTIONS,
    CONCURRENCY_EVENT,
    ConcurrencySetting,
    getConcurrencySetting,
    setConcurrencySetting
} from '../services/concurrencyService';

export interface CreativePromptPanelOptions {
    identityMode: IdentityPreservationMode;
    autoQaEnabled: boolean;
}

interface PromptPanelProps {
    onGenerate: (
        prompts: string[],
        aspectRatio: string,
        resolution: string,
        outputMode: 'single' | 'couple',
        filenamePrefix: string,
        style?: string,
        shotType?: string,
        options?: CreativePromptPanelOptions
    ) => void;
    onCancel?: () => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasApiKey: boolean;
    selectedImageCount: number;
    inputCounts?: { male: number, female: number, maleAcc: number, femaleAcc: number };
    refImages?: CreativeRefImages;
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
    'Tự nhiên theo ảnh mẫu & bối cảnh',
    'Hiện đại – Thời trang & Đời thường',
    'Điện ảnh Cinematic 4K',
    'Phim Cổ trang Trung Hoa',
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

    // 1. First priority: Check if text contains numbered or Prompt-tagged items (e.g. "1.", "2.", "Prompt 1:")
    const listItems = text
        .split(/(?:\r?\n|^)\s*(?=(?:(?:\d+[\.\)]|Prompt\s*\d+[:\.]|\#+\s*Prompt\s*\d+)\s+))/i)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    let prompts: string[] = [];
    if (listItems.length > 1) {
        prompts = listItems;
    } else {
        // 2. Try splitting by blank lines
        prompts = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(p => p.length > 0);

        // 3. Fallback: single lines with bullets
        if (prompts.length <= 1) {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 1 && lines.every(l => /^(?:[-*•]|\d+[\.\)])/.test(l))) {
                prompts = lines;
            }
        }
    }

    // 4. Clean up prefixes (e.g. "1. ", "Prompt 1: ", "- ")
    return prompts
        .map(p => p.replace(/^(?:[-*•]|\d+[\.\)]|Prompt\s*\d+[:\.])\s*/i, '').trim())
        .filter(p => p.length > 0);
};

const MAX_CREATIVE_IMAGES = MAX_STORY_SCENES;
const QUICK_QUANTITIES = [4, 10, 20, 30, 40];

export const PromptPanel: React.FC<PromptPanelProps> = ({ onGenerate, onCancel, isLoading, isDisabled, hasApiKey, selectedImageCount, inputCounts = { male: 0, female: 0, maleAcc: 0, femaleAcc: 0 }, refImages }) => {
    const [globalContext, setGlobalContext] = useState('');
    const [topic, setTopic] = useState('');
    const [quantity, setQuantity] = useState(2);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [shotType, setShotType] = useState(shotTypes[0]);
    const [style, setStyle] = useState(styles[0]);
    const [outputMode, setOutputMode] = useState<'single' | 'couple'>('single');
    const [identityMode, setIdentityMode] = useState<IdentityPreservationMode>('strict_original');
    const [autoQaEnabled, setAutoQaEnabled] = useState<boolean>(false);
    const [filenamePrefix, setFilenamePrefix] = useState('ImageTool');

    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
    const generatingRef = useRef(false);
    const [promptError, setPromptError] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [imageConcurrency, setImageConcurrency] = useState<ConcurrencySetting>(() => getConcurrencySetting('image'));

    useEffect(() => {
        const handleConcurrencySync = (ev: Event) => {
            const custom = ev as CustomEvent<{ kind?: string; setting?: ConcurrencySetting }>;
            if (custom.detail?.kind === 'image' && custom.detail.setting !== undefined) {
                setImageConcurrency(custom.detail.setting);
            }
        };
        window.addEventListener(CONCURRENCY_EVENT, handleConcurrencySync);
        return () => window.removeEventListener(CONCURRENCY_EVENT, handleConcurrencySync);
    }, []);

    const handleSelectImageConcurrency = (val: ConcurrencySetting) => {
        setImageConcurrency(val);
        setConcurrencySetting('image', val);
    };

    const parsedSceneLines = extractSceneLines(topic);
    const isLineByLineMode = parsedSceneLines.length >= 2;
    const effectiveQuantity = isLineByLineMode
        ? Math.min(MAX_CREATIVE_IMAGES, parsedSceneLines.length)
        : quantity;
    const hasOverflowLines = parsedSceneLines.length > MAX_CREATIVE_IMAGES;

    // Direct connection to CLIProxyAPI (AI Gateway)
    const getApiKeyForPrompts = (): string => {
        return 'NINEROUTER_MODE';
    };

    const handleOptimizeTopic = async () => {
        if (!topic.trim()) return;
        const apiKey = getApiKeyForPrompts();

        setIsOptimizing(true);
        try {
            const inputToOptimize = globalContext.trim()
                ? `Bối cảnh xuyên suốt: ${globalContext.trim()}\n${topic}`
                : topic;
            const optimized = await optimizePrompt(apiKey, inputToOptimize);
            setTopic(optimized);
        } catch (e: any) {
            const message = e?.message || 'Lỗi không xác định';
            setPromptError(`Lỗi tối ưu hóa: ${message}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleGeneratePrompts = async () => {
        if (generatingRef.current || isLoading || isDisabled || (!topic.trim() && !globalContext.trim())) return;

        const apiKey = getApiKeyForPrompts();
        if (!apiKey) return;

        generatingRef.current = true;
        setPromptError('');
        setIsGeneratingPrompts(true);
        try {
            const activeTopic = topic.trim() || globalContext.trim();
            let prompts: string[] = [];
            try {
                const text = await generateBatchPromptsText(
                    apiKey,
                    activeTopic,
                    effectiveQuantity,
                    shotType,
                    style,
                    outputMode,
                    inputCounts,
                    refImages,
                    {
                        globalContext: globalContext.trim(),
                        sceneLines: isLineByLineMode ? parsedSceneLines.slice(0, MAX_CREATIVE_IMAGES) : undefined,
                        identityMode
                    }
                );
                prompts = parsePromptsFromText(text);
            } catch (err: any) {
                console.warn('[PromptPanel] AI batch prompt generation encountered error, applying automatic fallback:', err);
            }

            if (!prompts || prompts.length === 0) {
                prompts = isLineByLineMode && parsedSceneLines.length > 0
                    ? parsedSceneLines.slice(0, effectiveQuantity)
                    : Array(effectiveQuantity).fill(activeTopic);
            }
            if (prompts.length < effectiveQuantity && prompts.length > 0) {
                const basePrompts = [...prompts];
                while (prompts.length < effectiveQuantity) {
                    prompts.push(basePrompts[prompts.length % basePrompts.length]);
                }
            } else if (prompts.length > effectiveQuantity) {
                prompts = prompts.slice(0, effectiveQuantity);
            }
            const selectedResolution = getSelectedResolution();
            onGenerate(prompts, aspectRatio, selectedResolution, outputMode, filenamePrefix, style, shotType, {
                identityMode,
                autoQaEnabled
            });
        } catch (e: any) {
            console.error('[PromptPanel] Fatal error in handleGeneratePrompts:', e);
            setPromptError(`Lỗi tạo prompt: ${e?.message || 'Lỗi không xác định'}`);
        } finally {
            generatingRef.current = false;
            setIsGeneratingPrompts(false);
        }
    };

    return (
        <div className="flex flex-col gap-3.5">
            {/* Global Context / Visual Anchor */}
            <div className="group">
                <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                        <span>Bối cảnh xuyên suốt</span>
                    </label>
                    <span className="text-[10.5px] font-semibold text-slate-500">
                        Đồng bộ cả bộ ảnh
                    </span>
                </div>
                <textarea
                    value={globalContext}
                    onChange={(e) => setGlobalContext(e.target.value)}
                    placeholder="VD: Vùng quê miền núi nhà gỗ/tre, nắng sớm sương nhẹ, phong cách điện ảnh Trung Hoa..."
                    rows={2}
                    className="w-full bg-white border border-slate-300/90 ring-1 ring-slate-900/5 rounded-xl p-2.5 text-slate-900 text-xs sm:text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-xs disabled:opacity-60 disabled:bg-slate-50 leading-relaxed"
                    disabled={isGeneratingPrompts || isLoading}
                />
            </div>

            {/* Scene Script / Topic Input */}
            <div className="group">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 flex justify-between items-center gap-2">
                    <span>Kịch bản / Chủ đề (1 dòng = 1 cảnh)</span>
                    <button
                        type="button"
                        onClick={handleOptimizeTopic}
                        disabled={isOptimizing || isGeneratingPrompts || isLoading || !topic.trim()}
                        className="text-indigo-600 hover:text-white hover:bg-indigo-600 font-bold text-[11px] bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-xs shrink-0"
                    >
                        {isOptimizing ? <span className="animate-spin">✨</span> : <MagicWandIcon className="w-3 h-3" />}
                        {isOptimizing ? 'Đang tối ưu...' : 'Tối ưu'}
                    </button>
                </label>
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={"Nhập mỗi dòng 1 cảnh (tối đa 40 dòng):\nCảnh thức dậy bên cửa sổ gỗ\nCảnh ra sân cho gà ăn\nĐi lên nương..."}
                    rows={4}
                    className="w-full bg-white border border-slate-300/90 ring-1 ring-slate-900/5 rounded-xl p-3 text-slate-900 text-xs sm:text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-xs disabled:opacity-60 disabled:bg-slate-50 leading-relaxed"
                    disabled={isGeneratingPrompts || isLoading}
                />
                {isLineByLineMode && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200/80 text-[11px]">
                        <span className="font-semibold text-violet-900">
                            Đang tạo theo từng dòng kịch bản
                        </span>
                        <span className="font-mono font-bold tabular-nums text-violet-700">
                            {effectiveQuantity}/{MAX_CREATIVE_IMAGES} cảnh
                        </span>
                    </div>
                )}
                {hasOverflowLines && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        Bạn đã nhập {parsedSceneLines.length} dòng; hệ thống sẽ tạo tối đa {MAX_CREATIVE_IMAGES} cảnh đầu tiên.
                    </p>
                )}
            </div>

            {/* Config Grid */}
            <div className="grid grid-cols-2 gap-3.5">
                    {/* Output Mode */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                            Chế độ Output
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/90 ring-1 ring-slate-900/5 gap-1">
                            <button
                                type="button"
                                onClick={() => setOutputMode('single')}
                                className={`flex-1 min-h-[44px] sm:min-h-[36px] py-2 text-xs sm:text-[13px] rounded-lg transition-all cursor-pointer active:scale-[0.98] ${outputMode === 'single' ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-semibold'}`}
                            >
                                Ảnh đơn (Riêng)
                            </button>
                            <button
                                type="button"
                                onClick={() => setOutputMode('couple')}
                                className={`flex-1 min-h-[44px] sm:min-h-[36px] py-2 text-xs sm:text-[13px] rounded-lg transition-all cursor-pointer active:scale-[0.98] ${outputMode === 'couple' ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-semibold'}`}
                            >
                                Ảnh đôi (Ghép)
                            </button>
                        </div>
                    </div>

                    {/* Character Identity Lock Mode */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                            Chế độ Nhân vật
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-xl ring-1 ring-slate-900/5 gap-1">
                            <button
                                type="button"
                                onClick={() => setIdentityMode('strict_original')}
                                className={`flex-1 min-h-[44px] sm:min-h-[36px] px-2 py-2 text-xs rounded-lg transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                    identityMode === 'strict_original'
                                        ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-slate-900/10'
                                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                                }`}
                            >
                                Khóa Mặt &amp; Đồ Gốc 100%
                            </button>
                            <button
                                type="button"
                                onClick={() => setIdentityMode('korean_idol')}
                                className={`flex-1 min-h-[44px] sm:min-h-[36px] px-2 py-2 text-xs rounded-lg transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                    identityMode === 'korean_idol'
                                        ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-slate-900/10'
                                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                                }`}
                            >
                                Idol Hàn (Chỉ lấy đồ)
                            </button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                            {identityMode === 'strict_original'
                                ? 'Giữ tuyệt đối 100% khuôn mặt, kiểu tóc & trang phục từ ảnh tham chiếu gốc.'
                                : 'Thay mặt bằng phong cách Idol Hàn Quốc/Cổ trang, giữ 100% trang phục gốc.'}
                        </p>
                    </div>

                    {/* Auto-QA Identity Guard Switch */}
                    <div className="col-span-2">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={autoQaEnabled}
                            onClick={() => setAutoQaEnabled(v => !v)}
                            className={`w-full min-h-[48px] flex items-center justify-between gap-3 rounded-xl p-3 text-left transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                autoQaEnabled
                                    ? 'bg-emerald-50/80 ring-1 ring-emerald-500/25 shadow-2xs'
                                    : 'bg-slate-50 ring-1 ring-slate-900/5 hover:bg-slate-100/80'
                            }`}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${autoQaEnabled ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                                    <span className="text-xs font-bold text-slate-900">
                                        Khóa 100% Ảnh Gốc (Auto-QA)
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-600 leading-snug">
                                    Tự chấm điểm mặt &amp; trang phục (ngưỡng 85%). Ảnh lệch tự sửa lại miễn phí.
                                </p>
                            </div>
                            <span
                                aria-hidden="true"
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                    autoQaEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                                        autoQaEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </span>
                        </button>
                    </div>

                    {/* Model Selector */}
                    <div className="col-span-2">
                        <ModelSelector className="" imageCount={effectiveQuantity} />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2">
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                Số lượng ảnh: <span className="text-indigo-600 font-mono font-bold text-sm ml-1 tabular-nums">{effectiveQuantity}</span>
                            </label>
                            <span className="text-[10.5px] font-mono font-semibold text-slate-500 tabular-nums">
                                Tối đa {MAX_CREATIVE_IMAGES}
                            </span>
                        </div>
                        {!isLineByLineMode && (
                            <>
                                <input
                                    type="range"
                                    min="1"
                                    max={MAX_CREATIVE_IMAGES}
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                                    className="w-full h-2.5 bg-slate-200 border border-slate-300/80 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700 transition-all"
                                />
                                <div className="grid grid-cols-5 gap-1.5 mt-2">
                                    {QUICK_QUANTITIES.map((q) => (
                                        <button
                                            key={q}
                                            type="button"
                                            onClick={() => setQuantity(q)}
                                            className={`py-1.5 rounded-lg font-mono text-[11px] font-bold tabular-nums border transition-all cursor-pointer ${quantity === q ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'}`}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        {selectedImageCount > 0 && (
                            <div className="flex items-center gap-2 mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs font-medium shadow-xs">
                                <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="leading-tight">
                                    Đã chọn {selectedImageCount} ảnh mẫu. Output sẽ tuân thủ trang phục & phụ kiện.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Style */}
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 block">Phong cách</label>
                        <div className="relative group">
                            <select
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                className="w-full px-3.5 py-2.5 pr-8 bg-white border border-slate-300/90 ring-1 ring-slate-900/5 rounded-xl text-slate-900 text-xs sm:text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none cursor-pointer hover:border-slate-400 shadow-xs transition-all appearance-none"
                            >
                                {styles.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-500 group-hover:text-slate-700">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Shot Type */}
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 block">Góc chụp</label>
                        <div className="relative group">
                            <select
                                value={shotType}
                                onChange={(e) => setShotType(e.target.value)}
                                className="w-full px-3.5 py-2.5 pr-8 bg-white border border-slate-300/90 ring-1 ring-slate-900/5 rounded-xl text-slate-900 text-xs sm:text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none cursor-pointer hover:border-slate-400 shadow-xs transition-all appearance-none"
                            >
                                {shotTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-500 group-hover:text-slate-700">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Filename Config */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                            Tên file output
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={filenamePrefix}
                                onChange={(e) => setFilenamePrefix(e.target.value)}
                                placeholder="Nhập tên file..."
                                className="w-full py-2.5 pl-8 pr-3 bg-white border border-slate-300/90 ring-1 ring-slate-900/5 rounded-xl text-slate-900 text-xs sm:text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none shadow-xs transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.965 3.129V2.75z" />
                                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Aspect Ratio - Resolution is already in ModelSelector */}
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 block">Tỷ lệ khung hình</label>
                        <div className="relative group">
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full px-3.5 py-2.5 pr-8 bg-white border border-slate-300/90 ring-1 ring-slate-900/5 rounded-xl text-slate-900 text-xs sm:text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none cursor-pointer hover:border-slate-400 shadow-xs transition-all appearance-none"
                            >
                                {aspectRatios.map(ar => <option key={ar.value} value={ar.value}>{ar.label}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-500 group-hover:text-slate-700">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Parallel Concurrency Threads */}
                    <div className="col-span-2">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                Luồng chạy song song
                            </label>
                            <span className="text-[10.5px] font-mono font-semibold text-indigo-700 tabular-nums">
                                {imageConcurrency === 'auto' ? 'Tự động (8–10 luồng)' : `${imageConcurrency} luồng`}
                            </span>
                        </div>
                        <div className="grid grid-cols-6 gap-1.5 bg-slate-100 p-1 rounded-xl ring-1 ring-slate-900/5">
                            {CONCURRENCY_OPTIONS.map((opt) => {
                                const isActive = imageConcurrency === opt;
                                return (
                                    <button
                                        key={String(opt)}
                                        type="button"
                                        onClick={() => handleSelectImageConcurrency(opt)}
                                        className={`min-h-[44px] sm:min-h-[38px] rounded-lg text-[11px] font-mono font-bold tabular-nums transition-all cursor-pointer active:scale-[0.97] ${
                                            isActive
                                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/10'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                        }`}
                                    >
                                        {opt === 'auto' ? 'Auto' : `x${opt}`}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-1 text-[10.5px] text-slate-500 leading-snug">
                            Tối ưu 8–10 luồng đồng thời khi chạy Muse / 9Router đa tài khoản.
                        </p>
                    </div>
                </div>

            {promptError && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700 ring-1 ring-rose-900/10">{promptError}</div>}

            {/* ACTION BUTTONS - Sticky at bottom */}
            <div className="panel-action-wrapper mt-1">
                {isLoading ? (
                    <button
                        onClick={onCancel}
                        type="button"
                        className="w-full flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 active:scale-[0.98] sm:text-sm"
                        title="Bấm để dừng đợt tạo ảnh này ngay lập tức"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                        <span>DỪNG TẠO ẢNH (HỦY)</span>
                    </button>
                ) : (
                    <button
                        onClick={handleGeneratePrompts}
                        disabled={isGeneratingPrompts || isDisabled || (!topic.trim() && !globalContext.trim())}
                        aria-busy={isGeneratingPrompts}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none sm:text-sm"
                    >
                        {isGeneratingPrompts ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden="true" /> : <MagicWandIcon className="h-4 w-4" />}
                        <span role={isGeneratingPrompts ? 'status' : undefined}>
                            {isGeneratingPrompts ? `Đang viết ${effectiveQuantity} kịch bản ảnh...` : `Bắt đầu tạo ${effectiveQuantity} ảnh`}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};
