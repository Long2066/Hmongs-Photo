import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification,
    User as FirebaseUser,
    updateProfile
} from "firebase/auth";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    getDoc,
    orderBy,
    deleteDoc,
    doc,
    limit,
    setDoc,
    onSnapshot,
    Timestamp,
    increment
} from "firebase/firestore";
import { auth, db } from "../src/firebaseConfig";
import type { HistoryItem, User } from "../types";

// --- Auth Services ---

export const registerUser = async (email: string, pass: string, name: string): Promise<FirebaseUser> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, {
        displayName: name,
        photoURL: `https://ui-avatars.com/api/?name=${name}&background=random`
    });

    // Send verification email
    await sendEmailVerification(user);

    // Record new registration for marquee (include email for admin panel)
    await recordNewRegistration(user.uid, name, email);

    return user;
};

export const loginUser = async (email: string, pass: string): Promise<FirebaseUser> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
};

export const logoutUser = async (): Promise<void> => {
    await signOut(auth);
};

export const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

// --- Cloud Visit & Realtime Presence Services ---

import { initializeApp, getApps, getApp } from "firebase/app";

const SYSTEM_STATS_COLLECTION = "systemStats";
const CLOUD_VISITS_DOC = "cloudVisits";
const DAILY_VISITS_COLLECTION = "dailyVisits";
const ACTIVE_SESSIONS_COLLECTION = "activeSessions";
const REGISTRATIONS_COLLECTION = "registrations";
const USER_ACCESS_COLLECTION = "userAccess";
const GLOBAL_CLOUD_VISITS_DOC = "global_cloud_visits";

const CACHED_STATS_KEY = "cloud_stats_cache";

export interface CloudStats {
    totalVisits: number;
    todayVisits: number;
    onlineCount: number;
    activeToday: number;
}

// Background Cloud Sync App Instance
// Uses dedicated background credentials so guest/unauthenticated users
// can sync visits and presence without interfering with primary auth in App.tsx!
let backgroundSyncDb: any = null;
let backgroundSyncPromise: Promise<any> | null = null;

const getBackgroundSyncDb = async (): Promise<any> => {
    if (backgroundSyncDb) return backgroundSyncDb;
    if (typeof window === 'undefined') return db;

    if (!backgroundSyncPromise) {
        backgroundSyncPromise = (async () => {
            try {
                const existingApps = getApps();
                let syncApp = existingApps.find(a => a.name === 'cloudSyncClient');
                if (!syncApp) {
                    syncApp = initializeApp(
                        {
                            apiKey: "AIzaSyAUFQb3vsZPVv6i5smRTeXJkVYZuJGoQZE",
                            authDomain: "toolphoto-2025.firebaseapp.com",
                            projectId: "toolphoto-2025",
                            storageBucket: "toolphoto-2025.firebasestorage.app",
                            messagingSenderId: "820992304466",
                            appId: "1:820992304466:web:6400056a3bf60d747a868b"
                        },
                        'cloudSyncClient'
                    );
                }
                const syncAuth = (await import("firebase/auth")).getAuth(syncApp);
                const syncFirestore = (await import("firebase/firestore")).getFirestore(syncApp);

                // Ensure background authenticated session for Firestore access
                if (!syncAuth.currentUser) {
                    try {
                        await (await import("firebase/auth")).signInWithEmailAndPassword(
                            syncAuth,
                            'guest_cloud_sync@toolphoto.vn',
                            'ToolPhotoCloud2025@'
                        );
                    } catch (signInErr) {
                        console.warn("[CloudSync] Background sign-in fallback:", signInErr);
                    }
                }

                backgroundSyncDb = syncFirestore;
                return syncFirestore;
            } catch (err) {
                console.warn("[CloudSync] Failed to initialize background sync, falling back to primary db:", err);
                backgroundSyncDb = db;
                return db;
            }
        })();
    }

    return backgroundSyncPromise;
};

// Record a cloud visit - ACCUMULATES ON EVERY USER VISIT ("tính dồn")
export const recordCloudVisit = async (): Promise<void> => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const targetDb = await getBackgroundSyncDb();
        const visitRef = doc(targetDb, USER_ACCESS_COLLECTION, GLOBAL_CLOUD_VISITS_DOC);

        const now = Date.now();
        const visitDoc = await getDoc(visitRef);

        if (!visitDoc.exists()) {
            await setDoc(visitRef, {
                totalVisits: 76,
                todayVisits: 13,
                lastDate: today,
                dailyVisits: { [today]: 13 },
                updatedAt: now
            });
        } else {
            const data = visitDoc.data();
            const isNewDay = data.lastDate !== today;
            await setDoc(visitRef, {
                totalVisits: increment(1),
                todayVisits: isNewDay ? 1 : increment(1),
                dailyVisits: {
                    [today]: isNewDay ? 1 : increment(1)
                },
                lastDate: today,
                updatedAt: now
            }, { merge: true });
        }

        // Update local storage cache immediately so UI updates instantly
        if (typeof localStorage !== 'undefined') {
            try {
                const prevCached = JSON.parse(localStorage.getItem(CACHED_STATS_KEY) || '{}');
                const newTotal = (prevCached.totalVisits || 75) + 1;
                const newToday = (prevCached.todayVisits || 12) + 1;
                localStorage.setItem(CACHED_STATS_KEY, JSON.stringify({
                    ...prevCached,
                    totalVisits: newTotal,
                    todayVisits: newToday
                }));
            } catch (e) {}
        }
    } catch (error) {
        console.error("Error recording cloud visit:", error);
    }
};

// Heartbeat for Realtime Online Presence
let presenceInterval: any = null;
let currentSessionId: string = '';

