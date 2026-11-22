import React, { useEffect, useMemo, useState } from 'react';
import {
    Check,
    Lock,
    Plus,
    Trash2,
    Save,
    RotateCcw,
    Sparkles,
    ArrowUp,
    ArrowDown,
    Eye,
    EyeOff,
    ShieldCheck,
    Sliders,
    Wand2,
} from 'lucide-react';
import { AdminUser } from '../services/adminAuthService';
import {
    ALL_IMAGE_MODEL_OPTIONS,
    DEFAULT_SUBSCRIPTION_PLANS_CONFIG,
    MODEL_LABEL_MAP,
    buildAutoFeatureItems,
    cleanModelId,
    computeDiscountStats,
    formatVndCompact,
    getAdminSubscriptionPlansConfig,
    resetSubscriptionPlansConfig,
    sanitizeSubscriptionPlansConfig,
    saveSubscriptionPlansConfig,
    type MaxResolution,
    type PlanConfig,
    type PlanFeatureItem,
    type PlanId,
    type SubscriptionPlansConfig,
} from '../services/subscriptionPlanAdminService';

interface PackageConfigManagerProps {
    admin: AdminUser;
}

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderHighlightedText = (
    text: string,
    highlight: string | undefined,
    strongStyle: React.CSSProperties
): React.ReactNode => {
    const tokens = (highlight || '')
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (tokens.length === 0) return text;
    const regex = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'g');
    const parts = text.split(regex);
    const tokenSet = new Set(tokens);
    return parts.map((part, idx) =>
        tokenSet.has(part) ? (
            <strong key={idx} style={strongStyle}>
                {part}
            </strong>
        ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
        )
    );
};

const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--shadow-xs)',
    padding: '22px',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: '#ffffff',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    lineHeight: 1.4,
    outline: 'none',
    transition: 'border-color 0.15s ease',
};

const sectionHeadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    paddingBottom: '10px',
    marginBottom: '14px',
    borderBottom: '1px solid var(--border-light)',
    fontSize: '0.88rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const monoStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontVariantNumeric: 'tabular-nums',
};

const TIER_META: Record<PlanId, { title: string; accent: string; softBg: string }> = {
    plus: { title: 'Gói Cơ bản', accent: '#059669', softBg: '#ecfdf5' },
    pro: { title: 'Gói Nâng cao', accent: '#4f46e5', softBg: '#eef2ff' },
    vip: { title: 'Gói Cao cấp', accent: '#d97706', softBg: '#fffbeb' },
    free: { title: 'Gói Free', accent: '#475569', softBg: '#f1f5f9' },
};

