import { auth } from '../src/firebaseConfig';

export interface SubscriptionEntitlement {
    plan: 'free' | 'plus' | 'pro';
    remainingImages: number;
    planStartedAt: number | null;
    planExpiresAt: number | null;
    planAllowanceImages: number;
}

const request = async (init?: RequestInit): Promise<SubscriptionEntitlement> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');
    // Local testing uses the local API; never mutate production subscription data implicitly.
    const origin = (import.meta.env.VITE_PAYOS_API_ORIGIN || (!import.meta.env.DEV && window.location.protocol === 'file:' ? 'https://vip-imagetools.vercel.app' : '')).replace(/\/$/, '');
    if (origin && !/^https:\/\/[^/]+$/.test(origin)) throw new Error('Invalid subscription API origin');
    const response = await fetch(`${origin}/api/subscription`, {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(init?.headers || {}) },
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json().catch(() => ({})) : {};
    if (!isJson) throw new Error('API gói chưa chạy trên máy local. Hãy khởi động backend local để kiểm tra lượt ảnh.');
    if (!response.ok) throw new Error(body.error || 'Subscription request failed');
    if (!['free', 'plus', 'pro'].includes(body.plan) || !Number.isSafeInteger(body.remainingImages) || body.remainingImages < 0) {
        throw new Error('Máy chủ trả về dữ liệu gói không hợp lệ.');
    }
    return body as SubscriptionEntitlement;
};

export const refreshSubscription = (): Promise<SubscriptionEntitlement> => request();
export const consumeSubscriptionImages = (count: number, requestId: string = crypto.randomUUID()): Promise<SubscriptionEntitlement> => {
    if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('Invalid image count');
    return request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'consume', count, requestId }) });
};
