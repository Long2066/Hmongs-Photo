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
    Activity,
    BarChart3,
    Eye,
    UserPlus
} from 'lucide-react';
import {
    getTotalUserCount,
    getTodayActiveCount,
    getTotalCreditsIssued,
    getTotalAmountSpent,
    getTotalImagesGenerated,
    get7DaysStats,
    subscribeToRealtimeStats,
    subscribeToSystemMetrics,
    RealtimeCloudStats,
    DailyTrafficItem
} from '../services/adminFirebaseService';

interface Stats {
    totalUsers: number;
    activeToday: number;
    totalDeposited: number; // VND deposited
    totalSpent: number; // VND spent
    totalImages: number; // Images generated
    sevenDaysData: DailyTrafficItem[];
}

type ChartMetric = 'visits' | 'activeUsers' | 'registrations';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        totalUsers: 14,
        activeToday: 2,
        totalDeposited: 250000,
        totalSpent: 115000,
        totalImages: 342,
        sevenDaysData: []
    });

    const [cloudStats, setCloudStats] = useState<RealtimeCloudStats>({
        totalVisits: 115,
        todayVisits: 52,
        onlineCount: 1,
        activeToday: 2,
        activeSessions: []
    });

    const [chartMetric, setChartMetric] = useState<ChartMetric>('visits');
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const [totalUsers, activeToday, totalDeposited, totalSpent, totalImages, sevenDaysData] = await Promise.all([
                getTotalUserCount(),
                getTodayActiveCount(),
                getTotalCreditsIssued(),
                getTotalAmountSpent(),
                getTotalImagesGenerated(),
                get7DaysStats()
            ]);

            setStats({
                totalUsers,
                activeToday,
                totalDeposited,
                totalSpent,
                totalImages,
                sevenDaysData
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch for historical / aggregation metrics
        fetchStats();

        // 1. Realtime subscription for live online presence & cloud visits
        const unsubPresence = subscribeToRealtimeStats((realtimeData) => {
            setCloudStats(realtimeData);
        });

        // 2. Realtime subscription for global system metrics (total deposited, spent, images)
        const unsubMetrics = subscribeToSystemMetrics((metrics) => {
            setStats(prev => ({
                ...prev,
                totalDeposited: metrics.totalDeposited,
                totalSpent: metrics.totalSpent,
                totalImages: metrics.totalImages
            }));
        });

        return () => {
            unsubPresence();
            unsubMetrics();
        };
    }, []);

    const formatNumber = (num: number) => {
        return (num || 0).toLocaleString('vi-VN');
    };

    const formatVND = (num: number) => {
        const val = num || 0;
        if (val >= 1000000) {
            return (val / 1000000).toFixed(1) + 'Tr';
        }
        if (val >= 1000) {
            return (val / 1000).toFixed(0) + 'K';
        }
        return val.toLocaleString('vi-VN') + 'đ';
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

    // Calculate chart metric values
    const getMetricValue = (item: DailyTrafficItem): number => {
        switch (chartMetric) {
            case 'visits': return item.visits;
            case 'activeUsers': return item.activeUsers;
            case 'registrations': return item.registrations;
            default: return item.count;
        }
    };

    const metricValues = stats.sevenDaysData.map(getMetricValue);
    const maxMetricVal = Math.max(...metricValues, 1);
    const totalMetricSum = metricValues.reduce((a, b) => a + b, 0);

    const getMetricTitle = () => {
        switch (chartMetric) {
            case 'visits': return `Lưu lượng truy cập 7 ngày gần đây (${formatNumber(totalMetricSum)} lượt)`;
            case 'activeUsers': return `Người dùng đăng nhập 7 ngày gần đây (${formatNumber(totalMetricSum)} phiên)`;
            case 'registrations': return `Đăng ký mới 7 ngày gần đây (${formatNumber(totalMetricSum)} tài khoản)`;
        }
    };

    return (
        <div className="dashboard">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h1 style={{ color: '#0f172a', fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
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
                    <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '4px' }}>
                        Tổng quan hệ thống ImageTool và dữ liệu vận hành thực tế theo thời gian thực
                    </p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={fetchStats}
                    disabled={loading}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        minHeight: '44px',
                        padding: '0 18px',
                        fontWeight: 600
                    }}
                >
                    <RefreshCw size={18} className={loading ? 'loading-spinner' : ''} />
                    Làm mới dữ liệu
                </button>
            </div>

            {/* Realtime & Key Stats Grid - 8 Connected Metrics */}
            <div className="stats-grid" style={{ marginTop: '20px' }}>
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
                            <h3 style={{ color: '#059669', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                                {formatNumber(cloudStats.onlineCount)}
                            </h3>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#059669',
                                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                            }}></span>
                        </div>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Đang trực tuyến (Live)</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Thời gian thực (2 phút gần nhất)</small>
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
                        <h3 style={{ color: '#0284c7', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {formatNumber(cloudStats.todayVisits)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Truy cập hôm nay</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Tự động reset 00:00 hàng ngày</small>
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
                        <h3 style={{ color: '#4f46e5', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {formatNumber(cloudStats.totalVisits)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Tổng truy cập đám mây</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Tích lũy từ tool chính & đám mây</small>
                    </div>
                </div>

                {/* 4. Total Users */}
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 style={{ color: '#2563eb', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {loading ? '...' : formatNumber(stats.totalUsers)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Tổng Users đăng ký</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Tài khoản xác thực hệ thống</small>
                    </div>
                </div>

                {/* 5. Active Today (Authenticated) */}
                <div className="stat-card">
                    <div className="stat-icon green">
                        <UserCheck size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 style={{ color: '#059669', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {formatNumber(cloudStats.activeToday || stats.activeToday)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Đăng nhập hôm nay</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Tài khoản đã đăng nhập</small>
                    </div>
                </div>

                {/* 6. Total Deposited */}
                <div className="stat-card">
                    <div className="stat-icon purple">
                        <Coins size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 style={{ color: '#7c3aed', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {loading ? '...' : formatVND(stats.totalDeposited)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Tổng tiền nạp (VNĐ)</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Cổng thanh toán tự động PayOS</small>
                    </div>
                </div>

                {/* 7. Total Spent */}
                <div className="stat-card">
                    <div className="stat-icon red">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 style={{ color: '#e11d48', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {loading ? '...' : formatVND(stats.totalSpent)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Đã tiêu thụ (VNĐ)</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Chi phí tạo ảnh VIP & gói cước PayOS</small>
                    </div>
                </div>

                {/* 8. Total Images */}
                <div className="stat-card">
                    <div className="stat-icon cyan">
                        <Image size={24} />
                    </div>
                    <div className="stat-content">
                        <h3 style={{ color: '#0891b2', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                            {loading ? '...' : formatNumber(stats.totalImages)}
                        </h3>
                        <p style={{ fontWeight: 600, color: '#1e293b' }}>Tổng ảnh đã tạo</p>
                        <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Qua tất cả tính năng AI</small>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Active Sessions & Interactive 7-Day Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginTop: '24px' }}>
                {/* Active Sessions Panel */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 600 }}>
                            <Activity size={20} style={{ color: '#059669' }} />
                            🟢 Phiên trực tuyến thời gian thực ({cloudStats.onlineCount})
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>Heartbeat: 40s</span>
                    </div>

                    {cloudStats.activeSessions.length === 0 ? (
                        <div style={{
                            padding: '36px 16px',
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: '0.875rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <Radio size={28} style={{ opacity: 0.5, animation: 'pulse 2s infinite', color: '#059669' }} />
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
                                        border: '1px solid rgba(226, 232, 240, 0.8)',
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
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                                {session.displayName || 'Khách truy cập'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
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

                {/* Interactive 7-Day Analytics Chart */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: 'var(--border-radius)',
                    padding: '24px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    {/* Chart Header & Metric Toggle Pills */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BarChart3 size={19} style={{ color: '#4f46e5' }} />
                                    {getMetricTitle()}
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                    Dữ liệu thực tế ghi nhận từ đám mây & thiết bị người dùng
                                </p>
                            </div>

                            {/* Metric Switcher Pills */}
                            <div style={{
                                display: 'inline-flex',
                                background: '#f1f5f9',
                                padding: '3px',
                                borderRadius: '8px',
                                gap: '4px'
                            }}>
                                <button
                                    onClick={() => setChartMetric('visits')}
                                    style={{
                                        border: 'none',
                                        background: chartMetric === 'visits' ? '#ffffff' : 'transparent',
                                        color: chartMetric === 'visits' ? '#4f46e5' : '#64748b',
                                        boxShadow: chartMetric === 'visits' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <Eye size={13} />
                                    Truy cập
                                </button>
                                <button
                                    onClick={() => setChartMetric('activeUsers')}
                                    style={{
                                        border: 'none',
                                        background: chartMetric === 'activeUsers' ? '#ffffff' : 'transparent',
                                        color: chartMetric === 'activeUsers' ? '#059669' : '#64748b',
                                        boxShadow: chartMetric === 'activeUsers' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <UserCheck size={13} />
                                    Đăng nhập
                                </button>
                                <button
                                    onClick={() => setChartMetric('registrations')}
                                    style={{
                                        border: 'none',
                                        background: chartMetric === 'registrations' ? '#ffffff' : 'transparent',
                                        color: chartMetric === 'registrations' ? '#2563eb' : '#64748b',
                                        boxShadow: chartMetric === 'registrations' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <UserPlus size={13} />
                                    Đăng ký
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading-container" style={{ minHeight: '160px' }}>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '175px', marginTop: '12px' }}>
                            {stats.sevenDaysData.map((stat, index) => {
                                const val = getMetricValue(stat);
                                const isToday = index === stats.sevenDaysData.length - 1;
                                const barHeightPercent = Math.max((val / maxMetricVal) * 100, 6);

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '6px',
                                            height: '100%',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <span style={{
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            color: val > 0 ? (isToday ? '#4f46e5' : '#1e293b') : '#94a3b8',
                                            fontFamily: 'monospace',
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>
                                            {val}
                                        </span>
                                        <div
                                            style={{
                                                width: '100%',
                                                height: '120px',
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
                                                    height: `${barHeightPercent}%`,
                                                    background: isToday
                                                        ? 'linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%)'
                                                        : val > 0
                                                            ? 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)'
                                                            : '#e2e8f0',
                                                    borderRadius: '6px 6px 0 0',
                                                    transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: val > 0 ? '0 2px 4px rgba(79, 70, 229, 0.2)' : 'none'
                                                }}
                                            />
                                        </div>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: isToday ? 700 : 500,
                                            color: isToday ? '#4f46e5' : '#64748b'
                                        }}>
                                            {formatDate(stat.date)}
                                            {isToday && <span style={{ display: 'block', fontSize: '0.65rem', color: '#059669', lineHeight: 1 }}>Hôm nay</span>}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
