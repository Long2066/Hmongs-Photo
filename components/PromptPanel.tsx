import React, { useState } from 'react';
import { SparklesIcon, MagicWandIcon } from './Icons';
import { generateBatchPromptsText, optimizePrompt } from '../services/aiService';
import * as storage from '../services/storageService';

interface PromptPanelProps {
  onGenerate: (prompts: string[], aspectRatio: string, resolution: string, outputMode: 'single' | 'couple', filenamePrefix: string) => void;
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

const resolutions = ['HD', 'FHD', '2K', '4K'];

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

export const PromptPanel: React.FC<PromptPanelProps> = ({ onGenerate, isLoading, isDisabled, hasApiKey, selectedImageCount, inputCounts = {male:0, female:0, maleAcc:0, femaleAcc:0} }) => {
  const [topic, setTopic] = useState('');
  const [quantity, setQuantity] = useState(2);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [shotType, setShotType] = useState(shotTypes[0]);
  const [style, setStyle] = useState(styles[0]);
  const [outputMode, setOutputMode] = useState<'single' | 'couple'>('single');
  const [filenamePrefix, setFilenamePrefix] = useState('ToolPhoto2025');
  
  // New State for Batch Prompts
  const [generatedPromptText, setGeneratedPromptText] = useState('');
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Topic Config, 2: Review Prompts

  const handleOptimizeTopic = async () => {
    if (!topic.trim()) return;
    const apiKey = storage.getApiKey('gemini');
    if (!apiKey) { alert("Cần API Key."); return; }
    
    setIsOptimizing(true);
    try {
        const optimized = await optimizePrompt(apiKey, topic);
        setTopic(optimized);
    } catch(e) {
        alert("Lỗi tối ưu hóa.");
    } finally {
        setIsOptimizing(false);
    }
  };

  const handleGeneratePrompts = async () => {
      if (!topic.trim() || !hasApiKey) return;
      
      const apiKey = storage.getApiKey('gemini');
      if (!apiKey) return;

      setIsGeneratingPrompts(true);
      try {
          const text = await generateBatchPromptsText(apiKey, topic, quantity, shotType, style, outputMode, inputCounts);
          setGeneratedPromptText(text);
          setStep(2);
      } catch (e) {
          alert("Lỗi tạo prompt. Vui lòng thử lại.");
      } finally {
          setIsGeneratingPrompts(false);
      }
  };

  const handleFinalGenerate = () => {
      // Split by double newline or single newline to get array
      const prompts = generatedPromptText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
      if (prompts.length === 0) {
          alert("Danh sách prompt trống!");
          return;
      }
      onGenerate(prompts, aspectRatio, resolution, outputMode, filenamePrefix);
      setStep(1); // Reset to start after launching
  };

  return (
    <div className="flex flex-col gap-6">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 text-[10px] font-extrabold text-slate-400 mb-2 tracking-wide">
                <span className={`px-2.5 py-1 rounded-md transition-all ${step === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500'}`}>1. CẤU HÌNH</span>
                <span className="text-slate-300 animate-pulse">➜</span>
                <span className={`px-2.5 py-1 rounded-md transition-all ${step === 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500'}`}>2. TẠO ẢNH</span>
            </div>

            {/* Topic Input - Always visible but disabled in step 2 */}
            <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Chủ đề (AI Prompt Writer)</span>
                    <button 
                        onClick={handleOptimizeTopic}
                        disabled={isOptimizing || !topic.trim()}
                        className="text-indigo-500 hover:text-white hover:bg-indigo-500 font-semibold text-[10px] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                        {isOptimizing ? <span className="animate-spin">✨</span> : <MagicWandIcon className="w-3 h-3"/>}
                        {isOptimizing ? 'Đang tối ưu...' : 'Auto Optimize Prompt'}
                    </button>
                </label>
                <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Mô tả ý tưởng... (Ví dụ: Cô gái H'Mông đang thêu vải bên hiên nhà gỗ...)"
                    rows={3}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-100 backdrop-blur-sm"
                    disabled={step === 2}
                />
            </div>

            {/* Config Grid - Hidden in Step 2 to focus on Prompts */}
            {step === 1 && (
                <div className="grid grid-cols-2 gap-5 animate-fade-in">
                    {/* Output Mode */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Chế độ Output
                        </label>
                        <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setOutputMode('single')}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${outputMode === 'single' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                                Ảnh đơn (Riêng)
                            </button>
                            <button
                                onClick={() => setOutputMode('couple')}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${outputMode === 'couple' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                                Ảnh đôi (Ghép)
                            </button>
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Số lượng: <span className="text-indigo-600 font-extrabold text-base ml-1">{quantity}</span>
                            </label>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="10" 
                            value={quantity} 
                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                        />
                         {selectedImageCount > 0 && (
                            <div className="flex items-start gap-2 mt-3 p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg backdrop-blur-sm">
                                <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-[10px] text-indigo-700 font-medium leading-tight">
                                    Đã chọn {selectedImageCount} ảnh mẫu. Output sẽ tuân thủ nghiêm ngặt trang phục & phụ kiện.
                                </p>
                            </div>
                         )}
                    </div>

                    {/* Style */}
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Phong cách</label>
                        <div className="relative group">
                            <select 
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {styles.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Shot Type */}
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Góc chụp</label>
                        <div className="relative group">
                            <select 
                                value={shotType}
                                onChange={(e) => setShotType(e.target.value)}
                                className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {shotTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* Filename Config */}
                     <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Tên file output
                        </label>
                        <div className="relative group">
                            <input 
                                type="text"
                                value={filenamePrefix}
                                onChange={(e) => setFilenamePrefix(e.target.value)}
                                placeholder="Nhập tên file..."
                                className="w-full p-3 pl-9 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.965 3.129V2.75z" />
                                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Res & Ratio */}
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Độ phân giải</label>
                         <div className="relative group">
                            <select 
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {resolutions.map(res => <option key={res} value={res}>{res}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tỷ lệ</label>
                         <div className="relative group">
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all"
                            >
                                {aspectRatios.map(ar => <option key={ar.value} value={ar.value}>{ar.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: PROMPT REVIEW AREA */}
            {step === 2 && (
                <div className="animate-fade-in space-y-4">
                     <div className="flex items-center justify-between">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Review Prompt ({generatedPromptText.split(/\n\s*\n/).length})
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
                        * Mỗi prompt được phân cách bởi dòng trống. Chỉnh sửa nếu cần.
                    </div>
                </div>
            )}

            {/* ACTION BUTTONS */}
            {step === 1 ? (
                <button
                    onClick={handleGeneratePrompts}
                    disabled={isGeneratingPrompts || isDisabled || !topic.trim() || !hasApiKey}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-4 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transform active:scale-[0.98] animate-shine"
                >
                    {isGeneratingPrompts ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Đang viết Prompt...</span>
                        </>
                    ) : (
                        <>
                            <MagicWandIcon className="w-5 h-5" />
                            <span>BƯỚC 1: TẠO PROMPT</span>
                        </>
                    )}
                </button>
            ) : (
                <button
                    onClick={handleFinalGenerate}
                    disabled={isLoading}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-gradient-x text-white font-bold rounded-xl hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                >
                    {isLoading ? (
                         <span>Đang xử lý...</span>
                    ) : (
                        <>
                            <SparklesIcon className="w-5 h-5 animate-spin-slow" />
                            <span>BƯỚC 2: TIẾN HÀNH VẼ</span>
                        </>
                    )}
                </button>
            )}
            
            {!hasApiKey && (
                <div className="text-center text-amber-600 text-[10px] font-medium bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center justify-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                   Yêu cầu API Key
                </div>
            )}
    </div>
  );
};