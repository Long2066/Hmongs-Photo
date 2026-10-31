import React, { useState, useEffect } from 'react';
import { subscribeToAuthState, AdminUser } from './services/adminAuthService';
import AdminLogin from './components/AdminLogin';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UserList from './components/UserList';
import FeedbackInbox from './components/FeedbackInbox';
import NotificationSender from './components/NotificationSender';
import ClothingManager from './components/ClothingManager';
import AiConfigManager from './components/AiConfigManager';

type Page = 'dashboard' | 'users' | 'feedback' | 'notifications' | 'clothing' | 'ai-config';

const App: React.FC = () => {
    const [admin, setAdmin] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');

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
            case 'users':
                return <UserList />;
            case 'feedback':
                return <FeedbackInbox admin={admin} />;
            case 'notifications':
                return <NotificationSender admin={admin} />;
            case 'clothing':
                return <ClothingManager />;
            case 'ai-config':
                return <AiConfigManager admin={admin} />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="app-container">
            <Sidebar
                currentPage={currentPage}
                onPageChange={(page) => setCurrentPage(page as Page)}
                admin={admin}
            />
            <main className="main-content">
                {renderPage()}
            </main>
        </div>
    );
};

export default App;
