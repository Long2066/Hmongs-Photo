import React, { useState, useEffect } from 'react';
import * as firebaseAuth from '../services/firebaseService';
import { User } from '../types';

interface AuthModalProps {
    onClose?: () => void;
    onAuthSuccess: (user: User) => void;
    isBlocking?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess, isBlocking = false }) => {
    const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');

    // Animation text effect
    const [welcomeText, setWelcomeText] = useState('');
    const fullText = "Chào mừng đến với ToolPhoto2025...";

    useEffect(() => {
        let i = 0;
        const timer = setInterval(() => {
            setWelcomeText(fullText.substring(0, i));
            i++;
            if (i > fullText.length) clearInterval(timer);
        }, 50);
        return () => clearInterval(timer);
    }, []);

    // Password Strength Logic
    const getPasswordStrength = (pwd: string) => {
        if (!pwd) return 0;
        let score = 0;
        if (pwd.length > 6) score++;
        if (pwd.length > 8 && /[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;
        return score;
    };

    const strength = getPasswordStrength(password);

    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');

        if (!validateEmail(email)) {
            setError('Vui lòng nhập email hợp lệ.');
            return;
        }

        try {
            if (view === 'login') {
                const fbUser = await firebaseAuth.loginUser(email, password);
                if (!fbUser.emailVerified) {
                    // BẮT BUỘC xác minh email - logout và không cho vào
                    await firebaseAuth.logoutUser();
                    setError('Email chưa được xác minh. Vui lòng kiểm tra hộp thư (kể cả mục Spam) để xác nhận tài khoản.');
                    return;
                }
                // Construct local User object from Firebase User
                const user: User = {
                    id: fbUser.uid,
                    username: fbUser.email || '',
                    name: fbUser.displayName || email.split('@')[0],
                    avatar: fbUser.photoURL || `https://ui-avatars.com/api/?name=${fbUser.displayName || 'User'}&background=random`
                };
                onAuthSuccess(user);
            } else if (view === 'signup') {
                if (strength < 1) {
                    setError('Mật khẩu quá yếu (Tối thiểu 7 ký tự).');
                    return;
                }
                if (!name.trim()) {
                    setError('Vui lòng nhập tên hiển thị.');
                    return;
                }
                await firebaseAuth.registerUser(email, password, name);
                setInfoMessage('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
                setView('login');
            } else if (view === 'forgot') {
                await firebaseAuth.resetPassword(email);
                setInfoMessage("Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư.");
                setTimeout(() => setView('login'), 3000);
            }
        } catch (err: any) {
            console.error(err);
            let msg = 'Đã xảy ra lỗi.';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Email hoặc mật khẩu không đúng.';
            if (err.code === 'auth/email-already-in-use') msg = 'Email đã được sử dụng.';
            if (err.code === 'auth/too-many-requests') msg = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
            if (err.code === 'auth/api-key-not-valid-please-pass-a-valid-api-key') msg = 'Cấu hình Firebase chưa đúng (API Key không hợp lệ).';

            // Append raw error message for easier debugging
            if (msg === 'Đã xảy ra lỗi.') {
                msg += ` Chi tiết: ${err.message}`;
            }
            setError(msg);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-lg flex items-center justify-center z-50 overflow-hidden">
            {/* Animated Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/30 to-pink-600/30 rounded-full blur-[120px] animate-pulse-glow"></div>
            <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[80px] animate-float"></div>

            <div className="relative bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/40 ring-1 ring-white/50">
                {/* Header */}
                <div className="p-10 pb-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 animate-gradient-x rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 ring-4 ring-white/50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white animate-pulse">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 to-purple-800 tracking-tight">ToolPhoto2025</h2>
                    <p className="text-indigo-600 font-mono text-xs mt-2 min-h-[1.5em] font-semibold">{welcomeText}</p>
                    <p className="text-slate-400 text-xs font-medium mt-1">Phiên bản V1.0</p>
                </div>

                <div className="px-10 pb-10">
                    {/* View Switcher */}
                    {view !== 'forgot' && (
                        <div className="flex bg-slate-100/50 p-1.5 rounded-xl mb-6 border border-slate-200/50">
                            <button onClick={() => setView('login')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${view === 'login' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Đăng nhập</button>
                            <button onClick={() => setView('signup')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${view === 'signup' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Đăng ký</button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {view === 'forgot' ? (
                            <>
                                <div className="text-center mb-2">
                                    <h3 className="font-bold text-slate-800">Khôi phục mật khẩu</h3>
                                    <p className="text-xs text-slate-500">Nhập email để nhận liên kết đặt lại mật khẩu.</p>
                                </div>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email đăng ký" className="w-full bg-white/50 border border-slate-200 rounded-xl p-3.5 mt-1 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                            </>
                        ) : (
                            <>
                                {view === 'signup' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Tên hiển thị</label>
                                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" className="w-full bg-white/50 border border-slate-200 rounded-xl p-3.5 mt-1 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Email</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" className="w-full bg-white/50 border border-slate-200 rounded-xl p-3.5 mt-1 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Mật khẩu</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-white/50 border border-slate-200 rounded-xl p-3.5 mt-1 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                                </div>
                            </>
                        )}

                        {/* Password Strength Meter (Signup Only) */}
                        {view === 'signup' && password.length > 0 && (
                            <div className="flex gap-1 h-1 mt-1 px-1">
                                <div className={`flex-1 rounded-full ${strength >= 0 ? 'bg-red-400' : 'bg-slate-200'}`}></div>
                                <div className={`flex-1 rounded-full ${strength >= 1 ? 'bg-yellow-400' : 'bg-slate-200'}`}></div>
                                <div className={`flex-1 rounded-full ${strength >= 2 ? 'bg-green-400' : 'bg-slate-200'}`}></div>
                            </div>
                        )}

                        {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg text-center animate-pulse">{error}</div>}
                        {infoMessage && <div className="text-green-600 text-sm font-medium bg-green-50 p-3 rounded-lg text-center animate-pulse">{infoMessage}</div>}

                        <button type="submit" className="w-full mt-2 px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-gradient-x text-white font-bold rounded-xl hover:shadow-xl hover:shadow-indigo-500/40 transition-all transform active:scale-[0.98]">
                            {view === 'login' ? 'Truy cập ngay' : view === 'signup' ? 'Tạo tài khoản' : 'Đổi mật khẩu'}
                        </button>
                    </form>

                    {view === 'login' && (
                        <button onClick={() => setView('forgot')} className="w-full text-center mt-4 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                            Quên mật khẩu?
                        </button>
                    )}
                    {view === 'forgot' && (
                        <button onClick={() => setView('login')} className="w-full text-center mt-4 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                            Quay lại đăng nhập
                        </button>
                    )}

                    {!isBlocking && onClose && (
                        <button onClick={onClose} className="w-full text-center mt-6 text-slate-400 text-sm hover:text-slate-600">Đóng</button>
                    )}
                </div>
            </div>
        </div>
    );
};