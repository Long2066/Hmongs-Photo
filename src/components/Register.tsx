
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Link } from 'react-router-dom';
import { Marquee } from '../../components/Marquee';

export const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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
                        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">Tạo Tài Khoản</h1>
                        <p className="text-slate-500 font-medium">Tham gia ImageTool</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 font-medium">
                            {error}
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
