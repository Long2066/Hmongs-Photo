import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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

/**
 * Lấy cấu hình OpenRouter Video hiện tại từ Firestore (đa tầng dự phòng)
 */
export const getVideoConfig = async (): Promise<OpenRouterVideoConfig> => {
    // 1. Thử đọc từ appConfig/videoConfig
    try {
        const snap = await getDoc(doc(db, PRIMARY_COLLECTION, PRIMARY_DOC));
        if (snap.exists()) {
            return {
                ...DEFAULT_VIDEO_CONFIG,
                ...(snap.data() as Partial<OpenRouterVideoConfig>)
            };
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được appConfig/videoConfig, thử fallback:', err);
    }

    // 2. Thử đọc từ systemSettings/videoAiConfig
    try {
        const snap = await getDoc(doc(db, FALLBACK_COLLECTION, FALLBACK_DOC));
        if (snap.exists()) {
            return {
                ...DEFAULT_VIDEO_CONFIG,
                ...(snap.data() as Partial<OpenRouterVideoConfig>)
            };
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được systemSettings/videoAiConfig:', err);
    }

    // 3. Thử đọc từ userAccess/videoConfig
    try {
        const snap = await getDoc(doc(db, BACKUP_COLLECTION, BACKUP_DOC));
        if (snap.exists()) {
            return {
                ...DEFAULT_VIDEO_CONFIG,
                ...(snap.data() as Partial<OpenRouterVideoConfig>)
            };
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được userAccess/videoConfig:', err);
    }

    return DEFAULT_VIDEO_CONFIG;
};

/**
 * Lưu cấu hình OpenRouter Video vào Firestore (đồng bộ tức thì sang toàn bộ client)
 */
export const saveVideoConfig = async (
    config: Partial<OpenRouterVideoConfig>,
    adminEmail?: string
): Promise<void> => {
    const dataToSave: Partial<OpenRouterVideoConfig> = {
        ...config,
        updatedAt: Date.now(),
        updatedBy: adminEmail || 'Admin'
    };

    let saved = false;

    // 1. Lưu vào appConfig
    try {
        await setDoc(doc(db, PRIMARY_COLLECTION, PRIMARY_DOC), dataToSave, { merge: true });
        saved = true;
    } catch (err) {
        console.warn('[VideoConfig] Lỗi ghi appConfig/videoConfig:', err);
    }

    // 2. Dual-sync sang systemSettings
    try {
        await setDoc(doc(db, FALLBACK_COLLECTION, FALLBACK_DOC), dataToSave, { merge: true });
        saved = true;
    } catch (err) {
        console.warn('[VideoConfig] Lỗi ghi systemSettings/videoAiConfig:', err);
    }

    // 3. Backup sync sang userAccess
    try {
        await setDoc(doc(db, BACKUP_COLLECTION, BACKUP_DOC), dataToSave, { merge: true });
        saved = true;
    } catch (err) {
        console.warn('[VideoConfig] Lỗi ghi userAccess/videoConfig:', err);
    }

    if (!saved) {
        throw new Error('Không thể lưu cấu hình video lên Firestore. Vui lòng kiểm tra quyền Admin.');
    }
};

/**
 * Đăng ký lắng nghe thay đổi thời gian thực cấu hình Video
 */
export const subscribeToVideoConfig = (
    callback: (config: OpenRouterVideoConfig) => void
): (() => void) => {
    try {
        const unsubscribe = onSnapshot(
            doc(db, PRIMARY_COLLECTION, PRIMARY_DOC),
            (snap) => {
                if (snap.exists()) {
                    callback({
                        ...DEFAULT_VIDEO_CONFIG,
                        ...(snap.data() as Partial<OpenRouterVideoConfig>)
                    });
                } else {
                    callback(DEFAULT_VIDEO_CONFIG);
                }
            },
            (error) => {
                console.warn('[VideoConfig] Lỗi lắng nghe appConfig/videoConfig:', error);
                // Fallback listener
                try {
                    const fallbackUnsub = onSnapshot(doc(db, BACKUP_COLLECTION, BACKUP_DOC), (fSnap) => {
                        if (fSnap.exists()) {
                            callback({
                                ...DEFAULT_VIDEO_CONFIG,
                                ...(fSnap.data() as Partial<OpenRouterVideoConfig>)
                            });
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
        console.error('[VideoConfig] Không thể khởi tạo subscription:', error);
        return () => {};
    }
};

/**
 * Kiểm tra kết nối và tính hợp lệ của OpenRouter API Key
 */
export const testOpenRouterApiKey = async (
    apiKey: string
): Promise<{
    valid: boolean;
    label?: string;
    usage?: number;
    limit?: number | null;
    isFreeTier?: boolean;
    rateLimit?: any;
    error?: string;
}> => {
    const key = apiKey.trim();
    if (!key) {
        return { valid: false, error: 'Chưa nhập API Key OpenRouter' };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': 'https://vip-imagetools.vercel.app',
                'X-Title': 'ImageTool Video AI'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await resp.json();

        if (!resp.ok) {
            return {
                valid: false,
                error: data?.error?.message || `Lỗi OpenRouter (HTTP ${resp.status})`
            };
        }

        if (data?.data) {
            return {
                valid: true,
                label: data.data.label || 'Khóa hợp lệ',
                usage: typeof data.data.usage === 'number' ? data.data.usage : 0,
                limit: data.data.limit,
                isFreeTier: Boolean(data.data.is_free_tier),
                rateLimit: data.data.rate_limit
            };
        }

        return { valid: true };
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return { valid: false, error: 'Hết thời gian chờ kết nối (Timeout 12s)' };
        }
        return { valid: false, error: err.message || 'Lỗi mạng khi kiểm tra API Key' };
    }
};
