// Admin Authentication Service
// Only allows specific email/phone to access admin panel

import {
    signInWithEmailAndPassword,
    signOut,
    User as FirebaseUser,
    onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebaseConfig";

// Whitelist of allowed admin credentials
const ADMIN_WHITELIST = {
    emails: ["longk2tha@gmail.com"],
    phones: ["0342733640", "+84342733640"]
};

export interface AdminUser {
    uid: string;
    email: string | null;
    displayName: string | null;
}

// Check if email is in admin whitelist
export const isAdminEmail = (email: string | null): boolean => {
    if (!email) return false;
    return ADMIN_WHITELIST.emails.includes(email.toLowerCase());
};

// Check if phone is in admin whitelist
export const isAdminPhone = (phone: string): boolean => {
    const normalizedPhone = phone.replace(/\D/g, '');
    return ADMIN_WHITELIST.phones.some(p => p.replace(/\D/g, '') === normalizedPhone);
};

// Login admin with email and password
export const loginAdmin = async (email: string, password: string): Promise<AdminUser> => {
    // First check if email is in whitelist
    if (!isAdminEmail(email)) {
        throw new Error("Bạn không có quyền truy cập Admin Panel");
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message.includes("auth/invalid-credential") ||
                error.message.includes("auth/wrong-password")) {
                throw new Error("Email hoặc mật khẩu không đúng");
            }
            if (error.message.includes("auth/user-not-found")) {
                throw new Error("Tài khoản không tồn tại");
            }
            if (error.message.includes("auth/too-many-requests")) {
                throw new Error("Quá nhiều lần thử. Vui lòng thử lại sau");
            }
        }
        throw new Error("Đã xảy ra lỗi khi đăng nhập");
    }
};

// Logout admin
export const logoutAdmin = async (): Promise<void> => {
    await signOut(auth);
};

// Subscribe to auth state changes
export const subscribeToAuthState = (
    callback: (user: AdminUser | null) => void
): (() => void) => {
    return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser && isAdminEmail(firebaseUser.email)) {
            callback({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName
            });
        } else {
            callback(null);
        }
    });
};

// Get current admin user
export const getCurrentAdmin = (): AdminUser | null => {
    const user = auth.currentUser;
    if (user && isAdminEmail(user.email)) {
        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        };
    }
    return null;
};
