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

const SYSTEM_STATS_COLLECTION = "systemStats";
const CLOUD_VISITS_DOC = "cloudVisits";
const DAILY_VISITS_COLLECTION = "dailyVisits";
const ACTIVE_SESSIONS_COLLECTION = "activeSessions";
const REGISTRATIONS_COLLECTION = "registrations";
const USER_ACCESS_COLLECTION = "userAccess";

export interface CloudStats {
    totalVisits: number;
    todayVisits: number;
    onlineCount: number;
    activeToday: number;
}

// Record a cloud visit (tracks both total visits and daily visits with automatic date rollover)
export const recordCloudVisit = async (): Promise<void> => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const visitRef = doc(db, SYSTEM_STATS_COLLECTION, CLOUD_VISITS_DOC);
        const dailyRef = doc(db, DAILY_VISITS_COLLECTION, today);

        // Limit counting to 1 per tab/session per 15 minutes to prevent spam on quick refreshes
        const lastRecorded = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cloud_visit_recorded') : null;
        const now = Date.now();
        if (lastRecorded && now - parseInt(lastRecorded) < 15 * 60 * 1000) {
            return;
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('cloud_visit_recorded', now.toString());
        }

        const visitDoc = await getDoc(visitRef);
        if (!visitDoc.exists()) {
            await setDoc(visitRef, {
                totalVisits: 1,
                todayVisits: 1,
                lastDate: today,
                updatedAt: now
            });
        } else {
            const data = visitDoc.data();
            const isNewDay = data.lastDate !== today;
            await setDoc(visitRef, {
                totalVisits: increment(1),
                todayVisits: isNewDay ? 1 : increment(1),
                lastDate: today,
                updatedAt: now
            }, { merge: true });
        }

        // Record in dailyVisits collection for historic analytics
        await setDoc(dailyRef, {
            date: today,
            visits: increment(1),
            lastVisit: now
        }, { merge: true });
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

        const sessionRef = doc(db, ACTIVE_SESSIONS_COLLECTION, currentSessionId);
        const updateHeartbeat = async () => {
            try {
                await setDoc(sessionRef, {
                    sessionId: currentSessionId,
                    userId: userId || 'guest',
                    displayName: displayName || 'Khách truy cập',
                    lastSeen: Date.now(),
                    isOnline: true,
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 80) : ''
                }, { merge: true });
            } catch (e) {
                // Ignore silent heartbeat errors
            }
        };

        // Immediate update
        updateHeartbeat();

        // Update every 40 seconds
        if (presenceInterval) clearInterval(presenceInterval);
        presenceInterval = setInterval(updateHeartbeat, 40000);

        // Cleanup on window unload
        const handleUnload = () => {
            try {
                deleteDoc(sessionRef);
            } catch (e) {}
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', handleUnload);
        }

        return () => {
            if (presenceInterval) clearInterval(presenceInterval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('beforeunload', handleUnload);
            }
            try {
                deleteDoc(sessionRef);
            } catch (e) {}
        };
    } catch (e) {
        console.error("Error in presence heartbeat:", e);
        return () => {};
    }
};