export const startPresenceHeartbeat = (userId?: string, displayName?: string): () => void => {
    try {
        if (!currentSessionId) {
            currentSessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
        }

        let isCleanedUp = false;

        const updateHeartbeat = async () => {
            if (isCleanedUp) return;
            try {
                const targetDb = await getBackgroundSyncDb();
                const sessionRef = doc(targetDb, USER_ACCESS_COLLECTION, currentSessionId);
                await setDoc(sessionRef, {
                    sessionId: currentSessionId,
                    userId: userId || 'guest',
                    displayName: displayName || 'Khách truy cập',
                    lastSeen: Date.now(),
                    isOnline: true,
                    isSession: true,
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 80) : ''
                }, { merge: true });
            } catch (e) {
                // Ignore silent heartbeat errors
            }
        };

        // Immediate update
        updateHeartbeat();

        // Update every 35 seconds
        if (presenceInterval) clearInterval(presenceInterval);
        presenceInterval = setInterval(updateHeartbeat, 35000);

        // Cleanup on window unload
        const handleUnload = async () => {
            isCleanedUp = true;
            try {
                const targetDb = await getBackgroundSyncDb();
                const sessionRef = doc(targetDb, USER_ACCESS_COLLECTION, currentSessionId);
                deleteDoc(sessionRef);
            } catch (e) {}
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', handleUnload);
        }

        return () => {
            isCleanedUp = true;
            if (presenceInterval) clearInterval(presenceInterval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('beforeunload', handleUnload);
            }
            handleUnload();
        };
    } catch (e) {
        console.error("Error in presence heartbeat:", e);
        return () => {};
    }
};

// Subscribe to Realtime Cloud Stats (Visits + Online Presence)
export const subscribeToCloudStats = (callback: (stats: CloudStats) => void): (() => void) => {
    let currentTotalVisits = 75;
    let currentTodayVisits = 12;
    let currentOnlineCount = 1;
    let currentActiveToday = 1;

    // 1. Immediately provide cached data from localStorage if available
    if (typeof localStorage !== 'undefined') {
        try {
            const cached = localStorage.getItem(CACHED_STATS_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed.totalVisits === 'number' && parsed.totalVisits > 0) {
                    currentTotalVisits = parsed.totalVisits;
                    currentTodayVisits = parsed.todayVisits || 1;
                    currentOnlineCount = parsed.onlineCount || 1;
                    currentActiveToday = parsed.activeToday || 1;
                    callback({
                        totalVisits: currentTotalVisits,
                        todayVisits: currentTodayVisits,
                        onlineCount: currentOnlineCount,
                        activeToday: currentActiveToday
                    });
                }
            }
        } catch (e) {}
    }

    const today = new Date().toISOString().split('T')[0];
    let unsubVisits: (() => void) | null = null;
    let unsubSessions: (() => void) | null = null;
    let unsubAccess: (() => void) | null = null;

    getBackgroundSyncDb().then((targetDb) => {
        // 1. Listen to cloud visits doc in userAccess collection
        const visitRef = doc(targetDb, USER_ACCESS_COLLECTION, GLOBAL_CLOUD_VISITS_DOC);
        unsubVisits = onSnapshot(visitRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                currentTotalVisits = data.totalVisits || currentTotalVisits;
                currentTodayVisits = data.lastDate === today ? (data.todayVisits || 1) : 1;
            }
            const updatedStats = {
                totalVisits: currentTotalVisits,
                todayVisits: currentTodayVisits,
                onlineCount: currentOnlineCount,
                activeToday: currentActiveToday
            };
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(CACHED_STATS_KEY, JSON.stringify(updatedStats));
                } catch (e) {}
            }
            callback(updatedStats);
        }, (err) => console.warn("Cloud visits listener warning:", err));

        // 2. Listen to active sessions (last 2 minutes) for real-time online count
        const sessionsQuery = query(collection(targetDb, USER_ACCESS_COLLECTION), where("isOnline", "==", true));
        unsubSessions = onSnapshot(sessionsQuery, (snap) => {
            const threshold = Date.now() - 2 * 60 * 1000; // active in last 2 minutes
            let online = 0;
            snap.forEach(d => {
                const data = d.data();
                if (data.isOnline && data.lastSeen && data.lastSeen > threshold) {
                    online++;
                }
            });
            currentOnlineCount = Math.max(online, 1); // at least current user
            const updatedStats = {
                totalVisits: currentTotalVisits,
                todayVisits: currentTodayVisits,
                onlineCount: currentOnlineCount,
                activeToday: currentActiveToday
            };
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(CACHED_STATS_KEY, JSON.stringify(updatedStats));
                } catch (e) {}
            }
            callback(updatedStats);
        }, (err) => console.warn("Active sessions listener warning:", err));

        // 3. Listen to today active users
        const todayAccessQuery = query(collection(targetDb, USER_ACCESS_COLLECTION), where("date", "==", today));
        unsubAccess = onSnapshot(todayAccessQuery, (snap) => {
            currentActiveToday = Math.max(snap.size, 1);
            const updatedStats = {
                totalVisits: currentTotalVisits,
                todayVisits: currentTodayVisits,
                onlineCount: currentOnlineCount,
                activeToday: currentActiveToday
            };
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(CACHED_STATS_KEY, JSON.stringify(updatedStats));
                } catch (e) {}
            }
            callback(updatedStats);
        }, (err) => console.warn("Today access listener warning:", err));
    }).catch(err => {
        console.error("Error setting up cloud stats subscriptions:", err);
    });

    return () => {
        if (unsubVisits) unsubVisits();
        if (unsubSessions) unsubSessions();
        if (unsubAccess) unsubAccess();
    };
};

// --- User Stats Services ---

// Record new user registration
export const recordNewRegistration = async (userId: string, displayName: string, email?: string): Promise<void> => {
    try {
        await addDoc(collection(db, REGISTRATIONS_COLLECTION), {
            userId,
            displayName,
            email: email || '',
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
        });
    } catch (error) {
        console.error("Error recording registration:", error);
    }
};

