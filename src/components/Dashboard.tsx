
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from '../../components/Header';
import { ImageUploader, ImageState } from '../../components/ImageUploader';
import { PromptPanel } from '../../components/PromptPanel';
import { IdPhotoPanel } from '../../components/IdPhotoPanel';
import { EditImagePanel } from '../../components/EditImagePanel';
import { UpscalePanel } from '../../components/UpscalePanel';
import { ProfileProPanel } from '../../components/ProfileProPanel';
import { OutputDisplay } from '../../components/OutputDisplay';
import { generateImagesFromPromptsList, generateIdPhotos, editImage, upscaleImage, generateProfilePic, mixMatchOutfit, relightImage, extractClothing } from '../../services/aiService';
import { ProfilePage } from '../../components/ProfilePage';
import { ImagePreviewModal } from '../../components/ImagePreviewModal';
import { ApiKeyModal } from '../../components/ApiKeyModal';
import { ActivityLog } from '../../components/ActivityLog';
import { DownloadHelpModal } from '../../components/DownloadHelpModal';
import { Marquee } from '../../components/Marquee';
import * as storage from '../../services/storageService';
import { useAuth } from '../contexts/AuthContext';

// Data structure for each mode to persist state
interface ModeData {
    inputs: ImageState[];
    outputs: (string | null)[];
    prompts: string[];
    // Specific for Creative Mode
    creativeInputs?: {
        male: ImageState[];
        female: ImageState[];
        maleAcc: ImageState[];
        femaleAcc: ImageState[];
    };
    cleanedInputs?: (string | null)[];
}

const initialModeState: ModeData = {
    inputs: [],
    outputs: [],
    prompts: [],
    creativeInputs: { male: [], female: [], maleAcc: [], femaleAcc: [] },
    cleanedInputs: []
};

