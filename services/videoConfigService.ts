import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';

export interface VideoModelMetadata {
    id: string;
    name: string;
    shortName: string;
    badge: string;
    badgeColor: 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose';
    description: string;
    supportedAspectRatios: ('16:9' | '9:16' | '1:1')[];
    supportedDurations: number[];
    defaultResolution: '480p' | '720p' | '768p' | '1080p';
    supportsAudio: boolean;
    costPerSecondVnd: number;
    baseInputFeeVnd: number;
    priceLabel: string;
}

/**
 * Danh sách 5 Mô hình Video AI tốt nhất & rẻ nhất trên OpenRouter
 * Hỗ trợ cả 3 tỷ lệ 9:16, 16:9, 1:1 và cho phép tạo từ ảnh chân dung người thật (first_frame)
 */
export const OPENROUTER_VIDEO_MODELS: VideoModelMetadata[] = [
    {
        id: 'x-ai/grok-imagine-video-1.5-lite',
        name: 'xAI: Grok Video 1.5 Lite',
        shortName: 'Grok 1.5 Lite',
        badge: 'Rẻ số 1 • ~510đ/s',
        badgeColor: 'emerald',
        description: 'Tốc độ nhanh, hỗ trợ đủ 9:16 / 16:9 / 1:1 và thời lượng 3s–15s, không chặn mặt người.',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [3, 5, 10, 15],
        defaultResolution: '480p',
        supportsAudio: false,
        costPerSecondVnd: 560, // $0.02/s + 10% markup
        baseInputFeeVnd: 280,  // $0.01/image + 10% markup
        priceLabel: '~2.000đ (3s) • ~3.100đ (5s)'
    },
    {
        id: 'alibaba/wan-3.0',
        name: 'Alibaba: Wan 3.0 (Có Âm Thanh)',
        shortName: 'Alibaba Wan 3.0',
        badge: 'Có Audio • ~1.275đ/s',
        badgeColor: 'amber',
        description: 'Tối ưu khuôn mặt và trang phục Á Đông, tích hợp âm thanh gốc sống động, hỗ trợ 3s–15s.',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [3, 5, 10, 15],
        defaultResolution: '480p',
        supportsAudio: true,
        costPerSecondVnd: 1400, // $0.05/s + 10% markup
        baseInputFeeVnd: 0,
        priceLabel: '~4.200đ (3s) • ~7.000đ (5s)'
    },
    {
        id: 'minimax/hailuo-3-max',
        name: 'MiniMax: Hailuo 3 Max',
        shortName: 'Hailuo 3 Max',
        badge: 'Điện ảnh • ~1.275đ/s',
        badgeColor: 'indigo',
        description: 'Chuyển động cơ thể và biểu cảm tự nhiên mượt mà (Yêu cầu thời lượng tối thiểu từ 5s trở lên).',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [5, 10, 15], // Không hỗ trợ 3s -> Khóa nút 3s trên UI
        defaultResolution: '480p',
        supportsAudio: false,
        costPerSecondVnd: 1400, // $0.05/s + 10% markup
        baseInputFeeVnd: 0,
        priceLabel: '~7.000đ (5s) • Tối thiểu 5s'
    },
    {
        id: 'x-ai/grok-imagine-video',
        name: 'xAI: Grok Video 1.0 (Bản Chuẩn)',
        shortName: 'Grok 1.0 Chuẩn',
        badge: 'Sắc nét • ~1.275đ/s',
        badgeColor: 'violet',
        description: 'Bản tiêu chuẩn giữ chi tiết gương mặt và trang phục sắc nét cao, hỗ trợ 3s–15s.',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [3, 5, 10, 15],
        defaultResolution: '480p',
        supportsAudio: false,
        costPerSecondVnd: 1400, // $0.05/s + 10% markup
        baseInputFeeVnd: 60,
        priceLabel: '~4.300đ (3s) • ~7.100đ (5s)'
    },
    {
        id: 'kwaivgi/kling-v3.0-std',
        name: 'Kuaishou: Kling v3.0 Standard',
        shortName: 'Kling v3.0 Std',
        badge: 'Cao cấp HD • ~2.140đ/s',
        badgeColor: 'rose',
        description: 'Đỉnh cao chuyển động người thật chuẩn 720p HD, hỗ trợ mọi tỷ lệ 9:16 / 16:9 / 1:1 và 3s–15s.',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [3, 5, 10, 15],
        defaultResolution: '720p',
        supportsAudio: false,
        costPerSecondVnd: 2350, // $0.084/s + 10% markup
        baseInputFeeVnd: 0,
        priceLabel: '~7.100đ (3s) • ~11.800đ (5s)'
    }
];

