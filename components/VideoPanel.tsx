import React, { useState, useEffect } from 'react';
import { VideoCameraIcon, SparklesIcon, ImageIcon } from './Icons';
import {
    checkVideoServerHealth,
    triggerFlowBrowserLogin,
    syncFlowCookiesRaw,
    getVideoServerUrl,
    setVideoServerUrl,
    getSavedUserFlowCookies,
    setSavedUserFlowCookies,
    getSavedUserFlowProjectId,
    setSavedUserFlowProjectId,
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
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    const [cookieInput, setCookieInput] = useState(() => getSavedUserFlowCookies());
    const [projectIdInput, setProjectIdInput] = useState(() => getSavedUserFlowProjectId());
    const [serverUrlInput, setServerUrlInput] = useState(() => getVideoServerUrl());
    const [isSyncingCookies, setIsSyncingCookies] = useState(false);
    const [configMessage, setConfigMessage] = useState<string | null>(null);

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
        const interval = setInterval(check, 6000);
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
            setTimeout(() => setIsTriggeringLogin(false), 1000);
        }
    };

    const handleSyncCookies = async () => {
        setIsSyncingCookies(true);
        setConfigMessage(null);
        try {
            if (serverUrlInput.trim()) {
                setVideoServerUrl(serverUrlInput.trim());
            }
            if (cookieInput.trim()) {
                await syncFlowCookiesRaw(cookieInput, projectIdInput);
                setConfigMessage('Đã lưu Cookie & kết nối tài khoản Google Flow thành công!');
            } else {
                setSavedUserFlowCookies('');
                setSavedUserFlowProjectId(projectIdInput);
                setConfigMessage('Đã lưu cấu hình kết nối!');
            }
            const health = await checkVideoServerHealth(true);
            setServerHealth(health);
            if (health.authenticated) {
                setTimeout(() => setShowConfigPanel(false), 900);
            }
        } catch (err: any) {
            console.error('[Cookie Sync Error]:', err);
            setConfigMessage(err?.message || 'Lỗi khi đồng bộ Cookie');
        } finally {
            setIsSyncingCookies(false);
        }
    };

    const handleClearUserCookies = async () => {
        setCookieInput('');
        setProjectIdInput('');
        setSavedUserFlowCookies('');
        setSavedUserFlowProjectId('');
        setConfigMessage('Đã xoá Cookie cá nhân — dùng tài khoản mặc định trên Server.');
        const health = await checkVideoServerHealth(true);
        setServerHealth(health);
    };

    const handleToggleConfig = async () => {
        const nextState = !showConfigPanel;
        setShowConfigPanel(nextState);
        setConfigMessage(null);
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
        <div className="flex flex-col gap-4 p-1 animate-fade-in">
            {/* Compact Header & Expandable Multi-User Account/Cookie Config */}
            <div className="bg-slate-50 p-3 rounded-xl ring-1 ring-slate-900/5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-xs">
                            <VideoCameraIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-900">Google Flow</span>
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-rose-600 text-white">
                                    Veo 3.1
                                </span>
                            </div>
                            {serverHealth.email && serverHealth.email !== 'Google Flow Active' && serverHealth.email !== 'Google Flow Connected' && (
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                                    {serverHealth.email}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {serverHealth.authenticated && typeof serverHealth.credits === 'number' && (
                            <span className="px-2 py-1 rounded-full bg-white ring-1 ring-slate-900/5 text-slate-800 font-semibold font-mono tabular-nums text-[11px]">
                                💳 {serverHealth.credits}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleToggleConfig}
                            title="Bấm để cấu hình tài khoản hoặc dán Cookie Google Flow riêng"
                            className="min-h-[32px] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/5 shadow-2xs hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    isCheckingServer
                                        ? 'bg-amber-400 animate-pulse'
                                        : serverHealth.online && serverHealth.authenticated
                                        ? 'bg-emerald-500'
                                        : serverHealth.online
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                }`}
                            />
                            <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                                {isCheckingServer
                                    ? 'Đang tải...'
                                    : !serverHealth.online
                                    ? 'Offline'
                                    : serverHealth.authenticated
                                    ? 'Đã kết nối'
                                    : 'Chưa đăng nhập'}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-0.5">{showConfigPanel ? '▲' : '⚙️'}</span>
                        </button>
                    </div>
                </div>

                {/* Quick Login Button when unauthenticated and panel is closed */}
                {serverHealth.online && !serverHealth.authenticated && !showConfigPanel && (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={handleLoginClick}
                            disabled={isTriggeringLogin}
                            className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                            <span>🌐</span>
                            <span>{isTriggeringLogin ? 'Đang mở...' : 'Mở Google Flow'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfigPanel(true)}
                            className="min-h-[40px] px-3 py-2 rounded-xl bg-white ring-1 ring-slate-900/10 hover:bg-slate-100 active:scale-[0.98] text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <span>🍪</span>
                            <span>Dán Cookie</span>
                        </button>
                    </div>
                )}

                {/* Expandable User Account & Cookie Config Panel */}
                {showConfigPanel && (
                    <div className="pt-2 border-t border-slate-200/70 flex flex-col gap-2.5 animate-fade-in">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleLoginClick}
                                disabled={isTriggeringLogin}
                                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                                <span>🌐</span>
                                <span>{isTriggeringLogin ? 'Đang mở Chrome...' : 'Đăng nhập Chrome'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleClearUserCookies}
                                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white ring-1 ring-slate-900/10 hover:bg-slate-100 active:scale-[0.98] text-slate-700 text-[11px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <span>🔄</span>
                                <span>Dùng TK Server</span>
                            </button>
                        </div>

                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                                Cookie Google Flow cá nhân (JSON hoặc Header)
                            </label>
                            <textarea
                                value={cookieInput}
                                onChange={(e) => setCookieInput(e.target.value)}
                                placeholder="Dán JSON Cookie từ Cookie-Editor (flow.google.com / .google.com) hoặc để trống để dùng tài khoản Server..."
                                rows={3}
                                className="w-full bg-white ring-1 ring-slate-900/10 rounded-lg p-2 text-slate-800 text-[11px] font-mono leading-relaxed focus:ring-2 focus:ring-rose-500/30 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                                    Project ID (Tuỳ chọn)
                                </label>
                                <input
                                    type="text"
                                    value={projectIdInput}
                                    onChange={(e) => setProjectIdInput(e.target.value)}
                                    placeholder="Tự động nhận"
                                    className="w-full bg-white ring-1 ring-slate-900/10 rounded-lg px-2.5 py-1.5 text-slate-800 text-[11px] font-mono focus:ring-2 focus:ring-rose-500/30 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                                    Server Flow URL
                                </label>
                                <input
                                    type="text"
                                    value={serverUrlInput}
                                    onChange={(e) => setServerUrlInput(e.target.value)}
                                    placeholder="http://localhost:8100"
                                    className="w-full bg-white ring-1 ring-slate-900/10 rounded-lg px-2.5 py-1.5 text-slate-800 text-[11px] font-mono focus:ring-2 focus:ring-rose-500/30 outline-none"
                                />
                            </div>
                        </div>

                        {configMessage && (
                            <div className="text-[11px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-500/20 rounded-lg px-2.5 py-1.5">
                                {configMessage}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleSyncCookies}
                            disabled={isSyncingCookies}
                            className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                        >
                            {isSyncingCookies ? 'Đang kết nối...' : 'Lưu & Xác nhận kết nối'}
                        </button>
                    </div>
                )}
            </div>

            {/* Sub-mode Segmented Tabs */}
            <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Chế độ
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

            {/* Compact Image Preview when in Image-to-Video mode */}
            {isImageMode && hasInputImage && inputImagePreview && (
                <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-900/5 flex items-center gap-2.5">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-900/10">
                        <img
                            src={inputImagePreview.startsWith('data:') ? inputImagePreview : `data:image/png;base64,${inputImagePreview}`}
                            alt="Input preview"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 truncate">Đã chọn ảnh gốc</span>
                </div>
            )}

            {/* Prompt Textarea */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {isImageMode ? 'Mô tả chuyển động' : 'Nội dung video'}
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {prompt.length}
                    </span>
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={isImageMode ? 'Nhập chuyển động mong muốn...' : 'Nhập mô tả cảnh quay...'}
                    rows={3}
                    className="w-full bg-slate-50 ring-1 ring-slate-900/10 rounded-xl p-3 text-slate-900 text-sm leading-relaxed focus:bg-white focus:ring-2 focus:ring-rose-500/30 outline-none transition-all placeholder:text-slate-400"
                />

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {PROMPT_PRESETS[subMode].map((preset, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setPrompt(preset)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-900/5 rounded-lg hover:ring-rose-300 hover:text-rose-700 hover:bg-rose-50/50 transition-all text-left cursor-pointer"
                        >
                            {preset.length > 42 ? preset.substring(0, 42) + '...' : preset}
                        </button>
                    ))}
                </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Tỷ lệ khung hình
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setAspectRatio('16:9')}
                        className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            aspectRatio === '16:9'
                                ? 'bg-rose-50/70 text-rose-700 ring-2 ring-rose-500/40 shadow-xs'
                                : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <span className="font-mono tabular-nums">16:9</span>
                        <span>Ngang</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setAspectRatio('9:16')}
                        className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            aspectRatio === '9:16'
                                ? 'bg-rose-50/70 text-rose-700 ring-2 ring-rose-500/40 shadow-xs'
                                : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        <span className="font-mono tabular-nums">9:16</span>
                        <span>Dọc</span>
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
                        <span>Đang tạo video...</span>
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <VideoCameraIcon className="w-5 h-5" />
                        <span>TẠO VIDEO (VEO 3.1)</span>
                    </span>
                )}
            </button>
        </div>
    );
};
