import React, { useState, useEffect } from 'react';
import * as firebaseAuth from '../services/firebaseService';
import { User } from '../types';
import TermsModal from './TermsModal';

interface AuthModalProps {
    onClose?: () => void;
    onAuthSuccess: (user: User) => void;
    isBlocking?: boolean;
    appVersion?: string; // Dynamic version from Electron API
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess, isBlocking = false, appVersion = '2.0.0' }) => {
    const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'verification_pending'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [verificationEmail, setVerificationEmail] = useState('');
    const [countdown, setCountdown] = useState(15);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    // Animation text effect
    const [welcomeText, setWelcomeText] = useState('');
    const fullText = "Chào mừng đến với ImageTool...";

    useEffect(() => {
        let i = 0;
        const timer = setInterval(() => {
            setWelcomeText(fullText.substring(0, i));
            i++;
            if (i > fullText.length) clearInterval(timer);
        }, 50);
        return () => clearInterval(timer);
    }, []);

    // Countdown for verification pending view
    useEffect(() => {
        if (view === 'verification_pending' && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (view === 'verification_pending' && countdown === 0) {
            setView('login');
            setCountdown(15); // Reset for next time
        }
    }, [view, countdown]);

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
                    setError('⚠️ Email chưa được xác minh!\n\nVui lòng kiểm tra hộp thư (kể cả mục Spam) và nhấn vào link xác minh để kích hoạt tài khoản.\n\nNếu không nhận được email, hãy đăng ký lại hoặc liên hệ hỗ trợ.');
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
                if (!termsAccepted) {
                    setError('Vui lòng đồng ý với Điều khoản sử dụng để tiếp tục.');
                    return;
                }
                await firebaseAuth.registerUser(email, password, name);
                // IMPORTANT: Logout immediately to prevent onAuthStateChanged from hiding modal
                await firebaseAuth.logoutUser();
                // Clear any errors and show verification pending view with countdown
                setError('');
                setInfoMessage('');
                setVerificationEmail(email);
                setCountdown(15);
                setView('verification_pending');
                setPassword('');
            } else if (view === 'forgot') {
                await firebaseAuth.resetPassword(email);
                // Show verification pending view with countdown
                setVerificationEmail(email);
                setCountdown(15);
                setView('verification_pending');
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
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-lg flex items-center justify-center z-[100] overflow-y-auto p-4 safe-area-top safe-area-bottom">
            {/* Animated Background Blob - Hidden on small screens for performance */}
            <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/30 to-pink-600/30 rounded-full blur-[120px] animate-pulse-glow"></div>
            <div className="hidden sm:block absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[80px] animate-float"></div>

            <div className="relative bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/40 ring-1 ring-white/50 max-h-[95vh] overflow-y-auto">
                {/* Header - Compact on mobile */}
                <div className="p-6 sm:p-10 pb-4 sm:pb-6 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-xl sm:rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 sm:mb-6 ring-2 sm:ring-4 ring-white/50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 sm:w-8 sm:h-8 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 to-purple-800 tracking-tight">ImageTool</h2>
                    <p className="text-slate-500 font-medium text-xs mt-1">Professional AI Studio</p>
                    <p className="text-indigo-600 font-mono text-xs mt-2 min-h-[1.5em] font-semibold hidden sm:block">{welcomeText}</p>
                    <p className="text-slate-400 text-xs font-medium mt-1">Phiên bản V{appVersion}</p>
                </div>

                <div className="px-6 sm:px-10 pb-6 sm:pb-10">
                    {/* VERIFICATION PENDING VIEW - Prominent display */}
                    {view === 'verification_pending' ? (
                        <div className="text-center animate-fade-in">
                            {/* Large Email Icon */}
                            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-green-500/30 mb-6 animate-bounce">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                            </div>

                            <h3 className="text-2xl font-extrabold text-slate-800 mb-3">📧 Kiểm tra Email của bạn!</h3>

                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                <p className="text-green-800 font-bold text-sm mb-2">Email đã được gửi đến:</p>
                                <p className="text-green-600 font-mono text-lg bg-white px-3 py-2 rounded-lg border border-green-100 break-all">{verificationEmail}</p>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                <h4 className="font-bold text-amber-800 text-sm mb-2">📋 Hướng dẫn:</h4>
                                <ol className="text-amber-700 text-xs text-left space-y-1.5">
                                    <li>1. Mở ứng dụng <strong>Gmail</strong> hoặc hộp thư email của bạn</li>
                                    <li>2. Tìm email từ <strong>"ImageTool"</strong> hoặc <strong>"noreply"</strong></li>
                                    <li>3. Kiểm tra cả <strong>mục Spam/Thư rác</strong> nếu không thấy</li>
                                    <li>4. Nhấn vào <strong>link xác minh</strong> trong email</li>
                                    <li>5. Quay lại đây và <strong>đăng nhập</strong></li>
                                </ol>
                            </div>

                            {/* Countdown */}
                            <div className="bg-slate-100 rounded-xl p-3 border border-slate-200">
                                <p className="text-slate-600 text-sm">
                                    Tự động quay lại đăng nhập sau <span className="font-bold text-indigo-600 text-lg">{countdown}</span> giây...
                                </p>
                            </div>

                            <button
                                onClick={() => { setView('login'); setCountdown(15); }}
                                className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
                            >
                                ← Quay lại đăng nhập ngay
                            </button>
                        </div>
                    ) : (
                        <>
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

                                {/* Terms Checkbox (Signup Only) */}
                                {view === 'signup' && (
                                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <input
                                            type="checkbox"
                                            id="terms-checkbox"
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="mt-0.5 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor="terms-checkbox" className="text-sm text-slate-600 cursor-pointer">
                                            Tôi đã đọc và đồng ý với{' '}
                                            <button
                                                type="button"
                                                onClick={() => setShowTermsModal(true)}
                                                className="text-indigo-600 font-semibold hover:underline"
                                            >
                                                Điều khoản sử dụng
                                            </button>
                                        </label>
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
                        </>
                    )}
                </div>
            </div>

            {/* Terms Modal */}
            <TermsModal
                isOpen={showTermsModal}
                onClose={() => setShowTermsModal(false)}
                onAccept={() => setTermsAccepted(true)}
            />
        </div>
    );
};