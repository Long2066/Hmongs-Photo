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
    getFlowAccountsPool,
    addAccountToFlowPool,
    snapshotCurrentBrowserToFlowPool,
    removeAccountFromFlowPool,
    FlowPoolAccount,
    VideoServerHealth,
    getVideoEngine,
    setVideoEngine,
    VideoEngine,
    checkFlowExtensionInstalled,
    triggerExtensionLogin,
} from '../services/geminiVideoService';

import {
    getFalApiKey,
    setFalApiKey,
    getSavedFalModel,
    setSavedFalModel,
    checkFalUser,
    FAL_MODELS,
    FalUserInfo,
} from '../services/falVideoService';

import {
    getSiliconFlowApiKey,
    setSiliconFlowApiKey,
    getSavedSiliconModel,
    setSavedSiliconModel,
    checkSiliconFlowUser,
    SILICON_MODELS,
    SiliconUserInfo,
} from '../services/siliconVideoService';

export interface VideoPanelProps {
    subMode: 'text_to_video' | 'image_to_video';
    onSubModeChange: (subMode: 'text_to_video' | 'image_to_video') => void;
    onGenerate: (
        prompt: string,
        aspectRatio: '16:9' | '9:16',
        subMode: 'text_to_video' | 'image_to_video',
        model: string,
        outputCount: number
    ) => void;
    isLoading: boolean;
    isDisabled: boolean;
    hasInputImage: boolean;
    inputImagePreview?: string;
}

const FLOW_MODEL_OPTIONS = [
    { id: 'Veo 3.1 - Lite', label: 'Veo 3.1 Lite', badge: 'Khuyên dùng' },
    { id: 'Veo 3.1 - Fast', label: 'Veo 3.1 Fast', badge: 'Xử lý nhanh' },
    { id: 'Omni 1.1 Flash', label: 'Omni 1.1 Flash', badge: 'Tối đa 10s' },
];