// Record user access (for daily active count)
export const recordUserAccess = async (userId: string, displayName: string): Promise<void> => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const docId = `${userId}_${today}`;

        await setDoc(doc(db, USER_ACCESS_COLLECTION, docId), {
            userId,
            displayName,
            date: today,
            lastAccess: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error("Error recording user access:", error);
    }
};

// Get recent registrations (last 5 users who registered)
export const getRecentRegistrations = async (limitCount: number = 5): Promise<{ displayName: string, timestamp: number }[]> => {
    try {
        const q = query(
            collection(db, REGISTRATIONS_COLLECTION),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            displayName: doc.data().displayName,
            timestamp: doc.data().timestamp
        }));
    } catch (error) {
        console.error("Error fetching recent registrations:", error);
        return [];
    }
};

// Get today's active user count
export const getTodayActiveCount = async (): Promise<number> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const q = query(
            collection(db, USER_ACCESS_COLLECTION),
            where("date", "==", today)
        );

        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error fetching today active count:", error);
        return 0;
    }
};

// Subscribe to realtime registration updates (filters out test/mock accounts and deduplicates)
export const subscribeToRegistrations = (
    callback: (registrations: { displayName: string, timestamp: number }[], totalCount?: number) => void,
    limitCount: number = 8
) => {
    const q = query(
        collection(db, REGISTRATIONS_COLLECTION),
        orderBy("timestamp", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const testPatterns = /test|agent|sample|demo/i;
        const uniqueNames = new Set<string>();
        const registrations: { displayName: string, timestamp: number }[] = [];

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const name = (data.displayName || '').trim();
            const email = (data.email || '').trim();

            if (name && !testPatterns.test(name) && !testPatterns.test(email)) {
                if (!uniqueNames.has(name.toLowerCase())) {
                    uniqueNames.add(name.toLowerCase());
                    registrations.push({
                        displayName: name,
                        timestamp: data.timestamp || Date.now()
                    });
                }
            }
        });

        callback(registrations.slice(0, limitCount), snapshot.size);
    });
};

export interface ActiveUserData {
    displayName: string;
    lastAccess: number;
}

// Subscribe to real users active today from userAccess
export const subscribeToTodayActiveUsers = (
    callback: (users: ActiveUserData[]) => void
): (() => void) => {
    const today = new Date().toISOString().split('T')[0];
    let unsub: (() => void) | null = null;

    getBackgroundSyncDb().then(targetDb => {
        const q = query(
            collection(targetDb, USER_ACCESS_COLLECTION),
            where("date", "==", today)
        );
        unsub = onSnapshot(q, (snapshot) => {
            const testPatterns = /test|agent|guest_cloud_sync/i;
            const seen = new Set<string>();
            const active: ActiveUserData[] = [];

            snapshot.docs.forEach(d => {
                const data = d.data();
                const name = (data.displayName || '').trim();
                if (name && !testPatterns.test(name) && !seen.has(name.toLowerCase())) {
                    seen.add(name.toLowerCase());
                    active.push({
                        displayName: name,
                        lastAccess: data.lastAccess || Date.now()
                    });
                }
            });
            active.sort((a, b) => b.lastAccess - a.lastAccess);
            callback(active);
        }, (err) => {
            console.warn("Today active users listener warning:", err);
        });
    }).catch(err => {
        console.warn("Error subscribing to today active users:", err);
    });

    return () => {
        if (unsub) unsub();
    };
};

// Subscribe to today's active count
export const subscribeToTodayActiveCount = (callback: (count: number) => void) => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
        collection(db, USER_ACCESS_COLLECTION),
        where("date", "==", today)
    );

    return onSnapshot(q, (snapshot) => {
        callback(snapshot.size);
    });
};

// --- Activity Log Services (replaces heavy image-based history) ---

const ACTIVITY_LOG_COLLECTION = "activityLog";
const ACTIVITY_LOG_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface ActivityLogItem {
    id?: string;
    userId: string;
    feature: string;
    imageCount: number;
    timestamp: number;
    prompt?: string;
}

// Save activity log (lightweight - no images)
export const saveActivityLog = async (userId: string, feature: string, imageCount: number, prompt?: string): Promise<void> => {
    try {
        console.log('[ACTIVITY] Saving activity:', feature, 'count:', imageCount);
        await addDoc(collection(db, ACTIVITY_LOG_COLLECTION), {
            userId,
            feature,
            imageCount,
            prompt: prompt?.substring(0, 100) || '', // Truncate prompt to save space
            timestamp: Date.now()
        });

        // Atomically sync global image count to userAccess/system_metrics
        try {
            const targetDb = await getBackgroundSyncDb();
            const metricRef = doc(targetDb, USER_ACCESS_COLLECTION, 'system_metrics');
            await setDoc(metricRef, {
                totalImages: increment(imageCount || 1),
                lastUpdated: Date.now()
            }, { merge: true });
        } catch (mErr) {
            console.warn('[ACTIVITY] Could not sync system_metrics image count:', mErr);
        }

        console.log('[ACTIVITY] Saved successfully');
    } catch (error) {
        console.error('[ACTIVITY] Error saving activity log:', error);
        // Don't throw - activity log is not critical
    }
};

// Get activity log for user
export const getActivityLog = async (userId: string, limitCount: number = 50): Promise<ActivityLogItem[]> => {
    try {
        const q = query(
            collection(db, ACTIVITY_LOG_COLLECTION),
            where("userId", "==", userId),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        const now = Date.now();
        const logs: ActivityLogItem[] = [];
        const expiredIds: string[] = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const age = now - data.timestamp;

            if (age > ACTIVITY_LOG_EXPIRATION_MS) {
                expiredIds.push(docSnap.id);
            } else {
                logs.push({
                    id: docSnap.id,
                    userId: data.userId,
                    feature: data.feature,
                    imageCount: data.imageCount,
                    timestamp: data.timestamp,
                    prompt: data.prompt
                });
            }
        });

        // Cleanup expired entries in background
        if (expiredIds.length > 0) {
            Promise.all(expiredIds.map(id => deleteDoc(doc(db, ACTIVITY_LOG_COLLECTION, id))))
                .catch(e => console.error('[ACTIVITY] Cleanup error:', e));
        }

        // Sort by timestamp descending
        logs.sort((a, b) => b.timestamp - a.timestamp);

        return logs;
    } catch (error) {
        console.error('[ACTIVITY] Error fetching activity log:', error);
        return [];
    }
};

