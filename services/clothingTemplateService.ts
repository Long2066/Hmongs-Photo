/**
 * clothingTemplateService.ts
 * Service để quản lý thư viện trang phục trong Firestore
 * Ảnh được lưu dưới dạng base64 trực tiếp trong document
 */

import { db } from '../src/firebaseConfig';
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
    name: string;                    // "Vest đen nam"
    category: 'vest' | 'ao_dai' | 'so_mi' | 'quan_phuc' | 'other';
    gender: 'male' | 'female' | 'unisex';
    imageBase64: string;             // Ảnh trang phục (base64)
    thumbnailBase64?: string;        // Thumbnail nhỏ để preview (optional)
    description?: string;            // Mô tả chi tiết
    isActive: boolean;               // Có hiển thị cho user không
    sortOrder: number;               // Thứ tự hiển thị
    createdAt: number;
    updatedAt: number;
}

export type ClothingCategory = ClothingTemplate['category'];
export type ClothingGender = ClothingTemplate['gender'];

// Category labels for UI
export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
    vest: 'Vest / Suit',
    ao_dai: 'Áo dài',
    so_mi: 'Sơ mi',
    quan_phuc: 'Quân phục / Đồng phục',
    other: 'Khác'
};

// Gender labels for UI
export const GENDER_LABELS: Record<ClothingGender, string> = {
    male: 'Nam',
    female: 'Nữ',
    unisex: 'Unisex'
};

// --- COLLECTION REFERENCE ---
const COLLECTION_NAME = 'clothing_templates';
const getCollectionRef = () => collection(db, COLLECTION_NAME);

// --- CRUD OPERATIONS ---

/**
 * Lấy tất cả templates đang active (cho user)
 * Sử dụng client-side filtering để tránh yêu cầu composite index
 */
export const getActiveTemplates = async (): Promise<ClothingTemplate[]> => {
    try {
        console.log('[ClothingService] 🔄 Đang tải templates từ Firestore...');
        console.log('[ClothingService] Collection:', COLLECTION_NAME);

        // Lấy tất cả rồi filter client-side để tránh lỗi index
        const q = query(getCollectionRef());
        const snapshot = await getDocs(q);

        console.log('[ClothingService] 📦 Số documents trong collection:', snapshot.docs.length);

        const allTemplates = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('[ClothingService] Template:', doc.id, '| Active:', data.isActive, '| Gender:', data.gender, '| Name:', data.name);
            return { id: doc.id, ...data } as ClothingTemplate;
        });

        // Filter active và sort client-side
        const activeTemplates = allTemplates
            .filter(t => t.isActive === true)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        console.log('[ClothingService] ✅ Templates active:', activeTemplates.length, '/', allTemplates.length);

        if (activeTemplates.length === 0 && allTemplates.length > 0) {
            console.warn('[ClothingService] ⚠️ Có templates nhưng không có cái nào active! Kiểm tra isActive trong Firestore.');
        }

        if (allTemplates.length === 0) {
            console.warn('[ClothingService] ⚠️ Collection rỗng! Vui lòng thêm templates qua AdminPanel.');
        }

        return activeTemplates;
    } catch (error: any) {
        console.error('[ClothingService] ❌ Lỗi khi tải templates:', error);
        console.error('[ClothingService] Error code:', error?.code);
        console.error('[ClothingService] Error message:', error?.message);

        // Kiểm tra lỗi permission
        if (error?.code === 'permission-denied') {
            console.error('[ClothingService] 🔒 LỖI PERMISSION! Kiểm tra Firestore Rules.');
        }

        return [];
    }
};

/**
 * Lấy tất cả templates (cho admin)
 */
export const getAllTemplates = async (): Promise<ClothingTemplate[]> => {
    try {
        const q = query(getCollectionRef(), orderBy('sortOrder', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClothingTemplate));
    } catch (error) {
        console.error('[ClothingService] Error fetching all templates:', error);
        return [];
    }
};

/**
 * Lấy templates theo category
 */
export const getTemplatesByCategory = async (category: ClothingCategory): Promise<ClothingTemplate[]> => {
    try {
        const q = query(
            getCollectionRef(),
            where('category', '==', category),
            where('isActive', '==', true),
            orderBy('sortOrder', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClothingTemplate));
    } catch (error) {
        console.error('[ClothingService] Error fetching by category:', error);
        return [];
    }
};

/**
 * Lấy templates theo gender
 */
export const getTemplatesByGender = async (gender: ClothingGender): Promise<ClothingTemplate[]> => {
    try {
        const q = query(
            getCollectionRef(),
            where('gender', 'in', [gender, 'unisex']),
            where('isActive', '==', true),
            orderBy('sortOrder', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClothingTemplate));
    } catch (error) {
        console.error('[ClothingService] Error fetching by gender:', error);
        return [];
    }
};

/**
 * Lấy 1 template theo ID
 */
export const getTemplateById = async (id: string): Promise<ClothingTemplate | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as ClothingTemplate;
        }
        return null;
    } catch (error) {
        console.error('[ClothingService] Error fetching template:', error);
        return null;
    }
};

/**
 * Tạo hoặc cập nhật template
 */
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
        console.log('[ClothingService] Template saved:', id);
        return id;
    } catch (error) {
        console.error('[ClothingService] Error saving template:', error);
        throw error;
    }
};

/**
 * Xóa template
 */
export const deleteTemplate = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        console.log('[ClothingService] Template deleted:', id);
    } catch (error) {
        console.error('[ClothingService] Error deleting template:', error);
        throw error;
    }
};

/**
 * Toggle active status
 */
export const toggleTemplateActive = async (id: string, isActive: boolean): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await setDoc(docRef, { isActive, updatedAt: Date.now() }, { merge: true });
        console.log('[ClothingService] Template active toggled:', id, isActive);
    } catch (error) {
        console.error('[ClothingService] Error toggling active:', error);
        throw error;
    }
};

// --- HELPER FUNCTIONS ---

/**
 * Resize và compress ảnh trước khi lưu
 * Giữ chất lượng tốt nhưng giảm dung lượng
 */
export const compressImage = (base64: string, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize nếu quá lớn
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

            // Convert to base64 JPEG
            const compressed = canvas.toDataURL('image/jpeg', quality);
            // Remove data URL prefix
            const base64Data = compressed.split(',')[1] || compressed;
            resolve(base64Data);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    });
};

/**
 * Tạo thumbnail từ ảnh gốc
 */
export const createThumbnail = async (base64: string, size: number = 250): Promise<string> => {
    return compressImage(base64, size, 0.7);
};

/**
 * Tính dung lượng base64 (KB)
 */
export const getBase64SizeKB = (base64: string): number => {
    // Base64 encoding overhead: ~33%
    const bytes = (base64.length * 3) / 4;
    return Math.round(bytes / 1024);
};

export default {
    getActiveTemplates,
    getAllTemplates,
    getTemplatesByCategory,
    getTemplatesByGender,
    getTemplateById,
    saveTemplate,
    deleteTemplate,
    toggleTemplateActive,
    compressImage,
    createThumbnail,
    getBase64SizeKB,
    CATEGORY_LABELS,
    GENDER_LABELS
};
