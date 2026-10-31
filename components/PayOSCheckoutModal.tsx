import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    SUBSCRIPTION_PLANS,
    SubscriptionPlan,
    activateSubscriptionPlan
} from '../services/firebaseService';
import { processAndAddCredits } from '../services/billVerificationService';
import { formatVND, getSelectedResolution, setSelectedResolution } from '../services/geminiCoreService';
import { addDeposit } from '../services/balanceService';

interface PayOSCheckoutModalProps {
    planId: 'plus' | 'pro';
    userId: string;
    userName: string;
    userEmail: string;
    currentBalance: number;
    onClose: () => void;
    onSuccess: (newBalance: number, activatedPlan: SubscriptionPlan) => void;
}

export const PayOSCheckoutModal: React.FC<PayOSCheckoutModalProps> = ({
    planId,
    userId,
    userName,
    userEmail,
    currentBalance,
    onClose,
    onSuccess
}) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    const checkoutUrl = plan.checkoutUrl!;
    const paymentId = plan.paymentId!;

    const [iframeLoading, setIframeLoading] = useState(true);
    const [isPolling, setIsPolling] = useState(true);
    const [isCheckingNow, setIsCheckingNow] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [newBalanceAfterPay, setNewBalanceAfterPay] = useState<number>(currentBalance);
    const [statusMessage, setStatusMessage] = useState<string>('Đang chờ thanh toán trên cổng PayOS...');
    const [showBillFallback, setShowBillFallback] = useState(false);
    const [isVerifyingBill, setIsVerifyingBill] = useState(false);
    const [billError, setBillError] = useState<string | null>(null);

    const hasActivatedRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCompleteActivation = useCallback(async (paymentRef?: string) => {
        if (hasActivatedRef.current) return;
        hasActivatedRef.current = true;
        setIsPolling(false);
        setStatusMessage('Thanh toán thành công! Đang mở khóa gói và cộng tiền...');

        try {
            const { newBalance, plan: activatedPlan } = await activateSubscriptionPlan(
                userId,
                userName,
                userEmail,
                planId,
                paymentRef
            );

            // Sync local balance service
            addDeposit(plan.price);

            // Enforce max resolution if Plus plan is active
            if (activatedPlan === 'plus') {
                const currentRes = getSelectedResolution();
                if (currentRes === '2K' || currentRes === '4K') {
                    setSelectedResolution('FHD');
                }
            }

            setNewBalanceAfterPay(newBalance);
            setPaymentSuccess(true);
            onSuccess(newBalance, activatedPlan);
        } catch (err) {
            console.error('[PayOSCheckout] Error activating plan:', err);
            hasActivatedRef.current = false;
            setStatusMessage('Có lỗi khi đồng bộ số dư. Vui lòng bấm Kiểm tra lại.');
        }
    }, [userId, userName, userEmail, planId, plan.price, onSuccess]);

    // Check PayOS status via API / Proxy
    const checkPayOSStatus = useCallback(async (manual = false) => {
        if (hasActivatedRef.current || paymentSuccess) return;
        if (manual) {
            setIsCheckingNow(true);
            setStatusMessage('Đang kiểm tra trạng thái giao dịch từ PayOS...');
        }

        try {
            const targetApi = `https://pay.payos.vn/api/web/${paymentId}/check-status/`;
            const proxyUrl = `/api/cors-proxy?url=${encodeURIComponent(targetApi)}`;

            let data: any = null;
            try {
                const res = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    data = await res.json();
                }
            } catch {
                // Fallback direct fetch if proxy unavailable
                const resDirect = await fetch(targetApi, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (resDirect.ok) {
                    data = await resDirect.json();
                }
            }

            if (data && data.code === '00' && data.data) {
                const st = String(data.data.status || '').toUpperCase();
                const rem = typeof data.data.amountRemaining === 'number' ? data.data.amountRemaining : -1;

                if (st === 'PAID' || st === 'COMPLETED' || st === 'SUCCESS' || rem === 0) {
                    await handleCompleteActivation(`PAYOS_${paymentId}_${data.data.orderCode || Date.now()}`);
                    if (manual) setIsCheckingNow(false);
                    return;
                }
            }

            if (manual) {
                setStatusMessage('Hệ thống PayOS đang ghi nhận giao dịch. Nếu bạn đã chuyển khoản xong, bạn có thể tải ảnh biên lai bên dưới để kích hoạt tức thì!');
                setShowBillFallback(true);
            }
        } catch (e) {
            console.warn('[PayOS] Poll warning:', e);
            if (manual) {
                setShowBillFallback(true);
            }
        } finally {
            if (manual) setIsCheckingNow(false);
        }
    }, [paymentId, paymentSuccess, handleCompleteActivation]);

    // Poll every 2.5 seconds while modal is open
    useEffect(() => {
        if (!isPolling || paymentSuccess) return;

        const interval = setInterval(() => {
            checkPayOSStatus(false);
        }, 2500);

        // Listen for postMessage from PayOS iframe
        const handleMessage = (event: MessageEvent) => {
            try {
                if (!event.origin.includes('payos.vn')) return;
                const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                const status = String(payload?.status || payload?.data?.status || '').toUpperCase();
                if (
                    status === 'PAID' ||
                    status === 'COMPLETED' ||
                    status === 'SUCCESS' ||
                    payload?.type === 'PAYMENT_SUCCESS'
                ) {
                    handleCompleteActivation(`PAYOS_MSG_${paymentId}_${Date.now()}`);
                }
            } catch {
                // Ignore non-JSON postMessages
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            clearInterval(interval);
            window.removeEventListener('message', handleMessage);
        };
    }, [isPolling, paymentSuccess, checkPayOSStatus, handleCompleteActivation, paymentId]);

    // Handle instant bill verification fallback
    const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBillError(null);
        setIsVerifyingBill(true);

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const rawResult = ev.target?.result as string;
                const base64 = rawResult.split(',')[1];
                if (!base64) throw new Error('Ảnh biên lai không hợp lệ.');

                const res = await processAndAddCredits(
                    userId,
                    userName,
                    userEmail,
                    base64,
                    plan.price,
                    plan.price,
                    planId
                );

                if (res.success && res.newBalance !== undefined) {
                    hasActivatedRef.current = true;
                    setIsPolling(false);
                    addDeposit(plan.price);
                    if (planId === 'plus') {
                        const currentRes = getSelectedResolution();
                        if (currentRes === '2K' || currentRes === '4K') {
                            setSelectedResolution('FHD');
                        }
                    }
                    setNewBalanceAfterPay(res.newBalance);
                    setPaymentSuccess(true);
                    onSuccess(res.newBalance, planId);
                } else {
                    setBillError(res.message || 'Không thể xác minh biên lai. Vui lòng kiểm tra lại ảnh chụp màn hình giao dịch.');
                }
            } catch (err: any) {
                setBillError(err.message || 'Lỗi xác minh biên lai.');
            } finally {
                setIsVerifyingBill(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const imagesAdded = Math.floor(plan.price / plan.costPerImage);

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-4xl ring-1 ring-slate-900/10 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
                {/* Top Header Bar */}
                <div className={`px-5 py-4 flex items-center justify-between border-b border-slate-100 ${
                    planId === 'pro'
                        ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white'
                        : 'bg-slate-900 text-white'
                }`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center flex-shrink-0 font-bold text-lg">
                            {planId === 'pro' ? '👑' : '⚡'}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-semibold leading-tight truncate">
                                    Thanh toán {plan.name}
                                </h2>
                                <span className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-white/20 text-white font-mono tabular-nums">
                                    +{formatVND(plan.price)} ({imagesAdded} ảnh)
                                </span>
                            </div>
                            <p className="text-xs text-white/80 mt-0.5 truncate">
                                Quét mã VietQR bên dưới • Tự động mở khóa gói & cộng tiền ngay khi hoàn tất
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                            href={checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-all min-h-[38px]"
                            title="Mở trang thanh toán trong tab mới"
                        >
                            <span>Mở tab mới</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
                            aria-label="Đóng"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                {paymentSuccess ? (
                    <div className="p-8 sm:p-12 text-center space-y-6 bg-white flex-1 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 ring-8 ring-emerald-50/60 flex items-center justify-center mx-auto text-emerald-600">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <div className="space-y-2 max-w-md">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                Đã kích hoạt {plan.name}
                            </span>
                            <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                                Thanh toán & Mở gói thành công!
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Tài khoản của bạn đã được cộng thêm <strong className="text-slate-900 font-mono tabular-nums">{formatVND(plan.price)}</strong> và mở khóa toàn bộ đặc quyền của <strong className="text-indigo-600">{plan.name}</strong>.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-5 w-full max-w-sm ring-1 ring-slate-900/5 space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Gói đang hoạt động</span>
                                <span className="font-semibold text-indigo-600 uppercase tracking-wider">{plan.name}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Số dư khả dụng mới</span>
                                <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">{formatVND(newBalanceAfterPay)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Số lượng ảnh quy đổi (500đ/ảnh)</span>
                                <span className="font-semibold text-emerald-700 font-mono tabular-nums">≈ {Math.floor(newBalanceAfterPay / 500)} ảnh</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition-all min-h-[44px] cursor-pointer"
                        >
                            Bắt đầu tạo ảnh ngay
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Direct Embedded PayOS Page */}
                        <div className="relative flex-1 bg-slate-50 min-h-[460px] sm:min-h-[540px] overflow-hidden">
                            {iframeLoading && (
                                <div className="absolute inset-0 z-10 bg-slate-50 flex flex-col items-center justify-center gap-3 p-6">
                                    <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
                                    <p className="text-sm font-medium text-slate-600">
                                        Đang tải cổng thanh toán PayOS ({plan.name} — <span className="font-mono tabular-nums">{formatVND(plan.price)}</span>)...
                                    </p>
                                </div>
                            )}
                            <iframe
                                src={checkoutUrl}
                                title={`PayOS Checkout - ${plan.name}`}
                                className="w-full h-[480px] sm:h-[550px] border-0 bg-white"
                                onLoad={() => setIframeLoading(false)}
                                allow="clipboard-read; clipboard-write; payment"
                            />
                        </div>

                        {/* Footer Status & Instant Verification Bar */}
                        <div className="p-4 sm:px-6 bg-white border-t border-slate-100 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 text-xs text-slate-600">
                                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                    <span className="font-medium leading-relaxed">{statusMessage}</span>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => checkPayOSStatus(true)}
                                        disabled={isCheckingNow}
                                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold transition-all min-h-[44px] shadow-xs disabled:opacity-50 cursor-pointer"
                                    >
                                        {isCheckingNow ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                <span>Đang kiểm tra...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span>Tôi đã chuyển khoản</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowBillFallback(prev => !prev)}
                                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all min-h-[44px] cursor-pointer"
                                    >
                                        Tải ảnh Bill
                                    </button>
                                </div>
                            </div>

                            {/* Optional Instant Bill Upload Fallback */}
                            {showBillFallback && (
                                <div className="p-3.5 rounded-2xl bg-slate-50 ring-1 ring-slate-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold text-slate-800">
                                            Xác nhận nhanh bằng ảnh chụp màn hình chuyển khoản ({formatVND(plan.price)})
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            Nếu cổng PayOS cập nhật chậm, tải ảnh bill vừa chuyển khoản lên để AI tự động mở khóa gói và cộng tiền ngay lập tức.
                                        </p>
                                        {billError && (
                                            <p className="text-xs font-semibold text-red-600 mt-1">{billError}</p>
                                        )}
                                    </div>

                                    <div className="flex-shrink-0">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleBillUpload}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            disabled={isVerifyingBill}
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-semibold transition-all min-h-[44px] disabled:opacity-50 cursor-pointer"
                                        >
                                            {isVerifyingBill ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    <span>Đang duyệt Bill...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                    <span>Chọn ảnh Bill để kích hoạt ngay</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PayOSCheckoutModal;
