import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import * as firebaseService from '../services/firebaseService';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, FREE_DAILY_IMAGE_LIMIT, getCachedUserPlan, getDailyFreeRemaining } from '../services/firebaseService';
import { PayOSCheckoutModal } from './PayOSCheckoutModal';
import { GoogleQuotaStationModal } from './GoogleQuotaStationModal';
import { refreshSubscription } from '../services/subscriptionService';

interface PackagesPageProps { user: User; onBack: () => void; onBalanceUpdated: () => void }

export const PackagesPage: React.FC<PackagesPageProps> = ({ user, onBack, onBalanceUpdated }) => {
    const [balance, setBalance] = useState(0);
    const [remainingImages, setRemainingImages] = useState(0);
    const [bonusImages, setBonusImages] = useState(0);
    const [activePlan, setActivePlan] = useState<SubscriptionPlan>(() => getCachedUserPlan(user.id));
    const [freeRemaining, setFreeRemaining] = useState(() => getDailyFreeRemaining(user.id));
    const [planExpiresAt, setPlanExpiresAt] = useState(0);
    const [checkoutPlan, setCheckoutPlan] = useState<'plus' | 'pro' | null>(null);
    const loadSubscription = () => {
        void refreshSubscription().catch(() => {});
    };

    useEffect(() => { loadSubscription(); }, [user.id]);

    useEffect(() => firebaseService.subscribeToUserCredits(user.id, (newBalance, state) => {
        setBalance(newBalance);
        setBonusImages(Math.max(0, Math.floor(newBalance / firebaseService.IMAGE_COST_VND)));
        if (state) {
            setActivePlan(state.plan);
            setRemainingImages(state.remainingImages ?? 0);
            setFreeRemaining(Math.max(0, FREE_DAILY_IMAGE_LIMIT - state.dailyFreeUsed));
            setPlanExpiresAt(state.planExpiresAt ?? 0);
        }
    }), [user.id]);

    return (
        <div className="mx-auto w-full max-w-7xl p-4 pb-20 sm:p-6 lg:p-8 animate-fade-in">
            <button type="button" onClick={onBack} className="mb-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/5 transition-all hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98]">← Quay lại</button>
            <div className="mb-8">
                <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">Cấu hình & gói dịch vụ</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Theo dõi lượt miễn phí và cấu hình bên dưới, sau đó kéo xuống để chọn gói phù hợp.</p>
            </div>
            <section aria-label="Lượt miễn phí và cấu hình" className="mb-10">
                <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Lượt miễn phí sau đăng nhập</p>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">{freeRemaining} / {FREE_DAILY_IMAGE_LIMIT} ảnh hôm nay</p>
                    {bonusImages > 0 && <p className="mt-2 text-sm font-medium text-indigo-700">Ảnh thưởng còn: <span className="font-mono tabular-nums">{bonusImages}</span></p>}
                </div>
                <GoogleQuotaStationModal embedded isOpen onClose={onBack} user={user} onBalanceUpdated={onBalanceUpdated} />
            </section>
            <section aria-label="Gói dịch vụ">
            {/* 3 Subscription Packages Section (Replaces old Recharge Banner) */}
            <div className="mb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                            Nâng cấp tài khoản & Quyền lợi
                        </p>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                            Chọn gói dịch vụ phù hợp với nhu cầu sáng tạo
                        </h2>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5 flex flex-wrap items-center gap-4 self-start">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Gói đang dùng</p>
                            <p className="font-semibold text-slate-900">{SUBSCRIPTION_PLANS[activePlan].name}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Ảnh còn lại</p>
                            <p className="text-right font-mono tabular-nums font-semibold text-indigo-700">{activePlan === 'free' ? `${freeRemaining}/${FREE_DAILY_IMAGE_LIMIT} hôm nay` : `${remainingImages} ảnh`}</p>
                        </div>
                        {activePlan !== 'free' && planExpiresAt > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Hạn dùng</p>
                                <p className="font-mono tabular-nums font-semibold text-slate-900">{new Date(planExpiresAt).toLocaleDateString('vi-VN')}</p>
                            </div>
                        )}
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
                                    Tặng <strong className="text-slate-800 font-mono tabular-nums">10 ảnh / ngày</strong> với model GPT 1.5
                                </p>
                            </div>

                            <ul className="space-y-3 text-sm text-slate-600 mb-6">
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Tạo tối đa <strong className="text-slate-900 font-semibold font-mono tabular-nums">10 ảnh / ngày</strong> miễn phí</span>
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
                                    <span className="text-xs text-slate-500 font-medium">/ gói · 100 ảnh</span>
                                </div>
                                <p className="text-xs text-emerald-700 mt-1.5 font-semibold font-mono tabular-nums">
                                    100 ảnh trong 30 ngày kể từ khi kích hoạt
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
                                    <span>Mở khóa các Model AI: <strong className="text-slate-900 font-semibold">GPT Image 2.5, GPT Image 2.5 Flare, GPT Image 2.5 Sunburst, GPT Image 2</strong> (cùng các model miễn phí)</span>
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
                                    <span>Nhận <strong className="text-slate-900 font-semibold font-mono tabular-nums">100 ảnh</strong>, hạn dùng <strong>30 ngày</strong></span>
                                </li>
                            </ul>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('plus')}
                                className="w-full py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    <span className="text-xs text-slate-500 font-medium">/ gói · 200 ảnh</span>
                                </div>
                                <p className="text-xs text-indigo-700 mt-1.5 font-semibold font-mono tabular-nums">
                                    200 ảnh trong 30 ngày kể từ khi kích hoạt
                                </p>
                            </div>

                            <ul className="space-y-3 text-sm text-slate-700 mb-6">
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Sử dụng <strong className="text-slate-900 font-semibold">full các tính năng có trên Tool</strong> trong hạn mức ảnh của gói</span>
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
                                    <span>Mở khóa <strong className="text-indigo-700 font-semibold">Full toàn bộ Model AI</strong> (không giới hạn bất kỳ model nào)</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Nhận <strong className="text-slate-900 font-semibold font-mono tabular-nums">200 ảnh</strong>, hạn dùng <strong>30 ngày</strong></span>
                                </li>
                            </ul>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('pro')}
                                className="w-full py-3.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

            </section>
            {checkoutPlan && <PayOSCheckoutModal planId={checkoutPlan} userId={user.id} userName={user.name} userEmail={user.username} currentBalance={balance} onClose={() => setCheckoutPlan(null)} onSuccess={(newBal, activatedPlan) => { setBalance(newBal); setActivePlan(activatedPlan); loadSubscription(); }} />}
        </div>
    );
};
