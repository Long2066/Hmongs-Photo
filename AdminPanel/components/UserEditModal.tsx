import React, { useState, useEffect } from 'react';
import {
    X,
    Crown,
    Zap,
    Image as ImageIcon,
    Video,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Lock,
    Unlock,
    Loader2,
    History,
    Copy,
    Check,
    Plus,
    Minus,
    Equal,
    ArrowDownCircle,
    Coins,
    Sparkles
} from 'lucide-react';
import {
    UserData,
    toggleUserLock,
    getUserBills,
    BillData
} from '../services/adminFirebaseService';
import {
    grantSubscriptionPlan,
    adjustSubscriptionQuota,
    extendSubscriptionPlan,
    downgradeSubscriptionToFree,
    getAdminActionLogs,
    AdminActionLog
} from '../services/subscriptionAdmin';
import { getCurrentAdmin } from '../services/adminAuthService';

interface UserEditModalProps {
    user: UserData;
    onClose: () => void;
    onUpdated: () => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user: initialUser, onClose, onUpdated }) => {
    // Local user state to reflect immediate updates
    const [user, setUser] = useState<UserData>(initialUser);
    const [activeTab, setActiveTab] = useState<'plan' | 'lock' | 'history'>('plan');
    const [loading, setLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Manual quota adjustment states
    const [deltaImages, setDeltaImages] = useState<number>(20);
    const [deltaVideo, setDeltaVideo] = useState<number>(30);

    // Lock reason state
    const [lockReason, setLockReason] = useState<string>(user.lockedReason || '');

    // History data
    const [bills, setBills] = useState<BillData[]>([]);
    const [actionLogs, setActionLogs] = useState<AdminActionLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

    // Copied feedback
    const [copiedId, setCopiedId] = useState(false);

    const admin = getCurrentAdmin();
    const adminEmail = admin?.email || 'admin@toolphoto.com';

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const [billsData, logsData] = await Promise.all([
                getUserBills(user.id),
                getAdminActionLogs(user.id)
            ]);
            setBills(billsData || []);
            setActionLogs(logsData || []);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(user.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    // 1-Click Plan Grant
    const handleGrantPlan = async (plan: 'plus' | 'pro') => {
        setLoading(true);
        setActionMsg(null);
        try {
            const updated = await grantSubscriptionPlan(user.id, plan, adminEmail);
            setUser(prev => ({
                ...prev,
                plan: updated.plan,
                remainingImages: updated.remainingImages,
                remainingVideoSeconds: updated.remainingVideoSeconds,
                planAllowanceImages: updated.planAllowanceImages,
                planAllowanceVideoSeconds: updated.planAllowanceVideoSeconds,
                planExpiresAt: updated.planExpiresAt,
                planStartedAt: updated.planStartedAt
            }));
            setActionMsg({
                type: 'success',
                text: `Đã kích hoạt ${plan === 'pro' ? '👑 GÓI PRO' : '⚡ GÓI PLUS'} thành công! Hạn mức: ${updated.remainingImages} ảnh, ${updated.remainingVideoSeconds}s video (30 ngày).`
            });
            onUpdated();
        } catch (err: any) {
            setActionMsg({
                type: 'error',
                text: 'Lỗi kích hoạt gói: ' + (err?.message || 'Không thể cập nhật Firestore')
            });
        } finally {
            setLoading(false);
        }
    };

    // Manual adjustment (Add / Subtract / Set)
    const handleAdjustQuota = async (mode: 'add' | 'subtract' | 'set') => {
        if (deltaImages < 0 && deltaVideo < 0) return;
        setLoading(true);
        setActionMsg(null);
        try {
            const updated = await adjustSubscriptionQuota(
                user.id,
                { deltaImages, deltaVideoSeconds: deltaVideo, mode },
                adminEmail
            );
            setUser(prev => ({
                ...prev,
                plan: updated.plan,
                remainingImages: updated.remainingImages,
                remainingVideoSeconds: updated.remainingVideoSeconds,
                planExpiresAt: updated.planExpiresAt
            }));
            const modeText = mode === 'add' ? 'Thêm' : mode === 'subtract' ? 'Trừ' : 'Đặt';
            setActionMsg({
                type: 'success',
                text: `Đã ${modeText} hạn mức! Hiện tại: ${updated.remainingImages} ảnh, ${updated.remainingVideoSeconds}s video.`
            });
            onUpdated();
        } catch (err: any) {
            setActionMsg({
                type: 'error',
                text: 'Lỗi điều chỉnh hạn mức: ' + (err?.message || 'Không xác định')
            });
        } finally {
            setLoading(false);
        }
    };

    // Extend subscription
    const handleExtend = async (days: number) => {
        setLoading(true);
        setActionMsg(null);
        try {
            const updated = await extendSubscriptionPlan(user.id, days, adminEmail);
            setUser(prev => ({
                ...prev,
                plan: updated.plan,
                planExpiresAt: updated.planExpiresAt
            }));
            const newDateStr = updated.planExpiresAt ? new Date(updated.planExpiresAt).toLocaleDateString('vi-VN') : '';
            setActionMsg({
                type: 'success',
                text: `Đã gia hạn thêm +${days} ngày! Hạn mới đến: ${newDateStr}`
            });
            onUpdated();
        } catch (err: any) {
            setActionMsg({
                type: 'error',
                text: 'Lỗi gia hạn: ' + (err?.message || 'Không xác định')
            });
        } finally {
            setLoading(false);
        }
    };

    // Downgrade to Free
    const handleDowngrade = async () => {
        if (!window.confirm('Bạn có chắc muốn hạ gói tài khoản này về FREE? Số ảnh và video của gói sẽ trở về 0.')) {
            return;
        }
        setLoading(true);
        setActionMsg(null);
        try {
            await downgradeSubscriptionToFree(user.id, adminEmail);
            setUser(prev => ({
                ...prev,
                plan: 'free',
                remainingImages: 0,
                remainingVideoSeconds: 0,
                planExpiresAt: null
            }));
            setActionMsg({
                type: 'success',
                text: 'Đã hạ tài khoản về Gói Free! Hạn mức gói đã được reset về 0.'
            });
            onUpdated();
        } catch (err: any) {
            setActionMsg({
                type: 'error',
                text: 'Lỗi khi hạ gói: ' + (err?.message || 'Không xác định')
            });
        } finally {
            setLoading(false);
        }
    };

    // Lock / Unlock
    const handleToggleLock = async () => {
        const newLockState = !user.isLocked;
        if (newLockState && !lockReason.trim()) {
            setActionMsg({ type: 'error', text: 'Vui lòng nhập lý do khóa tài khoản' });
            return;
        }

        setLoading(true);
        setActionMsg(null);
        try {
            await toggleUserLock(user.id, newLockState, lockReason);
            setUser(prev => ({
                ...prev,
                isLocked: newLockState,
                lockedReason: newLockState ? lockReason : undefined
            }));
            setActionMsg({
                type: 'success',
                text: newLockState ? 'Đã khóa tài khoản thành công!' : 'Đã mở khóa tài khoản!'
            });
            onUpdated();
        } catch (error: any) {
            setActionMsg({
                type: 'error',
                text: 'Lỗi thay đổi trạng thái khóa: ' + (error?.message || 'Không xác định')
            });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp?: number | null) => {
        if (!timestamp) return 'Vô thời hạn';
        return new Date(timestamp).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (timestamp?: number | null) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const now = Date.now();
    const effectivePlan = user.plan || 'free';
    const expiresAt = user.planExpiresAt;
    const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)) : null;
    const isExpired = expiresAt ? expiresAt <= now : false;
    const legacyBonusImages = user.credits && user.credits > 0 ? Math.floor(user.credits / 500) : 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '620px',
                    width: '95%',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '20px',
                    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)'
                }}
            >
                {/* Header */}
                <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: effectivePlan === 'pro'
                                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                                : effectivePlan === 'plus'
                                    ? 'linear-gradient(135deg, #059669, #10b981)'
                                    : 'linear-gradient(135deg, #64748b, #94a3b8)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '1.2rem',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                        }}>
                            {(user.displayName && user.displayName[0]?.toUpperCase()) || 'U'}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                    {user.displayName || 'Người dùng'}
                                </h2>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    background: effectivePlan === 'pro' ? '#eef2ff' : effectivePlan === 'plus' ? '#ecfdf5' : '#f1f5f9',
                                    color: effectivePlan === 'pro' ? '#4338ca' : effectivePlan === 'plus' ? '#047857' : '#475569',
                                    border: `1px solid ${effectivePlan === 'pro' ? '#c7d2fe' : effectivePlan === 'plus' ? '#a7f3d0' : '#e2e8f0'}`
                                }}>
                                    {effectivePlan === 'pro' ? <Crown size={12} /> : effectivePlan === 'plus' ? <Zap size={12} /> : null}
                                    {effectivePlan === 'pro' ? 'Gói Pro' : effectivePlan === 'plus' ? 'Gói Plus' : 'Gói Free'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.82rem', color: '#64748b' }}>
                                <span>{user.email || 'Chưa liên kết email'}</span>
                                <span>•</span>
                                <button
                                    onClick={handleCopyId}
                                    title="Click để copy User ID"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontSize: '0.8rem',
                                        fontFamily: 'monospace'
                                    }}
                                >
                                    <span>ID: {user.id ? `${user.id.substring(0, 8)}...` : '-'}</span>
                                    {copiedId ? <Check size={12} style={{ color: '#059669' }} /> : <Copy size={12} />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} style={{ padding: '8px', borderRadius: '8px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    padding: '0 20px',
                    gap: '4px'
                }}>
                    <button
                        onClick={() => { setActiveTab('plan'); setActionMsg(null); }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'plan' ? '2px solid #4f46e5' : '2px solid transparent',
                            color: activeTab === 'plan' ? '#4f46e5' : '#64748b',
                            fontWeight: activeTab === 'plan' ? 700 : 500,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Sparkles size={16} />
                        Gói & Hạn mức
                    </button>
                    <button
                        onClick={() => { setActiveTab('lock'); setActionMsg(null); }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'lock' ? '2px solid #4f46e5' : '2px solid transparent',
                            color: activeTab === 'lock' ? '#4f46e5' : '#64748b',
                            fontWeight: activeTab === 'lock' ? 700 : 500,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {user.isLocked ? <Lock size={16} style={{ color: '#dc2626' }} /> : <Unlock size={16} />}
                        Khóa / Mở tài khoản
                    </button>
                    <button
                        onClick={() => { setActiveTab('history'); setActionMsg(null); }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'history' ? '2px solid #4f46e5' : '2px solid transparent',
                            color: activeTab === 'history' ? '#4f46e5' : '#64748b',
                            fontWeight: activeTab === 'history' ? 700 : 500,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <History size={16} />
                        Lịch sử & Audit
                    </button>
                </div>

                {/* Body with scroll */}
                <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {/* Inline Status Feedback Banner */}
                    {actionMsg && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            marginBottom: '18px',
                            fontSize: '0.88rem',
                            lineHeight: 1.45,
                            background: actionMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                            color: actionMsg.type === 'success' ? '#065f46' : '#991b1b',
                            border: `1px solid ${actionMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`
                        }}>
                            {actionMsg.type === 'success' ? (
                                <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                            ) : (
                                <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                            )}
                            <div style={{ flex: 1 }}>{actionMsg.text}</div>
                            <button
                                onClick={() => setActionMsg(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'inherit',
                                    padding: '2px',
                                    opacity: 0.6
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* TAB 1: GÓI & HẠN MỨC */}
                    {activeTab === 'plan' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Section A: Current Status Card */}
                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                padding: '16px 18px',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Sparkles size={16} style={{ color: '#4f46e5' }} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Hạn mức khả dụng hiện tại
                                        </span>
                                    </div>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        background: isExpired ? '#fef2f2' : effectivePlan !== 'free' ? '#ecfdf5' : '#f1f5f9',
                                        color: isExpired ? '#dc2626' : effectivePlan !== 'free' ? '#047857' : '#64748b'
                                    }}>
                                        {isExpired ? '⚠️ Đã hết hạn' : daysLeft !== null ? `Còn ${daysLeft} ngày` : 'Gói cơ bản'}
                                    </span>
                                </div>

                                {/* 3 Metrics Box */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                    {/* Images */}
                                    <div style={{
                                        background: '#ffffff',
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', marginBottom: '4px' }}>
                                            <ImageIcon size={16} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Ảnh còn lại</span>
                                        </div>
                                        <div style={{
                                            fontSize: '1.45rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            fontFamily: 'monospace',
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>
                                            {user.remainingImages ?? 0}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                            {user.planAllowanceImages ? `Gói gốc: ${user.planAllowanceImages} ảnh` : 'Chưa có gói trả phí'}
                                        </div>
                                    </div>

                                    {/* Video Seconds */}
                                    <div style={{
                                        background: '#ffffff',
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0891b2', marginBottom: '4px' }}>
                                            <Video size={16} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Video còn lại</span>
                                        </div>
                                        <div style={{
                                            fontSize: '1.45rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            fontFamily: 'monospace',
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>
                                            {user.remainingVideoSeconds ?? 0}<span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>s</span>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                            {user.planAllowanceVideoSeconds ? `Gói gốc: ${user.planAllowanceVideoSeconds}s` : '8s ban đầu'}
                                        </div>
                                    </div>

                                    {/* Expiration Date */}
                                    <div style={{
                                        background: '#ffffff',
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', marginBottom: '4px' }}>
                                            <Calendar size={16} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Hạn dùng (30 ngày)</span>
                                        </div>
                                        <div style={{
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            color: '#0f172a',
                                            marginTop: '6px'
                                        }}>
                                            {formatDate(user.planExpiresAt)}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                                            {user.planStartedAt ? `Kích hoạt: ${formatDate(user.planStartedAt)}` : 'Chưa đăng ký gói'}
                                        </div>
                                    </div>
                                </div>

                                {/* Bonus Legacy Credits Notice (Option 1) */}
                                {legacyBonusImages > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginTop: '12px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        background: '#fffbeb',
                                        border: '1px solid #fef3c7',
                                        fontSize: '0.8rem',
                                        color: '#92400e'
                                    }}>
                                        <Coins size={15} style={{ color: '#d97706', flexShrink: 0 }} />
                                        <span>
                                            <strong>Ảnh thưởng cũ:</strong> User có <strong>{legacyBonusImages} ảnh</strong> khả dụng từ số dư tích lũy ({user.credits?.toLocaleString('vi-VN')}đ). Hệ thống tự động ưu tiên khi gói cước hết.
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Section B: 1-Click Package Activation */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: '#334155',
                                    marginBottom: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    ⚡ Kích hoạt nhanh theo gói chuẩn (Thời hạn 30 ngày)
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {/* Grant Plus */}
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleGrantPlan('plus')}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            padding: '14px 16px',
                                            borderRadius: '12px',
                                            background: '#ffffff',
                                            border: '1.5px solid #a7f3d0',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            textAlign: 'left',
                                            boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#059669')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#a7f3d0')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700, fontSize: '0.95rem' }}>
                                            <Zap size={18} />
                                            <span>Gói PLUS (50.000đ)</span>
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                                            +100 ảnh • +60s video • 30 ngày
                                        </span>
                                        <span style={{
                                            marginTop: '8px',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: '#ecfdf5',
                                            color: '#059669'
                                        }}>
                                            Cộng dồn / gia hạn
                                        </span>
                                    </button>

                                    {/* Grant Pro */}
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleGrantPlan('pro')}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            padding: '14px 16px',
                                            borderRadius: '12px',
                                            background: '#ffffff',
                                            border: '1.5px solid #c7d2fe',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            textAlign: 'left',
                                            boxShadow: '0 1px 3px rgba(79, 70, 229, 0.08)'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#c7d2fe')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4338ca', fontWeight: 700, fontSize: '0.95rem' }}>
                                            <Crown size={18} />
                                            <span>Gói PRO (100.000đ)</span>
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                                            +200 ảnh • +180s video • 30 ngày
                                        </span>
                                        <span style={{
                                            marginTop: '8px',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: '#eef2ff',
                                            color: '#4f46e5'
                                        }}>
                                            Bảo lưu ảnh Plus cũ
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Section C: Fine-tune Quotas */}
                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                padding: '16px 18px'
                            }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: '#334155',
                                    marginBottom: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    🛠️ Điều chỉnh hạn mức thủ công
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                            🖼️ Lượt ảnh (ảnh)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={deltaImages}
                                            onChange={e => setDeltaImages(Math.max(0, parseInt(e.target.value) || 0))}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                                fontWeight: 600,
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                            🎬 Giây video (giây)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={deltaVideo}
                                            onChange={e => setDeltaVideo(Math.max(0, parseInt(e.target.value) || 0))}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.95rem',
                                                fontWeight: 600,
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleAdjustQuota('add')}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            background: '#059669',
                                            color: '#ffffff',
                                            border: 'none',
                                            fontWeight: 600,
                                            fontSize: '0.88rem',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            minHeight: '44px'
                                        }}
                                    >
                                        <Plus size={16} />
                                        Cộng (+)
                                    </button>

                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleAdjustQuota('subtract')}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            background: '#dc2626',
                                            color: '#ffffff',
                                            border: 'none',
                                            fontWeight: 600,
                                            fontSize: '0.88rem',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            minHeight: '44px'
                                        }}
                                    >
                                        <Minus size={16} />
                                        Trừ (-)
                                    </button>

                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleAdjustQuota('set')}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            background: '#334155',
                                            color: '#ffffff',
                                            border: 'none',
                                            fontWeight: 600,
                                            fontSize: '0.88rem',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            minHeight: '44px'
                                        }}
                                    >
                                        <Equal size={16} />
                                        Đặt (=)
                                    </button>
                                </div>
                            </div>

                            {/* Section D: Extension & Downgrade */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: '#334155',
                                    marginBottom: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    ⏱️ Quản lý thời hạn & Chuyển gói
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleExtend(7)}
                                        style={{
                                            flex: '1 1 auto',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            color: '#334155',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            minHeight: '42px'
                                        }}
                                    >
                                        <Clock size={15} style={{ color: '#4f46e5' }} />
                                        +7 Ngày hạn dùng
                                    </button>

                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleExtend(30)}
                                        style={{
                                            flex: '1 1 auto',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            color: '#334155',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            minHeight: '42px'
                                        }}
                                    >
                                        <Calendar size={15} style={{ color: '#059669' }} />
                                        +30 Ngày hạn dùng
                                    </button>

                                    <button
                                        type="button"
                                        disabled={loading || effectivePlan === 'free'}
                                        onClick={handleDowngrade}
                                        style={{
                                            flex: '1 1 auto',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: effectivePlan === 'free' ? '#f1f5f9' : '#fff1f2',
                                            border: `1px solid ${effectivePlan === 'free' ? '#e2e8f0' : '#fecdd3'}`,
                                            color: effectivePlan === 'free' ? '#94a3b8' : '#e11d48',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            cursor: (loading || effectivePlan === 'free') ? 'not-allowed' : 'pointer',
                                            minHeight: '42px'
                                        }}
                                    >
                                        <ArrowDownCircle size={15} />
                                        Hạ về Free (Reset quota)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KHÓA / MỞ TÀI KHOẢN */}
                    {activeTab === 'lock' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                background: user.isLocked ? '#fef2f2' : '#ecfdf5',
                                border: `1px solid ${user.isLocked ? '#fecaca' : '#a7f3d0'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                {user.isLocked ? (
                                    <Lock size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                                ) : (
                                    <Unlock size={24} style={{ color: '#059669', flexShrink: 0 }} />
                                )}
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: 700, color: user.isLocked ? '#991b1b' : '#065f46' }}>
                                        {user.isLocked ? 'Tài khoản đang bị khóa' : 'Tài khoản đang hoạt động bình thường'}
                                    </h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569' }}>
                                        {user.isLocked
                                            ? `Lý do: ${user.lockedReason || 'Không ghi rõ'} (Khóa lúc: ${formatDateTime(user.lockedAt)})`
                                            : 'Người dùng có thể đăng nhập và tạo ảnh/video theo hạn mức gói.'}
                                    </p>
                                </div>
                            </div>

                            {!user.isLocked && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                        Lý do khóa tài khoản (bắt buộc)
                                    </label>
                                    <input
                                        type="text"
                                        value={lockReason}
                                        onChange={e => setLockReason(e.target.value)}
                                        placeholder="VD: Vi phạm điều khoản dịch vụ, spam request..."
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleToggleLock}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    padding: '12px 18px',
                                    borderRadius: '10px',
                                    background: user.isLocked ? '#059669' : '#dc2626',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.92rem',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    minHeight: '46px',
                                    marginTop: '8px'
                                }}
                            >
                                {loading ? (
                                    <Loader2 size={18} className="loading-spinner" />
                                ) : user.isLocked ? (
                                    <>
                                        <Unlock size={18} />
                                        Mở khóa tài khoản ngay
                                    </>
                                ) : (
                                    <>
                                        <Lock size={18} />
                                        Xác nhận khóa tài khoản
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* TAB 3: LỊCH SỬ & AUDIT */}
                    {activeTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {loadingHistory ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <Loader2 size={28} className="loading-spinner" style={{ color: '#4f46e5' }} />
                                </div>
                            ) : (
                                <>
                                    {/* Admin Action Audit Trail */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                            <Sparkles size={16} style={{ color: '#4f46e5' }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                                                Thao tác của Admin ({actionLogs.length})
                                            </span>
                                        </div>

                                        {actionLogs.length === 0 ? (
                                            <div style={{
                                                padding: '24px',
                                                textAlign: 'center',
                                                background: '#f8fafc',
                                                borderRadius: '10px',
                                                border: '1px dashed #cbd5e1',
                                                color: '#64748b',
                                                fontSize: '0.85rem'
                                            }}>
                                                Chưa có thao tác can thiệp nào từ Admin
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                                {actionLogs.map(log => (
                                                    <div
                                                        key={log.id}
                                                        style={{
                                                            padding: '10px 14px',
                                                            borderRadius: '8px',
                                                            background: '#f8fafc',
                                                            border: '1px solid #e2e8f0',
                                                            fontSize: '0.82rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <strong style={{ color: '#0f172a' }}>{log.description}</strong>
                                                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                                {formatDateTime(log.timestamp)}
                                                            </span>
                                                        </div>
                                                        <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                                                            Bởi Admin: <code style={{ color: '#4f46e5' }}>{log.adminEmail}</code>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* PayOS Payment Bills */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                            <History size={16} style={{ color: '#059669' }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                                                Hóa đơn thanh toán PayOS ({bills.length})
                                            </span>
                                        </div>

                                        {bills.length === 0 ? (
                                            <div style={{
                                                padding: '24px',
                                                textAlign: 'center',
                                                background: '#f8fafc',
                                                borderRadius: '10px',
                                                border: '1px dashed #cbd5e1',
                                                color: '#64748b',
                                                fontSize: '0.85rem'
                                            }}>
                                                Chưa có giao dịch PayOS nào được phê duyệt
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                                {bills.map(bill => (
                                                    <div
                                                        key={bill.id}
                                                        style={{
                                                            padding: '10px 14px',
                                                            borderRadius: '8px',
                                                            background: '#f8fafc',
                                                            border: '1px solid #e2e8f0',
                                                            fontSize: '0.82rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                            <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>
                                                                +{(bill.amount || 0).toLocaleString('vi-VN')} ₫
                                                            </span>
                                                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                                {formatDateTime(bill.timestamp)}
                                                            </span>
                                                        </div>
                                                        <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                                                            Mã đơn: <code style={{ color: '#334155' }}>{bill.id}</code>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Admin: <strong style={{ color: '#334155' }}>{adminEmail}</strong>
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        style={{ minHeight: '40px', padding: '0 20px', fontWeight: 600 }}
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserEditModal;
