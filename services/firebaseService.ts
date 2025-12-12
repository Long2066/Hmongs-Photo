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
    orderBy,
    deleteDoc,
    doc,
    limit
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

// --- Firestore History Services ---

const HISTORY_COLLECTION = "history";

export const saveHistoryToFirestore = async (userId: string, item: HistoryItem): Promise<void> => {
    try {
        await addDoc(collection(db, HISTORY_COLLECTION), {
            ...item,
            userId: userId,
            timestamp: Date.now() // Ensure server-side consistent timestamp if needed, but client is ok for now
        });
    } catch (error) {
        console.error("Error saving history to Firestore:", error);
        throw error;
    }
};

export const getHistoryFromFirestore = async (userId: string): Promise<HistoryItem[]> => {
    try {
        const q = query(
            collection(db, HISTORY_COLLECTION),
            where("userId", "==", userId),
            orderBy("timestamp", "desc"),
            limit(50) // Limit to last 50 items to prevent overload
        );

        const querySnapshot = await getDocs(q);
        const history: HistoryItem[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Map Firestore data back to HistoryItem
            history.push({
                id: doc.id, // Use Firestore doc ID
                prompt: data.prompt,
                aspectRatio: data.aspectRatio,
                resolution: data.resolution,
                shotType: data.shotType,
                style: data.style,
                images: data.images,
                timestamp: data.timestamp
            });
        });

        return history;
    } catch (error) {
        console.error("Error fetching history from Firestore:", error);
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

        // Batch delete would be better for many items, but simple loop is okay for now
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error clearing history:", error);
        throw error;
    }
};
