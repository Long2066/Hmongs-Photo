import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import * as firebaseService from '../services/firebaseService';
import {
    SubscriptionPlan,
    getCachedUserPlan,
    getCachedRemainingVideoSeconds,
    getCachedDailyFreeUsed,
    getCachedBonusImages,
    getCachedBonusExpiresAt
} from '../services/firebaseService';
import {
    subscribeToSubscriptionPlansConfig,
    DEFAULT_SUBSCRIPTION_PLANS_CONFIG,
    formatVndCompact,
    computeDiscountStats,
    type PlanFeatureItem,
    type SubscriptionPlansConfig
} from '../services/subscriptionPlanConfigService';
import { PayOSCheckoutModal } from './PayOSCheckoutModal';
import { refreshSubscription } from '../services/subscriptionService';

interface PackagesPageProps { user: User; onBack: () => void; onBalanceUpdated: () => void }

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderHighlightedFeatureText = (
    text: string,
    highlight: string | undefined,
    strongClassName: string
): React.ReactNode => {
    const tokens = (highlight || '')
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (tokens.length === 0) return text;
    const regex = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'g');
    const parts = text.split(regex);
    const tokenSet = new Set(tokens);
    return parts.map((part, idx) =>
        tokenSet.has(part) ? (
            <strong key={idx} className={strongClassName}>
                {part}
            </strong>
        ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
        )
    );
};

