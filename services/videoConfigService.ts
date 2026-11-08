import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';

export interface OpenRouterVideoConfig {
    enabled: boolean;
    openRouterApiKey: string;
    primaryModel: string;         // 'google/gemini-omni-1.2-flash'
    fallbackModel: string;        // 'google/gemini-omni-1.1-flash'
    pricePerVideoVnd: number;     // Giá bán trên ImageTool (+10% lợi nhuận, vd: 700đ)
    costPerVideoVnd: number;      // Giá gốc OpenRouter (~450đ - 600đ)
    profitMarkupPercent: number;  // Tỷ lệ lợi nhuận (+10%)
    defaultDuration: number;      // 5, 10, hoặc 15s
    defaultAspectRatio: '16:9' | '9:16' | '1:1';
    updatedAt?: number;
    updatedBy?: string;
}

export const DEFAULT_VIDEO_CONFIG: OpenRouterVideoConfig = {
    enabled: true,
    openRouterApiKey: '',
    primaryModel: 'google/gemini-omni-1.2-flash',
    fallbackModel: 'google/gemini-omni-1.1-flash',
    pricePerVideoVnd: 700,
    costPerVideoVnd: 600,
    profitMarkupPercent: 10,
    defaultDuration: 5,
    defaultAspectRatio: '16:9'
};

const PRIMARY_COLLECTION = 'appConfig';
const PRIMARY_DOC = 'videoConfig';
const FALLBACK_COLLECTION = 'systemSettings';
const FALLBACK_DOC = 'videoAiConfig';
const BACKUP_COLLECTION = 'userAccess';
const BACKUP_DOC = 'videoConfig';

let cachedConfig: OpenRouterVideoConfig = { ...DEFAULT_VIDEO_CONFIG };
let isInitialized = false;

/**
 * Lấy cấu hình OpenRouter Video hiện tại (từ cache realtime hoặc fetch Firestore)
 */
export const getVideoConfig = async (): Promise<OpenRouterVideoConfig> => {
    if (isInitialized && cachedConfig.openRouterApiKey) {
        return cachedConfig;
    }

    try {
        const snap = await getDoc(doc(db, PRIMARY_COLLECTION, PRIMARY_DOC));
        if (snap.exists()) {
            cachedConfig = {
                ...DEFAULT_VIDEO_CONFIG,
                ...(snap.data() as Partial<OpenRouterVideoConfig>)
            };
            isInitialized = true;
            return cachedConfig;
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được appConfig/videoConfig, thử fallback:', err);
    }

    try {
        const snap = await getDoc(doc(db, FALLBACK_COLLECTION, FALLBACK_DOC));
        if (snap.exists()) {
            cachedConfig = {
                ...DEFAULT_VIDEO_CONFIG,
                ...(snap.data() as Partial<OpenRouterVideoConfig>)
            };
            isInitialized = true;
            return cachedConfig;
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được systemSettings/videoAiConfig:', err);
    }

    try {
        const snap = await getDoc(doc(db, BACKUP_COLLECTION, BACKUP_DOC));
        if (snap.exists()) {
            cachedConfig = {
                ...DEFAULT_VIDEO_CONFIG,
                ...(snap.data() as Partial<OpenRouterVideoConfig>)
            };
            isInitialized = true;
            return cachedConfig;
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được userAccess/videoConfig:', err);
    }

    return cachedConfig;
};

/**
 * Lấy cấu hình tức thời từ cache bộ nhớ
 */
export const getCachedVideoConfig = (): OpenRouterVideoConfig => {
    return cachedConfig;
};

/**
 * Lắng nghe thay đổi thời gian thực cấu hình Video từ Admin Panel
 */
export const subscribeToVideoConfig = (
    callback: (config: OpenRouterVideoConfig) => void
): (() => void) => {
    try {
        const unsubscribe = onSnapshot(
            doc(db, PRIMARY_COLLECTION, PRIMARY_DOC),
            (snap) => {
                if (snap.exists()) {
                    cachedConfig = {
                        ...DEFAULT_VIDEO_CONFIG,
                        ...(snap.data() as Partial<OpenRouterVideoConfig>)
                    };
                    isInitialized = true;
                    callback(cachedConfig);
                } else {
                    callback(DEFAULT_VIDEO_CONFIG);
                }
            },
            (error) => {
                console.warn('[VideoConfig Client] Lỗi lắng nghe appConfig/videoConfig:', error);
                // Fallback listener to userAccess
                try {
                    const fallbackUnsub = onSnapshot(doc(db, BACKUP_COLLECTION, BACKUP_DOC), (fSnap) => {
                        if (fSnap.exists()) {
                            cachedConfig = {
                                ...DEFAULT_VIDEO_CONFIG,
                                ...(fSnap.data() as Partial<OpenRouterVideoConfig>)
                            };
                            isInitialized = true;
                            callback(cachedConfig);
                        }
                    });
                    return fallbackUnsub;
                } catch {
                    // Ignore
                }
            }
        );
        return unsubscribe;
    } catch (error) {
        console.error('[VideoConfig Client] Không thể khởi tạo subscription:', error);
        return () => {};
    }
};
