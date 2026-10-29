/**
 * clothingTemplateService.ts for AdminPanel
 * Service để quản lý thư viện trang phục trong Firestore
 */

import { db } from '../firebaseConfig';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    where
} from 'firebase/firestore';

// --- TYPES ---
export interface ClothingTemplate {
    id: string;
    name: string;
    category: 'vest' | 'ao_dai' | 'so_mi' | 'quan_phuc' | 'other';
    gender: 'male' | 'female' | 'unisex';
    imageBase64: string;
    thumbnailBase64?: string;
    description?: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
}

export type ClothingCategory = ClothingTemplate['category'];
export type ClothingGender = ClothingTemplate['gender'];

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
    vest: 'Vest / Suit',
    ao_dai: 'Áo dài',
    so_mi: 'Sơ mi',
    quan_phuc: 'Quân phục / Đồng phục',
    other: 'Khác'
};

export const GENDER_LABELS: Record<ClothingGender, string> = {
    male: 'Nam',
    female: 'Nữ',
    unisex: 'Unisex'
};

const COLLECTION_NAME = 'clothing_templates';
const getCollectionRef = () => collection(db, COLLECTION_NAME);

export const getActiveTemplates = async (): Promise<ClothingTemplate[]> => {
    try {
        const q = query(
            getCollectionRef(),
            where('isActive', '==', true),
            orderBy('sortOrder', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClothingTemplate));
    } catch (error) {
        console.error('[ClothingService] Error:', error);
        return [];
    }
};

export const getAllTemplates = async (): Promise<ClothingTemplate[]> => {
    try {
        const q = query(getCollectionRef(), orderBy('sortOrder', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClothingTemplate));
    } catch (error) {
        console.error('[ClothingService] Error:', error);
        return [];
    }
};

export const getTemplateById = async (id: string): Promise<ClothingTemplate | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as ClothingTemplate;
        }
        return null;
    } catch (error) {
        console.error('[ClothingService] Error:', error);
        return null;
    }
};

export const saveTemplate = async (template: Omit<ClothingTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> => {
    try {
        const now = Date.now();
        const id = template.id || `clothing_${now}`;
        const docRef = doc(db, COLLECTION_NAME, id);

        const existingDoc = await getDoc(docRef);
        const data: ClothingTemplate = {
            ...template,
            id,
            createdAt: existingDoc.exists() ? existingDoc.data().createdAt : now,
            updatedAt: now
        };

        await setDoc(docRef, data);
        return id;
    } catch (error) {
        console.error('[ClothingService] Error:', error);
        throw error;
    }
};

export const deleteTemplate = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};

export const toggleTemplateActive = async (id: string, isActive: boolean): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await setDoc(docRef, { isActive, updatedAt: Date.now() }, { merge: true });
};

export const compressImage = (base64: string, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Cannot get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            const base64Data = compressed.split(',')[1] || compressed;
            resolve(base64Data);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    });
};

export const createThumbnail = async (base64: string, size: number = 250): Promise<string> => {
    return compressImage(base64, size, 0.7);
};

export const getBase64SizeKB = (base64: string): number => {
    const bytes = (base64.length * 3) / 4;
    return Math.round(bytes / 1024);
};
