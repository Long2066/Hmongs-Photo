import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Users,
    Inbox,
    Bell,
    LogOut,
    Shield,
    Shirt,
    Cpu
} from 'lucide-react';
import { AdminUser, logoutAdmin } from '../services/adminAuthService';
import { subscribeToFeedback } from '../services/adminFirebaseService';

interface SidebarProps {
    currentPage: string;
    onPageChange: (page: string) => void;
    admin: AdminUser;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, admin }) => {
    const [unreadFeedbackCount, setUnreadFeedbackCount] = useState<number>(0);

    useEffect(() => {
        const unsub = subscribeToFeedback((_, unread) => {
            setUnreadFeedbackCount(unread);
        });
        return () => unsub();
    }, []);

    const handleLogout = async () => {
        if (confirm('Bạn có chắc muốn đăng xuất?')) {
            await logoutAdmin();
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users', label: 'Quản lý Users', icon: Users },
        { id: 'feedback', label: 'Hòm thư góp ý', icon: Inbox, badge: unreadFeedbackCount },
        { id: 'notifications', label: 'Gửi thông báo', icon: Bell },
        { id: 'clothing', label: 'Thư viện Trang phục', icon: Shirt },
        { id: 'ai-config', label: 'Cấu hình AI Tool', icon: Cpu },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={24} style={{ color: 'var(--accent-primary)' }} />
                    <div>
                        <h2>Admin Panel</h2>
                        <p>ImageTool</p>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                        onClick={() => onPageChange(item.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                            <span style={{
                                background: '#e11d48',
                                color: '#ffffff',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                minWidth: '20px',
                                textAlign: 'center',
                                boxShadow: '0 1px 3px rgba(225, 29, 72, 0.4)'
                            }} className="font-mono tabular-nums">
                                {item.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="admin-info">
                    <div className="admin-avatar">
                        {admin.displayName?.[0]?.toUpperCase() || admin.email?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="admin-details">
                        <h4>{admin.displayName || 'Admin'}</h4>
                        <p>{admin.email}</p>
                    </div>
                </div>

                <button
                    className="btn btn-secondary"
                    onClick={handleLogout}
                    style={{ width: '100%' }}
                >
                    <LogOut size={18} />
                    Đăng xuất
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