const PackageConfigManager: React.FC<PackageConfigManagerProps> = ({ admin }) => {
    const [draft, setDraft] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS_CONFIG);
    const [savedSnapshot, setSavedSnapshot] = useState<string>('');
    const [activeTier, setActiveTier] = useState<PlanId>('plus');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [confirmReset, setConfirmReset] = useState<boolean>(false);
    const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    useEffect(() => {
        let mounted = true;
        getAdminSubscriptionPlansConfig()
            .then((loaded) => {
                if (!mounted) return;
                setDraft(loaded);
                setSavedSnapshot(JSON.stringify({ free: loaded.free, plus: loaded.plus, pro: loaded.pro, vip: loaded.vip }));
            })
            .catch((err) => {
                if (!mounted) return;
                setStatusBanner({
                    type: 'error',
                    message: `Không tải được cấu hình hiện tại: ${err?.message || 'Lỗi Firestore'}`,
                });
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const isDirty = useMemo(() => {
        if (!savedSnapshot) return false;
        const current = JSON.stringify({ free: draft.free, plus: draft.plus, pro: draft.pro, vip: draft.vip });
        return current !== savedSnapshot;
    }, [draft, savedSnapshot]);

    const currentPlan = draft[activeTier];
    const discountStats = computeDiscountStats(currentPlan.price, currentPlan.originalPrice);

    const updatePlanField = <K extends keyof PlanConfig>(tier: PlanId, key: K, value: PlanConfig[K]) => {
        setDraft((prev) => ({
            ...prev,
            [tier]: {
                ...prev[tier],
                [key]: value,
            },
        }));
    };

    const toggleAllowedModel = (tier: PlanId, modelId: string) => {
        const clean = cleanModelId(modelId);
        setDraft((prev) => {
            const list = prev[tier].allowedImageModels;
            const exists = list.some((m) => cleanModelId(m) === clean);
            const next = exists
                ? list.filter((m) => cleanModelId(m) !== clean)
                : [...list, clean];
            return {
                ...prev,
                [tier]: {
                    ...prev[tier],
                    allowedImageModels: next,
                },
            };
        });
    };

    const updateFeatureItem = (
        tier: PlanId,
        index: number,
        patch: Partial<PlanFeatureItem>
    ) => {
        setDraft((prev) => {
            const items = [...prev[tier].featureItems];
            items[index] = { ...items[index], ...patch };
            return {
                ...prev,
                [tier]: {
                    ...prev[tier],
                    featureItems: items,
                },
            };
        });
    };

    const addFeatureItem = (tier: PlanId) => {
        setDraft((prev) => ({
            ...prev,
            [tier]: {
                ...prev[tier],
                featureItems: [
                    ...prev[tier].featureItems,
                    {
                        id: `${tier}-${Date.now()}`,
                        icon: 'check',
                        text: 'Quyền lợi mới cho khách hàng',
                        highlight: '',
                    },
                ],
            },
        }));
    };

    const moveFeatureItem = (tier: PlanId, index: number, direction: -1 | 1) => {
        setDraft((prev) => {
            const items = [...prev[tier].featureItems];
            const target = index + direction;
            if (target < 0 || target >= items.length) return prev;
            const temp = items[index];
            items[index] = items[target];
            items[target] = temp;
            return {
                ...prev,
                [tier]: {
                    ...prev[tier],
                    featureItems: items,
                },
            };
        });
    };

    const removeFeatureItem = (tier: PlanId, index: number) => {
        setDraft((prev) => {
            if (prev[tier].featureItems.length <= 1) return prev;
            return {
                ...prev,
                [tier]: {
                    ...prev[tier],
                    featureItems: prev[tier].featureItems.filter((_, i) => i !== index),
                },
            };
        });
    };

    const handleSyncCopyFromSpecs = (tier: PlanId) => {
        setDraft((prev) => {
            const p = prev[tier];
            const autoItems = buildAutoFeatureItems(tier, p, MODEL_LABEL_MAP);
            const disc = computeDiscountStats(p.price, p.originalPrice);

            const autoSubtitle = tier === 'free'
                ? `Dành cho người mới (${p.dailyFreeLimit} ảnh/ngày)`
                : `${p.unlimitedImages ? 'Tạo ảnh không giới hạn' : `${p.totalImages} ảnh`} + ${p.videoSeconds}s Video AI • Tối đa ${p.maxResolution}`;

            const autoSummary = tier === 'free'
                ? `Tặng ${p.dailyFreeLimit} ảnh / ngày + ${p.videoSeconds}s video cho tài khoản mới`
                : p.unlimitedImages
                    ? `Tạo ảnh không giới hạn + ${p.videoSeconds} giây Video AI`
                    : `${p.totalImages} ảnh + ${p.videoSeconds} giây Video AI (hạn ${p.durationDays} ngày)`;

            const autoPeriod = tier === 'free' ? '/ ngày' : `/ ${p.durationDays} ngày`;
            const autoCta = tier === 'free'
                ? 'Gói cơ bản miễn phí'
                : `Mua ${p.name} — ${formatVndCompact(p.price)}`;
            const autoTopUp = tier === 'free'
                ? ''
                : `Mua thêm ${p.name} — ${formatVndCompact(p.price)}`;

            return {
                ...prev,
                [tier]: {
                    ...p,
                    subtitle: autoSubtitle,
                    quotaSummary: autoSummary,
                    periodLabel: autoPeriod,
                    badge: tier === 'plus' && disc.hasDiscount ? `GIẢM ${disc.discountPercent}%` : p.badge,
                    ctaText: autoCta,
                    ctaTopUpText: autoTopUp,
                    featureItems: autoItems,
                },
            };
        });
        setStatusBanner({
            type: 'info',
            message: `Đã tự động cập nhật mô tả, tiêu đề phụ, CTA và 4 dòng quyền lợi của ${TIER_META[tier].title} theo thông số vừa nhập. Nhớ bấm "Lưu & Đồng bộ Live" để áp dụng.`,
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setStatusBanner(null);
        try {
            const adminEmail = admin.email || admin.displayName || 'admin';
            const cleanToSave = sanitizeSubscriptionPlansConfig(draft);
            const saved = await saveSubscriptionPlansConfig(cleanToSave, adminEmail);
            setDraft(saved);
            setSavedSnapshot(JSON.stringify({ free: saved.free, plus: saved.plus, pro: saved.pro, vip: saved.vip }));
            setStatusBanner({
                type: 'success',
                message: 'Đã lưu cấu hình gói dịch vụ thành công! Tool người dùng, PayOS Checkout và Bot Hỗ trợ đã được đồng bộ realtime.',
            });
        } catch (err: any) {
            setStatusBanner({
                type: 'error',
                message: `Không thể lưu cấu hình: ${err?.message || 'Vui lòng kiểm tra quyền Admin trên Firestore'}`,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        setSaving(true);
        setConfirmReset(false);
        setStatusBanner(null);
        try {
            const adminEmail = admin.email || admin.displayName || 'admin';
            const saved = await resetSubscriptionPlansConfig(adminEmail);
            setDraft(saved);
            setSavedSnapshot(JSON.stringify({ free: saved.free, plus: saved.plus, pro: saved.pro, vip: saved.vip }));
            setStatusBanner({
                type: 'success',
                message: 'Đã khôi phục toàn bộ thông số 3 gói về cấu hình mặc định ban đầu và đồng bộ live.',
            });
        } catch (err: any) {
            setStatusBanner({
                type: 'error',
                message: `Lỗi khôi phục mặc định: ${err?.message || 'Vui lòng thử lại'}`,
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="page-header">
                    <h1>Cấu hình Gói dịch vụ</h1>
                    <p>Đang tải cấu hình từ Firestore...</p>
                </div>
                <div className="loading-container">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    const previewCardCommon: React.CSSProperties = {
        borderRadius: '16px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        position: 'relative',
    };

    return (
        <div className="dashboard" style={{ maxWidth: '1540px' }}>
            <style>{`
                .pkg-editor-grid {
                    display: grid;
                    grid-template-columns: minmax(400px, 1.05fr) minmax(460px, 1.15fr);
                    gap: 24px;
                    align-items: start;
                }
                .pkg-preview-cards {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                    align-items: stretch;
                    padding-top: 14px;
                }
                .pkg-field-2col {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .pkg-editor-grid input:focus-visible,
                .pkg-editor-grid select:focus-visible,
                .pkg-editor-grid button:focus-visible {
                    outline: 2px solid var(--accent-primary);
                    outline-offset: 1px;
                }
                @media (max-width: 1400px) {
                    .pkg-preview-cards {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }
                @media (max-width: 1280px) {
                    .pkg-editor-grid {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 820px) {
                    .pkg-preview-cards {
                        grid-template-columns: 1fr;
                    }
                    .pkg-field-2col {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '16px',
                    marginBottom: '22px',
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            Cấu hình Gói dịch vụ (Live No-Code)
                        </h1>
                        {isDirty ? (
                            <span
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                }}
                            >
                                Có thay đổi chưa lưu
                            </span>
                        ) : (
                            <span
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                }}
                            >
                                Đã đồng bộ Cloud
                            </span>
                        )}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Chỉnh sửa trực tiếp giá, hạn mức ảnh/giây video, độ phân giải, model AI mở khóa và nội dung hiển thị trên Tool không cần đụng code.
                    </p>
                    {draft.updatedAt > 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px', ...monoStyle }}>
                            Lưu gần nhất: {new Date(draft.updatedAt).toLocaleString('vi-VN')} bởi {draft.updatedBy || 'Admin'}
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {!confirmReset ? (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={saving}
                            onClick={() => setConfirmReset(true)}
                        >
                            <RotateCcw size={16} />
                            <span>Khôi phục mặc định</span>
                        </button>
                    ) : (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '10px',
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9f1239' }}>
                                Khôi phục về gốc?
                            </span>
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={saving}
                                onClick={handleResetDefaults}
                            >
                                Xác nhận
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={saving}
                                onClick={() => setConfirmReset(false)}
                            >
                                Hủy
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={handleSave}
                        style={{ minWidth: '185px' }}
                    >
                        <Save size={17} />
                        <span>{saving ? 'Đang đồng bộ...' : 'Lưu & Đồng bộ Live'}</span>
                    </button>
                </div>
            </div>

            {/* Inline Status Notification */}
            {statusBanner && (
                <div
                    role={statusBanner.type === 'error' ? 'alert' : 'status'}
                    style={{
                        marginBottom: '20px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        fontSize: '0.88rem',
                        fontWeight: 500,
                        background:
                            statusBanner.type === 'success'
                                ? '#ecfdf5'
                                : statusBanner.type === 'error'
                                ? '#fef2f2'
                                : '#eff6ff',
                        border:
                            statusBanner.type === 'success'
                                ? '1px solid #a7f3d0'
                                : statusBanner.type === 'error'
                                ? '1px solid #fecaca'
                                : '1px solid #bfdbfe',
                        color:
                            statusBanner.type === 'success'
                                ? '#065f46'
                                : statusBanner.type === 'error'
                                ? '#991b1b'
                                : '#1e40af',
                    }}
                >
                    <span>{statusBanner.message}</span>
                    <button
                        type="button"
                        onClick={() => setStatusBanner(null)}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            padding: '2px 6px',
                        }}
                        aria-label="Đóng thông báo"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="pkg-editor-grid">
                {/* LEFT COLUMN: DETAILED EDITOR */}
                <div style={cardStyle}>
                    {/* Tier Selector Tabs */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '8px',
                            padding: '6px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '12px',
                            marginBottom: '20px',
                        }}
                    >
                        {(['plus', 'pro', 'vip', 'free'] as PlanId[]).map((tierId) => {
                            const selected = activeTier === tierId;
                            const tierPlan = draft[tierId];
                            return (
                                <button
                                    key={tierId}
                                    type="button"
                                    onClick={() => setActiveTier(tierId)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '9px',
                                        border: selected ? '1px solid var(--border-color)' : '1px solid transparent',
                                        background: selected ? '#ffffff' : 'transparent',
                                        boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                                        color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontWeight: selected ? 700 : 600,
                                        fontSize: '0.86rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '2px',
                                    }}
                                >
                                    <span>{tierPlan.name || TIER_META[tierId].title}</span>
                                    <span style={{ fontSize: '0.72rem', color: tierPlan.enabled ? TIER_META[tierId].accent : '#94a3b8', ...monoStyle }}>
                                        {tierPlan.enabled ? formatVndCompact(tierPlan.price) : 'Đang ẩn'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Tier Visibility + Sync Action */}
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                            marginBottom: '18px',
                        }}
                    >
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: activeTier === 'free' ? 'default' : 'pointer', fontSize: '0.86rem', fontWeight: 600 }}>
                            <input
                                type="checkbox"
                                checked={currentPlan.enabled}
                                disabled={activeTier === 'free'}
                                onChange={(e) => updatePlanField(activeTier, 'enabled', e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                            />
                            {currentPlan.enabled ? <Eye size={16} color="#059669" /> : <EyeOff size={16} color="#64748b" />}
                            <span>
                                {activeTier === 'free'
                                    ? 'Gói Free luôn bật mặc định'
                                    : currentPlan.enabled
                                        ? 'Hiển thị gói này trên Tool & cho phép mua PayOS'
                                        : 'Tạm ẩn gói này trên Tool (khóa tạo đơn mua mới)'}
                            </span>
                        </label>

                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSyncCopyFromSpecs(activeTier)}
                            title="Tự tạo mô tả, tóm tắt, nút CTA và danh sách quyền lợi theo thông số bên dưới"
                        >
                            <Wand2 size={14} />
                            <span>Đồng bộ mô tả theo thông số</span>
                        </button>
                    </div>

                    {/* SECTION 1: FUNCTIONAL LIMITS & REAL ENFORCEMENT */}
                    <div style={{ marginBottom: '22px' }}>
                        <div style={sectionHeadingStyle}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <ShieldCheck size={16} color="#4f46e5" />
                                Thông số hệ thống thực thi (Quota, Giá, Model, Độ phân giải)
                            </span>
                        </div>

                        <div className="pkg-field-2col" style={{ marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>
                                    Giá bán VNĐ {activeTier === 'free' ? '(Miễn phí = 0)' : '(Tối thiểu 2.000đ cho PayOS)'}
                                </label>
                                <input
                                    type="number"
                                    min={activeTier === 'free' ? 0 : 2000}
                                    step={1000}
                                    disabled={activeTier === 'free'}
                                    value={currentPlan.price}
                                    onChange={(e) => updatePlanField(activeTier, 'price', Math.max(activeTier === 'free' ? 0 : 2000, Number(e.target.value) || 0))}
                                    style={{ ...inputStyle, ...monoStyle, background: activeTier === 'free' ? '#f8fafc' : '#ffffff' }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>
                                    Giá gốc gạch ngang VNĐ (0 = không hiển thị giảm giá)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={currentPlan.originalPrice}
                                    onChange={(e) => updatePlanField(activeTier, 'originalPrice', Math.max(0, Number(e.target.value) || 0))}
                                    style={{ ...inputStyle, ...monoStyle }}
                                />
                            </div>
                        </div>

                        {discountStats.hasDiscount && activeTier !== 'free' && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    background: '#ecfdf5',
                                    color: '#065f46',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    marginBottom: '12px',
                                }}
                            >
                                <span style={monoStyle}>
                                    Tự tính: Giảm {discountStats.discountPercent}% • Tiết kiệm {formatVndCompact(discountStats.savingsAmount)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => updatePlanField(activeTier, 'badge', `GIẢM ${discountStats.discountPercent}%`)}
                                    style={{
                                        border: '1px solid #10b981',
                                        background: '#ffffff',
                                        color: '#047857',
                                        borderRadius: '7px',
                                        padding: '3px 10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Gắn vào Badge
                                </button>
                            </div>
                        )}

                        <div className="pkg-field-2col" style={{ marginBottom: '12px' }}>
                            {activeTier === 'free' ? (
                                <div>
                                    <label style={labelStyle}>Số ảnh miễn phí / ngày</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={10000}
                                        value={currentPlan.dailyFreeLimit}
                                        onChange={(e) => updatePlanField('free', 'dailyFreeLimit', Math.max(0, Number(e.target.value) || 0))}
                                        style={{ ...inputStyle, ...monoStyle }}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label style={labelStyle}>Thời hạn gói (Số ngày)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={3650}
                                        value={currentPlan.durationDays}
                                        onChange={(e) => updatePlanField(activeTier, 'durationDays', Math.max(1, Number(e.target.value) || 30))}
                                        style={{ ...inputStyle, ...monoStyle }}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={labelStyle}>Số giây Video AI được cấp (giây)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100000}
                                    value={currentPlan.videoSeconds}
                                    onChange={(e) => updatePlanField(activeTier, 'videoSeconds', Math.max(0, Number(e.target.value) || 0))}
                                    style={{ ...inputStyle, ...monoStyle }}
                                />
                            </div>
                        </div>

                        <div className="pkg-field-2col" style={{ marginBottom: '12px' }}>
                            {activeTier !== 'free' ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <label style={{ ...labelStyle, marginBottom: 0 }}>Hạn mức ảnh của gói</label>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', fontWeight: 700, color: '#4f46e5', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={currentPlan.unlimitedImages}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    updatePlanField(activeTier, 'unlimitedImages', checked);
                                                    if (checked && currentPlan.totalImages < 999999) {
                                                        updatePlanField(activeTier, 'totalImages', 999999);
                                                    }
                                                }}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>Không giới hạn ảnh</span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        max={9999999}
                                        disabled={currentPlan.unlimitedImages}
                                        value={currentPlan.unlimitedImages ? 999999 : currentPlan.totalImages}
                                        onChange={(e) => updatePlanField(activeTier, 'totalImages', Math.max(0, Number(e.target.value) || 0))}
                                        style={{
                                            ...inputStyle,
                                            ...monoStyle,
                                            background: currentPlan.unlimitedImages ? '#f8fafc' : '#ffffff',
                                            color: currentPlan.unlimitedImages ? '#64748b' : 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                            ) : (
                                <div />
                            )}

                            <div>
                                <label style={labelStyle}>Độ phân giải tối đa cho phép</label>
                                <select
                                    value={currentPlan.maxResolution}
                                    onChange={(e) => updatePlanField(activeTier, 'maxResolution', e.target.value as MaxResolution)}
                                    style={inputStyle}
                                >
                                    <option value="HD">HD (720p)</option>
                                    <option value="FHD">FHD (1080p)</option>
                                    <option value="2K">2K Ultra Sharp</option>
                                    <option value="4K">4K Ultra Sharp (Tối đa)</option>
                                </select>
                            </div>
                        </div>

                        {/* Model Permissions */}
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: '12px',
                                background: '#f8fafc',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Quyền mở khóa Model Tạo Ảnh
                                </span>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#4f46e5', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={currentPlan.allModelsUnlocked}
                                        onChange={(e) => updatePlanField(activeTier, 'allModelsUnlocked', e.target.checked)}
                                        style={{ accentColor: 'var(--accent-primary)' }}
                                    />
                                    <span>Mở khóa Full toàn bộ Model (kể cả model tùy chỉnh)</span>
                                </label>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                                    gap: '8px',
                                    opacity: currentPlan.allModelsUnlocked ? 0.55 : 1,
                                }}
                            >
                                {ALL_IMAGE_MODEL_OPTIONS.map((model) => {
                                    const checked =
                                        currentPlan.allModelsUnlocked ||
                                        currentPlan.allowedImageModels.some((id) => cleanModelId(id) === model.id);
                                    return (
                                        <label
                                            key={model.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '7px',
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                background: '#ffffff',
                                                border: checked ? '1px solid #c7d2fe' : '1px solid var(--border-color)',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                cursor: currentPlan.allModelsUnlocked ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={currentPlan.allModelsUnlocked}
                                                checked={checked}
                                                onChange={() => toggleAllowedModel(activeTier, model.id)}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>{model.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: VISUAL DISPLAY COPY */}
                    <div style={{ marginBottom: '22px' }}>
                        <div style={sectionHeadingStyle}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Sliders size={16} color="#059669" />
                                Nội dung & Nhãn hiển thị trên thẻ gói
                            </span>
                        </div>

                        <div className="pkg-field-2col" style={{ marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>Tên gói hiển thị</label>
                                <input
                                    type="text"
                                    value={currentPlan.name}
                                    onChange={(e) => updatePlanField(activeTier, 'name', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Nhãn góc phải (Badge)</label>
                                <input
                                    type="text"
                                    placeholder="vd: MẶC ĐỊNH, GIẢM 58%, CAO CẤP NHẤT"
                                    value={currentPlan.badge}
                                    onChange={(e) => updatePlanField(activeTier, 'badge', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <label style={labelStyle}>Mô tả ngắn dưới tên gói</label>
                            <input
                                type="text"
                                value={currentPlan.subtitle}
                                onChange={(e) => updatePlanField(activeTier, 'subtitle', e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div className="pkg-field-2col" style={{ marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>Ruy-băng nổi phía trên thẻ (Top Ribbon)</label>
                                <input
                                    type="text"
                                    placeholder="Để trống nếu không hiển thị"
                                    value={currentPlan.topRibbon}
                                    onChange={(e) => updatePlanField(activeTier, 'topRibbon', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Banner nổi bật bên trong thẻ</label>
                                <input
                                    type="text"
                                    placeholder="vd: 🔥 Tạo ảnh hoàn toàn không bị giới hạn"
                                    value={currentPlan.highlightBanner}
                                    onChange={(e) => updatePlanField(activeTier, 'highlightBanner', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div className="pkg-field-2col" style={{ marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>Chu kỳ hiển thị cạnh giá</label>
                                <input
                                    type="text"
                                    placeholder="vd: / 30 ngày"
                                    value={currentPlan.periodLabel}
                                    onChange={(e) => updatePlanField(activeTier, 'periodLabel', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Tóm tắt hạn mức dưới giá</label>
                                <input
                                    type="text"
                                    value={currentPlan.quotaSummary}
                                    onChange={(e) => updatePlanField(activeTier, 'quotaSummary', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div className="pkg-field-2col">
                            <div>
                                <label style={labelStyle}>Chữ trên nút hành động (CTA)</label>
                                <input
                                    type="text"
                                    value={currentPlan.ctaText}
                                    onChange={(e) => updatePlanField(activeTier, 'ctaText', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            {activeTier !== 'free' && (
                                <div>
                                    <label style={labelStyle}>Chữ nút khi User đang dùng gói này (Mua thêm)</label>
                                    <input
                                        type="text"
                                        value={currentPlan.ctaTopUpText}
                                        onChange={(e) => updatePlanField(activeTier, 'ctaTopUpText', e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 3: FEATURE BULLET LIST */}
                    <div>
                        <div style={sectionHeadingStyle}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={16} color="#d97706" />
                                Các dòng quyền lợi ({currentPlan.featureItems.length})
                            </span>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => addFeatureItem(activeTier)}
                            >
                                <Plus size={14} />
                                <span>Thêm dòng</span>
                            </button>
                        </div>

                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Mẹo: Nhập cụm từ cần in đậm ở ô <strong>Từ khóa nổi bật</strong>, ngăn cách nhiều cụm bằng dấu <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>|</code> (ví dụ: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>300 ảnh|60 giây tạo Video AI</code>).
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {currentPlan.featureItems.map((item, idx) => (
                                <div
                                    key={item.id}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        background: '#f8fafc',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <select
                                            value={item.icon}
                                            onChange={(e) => updateFeatureItem(activeTier, idx, { icon: e.target.value === 'lock' ? 'lock' : 'check' })}
                                            style={{
                                                padding: '7px 8px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                background: '#ffffff',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="check">✓ Tích xanh</option>
                                            <option value="lock">🔒 Giới hạn</option>
                                        </select>

                                        <input
                                            type="text"
                                            value={item.text}
                                            placeholder="Nội dung quyền lợi..."
                                            onChange={(e) => updateFeatureItem(activeTier, idx, { text: e.target.value })}
                                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.85rem', flex: 1 }}
                                        />

                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => moveFeatureItem(activeTier, idx, -1)}
                                            aria-label="Di chuyển lên"
                                            style={{
                                                border: '1px solid var(--border-color)',
                                                background: '#ffffff',
                                                borderRadius: '7px',
                                                padding: '6px',
                                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                                opacity: idx === 0 ? 0.4 : 1,
                                            }}
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === currentPlan.featureItems.length - 1}
                                            onClick={() => moveFeatureItem(activeTier, idx, 1)}
                                            aria-label="Di chuyển xuống"
                                            style={{
                                                border: '1px solid var(--border-color)',
                                                background: '#ffffff',
                                                borderRadius: '7px',
                                                padding: '6px',
                                                cursor: idx === currentPlan.featureItems.length - 1 ? 'not-allowed' : 'pointer',
                                                opacity: idx === currentPlan.featureItems.length - 1 ? 0.4 : 1,
                                            }}
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={currentPlan.featureItems.length <= 1}
                                            onClick={() => removeFeatureItem(activeTier, idx)}
                                            aria-label="Xóa dòng"
                                            style={{
                                                border: '1px solid #fecaca',
                                                background: '#fef2f2',
                                                color: '#dc2626',
                                                borderRadius: '7px',
                                                padding: '6px',
                                                cursor: currentPlan.featureItems.length <= 1 ? 'not-allowed' : 'pointer',
                                                opacity: currentPlan.featureItems.length <= 1 ? 0.4 : 1,
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <input
                                        type="text"
                                        value={item.highlight || ''}
                                        placeholder="Từ khóa in đậm (vd: 300 ảnh|60 giây tạo Video AI)"
                                        onChange={(e) => updateFeatureItem(activeTier, idx, { highlight: e.target.value })}
                                        style={{ ...inputStyle, padding: '6px 10px', fontSize: '0.78rem', color: '#475569' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: REALTIME 3-CARD PREVIEW */}
                <div style={{ ...cardStyle, position: 'sticky', top: '20px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                        }}
                    >
                        <div>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Xem trước hiển thị trên Tool (Realtime Preview)
                            </h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Bấm vào từng thẻ gói bên dưới để chuyển nhanh tab chỉnh sửa tương ứng.
                            </p>
                        </div>
                    </div>

                    <div className="pkg-preview-cards">
                        {/* PREVIEW FREE */}
                        {(() => {
                            const p = draft.free;
                            const isSelected = activeTier === 'free';
                            return (
                                <div
                                    onClick={() => setActiveTier('free')}
                                    style={{
                                        ...previewCardCommon,
                                        background: '#ffffff',
                                        border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                                        boxShadow: isSelected ? '0 0 0 3px rgba(79,70,229,0.12)' : 'var(--shadow-xs)',
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{p.subtitle}</div>
                                            </div>
                                            {p.badge && (
                                                <span style={{ padding: '2px 7px', borderRadius: '999px', background: '#f1f5f9', color: '#334155', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {p.badge}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', ...monoStyle }}>
                                                    {formatVndCompact(p.price)}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.periodLabel}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
                                                {p.quotaSummary}
                                            </div>
                                        </div>

                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                                            {p.featureItems.map((it) => (
                                                <li key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.73rem', color: it.icon === 'lock' ? '#64748b' : '#334155', lineHeight: 1.4 }}>
                                                    <span style={{ marginTop: '2px', flexShrink: 0, color: it.icon === 'lock' ? '#94a3b8' : '#059669' }}>
                                                        {it.icon === 'lock' ? <Lock size={13} /> : <Check size={13} />}
                                                    </span>
                                                    <span>{renderHighlightedText(it.text, it.highlight, { color: '#0f172a', fontWeight: 700 })}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div style={{ padding: '9px 10px', borderRadius: '10px', background: '#f1f5f9', color: '#334155', fontSize: '0.74rem', fontWeight: 600, textAlign: 'center' }}>
                                        {p.ctaText || 'Gói cơ bản miễn phí'}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* PREVIEW PLUS */}
                        {(() => {
                            const p = draft.plus;
                            const disc = computeDiscountStats(p.price, p.originalPrice);
                            const isSelected = activeTier === 'plus';
                            return (
                                <div
                                    onClick={() => setActiveTier('plus')}
                                    style={{
                                        ...previewCardCommon,
                                        background: '#ffffff',
                                        border: isSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                                        boxShadow: isSelected ? '0 0 0 3px rgba(79,70,229,0.12)' : 'var(--shadow-sm)',
                                        opacity: p.enabled ? 1 : 0.55,
                                    }}
                                >
                                    {!p.enabled && (
                                        <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', background: '#475569', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', zIndex: 2 }}>
                                            ĐANG ẨN
                                        </div>
                                    )}
                                    {p.topRibbon.trim() && (
                                        <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                                            {p.topRibbon}
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{p.subtitle}</div>
                                            </div>
                                            {p.badge && (
                                                <span style={{ padding: '2px 7px', borderRadius: '999px', background: '#ecfdf5', color: '#047857', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {p.badge}
                                                </span>
                                            )}
                                        </div>

                                        {p.highlightBanner.trim() && (
                                            <div style={{ marginBottom: '10px', padding: '6px 9px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.68rem', fontWeight: 700 }}>
                                                {p.highlightBanner}
                                            </div>
                                        )}

                                        <div style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                            {disc.hasDiscount && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through', ...monoStyle }}>
                                                        {formatVndCompact(p.originalPrice)}
                                                    </span>
                                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                                                        Tiết kiệm {formatVndCompact(disc.savingsAmount)}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', ...monoStyle }}>
                                                    {formatVndCompact(p.price)}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.periodLabel}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '4px', fontWeight: 700, ...monoStyle }}>
                                                {p.quotaSummary}
                                            </div>
                                        </div>

                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                                            {p.featureItems.map((it) => (
                                                <li key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.73rem', color: it.icon === 'lock' ? '#64748b' : '#334155', lineHeight: 1.4 }}>
                                                    <span style={{ marginTop: '2px', flexShrink: 0, color: it.icon === 'lock' ? '#94a3b8' : '#059669' }}>
                                                        {it.icon === 'lock' ? <Lock size={13} /> : <Check size={13} />}
                                                    </span>
                                                    <span>{renderHighlightedText(it.text, it.highlight, { color: '#0f172a', fontWeight: 700 })}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#0f172a', color: '#ffffff', fontSize: '0.74rem', fontWeight: 700, textAlign: 'center' }}>
                                        {p.ctaText || `Mua ${p.name} — ${formatVndCompact(p.price)}`} →
                                    </div>
                                </div>
                            );
                        })()}

                        {/* PREVIEW PRO */}
                        {(() => {
                            const p = draft.pro;
                            const disc = computeDiscountStats(p.price, p.originalPrice);
                            const isSelected = activeTier === 'pro';
                            return (
                                <div
                                    onClick={() => setActiveTier('pro')}
                                    style={{
                                        ...previewCardCommon,
                                        background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                                        color: '#ffffff',
                                        border: isSelected ? '2px solid #facc15' : '2px solid #fbbf24',
                                        boxShadow: isSelected ? '0 0 0 3px rgba(250,204,21,0.35), 0 14px 28px rgba(79,70,229,0.28)' : '0 14px 28px rgba(79,70,229,0.22)',
                                        opacity: p.enabled ? 1 : 0.55,
                                    }}
                                >
                                    {!p.enabled && (
                                        <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', zIndex: 3 }}>
                                            ĐANG ẨN
                                        </div>
                                    )}
                                    {p.topRibbon.trim() && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '-11px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                background: 'linear-gradient(90deg, #fbbf24, #facc15, #f59e0b)',
                                                color: '#0f172a',
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                padding: '3px 10px',
                                                borderRadius: '999px',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 10px rgba(245, 158, 11, 0.35)',
                                            }}
                                        >
                                            {p.topRibbon}
                                        </div>
                                    )}

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '10px', paddingTop: '4px' }}>
                                            <div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(253,230,138,0.9)', marginTop: '2px' }}>{p.subtitle}</div>
                                            </div>
                                            {p.badge && (
                                                <span style={{ padding: '3px 7px', borderRadius: '999px', background: '#fbbf24', color: '#0f172a', fontSize: '0.6rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>
                                                    {p.badge}
                                                </span>
                                            )}
                                        </div>

                                        {p.highlightBanner.trim() && (
                                            <div
                                                style={{
                                                    margin: '8px 0 12px',
                                                    padding: '7px 10px',
                                                    borderRadius: '10px',
                                                    background: 'linear-gradient(90deg, rgba(251,191,36,0.18), rgba(99,102,241,0.22))',
                                                    border: '1px solid rgba(251,191,36,0.4)',
                                                    color: '#fcd34d',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {p.highlightBanner}
                                            </div>
                                        )}

                                        <div style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(99,102,241,0.35)' }}>
                                            {disc.hasDiscount && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through', ...monoStyle }}>
                                                        {formatVndCompact(p.originalPrice)}
                                                    </span>
                                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#fcd34d', background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.35)', padding: '1px 5px', borderRadius: '4px' }}>
                                                        Giảm {disc.discountPercent}% (-{formatVndCompact(disc.savingsAmount)})
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#fbbf24', ...monoStyle }}>
                                                    {formatVndCompact(p.price)}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>{p.periodLabel}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#fcd34d', marginTop: '4px', fontWeight: 700, ...monoStyle }}>
                                                • {p.quotaSummary}
                                            </div>
                                        </div>

                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                                            {p.featureItems.map((it) => (
                                                <li key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.73rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                                                    <span
                                                        style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            borderRadius: '999px',
                                                            background: it.icon === 'lock' ? 'rgba(148,163,184,0.2)' : 'rgba(251,191,36,0.2)',
                                                            border: it.icon === 'lock' ? '1px solid rgba(148,163,184,0.4)' : '1px solid rgba(251,191,36,0.4)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            marginTop: '1px',
                                                            color: it.icon === 'lock' ? '#cbd5e1' : '#fcd34d',
                                                        }}
                                                    >
                                                        {it.icon === 'lock' ? <Lock size={10} /> : <Check size={10} />}
                                                    </span>
                                                    <span>{renderHighlightedText(it.text, it.highlight, { color: '#fcd34d', fontWeight: 700 })}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #eab308)',
                                            color: '#0f172a',
                                            fontSize: '0.74rem',
                                            fontWeight: 800,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {p.ctaText || `Mua ${p.name} — ${formatVndCompact(p.price)}`} →
                                    </div>
                                </div>
                            );
                        })()}

                        {/* PREVIEW VIP */}
                        {(() => {
                            const p = draft.vip;
                            const disc = computeDiscountStats(p.price, p.originalPrice);
                            const isSelected = activeTier === 'vip';
                            return (
                                <div
                                    onClick={() => setActiveTier('vip')}
                                    style={{
                                        ...previewCardCommon,
                                        background: 'linear-gradient(180deg, #0f172a 0%, #3b0764 50%, #0f172a 100%)',
                                        color: '#ffffff',
                                        border: isSelected ? '2px solid #e879f9' : '2px solid #c084fc',
                                        boxShadow: isSelected ? '0 0 0 3px rgba(232,121,249,0.35), 0 14px 28px rgba(192,132,252,0.28)' : '0 14px 28px rgba(192,132,252,0.22)',
                                        opacity: p.enabled ? 1 : 0.55,
                                    }}
                                >
                                    {!p.enabled && (
                                        <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', zIndex: 3 }}>
                                            ĐANG ẨN
                                        </div>
                                    )}
                                    {p.topRibbon.trim() && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '-11px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                background: 'linear-gradient(90deg, #c084fc, #e879f9, #f472b6)',
                                                color: '#0f172a',
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                padding: '3px 10px',
                                                borderRadius: '999px',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 10px rgba(232, 121, 249, 0.35)',
                                            }}
                                        >
                                            {p.topRibbon}
                                        </div>
                                    )}

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '10px', paddingTop: '4px' }}>
                                            <div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(245,208,254,0.9)', marginTop: '2px' }}>{p.subtitle}</div>
                                            </div>
                                            {p.badge && (
                                                <span style={{ padding: '3px 7px', borderRadius: '999px', background: '#c084fc', color: '#0f172a', fontSize: '0.6rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>
                                                    {p.badge}
                                                </span>
                                            )}
                                        </div>

                                        {p.highlightBanner.trim() && (
                                            <div style={{ marginBottom: '10px', padding: '6px 9px', borderRadius: '8px', background: 'rgba(192,132,252,0.18)', border: '1px solid rgba(192,132,252,0.35)', color: '#f5d0fe', fontSize: '0.68rem', fontWeight: 700 }}>
                                                {p.highlightBanner}
                                            </div>
                                        )}

                                        <div style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(192,132,252,0.25)' }}>
                                            {disc.hasDiscount && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through', ...monoStyle }}>
                                                        {formatVndCompact(p.originalPrice)}
                                                    </span>
                                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#f5d0fe', background: 'rgba(192,132,252,0.2)', border: '1px solid rgba(192,132,252,0.35)', padding: '1px 5px', borderRadius: '4px' }}>
                                                        Giảm {disc.discountPercent}% (-{formatVndCompact(disc.savingsAmount)})
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                                <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#e879f9', ...monoStyle }}>
                                                    {formatVndCompact(p.price)}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>{p.periodLabel}</span>
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#f5d0fe', marginTop: '4px', fontWeight: 700, ...monoStyle }}>
                                                • {p.quotaSummary}
                                            </div>
                                        </div>

                                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                                            {p.featureItems.map((it) => (
                                                <li key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.73rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                                                    <span
                                                        style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            borderRadius: '999px',
                                                            background: it.icon === 'lock' ? 'rgba(148,163,184,0.2)' : 'rgba(232,121,249,0.2)',
                                                            border: it.icon === 'lock' ? '1px solid rgba(148,163,184,0.4)' : '1px solid rgba(232,121,249,0.4)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            marginTop: '1px',
                                                            color: it.icon === 'lock' ? '#cbd5e1' : '#e879f9',
                                                        }}
                                                    >
                                                        {it.icon === 'lock' ? <Lock size={10} /> : <Check size={10} />}
                                                    </span>
                                                    <span>{renderHighlightedText(it.text, it.highlight, { color: '#e879f9', fontWeight: 700 })}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            background: 'linear-gradient(90deg, #c084fc, #e879f9, #f472b6)',
                                            color: '#0f172a',
                                            fontSize: '0.74rem',
                                            fontWeight: 800,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {p.ctaText || `Mua ${p.name} — ${formatVndCompact(p.price)}`} →
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PackageConfigManager;
