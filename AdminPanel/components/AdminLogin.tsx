import React, { useState } from 'react';
import { Shield, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { loginAdmin } from '../services/adminAuthService';

interface AdminLoginProps {
    onLoginSuccess: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await loginAdmin(email, password);
            onLoginSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo">
                    <Shield size={48} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
                    <h1>Admin Panel</h1>
                    <p>ImageTool - Quản lý hệ thống</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="error-message">
                            <AlertCircle size={16} style={{ marginRight: '8px' }} />
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }}
                            />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@example.com"
                                required
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Mật khẩu</label>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }}
                            />
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ width: '100%', marginTop: '8px' }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="loading-spinner" />
                                Đang đăng nhập...
                            </>
                        ) : (
                            <>
                                <Shield size={18} />
                                Đăng nhập Admin
                            </>
                        )}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center',
                    marginTop: '24px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                }}>
                    Chỉ quản trị viên được phép truy cập
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
