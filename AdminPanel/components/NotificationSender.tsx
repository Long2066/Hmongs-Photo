import React, { useState, useEffect } from 'react';
import {
    Bell,
    Send,
    Users,
    User,
    Loader2,
    CheckCircle,
    History,
    RefreshCw,
    AlertCircle,
    Trash2,
    X
} from 'lucide-react';
import {
    sendNotification,
    getAllUsers,
    getAllNotifications,
    deleteNotification,
    UserData,
    NotificationData
} from '../services/adminFirebaseService';
import { AdminUser } from '../services/adminAuthService';

interface NotificationSenderProps {
    admin: AdminUser;
}

const NotificationSender: React.FC<NotificationSenderProps> = ({ admin }) => {
    const [targetType, setTargetType] = useState<'all' | 'single'>('all');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [users, setUsers] = useState<UserData[]>([]);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchNotifications();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchNotifications = async () => {
        setLoadingHistory(true);
        try {
            const data = await getAllNotifications(50);
            setNotifications(data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !message.trim()) {
            setErrorMessage('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo');
            return;
        }

        if (targetType === 'single' && !selectedUserId) {
            setErrorMessage('Vui lòng chọn người dùng nhận thông báo');
            return;
        }

        setLoading(true);
        setSuccess(false);
        setErrorMessage(null);

        try {
            const targetId = targetType === 'all' ? 'ALL' : selectedUserId;
            await sendNotification(targetId, title.trim(), message.trim(), admin.email || 'Admin');

            setSuccess(true);
            setTitle('');
            setMessage('');
            setSelectedUserId('');

            setTimeout(() => setSuccess(false), 5000);
        } catch (error: any) {
            console.error('Error sending notification:', error);
            if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
                setErrorMessage('Lỗi phân quyền Firestore (permission-denied): Security Rules trên Firebase Console chưa cho phép ghi vào collection "notifications". Vui lòng cập nhật Rules trên Firebase Console để hoàn tất.');
            } else {
                setErrorMessage(`Lỗi khi gửi thông báo: ${error?.message || error}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id?: string) => {
        if (!id) return;
        if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;

        setDeletingId(id);
        try {
            await deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error: any) {
            console.error('Error deleting notification:', error);
            alert(`Lỗi khi xóa thông báo: ${error?.message || error}`);
        } finally {
            setDeletingId(null);
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

    const getTargetLabel = (targetId: string) => {
        if (targetId === 'ALL') return 'Tất cả users';
        const user = users.find(u => u.id === targetId);
        return user?.displayName || (targetId.length > 12 ? targetId.substring(0, 10) + '...' : targetId);
    };

    return (
        <div className="user-list-container">
            <div className="page-header">
                <div>
                    <h1>Gửi thông báo</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Gửi thông báo hệ thống realtime đến người dùng ImageTool
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px'
            }}>
                <button
                    type="button"
                    className={`btn ${activeTab === 'send' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                        setActiveTab('send');
                        setErrorMessage(null);
                    }}
                >
                    <Send size={18} />
                    Gửi thông báo
                </button>
                <button
                    type="button"
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                        setActiveTab('history');
                        setErrorMessage(null);
                    }}
                >
                    <History size={18} />
                    Lịch sử ({notifications.length})
                </button>
            </div>

            {/* Send Tab */}
            {activeTab === 'send' && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '28px',
                    maxWidth: '640px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}>
                    {success && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '14px 18px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: 'var(--border-radius-sm)',
                            color: '#10b981',
                            marginBottom: '24px',
                            fontWeight: '500'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <CheckCircle size={20} />
                                <span>Đã gửi thông báo thành công đến người dùng!</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSuccess(false)}
                                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {errorMessage && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '14px 18px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: 'var(--border-radius-sm)',
                            color: '#ef4444',
                            marginBottom: '24px',
                            fontSize: '0.9rem',
                            lineHeight: '1.5'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>{errorMessage}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setErrorMessage(null)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    <form className="notification-form" onSubmit={handleSubmit}>
                        {/* Target Selection */}
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem' }}>
                                Gửi đến
                            </label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    padding: '14px 16px',
                                    background: targetType === 'all' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: targetType === 'all' ? '#ffffff' : 'var(--text-primary)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    flex: 1,
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease',
                                    border: targetType === 'all' ? '1px solid transparent' : '1px solid var(--border-color)'
                                }}>
                                    <input
                                        type="radio"
                                        name="targetType"
                                        checked={targetType === 'all'}
                                        onChange={() => setTargetType('all')}
                                        style={{ display: 'none' }}
                                    />
                                    <Users size={18} />
                                    Tất cả users
                                </label>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    padding: '14px 16px',
                                    background: targetType === 'single' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: targetType === 'single' ? '#ffffff' : 'var(--text-primary)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    flex: 1,
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease',
                                    border: targetType === 'single' ? '1px solid transparent' : '1px solid var(--border-color)'
                                }}>
                                    <input
                                        type="radio"
                                        name="targetType"
                                        checked={targetType === 'single'}
                                        onChange={() => setTargetType('single')}
                                        style={{ display: 'none' }}
                                    />
                                    <User size={18} />
                                    Một user
                                </label>
                            </div>
                        </div>

                        {/* User Selector */}
                        {targetType === 'single' && (
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem' }}>
                                    Chọn người dùng nhận
                                </label>
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        borderRadius: 'var(--border-radius-sm)',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    <option value="">-- Chọn user nhận --</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.displayName} {user.email ? `(${user.email})` : `(${user.id.substring(0, 8)}...)`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Title */}
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem' }}>
                                Tiêu đề
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="VD: THÔNG BÁO NÂNG CẤP HỆ THỐNG"
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: 'var(--border-radius-sm)',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>

                        {/* Message */}
                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem' }}>
                                Nội dung thông báo
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Nhập nội dung thông báo gửi tới người dùng..."
                                rows={4}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: 'var(--border-radius-sm)',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.95rem',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '14px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="loading-spinner" />
                                    Đang gửi thông báo...
                                </>
                            ) : (
                                <>
                                    <Bell size={20} />
                                    Gửi thông báo
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '18px 24px',
                        borderBottom: '1px solid var(--border-color)'
                    }}>
                        <div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>
                                Lịch sử thông báo đã gửi
                            </h3>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Danh sách các thông báo broadcast và tin nhắn cá nhân
                            </span>
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={fetchNotifications}
                            disabled={loadingHistory}
                            title="Làm mới"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <RefreshCw size={16} className={loadingHistory ? 'loading-spinner' : ''} />
                            <span>Làm mới</span>
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div className="loading-container" style={{ padding: '60px 0' }}>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <Bell size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                            <h3 style={{ fontWeight: '600', marginBottom: '8px' }}>Chưa có thông báo nào</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Các thông báo đã gửi sẽ hiển thị tại đây</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    style={{
                                        padding: '18px 24px',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: '16px',
                                        transition: 'background 0.2s ease'
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            marginBottom: '8px'
                                        }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                background: notif.targetUserId === 'ALL' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                color: notif.targetUserId === 'ALL' ? '#6366f1' : '#10b981',
                                                fontWeight: '600'
                                            }}>
                                                {notif.targetUserId === 'ALL' ? 'Broadcast' : 'User riêng'}
                                            </span>
                                            <h4 style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)' }}>
                                                {notif.title}
                                            </h4>
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-muted)',
                                                marginLeft: 'auto'
                                            }}>
                                                {formatDate(notif.timestamp)}
                                            </span>
                                        </div>
                                        <p style={{
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.92rem',
                                            lineHeight: '1.5',
                                            marginBottom: '10px',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {notif.message}
                                        </p>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '16px',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)'
                                        }}>
                                            <span>👤 Gửi bởi: <strong>{notif.createdBy || 'Admin'}</strong></span>
                                            <span>📬 Đến: <strong>{getTargetLabel(notif.targetUserId)}</strong></span>
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    {notif.id && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(notif.id)}
                                            disabled={deletingId === notif.id}
                                            title="Xóa thông báo"
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color = '#ef4444';
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            {deletingId === notif.id ? (
                                                <Loader2 size={18} className="loading-spinner" />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationSender;
