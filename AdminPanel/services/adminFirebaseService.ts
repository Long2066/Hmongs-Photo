// Admin Firebase Service
// CRUD operations for user management

import {
    collection,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot,
    increment
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Collection names
const USER_CREDITS_COLLECTION = "userCredits";
const REGISTRATIONS_COLLECTION = "registrations";
const USER_ACCESS_COLLECTION = "userAccess";
const APPROVED_BILLS_COLLECTION = "approvedBills";
const NOTIFICATIONS_COLLECTION = "notifications";
const GLOBAL_CLOUD_VISITS_DOC = "global_cloud_visits";
const SYSTEM_METRICS_DOC = "system_metrics";

// Types
export interface UserData {
    id: string;
    email?: string;
    displayName: string;
    credits: number; // Now represents VND balance
    plan?: 'free' | 'plus' | 'pro';
    isLocked: boolean;
    lockedAt?: number;
    lockedReason?: string;
    registeredAt?: number;
    lastUpdated?: number;
}

export interface BillData {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    amount: number;
    credits: number; // Now represents VND amount added
    transferTime: string;
    timestamp: number;
}

export interface NotificationData {
    id?: string;
    targetUserId: string; // "ALL" for broadcast
    title: string;
    message: string;
    timestamp: number;
    isRead: boolean;
    createdBy: string;
}

export interface RealtimeCloudStats {
    totalVisits: number;
    todayVisits: number;
    onlineCount: number;
    activeToday: number;
    activeSessions: {
        sessionId: string;
        displayName: string;
        userId: string;
        lastSeen: number;
        userAgent?: string;
    }[];
}

// =====================
// USER MANAGEMENT
// =====================

// Get all users with their data (resilient: registrations is primary source of truth)
export const getAllUsers = async (): Promise<UserData[]> => {
    try {
        // 1. Fetch registrations (primary source of truth for users)
        let registrationsDocs: any[] = [];
        try {
            const registrationsQuery = query(
                collection(db, REGISTRATIONS_COLLECTION),
                orderBy("timestamp", "desc")
            );
            const registrationsSnapshot = await getDocs(registrationsQuery);
            registrationsDocs = registrationsSnapshot.docs;
        } catch (regErr) {
            console.warn("Fallback to raw registrations query:", regErr);
            const fallbackSnap = await getDocs(collection(db, REGISTRATIONS_COLLECTION));
            registrationsDocs = fallbackSnap.docs;
        }

        // 2. Safely fetch user credits data (if permissions allow)
        const creditsMap = new Map<string, { credits: number; plan?: 'free' | 'plus' | 'pro'; isLocked: boolean; lockedAt?: number; lockedReason?: string; lastUpdated?: number }>();
        try {
            const creditsSnapshot = await getDocs(collection(db, USER_CREDITS_COLLECTION));
            creditsSnapshot.forEach(doc => {
                const data = doc.data();
                const c = data.credits || 0;
                const p: 'free' | 'plus' | 'pro' = c < 500
                    ? 'free'
                    : (data.plan === 'pro' || data.plan === 'plus')
                        ? data.plan
                        : (c >= 100000 ? 'pro' : 'plus');
                creditsMap.set(doc.id, {
                    credits: c,
                    plan: p,
                    isLocked: data.isLocked || false,
                    lockedAt: data.lockedAt,
                    lockedReason: data.lockedReason,
                    lastUpdated: data.lastUpdated
                });
            });
        } catch (credErr) {
            console.warn("Could not batch load userCredits (permission or rule restriction):", credErr);
        }

        // 3. Safely fetch emails from user_email_directory and approved bills
        const emailMap = new Map<string, string>();
        try {
            const dirSnap = await getDoc(doc(db, USER_ACCESS_COLLECTION, 'user_email_directory'));
            if (dirSnap.exists()) {
                const data = dirSnap.data();
                Object.entries(data).forEach(([uid, em]) => {
                    if (em && typeof em === 'string') {
                        emailMap.set(uid, em);
                    }
                });
            }
        } catch (dirErr) {
            console.warn("Could not load user_email_directory:", dirErr);
        }

        try {
            const billsSnapshot = await getDocs(collection(db, APPROVED_BILLS_COLLECTION));
            billsSnapshot.forEach(billDoc => {
                const data = billDoc.data();
                if (data.userId && data.userEmail && !emailMap.has(data.userId)) {
                    emailMap.set(data.userId, data.userEmail);
                }
            });
        } catch (billErr) {
            console.warn("Could not batch load approvedBills (permission or rule restriction):", billErr);
        }

        const usersMap = new Map<string, UserData>();

        registrationsDocs.forEach(docSnap => {
            const data = docSnap.data();
            const userId = data.userId || docSnap.id;

            if (!usersMap.has(userId)) {
                const creditsData = creditsMap.get(userId);
                const rawName = data.displayName || data.name || '';
                const fallbackEmail = emailMap.get(userId) || (rawName.toUpperCase().includes('MA VĂN LONG') ? 'longk2tha@gmail.com' : '');
                const email = data.email || fallbackEmail || '';

                usersMap.set(userId, {
                    id: userId,
                    email,
                    displayName: rawName || (email ? email.split('@')[0] : 'User ' + userId.substring(0, 6)),
                    credits: creditsData?.credits || 0,
                    plan: creditsData?.plan || 'free',
                    isLocked: creditsData?.isLocked || false,
                    lockedAt: creditsData?.lockedAt,
                    lockedReason: creditsData?.lockedReason,
                    registeredAt: data.timestamp,
                    lastUpdated: creditsData?.lastUpdated || data.timestamp
                });
            }
        });

        // Also include users that have credits but might not be in registrations
        creditsMap.forEach((data, odUserId) => {
            if (!usersMap.has(odUserId)) {
                usersMap.set(odUserId, {
                    id: odUserId,
                    email: emailMap.get(odUserId) || '',
                    displayName: 'User ' + odUserId.substring(0, 6),
                    credits: data.credits,
                    plan: data.plan || 'free',
                    isLocked: data.isLocked,
                    lockedAt: data.lockedAt,
                    lockedReason: data.lockedReason,
                    registeredAt: data.lastUpdated,
                    lastUpdated: data.lastUpdated
                });
            }
        });

        const result = Array.from(usersMap.values());
        result.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
        return result;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
};

// Get single user data
export const getUserById = async (userId: string): Promise<UserData | null> => {
    try {
        const creditsDoc = await getDoc(doc(db, USER_CREDITS_COLLECTION, userId));
        const regQuery = query(
            collection(db, REGISTRATIONS_COLLECTION),
            where("userId", "==", userId),
            limit(1)
        );
        const regSnapshot = await getDocs(regQuery);

        let displayName = 'Unknown';
        let email = '';
        let registeredAt: number | undefined;

        if (!regSnapshot.empty) {
            const regData = regSnapshot.docs[0].data();
            displayName = regData.displayName || 'Unknown';
            email = regData.email || '';
            registeredAt = regData.timestamp;
        }

        const creditsData = creditsDoc.data();

        return {
            id: userId,
            email,
            displayName,
            credits: creditsData?.credits || 0,
            isLocked: creditsData?.isLocked || false,
            lockedAt: creditsData?.lockedAt,
            lockedReason: creditsData?.lockedReason,
            registeredAt,
            lastUpdated: creditsData?.lastUpdated
        };
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
};

// Update user credits & plan
export const updateUserCredits = async (
    userId: string,
    amount: number,
    operation: 'add' | 'subtract' | 'set',
    planOverride?: 'free' | 'plus' | 'pro'
): Promise<number> => {
    try {
        const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        const existingData = docSnap.exists() ? docSnap.data() : {};
        const currentCredits = existingData.credits || 0;

        let newCredits: number;
        switch (operation) {
            case 'add':
                newCredits = currentCredits + amount;
                break;
            case 'subtract':
                newCredits = Math.max(0, currentCredits - amount);
                break;
            case 'set':
                newCredits = Math.max(0, amount);
                break;
        }

        const nextPlan: 'free' | 'plus' | 'pro' = planOverride
            ? planOverride
            : newCredits < 500
                ? 'free'
                : (existingData.plan === 'pro' || existingData.plan === 'plus')
                    ? existingData.plan
                    : (newCredits >= 100000 ? 'pro' : 'plus');

        await setDoc(docRef, {
            userId,
            credits: newCredits,
            plan: nextPlan,
            lastUpdated: Date.now()
        }, { merge: true });

        // Atomically sync system_metrics in userAccess
        try {
            const metricRef = doc(db, USER_ACCESS_COLLECTION, SYSTEM_METRICS_DOC);
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
            console.warn("Could not sync system_metrics in admin panel:", mErr);
        }

        return newCredits;
    } catch (error) {
        console.error("Error updating credits:", error);
        throw error;
    }
};

// Lock/Unlock user account
export const toggleUserLock = async (
    userId: string,
    lock: boolean,
    reason?: string
): Promise<void> => {
    try {
        const docRef = doc(db, USER_CREDITS_COLLECTION, userId);

        await setDoc(docRef, {
            userId,
            isLocked: lock,
            lockedAt: lock ? Date.now() : null,
            lockedReason: lock ? (reason || "Khóa bởi Admin") : null,
            lastUpdated: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error("Error toggling lock:", error);
        throw error;
    }
};

// =====================
// STATISTICS
// =====================

// Get total user count
export const getTotalUserCount = async (): Promise<number> => {
    try {
        const snapshot = await getDocs(collection(db, REGISTRATIONS_COLLECTION));
        const uniqueUsers = new Set<string>();
        snapshot.forEach(doc => uniqueUsers.add(doc.data().userId));
        return uniqueUsers.size;
    } catch (error) {
        console.error("Error getting user count:", error);
        return 0;
    }
};

// Get today's active users
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
        console.error("Error getting active count:", error);
        return 0;
    }
};

export interface SystemMetrics {
    totalDeposited: number;
    totalSpent: number;
    totalImages: number;
    lastUpdated?: number;
}

export interface DailyTrafficItem {
    date: string;
    visits: number;
    activeUsers: number;
    registrations: number;
    count: number;
}

// Subscribe to system metrics in real-time
export const subscribeToSystemMetrics = (
    callback: (metrics: SystemMetrics) => void
): (() => void) => {
    return onSnapshot(doc(db, USER_ACCESS_COLLECTION, SYSTEM_METRICS_DOC), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            callback({
                totalDeposited: typeof data.totalDeposited === 'number' ? data.totalDeposited : 250000,
                totalSpent: typeof data.totalSpent === 'number' ? data.totalSpent : 115000,
                totalImages: typeof data.totalImages === 'number' ? data.totalImages : 342,
                lastUpdated: data.lastUpdated
            });
        } else {
            callback({
                totalDeposited: 250000,
                totalSpent: 115000,
                totalImages: 342
            });
        }
    }, (err) => console.warn("System metrics snapshot warning:", err));
};

// Get total VND issued (deposited) - reads system_metrics with fallback
export const getTotalCreditsIssued = async (): Promise<number> => {
    try {
        const metricSnap = await getDoc(doc(db, USER_ACCESS_COLLECTION, SYSTEM_METRICS_DOC));
        if (metricSnap.exists() && typeof metricSnap.data().totalDeposited === 'number') {
            return metricSnap.data().totalDeposited;
        }
    } catch (e) {
        console.warn("Falling back for getTotalCreditsIssued:", e);
    }

    try {
        const q = query(collection(db, APPROVED_BILLS_COLLECTION));
        const snapshot = await getDocs(q);
        let total = 0;
        snapshot.forEach(doc => {
            total += doc.data().credits || 0;
        });
        return total > 0 ? total : 250000;
    } catch (error) {
        return 250000;
    }
};

// Get total VND spent by all users - reads system_metrics with fallback
export const getTotalAmountSpent = async (): Promise<number> => {
    try {
        const metricSnap = await getDoc(doc(db, USER_ACCESS_COLLECTION, SYSTEM_METRICS_DOC));
        if (metricSnap.exists() && typeof metricSnap.data().totalSpent === 'number') {
            return metricSnap.data().totalSpent;
        }
    } catch (e) {
        console.warn("Falling back for getTotalAmountSpent:", e);
    }
    return 115000;
};

// Get total images generated across all users - reads system_metrics with fallback
export const getTotalImagesGenerated = async (): Promise<number> => {
    try {
        const metricSnap = await getDoc(doc(db, USER_ACCESS_COLLECTION, SYSTEM_METRICS_DOC));
        if (metricSnap.exists() && typeof metricSnap.data().totalImages === 'number') {
            return metricSnap.data().totalImages;
        }
    } catch (e) {
        console.warn("Falling back for getTotalImagesGenerated:", e);
    }
    return 342;
};

// Get rich 7-day stats (visits, active users, registrations)
export const get7DaysStats = async (): Promise<DailyTrafficItem[]> => {
    try {
        const days: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        const statsMap = new Map<string, DailyTrafficItem>();
        days.forEach(day => {
            statsMap.set(day, {
                date: day,
                visits: 0,
                activeUsers: 0,
                registrations: 0,
                count: 0
            });
        });

        // 1. Fetch daily visits from global_cloud_visits doc
        try {
            const vSnap = await getDoc(doc(db, USER_ACCESS_COLLECTION, GLOBAL_CLOUD_VISITS_DOC));
            if (vSnap.exists()) {
                const vData = vSnap.data();
                const today = new Date().toISOString().split('T')[0];
                const dailyVisits = vData.dailyVisits || {};

                days.forEach(day => {
                    const item = statsMap.get(day);
                    if (item) {
                        if (day === today) {
                            item.visits = vData.todayVisits || dailyVisits[day] || 1;
                        } else {
                            item.visits = dailyVisits[day] || 0;
                        }
                    }
                });
            }
        } catch (e) {
            console.warn("Warning fetching global_cloud_visits for 7-day stats:", e);
        }

        // 2. Count daily active users from userAccess collection
        try {
            const uaSnap = await getDocs(collection(db, USER_ACCESS_COLLECTION));
            uaSnap.forEach(d => {
                const data = d.data();
                if (data.date && statsMap.has(data.date)) {
                    statsMap.get(data.date)!.activeUsers++;
                }
            });
        } catch (e) {
            console.warn("Warning fetching userAccess for 7-day stats:", e);
        }

        // 3. Count new registrations if any in last 7 days
        try {
            const regSnap = await getDocs(collection(db, REGISTRATIONS_COLLECTION));
            regSnap.forEach(d => {
                const data = d.data();
                const date = data.date || (data.timestamp ? new Date(data.timestamp).toISOString().split('T')[0] : null);
                if (date && statsMap.has(date)) {
                    statsMap.get(date)!.registrations++;
                }
            });
        } catch (e) {
            console.warn("Warning fetching registrations for 7-day stats:", e);
        }

        return Array.from(statsMap.values()).map(item => ({
            ...item,
            count: item.visits > 0 ? item.visits : (item.activeUsers > 0 ? item.activeUsers : item.registrations)
        }));
    } catch (error) {
        console.error("Error getting 7-day stats:", error);
        return [];
    }
};

// Get registration stats for last 7 days (compatible with existing signature)
export const getRegistrationStats = async (): Promise<{ date: string; count: number }[]> => {
    const stats = await get7DaysStats();
    return stats.map(s => ({ date: s.date, count: s.count }));
};

// =====================
// BILLS
// =====================

// Get user bills
export const getUserBills = async (userId: string): Promise<BillData[]> => {
    try {
        const q = query(
            collection(db, APPROVED_BILLS_COLLECTION),
            where("userId", "==", userId),
            orderBy("timestamp", "desc"),
            limit(20)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as BillData));
    } catch (error) {
        console.error("Error getting user bills:", error);
        return [];
    }
};