export const PackagesPage: React.FC<PackagesPageProps> = ({ user, onBack, onBalanceUpdated }) => {
    const [plansConfig, setPlansConfig] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS_CONFIG);
    const [balance, setBalance] = useState(0);
    const [remainingImages, setRemainingImages] = useState(0);
    const [remainingVideoSeconds, setRemainingVideoSeconds] = useState(() => getCachedRemainingVideoSeconds(user.id));
    const [bonusImages, setBonusImages] = useState(() => getCachedBonusImages(user.id));
    const [bonusExpiresAt, setBonusExpiresAt] = useState<number>(() => getCachedBonusExpiresAt(user.id) || 0);
    const [activePlan, setActivePlan] = useState<SubscriptionPlan>(() => getCachedUserPlan(user.id));
    const [dailyFreeUsed, setDailyFreeUsed] = useState(() => getCachedDailyFreeUsed(user.id));
    const [planExpiresAt, setPlanExpiresAt] = useState(0);
    const [checkoutPlan, setCheckoutPlan] = useState<'plus' | 'pro' | 'vip' | null>(null);

    const loadSubscription = () => {
        void refreshSubscription().catch(() => {});
    };

    useEffect(() => {
        return subscribeToSubscriptionPlansConfig(setPlansConfig);
    }, []);

    useEffect(() => { loadSubscription(); }, [user.id]);

    useEffect(() => firebaseService.subscribeToUserCredits(user.id, (newBalance, state) => {
        setBalance(newBalance);
        const legacyBonus = Math.max(0, Math.floor(newBalance / firebaseService.IMAGE_COST_VND));
        if (state) {
            setActivePlan(state.plan);
            setRemainingImages(state.remainingImages ?? 0);
            setRemainingVideoSeconds(state.remainingVideoSeconds ?? 0);
            setDailyFreeUsed(state.dailyFreeUsed ?? 0);
            setPlanExpiresAt(state.planExpiresAt ?? 0);
            setBonusImages((state.bonusImages ?? 0) + legacyBonus);
            setBonusExpiresAt(state.bonusExpiresAt ?? 0);
        } else {
            setBonusImages(legacyBonus);
        }
    }), [user.id]);

    const freePlan = plansConfig.free;
    const plusPlan = plansConfig.plus;
    const proPlan = plansConfig.pro;
    const vipPlan = plansConfig.vip || DEFAULT_SUBSCRIPTION_PLANS_CONFIG.vip;
    const activePlanCfg = plansConfig[activePlan] || freePlan;
    const freeDailyLimit = freePlan.dailyFreeLimit;
    const freeRemaining = Math.max(0, freeDailyLimit - dailyFreeUsed);

    const plusDiscount = computeDiscountStats(plusPlan.price, plusPlan.originalPrice);
    const proDiscount = computeDiscountStats(proPlan.price, proPlan.originalPrice);
    const vipDiscount = computeDiscountStats(vipPlan.price, vipPlan.originalPrice);

    const gridClassName = 'grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-4 max-w-6xl mx-auto';

    return (
        <div className="mx-auto w-full max-w-7xl p-4 pb-20 sm:p-6 lg:p-8 animate-fade-in">
            <button type="button" onClick={onBack} className="mb-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/5 transition-all hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98]">← Quay lại</button>
            <div className="mb-8">
                <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">Gói thời hạn & Quyền lợi sử dụng Tool</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Mua thời hạn sử dụng tool trọn gói. Tự động cấp mới hạn mức ảnh và video AI mỗi ngày lúc 00:00.</p>
            </div>

            {/* Smart Status Dashboard */}
            <section aria-label="Thông tin gói và lượt sử dụng" className="mb-10">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                        {/* Cột 1: Gói hiện tại */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gói dịch vụ hiện tại</p>
                            <div className="mt-2 flex items-center gap-2.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${activePlan === 'vip' ? 'bg-purple-500 animate-pulse' : activePlan === 'pro' ? 'bg-amber-500' : activePlan === 'plus' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                <span className="text-xl font-bold text-slate-900">{activePlanCfg.name}</span>
                                {activePlan !== 'free' && (
                                    <span className={`px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full ${activePlan === 'vip' ? 'bg-purple-100 text-purple-700' : activePlan === 'pro' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                        Đang hoạt động
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {activePlanCfg.subtitle || 'Tài khoản tiêu chuẩn'}
                            </p>
                        </div>

                        {/* Cột 2: Thời hạn sử dụng */}
                        <div className="pt-4 md:pt-0 md:pl-6">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thời hạn sử dụng</p>
                            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-slate-900">
                                {activePlan === 'vip'
                                    ? 'Vĩnh viễn (Trọn đời)'
                                    : planExpiresAt > 0
                                        ? new Date(planExpiresAt).toLocaleDateString('vi-VN')
                                        : 'Bản trải nghiệm miễn phí'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {activePlan === 'vip'
                                    ? 'Toàn quyền sử dụng vĩnh viễn'
                                    : planExpiresAt > 0
                                        ? `Còn ${Math.max(0, Math.ceil((planExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)))} ngày sử dụng`
                                        : 'Nâng cấp gói để mở khóa thời hạn và tính năng cao cấp'}
                            </p>
                        </div>

                        {/* Cột 3: Hạn mức hôm nay */}
                        <div className="pt-4 md:pt-0 md:pl-6">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hạn mức hôm nay (Tự reset 00:00)</p>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="font-mono text-xl font-bold tabular-nums text-indigo-700">
                                    {activePlan === 'vip'
                                        ? `${dailyFreeUsed} ảnh đã tạo (Không giới hạn)`
                                        : `${dailyFreeUsed} / ${activePlanCfg.dailyImageLimit || (activePlan === 'pro' ? 300 : activePlan === 'plus' ? 100 : freeDailyLimit)} ảnh`}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                Xử lý song song: <strong className="font-semibold text-slate-800">{activePlanCfg.maxConcurrency || (activePlan === 'vip' ? 10 : activePlan === 'pro' ? 4 : activePlan === 'plus' ? 2 : 1)} luồng</strong> • Phân giải: <strong className="font-semibold text-slate-800">{activePlanCfg.maxResolution}</strong>
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section aria-label="Gói dịch vụ">
                <div className="mb-6 text-center max-w-2xl mx-auto">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                        Bảng giá & Gói cước
                    </p>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                        Chọn gói cước theo thời hạn sử dụng
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-slate-500">
                        Chỉ thanh toán một lần theo chu kỳ, không phát sinh chi phí theo lượt ảnh hay số giây video.
                    </p>
                </div>

                {/* 3 Subscription Packages Grid */}
                <div className={gridClassName}>
                    {/* 2. GÓI PLUS */}
                    {plusPlan.enabled && (
                    <div className={`bg-white rounded-2xl p-6 flex flex-col justify-between transition-all relative ${
                        activePlan === 'plus'
                            ? 'ring-2 ring-emerald-600 shadow-md'
                            : 'ring-1 ring-slate-900/10 shadow-sm hover:shadow-md'
                    }`}>
                        {plusPlan.topRibbon.trim() && (
                            <div className="absolute top-0 right-0 left-0 flex justify-center -translate-y-1/2 pointer-events-none z-20">
                                <span className="bg-emerald-600 text-white font-bold px-3.5 py-0.5 rounded-full text-[10px] shadow-md tracking-wider uppercase whitespace-nowrap">
                                    {plusPlan.topRibbon}
                                </span>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 leading-tight flex items-center gap-2">
                                        <span>{plusPlan.name}</span>
                                        {activePlan === 'plus' && (
                                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800">
                                                Đang dùng
                                            </span>
                                        )}
                                    </h3>
                                    {plusPlan.subtitle && (
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {plusPlan.subtitle}
                                        </p>
                                    )}
                                </div>
                                {plusPlan.badge && (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 flex-shrink-0">
                                        {plusPlan.badge}
                                    </span>
                                )}
                            </div>

                            {plusPlan.highlightBanner.trim() && (
                                <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800">
                                    {plusPlan.highlightBanner}
                                </div>
                            )}

                            <div className="mb-6 pb-5 border-b border-slate-100">
                                {plusDiscount.hasDiscount && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                                            {formatVndCompact(plusPlan.originalPrice)}
                                        </span>
                                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                            Tiết kiệm {formatVndCompact(plusDiscount.savingsAmount)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                                        {formatVndCompact(plusPlan.price)}
                                    </span>
                                    {plusPlan.periodLabel && (
                                        <span className="text-xs text-slate-500 font-medium">{plusPlan.periodLabel}</span>
                                    )}
                                </div>
                                {plusPlan.quotaSummary && (
                                    <p className="text-xs text-emerald-700 mt-1.5 font-semibold font-mono tabular-nums">
                                        {plusPlan.quotaSummary}
                                    </p>
                                )}
                            </div>

                            <ul className="space-y-3 text-sm text-slate-600 mb-6">
                                {plusPlan.featureItems.map((item: PlanFeatureItem) => (
                                    <li key={item.id} className="flex items-start gap-2.5">
                                        {item.icon === 'lock' ? (
                                            <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        <span className={item.icon === 'lock' ? 'text-slate-500' : ''}>
                                            {renderHighlightedFeatureText(item.text, item.highlight, 'text-slate-900 font-semibold')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('plus')}
                                className="w-full py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition-all min-h-[44px] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{activePlan === 'plus' ? (plusPlan.ctaTopUpText || plusPlan.ctaText || `Mua thêm ${plusPlan.name} — ${formatVndCompact(plusPlan.price)}`) : (plusPlan.ctaText || `Mua ${plusPlan.name} — ${formatVndCompact(plusPlan.price)}`)}</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    )}

                    {/* 3. GÓI PRO (Ultra-Highlighted Premium Tier) */}
                    {proPlan.enabled && (
                    <div className="relative bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between ring-2 ring-amber-400 shadow-2xl shadow-indigo-600/30 transform lg:-translate-y-2 lg:scale-[1.02] transition-all group">
                        {/* Decorative Ambient Glow in the background (clipped safely inside rounded-3xl) */}
                        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                            <div className="absolute -top-24 -right-24 w-56 h-56 bg-amber-400/15 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl" />
                        </div>

                        {/* Top Floating Badge */}
                        {proPlan.topRibbon.trim() && (
                            <div className="absolute top-0 right-0 left-0 flex justify-center -translate-y-1/2 pointer-events-none z-20">
                                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold px-4 py-1 rounded-full text-[11px] shadow-lg shadow-amber-500/30 tracking-wider uppercase flex items-center gap-1.5 border border-amber-200 whitespace-nowrap">
                                    <span>{proPlan.topRibbon}</span>
                                </span>
                            </div>
                        )}

                        <div className="relative z-10 pt-1">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                    <h3 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
                                        <span>{proPlan.name}</span>
                                        {activePlan === 'pro' && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                Đang dùng
                                            </span>
                                        )}
                                    </h3>
                                    {proPlan.subtitle && (
                                        <p className="text-xs text-amber-200/90 mt-1 font-medium">
                                            {proPlan.subtitle}
                                        </p>
                                    )}
                                </div>
                                {proPlan.badge && (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-sm flex-shrink-0">
                                        {proPlan.badge}
                                    </span>
                                )}
                            </div>

                            {/* Highlight Callout Banner */}
                            {proPlan.highlightBanner.trim() && (
                                <div className="my-3.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400/20 via-indigo-500/25 to-purple-500/20 border border-amber-400/40 flex items-center gap-2.5">
                                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                                        {proPlan.highlightBanner}
                                    </div>
                                </div>
                            )}

                            <div className="mb-5 pb-5 border-b border-indigo-800/60">
                                {proDiscount.hasDiscount && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                                            {formatVndCompact(proPlan.originalPrice)}
                                        </span>
                                        <span className="text-[11px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 rounded-md">
                                            Giảm {proDiscount.discountPercent}% (-{formatVndCompact(proDiscount.savingsAmount)})
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono tabular-nums drop-shadow-sm">
                                        {formatVndCompact(proPlan.price)}
                                    </span>
                                    {proPlan.periodLabel && (
                                        <span className="text-xs text-slate-300 font-medium">{proPlan.periodLabel}</span>
                                    )}
                                </div>
                                {proPlan.quotaSummary && (
                                    <p className="text-xs text-amber-300/90 mt-1.5 font-bold font-mono tabular-nums flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                        <span>{proPlan.quotaSummary}</span>
                                    </p>
                                )}
                            </div>

                            <ul className="space-y-3 text-sm text-slate-200 mb-6">
                                {proPlan.featureItems.map((item: PlanFeatureItem) => (
                                    <li key={item.id} className="flex items-start gap-2.5">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                            item.icon === 'lock'
                                                ? 'bg-slate-700/60 border border-slate-500/40'
                                                : 'bg-amber-400/20 border border-amber-400/40'
                                        }`}>
                                            {item.icon === 'lock' ? (
                                                <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-slate-100">
                                            {renderHighlightedFeatureText(item.text, item.highlight, 'text-amber-300 font-bold')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-2 relative z-10">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('pro')}
                                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 active:scale-[0.98] text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all min-h-[48px] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{activePlan === 'pro' ? (proPlan.ctaTopUpText || proPlan.ctaText || `Mua thêm ${proPlan.name} — ${formatVndCompact(proPlan.price)}`) : (proPlan.ctaText || `Mua ${proPlan.name} — ${formatVndCompact(proPlan.price)}`)}</span>
                                <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    )}

                    {/* 4. GÓI VIP (Ultimate Lifetime Access Tier) */}
                    {vipPlan.enabled && (
                    <div className="relative bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between ring-2 ring-purple-400 shadow-2xl shadow-purple-600/30 transform xl:-translate-y-2 xl:scale-[1.02] transition-all group">
                        {/* Decorative Ambient Glow */}
                        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                            <div className="absolute -top-24 -right-24 w-56 h-56 bg-purple-400/20 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-pink-500/20 rounded-full blur-3xl" />
                        </div>

                        {/* Top Floating Badge */}
                        {vipPlan.topRibbon.trim() && (
                            <div className="absolute top-0 right-0 left-0 flex justify-center -translate-y-1/2 pointer-events-none z-20">
                                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-500 text-slate-950 font-bold px-4 py-1 rounded-full text-[11px] shadow-lg shadow-purple-500/30 tracking-wider uppercase flex items-center gap-1.5 border border-purple-200 whitespace-nowrap">
                                    <span>{vipPlan.topRibbon}</span>
                                </span>
                            </div>
                        )}

                        <div className="relative z-10 pt-1">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                    <h3 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
                                        <span>{vipPlan.name}</span>
                                        {activePlan === 'vip' && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                Đang dùng
                                            </span>
                                        )}
                                    </h3>
                                    {vipPlan.subtitle && (
                                        <p className="text-xs text-purple-200/90 mt-1 font-medium">
                                            {vipPlan.subtitle}
                                        </p>
                                    )}
                                </div>
                                {vipPlan.badge && (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-400 to-pink-400 text-slate-950 shadow-sm flex-shrink-0">
                                        {vipPlan.badge}
                                    </span>
                                )}
                            </div>

                            {/* Highlight Callout Banner */}
                            {vipPlan.highlightBanner.trim() && (
                                <div className="my-3.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-400/20 via-pink-500/25 to-indigo-500/20 border border-purple-400/40 flex items-center gap-2.5">
                                    <div className="text-xs font-bold text-purple-200 uppercase tracking-wide">
                                        {vipPlan.highlightBanner}
                                    </div>
                                </div>
                            )}

                            <div className="mb-5 pb-5 border-b border-purple-800/60">
                                {vipDiscount.hasDiscount && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                                            {formatVndCompact(vipPlan.originalPrice)}
                                        </span>
                                        <span className="text-[11px] font-bold text-purple-300 bg-purple-400/20 border border-purple-400/30 px-2 py-0.5 rounded-md">
                                            Giảm {vipDiscount.discountPercent}% (-{formatVndCompact(vipDiscount.savingsAmount)})
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-amber-200 font-mono tabular-nums drop-shadow-sm">
                                        {formatVndCompact(vipPlan.price)}
                                    </span>
                                    {vipPlan.periodLabel && (
                                        <span className="text-xs text-slate-300 font-medium">{vipPlan.periodLabel}</span>
                                    )}
                                </div>
                                {vipPlan.quotaSummary && (
                                    <p className="text-xs text-purple-300/90 mt-1.5 font-bold font-mono tabular-nums flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                        <span>{vipPlan.quotaSummary}</span>
                                    </p>
                                )}
                            </div>

                            <ul className="space-y-3 text-sm text-slate-200 mb-6">
                                {vipPlan.featureItems.map((item: PlanFeatureItem) => (
                                    <li key={item.id} className="flex items-start gap-2.5">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                            item.icon === 'lock'
                                                ? 'bg-slate-700/60 border border-slate-500/40'
                                                : 'bg-purple-400/25 border border-purple-400/50'
                                        }`}>
                                            {item.icon === 'lock' ? (
                                                <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-slate-100">
                                            {renderHighlightedFeatureText(item.text, item.highlight, 'text-pink-300 font-bold')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-2 relative z-10">
                            <button
                                type="button"
                                onClick={() => setCheckoutPlan('vip')}
                                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 active:scale-[0.98] text-white font-bold text-sm shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all min-h-[48px] flex items-center justify-center gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{activePlan === 'vip' ? (vipPlan.ctaTopUpText || vipPlan.ctaText || `Đã kích hoạt ${vipPlan.name}`) : (vipPlan.ctaText || `Mua ${vipPlan.name} — ${formatVndCompact(vipPlan.price)}`)}</span>
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    )}
                </div>
            </section>
            {checkoutPlan && <PayOSCheckoutModal planId={checkoutPlan} userId={user.id} userName={user.name} userEmail={user.username} currentBalance={balance} onClose={() => setCheckoutPlan(null)} onSuccess={(newBal, activatedPlan) => { setBalance(newBal); setActivePlan(activatedPlan); loadSubscription(); }} />}
        </div>
    );
};
