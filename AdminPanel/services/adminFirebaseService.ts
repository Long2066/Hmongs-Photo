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
const SYSTEM_STATS_COLLECTION = "systemStats";
const CLOUD_VISITS_DOC = "cloudVisits";
const ACTIVE_SESSIONS_COLLECTION = "activeSessions";

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
        const docSnap = await getDoc(doc(db, SYSTEM_STATS_COLLECTION, CLOUD_VISITS_DOC));
        let totalVisits = 0;
        let todayVisits = 0;
        if (docSnap.exists()) {
            const data = docSnap.data();
            totalVisits = data.totalVisits || 0;
            todayVisits = data.lastDate === today ? (data.todayVisits || 0) : 0;
        }

        // Active sessions within 2 minutes
        const sessionsSnap = await getDocs(collection(db, ACTIVE_SESSIONS_COLLECTION));
        const threshold = Date.now() - 2 * 60 * 1000;
        let onlineCount = 0;
        sessionsSnap.forEach(d => {
            const data = d.data();
            if (data.isOnline && data.lastSeen && data.lastSeen > threshold) {
                onlineCount++;
            }
        });

        return { totalVisits, todayVisits, onlineCount };
    } catch (e) {
        console.error("Error fetching cloud visit stats:", e);
        return { totalVisits: 0, todayVisits: 0, onlineCount: 0 };
    }
};

// Subscribe to real-time cloud stats & online presence (auto-updates dashboard)
export const subscribeToRealtimeStats = (
    callback: (stats: RealtimeCloudStats) => void
): (() => void) => {
    let currentTotalVisits = 0;
    let currentTodayVisits = 0;
    let currentOnlineCount = 0;
    let currentActiveToday = 0;
    let currentSessions: RealtimeCloudStats['activeSessions'] = [];

    const today = new Date().toISOString().split('T')[0];

    // 1. Listen to cloud visits doc
    const unsubVisits = onSnapshot(doc(db, SYSTEM_STATS_COLLECTION, CLOUD_VISITS_DOC), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            currentTotalVisits = data.totalVisits || 0;
            currentTodayVisits = data.lastDate === today ? (data.todayVisits || 0) : 0;
        }
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday,
            activeSessions: currentSessions
        });
    }, (err) => console.warn("Admin cloud visits listener warning:", err));

    // 2. Listen to active sessions (realtime presence within 2 minutes)
    const unsubSessions = onSnapshot(collection(db, ACTIVE_SESSIONS_COLLECTION), (snap) => {
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
        currentOnlineCount = sessions.length;
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
        currentActiveToday = snap.size;
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