// --- Firestore History Services (DEPRECATED - keeping for backward compatibility) ---

const HISTORY_COLLECTION = "history"; // DEPRECATED
const HISTORY_EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds // DEPRECATED
const MAX_FIRESTORE_DOC_SIZE = 900000; // 900KB to leave buffer (Firestore limit is 1MB)

// Helper to estimate document size
const estimateDocSize = (item: any): number => {
    return JSON.stringify(item).length;
};

// Helper to create a thumbnail from base64 image (reduce quality/size)
const createThumbnail = (base64: string, maxLength: number = 50000): string => {
    // If image is small enough, return as is
    if (base64.length <= maxLength) return base64;
    // Otherwise truncate (in a real app, would use canvas to resize)
    // For now, just return a placeholder message
    return 'IMAGE_TOO_LARGE_FOR_HISTORY';
};

// DEPRECATED: Use saveActivityLog instead
// This now just saves activity, not full images
export const saveHistoryToFirestore = async (userId: string, item: HistoryItem): Promise<void> => {
    // Convert to activity log instead of saving heavy images
    await saveActivityLog(
        userId,
        item.style || item.shotType || 'Creative',
        item.images?.length || 1,
        item.prompt
    );
};

export const getHistoryFromFirestore = async (userId: string): Promise<HistoryItem[]> => {
    try {
        console.log('[HISTORY] Fetching history for user:', userId);

        // Query without orderBy first to avoid index requirement
        // Then sort client-side
        const q = query(
            collection(db, HISTORY_COLLECTION),
            where("userId", "==", userId),
            limit(100)
        );

        const querySnapshot = await getDocs(q);
        console.log('[HISTORY] Found', querySnapshot.size, 'documents');

        const now = Date.now();
        const history: HistoryItem[] = [];
        const expiredDocIds: string[] = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const itemAge = now - data.timestamp;

            // Check if item is older than 3 days
            if (itemAge > HISTORY_EXPIRATION_MS) {
                console.log('[HISTORY] Item expired:', docSnap.id, 'age:', Math.floor(itemAge / (1000 * 60 * 60)), 'hours');
                expiredDocIds.push(docSnap.id);
            } else {
                history.push({
                    id: docSnap.id,
                    prompt: data.prompt,
                    aspectRatio: data.aspectRatio,
                    resolution: data.resolution,
                    shotType: data.shotType,
                    style: data.style,
                    images: data.images || [],
                    timestamp: data.timestamp
                });
            }
        });

        // Auto-cleanup expired items in background
        if (expiredDocIds.length > 0) {
            console.log('[HISTORY] Cleaning up', expiredDocIds.length, 'expired items...');
            Promise.all(expiredDocIds.map(id => deleteDoc(doc(db, HISTORY_COLLECTION, id))))
                .then(() => console.log('[HISTORY] Cleanup complete'))
                .catch(err => console.error('[HISTORY] Cleanup error:', err));
        }

        // Sort by timestamp descending (newest first)
        history.sort((a, b) => b.timestamp - a.timestamp);

        console.log('[HISTORY] Returning', history.length, 'valid items');
        return history;
    } catch (error: any) {
        console.error("[HISTORY] Error fetching history from Firestore:", error);

        // Check if it's an index error
        if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.error('[HISTORY] This might be a Firestore index issue. Check Firebase Console.');
        }

        return [];
    }
};

export const deleteHistoryItemFromFirestore = async (docId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, HISTORY_COLLECTION, docId));
    } catch (error) {
        console.error("Error deleting history item:", error);
        throw error;
    }
};

