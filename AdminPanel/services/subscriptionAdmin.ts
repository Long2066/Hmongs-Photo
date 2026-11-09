import { doc, getDoc, setDoc, addDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const TERM_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
export const ALLOWANCE = Object.freeze({ plus: 100, pro: 200 });
export const FREE_VIDEO_SECONDS = 8;
export const VIDEO_ALLOWANCE = Object.freeze({ free: FREE_VIDEO_SECONDS, plus: 60, pro: 180 });

const USER_CREDITS_COLLECTION = 'userCredits';
const ADMIN_ACTIONS_COLLECTION = 'adminActions';

export interface SubscriptionData {
    plan: 'free' | 'plus' | 'pro';
    remainingImages: number;
    remainingVideoSeconds: number;
    planAllowanceImages?: number;
    planAllowanceVideoSeconds?: number;
    planStartedAt?: number | null;
    planExpiresAt?: number | null;
    freeVideoGranted?: boolean;
    credits?: number; // Legacy balance
    lastUpdated?: number;
}

export interface AdminActionLog {
    id?: string;
    adminEmail: string;
    targetUserId: string;
    action: 'grant_plan' | 'adjust_quota' | 'extend_plan' | 'downgrade_free';
    description: string;
    before?: Partial<SubscriptionData>;
    after?: Partial<SubscriptionData>;
    timestamp: number;
}

const paid = (plan: string) => plan === 'plus' || plan === 'pro';

/**
 * Chuẩn hóa dữ liệu Subscription theo chuẩn của Tool chính
 */
export function normalizeSubscription(data: any, now: number = Date.now()): { data: SubscriptionData; changed: boolean } {
    const current: SubscriptionData = {
        plan: data?.plan === 'pro' || data?.plan === 'plus' ? data.plan : 'free',
        remainingImages: typeof data?.remainingImages === 'number' ? data.remainingImages : 0,
        remainingVideoSeconds: typeof data?.remainingVideoSeconds === 'number' ? data.remainingVideoSeconds : 0,
        planAllowanceImages: data?.planAllowanceImages,
        planAllowanceVideoSeconds: data?.planAllowanceVideoSeconds,
        planStartedAt: data?.planStartedAt || null,
        planExpiresAt: data?.planExpiresAt || null,
        freeVideoGranted: Boolean(data?.freeVideoGranted),
        credits: typeof data?.credits === 'number' ? data.credits : 0,
        lastUpdated: data?.lastUpdated || now
    };
    let changed = false;

    // Tặng 8s video miễn phí ban đầu cho tài khoản chưa nhận
    if (!current.freeVideoGranted) {
        current.freeVideoGranted = true;
        if (!paid(current.plan) && current.remainingVideoSeconds === 0) {
            current.remainingVideoSeconds = FREE_VIDEO_SECONDS;
            current.planAllowanceVideoSeconds = FREE_VIDEO_SECONDS;
        }
        changed = true;
    }

    if (!paid(current.plan)) {
        if (current.remainingImages !== 0) {
            current.remainingImages = 0;
            changed = true;
        }
        return { data: current, changed };
    }

    // Nếu là gói trả phí nhưng hết hạn 30 ngày -> hạ về Free
    if (current.planExpiresAt && current.planExpiresAt <= now) {
        current.plan = 'free';
        current.remainingImages = 0;
        current.remainingVideoSeconds = 0;
        current.lastUpdated = now;
        return { data: current, changed: true };
    }

    // Nếu hết cả ảnh và video trước 30 ngày -> hạ về Free
    if (current.remainingImages === 0 && current.remainingVideoSeconds === 0) {
        current.plan = 'free';
        current.lastUpdated = now;
        return { data: current, changed: true };
    }

    return { data: current, changed };
}

/**
 * Tính toán trạng thái khi Admin cấp hoặc nâng cấp Gói
 * Luật nghiệp vụ:
 * - Plus -> Pro: Được cộng dồn số ảnh và giây video còn lại của Plus vào Pro
 * - Pro gia hạn Pro: Được cộng dồn hạn mức và gia hạn thêm 30 ngày
 * - Pro mua thêm Plus: Giữ nguyên Pro, cộng thêm 100 ảnh + 60s
 */
export function calculateGrantedPlan(
    existingData: any,
    purchasedPlan: 'plus' | 'pro',
    now: number = Date.now()
): SubscriptionData {
    const { data: existing } = normalizeSubscription(existingData, now);

    const isCurrentActivePaid = paid(existing.plan) && existing.planExpiresAt && existing.planExpiresAt > now;
    const carryPlusImages = isCurrentActivePaid && existing.plan === 'plus' && purchasedPlan === 'pro' ? existing.remainingImages : 0;
    const carryPlusVideo = isCurrentActivePaid && existing.plan === 'plus' && purchasedPlan === 'pro' ? existing.remainingVideoSeconds : 0;

    const proTopUp = isCurrentActivePaid && existing.plan === 'pro';
    const finalPlan = proTopUp ? 'pro' : purchasedPlan;

    const newAllowanceImages = ALLOWANCE[purchasedPlan];
    const newAllowanceVideo = VIDEO_ALLOWANCE[purchasedPlan];

    const finalImages = newAllowanceImages + (proTopUp ? existing.remainingImages : carryPlusImages);
    const finalVideo = newAllowanceVideo + (proTopUp ? existing.remainingVideoSeconds : carryPlusVideo);

    const expiryBase = (isCurrentActivePaid && existing.planExpiresAt && existing.planExpiresAt > now)
        ? existing.planExpiresAt
        : now;

    return {
        ...existing,
        plan: finalPlan,
        remainingImages: finalImages,
        planAllowanceImages: finalImages,
        remainingVideoSeconds: finalVideo,
        planAllowanceVideoSeconds: finalVideo,
        freeVideoGranted: true,
        planStartedAt: existing.planStartedAt || now,
        planExpiresAt: expiryBase + TERM_MS,
        lastUpdated: now
    };
}

/**
 * Ghi log thao tác Admin vào audit trail
 */
export async function logAdminAction(log: AdminActionLog): Promise<void> {
    try {
        await addDoc(collection(db, ADMIN_ACTIONS_COLLECTION), log);
    } catch (e) {
        console.warn('[SubscriptionAdmin] Không thể ghi audit log adminAction:', e);
    }
}

/**
 * 1. Admin Kích hoạt Gói dịch vụ (Plus hoặc Pro)
 */
export async function grantSubscriptionPlan(
    userId: string,
    plan: 'plus' | 'pro',
    adminEmail: string
): Promise<SubscriptionData> {
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? docSnap.data() : { userId };

    const now = Date.now();
    const updated = calculateGrantedPlan(existing, plan, now);

    await setDoc(docRef, {
        ...existing,
        ...updated,
        userId,
        lastUpdated: now
    }, { merge: true });

    await logAdminAction({
        adminEmail,
        targetUserId: userId,
        action: 'grant_plan',
        description: `Kích hoạt gói ${plan.toUpperCase()} (Hạn mức: ${updated.remainingImages} ảnh, ${updated.remainingVideoSeconds}s video, 30 ngày)`,
        before: {
            plan: existing.plan || 'free',
            remainingImages: existing.remainingImages || 0,
            remainingVideoSeconds: existing.remainingVideoSeconds || 0,
            planExpiresAt: existing.planExpiresAt || null
        },
        after: {
            plan: updated.plan,
            remainingImages: updated.remainingImages,
            remainingVideoSeconds: updated.remainingVideoSeconds,
            planExpiresAt: updated.planExpiresAt
        },
        timestamp: now
    });

    return updated;
}

/**
 * 2. Admin Chỉnh tay Hạn mức (Lượt ảnh & Giây video)
 */
export async function adjustSubscriptionQuota(
    userId: string,
    params: {
        deltaImages: number;
        deltaVideoSeconds: number;
        mode: 'add' | 'subtract' | 'set';
    },
    adminEmail: string
): Promise<SubscriptionData> {
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? docSnap.data() : { userId };
    const now = Date.now();

    const { data: current } = normalizeSubscription(existing, now);

    let nextImages = current.remainingImages;
    let nextVideo = current.remainingVideoSeconds;

    if (params.mode === 'add') {
        nextImages += Math.max(0, params.deltaImages || 0);
        nextVideo += Math.max(0, params.deltaVideoSeconds || 0);
    } else if (params.mode === 'subtract') {
        nextImages = Math.max(0, nextImages - (params.deltaImages || 0));
        nextVideo = Math.max(0, nextVideo - (params.deltaVideoSeconds || 0));
    } else if (params.mode === 'set') {
        nextImages = Math.max(0, params.deltaImages || 0);
        nextVideo = Math.max(0, params.deltaVideoSeconds || 0);
    }

    // Nếu đang là Free mà được cấp quota dương -> tự động đặt hạn dùng 30 ngày và kích hoạt Plus
    let nextPlan = current.plan;
    let nextExpiresAt = current.planExpiresAt;
    if (nextImages > 0 || nextVideo > 0) {
        if (!paid(nextPlan) || !nextExpiresAt || nextExpiresAt <= now) {
            nextPlan = 'plus';
            nextExpiresAt = now + TERM_MS;
        }
    } else {
        nextPlan = 'free';
    }

    const updated: SubscriptionData = {
        ...current,
        plan: nextPlan,
        remainingImages: nextImages,
        remainingVideoSeconds: nextVideo,
        planExpiresAt: nextExpiresAt,
        lastUpdated: now
    };

    await setDoc(docRef, {
        ...existing,
        ...updated,
        userId,
        lastUpdated: now
    }, { merge: true });

    await logAdminAction({
        adminEmail,
        targetUserId: userId,
        action: 'adjust_quota',
        description: `Chỉnh tay (${params.mode}): ${params.deltaImages} ảnh, ${params.deltaVideoSeconds}s video -> Còn ${nextImages} ảnh, ${nextVideo}s`,
        before: {
            plan: current.plan,
            remainingImages: current.remainingImages,
            remainingVideoSeconds: current.remainingVideoSeconds,
            planExpiresAt: current.planExpiresAt
        },
        after: {
            plan: updated.plan,
            remainingImages: updated.remainingImages,
            remainingVideoSeconds: updated.remainingVideoSeconds,
            planExpiresAt: updated.planExpiresAt
        },
        timestamp: now
    });

    return updated;
}

/**
 * 3. Admin Gia hạn thời gian sử dụng (+7 ngày, +30 ngày)
 */
export async function extendSubscriptionPlan(
    userId: string,
    days: number,
    adminEmail: string
): Promise<SubscriptionData> {
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? docSnap.data() : { userId };
    const now = Date.now();

    const { data: current } = normalizeSubscription(existing, now);

    const baseExpiry = (current.planExpiresAt && current.planExpiresAt > now)
        ? current.planExpiresAt
        : now;
    const additionalMs = days * 24 * 60 * 60 * 1000;
    const newExpiresAt = baseExpiry + additionalMs;

    const nextPlan = current.plan === 'free' ? 'plus' : current.plan;

    const updated: SubscriptionData = {
        ...current,
        plan: nextPlan,
        planExpiresAt: newExpiresAt,
        lastUpdated: now
    };

    await setDoc(docRef, {
        ...existing,
        ...updated,
        userId,
        lastUpdated: now
    }, { merge: true });

    await logAdminAction({
        adminEmail,
        targetUserId: userId,
        action: 'extend_plan',
        description: `Gia hạn thêm ${days} ngày -> Hạn mới: ${new Date(newExpiresAt).toLocaleDateString('vi-VN')}`,
        before: { planExpiresAt: current.planExpiresAt },
        after: { planExpiresAt: newExpiresAt },
        timestamp: now
    });

    return updated;
}

/**
 * 4. Admin Hạ gói về Free ngay lập tức
 */
export async function downgradeSubscriptionToFree(
    userId: string,
    adminEmail: string
): Promise<SubscriptionData> {
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? docSnap.data() : { userId };
    const now = Date.now();

    const updated: SubscriptionData = {
        plan: 'free',
        remainingImages: 0,
        remainingVideoSeconds: 0,
        planExpiresAt: null,
        freeVideoGranted: true,
        credits: existing.credits || 0,
        lastUpdated: now
    };

    await setDoc(docRef, {
        ...existing,
        ...updated,
        userId,
        lastUpdated: now
    }, { merge: true });

    await logAdminAction({
        adminEmail,
        targetUserId: userId,
        action: 'downgrade_free',
        description: `Hạ gói về Free (Đưa số ảnh và giây video về 0)`,
        before: {
            plan: existing.plan,
            remainingImages: existing.remainingImages,
            remainingVideoSeconds: existing.remainingVideoSeconds,
            planExpiresAt: existing.planExpiresAt
        },
        after: {
            plan: 'free',
            remainingImages: 0,
            remainingVideoSeconds: 0,
            planExpiresAt: null
        },
        timestamp: now
    });

    return updated;
}

/**
 * Lấy lịch sử thao tác của Admin đối với User
 */
export async function getAdminActionLogs(userId: string): Promise<AdminActionLog[]> {
    try {
        const q = query(
            collection(db, ADMIN_ACTIONS_COLLECTION),
            where('targetUserId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminActionLog));
    } catch (e) {
        // Fallback không dùng orderBy nếu chưa tạo composite index
        try {
            const fallbackQ = query(
                collection(db, ADMIN_ACTIONS_COLLECTION),
                where('targetUserId', '==', userId),
                limit(20)
            );
            const snap = await getDocs(fallbackQ);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminActionLog));
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            return list;
        } catch {
            return [];
        }
    }
}
