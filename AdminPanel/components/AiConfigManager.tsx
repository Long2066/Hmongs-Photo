import React, { useState, useEffect } from 'react';
import {
    Cpu,
    Server,
    Key,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ExternalLink,
    Eye,
    EyeOff,
    Save,
    Zap,

    Radio,
    Clock,
    UserCheck,
    Layers,
    Sparkles
} from 'lucide-react';
import {
    getAiProxyConfig,
    saveAiProxyConfig,
    checkProxyConnection,
    AiProxyConfig,
    DEFAULT_AI_PROXY_CONFIG
} from '../services/adminFirebaseService';
import { AdminUser } from '../services/adminAuthService';

interface AiConfigManagerProps {
    admin: AdminUser;
}

const SUPPORTED_TEXT_MODELS = [
    { id: 'claude-opus-5-5-high', name: 'Claude Opus 5.5', tag: 'Ưu tiên 1', color: '#8b5cf6' },
    { id: 'chatgpt-6.1-sol', name: 'ChatGPT 6.1 Sol', tag: 'Ưu tiên 2', color: '#3b82f6' },
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon', tag: 'Ưu tiên 3', color: '#10b981' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Ưu tiên 4', color: '#f59e0b' },
];

const SUPPORTED_IMAGE_MODELS = [
    { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash' },
    { id: 'gpt-image-2.5', name: 'GPT Image 2.5' },
    { id: 'gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare' },
    { id: 'gpt-image-2.5-sunburst', name: 'GPT Image 2.5 Sunburst' },
    { id: 'gpt-image-2', name: 'GPT Image 2' },
    { id: 'gpt-image-1.5', name: 'GPT Image 1.5' },
];

const PRESETS = [
    { label: 'Cloudflare Tunnel', url: 'https://mrna-consistent-temp-anthropology.trycloudflare.com/v1' },
    { label: 'VPS Cloud', url: 'http://158.178.235.87:20128/v1' },
    { label: 'Localhost', url: 'http://127.0.0.1:8317/v1' },
];

export const AiConfigManager: React.FC<AiConfigManagerProps> = ({ admin }) => {
    const [config, setConfig] = useState<AiProxyConfig>(DEFAULT_AI_PROXY_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [statusResult, setStatusResult] = useState<{
        connected: boolean;
        latencyMs?: number;
        models?: string[];
        error?: string;
        checkedAt?: number;
    } | null>(null);
    const [pricingSaving, setPricingSaving] = useState<string | null>(null);

    // Auto-save & sync model pricing immediately to Firestore
    const handleToggleModelPricing = async (modelId: string, currentIsPaid: boolean) => {
        const nextIsPaid = !currentIsPaid;
        const currentPricing = config.modelPricing || {
            'gemini-3.1-flash-image': false,
            'gpt-image-2.5': true,
            'gpt-image-2.5-flare': true,
            'gpt-image-2.5-sunburst': true,
            'gpt-image-2': true,
            'gpt-image-1.5': false
        };
        const updatedPricing = {
            ...currentPricing,
            [modelId]: nextIsPaid
        };
        const updatedConfig = {
            ...config,
            modelPricing: updatedPricing
        };
        setConfig(updatedConfig);
        setPricingSaving(modelId);
        try {
            await saveAiProxyConfig(updatedConfig, admin.email || 'admin');
            console.log(`[AiConfigManager] Auto-synced model pricing to Cloud: ${modelId} -> ${nextIsPaid ? 'PAID' : 'FREE'}`);
        } catch (err) {
            console.error('Failed to auto-save model pricing:', err);
        } finally {
            setTimeout(() => setPricingSaving(null), 800);
        }
    };

    // Load initial config from Cloud Firestore
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const current = await getAiProxyConfig();
            setConfig(current);
            // Run an initial quick connection test
            testConnection(current.url, current.apiKey);
        } catch (err: any) {
            console.error('Failed to load AI Proxy config:', err);
            setLoadError(err?.message || 'Không đọc được cấu hình từ Firestore');
        } finally {
            setLoading(false);
        }
    };

    const testConnection = async (urlToTest?: string, keyToTest?: string) => {
        setTesting(true);
        const url = urlToTest !== undefined ? urlToTest : config.url;
        const key = keyToTest !== undefined ? keyToTest : config.apiKey;

        try {
            const res = await checkProxyConnection(url, key);
            setStatusResult({
                ...res,
                checkedAt: Date.now()
            });
        } catch (err: any) {
            setStatusResult({
                connected: false,
                error: err.message || 'Lỗi kiểm tra kết nối',
                checkedAt: Date.now()
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);
        setSaveSuccess(false);

        try {
            await saveAiProxyConfig(config, admin.email || 'admin');
            setSaveSuccess(true);
            // Also refresh connection status with the saved parameters
            await testConnection(config.url, config.apiKey);
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (err: any) {
            alert('Lỗi lưu cấu hình: ' + (err.message || 'Không thể ghi dữ liệu'));
        } finally {
            setSaving(false);
        }
    };

    const applyPreset = (presetUrl: string) => {
        setConfig(prev => ({
            ...prev,
            url: presetUrl
        }));
    };

    const openWebDashboard = () => {
        try {
            const parsed = new URL(config.url);
            const webBase = `${parsed.protocol}//${parsed.host}`;
            window.open(webBase, '_blank', 'noopener,noreferrer');
        } catch {
            window.open('http://158.178.235.87:20128/', '_blank', 'noopener,noreferrer');
        }
    };

    const formatTimestamp = (ts?: number) => {
        if (!ts) return 'Chưa có thông tin';
        return new Date(ts).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="user-list-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang tải thông số cấu hình AI Proxy...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="user-list-container" style={{ maxWidth: '960px', margin: '0 auto' }}>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                            }}>
                                <Cpu size={22} />
                            </div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                Cấu hình AI Tool
                            </h1>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid rgba(5, 150, 105, 0.2)',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase'
                            }}>
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#059669',
                                    boxShadow: '0 0 6px #059669'
                                }} />
                                Realtime Sync
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => testConnection()}
                            disabled={testing}
                            className="btn btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '42px' }}
                            title="Kiểm tra kết nối tới Endpoint hiện tại"
                        >
                            <RefreshCw size={16} className={testing ? 'loading-spinner' : ''} />
                            Kiểm tra kết nối
                        </button>
                    </div>
                </div>
            </div>

            {/* Load Error Banner */}
            {loadError && (
                <div role="alert" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 18px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--border-radius)',
                    color: '#991b1b',
                    marginBottom: '20px'
                }}>
                    <XCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.85rem', lineHeight: 1.6 }}>
                        <strong>Không tải được cấu hình đã lưu.</strong> {loadError}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={loadConfig} style={{ minHeight: '44px' }}>
                        <RefreshCw size={16} /> Thử lại
                    </button>
                </div>
            )}

            {/* Success Toast Banner */}
            {saveSuccess && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 18px',
                    background: '#ecfdf5',
                    border: '1px solid #10b981',
                    borderRadius: 'var(--border-radius)',
                    color: '#065f46',
                    marginBottom: '20px',
                    boxShadow: 'var(--shadow-sm)',
                    animation: 'fadeIn 0.25s ease'
                }}>
                    <CheckCircle2 size={20} style={{ color: '#059669', flexShrink: 0 }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Đã lưu & đồng bộ thời gian thực thành công!</div>
                </div>
            )}

            {/* Master Toggle & Live Status Banner */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                padding: '20px 24px',
                marginBottom: '24px',
                boxShadow: 'var(--shadow-xs)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Custom Animated Toggle Switch */}
                        <button
                            type="button"
                            role="switch"
                            aria-checked={config.enabled}
                            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                            style={{
                                width: '56px',
                                height: '32px',
                                borderRadius: '9999px',
                                background: config.enabled ? '#10b981' : '#cbd5e1',
                                border: 'none',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 0.2s ease',
                                outline: 'none',
                                padding: '3px',
                                display: 'inline-flex',
                                alignItems: 'center'
                            }}
                            title={config.enabled ? 'Nhấp để TẮT' : 'Nhấp để BẬT'}
                        >
                            <span style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: '#ffffff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transform: config.enabled ? 'translateX(24px)' : 'translateX(0px)',
                                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Zap size={14} style={{ color: config.enabled ? '#059669' : '#94a3b8' }} />
                            </span>
                        </button>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                    {config.enabled ? 'Cấu hình đang BẬT' : 'Cấu hình đang TẮT'}
                                </h3>
                                {config.enabled ? (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}>
                                        ACTIVE
                                    </span>
                                ) : (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: '#fef2f2',
                                        color: '#dc2626',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        border: '1px solid rgba(220, 38, 38, 0.3)'
                                    }}>
                                        PAUSED
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Ping Status Indicator */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 16px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-light)'
                    }}>
                        {statusResult === null ? (
                            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Chưa kiểm tra</span>
                        ) : statusResult.connected ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: '#059669',
                                    fontSize: '0.825rem',
                                    fontWeight: 700
                                }}>
                                    <Radio size={14} className="text-emerald-600" />
                                    ONLINE
                                </span>
                                {statusResult.latencyMs !== undefined && (
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        fontFamily: 'monospace',
                                        background: 'rgba(5, 150, 105, 0.08)',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}>
                                        {statusResult.latencyMs}ms
                                    </span>
                                )}
                                {statusResult.models && statusResult.models.length > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        ({statusResult.models.length} models)
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: '#dc2626',
                                    fontSize: '0.825rem',
                                    fontWeight: 700
                                }}>
                                    <XCircle size={14} />
                                    OFFLINE
                                </span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    color: '#b91c1c',
                                    maxWidth: '220px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }} title={statusResult.error}>
                                    {statusResult.error || 'Không kết nối được'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Form */}
            <form onSubmit={handleSave}>
                {/* Server Endpoint Card */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: 'var(--shadow-xs)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Server size={18} style={{ color: 'var(--accent-primary)' }} />
                                API Endpoint (CLIProxyAPI)
                            </h3>
                        </div>

                        {/* Presets */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cài nhanh:</span>
                            {PRESETS.map(preset => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => applyPreset(preset.url)}
                                    className="btn btn-secondary"
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        background: config.url === preset.url ? 'var(--accent-light)' : undefined,
                                        borderColor: config.url === preset.url ? 'var(--accent-primary)' : undefined,
                                        color: config.url === preset.url ? 'var(--accent-primary)' : undefined
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Endpoint Input */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--border-radius-sm)',
                            padding: '0 14px',
                            transition: 'border-color 0.2s ease',
                            position: 'relative'
                        }}>
                            <Server size={16} style={{ color: 'var(--text-muted)', marginRight: '10px', flexShrink: 0 }} />
                            <input
                                type="text"
                                value={config.url}
                                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
                                placeholder="http://158.178.235.87:20128/v1"
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 0',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                    </div>

                    {/* API Key Input */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Key size={16} style={{ color: 'var(--accent-primary)' }} />
                                API Key (Khóa bảo mật)
                            </span>
                        </label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--border-radius-sm)',
                            padding: '0 14px',
                            transition: 'border-color 0.2s ease'
                        }}>
                            <Key size={16} style={{ color: 'var(--text-muted)', marginRight: '10px', flexShrink: 0 }} />
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={config.apiKey}
                                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder="Nhập API Key CLIProxyAPI (nếu có)..."
                                style={{
                                    width: '100%',
                                    padding: '12px 0',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    fontFamily: showApiKey ? 'monospace' : undefined,
                                    fontSize: '0.9rem',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title={showApiKey ? 'Ẩn khóa' : 'Hiện khóa'}
                            >
                                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Web Dashboard External Link Button */}
                    <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                            type="button"
                            onClick={openWebDashboard}
                            className="btn btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem' }}
                        >
                            <ExternalLink size={16} />
                            Mở Web Dashboard Proxy
                        </button>
                    </div>
                </div>

                {/* AI Models Configuration Card */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: 'var(--shadow-xs)'
                }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
                        Cấu hình Mô hình AI (Models)
                    </h3>

                    {/* Text / Prompt Model Configuration (Multi-model Auto-fallback) */}
                    <div style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '16px',
                        marginBottom: '20px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={16} style={{ color: '#d97706' }} />
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Text Model (Prompt & Phân tích)
                                </span>
                            </div>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                            }}>
                                🔄 Tự động thay phiên (Fallback)
                            </span>
                        </div>

                        {/* Primary Selector */}
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Mô hình ưu tiên khởi đầu:
                            </label>
                            <select
                                value={config.defaultTextModel || 'claude-opus-5-5-high'}
                                onChange={(e) => setConfig(prev => ({ ...prev, defaultTextModel: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    fontSize: '0.88rem',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {SUPPORTED_TEXT_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Cascade Fallback Visual Chain */}
                        <div>
                            <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Thứ tự ưu tiên luân phiên:
                            </span>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '8px'
                            }}>
                                {SUPPORTED_TEXT_MODELS.map((m, idx) => {
                                    const isSelected = (config.defaultTextModel || 'claude-opus-5-5-high') === m.id;
                                    return (
                                        <div
                                            key={m.id}
                                            onClick={() => setConfig(prev => ({ ...prev, defaultTextModel: m.id }))}
                                            style={{
                                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                                border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
                                                borderRadius: '8px',
                                                padding: '10px 12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 800,
                                                    color: m.color,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {idx === 0 ? '① ' : idx === 1 ? '② ' : idx === 2 ? '③ ' : '④ '} {m.tag}
                                                </span>
                                                {isSelected && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                                        ● Đang chọn
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {m.name}
                                            </div>
                                            <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {m.id}
                                            </code>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Default Image Model Selector */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                            Mô hình tạo ảnh mặc định
                        </label>
                        <select
                            value={config.defaultImageModel || 'gemini-3.1-flash-image'}
                            onChange={(e) => setConfig(prev => ({ ...prev, defaultImageModel: e.target.value }))}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {SUPPORTED_IMAGE_MODELS.map(model => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Model Pricing & Access Policy (Free vs Paid Toggle) */}
                    <div style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-light)'
                    }}>
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: 'var(--accent-primary)',
                                    fontWeight: 700,
                                    fontSize: '0.85rem'
                                }}>
                                    $
                                </span>
                                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Chính sách: Trả phí / Miễn phí
                                </h4>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '10px'
                        }}>
                            {SUPPORTED_IMAGE_MODELS.map(model => {
                                const pricingMap = config.modelPricing || {
                                    'gemini-3.1-flash-image': false,
                                    'gpt-image-2.5': true,
                                    'gpt-image-2.5-flare': true,
                                    'gpt-image-2.5-sunburst': true,
                                    'gpt-image-2': true,
                                    'gpt-image-1.5': false
                                };
                                const isPaid = pricingMap[model.id] ?? (model.id !== 'gemini-3.1-flash-image' && model.id !== 'gpt-image-1.5');

                                return (
                                    <div
                                        key={model.id}
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: `1px solid ${isPaid ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                                            borderRadius: '8px',
                                            padding: '12px 14px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            gap: '8px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {model.name}
                                            </span>

                                            <span style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: '9999px',
                                                background: isPaid ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                color: isPaid ? '#d97706' : '#059669',
                                                border: `1px solid ${isPaid ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                                letterSpacing: '0.04em'
                                            }}>
                                                {isPaid ? 'TRẢ PHÍ' : 'MIỄN PHÍ'}
                                            </span>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderTop: '1px solid var(--border-light)',
                                            paddingTop: '8px',
                                            marginTop: '4px'
                                        }}>
                                            <span style={{ fontSize: '0.74rem', color: isPaid ? '#d97706' : '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {pricingSaving === model.id ? (
                                                    <span style={{ color: '#6366f1' }}>Đang lưu...</span>
                                                ) : (
                                                    isPaid ? 'Khóa khi 0đ' : 'Không giới hạn'
                                                )}
                                            </span>

                                            <div
                                                role="switch"
                                                aria-checked={isPaid}
                                                tabIndex={0}
                                                onClick={() => handleToggleModelPricing(model.id, isPaid)}
                                                style={{
                                                    width: '38px',
                                                    height: '22px',
                                                    borderRadius: '11px',
                                                    background: isPaid ? '#f59e0b' : '#10b981',
                                                    position: 'relative',
                                                    cursor: pricingSaving === model.id ? 'wait' : 'pointer',
                                                    transition: 'background-color 0.2s ease',
                                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
                                                    opacity: pricingSaving === model.id ? 0.7 : 1
                                                }}
                                                title={isPaid ? 'Bấm để chuyển sang Miễn phí' : 'Bấm để chuyển sang Trả phí'}
                                            >
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '50%',
                                                    background: '#ffffff',
                                                    position: 'absolute',
                                                    top: '2px',
                                                    left: isPaid ? '18px' : '2px',
                                                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Audit & Sync Info Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '16px 20px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--border-radius)',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} />
                            Cập nhật gần nhất: <strong style={{ color: 'var(--text-primary)' }}>{formatTimestamp(config.updatedAt)}</strong>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <UserCheck size={14} />
                            Thực hiện bởi: <strong style={{ color: 'var(--text-primary)' }}>{config.updatedBy || 'Chưa rõ'}</strong>
                        </span>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 24px',
                            minHeight: '46px',
                            fontSize: '0.925rem',
                            fontWeight: 700,
                            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
                        }}
                    >
                        {saving ? (
                            <>
                                <div className="loading-spinner" style={{ width: '18px', height: '18px' }} />
                                Đang đồng bộ Cloud...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Lưu & Đồng bộ Cloud (Realtime Sync)
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AiConfigManager;