export const clearUserHistoryInFirestore = async (userId: string): Promise<void> => {
    try {
        const q = query(
            collection(db, HISTORY_COLLECTION),
            where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error clearing history:", error);
        throw error;
    }
};

// --- Credits & Subscription Plan Management Services ---

const USER_CREDITS_COLLECTION = "userCredits";
const APPROVED_BILLS_COLLECTION = "approvedBills";
const FAILED_BILLS_COLLECTION = "failedBills";

export type SubscriptionPlan = 'free' | 'plus' | 'pro';

export const IMAGE_COST_VND = 500;
export const FREE_DAILY_IMAGE_LIMIT = 20;
export const FREE_ALLOWED_MODEL = 'gpt-image-1.5';

export interface PlanInfo {
    id: SubscriptionPlan;
    name: string;
    badge: string;
    originalPrice: number;
    price: number;
    costPerImage: number;
    maxResolution: 'FHD' | '4K';
    dailyFreeLimit?: number;
    paymentId?: string;
    checkoutUrl?: string;
    description: string;
    features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, PlanInfo> = {
    free: {
        id: 'free',
        name: 'Gói Free',
        badge: 'Miễn phí',
        originalPrice: 0,
        price: 0,
        costPerImage: 0,
        maxResolution: 'FHD',
        dailyFreeLimit: FREE_DAILY_IMAGE_LIMIT,
        description: 'Trải nghiệm tạo ảnh AI cơ bản mỗi ngày hoàn toàn miễn phí.',
        features: [
            'Tạo tối đa 20 ảnh / ngày',
            'Sử dụng model GPT Image 1.5',
            'Độ phân giải tiêu chuẩn (HD / FHD)',
            'Lưu trữ lịch sử tạo ảnh 72 giờ'
        ]
    },
    plus: {
        id: 'plus',
        name: 'Gói Plus',
        badge: 'Tiết kiệm 58%',
        originalPrice: 120000,
        price: 50000,
        costPerImage: IMAGE_COST_VND,
        maxResolution: 'FHD',
        paymentId: '852aa89112564079b9d1658f9c517135',
        checkoutUrl: 'https://pay.payos.vn/web/852aa89112564079b9d1658f9c517135',
        description: 'Mở khóa toàn bộ tính năng sáng tạo với mức chi phí siêu tiết kiệm.',
        features: [
            'Cộng ngay 50.000đ vào số dư (tương đương 100 ảnh)',
            'Sử dụng full tất cả các tính năng trên công cụ',
            'Mở khóa toàn bộ Model AI (Gemini 3.1, GPT 2.5...)',
            'Tạo ảnh độ phân giải tối đa mức FHD (Full HD)',
            'Chi phí tạo ảnh chỉ 500đ / ảnh'
        ]
    },
    pro: {
        id: 'pro',
        name: 'Gói Pro',
        badge: 'Giảm 50% • Cao cấp nhất',
        originalPrice: 200000,
        price: 100000,
        costPerImage: IMAGE_COST_VND,
        maxResolution: '4K',
        paymentId: 'f950f2ae3bde4c6a80345252f6c00bad',
        checkoutUrl: 'https://pay.payos.vn/web/f950f2ae3bde4c6a80345252f6c00bad',
        description: 'Sức mạnh tối đa không giới hạn cho Studio & Designer chuyên nghiệp.',
        features: [
            'Cộng ngay 100.000đ vào số dư (tương đương 200 ảnh)',
            'Sử dụng full toàn bộ tính năng có trên Tool',
            'Mở khóa toàn bộ Model AI cao cấp nhất',
            'Mở khóa mọi mức độ phân giải: HD, FHD, 2K, 4K Ultra',
            'Chi phí tạo ảnh chỉ 500đ / ảnh • Ưu tiên tốc độ'
        ]
    }
};

// Credits per amount (VND)
export const CREDITS_PRICING = {
    10000: 100,   // 5 images
    20000: 200,   // 10 images
    50000: 500,   // 100 images (500đ/ảnh)
    100000: 1000, // 200 images (500đ/ảnh)
};

export const CREDITS_PER_IMAGE = 20;

// Bill verification info (Supports both MBBank PayOS & VietinBank)
export const BANK_INFO = {
    bankName: 'MBBank',
    accountHolder: 'MA VAN LONG',
    accountNumber: 'VQRQANFM',
    supportPhone: '0342.733.640'
};

export interface UserSubscriptionState {
    credits: number;
    plan: SubscriptionPlan;
    dailyFreeUsed: number;
    dailyFreeDate: string;
}

export const getTodayDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const resolveEffectivePlan = (rawPlan?: string, credits: number = 0): SubscriptionPlan => {
    if (credits < IMAGE_COST_VND) {
        return 'free';
    }
    if (rawPlan === 'pro') return 'pro';
    if (rawPlan === 'plus') return 'plus';
    // Fallback inference for existing users with balance before plan field was introduced
    return credits >= 100000 ? 'pro' : 'plus';
};

export const getCachedUserPlan = (userId?: string): SubscriptionPlan => {
    try {
        const uid = userId || JSON.parse(localStorage.getItem('image_gen_logged_in_user') || '{}')?.id;
        if (!uid) return 'free';
        const rawPlan = localStorage.getItem('user_plan_' + uid) || undefined;
        const rawBal = localStorage.getItem('user_balance_raw_' + uid);
        const credits = rawBal ? parseInt(rawBal, 10) || 0 : 0;
        return resolveEffectivePlan(rawPlan, credits);
    } catch {
        return 'free';
    }
};

export const getCachedDailyFreeUsed = (userId?: string): number => {
    try {
        const uid = userId || JSON.parse(localStorage.getItem('image_gen_logged_in_user') || '{}')?.id;
        if (!uid) return 0;
        const today = getTodayDateString();
        const storedDate = localStorage.getItem('user_free_date_' + uid);
        if (storedDate !== today) {
            return 0;
        }
        return parseInt(localStorage.getItem('user_free_used_' + uid) || '0', 10) || 0;
    } catch {
        return 0;
    }
};

export const getDailyFreeRemaining = (userId?: string): number => {
    const used = getCachedDailyFreeUsed(userId);
    return Math.max(0, FREE_DAILY_IMAGE_LIMIT - used);
};

export interface BillData {
    id?: string;
    userId: string;
    userName: string;
    userEmail: string;
    amount: number;
    credits: number;
    transferTime: string;
    content: string;
    senderName?: string | null;
    billHash: string; // For duplicate detection
    timestamp: number;
    verificationStatus: 'approved' | 'failed';
    failureReason?: string | null;
    plan?: SubscriptionPlan;
}

// Get user's current credits balance
export const getUserCredits = async (userId: string): Promise<number> => {
    try {
        const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().credits || 0;
        }
        return 0;
    } catch (error) {
        console.error("Error getting user credits:", error);
        return 0;
    }
};

// Update user's credits (add or subtract) with timeout protection
export const updateUserCredits = async (
    userId: string,
    amount: number,
    operation: 'add' | 'subtract',
    planOverride?: SubscriptionPlan
): Promise<number> => {
    try {
        const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        const existingData = docSnap.exists() ? docSnap.data() : {};
        const currentCredits = existingData.credits || 0;
        const newCredits = operation === 'add'
            ? currentCredits + amount
            : Math.max(0, currentCredits - amount);

        const nextPlan: SubscriptionPlan = planOverride
            ? planOverride
            : newCredits < IMAGE_COST_VND
                ? 'free'
                : (existingData.plan === 'pro' || existingData.plan === 'plus')
                    ? existingData.plan
                    : (newCredits >= 100000 ? 'pro' : 'plus');

        const updatePayload: Record<string, any> = {
            userId,
            credits: newCredits,
            plan: nextPlan,
            lastUpdated: Date.now()
        };

        // Add timeout to prevent hanging
        await Promise.race([
            setDoc(docRef, updatePayload, { merge: true }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Firestore update timeout (15s)')), 15000)
            )
        ]);

        // Atomically sync system_metrics in userAccess for global metrics
        try {
            const targetDb = await getBackgroundSyncDb();
            const metricRef = doc(targetDb, USER_ACCESS_COLLECTION, 'system_metrics');
            if (operation === 'add') {
                await setDoc(metricRef, {
                    totalDeposited: increment(amount),
                    lastUpdated: Date.now()
                }, { merge: true });
            } else if (operation === 'subtract') {
                await setDoc(metricRef, {
                    totalSpent: increment(amount),
                    lastUpdated: Date.now()
                }, { merge: true });
            }
        } catch (mErr) {
            console.warn('[Credits] Could not sync system_metrics:', mErr);
        }

        // Update local cache immediately
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('user_balance_raw_' + userId, newCredits.toString());
            localStorage.setItem('user_plan_' + userId, nextPlan);
            localStorage.setItem('user_credits_' + userId, Math.floor(newCredits / 100).toString());
            window.dispatchEvent(new CustomEvent('user-balance-changed', {
                detail: { balance: newCredits, plan: nextPlan }
            }));
        }

        return newCredits;
    } catch (error) {
        console.error("Error updating user credits:", error);
        throw error;
    }
};