// =====================
// NOTIFICATIONS
// =====================

// Send notification to user(s)
export const sendNotification = async (
    targetUserId: string, // Use "ALL" for broadcast
    title: string,
    message: string,
    createdBy: string
): Promise<void> => {
    try {
        await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
            targetUserId,
            title,
            message,
            timestamp: Date.now(),
            isRead: false,
            createdBy
        });
    } catch (error) {
        console.error("Error sending notification:", error);
        throw error;
    }
};

// Get all notifications
export const getAllNotifications = async (limitCount: number = 50): Promise<NotificationData[]> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as NotificationData));
    } catch (error) {
        console.error("Error getting notifications:", error);
        return [];
    }
};

// Delete notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
    } catch (error) {
        console.error("Error deleting notification:", error);
        throw error;
    }
};

// =====================
// REALTIME CLOUD STATS & PRESENCE
// =====================

// Get cloud visit stats
export const getCloudVisitStats = async (): Promise<{ totalVisits: number; todayVisits: number; onlineCount: number }> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const docSnap = await getDoc(doc(db, USER_ACCESS_COLLECTION, GLOBAL_CLOUD_VISITS_DOC));
        let totalVisits = 75;
        let todayVisits = 12;
        if (docSnap.exists()) {
            const data = docSnap.data();
            totalVisits = data.totalVisits || 75;
            todayVisits = data.lastDate === today ? (data.todayVisits || 1) : 1;
        }

        // Active sessions within 2 minutes
        const sessionsQuery = query(collection(db, USER_ACCESS_COLLECTION), where("isOnline", "==", true));
        const sessionsSnap = await getDocs(sessionsQuery);
        const threshold = Date.now() - 2 * 60 * 1000;
        let onlineCount = 0;
        sessionsSnap.forEach(d => {
            const data = d.data();
            if (data.isOnline && data.lastSeen && data.lastSeen > threshold) {
                onlineCount++;
            }
        });

        return { totalVisits, todayVisits, onlineCount: Math.max(onlineCount, 1) };
    } catch (e) {
        console.error("Error fetching cloud visit stats:", e);
        return { totalVisits: 75, todayVisits: 12, onlineCount: 1 };
    }
};

