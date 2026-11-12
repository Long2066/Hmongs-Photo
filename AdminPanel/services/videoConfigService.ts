import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface OpenRouterVideoConfig {
    enabled: boolean;
    vivixAiEnabled: boolean;      // Bật/tắt model Vivix W1 real (Chính chủ)
    vivixAiApiKey: string;        // API Key từ platform.vivix.ai
    vivixModelVariant?: 'vivix-w1' | 'vivix-w1-fast' | 'vivix-w1-ultrafast';
    openRouterEnabled: boolean;   // Bật/tắt cụm model OpenRouter
    openRouterApiKey: string;     // sk-or-v1-...
    ideaAiEnabled: boolean;       // Bật/tắt cụm model idea.ai (Vivix W1 T)
    ideaAiApiKey: string;         // cfak_...
    museAiEnabled?: boolean;      // Bật/tắt Gateway Muse AI (muse2api)
    museAiBaseUrl?: string;       // Endpoint Gateway, mặc định http://127.0.0.1:18610/v1
    museAiApiKey?: string;        // API Key Gateway m2a-...
    primaryModel: string;         // 'vivix.ai/vivix-w1' | 'idea.ai/vivix_w1' | 'x-ai/grok-imagine-video-1.5-lite' | 'muse.ai/muse-video'
    fallbackModel: string;        // 'idea.ai/vivix_w1' | 'x-ai/grok-imagine-video-1.5-lite' | 'alibaba/wan-3.0' | 'muse.ai/muse-video'
    pricePerVideoVnd: number;     // Giá bán trên ImageTool (+10% lợi nhuận, vd: 2000đ)
    costPerVideoVnd: number;      // Giá gốc
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
    museAiEnabled: true,
    museAiBaseUrl: 'http://127.0.0.1:18610/v1',
    museAiApiKey: 'm2a-QLC1SthwZ5ET3IcvOToDVlvql-LwrXGG',
    primaryModel: 'vivix.ai/vivix-w1',
    fallbackModel: 'idea.ai/vivix_w1',
    pricePerVideoVnd: 2000,
    costPerVideoVnd: 1785,
    profitMarkupPercent: 10,
    defaultDuration: 5,
    defaultAspectRatio: '16:9'
};

const VALID_MODEL_IDS = [
    'vivix.ai/vivix-w1',
    'idea.ai/vivix_w1',
    'x-ai/grok-imagine-video-1.5-lite',
    'alibaba/wan-3.0',
    'muse.ai/muse-video'
];

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
        ideaAiApiKey: raw.ideaAiApiKey || '',
        museAiEnabled: raw.museAiEnabled !== undefined ? Boolean(raw.museAiEnabled) : true,
        museAiBaseUrl: raw.museAiBaseUrl || DEFAULT_VIDEO_CONFIG.museAiBaseUrl,
        museAiApiKey: raw.museAiApiKey !== undefined ? raw.museAiApiKey : DEFAULT_VIDEO_CONFIG.museAiApiKey
    };
    if (!merged.primaryModel || !VALID_MODEL_IDS.includes(merged.primaryModel)) {
        merged.primaryModel = DEFAULT_VIDEO_CONFIG.primaryModel;
    }
    if (!merged.fallbackModel || !VALID_MODEL_IDS.includes(merged.fallbackModel)) {
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

/**
 * Lấy cấu hình Video AI hiện tại từ Firestore (đa tầng dự phòng)
 */
export const getVideoConfig = async (): Promise<OpenRouterVideoConfig> => {
    // 1. Thử đọc từ appConfig/videoConfig
    try {
        const snap = await getDoc(doc(db, PRIMARY_COLLECTION, PRIMARY_DOC));
        if (snap.exists()) {
            return sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được appConfig/videoConfig, thử fallback:', err);
    }

    // 2. Thử đọc từ systemSettings/videoAiConfig
    try {
        const snap = await getDoc(doc(db, FALLBACK_COLLECTION, FALLBACK_DOC));
        if (snap.exists()) {
            return sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được systemSettings/videoAiConfig:', err);
    }

    // 3. Thử đọc từ userAccess/videoConfig
    try {
        const snap = await getDoc(doc(db, BACKUP_COLLECTION, BACKUP_DOC));
        if (snap.exists()) {
            return sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>);
        }
    } catch (err) {
        console.warn('[VideoConfig] Không đọc được userAccess/videoConfig:', err);
    }

    return DEFAULT_VIDEO_CONFIG;
};

/**
 * Lưu cấu hình Video AI vào Firestore (đồng bộ tức thì sang toàn bộ client)
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
                    callback(sanitizeVideoConfig(snap.data() as Partial<OpenRouterVideoConfig>));
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
                            callback(sanitizeVideoConfig(fSnap.data() as Partial<OpenRouterVideoConfig>));
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

/**
 * Kiểm tra kết nối và tính hợp lệ của idea.ai API Key (cfak_...) hoàn toàn miễn phí (không tốn Coin)
 * Tự động qua proxy để tránh chặn CORS trên trình duyệt
 */
export const testIdeaAiApiKey = async (
    apiKey: string
): Promise<{
    valid: boolean;
    label?: string;
    error?: string;
}> => {
    const key = apiKey.trim();
    if (!key) {
        return { valid: false, error: 'Chưa nhập API Key idea.ai (cfak_...)' };
    }

    const targetUrl = 'https://studio-media-matrix.creativefabrica.com/creativefabrica.studiomediamatrix.v1.StudioMediaMatrixService/ListSessions';
    const proxyUrl = 'https://vip-imagetools.vercel.app/api/cors-proxy?url=' + encodeURIComponent(targetUrl);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        let resp: Response;
        try {
            resp = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    serviceType: 'SERVICE_TYPE_VIDEO_GENERATOR',
                    pagination: { take: 1 }
                }),
                signal: controller.signal
            });
        } catch (proxyErr) {
            resp = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    serviceType: 'SERVICE_TYPE_VIDEO_GENERATOR',
                    pagination: { take: 1 }
                }),
                signal: controller.signal
            });
        }
        clearTimeout(timeout);

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            return {
                valid: false,
                error: data?.message || data?.error?.message || `Khóa idea.ai không hợp lệ (HTTP ${resp.status})`
            };
        }

        return {
            valid: true,
            label: 'Khóa idea.ai (Vivix W1) hợp lệ và sẵn sàng tạo video!'
        };
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return { valid: false, error: 'Hết thời gian chờ kết nối idea.ai (Timeout 12s)' };
        }
        return { valid: false, error: err.message || 'Lỗi mạng khi kiểm tra API Key idea.ai' };
    }
};