// Activate Plus or Pro subscription package after PayOS checkout success
export const activateSubscriptionPlan = async (
    userId: string,
    userName: string,
    userEmail: string,
    plan: 'plus' | 'pro',
    paymentRef?: string
): Promise<{ newBalance: number; plan: SubscriptionPlan }> => {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    const amountToAdd = planConfig.price; // 50,000 for Plus, 100,000 for Pro
    const billHash = paymentRef || `PAYOS_${plan.toUpperCase()}_${userId}_${Date.now()}`;

    // Check duplicate if paymentRef is deterministic
    if (paymentRef) {
        const isDup = await checkDuplicateBill(paymentRef);
        if (isDup) {
            const currentBal = await getUserCredits(userId);
            return { newBalance: currentBal, plan };
        }
    }

    // Check current user plan so we don't downgrade a Pro user who buys Plus top-up unless they had 0 balance
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};
    const existingCredits = existingData.credits || 0;
    const finalPlan: SubscriptionPlan =
        (existingCredits >= IMAGE_COST_VND && existingData.plan === 'pro' && plan === 'plus')
            ? 'pro'
            : plan;

    const newBalance = await updateUserCredits(userId, amountToAdd, 'add', finalPlan);

    // Record approved bill in Firestore for Admin Panel & History
    try {
        await saveApprovedBill({
            userId,
            userName: userName || 'User',
            userEmail: userEmail || '',
            amount: amountToAdd,
            credits: amountToAdd,
            transferTime: new Date().toISOString(),
            content: `Nang cap Imagetool ${plan === 'pro' ? 'Pro' : 'Plus'}`,
            senderName: userName || 'PayOS Checkout',
            billHash,
            timestamp: Date.now(),
            verificationStatus: 'approved',
            plan: finalPlan
        });
    } catch (e) {
        console.warn('Could not save approved bill log:', e);
    }

    return { newBalance, plan: finalPlan };
};

// Increment daily free image counter for Free tier users
export const incrementDailyFreeUsage = async (userId: string, imageCount: number = 1): Promise<number> => {
    const today = getTodayDateString();
    let newUsed = imageCount;

    try {
        const currentLocalUsed = getCachedDailyFreeUsed(userId);
        newUsed = currentLocalUsed + imageCount;

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('user_free_date_' + userId, today);
            localStorage.setItem('user_free_used_' + userId, newUsed.toString());
            window.dispatchEvent(new CustomEvent('user-balance-changed', {
                detail: { dailyFreeUsed: newUsed }
            }));
        }

        const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const dbUsed = data.dailyFreeDate === today ? (data.dailyFreeUsed || 0) : 0;
            newUsed = Math.max(newUsed, dbUsed + imageCount);
        }

        await setDoc(docRef, {
            userId,
            dailyFreeDate: today,
            dailyFreeUsed: newUsed,
            lastUpdated: Date.now()
        }, { merge: true });

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('user_free_used_' + userId, newUsed.toString());
        }
    } catch (e) {
        console.warn('Failed to sync daily free usage to Firestore:', e);
    }

    return newUsed;
};

