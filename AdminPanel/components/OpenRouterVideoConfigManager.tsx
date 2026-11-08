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
    Layers,} from 'lucide-react';
import {
    getVideoConfig,
    saveVideoConfig,
    testOpenRouterApiKey,
    OpenRouterVideoConfig,
    DEFAULT_VIDEO_CONFIG
} from '../services/videoConfigService';
import type { AdminUser } from '../services/adminAuthService';

interface OpenRouterVideoConfigManagerProps {
    admin: AdminUser;
}

const SUPPORTED_VIDEO_MODELS = [
    {
        id: 'google/gemini-omni-1.2-flash',
        name: 'Google Gemini Omni 1.2 Flash (Chính)',
        badge: 'Ưu tiên 1 - Bản mới nhất',
        desc: 'Hỗ trợ video dài tới 15s, có âm thanh gốc, tạo từ ảnh và văn bản',
        costEstimate: '~450đ – 600đ / video'
    },
    {
        id: 'google/gemini-omni-1.1-flash',
        name: 'Google Gemini Omni 1.1 Flash (Dự phòng)',
        badge: 'Ưu tiên 2 - Tự động Failover',
        desc: 'Tự động kích hoạt thay thế khi bản 1.2 bận, lỗi 429 hoặc quá tải',
        costEstimate: '~450đ – 600đ / video'
    }
];

export const OpenRouterVideoConfigManager: React.FC<OpenRouterVideoConfigManagerProps> = ({ admin }) => {
    const [config, setConfig] = useState<OpenRouterVideoConfig>(DEFAULT_VIDEO_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [testResult, setTestResult] = useState<{
        valid: boolean;
        label?: string;
        usage?: number;
        limit?: number | null;
        error?: string;
        checkedAt?: number;
    } | null>(null);

    useEffect(() => {
        let mounted = true;
        getVideoConfig()
            .then(res => {
                if (mounted) {
                    setConfig(res);
                    if (res.openRouterApiKey) {
                        handleTestKey(res.openRouterApiKey);
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

    const handleTestKey = async (keyToTest?: string) => {
        const key = (keyToTest !== undefined ? keyToTest : config.openRouterApiKey).trim();
        if (!key) {
            setTestResult({
                valid: false,
                error: 'Vui lòng nhập API Key OpenRouter trước khi kiểm tra',
                checkedAt: Date.now()
            });
            return;
        }

        setTesting(true);
        try {
            const res = await testOpenRouterApiKey(key);
            setTestResult({
                valid: res.valid,
                label: res.label,
                usage: res.usage,
                limit: res.limit,
                error: res.error,
                checkedAt: Date.now()
            });
        } catch (err: any) {
            setTestResult({
                valid: false,
                error: err?.message || 'Lỗi kiểm tra kết nối',
                checkedAt: Date.now()
            });
        } finally {
            setTesting(false);
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

    // Tự động tính giá bán đề xuất khi thay đổi giá vốn hoặc % markup
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
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang tải cấu hình OpenRouter Video AI...</p>
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
                        background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
                    }}>
                        <Video size={22} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 id="openrouter-video-config-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                                Cấu hình OpenRouter Video AI
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
                            Đồng bộ API Key OpenRouter và cấu hình giá bán trực tiếp sang công cụ Tạo Video ImageTool.
                        </p>
                    </div>
                </div>

                {/* Master Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: config.enabled ? '#047857' : '#94a3b8' }}>
                        {config.enabled ? 'Tính năng đang BẬT' : 'Tính năng đang TẮT'}
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
                    <span style={{ fontWeight: 600 }}>Đã lưu và đồng bộ thành công sang ImageTool!</span>
                </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
                {/* 1. OpenRouter API Key Input */}
                <div style={{
                    background: '#f8fafc',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <label htmlFor="openrouter-api-key" style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Key size={16} style={{ color: '#f59e0b' }} />
                            <span>OpenRouter API Key (sk-or-v1-...)</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => handleTestKey()}
                            disabled={testing || !config.openRouterApiKey}
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
                            <RefreshCw size={14} className={testing ? 'loading-spinner' : ''} />
                            Kiểm tra kết nối
                        </button>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '0 14px',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
                    }}>
                        <input
                            id="openrouter-api-key"
                            type={showKey ? 'text' : 'password'}
                            value={config.openRouterApiKey}
                            onChange={e => setConfig(prev => ({ ...prev, openRouterApiKey: e.target.value }))}
                            placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            style={{
                                width: '100%',
                                padding: '12px 0',
                                border: 'none',
                                outline: 'none',
                                fontFamily: showKey ? 'monospace' : undefined,
                                fontSize: '0.88rem',
                                color: '#0f172a',
                                background: 'transparent'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title={showKey ? 'Ẩn khóa' : 'Hiện khóa'}
                        >
                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Test Key Status Display */}
                    {testResult && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: testResult.valid ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${testResult.valid ? '#a7f3d0' : '#fecaca'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {testResult.valid ? (
                                    <CheckCircle2 size={16} style={{ color: '#059669' }} />
                                ) : (
                                    <XCircle size={16} style={{ color: '#dc2626' }} />
                                )}
                                <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    color: testResult.valid ? '#047857' : '#991b1b'
                                }}>
                                    {testResult.valid ? 'API Key hợp lệ và sẵn sàng tạo video!' : (testResult.error || 'API Key không hợp lệ')}
                                </span>
                            </div>
                            {testResult.valid && testResult.usage !== undefined && (
                                <span style={{ fontSize: '0.78rem', color: '#047857', fontFamily: 'monospace' }}>
                                    Đã dùng: ${(testResult.usage).toFixed(3)} {testResult.limit ? `/ Giới hạn: $${testResult.limit}` : ''}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. Dual Model Architecture (Primary & Failover) */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={18} style={{ color: '#f59e0b' }} />
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                                Kiến trúc 2 Mô hình (Chính & Tự động Dự phòng)
                            </h3>
                        </div>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef3c7',
                            color: '#b45309',
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
                            background: '#fffbeb',
                            borderRadius: '12px',
                            padding: '14px',
                            border: '1px solid #fde68a'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                                    ① Mô hình chính
                                </span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
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
                                    border: '1px solid #f59e0b',
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
                            <p style={{ margin: 0, fontSize: '0.76rem', color: '#78350f', lineHeight: 1.5 }}>
                                Tạo clip 15s có âm thanh gốc, hỗ trợ Text-to-Video và Image-to-Video cực nét.
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
                                Tự động chuyển qua khi bản 1.2 bận, gặp lỗi 429 hoặc đang bảo trì, đảm bảo người dùng không bị gián đoạn.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. Pricing & Profit Margin (+10%) */}
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
                        {/* Giá vốn OpenRouter */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                Giá vốn gốc OpenRouter (VND / video)
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
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Gốc ~450đ – 600đ ($0.024)</span>
                        </div>

                        {/* Tỷ lệ lời % */}
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

                        {/* Giá bán niêm yết người dùng ImageTool trả */}
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

                    {/* Summary Profit Pill */}
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

                {/* 4. Default Parameters (Duration & Aspect Ratio) */}
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
                                <option value={5}>5 Giây (Tiết kiệm & Nhanh)</option>
                                <option value={10}>10 Giây (Cân bằng tiêu chuẩn)</option>
                                <option value={15}>15 Giây (Tối đa của Omni 1.2)</option>
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
                            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
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
