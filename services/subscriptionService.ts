import { auth } from '../src/firebaseConfig';
import { consumeUserPlanImagesDirect, consumeUserVideoSecondsDirect } from './firebaseService';

export interface SubscriptionEntitlement {
    plan: 'free' | 'plus' | 'pro';
    remainingImages: number;
    remainingVideoSeconds: number;
    planStartedAt: number | null;
    planExpiresAt: number | null;
    planAllowanceImages: number;
    planAllowanceVideoSeconds?: number;
}

const resolveApiOrigin = (): string => {
    if (import.meta.env.VITE_PAYOS_API_ORIGIN) {
        return import.meta.env.VITE_PAYOS_API_ORIGIN.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location.hostname === 'vip-imagetools.vercel.app') {
        return '';
    }
    return 'https://vip-imagetools.vercel.app';
};

const request = async (init?: RequestInit): Promise<SubscriptionEntitlement> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');
    const origin = resolveApiOrigin();
    const response = await fetch(`${origin}/api/subscription`, {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(init?.headers || {}) },
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json().catch(() => ({})) : {};
    if (!isJson || !response.ok) {
        throw new Error(body.error || 'Subscription request failed');
    }
    if (!['free', 'plus', 'pro'].includes(body.plan) || !Number.isSafeInteger(body.remainingImages) || body.remainingImages < 0) {
        throw new Error('Dữ liệu gói không hợp lệ.');
    }
    return {
        ...body,
        remainingVideoSeconds: Number.isSafeInteger(body.remainingVideoSeconds) ? body.remainingVideoSeconds : 0
    } as SubscriptionEntitlement;
};

export const refreshSubscription = async (): Promise<SubscriptionEntitlement | null> => {
    try {
        return await request();
    } catch {
        return null;
    }
};

export const consumeSubscriptionImages = async (
    count: number,
    requestId: string = crypto.randomUUID()
): Promise<SubscriptionEntitlement> => {
    if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('Invalid image count');
    try {
        return await request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'consume', count, requestId })
        });
    } catch (err) {
        console.warn('[SubscriptionService] Server consume failed, using direct Firestore fallback:', err);
        const user = auth.currentUser;
        if (user) {
            const fallback = await consumeUserPlanImagesDirect(user.uid, count);
            if (fallback) {
                return {
                    plan: fallback.plan,
                    remainingImages: fallback.remainingImages,
                    remainingVideoSeconds: fallback.remainingVideoSeconds,
                    planStartedAt: fallback.planStartedAt,
                    planExpiresAt: fallback.planExpiresAt,
                    planAllowanceImages: fallback.planAllowanceImages,
                    planAllowanceVideoSeconds: fallback.planAllowanceVideoSeconds
                };
            }
        }
        throw err;
    }
};

export const consumeSubscriptionVideoSeconds = async (
    seconds: number,
    requestId: string = crypto.randomUUID()
): Promise<SubscriptionEntitlement> => {
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 180) throw new Error('Invalid video seconds');
    try {
        return await request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'consume_video', seconds, requestId })
        });
    } catch (err) {
        console.warn('[SubscriptionService] Server consume_video failed, using direct Firestore fallback:', err);
        const user = auth.currentUser;
        if (user) {
            const fallback = await consumeUserVideoSecondsDirect(user.uid, seconds);
            if (fallback) {
                return {
                    plan: fallback.plan,
                    remainingImages: fallback.remainingImages,
                    remainingVideoSeconds: fallback.remainingVideoSeconds,
                    planStartedAt: fallback.planStartedAt,
                    planExpiresAt: fallback.planExpiresAt,
                    planAllowanceImages: fallback.planAllowanceImages,
                    planAllowanceVideoSeconds: fallback.planAllowanceVideoSeconds
                };
            }
        }
        throw err;
    }
};
