import React, { useEffect, useState, useMemo } from 'react';
import {
    Search,
    Download,
    RefreshCw,
    Edit2,
    Lock,
    Unlock,
    Users,
    AlertCircle,
    Crown,
    Zap,
    Image as ImageIcon,
    Video,
    Coins,
    Clock
} from 'lucide-react';
import { getAllUsers, UserData } from '../services/adminFirebaseService';
import UserEditModal from './UserEditModal';
import * as XLSX from 'xlsx';

type FilterTab = 'all' | 'pro' | 'plus' | 'free' | 'expiring' | 'locked';

const UserList: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    // Filter counts
    const counts = useMemo(() => {
        let pro = 0;
        let plus = 0;
        let free = 0;
        let expiring = 0;
        let locked = 0;

        users.forEach(u => {
            if (u.isLocked) locked++;
            const p = u.plan || 'free';
            if (p === 'pro') pro++;
            else if (p === 'plus') plus++;
            else free++;

            if (p !== 'free' && u.planExpiresAt) {
                const diff = u.planExpiresAt - now;
                if (diff > 0 && diff <= threeDaysMs) {
                    expiring++;
                }
            }
        });

        return { all: users.length, pro, plus, free, expiring, locked };
    }, [users, now]);

    // Filtered users
    const filteredUsers = useMemo(() => {
        let list = users;

        // Apply Tab Filter
        if (activeFilter === 'pro') {
            list = list.filter(u => u.plan === 'pro');
        } else if (activeFilter === 'plus') {
            list = list.filter(u => u.plan === 'plus');
        } else if (activeFilter === 'free') {
            list = list.filter(u => !u.plan || u.plan === 'free');
        } else if (activeFilter === 'expiring') {
            list = list.filter(u => {
                if (!u.plan || u.plan === 'free' || !u.planExpiresAt) return false;
                const diff = u.planExpiresAt - now;
                return diff > 0 && diff <= threeDaysMs;
            });
        } else if (activeFilter === 'locked') {
            list = list.filter(u => u.isLocked);
        }

        // Apply Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(u =>
                (u.displayName && u.displayName.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.id && u.id.toLowerCase().includes(q))
            );
        }

        return list;
    }, [users, activeFilter, searchQuery, now]);

    const handleExportExcel = () => {
        const exportData = users.map(user => {
            const p = user.plan || 'free';
            const bonusImages = user.credits && user.credits > 0 ? Math.floor(user.credits / 500) : 0;
            return {
                'User ID': user.id,
                'Tên': user.displayName || '-',
                'Email': user.email || '-',
                'Gói hiện tại': p === 'pro' ? 'Gói Pro' : p === 'plus' ? 'Gói Plus' : 'Gói Free',
                'Lượt ảnh còn lại': user.remainingImages ?? 0,
                'Giây video còn lại': user.remainingVideoSeconds ?? 0,
                'Hạn sử dụng': user.planExpiresAt
                    ? new Date(user.planExpiresAt).toLocaleDateString('vi-VN')
                    : 'Vô thời hạn',
                'Ảnh thưởng cũ': bonusImages,
                'Số dư VND cũ': user.credits || 0,
                'Trạng thái': user.isLocked ? 'Đã khóa' : 'Hoạt động',
                'Ngày đăng ký': user.registeredAt
                    ? new Date(user.registeredAt).toLocaleDateString('vi-VN')
                    : '-',
                'Cập nhật lần cuối': user.lastUpdated
                    ? new Date(user.lastUpdated).toLocaleDateString('vi-VN')
                    : '-'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');

        // Auto-size columns
        const colWidths = [
            { wch: 28 }, // User ID
            { wch: 22 }, // Tên
            { wch: 28 }, // Email
            { wch: 14 }, // Gói
            { wch: 18 }, // Ảnh còn lại
            { wch: 18 }, // Video còn lại
            { wch: 16 }, // Hạn sử dụng
            { wch: 15 }, // Ảnh thưởng cũ
            { wch: 15 }, // Số dư VND
            { wch: 14 }, // Trạng thái
            { wch: 15 }, // Ngày đăng ký
            { wch: 18 }, // Cập nhật
        ];
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `users_subscription_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleUserUpdated = () => {
        fetchUsers();
        setSelectedUser(null);
    };

    const formatDate = (timestamp?: number | null) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="user-list-container">
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h1 style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' }}>Quản lý Users</h1>
                        <span style={{
                            background: '#eef2ff',
                            color: '#4f46e5',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: '1px solid #c7d2fe'
                        }}>
                            {users.length} tài khoản
                        </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                        Theo dõi gói dịch vụ, hạn mức ảnh/video và quản lý quyền người dùng trên hệ thống
                    </p>
                </div>
            </div>

            {/* Quick Filter Tabs */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '16px',
                marginBottom: '16px'
            }}>
                <button
                    onClick={() => setActiveFilter('all')}
                    style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: activeFilter === 'all' ? '#4f46e5' : '#e2e8f0',
                        background: activeFilter === 'all' ? '#4f46e5' : '#ffffff',
                        color: activeFilter === 'all' ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    Tất cả ({counts.all})
                </button>

                <button
                    onClick={() => setActiveFilter('pro')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: activeFilter === 'pro' ? '#4338ca' : '#c7d2fe',
                        background: activeFilter === 'pro' ? '#4338ca' : '#eef2ff',
                        color: activeFilter === 'pro' ? '#ffffff' : '#4338ca',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <Crown size={13} />
                    Gói Pro ({counts.pro})
                </button>

                <button
                    onClick={() => setActiveFilter('plus')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: activeFilter === 'plus' ? '#047857' : '#a7f3d0',
                        background: activeFilter === 'plus' ? '#047857' : '#ecfdf5',
                        color: activeFilter === 'plus' ? '#ffffff' : '#047857',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <Zap size={13} />
                    Gói Plus ({counts.plus})
                </button>

                <button
                    onClick={() => setActiveFilter('free')}
                    style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: activeFilter === 'free' ? '#475569' : '#e2e8f0',
                        background: activeFilter === 'free' ? '#475569' : '#f8fafc',
                        color: activeFilter === 'free' ? '#ffffff' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    Gói Free ({counts.free})
                </button>

                {counts.expiring > 0 && (
                    <button
                        onClick={() => setActiveFilter('expiring')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: '1px solid',
                            borderColor: activeFilter === 'expiring' ? '#d97706' : '#fde68a',
                            background: activeFilter === 'expiring' ? '#d97706' : '#fffbeb',
                            color: activeFilter === 'expiring' ? '#ffffff' : '#b45309',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Clock size={13} />
                        Sắp hết hạn ({counts.expiring})
                    </button>
                )}

                {counts.locked > 0 && (
                    <button
                        onClick={() => setActiveFilter('locked')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: '1px solid',
                            borderColor: activeFilter === 'locked' ? '#dc2626' : '#fecaca',
                            background: activeFilter === 'locked' ? '#dc2626' : '#fef2f2',
                            color: activeFilter === 'locked' ? '#ffffff' : '#dc2626',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Lock size={13} />
                        Đã khóa ({counts.locked})
                    </button>
                )}
            </div>

            {/* Toolbar */}
            <div className="toolbar" style={{ marginBottom: '16px' }}>
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo email, tên hoặc User ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className="btn btn-success" onClick={handleExportExcel} disabled={users.length === 0}>
                    <Download size={18} />
                    Export Excel
                </button>

                <button className="btn btn-secondary" onClick={fetchUsers} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'loading-spinner' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Data Table */}
            <div className="data-table">
                <div className="table-header" style={{ gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(180px, 1fr) minmax(220px, 1.4fr) 130px 120px 80px' }}>
                    <span>Người dùng</span>
                    <span>Email</span>
                    <span>Gói & Hạn mức</span>
                    <span>Trạng thái</span>
                    <span>Ngày ĐK</span>
                    <span style={{ textAlign: 'center' }}>Thao tác</span>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        {searchQuery || activeFilter !== 'all' ? (
                            <>
                                <AlertCircle size={48} />
                                <h3>Không tìm thấy kết quả phù hợp</h3>
                                <p>Thử đổi bộ lọc hoặc tìm kiếm với từ khóa khác</p>
                            </>
                        ) : (
                            <>
                                <Users size={48} />
                                <h3>Chưa có users</h3>
                                <p>Danh sách users sẽ hiển thị ở đây</p>
                            </>
                        )}
                    </div>
                ) : (
                    filteredUsers.map(user => {
                        const p = user.plan || 'free';
                        const expiresAt = user.planExpiresAt;
                        const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)) : null;
                        const isExpired = expiresAt ? expiresAt <= now : false;
                        const legacyBonusImages = user.credits && user.credits > 0 ? Math.floor(user.credits / 500) : 0;

                        return (
                            <div
                                key={user.id}
                                className="table-row"
                                style={{ gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(180px, 1fr) minmax(220px, 1.4fr) 130px 120px 80px' }}
                            >
                                {/* User Info */}
                                <div className="user-info">
                                    <div
                                        className="user-avatar"
                                        style={{
                                            background: p === 'pro'
                                                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                                                : p === 'plus'
                                                    ? 'linear-gradient(135deg, #059669, #10b981)'
                                                    : '#e2e8f0',
                                            color: p === 'free' ? '#475569' : '#ffffff',
                                            fontWeight: 700
                                        }}
                                    >
                                        {(user.displayName && user.displayName[0]?.toUpperCase()) || '?'}
                                    </div>
                                    <div className="user-details">
                                        <h4 style={{ fontWeight: 600, color: '#0f172a' }}>{user.displayName || 'Không có tên'}</h4>
                                        <p title={user.id} style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                            {user.id ? `${user.id.substring(0, 8)}...` : '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Email */}
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', wordBreak: 'break-all' }}>
                                    {user.email || '-'}
                                </span>

                                {/* Gói & Hạn mức (Subscription Quotas) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '8px' }}>
                                    {/* Plan Pill */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: p === 'pro' ? '#eef2ff' : p === 'plus' ? '#ecfdf5' : '#f1f5f9',
                                            color: p === 'pro' ? '#4338ca' : p === 'plus' ? '#047857' : '#64748b',
                                            border: `1px solid ${p === 'pro' ? '#c7d2fe' : p === 'plus' ? '#a7f3d0' : '#e2e8f0'}`
                                        }}>
                                            {p === 'pro' ? <Crown size={11} /> : p === 'plus' ? <Zap size={11} /> : null}
                                            {p === 'pro' ? 'Gói Pro' : p === 'plus' ? 'Gói Plus' : 'Gói Free'}
                                        </span>

                                        {/* Expiry Pill */}
                                        {p !== 'free' && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: isExpired ? '#fef2f2' : (daysLeft !== null && daysLeft <= 3) ? '#fffbeb' : '#f8fafc',
                                                color: isExpired ? '#dc2626' : (daysLeft !== null && daysLeft <= 3) ? '#b45309' : '#64748b',
                                                border: `1px solid ${isExpired ? '#fecaca' : (daysLeft !== null && daysLeft <= 3) ? '#fde68a' : '#e2e8f0'}`
                                            }}>
                                                {isExpired ? 'Hết hạn' : daysLeft !== null ? `Còn ${daysLeft}d` : '-'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Quotas: Images & Video Seconds */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.82rem',
                                        color: '#0f172a',
                                        fontWeight: 600,
                                        fontVariantNumeric: 'tabular-nums'
                                    }}>
                                        <span title="Ảnh khả dụng" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                            <ImageIcon size={13} style={{ color: '#4f46e5' }} />
                                            {user.remainingImages ?? 0} ảnh
                                        </span>
                                        <span style={{ color: '#cbd5e1' }}>•</span>
                                        <span title="Giây video khả dụng" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                            <Video size={13} style={{ color: '#0891b2' }} />
                                            {user.remainingVideoSeconds ?? 0}s video
                                        </span>
                                    </div>

                                    {/* Bonus Images / Daily Free */}
                                    {legacyBonusImages > 0 ? (
                                        <span style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                            <Coins size={12} />
                                            Thưởng cũ: <strong>{legacyBonusImages} ảnh</strong>
                                        </span>
                                    ) : p === 'free' ? (
                                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                            Hôm nay: {user.dailyFreeUsed || 0}/10 ảnh free
                                        </span>
                                    ) : null}
                                </div>

                                {/* Status */}
                                <span className={`status-badge ${user.isLocked ? 'locked' : 'active'}`}>
                                    {user.isLocked ? (
                                        <>
                                            <Lock size={12} />
                                            Đã khóa
                                        </>
                                    ) : (
                                        <>
                                            <Unlock size={12} />
                                            Hoạt động
                                        </>
                                    )}
                                </span>

                                {/* Registered Date */}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {formatDate(user.registeredAt)}
                                </span>

                                {/* Actions */}
                                <div className="action-btns" style={{ justifyContent: 'center' }}>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setSelectedUser(user)}
                                        title="Chỉnh sửa gói & hạn mức"
                                        style={{ minHeight: '36px', minWidth: '36px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <p style={{
                marginTop: '16px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                textAlign: 'right'
            }}>
                Hiển thị {filteredUsers.length} / {users.length} users
            </p>

            {/* Edit Modal */}
            {selectedUser && (
                <UserEditModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onUpdated={handleUserUpdated}
                />
            )}
        </div>
    );
};

export default UserList;
