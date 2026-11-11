import React, { useState, useEffect, useMemo } from 'react';
import {
    AlertTriangle,
    Trash2,
    Search,
    Video,
    Save,
    CheckSquare,
    Square
} from 'lucide-react';
import {
    subscribeToQuotaApprovalRequests,
    approveQuotaRequest,
    rejectQuotaRequest,
    deleteQuotaRequest,
    deleteBatchQuotaRequests,
    getGoogleQuotaGuideVideoUrl,
    saveGoogleQuotaGuideVideoUrl,
    QuotaApprovalRequest
} from '../services/adminFirebaseService';
import { AdminUser } from '../services/adminAuthService';

interface QuotaApprovalManagerProps {
    admin: AdminUser;
}

type TabType = 'pending' | 'approved' | 'rejected';

const QUICK_REJECT_REASONS = [
    'Tài khoản Google đã từng liên kết trước đó (Trùng lặp)',
    'Tài khoản Google không hợp lệ hoặc không xác thực được',
    'Phát hiện gian lận nhiều tài khoản ảo trên cùng thiết bị',
    'Mỗi tài khoản Google chỉ được nhận thưởng 1 lần duy nhất'
];

export const QuotaApprovalManager: React.FC<QuotaApprovalManagerProps> = ({ admin }) => {
    const [requests, setRequests] = useState<QuotaApprovalRequest[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Action States
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModalReq, setRejectModalReq] = useState<QuotaApprovalRequest | null>(null);
    const [rejectReason, setRejectReason] = useState(QUICK_REJECT_REASONS[0]);
    const [customReason, setCustomReason] = useState('');
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Guide Video URL
    const [videoUrl, setVideoUrl] = useState('');
    const [savingVideo, setSavingVideo] = useState(false);

    useEffect(() => {
        const unsub = subscribeToQuotaApprovalRequests((list) => {
            setRequests(list);
        });
        getGoogleQuotaGuideVideoUrl().then(setVideoUrl);
        return () => unsub();
    }, []);

    const showToast = (type: 'success' | 'error', text: string) => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // 1. Phân tích thống kê & Kiểm tra trùng lặp Email Google
    const { duplicateGoogleEmails, userSubmissionCountMap } = useMemo(() => {
        const googleEmailCounts = new Map<string, number>();
        const userSubmissions = new Map<string, number>();

        requests.forEach((r) => {
            const gEmail = r.googleEmail.toLowerCase().trim();
            if (gEmail) {
                googleEmailCounts.set(gEmail, (googleEmailCounts.get(gEmail) || 0) + 1);
            }
            if (r.userId) {
                userSubmissions.set(r.userId, (userSubmissions.get(r.userId) || 0) + 1);
            }
        });

        // Set of emails that appear > 1 time or already approved
        const dupes = new Set<string>();
        const approvedEmails = new Set(
            requests.filter((r) => r.status === 'approved').map((r) => r.googleEmail.toLowerCase().trim())
        );

        requests.forEach((r) => {
            const gEmail = r.googleEmail.toLowerCase().trim();
            if ((googleEmailCounts.get(gEmail) || 0) > 1) {
                dupes.add(gEmail);
            } else if (r.status === 'pending' && approvedEmails.has(gEmail)) {
                dupes.add(gEmail);
            }
        });

        return { duplicateGoogleEmails: dupes, userSubmissionCountMap: userSubmissions };
    }, [requests]);

    // 2. Lọc theo Tab và Search
    const filteredRequests = useMemo(() => {
        return requests.filter((r) => {
            if (r.status !== activeTab) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
                r.googleEmail.toLowerCase().includes(q) ||
                r.userEmail.toLowerCase().includes(q) ||
                r.userName.toLowerCase().includes(q)
            );
        });
    }, [requests, activeTab, searchQuery]);

    const pendingCount = requests.filter((r) => r.status === 'pending').length;
    const approvedCount = requests.filter((r) => r.status === 'approved').length;
    const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

    // 3. Selection Handlers
    const handleToggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredRequests.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
        }
    };

    // 4. Action Handlers
    const handleApprove = async (req: QuotaApprovalRequest) => {
        setProcessingId(req.id);
        try {
            await approveQuotaRequest(req, admin.email || 'Admin');
            showToast('success', `Đã duyệt +10 ảnh (hạn 30 ngày) cho ${req.userEmail}!`);
        } catch (err: any) {
            showToast('error', `Lỗi duyệt: ${err.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleConfirmReject = async () => {
        if (!rejectModalReq) return;
        const finalReason = customReason.trim() || rejectReason;
        setProcessingId(rejectModalReq.id);
        try {
            await rejectQuotaRequest(rejectModalReq, finalReason, admin.email || 'Admin');
            showToast('success', `Đã từ chối và gửi phản hồi đến ${rejectModalReq.userEmail}!`);
            setRejectModalReq(null);
            setCustomReason('');
        } catch (err: any) {
            showToast('error', `Lỗi từ chối: ${err.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteOne = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;
        try {
            await deleteQuotaRequest(id);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            showToast('success', 'Đã xóa bản ghi!');
        } catch (err: any) {
            showToast('error', `Lỗi xóa: ${err.message}`);
        }
    };

    const handleDeleteBatch = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Bạn có chắc muốn xóa đồng loạt ${selectedIds.size} bản ghi đã chọn?`)) return;

        try {
            await deleteBatchQuotaRequests(Array.from(selectedIds));
            setSelectedIds(new Set());
            showToast('success', 'Đã xóa đồng loạt thành công!');
        } catch (err: any) {
            showToast('error', `Lỗi xóa đồng loạt: ${err.message}`);
        }
    };

    const handleSaveVideoUrl = async () => {
        setSavingVideo(true);
        try {
            await saveGoogleQuotaGuideVideoUrl(videoUrl, admin.email || 'Admin');
            showToast('success', 'Đã lưu link Video HD hướng dẫn Mobile!');
        } catch (err: any) {
            showToast('error', `Lỗi lưu link video: ${err.message}`);
        } finally {
            setSavingVideo(false);
        }
    };

    const formatDate = (ts?: number) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="quota-approval-manager" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 9999,
                    background: toastMessage.type === 'success' ? '#059669' : '#dc2626',
                    color: '#ffffff',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    fontSize: '13px',
                    fontWeight: 600
                }}>
                    {toastMessage.type === 'success' ? '✓ ' : '⚠️ '} {toastMessage.text}
                </div>
            )}

            {/* Header Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 22
                    }}>
                        🎁
                    </div>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                            Phê duyệt ưu đãi liên kết Google
                        </h1>
                        <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                            Kiểm duyệt tài khoản, chống trùng lặp email và cấp +10 ảnh (hết hạn sau 30 ngày)
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Config Video HD Box */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#ede9fe',
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Video size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'block' }}>
                            Link Video HD Hướng dẫn Mobile (User bấm "Xem video HD" trên điện thoại sẽ mở link này)
                        </span>
                        <input
                            type="text"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=... hoặc link video mp4/drive"
                            style={{
                                width: '100%',
                                marginTop: '6px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                color: '#0f172a'
                            }}
                        />
                    </div>
                </div>

                <button
                    onClick={handleSaveVideoUrl}
                    disabled={savingVideo}
                    style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        background: '#6366f1',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '38px',
                        alignSelf: 'flex-end'
                    }}
                >
                    <Save size={14} />
                    {savingVideo ? 'Đang lưu...' : 'Lưu link video'}
                </button>
            </div>

            {/* 3 Tabs Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '2px'
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => { setActiveTab('pending'); setSelectedIds(new Set()); }}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '12px 12px 0 0',
                            border: 'none',
                            background: activeTab === 'pending' ? '#ffffff' : 'transparent',
                            color: activeTab === 'pending' ? '#d97706' : '#64748b',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: activeTab === 'pending' ? '3px solid #d97706' : 'none'
                        }}
                    >
                        <span>⏳ Chờ duyệt</span>
                        <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800
                        }}>
                            {pendingCount}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('approved'); setSelectedIds(new Set()); }}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '12px 12px 0 0',
                            border: 'none',
                            background: activeTab === 'approved' ? '#ffffff' : 'transparent',
                            color: activeTab === 'approved' ? '#059669' : '#64748b',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: activeTab === 'approved' ? '3px solid #059669' : 'none'
                        }}
                    >
                        <span>✅ Đã duyệt</span>
                        <span style={{
                            background: '#d1fae5',
                            color: '#065f46',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800
                        }}>
                            {approvedCount}
                        </span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('rejected'); setSelectedIds(new Set()); }}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '12px 12px 0 0',
                            border: 'none',
                            background: activeTab === 'rejected' ? '#ffffff' : 'transparent',
                            color: activeTab === 'rejected' ? '#dc2626' : '#64748b',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: activeTab === 'rejected' ? '3px solid #dc2626' : 'none'
                        }}
                    >
                        <span>❌ Từ chối</span>
                        <span style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800
                        }}>
                            {rejectedCount}
                        </span>
                    </button>
                </div>

                {/* Batch Delete and Search Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleDeleteBatch}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Trash2 size={14} />
                            <span>Xóa {selectedIds.size} mục đã chọn</span>
                        </button>
                    )}

                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm theo email user / Google..."
                            style={{
                                padding: '8px 12px 8px 32px',
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                width: '240px'
                            }}
                        />
                        <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                    </div>
                </div>
            </div>

            {/* Table of Requests */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <th style={{ padding: '14px 16px', width: '40px' }}>
                                <button
                                    onClick={handleSelectAll}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                >
                                    {selectedIds.size > 0 && selectedIds.size === filteredRequests.length ? (
                                        <CheckSquare size={16} color="#6366f1" />
                                    ) : (
                                        <Square size={16} color="#94a3b8" />
                                    )}
                                </button>
                            </th>
                            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Tài khoản User Tool</th>
                            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Email Google liên kết</th>
                            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Ưu đãi</th>
                            <th style={{ padding: '14px 16px', fontWeight: 700 }}>Thời gian</th>
                            {activeTab === 'rejected' && (
                                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Lý do từ chối</th>
                            )}
                            <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRequests.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    Không có yêu cầu nào trong tab này.
                                </td>
                            </tr>
                        ) : (
                            filteredRequests.map((req) => {
                                const isDupe = duplicateGoogleEmails.has(req.googleEmail.toLowerCase().trim());
                                const userSubCount = userSubmissionCountMap.get(req.userId) || 1;
                                const isSelected = selectedIds.has(req.id);
                                const isBusy = processingId === req.id;

                                return (
                                    <tr
                                        key={req.id}
                                        style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            background: isDupe && activeTab === 'pending' ? '#fffbeb' : isSelected ? '#f5f3ff' : '#ffffff'
                                        }}
                                    >
                                        <td style={{ padding: '14px 16px' }}>
                                            <button
                                                onClick={() => handleToggleSelect(req.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                            >
                                                {isSelected ? (
                                                    <CheckSquare size={16} color="#6366f1" />
                                                ) : (
                                                    <Square size={16} color="#cbd5e1" />
                                                )}
                                            </button>
                                        </td>

                                        {/* User Info */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                                {req.userEmail || 'Chưa có email'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                Tên: {req.userName || 'User'} • Đã nạp: <strong style={{ color: '#4f46e5' }}>{userSubCount} tài khoản</strong>
                                            </div>
                                        </td>

                                        {/* Google Email with Duplicate Warning Badge */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{req.googleEmail}</span>
                                            </div>
                                            {isDupe && (
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    marginTop: '4px',
                                                    background: '#fee2e2',
                                                    color: '#991b1b',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 700
                                                }}>
                                                    <AlertTriangle size={12} />
                                                    <span>⚠️ CẢNH BÁO: TRÙNG EMAIL GOOGLE</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Reward info */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                background: '#dcfce7',
                                                color: '#15803d',
                                                padding: '4px 8px',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                fontSize: '11px'
                                            }}>
                                                +{req.requestedRewardImages || 10} ảnh (30 ngày)
                                            </span>
                                        </td>

                                        {/* Timestamp */}
                                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                                            <div>{formatDate(req.createdAt)}</div>
                                            {req.reviewedAt && (
                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                    Xử lý: {formatDate(req.reviewedAt)} bởi {req.reviewedBy || 'Admin'}
                                                </div>
                                            )}
                                        </td>

                                        {/* Reject Note if tab rejected */}
                                        {activeTab === 'rejected' && (
                                            <td style={{ padding: '14px 16px', color: '#b91c1c', fontSize: '12px' }}>
                                                {req.reviewNote || 'Từ chối bởi Admin'}
                                            </td>
                                        )}

                                        {/* Action Buttons */}
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                {activeTab === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(req)}
                                                            disabled={isBusy}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: '#10b981',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                opacity: isBusy ? 0.5 : 1
                                                            }}
                                                        >
                                                            {isBusy ? '...' : '✓ Duyệt'}
                                                        </button>

                                                        <button
                                                            onClick={() => setRejectModalReq(req)}
                                                            disabled={isBusy}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: '#ef4444',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                opacity: isBusy ? 0.5 : 1
                                                            }}
                                                        >
                                                            ✕ Không duyệt
                                                        </button>
                                                    </>
                                                )}

                                                <button
                                                    onClick={() => handleDeleteOne(req.id)}
                                                    title="Xóa bản ghi này"
                                                    style={{
                                                        padding: '6px',
                                                        borderRadius: '8px',
                                                        background: 'transparent',
                                                        color: '#94a3b8',
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Nhập lý do từ chối */}
            {rejectModalReq && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        maxWidth: '500px',
                        width: '100%',
                        padding: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                                Từ chối ưu đãi: {rejectModalReq.googleEmail}
                            </h3>
                            <button
                                onClick={() => setRejectModalReq(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
                            Lý do này sẽ được gửi trực tiếp thành <strong>Thông báo</strong> về tài khoản người dùng <strong>{rejectModalReq.userEmail}</strong>.
                        </p>

                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                            Chọn lý do nhanh:
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                            {QUICK_REJECT_REASONS.map((r, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => { setRejectReason(r); setCustomReason(''); }}
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: rejectReason === r && !customReason ? '2px solid #ef4444' : '1px solid #e2e8f0',
                                        background: rejectReason === r && !customReason ? '#fef2f2' : '#ffffff',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: '#334155',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                            Hoặc tự gõ lý do phản hồi riêng:
                        </label>
                        <textarea
                            rows={3}
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            placeholder="Gõ lý do từ chối gửi về cho user..."
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                fontSize: '13px',
                                boxSizing: 'border-box',
                                marginBottom: '20px'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={() => setRejectModalReq(null)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleConfirmReject}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '10px',
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Xác nhận từ chối & Gửi thông báo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
