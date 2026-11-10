import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';

export type VideoProviderType = 'openrouter' | 'idea_ai' | 'vivix_ai';

export interface VideoModelMetadata {
    id: string;
    provider: VideoProviderType;
    providerLabel: string;
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
 * Danh sách các Mô hình Video AI trên Vivix Chính chủ, Idea.ai & OpenRouter
 * Hỗ trợ đầy đủ cả 3 tỷ lệ 9:16, 16:9, 1:1 và cho phép tạo từ ảnh chân dung người thật
 */
export const OPENROUTER_VIDEO_MODELS: VideoModelMetadata[] = [
    {
        id: 'vivix.ai/vivix-w1',
        provider: 'vivix_ai',
        providerLabel: 'Vivix Chính chủ',
        name: 'Vivix W1 real',
        shortName: 'Vivix W1 real',
        badge: 'Chính chủ',
        badgeColor: 'indigo',
        description: 'Chạy thẳng qua máy chủ chính chủ Vivix (api.vivix.ai), hỗ trợ I2V & T2V, đủ tỷ lệ 9:16 / 16:9 / 1:1 (5s–15s).',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [5, 10, 15],
        defaultResolution: '720p',
        supportsAudio: false,
        costPerSecondVnd: 100,
        baseInputFeeVnd: 0,
        priceLabel: '~500đ (5s) • ~1.000đ (10s)'
    },
    {
        id: 'idea.ai/vivix_w1',
        provider: 'idea_ai',
        providerLabel: 'idea.ai',
        name: 'Vivix W1 T',
        shortName: 'Vivix W1 T',
        badge: '260 Coins',
        badgeColor: 'violet',
        description: 'Chạy qua idea.ai, hỗ trợ cả Ảnh sang Video (I2V) & Văn bản (T2V), đủ tỷ lệ 9:16 / 16:9 / 1:1 (5s–15s).',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [5, 10, 15],
        defaultResolution: '720p',
        supportsAudio: false,
        costPerSecondVnd: 400,
        baseInputFeeVnd: 0,
        priceLabel: '~2.000đ (5s) • ~4.000đ (10s)'
    },
    {
        id: 'x-ai/grok-imagine-video-1.5-lite',
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        name: 'Grok video',
        shortName: 'Grok video',
        badge: '~510đ/s',
        badgeColor: 'emerald',
        description: 'Tốc độ nhanh qua OpenRouter, hỗ trợ đủ 9:16 / 16:9 / 1:1 và thời lượng 3s–15s.',
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
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        name: 'Wan 3.0',
        shortName: 'Wan 3.0',
        badge: 'Có Audio',
        badgeColor: 'amber',
        description: 'Tối ưu khuôn mặt Á Đông, tích hợp âm thanh gốc sống động, hỗ trợ 3s–15s.',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedDurations: [3, 5, 10, 15],
        defaultResolution: '480p',
        supportsAudio: true,
        costPerSecondVnd: 1400, // $0.05/s + 10% markup
        baseInputFeeVnd: 0,
        priceLabel: '~4.200đ (3s) • ~7.000đ (5s)'
    }
];

export const getVideoModelMeta = (modelId?: string): VideoModelMetadata => {
    if (!modelId || modelId === 'auto') {
        return OPENROUTER_VIDEO_MODELS[0];
    }
    return OPENROUTER_VIDEO_MODELS.find(m => m.id === modelId) || OPENROUTER_VIDEO_MODELS[0];
};

/**
 * Kiểm tra xem nhà cung cấp (Vivix, OpenRouter hoặc idea.ai) của một model có đang được bật trên Admin hay không
 */
export const isVideoModelProviderEnabled = (
    modelId: string,
    config: OpenRouterVideoConfig
): boolean => {
    if (config.enabled === false) return false;
    const meta = getVideoModelMeta(modelId);
    if (meta.provider === 'vivix_ai') {
        return config.vivixAiEnabled !== false;
    }
    if (meta.provider === 'idea_ai') {
        return config.ideaAiEnabled !== false;
    }
    return config.openRouterEnabled !== false;
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
    vivixAiEnabled: boolean;      // Bật/tắt model Vivix W1 real (chính chủ)
    vivixAiApiKey: string;        // API Key từ platform.vivix.ai
    vivixModelVariant?: 'vivix-w1' | 'vivix-w1-fast' | 'vivix-w1-ultrafast';
    openRouterEnabled: boolean;   // Bật/tắt các model thuộc OpenRouter
    openRouterApiKey: string;     // sk-or-v1-...
    ideaAiEnabled: boolean;       // Bật/tắt các model thuộc idea.ai (Vivix W1 T)
    ideaAiApiKey: string;         // cfak_...
    primaryModel: string;         // 'vivix.ai/vivix-w1' | 'idea.ai/vivix_w1' | 'x-ai/grok-imagine-video-1.5-lite'
    fallbackModel: string;        // 'idea.ai/vivix_w1' | 'x-ai/grok-imagine-video-1.5-lite' | 'alibaba/wan-3.0'
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
    vivixAiEnabled: true,
    vivixAiApiKey: '',
    vivixModelVariant: 'vivix-w1',
    openRouterEnabled: true,
    openRouterApiKey: '',
    ideaAiEnabled: true,
    ideaAiApiKey: '',
    primaryModel: 'vivix.ai/vivix-w1',
    fallbackModel: 'idea.ai/vivix_w1',
    pricePerVideoVnd: 2000,
    costPerVideoVnd: 1785,
    profitMarkupPercent: 10,
    defaultDuration: 5,
    defaultAspectRatio: '16:9'
};

/**
 * Chuẩn hóa model ID và trạng thái bật/tắt provider từ Firestore
 */
const sanitizeVideoConfig = (raw: Partial<OpenRouterVideoConfig>): OpenRouterVideoConfig => {
    const merged: OpenRouterVideoConfig = {
        ...DEFAULT_VIDEO_CONFIG,
        ...raw,
        vivixAiEnabled: raw.vivixAiEnabled !== undefined ? Boolean(raw.vivixAiEnabled) : true,
        vivixAiApiKey: raw.vivixAiApiKey || '',
        vivixModelVariant: (raw.vivixModelVariant === 'vivix-w1-fast' || raw.vivixModelVariant === 'vivix-w1-ultrafast') ? raw.vivixModelVariant : 'vivix-w1',
        openRouterEnabled: raw.openRouterEnabled !== undefined ? Boolean(raw.openRouterEnabled) : true,
        ideaAiEnabled: raw.ideaAiEnabled !== undefined ? Boolean(raw.ideaAiEnabled) : true,
        openRouterApiKey: raw.openRouterApiKey || '',
        ideaAiApiKey: raw.ideaAiApiKey || ''
    };
    const validModelIds = OPENROUTER_VIDEO_MODELS.map(m => m.id);
    if (!merged.primaryModel || !validModelIds.includes(merged.primaryModel)) {
        merged.primaryModel = DEFAULT_VIDEO_CONFIG.primaryModel;
    }
    if (!merged.fallbackModel || !validModelIds.includes(merged.fallbackModel)) {
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
 * Lấy cấu hình Video AI hiện tại (từ cache realtime hoặc fetch Firestore)
 */
export const getVideoConfig = async (): Promise<OpenRouterVideoConfig> => {
    if (isInitialized && (cachedConfig.openRouterApiKey || cachedConfig.ideaAiApiKey)) {
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
