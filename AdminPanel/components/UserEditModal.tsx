import React, { useState, useEffect } from 'react';
import {
    X,
    Plus,
    Minus,
    Lock,
    Unlock,
    Save,
    Loader2,
    History
} from 'lucide-react';
import {
    UserData,
    updateUserCredits,
    toggleUserLock,
    getUserBills
} from '../services/adminFirebaseService';

interface UserEditModalProps {
    user: UserData;
    onClose: () => void;
    onUpdated: () => void;
}

interface BillData {
    id: string;
    amount: number;
    credits: number;
    timestamp: number;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onUpdated }) => {
    const [credits, setCredits] = useState(user.credits);
    const [creditsAmount, setCreditsAmount] = useState(100);
    const [lockReason, setLockReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'credits' | 'lock' | 'history'>('credits');
    const [bills, setBills] = useState<BillData[]>([]);
    const [loadingBills, setLoadingBills] = useState(false);

    useEffect(() => {
        if (activeTab === 'history') {
            loadBills();
        }
    }, [activeTab]);

    const loadBills = async () => {
        setLoadingBills(true);
        try {
            const data = await getUserBills(user.id);
            setBills(data);
        } catch (error) {
            console.error('Error loading bills:', error);
        } finally {
            setLoadingBills(false);
        }
    };

    const handleAddCredits = async () => {
        if (creditsAmount <= 0) return;
        setLoading(true);
        try {
            const newCredits = await updateUserCredits(user.id, creditsAmount, 'add');
            setCredits(newCredits);
            alert(`Đã thêm ${creditsAmount} credits thành công!`);
        } catch (error) {
            alert('Lỗi khi thêm credits');
        } finally {
            setLoading(false);
        }
    };

    const handleSubtractCredits = async () => {
        if (creditsAmount <= 0) return;
        setLoading(true);
        try {
            const newCredits = await updateUserCredits(user.id, creditsAmount, 'subtract');
            setCredits(newCredits);
            alert(`Đã trừ ${creditsAmount} credits thành công!`);
        } catch (error) {
            alert('Lỗi khi trừ credits');
        } finally {
            setLoading(false);
        }
    };

    const handleSetCredits = async () => {
        setLoading(true);
        try {
            const newCredits = await updateUserCredits(user.id, creditsAmount, 'set');
            setCredits(newCredits);
            alert(`Đã đặt credits = ${creditsAmount} thành công!`);
        } catch (error) {
            alert('Lỗi khi set credits');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLock = async () => {
        const newLockState = !user.isLocked;
        if (newLockState && !lockReason.trim()) {
            alert('Vui lòng nhập lý do khóa tài khoản');
            return;
        }

        setLoading(true);
        try {
            await toggleUserLock(user.id, newLockState, lockReason);
            alert(newLockState ? 'Đã khóa tài khoản!' : 'Đã mở khóa tài khoản!');
            onUpdated();
        } catch (error) {
            alert('Lỗi khi thay đổi trạng thái');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('vi-VN') + ' ₫';
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                <div className="modal-header">
                    <h2>Chỉnh sửa User</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* User Info */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--border-radius-sm)',
                        marginBottom: '20px'
                    }}>
                        <div className="user-avatar" style={{ width: '56px', height: '56px', fontSize: '1.25rem' }}>
                            {user.displayName[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <h3 style={{ marginBottom: '4px' }}>{user.displayName}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user.email || 'No email'}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>ID: {user.id}</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '20px',
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: '12px'
                    }}>
                        <button
                            className={`btn btn-sm ${activeTab === 'credits' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('credits')}
                        >
                            💰 Credits
                        </button>
                        <button
                            className={`btn btn-sm ${activeTab === 'lock' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('lock')}
                        >
                            🔒 Khóa/Mở
                        </button>
                        <button
                            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('history')}
                        >
                            📜 Lịch sử
                        </button>
                    </div>

                    {/* Credits Tab */}
                    {activeTab === 'credits' && (
                        <div className="credits-editor">
                            <div className="credits-current">
                                <h3>{credits.toLocaleString('vi-VN')}</h3>
                                <p>Credits hiện tại</p>
                            </div>

                            <div className="form-group">
                                <label>Số lượng credits</label>
                                <input
                                    type="number"
                                    value={creditsAmount}
                                    onChange={(e) => setCreditsAmount(Math.max(0, parseInt(e.target.value) || 0))}
                                    min={0}
                                    placeholder="Nhập số credits"
                                />
                            </div>

                            <div className="credits-actions">
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={handleAddCredits}
                                    disabled={loading || creditsAmount <= 0}
                                    style={{ flex: 1 }}
                                >
                                    <Plus size={16} />
                                    Thêm
                                </button>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={handleSubtractCredits}
                                    disabled={loading || creditsAmount <= 0}
                                    style={{ flex: 1 }}
                                >
                                    <Minus size={16} />
                                    Trừ
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleSetCredits}
                                    disabled={loading}
                                    style={{ flex: 1 }}
                                >
                                    <Save size={16} />
                                    Đặt =
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lock Tab */}
                    {activeTab === 'lock' && (
                        <div>
                            <div style={{
                                padding: '20px',
                                background: user.isLocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                borderRadius: 'var(--border-radius-sm)',
                                textAlign: 'center',
                                marginBottom: '20px'
                            }}>
                                {user.isLocked ? (
                                    <>
                                        <Lock size={32} style={{ color: 'var(--danger)', marginBottom: '8px' }} />
                                        <h4 style={{ color: 'var(--danger)' }}>Tài khoản đang bị khóa</h4>
                                        {user.lockedReason && (
                                            <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.9rem' }}>
                                                Lý do: {user.lockedReason}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Unlock size={32} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                                        <h4 style={{ color: 'var(--success)' }}>Tài khoản đang hoạt động</h4>
                                    </>
                                )}
                            </div>

                            {!user.isLocked && (
                                <div className="form-group">
                                    <label>Lý do khóa (bắt buộc khi khóa)</label>
                                    <input
                                        type="text"
                                        value={lockReason}
                                        onChange={(e) => setLockReason(e.target.value)}
                                        placeholder="VD: Vi phạm điều khoản sử dụng"
                                    />
                                </div>
                            )}

                            <button
                                className={`btn ${user.isLocked ? 'btn-success' : 'btn-danger'}`}
                                onClick={handleToggleLock}
                                disabled={loading}
                                style={{ width: '100%' }}
                            >
                                {loading ? (
                                    <Loader2 size={18} className="loading-spinner" />
                                ) : user.isLocked ? (
                                    <>
                                        <Unlock size={18} />
                                        Mở khóa tài khoản
                                    </>
                                ) : (
                                    <>
                                        <Lock size={18} />
                                        Khóa tài khoản
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <History size={18} />
                                <span style={{ fontWeight: '600' }}>Lịch sử giao dịch</span>
                            </div>

                            {loadingBills ? (
                                <div className="loading-container">
                                    <div className="loading-spinner"></div>
                                </div>
                            ) : bills.length === 0 ? (
                                <div className="empty-state" style={{ padding: '40px 20px' }}>
                                    <p>Chưa có giao dịch nào</p>
                                </div>
                            ) : (
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {bills.map(bill => (
                                        <div
                                            key={bill.id}
                                            style={{
                                                padding: '12px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: 'var(--border-radius-sm)',
                                                marginBottom: '8px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: 'var(--success)', fontWeight: '600' }}>
                                                    +{bill.credits} credits
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    {formatDate(bill.timestamp)}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Thanh toán: {formatMoney(bill.amount)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserEditModal;
