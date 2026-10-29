import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import * as firebaseService from '../services/firebaseService';
import { updateProfile } from 'firebase/auth';
import { auth } from '../src/firebaseConfig';
import { CreditsPurchaseModal } from './CreditsPurchaseModal';
import { formatVND } from '../services/geminiCoreService';

interface ProfilePageProps {
    user: User;
    onBack: () => void;
    onImageClick: (base64: string) => void;
}

interface ActivityLogItem {
    id: string;
    feature: string;
    imageCount: number;
    timestamp: number;
    prompt?: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack, onImageClick }) => {
    const [avatar, setAvatar] = useState(user.avatar);
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [balance, setBalance] = useState(0);
    const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
    const [isLoadingLog, setIsLoadingLog] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsubscribe = firebaseService.subscribeToUserCredits(user.id, (newBalance) => {
            setBalance(newBalance);
        });
        return () => unsubscribe();
    }, [user.id]);

    // Load activity log
    useEffect(() => {
        const loadActivityLog = async () => {
            try {
                const logs = await firebaseService.getActivityLog(user.id);
                setActivityLog(logs);
            } catch (e) {
                console.error('Error loading activity log:', e);
            }
            setIsLoadingLog(false);
        };
        loadActivityLog();
    }, [user.id]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (typeof ev.target?.result === 'string') {
                    setAvatar(ev.target.result);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSaveProfile = async () => {
        try {
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    photoURL: avatar
                });
            }

            if (newPassword.trim()) {
                await firebaseService.resetPassword(user.username);
                setMessage("Đã gửi email đổi mật khẩu.");
                return;
            }

            setMessage("Cập nhật hồ sơ thành công!");
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            setMessage("Lỗi cập nhật.");
        }
    };

    // Calculate estimated images based on cheapest model (120đ)
    const imagesAvailable = Math.floor(balance / 120);

    // Feature name display mapping
    const featureNames: Record<string, string> = {
        'Creative': '🎨 Sáng tạo ảnh',
        'Edit': '✏️ Chỉnh sửa ảnh',
        'Upscale': '🔍 Tăng nét ảnh',
        'Profile': '👤 Ảnh profile',
        'ID Photo': '🪪 Ảnh thẻ',
        'Restore': '🖼️ Phục hồi ảnh cũ',
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="max-w-7xl mx-auto min-h-screen pb-20">
            {/* Header Area */}
            <div className="relative h-48 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-b-3xl mb-16 shadow-lg">
                <button onClick={onBack} className="absolute top-6 left-6 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>
                <div className="absolute -bottom-12 left-6 md:left-12 flex items-end gap-6">
                    <div className="relative group">
                        <img src={avatar} alt="Profile" className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover bg-white" />
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="absolute bottom-1 right-1 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <input type="file" ref={fileRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                    </div>
                    <div className="mb-4">
                        <h1 className="text-2xl font-bold text-slate-800">{user.name}</h1>
                        <p className="text-slate-500 text-sm font-medium">{user.username}</p>
                    </div>
                </div>
            </div>

            {/* Balance Card */}
            <div className="px-6 md:px-12 mb-8">
                <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-5 border border-amber-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Số dư VIP</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-extrabold text-amber-800">{formatVND(balance)}</span>
                            </div>
                            <p className="text-xs text-amber-600 mt-1">≈ {imagesAvailable} ảnh (model rẻ nhất)</p>
                        </div>
                        <button
                            onClick={() => setPurchaseModalOpen(true)}
                            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all flex items-center gap-2"
                        >
                            <span className="text-lg">💳</span>
                            Nạp tiền
                        </button>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="px-6 md:px-12 grid md:grid-cols-2 gap-8">
                {/* Left: Settings */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span>⚙️</span> Cài đặt hồ sơ
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Đổi mật khẩu</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nhập mật khẩu mới (nếu muốn đổi)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <p className="text-xs text-slate-400 mt-2">Để trống nếu không muốn thay đổi.</p>
                        </div>

                        {message && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm font-medium">{message}</div>}

                        <button
                            onClick={handleSaveProfile}
                            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg"
                        >
                            Lưu thay đổi
                        </button>
                    </div>
                </div>

                {/* Right: Activity Log */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span>📋</span> Nhật ký hoạt động
                    </h2>

                    {isLoadingLog ? (
                        <div className="flex items-center justify-center py-8">
                            <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : activityLog.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <span className="text-4xl mb-2 block">📭</span>
                            <p>Chưa có hoạt động nào được ghi nhận.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {activityLog.slice(0, 20).map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">
                                            {featureNames[log.feature]?.split(' ')[0] || '📷'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">
                                                {featureNames[log.feature]?.slice(2) || log.feature}
                                            </p>
                                            <p className="text-xs text-slate-400">{formatTime(log.timestamp)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                                            {log.imageCount} ảnh
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Balance Purchase Modal */}
            {isPurchaseModalOpen && (
                <CreditsPurchaseModal
                    userId={user.id}
                    userName={user.name}
                    userEmail={user.username}
                    currentBalance={balance}
                    onClose={() => setPurchaseModalOpen(false)}
                    onSuccess={(newBalance) => {
                        setBalance(newBalance);
                        setPurchaseModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};