// Save approved bill record with timeout protection
export const saveApprovedBill = async (billData: BillData): Promise<void> => {
    try {
        // Add timeout to prevent hanging
        await Promise.race([
            addDoc(collection(db, APPROVED_BILLS_COLLECTION), {
                ...billData,
                verificationStatus: 'approved',
                timestamp: Date.now()
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Firestore save timeout (15s)')), 15000)
            )
        ]);
    } catch (error) {
        console.error("Error saving approved bill:", error);
        throw error;
    }
};

// Save failed bill record (for admin review)
export const saveFailedBill = async (billData: BillData, failureReason: string): Promise<void> => {
    try {
        await addDoc(collection(db, FAILED_BILLS_COLLECTION), {
            ...billData,
            verificationStatus: 'failed',
            failureReason,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error saving failed bill:", error);
        throw error;
    }
};

// Check for duplicate bill (by hash)
export const checkDuplicateBill = async (billHash: string): Promise<boolean> => {
    try {
        const q = query(
            collection(db, APPROVED_BILLS_COLLECTION),
            where("billHash", "==", billHash)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking duplicate bill:", error);
        return false;
    }
};

// Get all approved bills (admin function)
export const getApprovedBills = async (limitCount: number = 50): Promise<BillData[]> => {
    try {
        const q = query(
            collection(db, APPROVED_BILLS_COLLECTION),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BillData));
    } catch (error) {
        console.error("Error getting approved bills:", error);
        return [];
    }
};

// Get all failed bills (admin function for review)
export const getFailedBills = async (limitCount: number = 50): Promise<BillData[]> => {
    try {
        const q = query(
            collection(db, FAILED_BILLS_COLLECTION),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BillData));
    } catch (error) {
        console.error("Error getting failed bills:", error);
        return [];
    }
};

// Subscribe to user credits and subscription plan updates (realtime)
export const subscribeToUserCredits = (
    userId: string,
    callback: (credits: number, state?: UserSubscriptionState) => void
) => {
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);

    return onSnapshot(docRef, (docSnap) => {
        const today = getTodayDateString();
        if (docSnap.exists()) {
            const data = docSnap.data();
            const credits = data.credits || 0;
            const plan = resolveEffectivePlan(data.plan, credits);
            const dailyFreeUsed = data.dailyFreeDate === today ? (data.dailyFreeUsed || 0) : 0;

            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('user_balance_raw_' + userId, credits.toString());
                localStorage.setItem('user_plan_' + userId, plan);
                localStorage.setItem('user_credits_' + userId, Math.floor(credits / 100).toString());
                localStorage.setItem('user_free_date_' + userId, today);
                localStorage.setItem('user_free_used_' + userId, dailyFreeUsed.toString());
                window.dispatchEvent(new CustomEvent('user-balance-changed', {
                    detail: { balance: credits, plan, dailyFreeUsed }
                }));
            }

            callback(credits, {
                credits,
                plan,
                dailyFreeUsed,
                dailyFreeDate: today
            });
        } else {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('user_balance_raw_' + userId, '0');
                localStorage.setItem('user_plan_' + userId, 'free');
                localStorage.setItem('user_credits_' + userId, '0');
            }
            callback(0, {
                credits: 0,
                plan: 'free',
                dailyFreeUsed: getCachedDailyFreeUsed(userId),
                dailyFreeDate: today
            });
        }
    });
};

// --- Notification Services ---

const NOTIFICATIONS_COLLECTION = "notifications";

export interface NotificationData {
    id: string;
    targetUserId: string; // "ALL" for broadcast
    title: string;
    message: string;
    timestamp: number;
    isRead: boolean;
    createdBy: string;
}

// Get notifications for user (both targeted and broadcast)
export const getUserNotifications = async (userId: string, limitCount: number = 10): Promise<NotificationData[]> => {
    try {
        // Get notifications targeted to this user OR broadcast to ALL
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            orderBy("timestamp", "desc"),
            limit(limitCount * 2) // Get more to filter
        );

        const snapshot = await getDocs(q);
        const notifications: NotificationData[] = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Include if targeted to this user or broadcast to ALL
            if (data.targetUserId === userId || data.targetUserId === 'ALL') {
                notifications.push({
                    id: docSnap.id,
                    targetUserId: data.targetUserId,
                    title: data.title,
                    message: data.message,
                    timestamp: data.timestamp,
                    isRead: data.isRead || false,
                    createdBy: data.createdBy
                });
            }
        });

        return notifications.slice(0, limitCount);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
};

// Subscribe to new notifications in realtime
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: NotificationData[]) => void
) => {
    const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        orderBy("timestamp", "desc"),
        limit(20)
    );

    return onSnapshot(q, (snapshot) => {
        const notifications: NotificationData[] = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Include if targeted to this user or broadcast to ALL
            if (data.targetUserId === userId || data.targetUserId === 'ALL') {
                notifications.push({
                    id: docSnap.id,
                    targetUserId: data.targetUserId,
                    title: data.title,
                    message: data.message,
                    timestamp: data.timestamp,
                    isRead: data.isRead || false,
                    createdBy: data.createdBy
                });
            }
        });

        callback(notifications);
    });
};

// Mark notification as read for a specific user (stores in localStorage since Firestore doc is shared)
export const markNotificationAsRead = (userId: string, notificationId: string): void => {
    const key = `read_notifications_${userId}`;
    const readIds = JSON.parse(localStorage.getItem(key) || '[]');
    if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
        localStorage.setItem(key, JSON.stringify(readIds));
    }
};

// Check if notification is read by user
export const isNotificationRead = (userId: string, notificationId: string): boolean => {
    const key = `read_notifications_${userId}`;
    const readIds = JSON.parse(localStorage.getItem(key) || '[]');
    return readIds.includes(notificationId);
};

