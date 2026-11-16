import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { subscribeToAuthState, AdminUser } from './services/adminAuthService';
import AdminLogin from './components/AdminLogin';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UserList from './components/UserList';
import FeedbackInbox from './components/FeedbackInbox';
import NotificationSender from './components/NotificationSender';
import ClothingManager from './components/ClothingManager';
import AiConfigManager from './components/AiConfigManager';
import PackageConfigManager from './components/PackageConfigManager';
import { QuotaApprovalManager } from './components/QuotaApprovalManager';

type Page = 'dashboard' | 'quota-approvals' | 'users' | 'feedback' | 'notifications' | 'clothing' | 'package-config' | 'ai-config';

const App: React.FC = () => {
    const [admin, setAdmin] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToAuthState((user) => {
            setAdmin(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLoginSuccess = () => {
        // Auth state listener will update the admin state
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)'
            }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    // Not logged in - show login page
    if (!admin) {
        return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
    }

    // Logged in - show admin panel
    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard />;
            case 'quota-approvals':
                return <QuotaApprovalManager admin={admin} />;
            case 'users':
                return <UserList />;
            case 'feedback':
                return <FeedbackInbox admin={admin} />;
            case 'notifications':
                return <NotificationSender admin={admin} />;
            case 'clothing':
                return <ClothingManager />;
            case 'package-config':
                return <PackageConfigManager admin={admin} />;
            case 'ai-config':
                return <AiConfigManager admin={admin} />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="app-container">
            <div className="mobile-admin-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                        src="/icon.png"
                        alt="ImageTool"
                        style={{ width: 28, height: 28, borderRadius: '7px', objectFit: 'contain' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                        Admin Panel
                    </span>
                </div>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
                    style={{ minWidth: '44px', minHeight: '44px', padding: '0 10px' }}
                >
                    {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>
            <Sidebar
                currentPage={currentPage}
                onPageChange={(page) => setCurrentPage(page as Page)}
                admin={admin}
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
            />
            <main className="main-content">
                {renderPage()}
            </main>
        </div>
    );
};

export default App;
