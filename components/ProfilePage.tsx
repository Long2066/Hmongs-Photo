import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import * as firebaseService from '../services/firebaseService';
import {
    SUBSCRIPTION_PLANS,
    SubscriptionPlan,
    IMAGE_COST_VND,
    FREE_DAILY_IMAGE_LIMIT,
    getCachedUserPlan,
    getDailyFreeRemaining
} from '../services/firebaseService';
import { updateProfile } from 'firebase/auth';
import { auth } from '../src/firebaseConfig';
import { PayOSCheckoutModal } from './PayOSCheckoutModal';
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

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack }) => {
    const [avatar, setAvatar] = useState(user.avatar);
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [balance, setBalance] = useState(0);
    const [activePlan, setActivePlan] = useState<SubscriptionPlan>(() => getCachedUserPlan(user.id));
    const [freeRemaining, setFreeRemaining] = useState<number>(() => getDailyFreeRemaining(user.id));
    const [checkoutPlan, setCheckoutPlan] = useState<'plus' | 'pro' | null>(null);
    const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
    const [isLoadingLog, setIsLoadingLog] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsubscribe = firebaseService.subscribeToUserCredits(user.id, (newBalance, subState) => {
            setBalance(newBalance);
            if (subState) {
                setActivePlan(subState.plan);
                setFreeRemaining(Math.max(0, FREE_DAILY_IMAGE_LIMIT - subState.dailyFreeUsed));
            } else {
                setActivePlan(firebaseService.resolveEffectivePlan(undefined, newBalance));
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

    // Calculate estimated images based on 500đ / image for Plus & Pro
    const imagesAvailable = Math.floor(balance / IMAGE_COST_VND);

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
                                        ? `Còn ${freeRemaining}/${FREE_DAILY_IMAGE_LIMIT} ảnh hôm nay`
                                        : `${formatVND(balance)} (≈ ${imagesAvailable} ảnh)`}
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

            {/* 3 Subscription Packages Section (Replaces old Recharge Banner) */}
            <div className="px-4 sm:px-8 mb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                            Nâng cấp tài khoản & Quyền lợi
                        </p>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                            Chọn gói dịch vụ phù hợp với nhu cầu sáng tạo
                        </h2>
                    </div>

                    {/* Current Balance & Cost Summary Pill */}
                    <div className="bg-white rounded-2xl px-4 py-3 ring-1 ring-slate-900/5 shadow-xs flex items-center gap-4 self-start md:self-auto">
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Số dư hiện tại
                            </p>
                            <p className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                                {formatVND(balance)}
                            </p>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                {activePlan === 'free' ? 'Hạn mức Free hôm nay' : 'Quy đổi (500đ / ảnh)'}
                            </p>
                            <p className="text-sm font-semibold text-indigo-600 font-mono tabular-nums">
                                {activePlan === 'free'
                                    ? `${freeRemaining} / ${FREE_DAILY_IMAGE_LIMIT} ảnh`
                                    : `≈ ${imagesAvailable} ảnh khả dụng`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Pricing Grid: Free / Plus / Pro */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                    {/* 1. GÓI FREE */}
                    <div className={`bg-white rounded-2xl p-6 flex flex-col justify-between transition-all ${
                        activePlan === 'free'
                            ? 'ring-2 ring-slate-900/15 shadow-sm'
                            : 'ring-1 ring-slate-900/5 shadow-xs'
                    }`}>
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 leading-tight">
                                        Gói Free
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Dành cho người mới trải nghiệm
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                                    Mặc định
                                </span>
                            </div>

                            <div className="mb-6 pb-5 border-b border-slate-100">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                                        0đ
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">/ ngày</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5 font-medium">
                                    Tặng <strong className="text-slate-800 font-mono tabular-nums">20 ảnh / ngày</strong> với model GPT 1.5
                                </p>
                            </div>

                            <ul className="space-y-3 text-sm text-slate-600 mb-6">
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Tạo tối đa <strong className="text-slate-900 font-semibold font-mono tabular-nums">20 ảnh / ngày</strong> miễn phí</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Sử dụng duy nhất model <strong className="text-slate-900 font-semibold">GPT 1.5</strong></span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span className="text-slate-500">Giới hạn các model AI cao cấp & độ phân giải 2K/4K</span>
                                </li>
                            </ul>
                        </div>

                        <div className="pt-2">
                            <div className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm text-center min-h-[44px] flex items-center justify-center gap-2">
                                {activePlan === 'free' ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>Đang kích hoạt ({freeRemaining}/{FREE_DAILY_IMAGE_LIMIT} ảnh còn lại hôm nay)</span>
                                    </>
                                ) : (
                                    <span>Gói cơ bản miễn phí</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. GÓI PLUS */}
                    <div className={`bg-white rounded-2xl p-6 flex flex-col justify-between transition-all relative ${
                        activePlan === 'plus'
                            ? 'ring-2 ring-emerald-600 shadow-md'
                            : 'ring-1 ring-slate-900/10 shadow-sm hover:shadow-md'
                    }`}>
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 leading-tight flex items-center gap-2">
                                        <span>Gói Plus</span>
                                        {activePlan === 'plus' && (
                                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800">
                                                Đang dùng
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Sử dụng full tính năng • Tối đa FHD
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                                    Giảm 58%
                                </span>
                            </div>

                            <div className="mb-6 pb-5 border-b border-slate-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                                        120.000đ
                                    </span>
                                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                        Tiết kiệm 70.000đ
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                                        50.000đ
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">/ gói (100 ảnh)</span>
                                </div>
                                <p className="text-xs text-emerald-700 mt-1.5 font-semibold font-mono tabular-nums">
                                    Chi phí: 500đ / ảnh • Cộng ngay 50.000đ vào User
                                </p>
                            </div>

                            <ul className="space-y-3 text-sm text-slate-600 mb-6">
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Sử dụng <strong className="text-slate-900 font-semibold">full tất cả các tính năng</strong> trên công cụ</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Mở khóa toàn bộ Model AI (Gemini 3.1, GPT Image 2.5...)</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Tạo ảnh độ phân giải tối đa cho chọn mức <strong className="text-slate-900 font-semibold">FHD</strong></span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Tự động cộng <strong className="text-slate-900 font-semibold font-mono tabular-nums">50.000đ</strong> (<strong className="font-mono tabular-nums">500đ/ảnh</strong>)</span>
                                </li>
                            </ul>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('plus')}
                                className="w-full py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>{activePlan === 'plus' ? 'Mua thêm Gói Plus — 50.000đ' : 'Mua Gói Plus — 50.000đ'}</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* 3. GÓI PRO (Highlighted Primary Tier) */}
                    <div className="bg-gradient-to-b from-indigo-50/70 via-white to-white rounded-2xl p-6 flex flex-col justify-between ring-2 ring-indigo-600 shadow-lg relative">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 leading-tight flex items-center gap-2">
                                        <span>Gói Pro</span>
                                        {activePlan === 'pro' && (
                                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-indigo-100 text-indigo-800">
                                                Đang dùng
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Full toàn bộ tính năng & Độ phân giải 4K
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                                    Cao cấp nhất
                                </span>
                            </div>

                            <div className="mb-6 pb-5 border-b border-slate-200/80">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                                        200.000đ
                                    </span>
                                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                        Giảm 50% (-100.000đ)
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-indigo-600 font-mono tabular-nums">
                                        100.000đ
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">/ gói (200 ảnh)</span>
                                </div>
                                <p className="text-xs text-indigo-700 mt-1.5 font-semibold font-mono tabular-nums">
                                    Chi phí: 500đ / ảnh • Cộng ngay 100.000đ vào User
                                </p>
                            </div>

                            <ul className="space-y-3 text-sm text-slate-700 mb-6">
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Sử dụng <strong className="text-slate-900 font-semibold">full các tính năng có trên Tool</strong> không giới hạn</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Mở khóa toàn bộ độ phân giải <strong className="text-indigo-700 font-semibold">HD, FHD, 2K, 4K Ultra Sharp</strong></span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Mở khóa toàn bộ Model AI cao cấp (Gemini 3.1, GPT 2.5 Flare/Sunburst...)</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Tự động cộng <strong className="text-slate-900 font-semibold font-mono tabular-nums">100.000đ</strong> (<strong className="font-mono tabular-nums">500đ/ảnh</strong>)</span>
                                </li>
                            </ul>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('pro')}
                                className="w-full py-3.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>{activePlan === 'pro' ? 'Mua thêm Gói Pro — 100.000đ' : 'Mua Gói Pro — 100.000đ'}</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
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

            {/* Direct PayOS Checkout Modal */}
            {checkoutPlan && (
                <PayOSCheckoutModal
                    planId={checkoutPlan}
                    userId={user.id}
                    userName={user.name}
                    userEmail={user.username}
                    currentBalance={balance}
                    onClose={() => setCheckoutPlan(null)}
                    onSuccess={(newBal, activatedPlan) => {
                        setBalance(newBal);
                        setActivePlan(activatedPlan);
                    }}
                />
            )}
        </div>
    );
};