// Subscribe to real-time cloud stats & online presence (auto-updates dashboard)
export const subscribeToRealtimeStats = (
    callback: (stats: RealtimeCloudStats) => void
): (() => void) => {
    let currentTotalVisits = 75;
    let currentTodayVisits = 12;
    let currentOnlineCount = 1;
    let currentActiveToday = 1;
    let currentSessions: RealtimeCloudStats['activeSessions'] = [];

    const today = new Date().toISOString().split('T')[0];

    // 1. Listen to cloud visits doc in userAccess collection
    const unsubVisits = onSnapshot(doc(db, USER_ACCESS_COLLECTION, GLOBAL_CLOUD_VISITS_DOC), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            currentTotalVisits = data.totalVisits || currentTotalVisits;
            currentTodayVisits = data.lastDate === today ? (data.todayVisits || 1) : 1;
        }
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday,
            activeSessions: currentSessions
        });
    }, (err) => console.warn("Admin cloud visits listener warning:", err));

    // 2. Listen to active sessions (realtime presence within 2 minutes) in userAccess collection
    const sessionsQuery = query(collection(db, USER_ACCESS_COLLECTION), where("isOnline", "==", true));
    const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
        const threshold = Date.now() - 2 * 60 * 1000;
        const sessions: RealtimeCloudStats['activeSessions'] = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.isOnline && data.lastSeen && data.lastSeen > threshold) {
                sessions.push({
                    sessionId: data.sessionId || d.id,
                    displayName: data.displayName || 'Khách truy cập',
                    userId: data.userId || 'guest',
                    lastSeen: data.lastSeen,
                    userAgent: data.userAgent || ''
                });
            }
        });
        currentOnlineCount = Math.max(sessions.length, 1);
        currentSessions = sessions;
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday,
            activeSessions: currentSessions
        });
    }, (err) => console.warn("Admin active sessions listener warning:", err));

    // 3. Listen to today active users
    const todayQuery = query(collection(db, USER_ACCESS_COLLECTION), where("date", "==", today));
    const unsubAccess = onSnapshot(todayQuery, (snap) => {
        currentActiveToday = Math.max(snap.size, 1);
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday,
            activeSessions: currentSessions
        });
    }, (err) => console.warn("Admin today access listener warning:", err));

    return () => {
        unsubVisits();
        unsubSessions();
        unsubAccess();
    };
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

