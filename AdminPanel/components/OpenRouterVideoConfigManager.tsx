import React, { useState, useEffect } from 'react';
import {
    Video,
    Key,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Eye,
    EyeOff,
    Save,
    Sparkles,
    ShieldCheck,
    Coins,
    Sliders,
    Layers
} from 'lucide-react';
import {
    getVideoConfig,
    saveVideoConfig,
    testOpenRouterApiKey,
    testIdeaAiApiKey,
    OpenRouterVideoConfig,
    DEFAULT_VIDEO_CONFIG
} from '../services/videoConfigService';
import type { AdminUser } from '../services/adminAuthService';

interface OpenRouterVideoConfigManagerProps {
    admin: AdminUser;
}

const SUPPORTED_VIDEO_MODELS = [
    {
        id: 'idea.ai/vivix_w1',
        name: 'idea.ai: Vivix W1 (720p HD • 260 Coins)',
        badge: 'idea.ai - Rẻ & Nét 720p',
        desc: 'Hỗ trợ cả Image-to-Video & Text-to-Video, đủ tỷ lệ 9:16 / 16:9 / 1:1, thời lượng 5s–15s',
        costEstimate: '260 Coins/video'
    },
    {
        id: 'x-ai/grok-imagine-video-1.5-lite',
        name: 'OpenRouter: xAI Grok Video 1.5 Lite',
        badge: 'OpenRouter - Rẻ & Nhanh',
        desc: 'Tốc độ cực nhanh, không chặn mặt người thật, hỗ trợ 3s–15s',
        costEstimate: '~560đ/giây'
    },
    {
        id: 'alibaba/wan-3.0',
        name: 'OpenRouter: Alibaba Wan 3.0 (Có âm thanh)',
        badge: 'OpenRouter - Có âm thanh',
        desc: 'Tối ưu gương mặt Á Đông, có âm thanh gốc, hỗ trợ 3s–15s',
        costEstimate: '~1.400đ/giây'
    }
];