export const getVideoModelMeta = (modelId?: string): VideoModelMetadata => {
    if (!modelId || modelId === 'auto') {
        return OPENROUTER_VIDEO_MODELS[0];
    }
    return OPENROUTER_VIDEO_MODELS.find(m => m.id === modelId) || OPENROUTER_VIDEO_MODELS[0];
};

/**
 * Tính toán giá 1 video (VNĐ, làm tròn đến hàng trăm đồng) dựa theo Model và Thời lượng (giây)
 */
export const calculateVideoPriceVnd = (modelId: string | undefined, durationSeconds: number): number => {
    const meta = getVideoModelMeta(modelId);
    const validDuration = meta.supportedDurations.includes(durationSeconds)
        ? durationSeconds
        : meta.supportedDurations[0];
    const rawTotal = meta.baseInputFeeVnd + meta.costPerSecondVnd * validDuration;
    return Math.ceil(rawTotal / 100) * 100;
};

export interface OpenRouterVideoConfig {
    enabled: boolean;
    openRouterApiKey: string;
    primaryModel: string;         // 'x-ai/grok-imagine-video-1.5-lite'
    fallbackModel: string;        // 'alibaba/wan-3.0'
    pricePerVideoVnd: number;     // Giá mặc định tham chiếu
    costPerVideoVnd: number;
    profitMarkupPercent: number;  // Tỷ lệ lợi nhuận (+10%)
    defaultDuration: number;      // 3, 5, 10, hoặc 15s
    defaultAspectRatio: '16:9' | '9:16' | '1:1';
    updatedAt?: number;
    updatedBy?: string;
}

export const DEFAULT_VIDEO_CONFIG: OpenRouterVideoConfig = {
    enabled: true,
    openRouterApiKey: '',
    primaryModel: 'x-ai/grok-imagine-video-1.5-lite',
    fallbackModel: 'alibaba/wan-3.0',
    pricePerVideoVnd: 2000,
    costPerVideoVnd: 1785,
    profitMarkupPercent: 10,
    defaultDuration: 5,
    defaultAspectRatio: '16:9'
};

/**
 * Chuẩn hóa model ID từ Firestore: tự động thay thế model gemini-omni cũ (bị chặn mặt người) sang Grok 1.5 Lite / Wan 3.0
 */
const sanitizeVideoConfig = (raw: Partial<OpenRouterVideoConfig>): OpenRouterVideoConfig => {
    const merged: OpenRouterVideoConfig = {
        ...DEFAULT_VIDEO_CONFIG,
        ...raw
    };
    if (!merged.primaryModel || merged.primaryModel.includes('gemini-omni')) {
        merged.primaryModel = DEFAULT_VIDEO_CONFIG.primaryModel;
    }
    if (!merged.fallbackModel || merged.fallbackModel.includes('gemini-omni')) {
        merged.fallbackModel = DEFAULT_VIDEO_CONFIG.fallbackModel;
    }
    return merged;
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
            cachedConfig = sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
            isInitialized = true;
            return cachedConfig;
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được appConfig/videoConfig, thử fallback:', err);
    }

    try {
        const snap = await getDoc(doc(db, FALLBACK_COLLECTION, FALLBACK_DOC));
        if (snap.exists()) {
            cachedConfig = sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
            isInitialized = true;
            return cachedConfig;
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được systemSettings/videoAiConfig:', err);
    }

    try {
        const snap = await getDoc(doc(db, BACKUP_COLLECTION, BACKUP_DOC));
        if (snap.exists()) {
            cachedConfig = sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
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
                    cachedConfig = sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
                    isInitialized = true;
                    callback(cachedConfig);
                } else {
                    callback(DEFAULT_VIDEO_CONFIG);
                }
            },
            (error) => {
                console.warn('[VideoConfig Client] Lỗi lắng nghe appConfig/videoConfig:', error);
                try {
                    const fallbackUnsub = onSnapshot(doc(db, BACKUP_COLLECTION, BACKUP_DOC), (fSnap) => {
                        if (fSnap.exists()) {
                            cachedConfig = sanitizeVideoConfig(fSnap.data() as Partial<OpenRouterVideoConfig>);
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