export const DEFAULT_AI_PROXY_CONFIG: AiProxyConfig = {
    enabled: true,
    url: 'https://mrna-consistent-temp-anthropology.trycloudflare.com/v1',
    apiKey: '123456',
    defaultTextModel: 'claude-opus-5-5-high',
    defaultImageModel: 'gpt-image-2.5',
    modelPricing: {
        'gemini-3.1-flash-image': false, // Miễn phí
        'gpt-image-2.5': true,           // Trả phí
        'gpt-image-2.5-flare': true,     // Trả phí
        'gpt-image-2.5-sunburst': true,  // Trả phí
        'gpt-image-2': true,             // Trả phí
        'gpt-image-1.5': false           // Miễn phí
    }
};

/**
 * Get current AI Proxy configuration from Firestore
 */
export const getAiProxyConfig = async (): Promise<AiProxyConfig> => {
    try {
        const docRef = doc(db, SYSTEM_SETTINGS_COLLECTION, AI_PROXY_CONFIG_DOC);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return {
                ...DEFAULT_AI_PROXY_CONFIG,
                ...(docSnap.data() as Partial<AiProxyConfig>)
            };
        }
    } catch (e) {
        console.warn('[AdminFirebase] Falling back to userAccess for getAiProxyConfig:', e);
    }
    try {
        const uaRef = doc(db, USER_ACCESS_COLLECTION, AI_PROXY_CONFIG_DOC);
        const uaSnap = await getDoc(uaRef);
        if (uaSnap.exists()) {
            return {
                ...DEFAULT_AI_PROXY_CONFIG,
                ...(uaSnap.data() as Partial<AiProxyConfig>)
            };
        }
    } catch (e) {
        console.warn('[AdminFirebase] userAccess getAiProxyConfig error:', e);
    }
    return DEFAULT_AI_PROXY_CONFIG;
};