export const Dashboard: React.FC = () => {
    // --- GLOBAL STATE ---
    const { currentUser, logout } = useAuth();
    const [isHistoryVisible, setHistoryVisible] = useState(false);
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [hasGeminiKey, setHasGeminiKey] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ url: string, index: number } | null>(null);
    const [isDownloadHelpOpen, setDownloadHelpOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [autoDownload, setAutoDownload] = useState(false);

    // Loading & Error (Global mostly, but could be per mode if needed)
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Presentation State

    // --- MODE MANAGEMENT ---
    const [mode, setMode] = useState<'creative' | 'id_photo' | 'edit' | 'upscale' | 'profile_pro'>('creative');

    // Persistent State for ALL Modes
    const [modeStates, setModeStates] = useState<Record<string, ModeData>>({
        creative: JSON.parse(JSON.stringify(initialModeState)),
        id_photo: JSON.parse(JSON.stringify(initialModeState)),
        edit: JSON.parse(JSON.stringify(initialModeState)),
        upscale: JSON.parse(JSON.stringify(initialModeState)),
        profile_pro: JSON.parse(JSON.stringify(initialModeState)),
    });

    // Helper to update current mode state
    const updateModeState = (updater: (prev: ModeData) => Partial<ModeData>) => {
        setModeStates(prev => ({
            ...prev,
            [mode]: { ...prev[mode], ...updater(prev[mode]) }
        }));
    };

    // Helper to access current state
    const currentData = modeStates[mode];

    const checkApiKey = useCallback(() => {
        const key = storage.getApiKey('gemini');
        setHasGeminiKey(!!key);
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    const triggerDownload = (base64: string, filename: string) => {
        try {
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${base64}`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Auto download failed:", e);
        }
    };

    const handleDownloadConfigClick = () => setDownloadHelpOpen(true);

    // --- INPUT HANDLERS (PERSISTENT) ---

    const handleImagesChange = (images: ImageState[]) => {
        updateModeState(() => ({ inputs: images }));
        setError(null);
    };

    // Specific handlers for Creative Mode
    const handleCreativeChange = (type: 'male' | 'female' | 'maleAcc' | 'femaleAcc', images: ImageState[]) => {
        updateModeState((prev) => ({
            creativeInputs: {
                ...prev.creativeInputs!,
                [type]: images
            }
        }));
    };

    // --- GENERATION HANDLERS ---

    const getApiKeyOrAlert = () => {
        const apiKey = storage.getApiKey('gemini');
        if (!apiKey) {
            setError(`Vui lòng thêm API Key Gemini để bắt đầu.`);
            setApiKeyModalOpen(true);
            return null;
        }
        return apiKey;
    };

    const saveHistory = async (type: string, prompt: string, images: string[], style: string = 'General') => {
        if (!currentUser) return;
        const historyItem = {
            id: Date.now().toString(),
            prompt: prompt,
            aspectRatio: 'N/A',
            resolution: 'N/A',
            shotType: type,
            style: style,
            images: images,
            timestamp: Date.now()
        };
        await storage.saveHistory(currentUser.username, historyItem);
        setHistoryRefreshTrigger(prev => prev + 1);
    };

    // 1. ID Photo
    const handleIdPhotoGenerate = useCallback(async (clothing: string, bgColor: string, aspectRatio: string, gender: string, hairstyle: string) => {
        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        // Read from current state
        const currentInputs = modeStates['id_photo'].inputs;
        if (currentInputs.length === 0) { setError("Vui lòng chọn 1 ảnh chân dung."); return; }

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(4).fill(null), prompts: [] }));

        try {
            const imagePart = { data: currentInputs[0].base64, mimeType: currentInputs[0].mimeType };
            setLoadingStatus('Đang xử lý ảnh thẻ...');

            const { prompts } = await generateIdPhotos(
                apiKey, imagePart, clothing, bgColor, aspectRatio, gender, hairstyle,
                (status) => setLoadingStatus(status),
                (index, base64) => {
                    updateModeState((prev) => {
                        const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                    });
                    if (autoDownload && base64) triggerDownload(base64, `IDPhoto_${index + 1}.png`);
                }
            );
            updateModeState(() => ({ prompts }));
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi.'); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, currentUser, autoDownload]);


    // 2. Creative Mode
    const handleCreativeGenerate = useCallback(async (
        prompts: string[],
        aspectRatio: string,
        resolution: string,
        outputMode: 'single' | 'couple',
        filenamePrefix: string,
        style?: string,
        shotType?: string
    ) => {
        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        // Read specific creative inputs
        const cInputs = modeStates['creative'].creativeInputs!;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: Array(prompts.length).fill(null), prompts: prompts }));

        const localResults: (string | null)[] = Array(prompts.length).fill(null);

        try {
            const maleParts = cInputs.male.map(img => ({ data: img.base64, mimeType: img.mimeType }));
            const femaleParts = cInputs.female.map(img => ({ data: img.base64, mimeType: img.mimeType }));
            const maleAccParts = cInputs.maleAcc.map(img => ({ data: img.base64, mimeType: img.mimeType }));
            const femaleAccParts = cInputs.femaleAcc.map(img => ({ data: img.base64, mimeType: img.mimeType }));

            const refImages = { male: maleParts, female: femaleParts, maleAccessories: maleAccParts, femaleAccessories: femaleAccParts };
            setLoadingStatus('Đang khởi động Model...');

            await generateImagesFromPromptsList(
                apiKey, prompts, refImages, aspectRatio, resolution,
                (status) => setLoadingStatus(status),
                (index, base64) => {
                    updateModeState((prev) => {
                        const n = [...prev.outputs]; n[index] = base64; return { outputs: n };
                    });
                    localResults[index] = base64;
                    if (autoDownload && base64) triggerDownload(base64, `${filenamePrefix}_${index + 1}.png`);
                },
                style,
                shotType
            );

            const validImages = localResults.filter((img): img is string => img !== null);
            if (validImages.length > 0) saveHistory('Creative Batch', prompts[0], validImages, outputMode);

        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi.'); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, currentUser, autoDownload]);

    // 3. Edit Image
    const handleEditImage = useCallback(async (prompt: string, type: 'general' | 'mix' | 'relight' | 'extract', extraData?: any) => {
        const apiKey = getApiKeyOrAlert();
        if (!apiKey) return;

        const inputs = modeStates['edit'].inputs;

        if (type !== 'mix' && inputs.length === 0) { setError("Vui lòng tải lên ảnh."); return; }
        if (type === 'mix' && inputs.length < 2) { setError("Vui lòng tải lên 2 ảnh để phối đồ."); return; }

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: [null] }));

        try {
            let result: string | null = null;
            let historyPrompt = prompt;

            if (type === 'general') {
                setLoadingStatus('Đang chỉnh sửa ảnh...');
                result = await editImage(apiKey, { data: inputs[0].base64, mimeType: inputs[0].mimeType }, prompt);
            } else if (type === 'mix') {
                setLoadingStatus('Đang phối đồ Mix & Match...');
                result = await mixMatchOutfit(
                    apiKey,
                    { data: inputs[0].base64, mimeType: inputs[0].mimeType },
                    { data: inputs[1].base64, mimeType: inputs[1].mimeType }
                );
                historyPrompt = "Outfit Mix & Match";
            } else if (type === 'relight') {
                setLoadingStatus('Đang thay đổi ánh sáng...');
                result = await relightImage(apiKey, { data: inputs[0].base64, mimeType: inputs[0].mimeType }, extraData.lighting);
                historyPrompt = `Relighting: ${extraData.lighting}`;
            } else if (type === 'extract') {
                setLoadingStatus('Đang tách trang phục (Ghost Mannequin)...');
                result = await extractClothing(apiKey, { data: inputs[0].base64, mimeType: inputs[0].mimeType });
                historyPrompt = "Clothing Extraction";
            }

            updateModeState(() => ({ outputs: [result], prompts: [historyPrompt] }));
            if (autoDownload && result) triggerDownload(result, 'edited_result.png');
            if (result) saveHistory('Edit Tool', historyPrompt, [result], type);
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi xử lý.'); updateModeState(() => ({ outputs: [] })); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, autoDownload, currentUser]);

    // 4. Upscale Image
    const handleUpscale = useCallback(async (resolution: '2K' | '4K') => {
        const apiKey = getApiKeyOrAlert();
        const inputs = modeStates['upscale'].inputs;
        if (!apiKey || inputs.length === 0) return;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: [null] }));
        try {
            const imagePart = { data: inputs[0].base64, mimeType: inputs[0].mimeType };
            setLoadingStatus(`Đang nâng cấp chất lượng lên ${resolution}...`);
            const result = await upscaleImage(apiKey, imagePart, resolution);

            updateModeState(() => ({ outputs: [result], prompts: [`Upscaled to ${resolution}`] }));
            if (autoDownload && result) triggerDownload(result, `upscale_${resolution}.png`);
            if (result) saveHistory('Upscale', `Upscaled to ${resolution}`, [result], 'High Quality');
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi nâng cấp.'); updateModeState(() => ({ outputs: [] })); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, autoDownload, currentUser]);

    // 5. Profile Pro
    const handleProfilePro = useCallback(async (style: string, platform: string, resolution: '2K' | '4K') => {
        const apiKey = getApiKeyOrAlert();
        const inputs = modeStates['profile_pro'].inputs;
        if (!apiKey || inputs.length === 0) return;

        setIsLoading(true); setError(null); setIsMenuOpen(false);
        updateModeState(() => ({ outputs: [null] }));
        try {
            const imagePart = { data: inputs[0].base64, mimeType: inputs[0].mimeType };
            setLoadingStatus(`Đang thiết kế Profile (${platform})...`);
            const result = await generateProfilePic(apiKey, imagePart, style, platform, resolution);

            updateModeState(() => ({ outputs: [result], prompts: [`Profile: ${style} for ${platform}`] }));
            if (autoDownload && result) triggerDownload(result, `profile_${platform}.png`);
            if (result) saveHistory('Profile Pro', `Profile: ${style} for ${platform}`, [result], style);
        } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi tạo profile.'); updateModeState(() => ({ outputs: [] })); }
        finally { setIsLoading(false); setLoadingStatus(''); }
    }, [modeStates, autoDownload, currentUser]);

    const renderInputs = () => {
        const mState = modeStates[mode];

        if (mode === 'creative') {
            return (
                <div className="grid grid-cols-2 gap-3 p-4">
                    <ImageUploader label="Nam" onImagesChange={(imgs) => handleCreativeChange('male', imgs)} maxImages={1} compact />
                    <ImageUploader label="Nữ" onImagesChange={(imgs) => handleCreativeChange('female', imgs)} maxImages={1} compact />
                    <ImageUploader label="PK Nam" onImagesChange={(imgs) => handleCreativeChange('maleAcc', imgs)} maxImages={1} compact />
                    <ImageUploader label="PK Nữ" onImagesChange={(imgs) => handleCreativeChange('femaleAcc', imgs)} maxImages={1} compact />
                </div>
            );
        } else if (['id_photo', 'edit', 'upscale', 'profile_pro'].includes(mode)) {
            return (
                <div className="p-4">
                    <ImageUploader label={mode === 'edit' ? "Ảnh đầu vào (Upload 2 ảnh nếu Mix đồ)" : "Ảnh đầu vào"} onImagesChange={handleImagesChange} maxImages={mode === 'edit' ? 2 : 1} />
                </div>
            );
        }
        return <div className="p-4 text-xs text-slate-400 text-center italic">Chế độ này không cần ảnh đầu vào.</div>;
    };

    // --- RENDER CONFIG PANEL ---
    const renderConfig = () => {
        const mState = modeStates[mode];
        const creativeInputs = mState.creativeInputs!;
        const totalCreative = creativeInputs.male.length + creativeInputs.female.length + creativeInputs.maleAcc.length + creativeInputs.femaleAcc.length;

        if (mode === 'creative') return <PromptPanel onGenerate={handleCreativeGenerate} isLoading={isLoading} isDisabled={!currentUser} hasApiKey={hasGeminiKey} selectedImageCount={totalCreative} inputCounts={{ male: creativeInputs.male.length, female: creativeInputs.female.length, maleAcc: creativeInputs.maleAcc.length, femaleAcc: creativeInputs.femaleAcc.length }} />;
        if (mode === 'id_photo') return <IdPhotoPanel onGenerate={handleIdPhotoGenerate} isLoading={isLoading} isDisabled={!currentUser} hasApiKey={hasGeminiKey} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'edit') return <EditImagePanel onGenerate={handleEditImage} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'upscale') return <UpscalePanel onGenerate={handleUpscale} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        if (mode === 'profile_pro') return <ProfileProPanel onGenerate={handleProfilePro} isLoading={isLoading} isDisabled={!currentUser} hasInputImage={mState.inputs.length > 0} />;
        return null;
    };

    return (
        <div className="min-h-screen text-slate-900 font-sans antialiased flex flex-col selection:bg-indigo-100 relative overflow-hidden bg-slate-100">

            <Marquee />

            <Header
                user={currentUser}
                onLoginClick={() => { }}
                onLogout={logout}
                onHistoryClick={() => setHistoryVisible(true)}

                isHistoryVisible={isHistoryVisible}
                currentMode={mode}
                onModeChange={setMode}
            />

            <div className="flex-1 flex overflow-hidden relative z-10 h-[calc(100vh-100px)]">

                {/* SIDEBAR - Completely Separated */}
                {!isHistoryVisible && (
                    <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 lg:w-[340px] bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out overflow-y-auto custom-scrollbar ${isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} lg:block shadow-sm flex flex-col`}>

                        <div className="p-3 lg:p-4 space-y-4 flex-1">
                            {/* Mode Indicator */}
                            <div className="flex items-center gap-2 mb-2 pb-4 border-b border-slate-200">
                                <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                                <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">
                                    {mode === 'creative' && 'Sáng tạo vô hạn'}
                                    {mode === 'id_photo' && 'Ảnh thẻ chuyên nghiệp'}
                                    {mode === 'edit' && 'Chỉnh sửa AI'}
                                    {mode === 'upscale' && 'Siêu phân giải'}
                                    {mode === 'profile_pro' && 'Xây dựng thương hiệu'}
                                </h2>
                            </div>

                            {/* Auto Download Toggle */}
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <div className="bg-white p-1.5 rounded-lg text-indigo-600 shadow-sm border border-slate-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-800">Tự động tải về</h4>
                                        <button onClick={handleDownloadConfigClick} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1">Cấu hình thư mục</button>
                                    </div>
                                </div>
                                <div className="relative inline-block w-9 h-5 align-middle select-none transition duration-200 ease-in">
                                    <input type="checkbox" name="toggle" id="toggle" checked={autoDownload} onChange={(e) => setAutoDownload(e.target.checked)} className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-4 checked:border-indigo-600 shadow-sm top-0.5" />
                                    <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${autoDownload ? 'bg-indigo-600' : 'bg-slate-300'}`}></label>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Input Section */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 px-1">
                                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                                        Dữ liệu đầu vào
                                    </h3>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
                                        {renderInputs()}
                                    </div>
                                </div>

                                {/* Config Section */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                                        Cấu hình AI
                                    </h3>
                                    <div className="bg-white p-1">
                                        {renderConfig()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                            <p className="text-[11px] text-slate-500 font-semibold">ImageTool © Studio Edition</p>
                        </div>
                    </aside>
                )}

                {/* Mobile Toggle */}
                {!isHistoryVisible && (
                    <button onClick={() => setIsMenuOpen(true)} className="lg:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all ring-4 ring-white animate-pulse-glow">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
                    </button>
                )}
                {isMenuOpen && <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsMenuOpen(false)}></div>}

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 overflow-y-auto bg-slate-100 flex flex-col w-full relative custom-scrollbar">
                    {isHistoryVisible && currentUser ? (
                        <div className="p-4 md:p-8 w-full max-w-7xl mx-auto animate-fade-in">
                            <ProfilePage user={currentUser} onBack={() => setHistoryVisible(false)} onImageClick={(url) => setSelectedImage({ url, index: 0 })} />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col p-4 md:p-8 w-full h-full">

                            {/* Render Results based on CURRENT MODE State */}
                            
                            <OutputDisplay
                                outputImages={currentData.outputs}
                                prompts={currentData.prompts}
                                isLoading={isLoading}
                                loadingStatus={loadingStatus}
                                error={error}
                                onImageClick={(url, idx) => setSelectedImage({ url, index: idx })}
                            />

                            <div className="mt-auto pt-8">
                                <ActivityLog user={currentUser} refreshTrigger={historyRefreshTrigger} onImageClick={(url) => setSelectedImage({ url, index: 0 })} className="w-full" />
                            </div>
                        </div>
                    )}
                </main>
            </div>
            {selectedImage && <ImagePreviewModal base64={selectedImage.url} index={selectedImage.index} onClose={() => setSelectedImage(null)} />}
            {isDownloadHelpOpen && <DownloadHelpModal onClose={() => setDownloadHelpOpen(false)} />}
        </div>
    );
};