// Subscribe to Realtime Cloud Stats (Visits + Online Presence)
export const subscribeToCloudStats = (callback: (stats: CloudStats) => void): (() => void) => {
    let currentTotalVisits = 0;
    let currentTodayVisits = 0;
    let currentOnlineCount = 1;
    let currentActiveToday = 0;

    const today = new Date().toISOString().split('T')[0];

    // 1. Listen to cloud visits doc
    const visitRef = doc(db, SYSTEM_STATS_COLLECTION, CLOUD_VISITS_DOC);
    const unsubVisits = onSnapshot(visitRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            currentTotalVisits = data.totalVisits || 0;
            currentTodayVisits = data.lastDate === today ? (data.todayVisits || 0) : 0;
        }
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday
        });
    }, (err) => console.warn("Cloud visits listener warning:", err));

    // 2. Listen to active sessions (last 2 minutes) for real-time online count
    const sessionsRef = collection(db, ACTIVE_SESSIONS_COLLECTION);
    const unsubSessions = onSnapshot(sessionsRef, (snap) => {
        const threshold = Date.now() - 2 * 60 * 1000; // active in last 2 minutes
        let online = 0;
        snap.forEach(d => {
            const data = d.data();
            if (data.isOnline && data.lastSeen && data.lastSeen > threshold) {
                online++;
            }
        });
        currentOnlineCount = Math.max(online, 1); // at least current user
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday
        });
    }, (err) => console.warn("Active sessions listener warning:", err));

    // 3. Listen to today active users
    const todayAccessQuery = query(collection(db, USER_ACCESS_COLLECTION), where("date", "==", today));
    const unsubAccess = onSnapshot(todayAccessQuery, (snap) => {
        currentActiveToday = snap.size;
        callback({
            totalVisits: currentTotalVisits,
            todayVisits: currentTodayVisits,
            onlineCount: currentOnlineCount,
            activeToday: currentActiveToday
        });
    }, (err) => console.warn("Today access listener warning:", err));

    return () => {
        unsubVisits();
        unsubSessions();
        unsubAccess();
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

// Subscribe to realtime registration updates
export const subscribeToRegistrations = (
    callback: (registrations: { displayName: string, timestamp: number }[]) => void,
    limitCount: number = 5
) => {
    const q = query(
        collection(db, REGISTRATIONS_COLLECTION),
        orderBy("timestamp", "desc"),
        limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
        const registrations = snapshot.docs.map(doc => ({
            displayName: doc.data().displayName,
            timestamp: doc.data().timestamp
        }));
        callback(registrations);
    });
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

// --- Credits Management Services ---

const USER_CREDITS_COLLECTION = "userCredits";
const APPROVED_BILLS_COLLECTION = "approvedBills";
const FAILED_BILLS_COLLECTION = "failedBills";

// Credits per amount (VND)
export const CREDITS_PRICING = {
    10000: 100,   // 5 images
    20000: 200,   // 10 images
    50000: 500,   // 25 images
    100000: 1000, // 50 images
};

export const CREDITS_PER_IMAGE = 20;

// Bill verification info
export const BANK_INFO = {
    bankName: 'VietinBank',
    accountHolder: 'MA VAN LONG',
    accountNumber: '103882289985',
    supportPhone: '0342.733.640'
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
export const updateUserCredits = async (userId: string, amount: number, operation: 'add' | 'subtract'): Promise<number> => {
    try {
        const currentCredits = await getUserCredits(userId);
        const newCredits = operation === 'add'
            ? currentCredits + amount
            : Math.max(0, currentCredits - amount);

        // Add timeout to prevent hanging
        await Promise.race([
            setDoc(doc(db, USER_CREDITS_COLLECTION, userId), {
                userId,
                credits: newCredits,
                lastUpdated: Date.now()
            }, { merge: true }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Firestore update timeout (15s)')), 15000)
            )
        ]);

        return newCredits;
    } catch (error) {
        console.error("Error updating user credits:", error);
        throw error;
    }
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

// Subscribe to user credits updates (realtime)
export const subscribeToUserCredits = (userId: string, callback: (credits: number) => void) => {
    const docRef = doc(db, USER_CREDITS_COLLECTION, userId);

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().credits || 0);
        } else {
            callback(0);
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
    updatedAt?: number;
    updatedBy?: string;
}

const SYSTEM_SETTINGS_COLLECTION = "systemSettings";
const AI_PROXY_CONFIG_DOC = "aiProxyConfig";

/**
 * Subscribe to AI Proxy Configuration updates from Firestore.
 * When the Admin updates the Endpoint, API Key, or ON/OFF switch in Admin Panel,
 * all clients receive the updated settings immediately.
 */
export const subscribeToAiProxyConfig = (callback: (config: AiProxyConfig) => void): (() => void) => {
    try {
        const configRef = doc(db, SYSTEM_SETTINGS_COLLECTION, AI_PROXY_CONFIG_DOC);
        return onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as AiProxyConfig;
                callback(data);
            }
        }, (err) => {
            console.warn('[CloudConfig] Warning subscribing to AI proxy config:', err);
        });
    } catch (e) {
        console.error('[CloudConfig] Error subscribing to AI proxy config:', e);
        return () => {};
    }
};