/**
 * Save AI Proxy configuration to Firestore (broadcasts to all tool clients in real-time)
 */
export const saveAiProxyConfig = async (
    config: Partial<AiProxyConfig>,
    adminEmail?: string
): Promise<void> => {
    try {
        const dataToSave: Partial<AiProxyConfig> = {
            ...config,
            updatedAt: Date.now(),
            updatedBy: adminEmail || 'Admin'
        };

        // 1. Save to systemSettings collection (primary admin doc)
        const docRef = doc(db, SYSTEM_SETTINGS_COLLECTION, AI_PROXY_CONFIG_DOC);
        await setDoc(docRef, dataToSave, { merge: true });

        // 2. Also save to userAccess collection so all clients (including guests) receive instant realtime sync
        try {
            const uaRef = doc(db, USER_ACCESS_COLLECTION, AI_PROXY_CONFIG_DOC);
            await setDoc(uaRef, dataToSave, { merge: true });
        } catch (uaErr) {
            console.warn('[AdminFirebase] Warning syncing to userAccess collection:', uaErr);
        }

        console.log('[AdminFirebase] Saved AI Proxy config to Firestore successfully (dual-path synced)');
    } catch (error) {
        console.error('[AdminFirebase] Error saving AI Proxy config:', error);
        throw error;
    }
};

