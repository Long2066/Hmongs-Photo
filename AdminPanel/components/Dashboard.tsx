import React, { useEffect, useState } from 'react';
import {
    Users,
    UserCheck,
    Coins,
    TrendingUp,
    Image,
    RefreshCw
} from 'lucide-react';
import {
    getTotalUserCount,
    getTodayActiveCount,
    getTotalCreditsIssued,
    getTotalAmountSpent,
    getTotalImagesGenerated,
    getRegistrationStats
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
        fetchStats();
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

    const maxCount = Math.max(...stats.registrationStats.map(s => s.count), 1);

    return (
        <div className="dashboard">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Dashboard</h1>
                    <p>Tổng quan hệ thống ImageTool</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={fetchStats}
                    disabled={loading}
                >
                    <RefreshCw size={18} className={loading ? 'loading-spinner' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatNumber(stats.totalUsers)}</h3>
                        <p>Tổng Users</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon green">
                        <UserCheck size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatNumber(stats.activeToday)}</h3>
                        <p>Hoạt động hôm nay</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon purple">
                        <Coins size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatVND(stats.totalDeposited)}</h3>
                        <p>Tổng tiền nạp (VNĐ)</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon red">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatVND(stats.totalSpent)}</h3>
                        <p>Đã tiêu thụ (VNĐ)</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon cyan">
                        <Image size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatNumber(stats.totalImages)}</h3>
                        <p>Tổng ảnh đã tạo</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon orange">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{loading ? '...' : formatNumber(stats.registrationStats.reduce((a, b) => a + b.count, 0))}</h3>
                        <p>Đăng ký 7 ngày qua</p>
                    </div>
                </div>
            </div>

            {/* Registration Chart */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                padding: '24px'
            }}>
                <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>
                    📊 Đăng ký 7 ngày gần đây
                </h3>

                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px' }}>
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
                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                                    {stat.count}
                                </span>
                                <div
                                    style={{
                                        width: '100%',
                                        height: `${Math.max((stat.count / maxCount) * 160, 8)}px`,
                                        background: 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)',
                                        borderRadius: '6px 6px 0 0',
                                        transition: 'height 0.3s ease'
                                    }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {formatDate(stat.date)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
