
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { loginWithGoogle } from '../../services/firebaseService';
import { Link, useNavigate } from 'react-router-dom';
import { Marquee } from '../../components/Marquee';

export const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const navigate = useNavigate();

    const handleGoogleRegister = async () => {
        setError('');
        setIsGoogleLoading(true);
        try {
            await loginWithGoogle();
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Google Sign In Error:', err);
            if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                return;
            }
            if (err.code === 'auth/popup-blocked') {
                setError('Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng cho phép pop-up để tiếp tục.');
                return;
            }
            setError(`Đăng ký bằng Google thất bại: ${err.message || 'Vui lòng thử lại.'}`);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            await sendEmailVerification(userCredential.user);

            setSuccess('Đăng ký thành công! Một email xác minh đã được gửi đến hộp thư của bạn. Vui lòng kiểm tra và xác nhận trước khi đăng nhập.');
            setEmail('');
            setPassword('');
            setName('');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Email này đã được sử dụng.');
            } else {
                setError('Đã xảy ra lỗi đăng ký. Vui lòng thử lại.');
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Marquee />
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-200">
                    <div className="text-center mb-8">
                        <img 
                            src="/icon.png" 
                            alt="ImageTool Logo" 
                            className="w-16 h-16 rounded-2xl mx-auto shadow-md mb-3 object-contain hover:scale-105 transition-transform ring-2 ring-slate-100" 
                        />
                        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">Tạo Tài Khoản</h1>
                        <p className="text-slate-500 font-medium">Tham gia ImageTool</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 font-medium">
                            {error}
                        </div>
                    )}

                    {/* Quick Google Sign In */}
                    {!success && (
                        <div className="mb-4">
                            <button
                                type="button"
                                onClick={handleGoogleRegister}
                                disabled={isGoogleLoading}
                                className="w-full flex items-center justify-center gap-3 py-3 px-4 min-h-[46px] bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200/90 rounded-xl font-semibold text-sm text-slate-700 shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                {isGoogleLoading ? (
                                    <div className="flex items-center gap-2 text-indigo-600 font-medium">
                                        <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        <span>Đang kết nối Google...</span>
                                    </div>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                        </svg>
                                        <span>Đăng ký nhanh bằng Google</span>
                                    </>
                                )}
                            </button>

                            <div className="relative my-4 flex items-center justify-center">
                                <div className="border-t border-slate-200/80 w-full"></div>
                                <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider relative">
                                    Hoặc với Email
                                </span>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm mb-4 border border-green-100 font-medium text-center">
                            {success}
                            <div className="mt-2">
                                <Link to="/login" className="text-green-700 font-bold hover:underline">Quay lại đăng nhập</Link>
                            </div>
                        </div>
                    )}

                    {!success && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Họ và tên</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Nguyễn Văn A"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Tối thiểu 6 ký tự"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all"
                            >
                                Đăng Ký
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center text-sm">
                        <span className="text-slate-500">Đã có tài khoản? </span>
                        <Link to="/login" className="text-indigo-600 font-bold hover:underline">
                            Đăng nhập
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
