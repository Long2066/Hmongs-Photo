import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../src/firebaseConfig';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../services/firebaseService';
import { formatVND, getSelectedResolution, setSelectedResolution } from '../services/geminiCoreService';
import { getUserBalance, setCachedBalance } from '../services/balanceService';

interface PayOSCheckoutModalProps {
    planId: 'plus' | 'pro';
    userId: string;
    userName: string;
    userEmail: string;
    currentBalance: number;
    onClose: () => void;
    onSuccess: (newBalance: number, activatedPlan: SubscriptionPlan) => void;
}

type Order = { orderCode: number; checkoutUrl: string };
type OrderStatus = { status: string; balance?: number; plan?: SubscriptionPlan };

const paymentRequest = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    const localApp = ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:';
    const configuredOrigin = (import.meta.env.VITE_PAYOS_API_ORIGIN || (localApp ? 'https://vip-imagetools.vercel.app' : '')).replace(/\/$/, '');
    if (configuredOrigin && !/^https:\/\/[^/]+$/.test(configuredOrigin)) {
        throw new Error('Cấu hình máy chủ thanh toán HTTPS không hợp lệ.');
    }
    const response = await fetch(`${configuredOrigin}${url}`, {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(init?.headers || {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Không kết nối được máy chủ thanh toán. Vui lòng thử lại.');
    return result as T;
};

export const PayOSCheckoutModal: React.FC<PayOSCheckoutModalProps> = ({
    planId, currentBalance, onClose, onSuccess
}) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [success, setSuccess] = useState(false);
    const [balance, setBalance] = useState(currentBalance);
    const [message, setMessage] = useState('Đang tạo đơn thanh toán mới...');
    const [error, setError] = useState('');
    const completed = useRef(false);
    const creating = useRef(false);

    const createOrder = useCallback(async () => {
        if (creating.current) return;
        creating.current = true;
        setLoading(true);
        setError('');
        setMessage('Đang tạo đơn thanh toán mới...');
        try {
            const next = await paymentRequest<Order>('/api/payos-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            });
            if (!next.orderCode || !/^https:\/\/pay\.payos\.vn\//.test(next.checkoutUrl)) {
                throw new Error('Máy chủ trả về đường dẫn thanh toán không hợp lệ.');
            }
            setOrder(next);
            setMessage('Đang chờ PayOS xác nhận chuyển khoản.');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Không tạo được đơn thanh toán.');
        } finally {
            creating.current = false;
            setLoading(false);
        }
    }, [planId]);

    useEffect(() => { void createOrder(); }, [createOrder]);

    const checkStatus = useCallback(async (manual = false) => {
        if (!order || completed.current) return;
        if (manual) setChecking(true);
        try {
            const result = await paymentRequest<OrderStatus>(`/api/payos-status?orderCode=${encodeURIComponent(order.orderCode)}`);
            if (result.status === 'PAID' && typeof result.balance === 'number' && result.plan) {
                completed.current = true;
                setBalance(result.balance);
                setSuccess(true);
                setError('');
                const cached = getUserBalance();
                setCachedBalance({ ...cached, balanceVND: result.balance, lastUpdated: Date.now() });
                if (result.plan === 'plus' && ['2K', '4K'].includes(getSelectedResolution())) setSelectedResolution('FHD');
                onSuccess(result.balance, result.plan);
            } else if (['CANCELLED', 'EXPIRED'].includes(result.status)) {
                setMessage('Đơn đã hết hạn hoặc bị hủy. Hãy đóng cửa sổ này và chọn mua lại để tạo đơn mới.');
            } else if (manual) {
                setMessage('Chưa nhận được xác nhận từ PayOS. Nếu đã chuyển khoản, vui lòng chờ và kiểm tra lại; không chuyển lần nữa.');
            }
        } catch (cause) {
            if (manual) setError(cause instanceof Error ? cause.message : 'Không kiểm tra được trạng thái.');
        } finally {
            if (manual) setChecking(false);
        }
    }, [order, onSuccess]);

    useEffect(() => {
        if (!order || success) return;
        const timer = window.setInterval(() => { void checkStatus(); }, 3000);
        return () => window.clearInterval(timer);
    }, [order, success, checkStatus]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Thanh toán ${plan.name}`}>
            <div className="flex w-full max-w-3xl max-h-[94vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
                <header className="flex items-center justify-between gap-4 bg-slate-900 px-4 py-4 text-white sm:px-6">
                    <div>
                        <h2 className="text-lg font-semibold leading-tight">Thanh toán {plan.name}</h2>
                        <p className="mt-1 text-sm text-slate-200">Nạp <span className="font-mono tabular-nums">{formatVND(plan.price)}</span> · Mỗi lần mua là một đơn riêng</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Đóng thanh toán" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95">✕</button>
                </header>
                <div className="overflow-y-auto bg-slate-50 p-4 sm:p-6">
                    {success ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
                            <span aria-hidden="true" className="rounded-full bg-emerald-100 px-5 py-3 text-3xl text-emerald-800">✓</span>
                            <h3 className="text-xl font-semibold leading-tight text-slate-900">Thanh toán đã được xác nhận</h3>
                            <p className="text-sm leading-relaxed text-slate-700">Số dư mới: <strong className="font-mono tabular-nums text-slate-900">{formatVND(balance)}</strong></p>
                            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl bg-indigo-700 px-6 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 active:scale-[0.98]">Hoàn tất</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {order ? (
                                <>
                                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-900/5">
                                        Mã đơn: <strong className="font-mono tabular-nums text-slate-900">{order.orderCode}</strong>. Chỉ thanh toán đúng số tiền và nội dung trên PayOS.
                                    </div>
                                    <div className="relative min-h-[380px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 sm:min-h-[500px]">
                                        <iframe key={order.orderCode} src={order.checkoutUrl} title={`PayOS ${plan.name} — đơn ${order.orderCode}`} className="h-[420px] w-full border-0 bg-white sm:h-[540px]" allow="clipboard-read; clipboard-write; payment" />
                                    </div>
                                    <a href={order.checkoutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center rounded-xl px-4 font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 active:scale-[0.98]">Cổng không hiển thị? Mở PayOS trong trình duyệt ↗</a>
                                </>
                            ) : loading ? (
                                <div role="status" className="min-h-[380px] animate-pulse space-y-4 rounded-2xl bg-white p-6" aria-label="Đang tạo đơn thanh toán">
                                    <div className="h-6 w-1/2 rounded bg-slate-200" /><div className="h-52 rounded bg-slate-100" />
                                </div>
                            ) : (
                                <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl bg-white p-6 text-center shadow-sm">
                                    <span aria-hidden="true" className="text-4xl">↻</span>
                                    <p className="text-sm text-slate-700">Chưa tạo được đơn thanh toán.</p>
                                    <button type="button" onClick={() => void createOrder()} className="min-h-[44px] rounded-xl bg-indigo-700 px-5 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 active:scale-95">Thử lại</button>
                                </div>
                            )}
                            <div aria-live="polite" className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-900/5">
                                {error && <p role="alert" className="mb-2 font-semibold text-red-700">{error}</p>}
                                <p>{message}</p>
                                {order && <button type="button" disabled={checking} onClick={() => void checkStatus(true)} className="mt-3 min-h-[44px] rounded-xl bg-indigo-700 px-5 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">{checking ? 'Đang kiểm tra...' : 'Kiểm tra thanh toán'}</button>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayOSCheckoutModal;