// Get unread notification count
export const getUnreadNotificationIds = (userId: string): string[] => {
    const key = `read_notifications_${userId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
};

// --- Terms of Service ---

export interface TermsData {
    content: string;
    version: string;
    updatedAt: Date | null;
}

const DEFAULT_TERMS_CONTENT = `📜 ĐIỀU KHOẢN SỬ DỤNG TOOLPHOTO2025
Cập nhật: 31/01/2026

1. ĐỘ TUỔI - Bạn phải đủ 18 tuổi để sử dụng ImageTool.

2. TÀI KHOẢN - Bạn chịu trách nhiệm bảo mật tài khoản. Không chia sẻ với người khác.

3. NỘI DUNG AI - Nội dung AI tạo ra có thể không chính xác. Bạn chịu trách nhiệm kiểm tra.

4. NỘI DUNG BỊ CẤM - Cấm tạo: khiêu dâm, bạo lực, deepfake, vi phạm pháp luật.

5. QUYỀN SỞ HỮU - Bạn giữ toàn quyền với ảnh tải lên và được sử dụng thương mại.

6. BẢO MẬT - Ảnh tải lên KHÔNG lưu trên server.

7. GIỚI HẠN - Dịch vụ có thể gián đoạn hoặc thay đổi tính năng.

8. MIỄN TRỪ - Dịch vụ cung cấp "như hiện có", không chịu trách nhiệm thiệt hại gián tiếp.

9. CHẤM DỨT - Chúng tôi có quyền khóa tài khoản nếu vi phạm.

10. PHÁP LUẬT - Điều khoản tuân theo pháp luật Việt Nam.

Bằng việc đăng ký, bạn đồng ý với các điều khoản trên.`;

// Get terms content from Firestore
export const getTermsContent = async (): Promise<TermsData> => {
    try {
        const docRef = doc(db, 'appConfig', 'terms');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                content: data.content || DEFAULT_TERMS_CONTENT,
                version: data.version || '1.0',
                updatedAt: data.updatedAt?.toDate() || null
            };
        }

        return {
            content: DEFAULT_TERMS_CONTENT,
            version: '1.0',
            updatedAt: null
        };
    } catch (error) {
        console.error('Error getting terms:', error);
        return {
            content: DEFAULT_TERMS_CONTENT,
            version: '1.0',
            updatedAt: null
        };
    }
};

// Subscribe to terms updates (realtime)
export const subscribeToTerms = (callback: (terms: TermsData) => void) => {
    const docRef = doc(db, 'appConfig', 'terms');

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            callback({
                content: data.content || DEFAULT_TERMS_CONTENT,
                version: data.version || '1.0',
                updatedAt: data.updatedAt?.toDate() || null
            });
        } else {
            callback({
                content: DEFAULT_TERMS_CONTENT,
                version: '1.0',
                updatedAt: null
            });
        }
    });
};


// --- AI Proxy Configuration (Realtime Cloud Sync) ---
export interface AiProxyConfig {
    enabled: boolean;
    url: string;
    apiKey: string;
    defaultTextModel?: string;
    defaultImageModel?: string;
    modelPricing?: Record<string, boolean>;
    updatedAt?: number;
    updatedBy?: string;
}

const SYSTEM_SETTINGS_COLLECTION = "systemSettings";
const AI_PROXY_CONFIG_DOC = "aiProxyConfig";

/**
 * Subscribe to AI Proxy Configuration updates from Firestore.
 * When the Admin updates the Endpoint, API Key, or ON/OFF switch in Admin Panel,
 * all clients receive the updated settings immediately.
 * Dual-subscribes via background sync DB (userAccess) and primary DB (systemSettings).
 */
export const subscribeToAiProxyConfig = (callback: (config: AiProxyConfig) => void): (() => void) => {
    let unsubUserAccess: (() => void) | null = null;
    let unsubSystemSettings: (() => void) | null = null;
    let isCleanedUp = false;

    // 1. Subscribe via getBackgroundSyncDb to userAccess/aiProxyConfig
    // (guaranteed permission for all clients including unauthenticated/guests)
    getBackgroundSyncDb().then(targetDb => {
        if (isCleanedUp) return;
        try {
            const uaRef = doc(targetDb, USER_ACCESS_COLLECTION, AI_PROXY_CONFIG_DOC);
            unsubUserAccess = onSnapshot(uaRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as AiProxyConfig;
                    callback(data);
                }
            }, (err) => {
                console.warn('[CloudConfig] userAccess aiProxyConfig listener warning:', err);
            });
        } catch (e) {
            console.warn('[CloudConfig] Error setting up userAccess aiProxyConfig listener:', e);
        }
    }).catch(err => {
        console.warn('[CloudConfig] Background sync db error for aiProxyConfig:', err);
    });

    // 2. Also subscribe via primary db to systemSettings/aiProxyConfig (for authenticated admin)
    try {
        const configRef = doc(db, SYSTEM_SETTINGS_COLLECTION, AI_PROXY_CONFIG_DOC);
        unsubSystemSettings = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as AiProxyConfig;
                callback(data);
            }
        }, (err) => {
            // Silently ignore if guest client doesn't have systemSettings read access
        });
    } catch (e) {
        // Silently ignore
    }

    return () => {
        isCleanedUp = true;
        if (unsubUserAccess) unsubUserAccess();
        if (unsubSystemSettings) unsubSystemSettings();
    };
};

// --- Feedback / Hòm thư góp ý Services ---
export interface UserFeedbackPayload {
    name: string;
    email: string;
    title?: string;
    message: string;
    userId?: string;
}

/**
 * Submit user feedback or bug report to Firebase Firestore.
 * Dual-saved to userAccess (with isFeedback: true) and feedback collection,
 * ensuring 100% reliable reception on Admin Panel "Hòm thư góp ý".
 */
export const submitUserFeedback = async (payload: UserFeedbackPayload): Promise<void> => {
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const dataToSave = {
        id: feedbackId,
        isFeedback: true,
        type: 'feedback',
        name: (payload.name || '').trim(),
        email: (payload.email || '').trim(),
        title: (payload.title || 'Góp ý ImageTool').trim(),
        message: (payload.message || '').trim(),
        status: 'unread',
        createdAt: now,
        userId: payload.userId || 'guest',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 150) : ''
    };

    let saved = false;

    // 1. Save to userAccess collection via getBackgroundSyncDb (guaranteed write for all visitors)
    try {
        const targetDb = await getBackgroundSyncDb();
        const docRef = doc(targetDb, USER_ACCESS_COLLECTION, feedbackId);
        await setDoc(docRef, dataToSave);
        saved = true;
        console.log('[Feedback] Saved feedback to userAccess collection successfully:', feedbackId);
    } catch (err) {
        console.warn('[Feedback] Warning saving to userAccess:', err);
    }

    // 2. Also try writing to feedback collection on primary db
    try {
        const feedRef = doc(db, 'feedback', feedbackId);
        await setDoc(feedRef, dataToSave);
        saved = true;
    } catch (e) {
        // Silently ignore if collection rules not yet updated
    }

    if (!saved) {
        throw new Error('Không thể lưu góp ý vào máy chủ. Vui lòng thử lại sau.');
    }
};
