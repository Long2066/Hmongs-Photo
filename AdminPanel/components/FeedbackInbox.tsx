import React, { useState, useEffect, useMemo } from 'react';
import {
    Inbox,
    Mail,
    Search,
    CheckCircle2,
    Clock,
    Trash2,
    Eye,
    MessageSquare,
    ExternalLink,
    AlertCircle,
    Check,
    X
} from 'lucide-react';
import {
    FeedbackItem,
    subscribeToFeedback,
    updateFeedbackStatus,
    deleteFeedbackItem,
    markAllFeedbackAsRead
} from '../services/adminFirebaseService';
import { AdminUser } from '../services/adminAuthService';

interface FeedbackInboxProps {
    admin: AdminUser;
}

export const FeedbackInbox: React.FC<FeedbackInboxProps> = ({ admin }) => {
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read' | 'replied'>('all');
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
    const [replyNote, setReplyNote] = useState<string>('');
    const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    // Subscribe to feedbacks in real time
    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToFeedback((items, unread) => {
            setFeedbacks(items);
            setUnreadCount(unread);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Notification toast auto-clear
    useEffect(() => {
        if (actionSuccess) {
            const timer = setTimeout(() => setActionSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [actionSuccess]);

    // Filtered and searched feedbacks
    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(item => {
            // Status filter
            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
            }
            // Search query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const matchName = item.name.toLowerCase().includes(query);
                const matchEmail = item.email.toLowerCase().includes(query);
                const matchTitle = item.title.toLowerCase().includes(query);
                const matchMessage = item.message.toLowerCase().includes(query);
                return matchName || matchEmail || matchTitle || matchMessage;
            }
            return true;
        });
    }, [feedbacks, statusFilter, searchQuery]);

    // Handle open detail modal
    const handleViewDetail = (item: FeedbackItem) => {
        setSelectedFeedback(item);
        setReplyNote(item.replyNote || '');

        // If unread, mark as read automatically
        if (item.status === 'unread') {
            updateFeedbackStatus(item.id, 'read');
        }
    };

    // Save admin note and status
    const handleSaveNoteAndStatus = async (newStatus: 'read' | 'replied') => {
        if (!selectedFeedback) return;
        setIsSavingStatus(true);
        try {
            await updateFeedbackStatus(
                selectedFeedback.id,
                newStatus,
                replyNote.trim(),
                admin.email || 'Admin'
            );
            setSelectedFeedback(prev => prev ? {
                ...prev,
                status: newStatus,
                replyNote: replyNote.trim(),
                repliedAt: Date.now(),
                repliedBy: admin.email || 'Admin'
            } : null);
            setActionSuccess(newStatus === 'replied' ? 'Đã lưu phản hồi & đánh dấu đã xử lý!' : 'Đã cập nhật trạng thái thư!');
        } catch (error) {
            console.error('Error updating feedback:', error);
            alert('Không thể lưu trạng thái. Vui lòng thử lại.');
        } finally {
            setIsSavingStatus(false);
        }
    };

    // Handle delete feedback
    const handleDelete = async (item: FeedbackItem, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!confirm(`Bạn có chắc muốn xóa thư góp ý từ "${item.name}"?`)) return;

        try {
            await deleteFeedbackItem(item.id);
            if (selectedFeedback?.id === item.id) {
                setSelectedFeedback(null);
            }
            setActionSuccess('Đã xóa thư thành công!');
        } catch (error) {
            console.error('Error deleting feedback:', error);
            alert('Không thể xóa thư. Vui lòng thử lại.');
        }
    };

    // Handle mark all as read
    const handleMarkAllRead = async () => {
        if (unreadCount === 0) return;
        try {
            await markAllFeedbackAsRead(feedbacks);
            setActionSuccess(`Đã đánh dấu ${unreadCount} thư là đã đọc!`);
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    // Format timestamp nicely
    const formatTimestamp = (timestamp: number): string => {
        if (!timestamp) return 'Vừa xong';
        const date = new Date(timestamp);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getRelativeTime = (timestamp: number): string => {
        if (!timestamp) return 'Vừa xong';
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return new Date(timestamp).toLocaleDateString('vi-VN');
    };

    return (
        <div className="dashboard-container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Page Header */}
            <div className="dashboard-header" style={{ marginBottom: '24px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <Inbox size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                Hòm thư góp ý & Báo lỗi
                            </h1>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                Tiếp nhận phản hồi, ý kiến cải tiến & báo lỗi gửi trực tiếp từ Tool chính theo thời gian thực
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleMarkAllRead}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            title="Đánh dấu tất cả thư chưa đọc thành đã đọc"
                        >
                            <CheckCircle2 size={16} />
                            <span>Đọc tất cả ({unreadCount})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Action Success Toast */}
            {actionSuccess && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-xs)'
                }}>
                    <CheckCircle2 size={18} color="#059669" />
                    <span>{actionSuccess}</span>
                </div>
            )}

            {/* Stats Metrics Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                {/* Total */}
                <div className="stat-card" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Tổng số thư
                        </span>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#eef2ff',
                            color: '#4f46e5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Inbox size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }} className="font-mono tabular-nums">
                        {feedbacks.length}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Đồng bộ từ Tool chính
                    </span>
                </div>

                {/* Unread */}
                <div className="stat-card" style={{ padding: '18px 20px', borderLeft: unreadCount > 0 ? '4px solid #f43f5e' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Chưa đọc
                        </span>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#ffe4e6',
                            color: '#e11d48',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertCircle size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: unreadCount > 0 ? '#e11d48' : 'var(--text-primary)', marginTop: '8px' }} className="font-mono tabular-nums">
                        {unreadCount}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: unreadCount > 0 ? '#e11d48' : 'var(--text-muted)', fontWeight: unreadCount > 0 ? 600 : 400 }}>
                        {unreadCount > 0 ? 'Cần xem & xử lý' : 'Đã xem toàn bộ thư'}
                    </span>
                </div>

                {/* Replied / Handled */}
                <div className="stat-card" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Đã xử lý / Phản hồi
                        </span>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#ecfdf5',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }} className="font-mono tabular-nums">
                        {feedbacks.filter(f => f.status === 'replied').length}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 500 }}>
                        Đã hỗ trợ khách hàng
                    </span>
                </div>

                {/* Read */}
                <div className="stat-card" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Đã xem
                        </span>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#f0f9ff',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Clock size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }} className="font-mono tabular-nums">
                        {feedbacks.filter(f => f.status === 'read').length}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Đang lưu trữ
                    </span>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px'
                }}>
                    {/* Status Tabs */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'all', label: 'Tất cả', count: feedbacks.length },
                            { id: 'unread', label: 'Chưa đọc', count: unreadCount, isAlert: unreadCount > 0 },
                            { id: 'read', label: 'Đã đọc', count: feedbacks.filter(f => f.status === 'read').length },
                            { id: 'replied', label: 'Đã xử lý', count: feedbacks.filter(f => f.status === 'replied').length },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setStatusFilter(tab.id as any)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease',
                                    background: statusFilter === tab.id
                                        ? 'var(--accent-primary)'
                                        : 'var(--bg-tertiary)',
                                    color: statusFilter === tab.id
                                        ? '#ffffff'
                                        : 'var(--text-secondary)'
                                }}
                            >
                                <span>{tab.label}</span>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    fontWeight: 700,
                                    background: statusFilter === tab.id
                                        ? 'rgba(255, 255, 255, 0.25)'
                                        : tab.isAlert ? '#ffe4e6' : 'rgba(0, 0, 0, 0.05)',
                                    color: statusFilter === tab.id
                                        ? '#ffffff'
                                        : tab.isAlert ? '#e11d48' : 'var(--text-muted)'
                                }} className="font-mono tabular-nums">
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px', maxWidth: '450px' }}>
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên, email, tiêu đề, nội dung..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 12px 9px 36px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                            }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Feedbacks Content List */}
            {loading ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Đang đồng bộ hòm thư góp ý từ Cloud Firestore...
                    </p>
                </div>
            ) : filteredFeedbacks.length === 0 ? (
                /* Empty State */
                <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: 'var(--text-muted)'
                    }}>
                        <Inbox size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        {searchQuery || statusFilter !== 'all' ? 'Không tìm thấy thư góp ý phù hợp' : 'Hòm thư hiện đang trống'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 18px' }}>
                        {searchQuery || statusFilter !== 'all'
                            ? 'Thử xóa bộ lọc hoặc tìm kiếm từ khóa khác để xem các góp ý từ người dùng.'
                            : 'Khi người dùng trên Tool chính gửi phản hồi, góp ý tính năng hoặc báo lỗi qua nút Góp ý, toàn bộ nội dung sẽ xuất hiện tức thì tại đây.'}
                    </p>
                    {(searchQuery || statusFilter !== 'all') && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                            style={{ margin: '0 auto' }}
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            ) : (
                /* Feedbacks Table / List */
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="user-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Người gửi
                                    </th>
                                    <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Tiêu đề & Nội dung góp ý
                                    </th>
                                    <th style={{ padding: '12px 18px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '130px' }}>
                                        Trạng thái
                                    </th>
                                    <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '150px' }}>
                                        Thời gian
                                    </th>
                                    <th style={{ padding: '12px 18px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>
                                        Hành động
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFeedbacks.map((item) => {
                                    const isUnread = item.status === 'unread';
                                    const isReplied = item.status === 'replied';

                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => handleViewDetail(item)}
                                            style={{
                                                cursor: 'pointer',
                                                borderBottom: '1px solid var(--border-color)',
                                                background: isUnread ? 'rgba(238, 242, 255, 0.45)' : 'transparent',
                                                transition: 'background 0.15s ease'
                                            }}
                                            className="feedback-row"
                                        >
                                            {/* Sender info */}
                                            <td style={{ padding: '14px 18px', verticalAlign: 'top', width: '240px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '10px',
                                                        background: isUnread ? '#4f46e5' : 'var(--bg-tertiary)',
                                                        color: isUnread ? '#ffffff' : 'var(--text-secondary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 700,
                                                        fontSize: '0.875rem',
                                                        flexShrink: 0
                                                    }}>
                                                        {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: isUnread ? 700 : 600,
                                                            color: 'var(--text-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}>
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {item.name || 'Người dùng ẩn danh'}
                                                            </span>
                                                            {isUnread && (
                                                                <span style={{
                                                                    width: '7px',
                                                                    height: '7px',
                                                                    borderRadius: '50%',
                                                                    background: '#e11d48',
                                                                    display: 'inline-block',
                                                                    flexShrink: 0
                                                                }} />
                                                            )}
                                                        </div>
                                                        <a
                                                            href={`mailto:${item.email}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                color: 'var(--text-muted)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                marginTop: '2px',
                                                                textDecoration: 'none'
                                                            }}
                                                            title="Bấm để gửi email cho người dùng này"
                                                        >
                                                            <Mail size={12} />
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {item.email}
                                                            </span>
                                                        </a>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Subject & Message */}
                                            <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                                                <div style={{
                                                    fontSize: '0.875rem',
                                                    fontWeight: isUnread ? 700 : 600,
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '4px'
                                                }}>
                                                    {item.title || 'Góp ý ImageTool'}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.8125rem',
                                                    color: 'var(--text-secondary)',
                                                    lineHeight: 1.5,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {item.message}
                                                </div>
                                                {item.replyNote && (
                                                    <div style={{
                                                        marginTop: '6px',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        background: '#ecfdf5',
                                                        border: '1px solid #a7f3d0',
                                                        fontSize: '0.72rem',
                                                        color: '#065f46',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <CheckCircle2 size={12} />
                                                        <span>Ghi chú BQT: {item.replyNote}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td style={{ padding: '14px 18px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                {isUnread ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 8px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        background: '#ffe4e6',
                                                        color: '#e11d48',
                                                        border: '1px solid #fecdd3'
                                                    }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e11d48' }} />
                                                        Chưa đọc
                                                    </span>
                                                ) : isReplied ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 8px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        background: '#ecfdf5',
                                                        color: '#059669',
                                                        border: '1px solid #a7f3d0'
                                                    }}>
                                                        <Check size={12} />
                                                        Đã xử lý
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 8px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        background: '#f0f9ff',
                                                        color: '#0284c7',
                                                        border: '1px solid #bae6fd'
                                                    }}>
                                                        <Clock size={12} />
                                                        Đã đọc
                                                    </span>
                                                )}
                                            </td>

                                            {/* Timestamp */}
                                            <td style={{ padding: '14px 18px', textAlign: 'right', verticalAlign: 'middle' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {getRelativeTime(item.createdAt)}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} className="font-mono tabular-nums">
                                                    {formatTimestamp(item.createdAt)}
                                                </div>
                                            </td>

                                            {/* Action buttons */}
                                            <td style={{ padding: '14px 18px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleViewDetail(item); }}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '8px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: 'var(--text-secondary)'
                                                        }}
                                                        title="Xem chi tiết & Ghi chú"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(item, e)}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '8px',
                                                            background: '#fee2e2',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#dc2626'
                                                        }}
                                                        title="Xóa thư góp ý này"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail & Reply Note Modal */}
            {selectedFeedback && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.55)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }} onClick={() => setSelectedFeedback(null)}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '680px',
                        boxShadow: 'var(--shadow-lg)',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                        animation: 'fadeIn 0.2s ease-out'
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '18px 24px',
                            background: 'var(--bg-tertiary)',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: 'var(--accent-primary)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                        Chi tiết thư góp ý
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="font-mono tabular-nums">
                                        ID: {selectedFeedback.id}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedFeedback(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    color: 'var(--text-muted)',
                                    borderRadius: '8px'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Sender Info Banner */}
                            <div style={{
                                background: 'var(--bg-primary)',
                                padding: '16px',
                                borderRadius: '14px',
                                border: '1px solid var(--border-color)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '12px',
                                marginBottom: '20px'
                            }}>
                                <div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Họ và tên
                                    </span>
                                    <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                                        {selectedFeedback.name || 'Người dùng ẩn danh'}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Email liên hệ
                                    </span>
                                    <div style={{ marginTop: '2px' }}>
                                        <a
                                            href={`mailto:${selectedFeedback.email}?subject=Phản hồi từ Ban Quản Trị ImageTool: ${encodeURIComponent(selectedFeedback.title)}`}
                                            style={{
                                                fontSize: '0.925rem',
                                                fontWeight: 600,
                                                color: 'var(--accent-primary)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                textDecoration: 'none'
                                            }}
                                            title="Bấm để mở trình soạn email gửi phản hồi"
                                        >
                                            <span>{selectedFeedback.email}</span>
                                            <ExternalLink size={13} />
                                        </a>
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Thời gian gửi
                                    </span>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }} className="font-mono tabular-nums">
                                        {formatTimestamp(selectedFeedback.createdAt)}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Trạng thái hiện tại
                                    </span>
                                    <div style={{ marginTop: '4px' }}>
                                        {selectedFeedback.status === 'unread' ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e11d48', background: '#ffe4e6', padding: '3px 8px', borderRadius: '6px' }}>
                                                Chưa đọc
                                            </span>
                                        ) : selectedFeedback.status === 'replied' ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                                                Đã xử lý
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '3px 8px', borderRadius: '6px' }}>
                                                Đã xem
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Title & Message Content */}
                            <div style={{ marginBottom: '22px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Tiêu đề góp ý
                                </label>
                                <div style={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    padding: '10px 14px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '10px'
                                }}>
                                    {selectedFeedback.title || 'Góp ý ImageTool'}
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Nội dung chi tiết
                                </label>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.6,
                                    padding: '16px',
                                    background: '#ffffff',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    whiteSpace: 'pre-wrap',
                                    boxShadow: 'var(--shadow-xs)'
                                }}>
                                    {selectedFeedback.message}
                                </div>
                            </div>

                            {/* Admin Note & Status Management Box */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '14px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0'
                            }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    Ghi chú xử lý nội bộ của Ban Quản Trị
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Nhập ghi chú xử lý, nội dung đã phản hồi qua email/zalo cho người dùng..."
                                    value={replyNote}
                                    onChange={(e) => setReplyNote(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        background: '#ffffff',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        resize: 'vertical',
                                        marginBottom: '12px'
                                    }}
                                />

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            disabled={isSavingStatus}
                                            onClick={() => handleSaveNoteAndStatus('replied')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
                                        >
                                            <CheckCircle2 size={16} />
                                            <span>Đánh dấu Đã xử lý</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            disabled={isSavingStatus}
                                            onClick={() => handleSaveNoteAndStatus('read')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
                                        >
                                            <Clock size={16} />
                                            <span>Lưu ghi chú (Đã xem)</span>
                                        </button>
                                    </div>

                                    <a
                                        href={`mailto:${selectedFeedback.email}?subject=Phản hồi từ Ban Quản Trị ImageTool: ${encodeURIComponent(selectedFeedback.title)}&body=Chào ${encodeURIComponent(selectedFeedback.name)},%0D%0A%0D%0ABan Quản Trị ImageTool đã nhận được ý kiến đóng góp của bạn về: "${encodeURIComponent(selectedFeedback.title)}".%0D%0A%0D%0A`}
                                        className="btn btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px', textDecoration: 'none' }}
                                    >
                                        <Mail size={16} />
                                        <span>Gửi Email phản hồi</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '14px 24px',
                            background: 'var(--bg-tertiary)',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <button
                                type="button"
                                onClick={() => handleDelete(selectedFeedback)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#dc2626',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 8px'
                                }}
                            >
                                <Trash2 size={15} />
                                <span>Xóa thư này</span>
                            </button>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setSelectedFeedback(null)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeedbackInbox;
