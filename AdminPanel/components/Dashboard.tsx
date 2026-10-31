import React, { useEffect, useState } from 'react';
import {
    Users,
    UserCheck,
    Coins,
    TrendingUp,
    Image,
    RefreshCw,
    Radio,
    Cloud,
    Globe,
    Activity
} from 'lucide-react';
import {
    getTotalUserCount,
    getTodayActiveCount,
    getTotalCreditsIssued,
    getTotalAmountSpent,
    getTotalImagesGenerated,
    getRegistrationStats,
    subscribeToRealtimeStats,
    RealtimeCloudStats
} from '../services/adminFirebaseService';

interface Stats {
    totalUsers: number;
    activeToday: number;
    totalDeposited: number; // VND deposited
    totalSpent: number; // VND spent
    totalImages: number; // Images generated
    registrationStats: { date: string; count: number }[];
}

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0,
        activeToday: 0,
        totalDeposited: 0,
        totalSpent: 0,
        totalImages: 0,
        registrationStats: []
    });

    const [cloudStats, setCloudStats] = useState<RealtimeCloudStats>({
        totalVisits: 75,
        todayVisits: 12,
        onlineCount: 1,
        activeToday: 1,
        activeSessions: []
    });

    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const [totalUsers, activeToday, totalDeposited, totalSpent, totalImages, registrationStats] = await Promise.all([
                getTotalUserCount(),
                getTodayActiveCount(),
                getTotalCreditsIssued(),
                getTotalAmountSpent(),
                getTotalImagesGenerated(),
                getRegistrationStats()
            ]);

            setStats({ totalUsers, activeToday, totalDeposited, totalSpent, totalImages, registrationStats });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch for historical / aggregation metrics
        fetchStats();

        // Realtime subscription for live online presence & cloud visits
        const unsubscribe = subscribeToRealtimeStats((realtimeData) => {
            setCloudStats(realtimeData);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const formatNumber = (num: number) => {
        return num.toLocaleString('vi-VN');
    };

    const formatVND = (num: number) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'Tr';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toLocaleString('vi-VN') + 'đ';
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    const formatTimeAgo = (timestamp: number) => {
        const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (diffSeconds < 15) return 'Vừa xong';
        if (diffSeconds < 60) return `${diffSeconds}s trước`;
        const diffMinutes = Math.floor(diffSeconds / 60);
        return `${diffMinutes}p trước`;
    };

    const maxCount = Math.max(...stats.registrationStats.map(s => s.count), 1);

    return (
        <div className="dashboard">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h1>Dashboard</h1>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid rgba(5, 150, 105, 0.2)',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: '#059669',
                                boxShadow: '0 0 6px #059669'
                            }}></span>
                            Realtime Sync
                        </span>
                    </div>
                    <p>Tổng quan hệ thống ImageTool và lưu lượng đám mây theo thời gian thực</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={fetchStats}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} className={loading ? 'loading-spinner' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Realtime & Key Stats Grid */}
            <div className="stats-grid">
                {/* 1. Realtime Online Active Sessions */}
                <div className="stat-card" style={{ borderColor: '#a7f3d0', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #059669, #10b981)'
                    }}></div>
                    <div className="stat-icon green">
                        <Radio size={24} />
                    </div>
                    <div className="stat-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ color: '#059669' }}>{formatNumber(cloudStats.onlineCount)}</h3>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#059669',
                                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                            }}></span>
                        </div>
                        <p style={{ fontWeight: 600 }}>Đang trực tuyến (Live)</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Thời gian thực (2 phút gần nhất)</small>
                    </div>
                </div>

                {/* 2. Today's Cloud Visits */}
                <div className="stat-card" style={{ borderColor: '#bae6fd', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #0284c7, #38bdf8)'
                    }}></div>
                    <div className="stat-icon cyan">
                        <Cloud size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{formatNumber(cloudStats.todayVisits)}</h3>
                        <p style={{ fontWeight: 600 }}>Truy cập hôm nay</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tự động reset 00:00 hàng ngày</small>
                    </div>
                </div>

                {/* 3. Total Cloud Visits */}
                <div className="stat-card" style={{ borderColor: '#c7d2fe', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #4f46e5, #818cf8)'
                    }}></div>
                    <div className="stat-icon purple">
                        <Globe size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{formatNumber(cloudStats.totalVisits)}</h3>
                        <p style={{ fontWeight: 600 }}>Tổng truy cập đám mây</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tích lũy từ tool chính & đám mây</small>
                    </div>
                </div>

                {/* 4. Total Users */}
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatNumber(stats.totalUsers)}</h3>
                        <p style={{ fontWeight: 600 }}>Tổng Users đăng ký</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tài khoản xác thực hệ thống</small>
                    </div>
                </div>

                {/* 5. Active Today (Authenticated) */}
                <div className="stat-card">
                    <div className="stat-icon green">
                        <UserCheck size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{formatNumber(cloudStats.activeToday || stats.activeToday)}</h3>
                        <p style={{ fontWeight: 600 }}>Đăng nhập hôm nay</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tài khoản đã đăng nhập</small>
                    </div>
                </div>

                {/* 6. Total Deposited */}
                <div className="stat-card">
                    <div className="stat-icon purple">
                        <Coins size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatVND(stats.totalDeposited)}</h3>
                        <p style={{ fontWeight: 600 }}>Tổng tiền nạp (VNĐ)</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Từ các hóa đơn đã duyệt</small>
                    </div>
                </div>

                {/* 7. Total Spent */}
                <div className="stat-card">
                    <div className="stat-icon red">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatVND(stats.totalSpent)}</h3>
                        <p style={{ fontWeight: 600 }}>Đã tiêu thụ (VNĐ)</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chi phí tạo ảnh VIP</small>
                    </div>
                </div>

                {/* 8. Total Images */}
                <div className="stat-card">
                    <div className="stat-icon cyan">
                        <Image size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatNumber(stats.totalImages)}</h3>
                        <p style={{ fontWeight: 600 }}>Tổng ảnh đã tạo</p>
                        <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qua tất cả tính năng AI</small>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Active Sessions & Registration Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginTop: '20px' }}>
                {/* Active Sessions Panel */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-xs)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                            <Activity size={20} style={{ color: '#059669' }} />
                            🟢 Phiên trực tuyến thời gian thực ({cloudStats.onlineCount})
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heartbeat: 40s</span>
                    </div>

                    {cloudStats.activeSessions.length === 0 ? (
                        <div style={{
                            padding: '32px 16px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.875rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Radio size={28} style={{ opacity: 0.5, animation: 'pulse 2s infinite' }} />
                            <span>Chưa phát hiện phiên trực tuyến nào trong 2 phút qua.</span>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            maxHeight: '230px',
                            overflowY: 'auto',
                            paddingRight: '4px'
                        }}>
                            {cloudStats.activeSessions.map((session, idx) => (
                                <div
                                    key={session.sessionId || idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        background: '#f8fafc',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: '#059669',
                                            boxShadow: '0 0 6px #059669'
                                        }}></span>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {session.displayName || 'Khách truy cập'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                ID: {session.userId !== 'guest' ? session.userId.substring(0, 12) + '...' : 'Khách vãng lai'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            background: '#ecfdf5',
                                            color: '#047857',
                                            border: '1px solid rgba(5, 150, 105, 0.2)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            fontWeight: 600
                                        }}>
                                            {formatTimeAgo(session.lastSeen)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Registration Chart */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    boxShadow: 'var(--shadow-xs)'
                }}>
                    <h3 style={{ marginBottom: '20px', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        📊 Đăng ký 7 ngày gần đây ({stats.registrationStats.reduce((a, b) => a + b.count, 0)} người dùng)
                    </h3>

                    {loading ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '190px' }}>
                            {stats.registrationStats.map((stat, index) => (
                                <div
                                    key={index}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                        {stat.count}
                                    </span>
                                    <div
                                        style={{
                                            width: '100%',
                                            height: '130px',
                                            background: '#f1f5f9',
                                            borderRadius: '6px 6px 0 0',
                                            display: 'flex',
                                            alignItems: 'flex-end',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '100%',
                                                height: `${Math.max((stat.count / maxCount) * 130, 8)}px`,
                                                background: 'linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%)',
                                                borderRadius: '6px 6px 0 0',
                                                transition: 'height 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {formatDate(stat.date)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