/**
 * Kiểm tra kết nối và tính hợp lệ của Vivix Chính chủ API Key (platform.vivix.ai)
 * Gọi endpoint GET https://api.vivix.ai/v1/models hoàn toàn miễn phí
 */
export const testVivixApiKey = async (
    apiKey: string
): Promise<{
    valid: boolean;
    label?: string;
    models?: string[];
    error?: string;
}> => {
    const key = apiKey.trim();
    if (!key) {
        return { valid: false, error: 'Chưa nhập API Key Vivix Chính chủ' };
    }

    const targetUrl = 'https://api.vivix.ai/v1/models';
    const proxyUrl = 'https://vip-imagetools.vercel.app/api/cors-proxy?url=' + encodeURIComponent(targetUrl);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        let resp: Response;
        try {
            resp = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
        } catch {
            resp = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
        }
        clearTimeout(timeout);

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || data?.code !== 0) {
            return {
                valid: false,
                error: data?.message || `Khóa Vivix không hợp lệ (HTTP ${resp.status})`
            };
        }

        const modelsList = Array.isArray(data?.data?.models)
            ? data.data.models.map((m: any) => {
                const name = m.name || m.id || String(m);
                return m.tag ? `${name}:${m.tag}` : name;
            })
            : [];

        const hasW1 = modelsList.some((m: string) => m.toLowerCase().includes('w1'));

        if (!hasW1) {
            return {
                valid: false,
                label: 'Khóa Vivix hợp lệ nhưng tài khoản chưa mở quyền API Vivix W1',
                error: `Khóa Vivix hợp lệ, nhưng tài khoản này hiện chỉ mở quyền: [${modelsList.join(', ') || 'vivix-a1'}]. Dòng Vivix W1 đang ở chế độ Preview (Limited Availability), cần mua gói W-Pack tại platform.vivix.ai/pricing#W để mở khóa quyền gọi API Vivix W1. Tạm thời bạn hãy bật Nguồn 2 (Vivix W1 T) để dùng!`
            };
        }

        return {
            valid: true,
            label: `Khóa Vivix Chính chủ hợp lệ và ĐÃ MỞ KHÓA API (${modelsList.filter((m: string) => m.includes('w1')).join(', ')})!`,
            models: modelsList
        };
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return { valid: false, error: 'Hết thời gian chờ kết nối Vivix (Timeout 12s)' };
        }
        return { valid: false, error: err.message || 'Lỗi mạng khi kiểm tra API Key Vivix' };
    }
};

/**
 * Kiểm tra kết nối và tính hợp lệ của Muse AI Gateway (muse2api)
 * Gọi endpoint GET {baseUrl}/models và GET {baseUrl}/readyz
 */
export const testMuseApiKey = async (
    rawBaseUrl?: string,
    apiKey?: string
): Promise<{
    valid: boolean;
    label?: string;
    models?: string[];
    error?: string;
}> => {
    const url = (rawBaseUrl || DEFAULT_VIDEO_CONFIG.museAiBaseUrl || 'http://127.0.0.1:18610/v1').replace(/\/+$/, '');
    const key = (apiKey !== undefined ? apiKey : (DEFAULT_VIDEO_CONFIG.museAiApiKey || '')).trim();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };
        if (key) {
            headers['Authorization'] = `Bearer ${key}`;
        }

        const resp = await fetch(`${url}/models`, {
            method: 'GET',
            headers,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!resp.ok) {
            return {
                valid: false,
                error: `Muse AI Gateway trả về HTTP ${resp.status}. Kiểm tra lại API Key hoặc Port 18610.`
            };
        }

        const data = await resp.json().catch(() => ({}));
        const modelList = Array.isArray(data?.data) ? data.data.map((m: any) => m.id || String(m)) : [];

        return {
            valid: true,
            label: `Kết nối Muse AI Gateway thành công! (${modelList.filter((m: string) => m.includes('muse')).join(', ') || 'muse-video, muse-image, muse-chat'})`,
            models: modelList
        };
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return { valid: false, error: 'Hết thời gian chờ kết nối Muse AI Gateway (Timeout 10s)' };
        }
        return {
            valid: false,
            error: err.message || 'Không thể kết nối đến máy chủ Muse AI Gateway (Kiểm tra xem python -m muse2api đã bật chưa)'
        };
    }
};
