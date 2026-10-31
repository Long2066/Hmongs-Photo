// Admin Firebase Service
// CRUD operations for user management

import {
    collection,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    doc,
    query,
    orderBy,
    limit,
    where,
    onSnapshot
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Collection names
const USER_CREDITS_COLLECTION = "userCredits";
const REGISTRATIONS_COLLECTION = "registrations";
const USER_ACCESS_COLLECTION = "userAccess";
const APPROVED_BILLS_COLLECTION = "approvedBills";
const NOTIFICATIONS_COLLECTION = "notifications";
const HISTORY_COLLECTION = "history"; // User image generation history
const GLOBAL_CLOUD_VISITS_DOC = "global_cloud_visits";

// Types
export interface UserData {
    id: string;
    email?: string;
    displayName: string;
    credits: number; // Now represents VND balance
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
        const creditsMap = new Map<string, { credits: number; isLocked: boolean; lockedAt?: number; lockedReason?: string; lastUpdated?: number }>();
        try {
            const creditsSnapshot = await getDocs(collection(db, USER_CREDITS_COLLECTION));
            creditsSnapshot.forEach(doc => {
                const data = doc.data();
                creditsMap.set(doc.id, {
                    credits: data.credits || 0,
                    isLocked: data.isLocked || false,
                    lockedAt: data.lockedAt,
                    lockedReason: data.lockedReason,
                    lastUpdated: data.lastUpdated
                });
            });
        } catch (credErr) {
            console.warn("Could not batch load userCredits (permission or rule restriction):", credErr);
        }

        // 3. Safely fetch emails from approved bills
        const emailMap = new Map<string, string>();
        try {
            const billsSnapshot = await getDocs(collection(db, APPROVED_BILLS_COLLECTION));
            billsSnapshot.forEach(billDoc => {
                const data = billDoc.data();
                if (data.userId && data.userEmail) {
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
                usersMap.set(userId, {
                    id: userId,
                    email: data.email || emailMap.get(userId) || '',
                    displayName: data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'User ' + userId.substring(0, 6)),
                    credits: creditsData?.credits || 0,
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

// Update user credits
export const updateUserCredits = async (
    userId: string,
    amount: number,
    operation: 'add' | 'subtract' | 'set'
): Promise<number> => {
    try {
        const docRef = doc(db, USER_CREDITS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        const currentCredits = docSnap.exists() ? (docSnap.data().credits || 0) : 0;

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

        await setDoc(docRef, {
            userId,
            credits: newCredits,
            lastUpdated: Date.now()
        }, { merge: true });

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

// Get total VND issued (deposited)
export const getTotalCreditsIssued = async (): Promise<number> => {
    try {
        const q = query(collection(db, APPROVED_BILLS_COLLECTION));
        const snapshot = await getDocs(q);
        let total = 0;
        snapshot.forEach(doc => {
            total += doc.data().credits || 0; // credits field now stores VND
        });
        return total;
    } catch (error) {
        console.error("Error getting total VND deposited:", error);
        return 0;
    }
};

// Get total VND spent by all users
export const getTotalAmountSpent = async (): Promise<number> => {
    try {
        // Sum up total issued minus current balances
        const creditsSnapshot = await getDocs(collection(db, USER_CREDITS_COLLECTION));
        const billsSnapshot = await getDocs(collection(db, APPROVED_BILLS_COLLECTION));

        let totalIssued = 0;
        let totalRemaining = 0;

        billsSnapshot.forEach(doc => {
            totalIssued += doc.data().credits || 0;
        });

        creditsSnapshot.forEach(doc => {
            totalRemaining += doc.data().credits || 0;
        });

        return Math.max(0, totalIssued - totalRemaining);
    } catch (error) {
        console.error("Error getting total spent:", error);
        return 0;
    }
};

// Get total images generated across all users
export const getTotalImagesGenerated = async (): Promise<number> => {
    try {
        // Get all user history collections
        const creditsSnapshot = await getDocs(collection(db, USER_CREDITS_COLLECTION));
        let totalImages = 0;

        // For each user, count their history items
        const promises: Promise<void>[] = [];

        creditsSnapshot.forEach(userDoc => {
            const userId = userDoc.id;
            const promise = (async () => {
                try {
                    const historyRef = collection(db, HISTORY_COLLECTION);
                    const q = query(historyRef, where("userId", "==", userId));
                    const historySnap = await getDocs(q);

                    historySnap.forEach(histDoc => {
                        const data = histDoc.data();
                        // Count images array length in each history item
                        if (data.images && Array.isArray(data.images)) {
                            totalImages += data.images.length;
                        }
                    });
                } catch (e) {
                    // Silently skip on error
                }
            })();
            promises.push(promise);
        });

        await Promise.all(promises);
        return totalImages;
    } catch (error) {
        console.error("Error getting total images:", error);
        return 0;
    }
};

// Get registration stats for last 7 days
export const getRegistrationStats = async (): Promise<{ date: string; count: number }[]> => {
    try {
        const stats: Map<string, number> = new Map();

        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            stats.set(date.toISOString().split('T')[0], 0);
        }

        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const q = query(
            collection(db, REGISTRATIONS_COLLECTION),
            where("timestamp", ">=", sevenDaysAgo),
            orderBy("timestamp", "desc")
        );

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date || new Date(data.timestamp).toISOString().split('T')[0];
            const current = stats.get(date) || 0;
            stats.set(date, current + 1);
        });

        return Array.from(stats.entries()).map(([date, count]) => ({ date, count }));
    } catch (error) {
        console.error("Error getting registration stats:", error);
        return [];
    }
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
    updatedAt?: number;
    updatedBy?: string;
}

const SYSTEM_SETTINGS_COLLECTION = "systemSettings";
const AI_PROXY_CONFIG_DOC = "aiProxyConfig";

export const DEFAULT_AI_PROXY_CONFIG: AiProxyConfig = {
    enabled: true,
    url: 'http://158.178.235.87:20128/v1',
    apiKey: '',
    defaultTextModel: 'claude-opus-5-5-high',
    defaultImageModel: 'gpt-image-2.5',
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
        return DEFAULT_AI_PROXY_CONFIG;
    } catch (error) {
        console.error('[AdminFirebase] Error fetching AI Proxy config:', error);
        return DEFAULT_AI_PROXY_CONFIG;
    }
};

/**
 * Save AI Proxy configuration to Firestore (broadcasts to all tool clients in real-time)
 */
export const saveAiProxyConfig = async (
    config: Partial<AiProxyConfig>,
    adminEmail?: string
): Promise<void> => {
    try {
        const docRef = doc(db, SYSTEM_SETTINGS_COLLECTION, AI_PROXY_CONFIG_DOC);
        const dataToSave: Partial<AiProxyConfig> = {
            ...config,
            updatedAt: Date.now(),
            updatedBy: adminEmail || 'Admin'
        };
        await setDoc(docRef, dataToSave, { merge: true });
        console.log('[AdminFirebase] Saved AI Proxy config to Firestore successfully');
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