const PROMPT_PRESETS = {
    text_to_video: [
        'Cyberpunk Tokyo lúc mưa đêm, ánh đèn neon phản chiếu trên mặt đường ướt, cinematic 4k',
        'Góc quay flycam lướt qua bãi biển cát trắng nước ngọc bích lúc hoàng hôn rực rỡ',
        'Một chú cún Golden Retriever nô đùa trên cánh đồng hoa hướng dương ngập tràn ánh nắng',
        'Cận cảnh chú mèo con đáng yêu đang tò mò mở mắt, ánh sáng mềm mại',
    ],
    image_to_video: [
        'Quay toàn cảnh góc rộng thấy rõ và giữ trọn vẹn cả 2 nhân vật chàng trai và cô gái bên nhau trong suốt video, không cắt góc. Gió thổi nhẹ làm tóc và tà áo lay động tự nhiên, nụ cười rạng rỡ',
        'Toàn cảnh điện ảnh cinematic góc rộng bao quát cả hai nhân vật và cảnh đẹp núi đồi phía sau, camera chuyển động chậm rãi êm dịu',
        'Ánh sáng hoàng hôn ấm áp chiếu qua, cả hai nhân vật mỉm cười tự nhiên, tà áo khẽ bay trong gió nhẹ',
        'Chuyển động cinematic slow-motion 60fps mượt mà, giữ trọn vẹn mọi nhân vật trong ảnh gốc, màu sắc rực rỡ sắc nét',
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
    // Engine State: 'flow_extension' (Default Bridge) vs 'fal_ai' vs 'flow_local' vs 'siliconflow'
    const [engine, setEngineState] = useState<VideoEngine>(() => getVideoEngine());

    // Extension Specific State
    const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(false);
    const [showExtensionGuide, setShowExtensionGuide] = useState<boolean>(false);

    // Common Video States
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [isLandscapeImage, setIsLandscapeImage] = useState<boolean>(false);
    const [outputCount, setOutputCount] = useState<number>(1);
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    const [configMessage, setConfigMessage] = useState<string | null>(null);
    const [configMessageType, setConfigMessageType] = useState<'success' | 'error' | null>(null);

    // Fal.ai Specific State
    const [falApiKey, setFalApiKeyState] = useState(() => getFalApiKey());
    const [falModel, setFalModelState] = useState(() => getSavedFalModel());
    const [falUserInfo, setFalUserInfo] = useState<FalUserInfo | null>(null);
    const [isCheckingFal, setIsCheckingFal] = useState(false);
    const [showFalKeyText, setShowFalKeyText] = useState(false);

    // SiliconFlow Specific State
    const [siliconApiKey, setSiliconApiKeyState] = useState(() => getSiliconFlowApiKey());
    const [siliconModel, setSiliconModelState] = useState(() => getSavedSiliconModel());
    const [siliconUserInfo, setSiliconUserInfo] = useState<SiliconUserInfo | null>(null);
    const [isCheckingSilicon, setIsCheckingSilicon] = useState(false);
    const [showSiliconKeyText, setShowSiliconKeyText] = useState(false);

    // Google Flow Specific State
    const [selectedFlowModel, setSelectedFlowModel] = useState<string>('Veo 3.1 - Lite');
    const [serverHealth, setServerHealth] = useState<VideoServerHealth>({ online: false });
    const [isCheckingServer, setIsCheckingServer] = useState(false);
    const [isTriggeringLogin, setIsTriggeringLogin] = useState(false);
    const [accountLabelInput, setAccountLabelInput] = useState('');
    const [cookieInput, setCookieInput] = useState(() => getSavedUserFlowCookies());
    const [projectIdInput, setProjectIdInput] = useState(() => getSavedUserFlowProjectId());
    const [serverUrlInput, setServerUrlInput] = useState(() => getVideoServerUrl());
    const [poolAccounts, setPoolAccounts] = useState<FlowPoolAccount[]>([]);
    const [isSyncingCookies, setIsSyncingCookies] = useState(false);

    const handleSwitchEngine = (newEngine: VideoEngine) => {
        setEngineState(newEngine);
        setVideoEngine(newEngine);
        setConfigMessage(null);
        setConfigMessageType(null);
    };

    // Extension detection
    useEffect(() => {
        let mounted = true;
        const detectExtension = async () => {
            const installed = await checkFlowExtensionInstalled();
            if (mounted) setIsExtensionInstalled(installed);
        };
        detectExtension();

        const messageHandler = (e: MessageEvent) => {
            if (e.data?.type === 'FLOW_BRIDGE_PONG') {
                if (mounted) setIsExtensionInstalled(true);
            }
        };
        window.addEventListener('message', messageHandler);
        return () => {
            mounted = false;
            window.removeEventListener('message', messageHandler);
        };
    }, []);

    // Refresh Fal.ai status
    const refreshFalStatus = async (keyOverride?: string) => {
        setIsCheckingFal(true);
        const res = await checkFalUser(keyOverride);
        setFalUserInfo(res);
        setIsCheckingFal(false);
    };

    // Refresh SiliconFlow user status
    const refreshSiliconStatus = async (keyOverride?: string) => {
        setIsCheckingSilicon(true);
        const res = await checkSiliconFlowUser(keyOverride);
        setSiliconUserInfo(res);
        setIsCheckingSilicon(false);
    };

    // Initial check on mount
    useEffect(() => {
        if (engine === 'fal_ai' && getFalApiKey()) {
            refreshFalStatus();
        } else if (engine === 'siliconflow' && getSiliconFlowApiKey()) {
            refreshSiliconStatus();
        } else if (engine === 'flow_local') {
            checkLocalServer();
            refreshPool();
        }
    }, [engine]);

    const checkLocalServer = async () => {
        setIsCheckingServer(true);
        const health = await checkVideoServerHealth();
        setServerHealth(health);
        setIsCheckingServer(false);
    };

    const refreshPool = async () => {
        const list = await getFlowAccountsPool();
        setPoolAccounts(list);
    };

    // Auto-detect image aspect ratio from uploaded preview
    useEffect(() => {
        if (!inputImagePreview) {
            setIsLandscapeImage(false);
            return;
        }
        const src = inputImagePreview.startsWith('data:')
            ? inputImagePreview
            : `data:image/png;base64,${inputImagePreview}`;
        const img = new Image();
        img.onload = () => {
            const isLandscape = img.naturalWidth > img.naturalHeight;
            setIsLandscapeImage(isLandscape);
            if (isLandscape) {
                setAspectRatio('16:9');
            } else if (img.naturalHeight > img.naturalWidth) {
                setAspectRatio('9:16');
            }
        };
        img.src = src;
    }, [inputImagePreview]);

    // Handle saving Fal.ai API Key
    const handleSaveFalApiKey = async () => {
        if (!falApiKey.trim()) {
            setFalApiKey('');
            setFalUserInfo(null);
            setConfigMessageType('error');
            setConfigMessage('Đã xoá API Key Fal.ai.');
            return;
        }
        setFalApiKey(falApiKey.trim());
        setIsCheckingFal(true);
        const info = await checkFalUser(falApiKey.trim());
        setFalUserInfo(info);
        setIsCheckingFal(false);
        if (info.ok) {
            setConfigMessageType('success');
            setConfigMessage('Đã kết nối tài khoản Fal.ai Cloud thành công!');
        } else {
            setConfigMessageType('error');
            setConfigMessage(info.error || 'API Key Fal.ai không hợp lệ. Vui lòng kiểm tra lại!');
        }
    };

    // Handle saving SiliconFlow API Key
    const handleSaveSiliconApiKey = async () => {
        if (!siliconApiKey.trim()) {
            setSiliconFlowApiKey('');
            setSiliconUserInfo(null);
            setConfigMessageType('error');
            setConfigMessage('Đã xoá API Key SiliconFlow.');
            return;
        }
        setSiliconFlowApiKey(siliconApiKey.trim());
        setIsCheckingSilicon(true);
        const info = await checkSiliconFlowUser(siliconApiKey.trim());
        setSiliconUserInfo(info);
        setIsCheckingSilicon(false);
        if (info.ok) {
            setConfigMessageType('success');
            setConfigMessage(`Đã kết nối tài khoản SiliconFlow (${info.name || 'Thành công'})! Số dư: ${info.balance}`);
        } else {
            setConfigMessageType('error');
            setConfigMessage(info.error || 'API Key không hợp lệ. Vui lòng kiểm tra lại!');
        }
    };

    const handleSelectFalModel = (modelId: string) => {
        setFalModelState(modelId);
        setSavedFalModel(modelId);
    };

    const handleSelectSiliconModel = (modelId: string) => {
        setSiliconModelState(modelId);
        setSavedSiliconModel(modelId);
    };

    // Google Flow handlers
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

    const handleSnapshotBrowserToPool = async () => {
        setIsSyncingCookies(true);
        setConfigMessage(null);
        setConfigMessageType(null);
        try {
            const res = await snapshotCurrentBrowserToFlowPool(accountLabelInput);
            setAccountLabelInput('');
            await refreshPool();
            setConfigMessageType('success');
            setConfigMessage(`Đã lưu "${res.label}" vào Hồ sơ xoay vòng (${res.count} tài khoản)!`);
            const health = await checkVideoServerHealth(true);
            setServerHealth(health);
        } catch (err: any) {
            setConfigMessageType('error');
            setConfigMessage(err?.message || 'Trình duyệt Chrome chưa đăng nhập Google Flow hoặc phiên đã hết hạn.');
        } finally {
            setIsSyncingCookies(false);
        }
    };

    const handleAddCookieToPool = async () => {
        if (!cookieInput.trim()) {
            setConfigMessageType('error');
            setConfigMessage('Vui lòng dán Cookie JSON từ Cookie-Editor trước khi thêm vào Hồ sơ.');
            return;
        }
        setIsSyncingCookies(true);
        setConfigMessage(null);
        setConfigMessageType(null);
        try {
            const label = accountLabelInput.trim() || `Nick Google #${poolAccounts.length + 1}`;
            const res = await addAccountToFlowPool(label, cookieInput, projectIdInput);
            setAccountLabelInput('');
            setCookieInput('');
            await refreshPool();
            setConfigMessageType('success');
            setConfigMessage(`Đã thêm "${res.label}" vào Hồ sơ xoay vòng (${res.count} tài khoản)!`);
            const health = await checkVideoServerHealth(true);
            setServerHealth(health);
        } catch (err: any) {
            setConfigMessageType('error');
            setConfigMessage(err?.message || 'Lỗi khi thêm nick vào Hồ sơ');
        } finally {
            setIsSyncingCookies(false);
        }
    };

    const handleSyncCookies = async () => {
        setIsSyncingCookies(true);
        setConfigMessage(null);
        setConfigMessageType(null);
        try {
            if (serverUrlInput.trim()) {
                setVideoServerUrl(serverUrlInput.trim());
            }
            if (cookieInput.trim()) {
                const res = await syncFlowCookiesRaw(cookieInput, projectIdInput);
                if (res?.authenticated) {
                    setConfigMessageType('success');
                    setConfigMessage(`Đã kết nối tài khoản Google Flow (${res.email || 'Thành công'})!`);
                } else {
                    setConfigMessageType('error');
                    setConfigMessage(
                        res?.error ||
                        'Google từ chối Cookie này (phiên hết hạn hoặc cần đăng nhập trực tiếp trên Chrome). Vui lòng dùng nút "Mở cửa sổ Chrome đăng nhập Google" ở trên!'
                    );
                }
            } else {
                setSavedUserFlowCookies('');
                setSavedUserFlowProjectId(projectIdInput);
                setConfigMessageType('success');
                setConfigMessage('Đã lưu cấu hình kết nối!');
            }
            const health = await checkVideoServerHealth(true);
            setServerHealth(health);
        } catch (err: any) {
            console.error('[Cookie Sync Error]:', err);
            setConfigMessageType('error');
            setConfigMessage(err?.message || 'Lỗi khi đồng bộ Cookie');
        } finally {
            setIsSyncingCookies(false);
        }
    };

    const isImageMode = subMode === 'image_to_video';
    const isExtensionMode = engine === 'flow_extension';
    const isFalMode = engine === 'fal_ai';
    const isSiliconMode = engine === 'siliconflow';

    const canSubmit = !isLoading && !isDisabled && prompt.trim().length > 0 && (!isImageMode || hasInputImage);

    const handleExecuteGenerate = () => {
        const activeModel = isExtensionMode
            ? selectedFlowModel
            : isFalMode
            ? falModel
            : isSiliconMode
            ? siliconModel
            : selectedFlowModel;
        onGenerate(prompt, aspectRatio, subMode, activeModel, outputCount);
    };

    return (
        <div className="flex flex-col gap-4 p-1 animate-fade-in">
            {/* Engine Segmented Bar: Extension (Default) vs Fal.ai vs Local Server vs SiliconFlow */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Động cơ tạo video
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                        {isExtensionMode
                            ? 'Google Veo 3.1 • Acc Cá Nhân • 0đ Vĩnh Viễn'
                            : isFalMode
                            ? 'Cloud API • Google 1-Click'
                            : isSiliconMode
                            ? 'SiliconFlow Cloud'
                            : 'Server Máy Tính (Cổng 8100)'}
                    </span>
                </div>
                <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl ring-1 ring-slate-900/5">
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_extension')}
                        className={`min-h-[42px] flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            isExtensionMode
                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>🧩</span>
                        <span className="truncate">Google Flow (Extension)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('fal_ai')}
                        className={`min-h-[42px] flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            isFalMode
                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>🚀</span>
                        <span className="truncate">Fal.ai Cloud</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchEngine('flow_local')}
                        className={`min-h-[42px] flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            engine === 'flow_local'
                                ? 'bg-white text-rose-700 shadow-xs ring-1 ring-slate-900/5'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span>💻</span>
                        <span className="truncate">Server PC (.vbs)</span>
                    </button>
                </div>
            </div>

            {/* GOOGLE FLOW CHROME EXTENSION CARD (DEFAULT & MOST POWERFUL) */}
            {isExtensionMode && (
                <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/50 p-3 rounded-xl ring-1 ring-indigo-500/15 flex flex-col gap-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
                                <span>🧩</span>
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-900">Google Flow Bridge</span>
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-indigo-600 text-white">
                                        Veo 3.1
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    Dùng tài khoản Google cá nhân của bạn • Miễn phí 100%
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setShowExtensionGuide(!showExtensionGuide)}
                                className="min-h-[32px] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/5 shadow-2xs hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        isExtensionInstalled ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                    }`}
                                />
                                <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                                    {isExtensionInstalled ? 'Đã kết nối Tiện ích' : 'Cài đặt Tiện ích'}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-0.5">{showExtensionGuide ? '▲' : '⚙️'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Extension Setup Guide Alert (shown if not installed or clicked) */}
                    {(!isExtensionInstalled || showExtensionGuide) && (
                        <div className="pt-2 border-t border-indigo-200/50 flex flex-col gap-2 animate-fade-in">
                            <div className="p-3 rounded-xl bg-white ring-1 ring-slate-900/5 flex flex-col gap-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <span>🛠️</span>
                                        <span>Hướng dẫn cài đặt Tiện ích Chrome (1 lần duy nhất trong 10s)</span>
                                    </span>
                                    {isExtensionInstalled && (
                                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            ✓ Đã cài đặt
                                        </span>
                                    )}
                                </div>

                                <div className="text-[11px] text-slate-600 leading-relaxed space-y-1">
                                    <div><b>1.</b> Mở trình duyệt Chrome, gõ vào thanh địa chỉ: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-700 select-all">chrome://extensions</code></div>
                                    <div><b>2.</b> Bật công tắc <b>"Chế độ dành cho nhà phát triển" (Developer mode)</b> ở góc trên cùng bên phải.</div>
                                    <div><b>3.</b> Bấm nút <b>"Tải tiện ích đã giải nén" (Load unpacked)</b>.</div>
                                    <div><b>4.</b> Chọn thư mục: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-700 select-all">D:\ToolMedia\extension-flow-bridge</code> là xong!</div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={triggerExtensionLogin}
                                        className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <span>🌐</span>
                                        <span>Đăng nhập Google Flow</span>
                                    </button>
                                    <a
                                        href="https://flow.google.com/project/dadaf5cb-2bbf-4c4b-b622-014e2a6cda1b/tool/b18b72cc-9dc1-4560-bf52-70266e226a18?mode=APP"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <span>🚀</span>
                                        <span>Mở Tool trên Flow ↗</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* FAL.AI CLOUD CARD */}
            {isFalMode && (
                <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/50 p-3 rounded-xl ring-1 ring-indigo-500/15 flex flex-col gap-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
                                <span>🚀</span>
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-900">Fal.ai Cloud</span>
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-indigo-600 text-white">
                                        Google 1-Click
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    Không cần xác minh danh tính • LTX-Video siêu tốc 5s
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setShowConfigPanel(!showConfigPanel)}
                                className="min-h-[32px] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-900/5 shadow-2xs hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        isCheckingFal
                                            ? 'bg-amber-400 animate-pulse'
                                            : falUserInfo?.ok
                                            ? 'bg-emerald-500'
                                            : falApiKey.trim()
                                            ? 'bg-indigo-500'
                                            : 'bg-amber-500'
                                    }`}
                                />
                                <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                                    {isCheckingFal
                                        ? 'Kiểm tra...'
                                        : falUserInfo?.ok
                                        ? 'Đã kết nối'
                                        : falApiKey.trim()
                                        ? 'Đã có Key'
                                        : 'Nhập Key'}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-0.5">{showConfigPanel ? '▲' : '⚙️'}</span>
                            </button>
                        </div>
                    </div>

                    {showConfigPanel && (
                        <div className="pt-2 border-t border-indigo-200/50 flex flex-col gap-2 animate-fade-in">
                            <div className="p-2.5 rounded-xl bg-white ring-1 ring-slate-900/5 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-semibold text-slate-800">
                                        API Key Fal.ai
                                    </label>
                                    <a
                                        href="https://fal.ai/dashboard/keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                                    >
                                        Lấy Key qua Google (1-Click) ↗
                                    </a>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type={showFalKeyText ? 'text' : 'password'}
                                        value={falApiKey}
                                        onChange={(e) => setFalApiKeyState(e.target.value)}
                                        placeholder="Dán Key từ fal.ai/dashboard/keys..."
                                        className="flex-1 bg-slate-50 ring-1 ring-slate-900/10 rounded-lg px-2.5 py-1.5 text-slate-800 text-[11px] font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowFalKeyText(!showFalKeyText)}
                                        className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] cursor-pointer"
                                    >
                                        {showFalKeyText ? 'Ẩn' : 'Hiện'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveFalApiKey}
                                        disabled={isCheckingFal}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-60 shadow-xs"
                                    >
                                        {isCheckingFal ? 'Đang lưu...' : 'Lưu Key'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* GOOGLE FLOW (VEO 3.1) LOCAL CARD */}
            {engine === 'flow_local' && (
                <div className="bg-slate-50 p-3 rounded-xl ring-1 ring-slate-900/5 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-xs">
                                <VideoCameraIcon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-900">Google Flow (Local)</span>
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-rose-600 text-white">
                                        Veo 3.1
                                    </span>
                                    {poolAccounts.length > 0 && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-indigo-100 text-indigo-700 font-mono tabular-nums">
                                            {poolAccounts.length} acc
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    Chạy qua file CHAY_SERVER_NGAM.vbs trên Desktop
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setShowConfigPanel(!showConfigPanel)}
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

                    {showConfigPanel && (
                        <div className="pt-2.5 border-t border-slate-200/70 flex flex-col gap-2.5 animate-fade-in">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleLoginClick}
                                    disabled={isTriggeringLogin}
                                    className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs ${
                                        !serverHealth.authenticated ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
                                    }`}
                                >
                                    <span>🌐</span>
                                    <span>{isTriggeringLogin ? 'Đang mở Chrome...' : 'Mở cửa sổ Chrome đăng nhập Google'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSnapshotBrowserToPool}
                                    disabled={isSyncingCookies}
                                    className="min-h-[40px] px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                                >
                                    <span>➕</span>
                                    <span>Lưu nick Chrome hiện tại</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Notification alert banner */}
            {configMessage && (
                <div
                    className={`text-[11px] font-medium rounded-lg px-2.5 py-2 flex items-start gap-1.5 animate-fade-in ${
                        configMessageType === 'error'
                            ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-500/20'
                            : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/20'
                    }`}
                >
                    <span className="shrink-0">{configMessageType === 'error' ? '⚠️' : '✅'}</span>
                    <span className="leading-snug">{configMessage}</span>
                </div>
            )}

            {/* Sub-mode Segmented Tabs (Text->Video vs Image->Video) */}
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
                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
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
                                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-900/5'
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
                <div className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-900/5 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-900/10">
                            <img
                                src={inputImagePreview.startsWith('data:') ? inputImagePreview : `data:image/png;base64,${inputImagePreview}`}
                                alt="Input preview"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 truncate">Đã chọn ảnh gốc</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[11px] font-semibold shrink-0">
                        Khung {aspectRatio}
                    </span>
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
                    placeholder={isImageMode ? 'Nhập chuyển động mong muốn (VD: chuyển động tự nhiên, gió thổi nhẹ tóc bay...)' : 'Nhập mô tả cảnh quay chi tiết...'}
                    rows={3}
                    className="w-full bg-slate-50 ring-1 ring-slate-900/10 rounded-xl p-3 text-slate-900 text-sm leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-slate-400"
                />

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {PROMPT_PRESETS[subMode].map((preset, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setPrompt(preset)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 ring-1 ring-slate-900/5 rounded-lg hover:ring-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition-all text-left cursor-pointer"
                        >
                            {preset.length > 42 ? preset.substring(0, 42) + '...' : preset}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Model Selector */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {isFalMode ? 'Mô hình Fal.ai Cloud' : isSiliconMode ? 'Mô hình SiliconFlow Cloud' : 'Mô hình Google Flow (Veo 3.1)'}
                    </label>
                    <span className="text-[10px] text-emerald-600 font-medium">
                        {isExtensionMode ? 'Veo 3.1 Miễn phí 100%' : 'Tốc độ cao'}
                    </span>
                </div>

                {isFalMode ? (
                    <div className="flex flex-col gap-2">
                        {FAL_MODELS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => handleSelectFalModel(m.id)}
                                className={`p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 ${
                                    falModel === m.id
                                        ? 'bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/40 shadow-xs'
                                        : 'bg-slate-50 text-slate-700 ring-1 ring-slate-900/5 hover:bg-slate-100'
                                }`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold truncate">{m.name}</span>
                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white font-semibold text-indigo-700 shadow-2xs shrink-0">
                                            {m.badge}
                                        </span>
                                    </div>
                                    <span className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                                        {m.desc}
                                    </span>
                                </div>
                                <span className={`text-base shrink-0 ${falModel === m.id ? 'text-indigo-600' : 'text-slate-300'}`}>
                                    {falModel === m.id ? '●' : '○'}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : isSiliconMode ? (
                    <div className="flex flex-col gap-2">
                        {SILICON_MODELS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => handleSelectSiliconModel(m.id)}
                                className={`p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 ${
                                    siliconModel === m.id
                                        ? 'bg-purple-50/80 text-purple-900 ring-2 ring-purple-500/40 shadow-xs'
                                        : 'bg-slate-50 text-slate-700 ring-1 ring-slate-900/5 hover:bg-slate-100'
                                }`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold truncate">{m.name}</span>
                                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white font-semibold text-purple-700 shadow-2xs shrink-0">
                                            {m.badge}
                                        </span>
                                    </div>
                                    <span className="text-[10.5px] text-slate-500 line-clamp-1 mt-0.5">
                                        {m.desc}
                                    </span>
                                </div>
                                <span className={`text-base shrink-0 ${siliconModel === m.id ? 'text-purple-600' : 'text-slate-300'}`}>
                                    {siliconModel === m.id ? '●' : '○'}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {FLOW_MODEL_OPTIONS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setSelectedFlowModel(m.id)}
                                className={`min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                    selectedFlowModel === m.id
                                        ? 'bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/40 shadow-xs'
                                        : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                            >
                                <span className="truncate">{m.label}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 text-slate-500 font-medium shrink-0 ml-1">
                                    {m.badge}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Aspect Ratio & Output Count Row */}
            <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Tỷ lệ khung
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => setAspectRatio('16:9')}
                                className={`min-h-[42px] flex items-center justify-center px-2 py-2 rounded-xl text-xs font-semibold font-mono tabular-nums transition-all cursor-pointer ${
                                    aspectRatio === '16:9'
                                        ? 'bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/40 shadow-xs'
                                        : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100'
                                }`}
                            >
                                16:9 Ngang
                            </button>
                            <button
                                type="button"
                                onClick={() => setAspectRatio('9:16')}
                                className={`min-h-[42px] flex items-center justify-center px-2 py-2 rounded-xl text-xs font-semibold font-mono tabular-nums transition-all cursor-pointer ${
                                    aspectRatio === '9:16'
                                        ? 'bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/40 shadow-xs'
                                        : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100'
                                }`}
                            >
                                9:16 Dọc
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                            Số lượng
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[1, 2].map((cnt) => (
                                <button
                                    key={cnt}
                                    type="button"
                                    onClick={() => setOutputCount(cnt)}
                                    className={`min-h-[42px] flex items-center justify-center rounded-xl text-xs font-semibold font-mono tabular-nums transition-all cursor-pointer ${
                                        outputCount === cnt
                                            ? 'bg-indigo-50/80 text-indigo-700 ring-2 ring-indigo-500/40 shadow-xs'
                                            : 'bg-slate-50 text-slate-600 ring-1 ring-slate-900/5 hover:bg-slate-100'
                                    }`}
                                >
                                    x{cnt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2-Character Aspect Ratio Guidance for Horizontal Photos */}
                {isImageMode && isLandscapeImage && aspectRatio === '16:9' && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 ring-1 ring-emerald-500/20 text-[11px] text-emerald-900 flex items-center gap-2">
                        <span className="text-base shrink-0">👫</span>
                        <div>
                            <span className="font-semibold text-emerald-950">Ảnh ngang / có 2 nhân vật:</span> Đã tự động chọn <b>16:9 Ngang</b> để giữ trọn vẹn cả 2 người, không bị AI cắt góc!
                        </div>
                    </div>
                )}
                {isImageMode && isLandscapeImage && aspectRatio === '9:16' && (
                    <button
                        type="button"
                        onClick={() => setAspectRatio('16:9')}
                        className="w-full p-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-500/30 hover:bg-amber-100/90 text-[11px] text-amber-950 flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] text-left"
                    >
                        <span className="flex items-center gap-2">
                            <span className="text-base shrink-0">⚠️</span>
                            <span><b>Cảnh báo:</b> 9:16 Dọc sẽ cắt hẹp và có thể làm mất nhân vật bên cạnh!</span>
                        </span>
                        <span className="font-bold underline shrink-0 ml-2 text-rose-700">Đổi về 16:9 Ngang</span>
                    </button>
                )}
            </div>

            {/* Submit Action Button */}
            <button
                type="button"
                onClick={handleExecuteGenerate}
                disabled={!canSubmit}
                className="w-full min-h-[48px] mt-1 px-6 py-3.5 text-white font-semibold text-sm tracking-wide rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] cursor-pointer bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/20 hover:shadow-indigo-500/30 focus:ring-2 focus:ring-indigo-500/40"
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang tạo {outputCount} video...</span>
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        {isExtensionMode ? <span>🧩</span> : isFalMode ? <span>🚀</span> : <VideoCameraIcon className="w-5 h-5" />}
                        <span>
                            {isExtensionMode
                                ? `TẠO VIDEO VEO 3.1 (${selectedFlowModel.replace(' - ', ' ')})`
                                : isFalMode
                                ? `TẠO VIDEO CLOUD (${falModel.split('/').pop()?.toUpperCase()})`
                                : isSiliconMode
                                ? `TẠO VIDEO CLOUD (${siliconModel.split('/').pop()})`
                                : `TẠO VIDEO VEO 3.1 (${selectedFlowModel.replace(' - ', ' ')})`}
                        </span>
                    </span>
                )}
            </button>
        </div>
    );
};
