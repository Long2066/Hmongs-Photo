import React, { useState, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';
import {
    PosterOptions,
    PosterTemplateId,
    PosterAspectRatio
} from '../services/posterRenderService';

interface PosterStudioPanelProps {
    onAiGeneratePoster: (prompt: string, aspectRatio: string, branding: any) => void;
    onGeneratePoster?: (options: PosterOptions, batchMode: 'single' | 'top4' | 'all', shuffleSeed: number) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputCount: number;
    inputImages?: string[];
    onSwapInputs?: (i: number, j: number) => void;
    onRemoveInput?: (idx: number) => void;
    selectedTemplateId?: PosterTemplateId;
    onTemplateSelect?: (id: PosterTemplateId) => void;
}

const STORAGE_KEY_POSTER_PROMPT = 'imagetool_ai_poster_prompt_v1';
const STORAGE_KEY_POSTER_BRANDING = 'imagetool_ai_poster_branding_v1';
const STORAGE_KEY_POSTER_RATIO = 'imagetool_ai_poster_ratio_v1';

const QUICK_TOPIC_PRESETS = [
    {
        title: '🎓 Kỉ niệm sinh viên (Music Studio)',
        prompt: 'Poster kỷ yếu sinh viên đại học phong cách Music Studio 2026, cặp đôi rạng rỡ dưới tán hoa phượng vĩ đỏ mùa hè, dải ruy băng lụa đỏ uốn lượn chân trang, 2 ảnh Polaroid nghiêng nghệ thuật, ánh nắng vàng rực rỡ.',
        studio: 'Music Studio',
        concept: 'Sinh viên',
        year: 'Kỉ niệm 2026'
    },
    {
        title: '💍 Ngày cưới (Wedding Save The Date)',
        prompt: 'Poster ảnh cưới lãng mạn phong cách K-Drama sang trọng, cặp đôi trong trang phục cưới thanh lịch, ánh hoàng hôn ngược nắng ven tóc vàng óng, hoa baby trắng, vệt sáng lóa điện ảnh và chữ Save The Date.',
        studio: 'Wedding Art',
        concept: 'Save The Date',
        year: 'Happy Wedding 2026'
    },
    {
        title: '🎞️ Dải phim 35mm hoài niệm',
        prompt: 'Poster kỷ yếu dải phim nhựa 35mm uốn lượn 3D ôm quanh 4 khoảnh khắc tuổi học trò, sticker xé giấy màu đỏ và vàng, doodle tai nghe và máy bay giấy, tone màu retro hoài niệm.',
        studio: 'Music Studio',
        concept: 'Thanh Xuân',
        year: 'Kỉ niệm 2026'
    },
    {
        title: '📻 Sổ tay giấy rách & Đĩa than',
        prompt: 'Poster phong cách Vintage Scrapbook bìa Kraft xé viền cháy, đĩa than vinyl đen bóng, cuộn băng cassette, kẹp bướm vàng, 4 ảnh Polaroid dán băng dính và nhành hoa phượng.',
        studio: 'Music Studio',
        concept: 'Sinh viên',
        year: 'Kỉ niệm 2026'
    },
    {
        title: '🎸 Pop-Art năng động & Guitar',
        prompt: 'Poster Pop-Art tuổi trẻ năng động với đàn guitar acoustic, tai nghe DJ, đĩa than vinyl, dải sóng âm thanh và đường lượn sóng vàng-xanh-đỏ rực rỡ.',
        studio: 'Music Studio',
        concept: 'Sinh viên',
        year: 'Kỉ niệm 2026'
    },
    {
        title: '👑 Bìa tạp chí thời trang Vogue',
        prompt: 'Poster bìa tạp chí thời trang cao cấp Vogue High-Fashion, nhân vật chính tạo dáng thần thái cuốn hút, tiêu đề VOGUE in hoa sang trọng, mã vạch barcode và ảnh hậu trường.',
        studio: 'Vogue Studio',
        concept: 'Editorial Special',
        year: 'Special Edition'
    },
    {
        title: '🍂 Mùa thu lá vàng Seoul',
        prompt: 'Poster lãng mạn mùa thu Hàn Quốc với lá phong đỏ và lá ngân hạnh vàng bay bồng bềnh trong gió, tone màu latte ấm áp, cặp đôi quàng khăn len nụ cười hạnh phúc.',
        studio: 'Autumn Romance',
        concept: 'Mùa Thu Yêu Thương',
        year: 'Seoul 2026'
    },
    {
        title: '❄️ Mùa đông tuyết trắng cổ tích',
        prompt: 'Poster mùa đông tuyết trắng cổ tích, những hạt tuyết li ti bay mờ ảo, ánh đèn dây tóc fairy lights vàng ấm áp xua tan giá lạnh, cặp đôi ấm áp bên nhau.',
        studio: 'Winter Tale',
        concept: 'Tuyết Đầu Mùa',
        year: 'Winter 2026'
    }
];

export const PosterStudioPanel: React.FC<PosterStudioPanelProps> = ({
    onAiGeneratePoster,
    onGeneratePoster,
    isLoading,
    isDisabled,
    hasInputImage,
    inputCount,
    inputImages = [],
    onSwapInputs,
    onRemoveInput
}) => {
    // 1. Prompt state
    const [prompt, setPrompt] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY_POSTER_PROMPT) || QUICK_TOPIC_PRESETS[0].prompt;
        } catch {
            return QUICK_TOPIC_PRESETS[0].prompt;
        }
    });

    // 2. Aspect Ratio state (9:16 default, 16:9, 1:1)
    const [aspectRatio, setAspectRatio] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY_POSTER_RATIO) || '9:16';
        } catch {
            return '9:16';
        }
    });

    // 3. Branding text state
    const [branding, setBranding] = useState<{
        studioName: string;
        conceptName: string;
        yearTag: string;
        hotline: string;
    }>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_POSTER_BRANDING);
            if (raw) return JSON.parse(raw);
        } catch {}
        return {
            studioName: 'Music Studio',
            conceptName: 'Sinh viên',
            yearTag: 'Kỉ niệm 2026',
            hotline: '0342 733 640'
        };
    });

    // Auto-save settings
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_POSTER_PROMPT, prompt);
        } catch {}
    }, [prompt]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_POSTER_RATIO, aspectRatio);
        } catch {}
    }, [aspectRatio]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY_POSTER_BRANDING, JSON.stringify(branding));
        } catch {}
    }, [branding]);

    // Handle Quick Chip click
    const handleSelectPreset = (preset: typeof QUICK_TOPIC_PRESETS[0]) => {
        setPrompt(preset.prompt);
        setBranding((prev) => ({
            ...prev,
            studioName: preset.studio,
            conceptName: preset.concept,
            yearTag: preset.year
        }));
    };

    const handleTriggerAiGenerate = () => {
        if (isLoading || isDisabled || !hasInputImage || !prompt.trim()) return;
        onAiGeneratePoster(prompt.trim(), aspectRatio, branding);
    };

    return (
        <div className="flex flex-col gap-5 text-slate-800">
            {/* Header Badge */}
            <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-purple-50 p-4 rounded-2xl border border-violet-200/90 flex gap-3 shadow-xs ring-1 ring-violet-500/10">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm shadow-violet-500/25">
                    🎨
                </div>
                <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                        Studio Thiết Kế Poster AI (Generative Model)
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        AI tự động phân tích ảnh gốc & phối hợp bố cục đa tầng chân thực như ChatGPT (Nhận tối đa 10 ảnh tham chiếu).
                    </p>
                </div>
            </div>

            {/* Model Selector (Y chang các tính năng khác trong tool) */}
            <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Chọn Model Tạo Ảnh AI
                </label>
                <ModelSelector className="" imageCount={1} showResolution={true} />
            </div>

            {/* Input Status Banner (Tối đa 10 ảnh) */}
            <div className="bg-gradient-to-r from-violet-50 to-teal-50 border border-violet-200/90 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-800">
                        {inputCount > 0 ? (
                            <>
                                Đã nạp <span className="text-violet-700 font-extrabold">{inputCount}</span> ảnh đầu vào (Tối đa 10 ảnh)
                            </>
                        ) : (
                            <>Chưa nạp ảnh đầu vào (Tối đa 10 ảnh)</>
                        )}
                    </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-violet-700 bg-white px-2.5 py-0.5 rounded-md border border-violet-200">
                    {inputCount}/10 Slot
                </span>
            </div>

            {/* Khay Sắp Xếp Ảnh Đầu Vào (Để user biết ảnh nào là #1 Hero) */}
            {inputCount > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl ring-1 ring-slate-900/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🎞️</span>
                            <span>Khay Ảnh Tham Chiếu (Ảnh #1 được ưu tiên làm Hero)</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                        {inputImages.slice(0, 10).map((imgBase64, idx) => (
                            <div
                                key={idx}
                                className="flex-shrink-0 w-20 flex flex-col items-center bg-white p-1 rounded-xl ring-1 ring-slate-900/10 shadow-2xs group relative"
                            >
                                <div className="relative w-full h-16 rounded-lg overflow-hidden bg-slate-100 mb-1">
                                    <img
                                        src={imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}`}
                                        alt={`Slot ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-slate-900/80 text-white text-[9px] font-mono font-bold flex items-center justify-center rounded">
                                        #{idx + 1}
                                    </span>
                                    {onRemoveInput && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveInput(idx)}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            title="Xóa ảnh này"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <span className="text-[9px] font-medium text-slate-600 text-center truncate w-full px-0.5 mb-1">
                                    {idx === 0 ? '⭐ Hero Lớn' : `Phụ #${idx + 1}`}
                                </span>
                                {onSwapInputs && (
                                    <div className="flex items-center justify-between w-full px-0.5">
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => onSwapInputs(idx, idx - 1)}
                                            className="w-4 h-4 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-slate-100"
                                            title="Đổi sang trái"
                                        >
                                            ←
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === inputCount - 1}
                                            onClick={() => onSwapInputs(idx, idx + 1)}
                                            className="w-4 h-4 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center bg-slate-100"
                                            title="Đổi sang phải"
                                        >
                                            →
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Chủ Đề & Prompt Thiết Kế Poster */}
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Chủ Đề Poster (Prompt ngắn gọn)
                </label>

                {/* Quick Topic Presets */}
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                    {QUICK_TOPIC_PRESETS.map((p, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectPreset(p)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-900 text-[11px] font-semibold transition-all cursor-pointer"
                        >
                            {p.title}
                        </button>
                    ))}
                </div>

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Nhập mô tả poster mong muốn: Kỉ niệm sinh viên 2026, hoa phượng đỏ, dải ruy băng lụa đỏ, ngày cưới K-Drama..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all placeholder:text-slate-400"
                />
            </div>

            {/* 3. Tùy Chỉnh Chữ Trực Tiếp Cho AI Vẽ */}
            <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Thông Tin Chữ Trên Poster (AI Sẽ Nhúng Trực Tiếp Vào Tranh)
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Tên Tiêu Đề / Studio</span>
                        <input
                            type="text"
                            value={branding.studioName}
                            onChange={(e) => setBranding((prev) => ({ ...prev, studioName: e.target.value }))}
                            placeholder="Music Studio..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Niên khóa / Năm</span>
                        <input
                            type="text"
                            value={branding.yearTag}
                            onChange={(e) => setBranding((prev) => ({ ...prev, yearTag: e.target.value }))}
                            placeholder="Kỉ niệm 2026..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Concept / Tên Lớp (Chữ Thư Pháp)</span>
                        <input
                            type="text"
                            value={branding.conceptName}
                            onChange={(e) => setBranding((prev) => ({ ...prev, conceptName: e.target.value }))}
                            placeholder="Sinh viên / Tuổi Học Trò..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                    <div>
                        <span className="block text-[10px] font-semibold text-slate-600 mb-1">Số Hotline (Vẽ Thành Pill Kim Loại)</span>
                        <input
                            type="text"
                            value={branding.hotline}
                            onChange={(e) => setBranding((prev) => ({ ...prev, hotline: e.target.value }))}
                            placeholder="0342 733 640..."
                            className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 bg-white rounded-xl ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>
            </div>

            {/* 4. Chọn Tỷ Lệ Màn Hình */}
            <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    4. Tỷ Lệ Màn Hình
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                    {[
                        { id: '9:16', label: '📱 Khổ Dọc 9:16', desc: 'Story / TikTok' },
                        { id: '16:9', label: '🖥️ Khổ Ngang 16:9', desc: 'PC / Smart TV' },
                        { id: '1:1', label: '⬜ Khổ Vuông 1:1', desc: 'Post Facebook' }
                    ].map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => setAspectRatio(r.id)}
                            className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer ${
                                aspectRatio === r.id
                                    ? 'bg-white text-violet-700 shadow-2xs font-extrabold ring-1 ring-slate-900/5'
                                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                            }`}
                        >
                            <span className="block text-xs leading-tight">{r.label}</span>
                            <span className="block text-[9.5px] text-slate-400 mt-0.5">{r.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 5. Nút Bấm Thực Thi Tạo Poster AI */}
            <div className="space-y-2 pt-1">
                {!hasInputImage && (
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-medium ring-1 ring-amber-200/80 flex items-center gap-2">
                        <span>💡</span>
                        <span>Vui lòng tải lên từ 1 đến 10 ảnh ở khung bên trái để AI bắt đầu thiết kế.</span>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleTriggerAiGenerate}
                    disabled={isLoading || isDisabled || !hasInputImage || !prompt.trim()}
                    className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-sm ${
                        isLoading || isDisabled || !hasInputImage || !prompt.trim()
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 active:scale-[0.98] shadow-violet-500/30 cursor-pointer ring-1 ring-violet-500/20'
                    }`}
                >
                    <span>✨</span>
                    <span>
                        {isLoading
                            ? 'AI ĐANG THIẾT KẾ POSTER...'
                            : inputCount === 0
                            ? 'VUI LÒNG NẠP ẢNH ĐẦU VÀO'
                            : `TẠO POSTER THIẾT KẾ AI (${aspectRatio})`}
                    </span>
                </button>
            </div>
        </div>
    );
};