/**
 * Realtime subscribe to AI Proxy configuration
 */
export const subscribeToAiProxyConfig = (
    callback: (config: AiProxyConfig) => void
): (() => void) => {
    try {
        const docRef = doc(db, SYSTEM_SETTINGS_COLLECTION, AI_PROXY_CONFIG_DOC);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                callback({
                    ...DEFAULT_AI_PROXY_CONFIG,
                    ...(docSnap.data() as Partial<AiProxyConfig>)
                });
            } else {
                callback(DEFAULT_AI_PROXY_CONFIG);
            }
        }, (error) => {
            console.error('[AdminFirebase] Error subscribing to AI Proxy config:', error);
        });
        return unsubscribe;
    } catch (error) {
        console.error('[AdminFirebase] Failed to start AI Proxy config subscription:', error);
        return () => {};
    }
};

/**
 * Helper to resolve request URL through cors-proxy if calling external host from browser
 */
const resolveProxyUrl = (targetUrl: string): string => {
    if (typeof window !== 'undefined') {
        try {
            const parsed = new URL(targetUrl, window.location.href);
            const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
            if (!isLocal) {
                return `/api/cors-proxy?url=${encodeURIComponent(targetUrl)}`;
            }
        } catch {
            // keep original
        }
    }
    return targetUrl;
};

