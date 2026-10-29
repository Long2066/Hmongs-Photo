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
    where
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Collection names
const USER_CREDITS_COLLECTION = "userCredits";
const REGISTRATIONS_COLLECTION = "registrations";
const USER_ACCESS_COLLECTION = "userAccess";
const APPROVED_BILLS_COLLECTION = "approvedBills";
const NOTIFICATIONS_COLLECTION = "notifications";
const HISTORY_COLLECTION = "history"; // User image generation history

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

// =====================
// USER MANAGEMENT
// =====================

// Get all users with their data
export const getAllUsers = async (): Promise<UserData[]> => {
    try {
        // Get all user credits data
        const creditsSnapshot = await getDocs(collection(db, USER_CREDITS_COLLECTION));
        const creditsMap = new Map<string, { credits: number; isLocked: boolean; lockedAt?: number; lockedReason?: string; lastUpdated?: number }>();

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

        // Get all registrations
        const registrationsQuery = query(
            collection(db, REGISTRATIONS_COLLECTION),
            orderBy("timestamp", "desc")
        );
        const registrationsSnapshot = await getDocs(registrationsQuery);

        // Get emails from approved bills
        const billsSnapshot = await getDocs(collection(db, APPROVED_BILLS_COLLECTION));
        const emailMap = new Map<string, string>();
        billsSnapshot.forEach(billDoc => {
            const data = billDoc.data();
            if (data.userId && data.userEmail) {
                emailMap.set(data.userId, data.userEmail);
            }
        });

        const usersMap = new Map<string, UserData>();

        registrationsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const userId = data.userId;

            if (!usersMap.has(userId)) {
                const creditsData = creditsMap.get(userId);
                usersMap.set(userId, {
                    id: userId,
                    email: emailMap.get(userId) || data.email || '',
                    displayName: data.displayName || 'Unknown',
                    credits: creditsData?.credits || 0,
                    isLocked: creditsData?.isLocked || false,
                    lockedAt: creditsData?.lockedAt,
                    lockedReason: creditsData?.lockedReason,
                    registeredAt: data.timestamp,
                    lastUpdated: creditsData?.lastUpdated
                });
            }
        });

        // Also include users that have credits but might not be in registrations
        creditsMap.forEach((data, odUserId) => {
            if (!usersMap.has(odUserId)) {
                usersMap.set(odUserId, {
                    id: odUserId,
                    email: emailMap.get(odUserId) || '',
                    displayName: 'Unknown User',
                    credits: data.credits,
                    isLocked: data.isLocked,
                    lockedAt: data.lockedAt,
                    lockedReason: data.lockedReason,
                    lastUpdated: data.lastUpdated
                });
            }
        });

        return Array.from(usersMap.values());
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
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