export const OpenRouterVideoConfigManager: React.FC<OpenRouterVideoConfigManagerProps> = ({ admin }) => {
    const [config, setConfig] = useState<OpenRouterVideoConfig>(DEFAULT_VIDEO_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // OpenRouter test states
    const [testingOr, setTestingOr] = useState(false);
    const [showOrKey, setShowOrKey] = useState(false);
    const [orTestResult, setOrTestResult] = useState<{
        valid: boolean;
        label?: string;
        usage?: number;
        limit?: number | null;
        error?: string;
        checkedAt?: number;
    } | null>(null);

    // idea.ai test states
    const [testingIdea, setTestingIdea] = useState(false);
    const [showIdeaKey, setShowIdeaKey] = useState(false);
    const [ideaTestResult, setIdeaTestResult] = useState<{
        valid: boolean;
        label?: string;
        error?: string;
        checkedAt?: number;
    } | null>(null);

    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        getVideoConfig()
            .then(res => {
                if (mounted) {
                    setConfig(res);
                    if (res.openRouterApiKey) {
                        handleTestOpenRouterKey(res.openRouterApiKey);
                    }
                    if (res.ideaAiApiKey) {
                        handleTestIdeaAiKey(res.ideaAiApiKey);
                    }
                }
            })
            .catch(err => {
                if (mounted) setErrorMsg(err?.message || 'Không thể tải cấu hình video');
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const handleTestOpenRouterKey = async (keyToTest?: string) => {
        const key = (keyToTest !== undefined ? keyToTest : config.openRouterApiKey).trim();
        if (!key) {
            setOrTestResult({
                valid: false,
                error: 'Vui lòng nhập API Key OpenRouter trước khi kiểm tra',
                checkedAt: Date.now()
            });
            return;
        }

        setTestingOr(true);
        try {
            const res = await testOpenRouterApiKey(key);
            setOrTestResult({
                valid: res.valid,
                label: res.label,
                usage: res.usage,
                limit: res.limit,
                error: res.error,
                checkedAt: Date.now()
            });
        } catch (err: any) {
            setOrTestResult({
                valid: false,
                error: err?.message || 'Lỗi kiểm tra kết nối OpenRouter',
                checkedAt: Date.now()
            });
        } finally {
            setTestingOr(false);
        }
    };

    const handleTestIdeaAiKey = async (keyToTest?: string) => {
        const key = (keyToTest !== undefined ? keyToTest : config.ideaAiApiKey).trim();
        if (!key) {
            setIdeaTestResult({
                valid: false,
                error: 'Vui lòng nhập API Key idea.ai (cfak_...) trước khi kiểm tra',
                checkedAt: Date.now()
            });
            return;
        }

        setTestingIdea(true);
        try {
            const res = await testIdeaAiApiKey(key);
            setIdeaTestResult({
                valid: res.valid,
                label: res.label,
                error: res.error,
                checkedAt: Date.now()
            });
        } catch (err: any) {
            setIdeaTestResult({
                valid: false,
                error: err?.message || 'Lỗi kiểm tra kết nối idea.ai',
                checkedAt: Date.now()
            });
        } finally {
            setTestingIdea(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrorMsg(null);
        setSaveSuccess(false);

        try {
            await saveVideoConfig(config, admin.email || 'Admin');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (err: any) {
            setErrorMsg(err?.message || 'Không lưu được cấu hình');
        } finally {
            setSaving(false);
        }
    };

    const handleCostChange = (cost: number) => {
        const markup = config.profitMarkupPercent || 10;
        const suggestedPrice = Math.round((cost * (1 + markup / 100)) / 10) * 10;
        setConfig(prev => ({
            ...prev,
            costPerVideoVnd: cost,
            pricePerVideoVnd: suggestedPrice
        }));
    };

    const handleMarkupChange = (markup: number) => {
        const cost = config.costPerVideoVnd || 600;
        const suggestedPrice = Math.round((cost * (1 + markup / 100)) / 10) * 10;
        setConfig(prev => ({
            ...prev,
            profitMarkupPercent: markup,
            pricePerVideoVnd: suggestedPrice
        }));
    };

    const estimatedNetProfit = (config.pricePerVideoVnd || 700) - (config.costPerVideoVnd || 600);

    if (loading) {
        return (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '24px', marginBottom: '24px', textAlign: 'center' }}>
                <div className="loading-spinner" style={{ width: '28px', height: '28px', margin: '0 auto 10px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang tải cấu hình Video AI (idea.ai & OpenRouter)...</p>
            </div>
        );
    }

    return (
        <section aria-labelledby="openrouter-video-config-title" style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '24px',
            marginBottom: '28px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid rgba(226, 232, 240, 0.8)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #ea580c 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.28)'
                    }}>
                        <Video size={22} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h2 id="openrouter-video-config-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                                Cấu hình Video AI (idea.ai & OpenRouter)
                            </h2>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid rgba(5, 150, 105, 0.25)',
                                padding: '3px 9px',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
                                Realtime Sync
                            </span>
                        </div>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.84rem' }}>
                            Bật/tắt độc lập từng nguồn (idea.ai hoặc OpenRouter). Nguồn nào tắt thì model của nguồn đó bên Tool chính sẽ tự động chuyển xám (khóa).
                        </p>
                    </div>
                </div>

                {/* Master Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: config.enabled ? '#047857' : '#94a3b8' }}>
                        {config.enabled ? 'Toàn bộ Video AI: BẬT' : 'Toàn bộ Video AI: TẮT'}
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={config.enabled}
                        onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                        style={{
                            width: '52px',
                            height: '28px',
                            borderRadius: '9999px',
                            background: config.enabled ? '#10b981' : '#cbd5e1',
                            border: 'none',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background 0.2s ease',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center'
                        }}
                    >
                        <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transform: config.enabled ? 'translateX(24px)' : 'translateX(0px)',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                    </button>
                </div>
            </div>

            {/* Error & Success Messages */}
            {errorMsg && (
                <div role="alert" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    color: '#991b1b',
                    fontSize: '0.86rem',
                    marginBottom: '16px'
                }}>
                    <XCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{errorMsg}</span>
                </div>
            )}

            {saveSuccess && (
                <div role="status" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '12px',
                    color: '#065f46',
                    fontSize: '0.86rem',
                    marginBottom: '16px'
                }}>
                    <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>Đã lưu và đồng bộ trạng thái nguồn + API Key sang ImageTool!</span>
                </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
                {/* 1. IDEA.AI API KEY & PROVIDER TOGGLE */}
                <div style={{
                    background: config.ideaAiEnabled !== false ? '#f5f3ff' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: `1.5px solid ${config.ideaAiEnabled !== false ? '#c4b5fd' : '#e2e8f0'}`,
                    transition: 'all 0.2s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <label htmlFor="idea-ai-api-key" style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Key size={16} style={{ color: '#7c3aed' }} />
                                <span>Nguồn 1: idea.ai API Key (cfak_...)</span>
                            </label>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: config.ideaAiEnabled !== false ? '#ede9fe' : '#e2e8f0',
                                color: config.ideaAiEnabled !== false ? '#6d28d9' : '#64748b'
                            }}>
                                Model: Vivix W1 (720p • 9:16 / 16:9 / 1:1 • 5s–15s)
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => handleTestIdeaAiKey()}
                                disabled={testingIdea || !config.ideaAiApiKey}
                                className="btn btn-secondary"
                                style={{
                                    padding: '6px 14px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    minHeight: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <RefreshCw size={14} className={testingIdea ? 'loading-spinner' : ''} />
                                Kiểm tra khóa
                            </button>

                            {/* Toggle idea.ai */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: config.ideaAiEnabled !== false ? '#6d28d9' : '#64748b' }}>
                                    {config.ideaAiEnabled !== false ? 'Đang BẬT' : 'Đang TẮT (Khóa xám)'}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={config.ideaAiEnabled !== false}
                                    onClick={() => setConfig(prev => ({ ...prev, ideaAiEnabled: !(prev.ideaAiEnabled !== false) }))}
                                    style={{
                                        width: '46px',
                                        height: '24px',
                                        borderRadius: '9999px',
                                        background: config.ideaAiEnabled !== false ? '#7c3aed' : '#cbd5e1',
                                        border: 'none',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s ease',
                                        padding: '2px',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: '#ffffff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        transform: config.ideaAiEnabled !== false ? 'translateX(22px)' : 'translateX(0px)',
                                        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '0 14px',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                        opacity: config.ideaAiEnabled !== false ? 1 : 0.65
                    }}>
                        <input
                            id="idea-ai-api-key"
                            type={showIdeaKey ? 'text' : 'password'}
                            value={config.ideaAiApiKey || ''}
                            onChange={e => setConfig(prev => ({ ...prev, ideaAiApiKey: e.target.value }))}
                            placeholder="cfak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            style={{
                                width: '100%',
                                padding: '12px 0',
                                border: 'none',
                                outline: 'none',
                                fontFamily: showIdeaKey ? 'monospace' : undefined,
                                fontSize: '0.88rem',
                                color: '#0f172a',
                                background: 'transparent'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowIdeaKey(!showIdeaKey)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title={showIdeaKey ? 'Ẩn khóa' : 'Hiện khóa'}
                        >
                            {showIdeaKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {ideaTestResult && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: ideaTestResult.valid ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${ideaTestResult.valid ? '#a7f3d0' : '#fecaca'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {ideaTestResult.valid ? (
                                    <CheckCircle2 size={16} style={{ color: '#059669' }} />
                                ) : (
                                    <XCircle size={16} style={{ color: '#dc2626' }} />
                                )}
                                <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    color: ideaTestResult.valid ? '#047857' : '#991b1b'
                                }}>
                                    {ideaTestResult.valid ? (ideaTestResult.label || 'Khóa idea.ai hợp lệ!') : (ideaTestResult.error || 'Khóa idea.ai không hợp lệ')}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. OPENROUTER API KEY & PROVIDER TOGGLE */}
                <div style={{
                    background: config.openRouterEnabled !== false ? '#fffbeb' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: `1.5px solid ${config.openRouterEnabled !== false ? '#fde68a' : '#e2e8f0'}`,
                    transition: 'all 0.2s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <label htmlFor="openrouter-api-key" style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Key size={16} style={{ color: '#f59e0b' }} />
                                <span>Nguồn 2: OpenRouter API Key (sk-or-v1-...)</span>
                            </label>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: config.openRouterEnabled !== false ? '#fef3c7' : '#e2e8f0',
                                color: config.openRouterEnabled !== false ? '#b45309' : '#64748b'
                            }}>
                                Model: Grok 1.5 Lite & Alibaba Wan 3.0 (3s–15s)
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => handleTestOpenRouterKey()}
                                disabled={testingOr || !config.openRouterApiKey}
                                className="btn btn-secondary"
                                style={{
                                    padding: '6px 14px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    minHeight: '34px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <RefreshCw size={14} className={testingOr ? 'loading-spinner' : ''} />
                                Kiểm tra khóa
                            </button>

                            {/* Toggle OpenRouter */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: config.openRouterEnabled !== false ? '#b45309' : '#64748b' }}>
                                    {config.openRouterEnabled !== false ? 'Đang BẬT' : 'Đang TẮT (Khóa xám)'}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={config.openRouterEnabled !== false}
                                    onClick={() => setConfig(prev => ({ ...prev, openRouterEnabled: !(prev.openRouterEnabled !== false) }))}
                                    style={{
                                        width: '46px',
                                        height: '24px',
                                        borderRadius: '9999px',
                                        background: config.openRouterEnabled !== false ? '#f59e0b' : '#cbd5e1',
                                        border: 'none',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s ease',
                                        padding: '2px',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: '#ffffff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        transform: config.openRouterEnabled !== false ? 'translateX(22px)' : 'translateX(0px)',
                                        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '0 14px',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                        opacity: config.openRouterEnabled !== false ? 1 : 0.65
                    }}>
                        <input
                            id="openrouter-api-key"
                            type={showOrKey ? 'text' : 'password'}
                            value={config.openRouterApiKey}
                            onChange={e => setConfig(prev => ({ ...prev, openRouterApiKey: e.target.value }))}
                            placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            style={{
                                width: '100%',
                                padding: '12px 0',
                                border: 'none',
                                outline: 'none',
                                fontFamily: showOrKey ? 'monospace' : undefined,
                                fontSize: '0.88rem',
                                color: '#0f172a',
                                background: 'transparent'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowOrKey(!showOrKey)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title={showOrKey ? 'Ẩn khóa' : 'Hiện khóa'}
                        >
                            {showOrKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Test Key Status Display */}
                    {orTestResult && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: orTestResult.valid ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${orTestResult.valid ? '#a7f3d0' : '#fecaca'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {orTestResult.valid ? (
                                    <CheckCircle2 size={16} style={{ color: '#059669' }} />
                                ) : (
                                    <XCircle size={16} style={{ color: '#dc2626' }} />
                                )}
                                <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    color: orTestResult.valid ? '#047857' : '#991b1b'
                                }}>
                                    {orTestResult.valid ? 'API Key OpenRouter hợp lệ và sẵn sàng tạo video!' : (orTestResult.error || 'API Key không hợp lệ')}
                                </span>
                            </div>
                            {orTestResult.valid && orTestResult.usage !== undefined && (
                                <span style={{ fontSize: '0.78rem', color: '#047857', fontFamily: 'monospace' }}>
                                    Đã dùng: ${(orTestResult.usage).toFixed(3)} {orTestResult.limit ? `/ Giới hạn: $${orTestResult.limit}` : ''}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Model Priority (Primary & Failover) */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={18} style={{ color: '#7c3aed' }} />
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                                Mô hình Mặc định & Tự động Dự phòng (Failover)
                            </h3>
                        </div>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#ede9fe',
                            color: '#6d28d9',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                        }}>
                            <ShieldCheck size={13} />
                            Auto-Failover
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                        {/* Primary Model */}
                        <div style={{
                            background: '#f5f3ff',
                            borderRadius: '12px',
                            padding: '14px',
                            border: '1px solid #ddd6fe'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
                                    ① Mô hình chính
                                </span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6d28d9', background: '#ede9fe', padding: '1px 6px', borderRadius: '4px' }}>
                                    Mặc định
                                </span>
                            </div>
                            <select
                                value={config.primaryModel}
                                onChange={e => setConfig(prev => ({ ...prev, primaryModel: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #8b5cf6',
                                    background: '#ffffff',
                                    color: '#0f172a',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    marginBottom: '6px'
                                }}
                            >
                                {SUPPORTED_VIDEO_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: '#5b21b6', lineHeight: 1.5 }}>
                                Mô hình được ưu tiên chọn sẵn khi người dùng mở bảng Tạo Video.
                            </p>
                        </div>

                        {/* Fallback Model */}
                        <div style={{
                            background: '#f1f5f9',
                            borderRadius: '12px',
                            padding: '14px',
                            border: '1px solid #cbd5e1'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                                    ② Mô hình dự phòng
                                </span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                                    Tự kích hoạt khi lỗi
                                </span>
                            </div>
                            <select
                                value={config.fallbackModel}
                                onChange={e => setConfig(prev => ({ ...prev, fallbackModel: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #94a3b8',
                                    background: '#ffffff',
                                    color: '#0f172a',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    marginBottom: '6px'
                                }}
                            >
                                {SUPPORTED_VIDEO_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>
                                Tự động chuyển qua khi mô hình chính bận hoặc đang bảo trì (nếu nguồn dự phòng đang bật).
                            </p>
                        </div>
                    </div>
                </div>

                {/* 4. Pricing & Profit Margin (+10%) */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Coins size={18} style={{ color: '#059669' }} />
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                            Cơ cấu Giá bán & Lợi nhuận (+10% Biên lợi nhuận)
                        </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                Giá vốn gốc tham chiếu (VND / video)
                            </label>
                            <input
                                type="number"
                                min={100}
                                max={5000}
                                step={50}
                                value={config.costPerVideoVnd || 600}
                                onChange={e => handleCostChange(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: '#0f172a'
                                }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Vivix W1: 260 Coins • Grok: ~560đ/s</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                Tỷ lệ lợi nhuận (+%)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={config.profitMarkupPercent || 10}
                                onChange={e => handleMarkupChange(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: '#0f172a'
                                }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Mặc định +10%</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#047857', marginBottom: '6px' }}>
                                Giá bán trên ImageTool (VND / video)
                            </label>
                            <input
                                type="number"
                                min={100}
                                max={10000}
                                step={50}
                                value={config.pricePerVideoVnd || 700}
                                onChange={e => setConfig(prev => ({ ...prev, pricePerVideoVnd: Number(e.target.value) }))}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '2px solid #059669',
                                    background: '#f0fdf4',
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                    color: '#065f46'
                                }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Trừ vào số dư PayOS của người dùng</span>
                        </div>
                    </div>

                    <div style={{
                        background: '#f0fdf4',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={16} style={{ color: '#059669' }} />
                            <span style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 600 }}>
                                Dự kiến thu lời ròng mỗi video tạo ra:
                            </span>
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#15803d', fontFamily: 'monospace' }}>
                            +{estimatedNetProfit.toLocaleString('vi-VN')}đ / lượt (Biên lợi nhuận ~{((estimatedNetProfit / (config.pricePerVideoVnd || 1)) * 100).toFixed(1)}%)
                        </span>
                    </div>
                </div>

                {/* 5. Default Parameters (Duration & Aspect Ratio) */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Sliders size={18} style={{ color: '#6366f1' }} />
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                            Thông số Render Mặc định
                        </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                Thời lượng mặc định
                            </label>
                            <select
                                value={config.defaultDuration || 5}
                                onChange={e => setConfig(prev => ({ ...prev, defaultDuration: Number(e.target.value) }))}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.88rem',
                                    color: '#0f172a',
                                    outline: 'none'
                                }}
                            >
                                <option value={3}>3 Giây (Chỉ OpenRouter Grok/Wan)</option>
                                <option value={5}>5 Giây (Tương thích cả idea.ai & OpenRouter)</option>
                                <option value={10}>10 Giây (Cân bằng tiêu chuẩn)</option>
                                <option value={15}>15 Giây (Thời lượng dài tối đa)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                Tỷ lệ khung hình mặc định
                            </label>
                            <select
                                value={config.defaultAspectRatio || '16:9'}
                                onChange={e => setConfig(prev => ({ ...prev, defaultAspectRatio: e.target.value as any }))}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.88rem',
                                    color: '#0f172a',
                                    outline: 'none'
                                }}
                            >
                                <option value="16:9">16:9 (Ngang - Youtube / TV)</option>
                                <option value="9:16">9:16 (Dọc - TikTok / Reels / Shorts)</option>
                                <option value="1:1">1:1 (Vuông - Instagram)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary"
                        style={{
                            minHeight: '44px',
                            padding: '10px 24px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #ea580c 100%)',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.28)'
                        }}
                    >
                        <Save size={18} />
                        {saving ? 'Đang lưu cấu hình...' : 'Lưu cấu hình Video AI'}
                    </button>
                </div>
            </form>
        </section>
    );
};