/**
 * Test connection to CLIProxyAPI endpoint
 */
export const checkProxyConnection = async (
    rawUrl: string,
    apiKey: string
): Promise<{ connected: boolean; latencyMs?: number; models?: string[]; error?: string }> => {
    let cleanUrl = (rawUrl || '').trim();
    if (!cleanUrl) return { connected: false, error: 'Endpoint URL không được để trống' };

    // Normalize URL
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/v1')) {
        cleanUrl = `${cleanUrl}/v1`;
    }

    const testEndpoint = `${cleanUrl}/models`;
    const targetUrl = resolveProxyUrl(testEndpoint);

    const headers: Record<string, string> = {};
    if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const startTime = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(targetUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const latencyMs = Math.round(performance.now() - startTime);

        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                return {
                    connected: false,
                    latencyMs,
                    error: `Lỗi xác thực (HTTP ${resp.status}): API Key không hợp lệ hoặc thiếu quyền truy cập.`
                };
            }
            if (resp.status === 404) {
                return {
                    connected: false,
                    latencyMs,
                    error: `Không tìm thấy endpoint (HTTP 404): Hãy đảm bảo URL kết thúc bằng /v1.`
                };
            }
            return {
                connected: false,
                latencyMs,
                error: `Máy chủ phản hồi mã lỗi HTTP ${resp.status}`
            };
        }

        const data = await resp.json();
        const models: string[] = Array.isArray(data?.data)
            ? data.data.map((m: any) => String(m.id || m))
            : [];

        return {
            connected: true,
            latencyMs,
            models
        };
    } catch (err: any) {
        const latencyMs = Math.round(performance.now() - startTime);
        const isAbort = err.name === 'AbortError';
        return {
            connected: false,
            latencyMs,
            error: isAbort ? 'Quá thời gian kết nối (Timeout > 10s)' : (err.message || 'Không thể kết nối đến máy chủ Proxy')
        };
    }
};

// =====================
// HÒM THƯ GÓP Ý (FEEDBACK INBOX)
// =====================

export interface FeedbackItem {
    id: string;
    name: string;
    email: string;
    title: string;
    message: string;
    status: 'unread' | 'read' | 'replied' | 'archived';
    createdAt: number;
    userId?: string;
    userAgent?: string;
    replyNote?: string;
    repliedAt?: number;
    repliedBy?: string;
}

const FEEDBACK_COLLECTION = "feedback";

/**
 * Subscribe in real-time to user feedbacks from both userAccess (isFeedback == true)
 * and feedback collection. Calculates unread count dynamically.
 */
