import React, { useState, useEffect } from 'react';
import {
    Bell,
    Send,
    Users,
    User,
    Loader2,
    CheckCircle,
    History,
    RefreshCw
} from 'lucide-react';
import {
    sendNotification,
    getAllUsers,
    getAllNotifications,
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
    const [users, setUsers] = useState<UserData[]>([]);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
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
            const data = await getAllNotifications(30);
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
            alert('Vui lòng nhập đầy đủ tiêu đề và nội dung');
            return;
        }

        if (targetType === 'single' && !selectedUserId) {
            alert('Vui lòng chọn người dùng');
            return;
        }

        setLoading(true);
        setSuccess(false);

        try {
            const targetId = targetType === 'all' ? 'ALL' : selectedUserId;
            await sendNotification(targetId, title, message, admin.email || 'admin');

            setSuccess(true);
            setTitle('');
            setMessage('');
            setSelectedUserId('');

            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            alert('Lỗi khi gửi thông báo');
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

    const getTargetLabel = (targetId: string) => {
        if (targetId === 'ALL') return 'Tất cả users';
        const user = users.find(u => u.id === targetId);
        return user?.displayName || targetId.substring(0, 8) + '...';
    };

    return (
        <div className="user-list-container">
            <div className="page-header">
                <h1>Gửi thông báo</h1>
                <p>Gửi thông báo đến người dùng ImageTool</p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px'
            }}>
                <button
                    className={`btn ${activeTab === 'send' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('send')}
                >
                    <Send size={18} />
                    Gửi thông báo
                </button>
                <button
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('history')}
                >
                    <History size={18} />
                    Lịch sử
                </button>
            </div>

            {/* Send Tab */}
            {activeTab === 'send' && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    maxWidth: '600px'
                }}>
                    {success && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 16px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid var(--success)',
                            borderRadius: 'var(--border-radius-sm)',
                            color: 'var(--success)',
                            marginBottom: '20px'
                        }}>
                            <CheckCircle size={18} />
                            Đã gửi thông báo thành công!
                        </div>
                    )}

                    <form className="notification-form" onSubmit={handleSubmit}>
                        {/* Target Selection */}
                        <div className="form-group">
                            <label>Gửi đến</label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    background: targetType === 'all' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    flex: 1
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
                                    gap: '8px',
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    background: targetType === 'single' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    flex: 1
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
                            <div className="form-group">
                                <label>Chọn người dùng</label>
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Chọn user --</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.displayName} ({user.email || 'no email'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Title */}
                        <div className="form-group">
                            <label>Tiêu đề</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="VD: Thông báo cập nhật mới"
                                required
                            />
                        </div>

                        {/* Message */}
                        <div className="form-group">
                            <label>Nội dung</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Nội dung thông báo..."
                                required
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ width: '100%' }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="loading-spinner" />
                                    Đang gửi...
                                </>
                            ) : (
                                <>
                                    <Bell size={18} />
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
                    overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>
                            Thông báo đã gửi
                        </h3>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={fetchNotifications}
                            disabled={loadingHistory}
                        >
                            <RefreshCw size={16} className={loadingHistory ? 'loading-spinner' : ''} />
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="empty-state">
                            <Bell size={48} />
                            <h3>Chưa có thông báo</h3>
                            <p>Các thông báo đã gửi sẽ hiển thị ở đây</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    style={{
                                        padding: '16px 20px',
                                        borderBottom: '1px solid var(--border-color)'
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '8px'
                                    }}>
                                        <h4 style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                                            {notif.title}
                                        </h4>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)',
                                            whiteSpace: 'nowrap',
                                            marginLeft: '12px'
                                        }}>
                                            {formatDate(notif.timestamp)}
                                        </span>
                                    </div>
                                    <p style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.9rem',
                                        marginBottom: '8px'
                                    }}>
                                        {notif.message}
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        gap: '12px',
                                        fontSize: '0.8rem',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <span>👤 Gửi bởi: {notif.createdBy}</span>
                                        <span>📬 Đến: {getTargetLabel(notif.targetUserId)}</span>
                                    </div>
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
