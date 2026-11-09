import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import * as firebaseService from '../services/firebaseService';
import {
    SUBSCRIPTION_PLANS,
    SubscriptionPlan,
    FREE_DAILY_IMAGE_LIMIT,
    getCachedUserPlan,
    getDailyFreeRemaining
} from '../services/firebaseService';
import { updateProfile } from 'firebase/auth';
import { auth } from '../src/firebaseConfig';

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

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack }) => {
    const [avatar, setAvatar] = useState(user.avatar);
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [remainingImages, setRemainingImages] = useState(0);
    const [remainingVideoSeconds, setRemainingVideoSeconds] = useState(() => firebaseService.getCachedRemainingVideoSeconds(user.id));
    const [bonusImages, setBonusImages] = useState(0);
    const [activePlan, setActivePlan] = useState<SubscriptionPlan>(() => getCachedUserPlan(user.id));
    const [freeRemaining, setFreeRemaining] = useState<number>(() => getDailyFreeRemaining(user.id));
    const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
    const [isLoadingLog, setIsLoadingLog] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsubscribe = firebaseService.subscribeToUserCredits(user.id, (newBalance, subState) => {
            setRemainingImages(subState?.remainingImages ?? 0);
            setRemainingVideoSeconds(subState?.remainingVideoSeconds ?? 0);
            setBonusImages(Math.max(0, Math.floor(newBalance / firebaseService.IMAGE_COST_VND)));
            if (subState) {
                setActivePlan(subState.plan);
                setFreeRemaining(Math.max(0, FREE_DAILY_IMAGE_LIMIT - subState.dailyFreeUsed));
            } else {
                setActivePlan('free');
                setFreeRemaining(getDailyFreeRemaining(user.id));
            }
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
            <div className="relative h-44 sm:h-48 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 rounded-3xl mb-16 shadow-md ring-1 ring-slate-900/5">
                <button
                    onClick={onBack}
                    className="absolute top-5 left-5 bg-white/20 hover:bg-white/30 active:scale-[0.98] text-white p-2.5 rounded-full backdrop-blur-sm transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Quay lại"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>

                {/* Active Plan Status Pill in Header */}
                <div className="absolute top-5 right-5 flex items-center gap-2.5">
                    <div className="bg-white/15 backdrop-blur-md ring-1 ring-white/25 rounded-2xl px-4 py-2 text-white flex items-center gap-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                                Gói đang dùng
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">
                                    {SUBSCRIPTION_PLANS[activePlan].name}
                                </span>
                                <span className="text-xs text-white/90 font-mono tabular-nums bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                                    {activePlan === 'free'
                                        ? `Còn ${freeRemaining}/${FREE_DAILY_IMAGE_LIMIT} ảnh • ${remainingVideoSeconds}s video`
                                        : `Còn ${remainingImages} ảnh • ${remainingVideoSeconds}s video`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute -bottom-12 left-6 md:left-10 flex items-end gap-5">
                    <div className="relative group">
                        <img
                            src={avatar}
                            alt="Profile"
                            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="absolute bottom-1 right-1 bg-indigo-600 text-white p-2.5 rounded-full shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
                            title="Đổi ảnh đại diện"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <input type="file" ref={fileRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                    </div>
                    <div className="mb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{user.name}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                activePlan === 'pro'
                                    ? 'bg-indigo-600 text-white'
                                    : activePlan === 'plus'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 text-slate-700'
                            }`}>
                                {SUBSCRIPTION_PLANS[activePlan].name}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">{user.username}</p>
                    </div>
                </div>
            </div>

            {/* Two Column Layout: Settings & Activity Log */}
            <div className="px-4 sm:px-8 grid md:grid-cols-2 gap-6">
                {/* Left: Settings */}
                <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-900/5 shadow-xs">
                    <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2 leading-tight">
                        <span>⚙️</span> Cài đặt hồ sơ
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Đổi mật khẩu</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nhập mật khẩu mới (nếu muốn đổi)"
                                className="w-full bg-slate-50 ring-1 ring-slate-900/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-2">Để trống nếu không muốn thay đổi.</p>
                        </div>

                        {message && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm font-medium">{message}</div>}

                        <button
                            onClick={handleSaveProfile}
                            className="px-6 py-3 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xs min-h-[44px] cursor-pointer"
                        >
                            Lưu thay đổi
                        </button>
                    </div>
                </div>

                {/* Right: Activity Log */}
                <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-900/5 shadow-xs">
                    <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2 leading-tight">
                        <span>📋</span> Nhật ký hoạt động
                    </h2>

                    {isLoadingLog ? (
                        <div className="space-y-3 py-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                            ))}
                        </div>
                    ) : activityLog.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 space-y-3">
                            <span className="text-4xl block">📭</span>
                            <p className="text-sm font-medium text-slate-600">Chưa có hoạt động tạo ảnh nào được ghi nhận.</p>
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all min-h-[44px] cursor-pointer"
                            >
                                Khám phá công cụ tạo ảnh ngay
                            </button>
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
                                            <p className="font-semibold text-slate-800 text-sm">
                                                {featureNames[log.feature]?.slice(2) || log.feature}
                                            </p>
                                            <p className="text-xs text-slate-500 font-mono tabular-nums">{formatTime(log.timestamp)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold font-mono tabular-nums">
                                            {log.imageCount} ảnh
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