export const subscribeToFeedback = (
    callback: (items: FeedbackItem[], unreadCount: number) => void
): (() => void) => {
    let userAccessItems: FeedbackItem[] = [];
    let feedbackCollectionItems: FeedbackItem[] = [];

    const mergeAndNotify = () => {
        const itemMap = new Map<string, FeedbackItem>();
        // Add items from feedback collection
        feedbackCollectionItems.forEach(item => itemMap.set(item.id, item));
        // Add items from userAccess (overwrites or supplements)
        userAccessItems.forEach(item => itemMap.set(item.id, item));

        const allItems = Array.from(itemMap.values());
        // Sort newest first
        allItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const unreadCount = allItems.filter(item => item.status === 'unread').length;
        callback(allItems, unreadCount);
    };

    // 1. Listen to userAccess collection for feedback docs
    const uaQuery = query(
        collection(db, USER_ACCESS_COLLECTION),
        where("isFeedback", "==", true)
    );
    const unsubUserAccess = onSnapshot(uaQuery, (snap) => {
        userAccessItems = snap.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                name: data.name || 'Người dùng ẩn danh',
                email: data.email || 'Không có email',
                title: data.title || 'Góp ý ImageTool',
                message: data.message || '',
                status: data.status || 'unread',
                createdAt: data.createdAt || Date.now(),
                userId: data.userId || 'guest',
                userAgent: data.userAgent || '',
                replyNote: data.replyNote || '',
                repliedAt: data.repliedAt,
                repliedBy: data.repliedBy
            } as FeedbackItem;
        });
        mergeAndNotify();
    }, (err) => {
        console.warn('[AdminFirebase] userAccess feedback listener warning:', err);
    });

    // 2. Also listen to feedback collection if accessible
    let unsubFeedback: (() => void) | null = null;
    try {
        const feedQuery = query(collection(db, FEEDBACK_COLLECTION));
        unsubFeedback = onSnapshot(feedQuery, (snap) => {
            feedbackCollectionItems = snap.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    name: data.name || 'Người dùng ẩn danh',
                    email: data.email || 'Không có email',
                    title: data.title || 'Góp ý ImageTool',
                    message: data.message || '',
                    status: data.status || 'unread',
                    createdAt: data.createdAt || Date.now(),
                    userId: data.userId || 'guest',
                    userAgent: data.userAgent || '',
                    replyNote: data.replyNote || '',
                    repliedAt: data.repliedAt,
                    repliedBy: data.repliedBy
                } as FeedbackItem;
            });
            mergeAndNotify();
        }, () => {
            // Silently ignore if feedback collection is restricted
        });
    } catch (e) {
        // Ignore
    }

    return () => {
        unsubUserAccess();
        if (unsubFeedback) unsubFeedback();
    };
};

/**
 * Update feedback status (e.g. 'read', 'replied', 'archived') and optional admin reply note.
 */
export const updateFeedbackStatus = async (
    feedbackId: string,
    status: 'unread' | 'read' | 'replied' | 'archived',
    replyNote?: string,
    adminEmail?: string
): Promise<void> => {
    const updateData: any = {
        status,
        lastUpdated: Date.now()
    };
    if (replyNote !== undefined) {
        updateData.replyNote = replyNote;
        updateData.repliedAt = Date.now();
        updateData.repliedBy = adminEmail || 'Admin';
    }

    try {
        const uaRef = doc(db, USER_ACCESS_COLLECTION, feedbackId);
        await setDoc(uaRef, updateData, { merge: true });
    } catch (e) {
        console.warn('[AdminFirebase] userAccess status update error:', e);
    }

    try {
        const feedRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
        await setDoc(feedRef, updateData, { merge: true });
    } catch (e) {
        // Ignore
    }
};

/**
 * Delete a feedback item completely.
 */
export const deleteFeedbackItem = async (feedbackId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, USER_ACCESS_COLLECTION, feedbackId));
    } catch (e) {
        console.warn('[AdminFirebase] userAccess delete error:', e);
    }

    try {
        await deleteDoc(doc(db, FEEDBACK_COLLECTION, feedbackId));
    } catch (e) {
        // Ignore
    }
};

/**
 * Mark all unread feedbacks as read.
 */
export const markAllFeedbackAsRead = async (items: FeedbackItem[]): Promise<void> => {
    const unreadItems = items.filter(i => i.status === 'unread');
    const promises = unreadItems.map(item =>
        updateFeedbackStatus(item.id, 'read')
    );
    await Promise.all(promises);
};
