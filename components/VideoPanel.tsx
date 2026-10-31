import React, { useState, useEffect } from 'react';
import { VideoCameraIcon, SparklesIcon, ImageIcon } from './Icons';
import {
    checkVideoServerHealth,
    triggerFlowBrowserLogin,
    VideoServerHealth,
} from '../services/geminiVideoService';

export interface VideoPanelProps {
    subMode: 'text_to_video' | 'image_to_video';
    onSubModeChange: (subMode: 'text_to_video' | 'image_to_video') => void;
    onGenerate: (prompt: string, aspectRatio: '16:9' | '9:16', subMode: 'text_to_video' | 'image_to_video') => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputImagePreview?: string;
}

const PROMPT_PRESETS = {
    text_to_video: [
        'Cyberpunk Tokyo lúc mưa đêm, ánh đèn neon phản chiếu trên mặt đường ướt, cinematic 4k',
        'Góc quay flycam lướt qua bãi biển cát trắng nước ngọc bích lúc hoàng hôn rực rỡ',
        'Một chú cún Golden Retriever nô đùa trên cánh đồng hoa hướng dương ngập tràn ánh nắng',
        'Cận cảnh chú mèo con đáng yêu đang tò mò mở mắt, ánh sáng mềm mại',
    ],
    image_to_video: [
        'Camera từ từ zoom chậm vào chủ thể, gió thổi nhẹ làm tóc và tà áo lay động tự nhiên',
        'Ánh sáng mặt trời chuyển động nhẹ qua khuôn mặt, đôi mắt khẽ chớp và nở nụ cười hiền',
        'Mặt nước gợn sóng lấp lánh, mây trên bầu trời trôi êm đềm về phía chân trời',
        'Chuyển động cinematic slow-motion 60fps, hạt bụi li ti phát sáng trong không gian',
    ]
};

