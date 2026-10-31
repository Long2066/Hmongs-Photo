import React from 'react';
import {
    LayoutDashboard,
    Users,
    Bell,
    LogOut,
    Shield,
    Shirt
} from 'lucide-react';
import { AdminUser, logoutAdmin } from '../services/adminAuthService';

interface SidebarProps {
    currentPage: string;
    onPageChange: (page: string) => void;
    admin: AdminUser;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, admin }) => {
    const handleLogout = async () => {
        if (confirm('Bạn có chắc muốn đăng xuất?')) {
            await logoutAdmin();
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users', label: 'Quản lý Users', icon: Users },
        { id: 'notifications', label: 'Gửi thông báo', icon: Bell },
        { id: 'clothing', label: 'Thư viện Trang phục', icon: Shirt },
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
                    >
                        <item.icon size={20} />
                        {item.label}
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