export const VideoPanel: React.FC<VideoPanelProps> = ({
    subMode,
    onSubModeChange,
    onGenerate,
    isLoading,
    isDisabled,
    hasInputImage,
    inputImagePreview,
}) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [serverHealth, setServerHealth] = useState<VideoServerHealth>({ online: false });
    const [isCheckingServer, setIsCheckingServer] = useState(true);
    const [isTriggeringLogin, setIsTriggeringLogin] = useState(false);

    // Kiểm tra trạng thái server Google Flow AI (flow-py-main)
    useEffect(() => {
        let mounted = true;
        const check = async () => {
            const health = await checkVideoServerHealth();
            if (mounted) {
                setServerHealth(health);
                setIsCheckingServer(false);
            }
        };
        check();
        const interval = setInterval(check, 8000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const handleLoginClick = async () => {
        setIsTriggeringLogin(true);
        try {
            await triggerFlowBrowserLogin();
            const health = await checkVideoServerHealth(true);
            setServerHealth(health);
        } catch (err) {
            console.error('[Flow Login Error]:', err);
        } finally {
            setIsTriggeringLogin(false);
        }
    };

    const handleRefreshAuth = async () => {
        setIsCheckingServer(true);
        try {
            const health = await checkVideoServerHealth(true);
            setServerHealth(health);
        } finally {
            setIsCheckingServer(false);
        }
    };

    const isImageMode = subMode === 'image_to_video';
    const canSubmit = !isLoading && !isDisabled && prompt.trim().length > 0 && (!isImageMode || hasInputImage);

    return (
        <div className="flex flex-col gap-5 p-1 animate-fade-in">
            {/* Header Badge & Google Flow Status */}
            <div className="bg-slate-50/90 p-4 rounded-2xl ring-1 ring-slate-900/5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-sm ring-1 ring-rose-500/20">
                            <VideoCameraIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-900 leading-tight">Google Flow Studio</h3>
                                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-rose-600 text-white">
                                    Veo 3.1
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                Tạo video điện ảnh qua engine <code className="font-mono text-[11px] text-slate-700">flow-py</code>
                            </p>
                        </div>
                    </div>

                    {/* Server Status Indicator */}
                    <button
                        type="button"
                        onClick={handleRefreshAuth}
                        title="Bấm để kiểm tra lại kết nối"
                        className="min-h-[32px] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/5 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                        <span
                            className={`w-2 h-2 rounded-full ${
                                isCheckingServer
                                    ? 'bg-amber-400 animate-pulse'
                                    : serverHealth.online && serverHealth.authenticated
                                    ? 'bg-emerald-500 animate-pulse'
                                    : serverHealth.online
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                            }`}
                        />
                        <span className="text-[11px] font-semibold text-slate-700 tabular-nums font-mono">
                            {isCheckingServer
                                ? 'Đang kiểm tra...'
                                : !serverHealth.online
                                ? 'Offline'
                                : serverHealth.authenticated
                                ? 'Đã kết nối'
                                : 'Chưa đăng nhập'}
                        </span>
                    </button>
                </div>

                {/* Credits & Account Bar when authenticated */}
                {serverHealth.online && serverHealth.authenticated && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-slate-600 truncate font-medium">
                                {serverHealth.email || 'Tài khoản Google Flow đã sẵn sàng'}
                            </span>
                        </div>
                        {typeof serverHealth.credits === 'number' && (
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-white ring-1 ring-slate-900/5 text-slate-800 font-semibold font-mono tabular-nums text-[11px]">
                                💳 {serverHealth.credits} credits
                            </span>
                        )}
                    </div>
                )}

                {/* Login CTA when server is online but browser profile is not logged into Google Flow */}
                {serverHealth.online && !serverHealth.authenticated && !isCheckingServer && (
                    <div className="mt-3 p-3 rounded-xl bg-white ring-1 ring-amber-500/20 shadow-xs space-y-2.5">
                        <div className="flex items-start gap-2 text-xs text-slate-700">
                            <span className="text-base leading-none">🔐</span>
                            <div className="space-y-0.5">
                                <p className="font-semibold text-slate-900 leading-tight">
                                    Đăng nhập Google Flow (Labs) 1 lần duy nhất
                                </p>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Dự án <code className="font-mono">flow-py-main</code> sử dụng Google Labs Flow để vượt reCAPTCHA và không bị Gemini chặn nhân vật. Hãy bấm nút dưới để đăng nhập Google trên cửa sổ trình duyệt.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleLoginClick}
                            disabled={isTriggeringLogin || serverHealth.loginInProgress}
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            <span>🌐</span>
                            <span>
                                {isTriggeringLogin || serverHealth.loginInProgress
                                    ? 'Đang chờ đăng nhập trên cửa sổ Chrome...'
                                    : 'Mở trình duyệt Đăng nhập Google Flow'}
                            </span>
                        </button>
                    </div>
                )}

                {/* Offline Warning */}
                {!serverHealth.online && !isCheckingServer && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50/90 ring-1 ring-amber-500/20 text-xs text-amber-900 flex items-start gap-2">
                        <span className="text-base leading-none">💡</span>
                        <div className="space-y-0.5">
                            <p className="font-semibold">Server Flow (Port 8100) chưa bật.</p>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                                Chạy <code className="font-mono">python server.py</code> trong thư mục <code className="font-mono">flow-py-main</code> để kích hoạt.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sub-mode Segmented Tabs */}
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Chế độ tạo video
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl ring-1 ring-slate-900/5">
                    <button
                        type="button"
                        onClick={() => onSubModeChange('text_to_video')}
                        className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                            subMode === 'text_to_video'
                                ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>Văn bản ➔ Video</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onSubModeChange('image_to_video')}
                        className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                            subMode === 'image_to_video'
                                ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <ImageIcon className="w-4 h-4" />
                        <span>Ảnh ➔ Video</span>
                    </button>
                </div>
            </div>

            {/* Image Preview / Reminder for Image-to-Video Mode */}
            {isImageMode && (
                <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-900/5 flex items-center gap-3">
                    {hasInputImage && inputImagePreview ? (
                        <>
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-900/10 shadow-xs">
                                <img
                                    src={inputImagePreview.startsWith('data:') ? inputImagePreview : `data:image/png;base64,${inputImagePreview}`}
                                    alt="Input preview"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-900 leading-tight">Ảnh gốc đã sẵn sàng</p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">Google Flow (Frames) sẽ tạo chuyển động từ ảnh này</p>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-start gap-2.5 text-xs text-slate-600">
                            <span className="text-base text-rose-500">📸</span>
                            <div>
                                <p className="font-semibold text-slate-900 leading-tight">Chưa có ảnh đầu vào</p>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                    Vui lòng tải lên 1 ảnh ở khung <strong>Ảnh gốc cần tạo video chuyển động</strong> phía trên trước khi bấm tạo.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Prompt Textarea */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {isImageMode ? 'Mô tả chuyển động cho ảnh' : 'Kịch bản / Nội dung video'}
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {prompt.length} ký tự
                    </span>
                </div>
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={
                            isImageMode
                                ? 'Mô tả chi tiết chuyển động mong muốn (VD: Camera zoom chậm, tóc và tà áo bay nhẹ theo gió, ánh mắt chớp nhẹ tự nhiên...)'
                                : 'Mô tả cảnh quay bạn muốn tạo (VD: Một phi thuyền không gian bay qua vành đai sao Thổ, cinematic 4k, hyper-realistic...)'
                        }
                        rows={3}
                        className="w-full bg-slate-50 ring-1 ring-slate-900/10 rounded-xl p-3 text-slate-900 text-sm leading-relaxed focus:bg-white focus:ring-2 focus:ring-rose-500/30 outline-none transition-all placeholder:text-slate-400"
                    />
                </div>

                {/* Preset Chips */}
                <div className="mt-2.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Gợi ý nhanh:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {PROMPT_PRESETS[subMode].map((preset, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setPrompt(preset)}
                                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-900/5 rounded-lg hover:ring-rose-300 hover:text-rose-700 hover:bg-rose-50/50 transition-all text-left cursor-pointer"
                            >
                                {preset.length > 45 ? preset.substring(0, 45) + '...' : preset}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Tỷ lệ khung hình
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setAspectRatio('16:9')}
                        className={`min-h-[44px] flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            aspectRatio === '16:9'
                                ? 'bg-rose-50/70 text-rose-700 ring-2 ring-rose-500/40 shadow-xs'
                                : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <div className="w-5 h-3.5 border-2 border-current rounded-xs flex items-center justify-center text-[8px] font-mono tabular-nums">
                            16:9
                        </div>
                        <span>Ngang (16:9) • YouTube</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setAspectRatio('9:16')}
                        className={`min-h-[44px] flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            aspectRatio === '9:16'
                                ? 'bg-rose-50/70 text-rose-700 ring-2 ring-rose-500/40 shadow-xs'
                                : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <div className="w-3.5 h-5 border-2 border-current rounded-xs flex items-center justify-center text-[8px] font-mono tabular-nums">
                            9:16
                        </div>
                        <span>Dọc (9:16) • TikTok, Reels</span>
                    </button>
                </div>
            </div>

            {/* Submit Action Button */}
            <button
                type="button"
                onClick={() => onGenerate(prompt, aspectRatio, subMode)}
                disabled={!canSubmit}
                className="w-full min-h-[48px] mt-1 px-6 py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-semibold text-sm tracking-wide rounded-xl shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 focus:ring-2 focus:ring-rose-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] cursor-pointer"
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang xử lý trên Google Flow...</span>
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <VideoCameraIcon className="w-5 h-5" />
                        <span>BẮT ĐẦU TẠO VIDEO (FLOW VEO 3.1)</span>
                    </span>
                )}
            </button>
        </div>
    );
};
