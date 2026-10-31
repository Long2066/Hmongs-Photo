/**
 * NineRouter Integration Service
 * 
 * This service provides integration with 9Router,
 * a local/remote OpenAI-compatible routing gateway running at http://127.0.0.1:20128.
 */

import { optimizeReferenceImages } from './imageOptimizer';

// --- Constants ---
const DEFAULT_NINEROUTER_URL = 'http://158.178.235.87:20128/v1';
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
const DEFAULT_TEXT_MODEL = 'claude-opus-5-5-high';

const NINEROUTER_ENABLED_KEY = 'ninerouter_enabled';
const NINEROUTER_URL_KEY = 'ninerouter_url';
const NINEROUTER_API_KEY_KEY = 'ninerouter_api_key';
const NINEROUTER_IMAGE_MODEL_KEY = 'ninerouter_image_model';
const NINEROUTER_TEXT_MODEL_KEY = 'ninerouter_text_model';

export interface NineRouterStatus {
    connected: boolean;
    errorType?: 'network' | 'auth' | 'model' | 'unknown';
    errorMessage?: string;
    models?: string[];
    lastChecked: number;
}

export interface NineRouterImageRequest {
    prompt: string;
    referenceImages?: Array<{ data: string; mimeType: string; label?: string }>;
    aspectRatio?: string;
    resolution?: string;
    shotType?: string;
    style?: string;
    model?: string;
    // VIP-related options
    useVIPPrompt?: boolean;
    hasMaleAccessories?: boolean;
    hasFemaleAccessories?: boolean;
    sessionSeed?: number;
}

export interface NineRouterLabeledReferenceImage {
    data: string;
    mimeType: string;
    label: string;
}

export interface SupportedTextModel {
    id: string;
    name: string;
    shortName: string;
    tag: string;
    tagColor: string;
    description: string;
    priority: number;
}

export const SUPPORTED_TEXT_MODELS: SupportedTextModel[] = [
    {
        id: 'claude-opus-5-5-high',
        name: 'Claude Opus 5.5 (High)',
        shortName: 'Opus 5.5',
        tag: 'Ưu tiên 1 - Cao cấp nhất',
        tagColor: 'purple',
        description: 'Mô hình văn bản cao cấp nhất, sáng tạo prompt thời trang K-Pop Idol & văn hóa H\'Mông chuẩn điện ảnh',
        priority: 1
    },
    {
        id: 'chatgpt-6.1-sol',
        name: 'ChatGPT 6.1 Sol',
        shortName: 'ChatGPT 6.1',
        tag: 'Ưu tiên 2 - OpenAI',
        tagColor: 'blue',
        description: 'Mô hình GPT thế hệ mới siêu thông minh, tự động thay thế dự phòng khi Opus hết quota',
        priority: 2
    },
    {
        id: 'gemini-4-argon',
        name: 'Gemini 4 Argon',
        shortName: 'Gemini 4 Argon',
        tag: 'Ưu tiên 3 - Google',
        tagColor: 'emerald',
        description: 'Mô hình suy luận tốc độ cao của Google, phân tích chi tiết hoa văn và bối cảnh chân thực',
        priority: 3
    },
    {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        shortName: 'Gemini 3.8 Flash',
        tag: 'Ưu tiên 4 - Phao cứu sinh',
        tagColor: 'amber',
        description: 'Mô hình siêu tốc độ, hạn mức dồi dào, đảm bảo 100% không bao giờ gặp lỗi gián đoạn',
        priority: 4
    }
];

export interface SupportedImageModel {
    id: string;
    name: string;
    shortName: string;
    tag: string;
    tagColor: string;
    description: string;
    speed: 'fast' | 'medium' | 'slow';
    isDefault?: boolean;
}

export const SUPPORTED_IMAGE_MODELS: SupportedImageModel[] = [
    {
        id: 'gemini-3.1-flash-image',
        name: 'Gemini 3.1 Flash (Chuẩn ảnh mẫu)',
        shortName: 'Gemini 3.1 Flash',
        tag: 'Khuyên dùng - Chuẩn ảnh mẫu',
        tagColor: 'emerald',
        description: 'Tốc độ 5-10s, chuẩn ảnh tham chiếu, tạo visual Idol Hàn Quốc khoác 100% trang phục thổ cẩm H’Mông',
        speed: 'fast',
        isDefault: true
    },
    {
        id: 'gpt-image-2.5',
        name: 'GPT Image 2.5 (OpenAI)',
        shortName: 'GPT Image 2.5',
        tag: 'OpenAI - Cao cấp',
        tagColor: 'blue',
        description: 'Model GPT mới nhất, tạo visual Idol Hàn Quốc & sao chép trang phục H\'Mông sắc nét 8K',
        speed: 'fast'
    },
    {
        id: 'gpt-image-2.5-flare',
        name: 'GPT Image 2.5 Flare',
        shortName: 'GPT 2.5 Flare',
        tag: 'Hiệu ứng Flare',
        tagColor: 'indigo',
        description: 'Tăng cường hiệu ứng ánh sáng nghệ thuật flare rực rỡ, chiều sâu ảnh cao',
        speed: 'fast'
    },
    {
        id: 'gpt-image-2.5-sunburst',
        name: 'GPT Image 2.5 Sunburst',
        shortName: 'GPT 2.5 Sunburst',
        tag: 'Ánh nắng Sunburst',
        tagColor: 'amber',
        description: 'Tông màu điện ảnh, ánh sáng mặt trời tự nhiên ấm áp và sống động',
        speed: 'fast'
    },
    {
        id: 'gpt-image-2',
        name: 'GPT Image 2',
        shortName: 'GPT Image 2',
        tag: 'Ổn định cao',
        tagColor: 'blue',
        description: 'Phiên bản ổn định cao, tái tạo trang phục và chi tiết mượt mà',
        speed: 'medium'
    },
    {
        id: 'gpt-image-1.5',
        name: 'GPT Image 1.5',
        shortName: 'GPT Image 1.5',
        tag: 'Tốc độ - Tiết kiệm',
        tagColor: 'purple',
        description: 'Tốc độ tạo nhanh, tiết kiệm quota, phù hợp tạo thử nghiệm và xem trước',
        speed: 'fast'
    }
];

// --- Cloud Synchronization & Caching ---
export interface AiProxyCloudConfig {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
    defaultTextModel?: string;
    defaultImageModel?: string;
    modelPricing?: Record<string, boolean>;
    updatedAt?: number;
    updatedBy?: string;
}

const NINEROUTER_PRICING_KEY = 'ninerouter_model_pricing';

export const DEFAULT_MODEL_PRICING: Record<string, boolean> = {
    'gemini-3.1-flash-image': false, // Miễn phí
    'gpt-image-2.5': true,           // Trả phí
    'gpt-image-2.5-flare': true,     // Trả phí
    'gpt-image-2.5-sunburst': true,  // Trả phí
    'gpt-image-2': true,             // Trả phí
    'gpt-image-1.5': false           // Miễn phí
};

let _cachedCloudConfig: AiProxyCloudConfig | null = null;

export const getModelPricing = (): Record<string, boolean> => {
    if (_cachedCloudConfig?.modelPricing) {
        return _cachedCloudConfig.modelPricing;
    }
    try {
        const stored = localStorage.getItem(NINEROUTER_PRICING_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {}
    return { ...DEFAULT_MODEL_PRICING };
};

export const isModelPaid = (modelId: string): boolean => {
    const cleanId = (modelId || '').replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim();
    const pricing = getModelPricing();
    if (pricing && pricing[cleanId] !== undefined) {
        return !!pricing[cleanId];
    }
    // Default fallback
    return cleanId.startsWith('gpt-image-2');
};

export const updateNineRouterConfigFromCloud = (config: Partial<AiProxyCloudConfig>): void => {
    if (config.enabled !== undefined) {
        localStorage.setItem(NINEROUTER_ENABLED_KEY, config.enabled ? 'true' : 'false');
    }
    if (config.url) {
        localStorage.setItem(NINEROUTER_URL_KEY, normalizeNineRouterUrl(config.url));
    }
    if (config.apiKey !== undefined) {
        localStorage.setItem(NINEROUTER_API_KEY_KEY, config.apiKey.trim());
    }
    if (config.modelPricing) {
        localStorage.setItem(NINEROUTER_PRICING_KEY, JSON.stringify(config.modelPricing));
    }
    _cachedCloudConfig = {
        enabled: config.enabled ?? isNineRouterEnabled(),
        url: config.url ? normalizeNineRouterUrl(config.url) : getNineRouterUrl(),
        apiKey: config.apiKey ?? getNineRouterApiKey(),
        defaultTextModel: config.defaultTextModel ?? DEFAULT_TEXT_MODEL,
        defaultImageModel: config.defaultImageModel ?? DEFAULT_IMAGE_MODEL,
        modelPricing: config.modelPricing ?? getModelPricing(),
        updatedAt: config.updatedAt ?? Date.now()
    };
    window.dispatchEvent(new CustomEvent('ninerouter-status-changed', {
        detail: { enabled: _cachedCloudConfig.enabled }
    }));
    window.dispatchEvent(new CustomEvent('ninerouter-pricing-changed', {
        detail: { pricing: _cachedCloudConfig.modelPricing }
    }));
    console.log('[CLIProxyAPI] Đồng bộ cấu hình AI Tool từ Cloud:', _cachedCloudConfig);
};

// --- URL Normalization Helper ---
export const normalizeNineRouterUrl = (rawUrl: string): string => {
    let url = (rawUrl || '').trim();
    if (!url) return DEFAULT_NINEROUTER_URL;
    // Remove all trailing slashes
    url = url.replace(/\/+$/, '');
    // Ensure it ends with /v1
    if (!url.endsWith('/v1')) {
        url = `${url}/v1`;
    }
    return url;
};

// --- Storage Functions ---
export const setNineRouterEnabled = (value: boolean): void => {
    localStorage.setItem(NINEROUTER_ENABLED_KEY, value ? 'true' : 'false');
    if (_cachedCloudConfig) {
        _cachedCloudConfig.enabled = value;
    }
    // Dispatch event for real-time UI updates
    window.dispatchEvent(new CustomEvent('ninerouter-status-changed', {
        detail: { enabled: value }
    }));
};

export const isNineRouterEnabled = (): boolean => {
    if (_cachedCloudConfig?.enabled !== undefined) {
        return _cachedCloudConfig.enabled;
    }
    return true;
};

export const setNineRouterUrl = (url: string): void => {
    const normalized = normalizeNineRouterUrl(url);
    localStorage.setItem(NINEROUTER_URL_KEY, normalized);
    if (_cachedCloudConfig) {
        _cachedCloudConfig.url = normalized;
    }
};

export const getNineRouterUrl = (): string => {
    if (_cachedCloudConfig?.url) {
        return normalizeNineRouterUrl(_cachedCloudConfig.url);
    }
    const url = localStorage.getItem(NINEROUTER_URL_KEY) || DEFAULT_NINEROUTER_URL;
    return normalizeNineRouterUrl(url);
};

export const setNineRouterApiKey = (key: string): void => {
    const cleanKey = key.trim();
    localStorage.setItem(NINEROUTER_API_KEY_KEY, cleanKey);
    if (_cachedCloudConfig) {
        _cachedCloudConfig.apiKey = cleanKey;
    }
};

export const getNineRouterApiKey = (): string => {
    if (_cachedCloudConfig?.apiKey !== undefined) {
        return _cachedCloudConfig.apiKey;
    }
    return localStorage.getItem(NINEROUTER_API_KEY_KEY) || '';
};

export const setNineRouterImageModel = (model: string): void => {
    const cleanModel = model.replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim() || DEFAULT_IMAGE_MODEL;
    localStorage.setItem(NINEROUTER_IMAGE_MODEL_KEY, cleanModel);
    window.dispatchEvent(new CustomEvent('ninerouter-model-changed', {
        detail: { model: cleanModel }
    }));
};

export const getNineRouterImageModel = (): string => {
    const stored = localStorage.getItem(NINEROUTER_IMAGE_MODEL_KEY);
    if (!stored) {
        return DEFAULT_IMAGE_MODEL;
    }
    const cleanStored = stored.replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim();
    if (cleanStored === 'gemini-3-pro-image') {
        return 'gemini-3.1-flash-image';
    }
    if (SUPPORTED_IMAGE_MODELS.some(m => m.id === cleanStored)) {
        return cleanStored;
    }
    return cleanStored || DEFAULT_IMAGE_MODEL;
};

export const setNineRouterTextModel = (model: string): void => {
    const cleanModel = model.replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim() || DEFAULT_TEXT_MODEL;
    localStorage.setItem(NINEROUTER_TEXT_MODEL_KEY, cleanModel);
    if (_cachedCloudConfig) {
        _cachedCloudConfig.defaultTextModel = cleanModel;
    }
    window.dispatchEvent(new CustomEvent('ninerouter-textmodel-changed', {
        detail: { model: cleanModel }
    }));
};

export const getNineRouterTextModel = (): string => {
    if (_cachedCloudConfig?.defaultTextModel) {
        return _cachedCloudConfig.defaultTextModel;
    }
    const stored = localStorage.getItem(NINEROUTER_TEXT_MODEL_KEY);
    return stored || DEFAULT_TEXT_MODEL;
};

// Helper to resolve request URL (handles browser CORS proxying for remote endpoints)
export const resolveRequestUrl = (targetUrl: string): string => {
    if (typeof window !== 'undefined' && !(window as any).electronAPI?.isElectron) {
        try {
            const parsed = new URL(targetUrl, window.location.href);
            const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
            if (!isLocal) {
                return `/api/cors-proxy?url=${encodeURIComponent(targetUrl)}`;
            }
        } catch {
            // keep original
        }
    }
    return targetUrl;
};

// Timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> => {
    const finalUrl = resolveRequestUrl(url);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(finalUrl, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

interface ParsedNineRouterResponse {
    json: any | null;
    events: any[];
    raw: string;
}

/**
 * 9Router can return OpenAI-compatible JSON or SSE even when stream=false.
 * Read the body as text first so both response formats can be handled safely.
 */
const parseNineRouterResponse = async (response: Response): Promise<ParsedNineRouterResponse> => {
    const raw = await response.text();
    const trimmed = raw.trim();

    if (!trimmed) {
        return { json: null, events: [], raw };
    }

    try {
        return { json: JSON.parse(trimmed), events: [], raw };
    } catch {
        const events: any[] = [];
        const lines = trimmed.split(/\r?\n/);

        for (const line of lines) {
            const normalized = line.trim();
            if (!normalized.startsWith('data:')) continue;

            const eventData = normalized.slice(5).trim();
            if (!eventData || eventData === '[DONE]') continue;

            try {
                events.push(JSON.parse(eventData));
            } catch (error) {
                console.warn('[9Router] Ignoring invalid SSE event:', eventData.slice(0, 160), error);
            }
        }

        if (events.length > 0) {
            return { json: null, events, raw };
        }

        throw new Error(`9Router returned an unsupported response: ${trimmed.slice(0, 240)}`);
    }
};

const getTextContent = (content: any): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    return content
        .map((part: any) => {
            if (typeof part === 'string') return part;
            if (typeof part?.text === 'string') return part.text;
            return '';
        })
        .join('');
};

const extractTextResponse = (parsed: ParsedNineRouterResponse): string | null => {
    const payloads = parsed.events.length > 0
        ? parsed.events
        : parsed.json
            ? [parsed.json]
            : [];

    let streamedContent = '';
    let completeContent = '';

    for (const payload of payloads) {
        const choices = Array.isArray(payload?.choices) ? payload.choices : [];
        for (const choice of choices) {
            const delta = getTextContent(choice?.delta?.content);
            if (delta) streamedContent += delta;

            const message = getTextContent(choice?.message?.content);
            if (message) completeContent = message;

            if (typeof choice?.text === 'string' && choice.text) {
                completeContent = choice.text;
            }
        }

        if (typeof payload?.response === 'string' && payload.response) {
            completeContent = payload.response;
        }
    }

    return streamedContent || completeContent || null;
};

const extractBase64FromDataUri = (value: string): string | null => {
    const match = value.match(/data:image\/[A-Za-z0-9.+-]+;base64,([A-Za-z0-9+/=\r\n]+)/);
    if (!match) return null;

    const base64 = match[1].replace(/\s+/g, '');
    return base64.length > 100 ? base64 : null;
};

/** Extract image output from OpenAI/Gemini-style multimodal chat payloads. */
const extractImageFromChatResponse = (parsed: ParsedNineRouterResponse): string | null => {
    const payloads = parsed.events.length > 0
        ? parsed.events
        : parsed.json
            ? [parsed.json]
            : [];

    const inspect = (value: any): string | null => {
        if (!value) return null;

        if (typeof value === 'string') {
            return extractBase64FromDataUri(value);
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                const found = inspect(item);
                if (found) return found;
            }
            return null;
        }

        if (typeof value !== 'object') return null;

        if (typeof value.b64_json === 'string' && value.b64_json.length > 100) {
            return value.b64_json;
        }
        if (typeof value.data === 'string' && value.data.length > 100 && !value.data.startsWith('http')) {
            return extractBase64FromDataUri(value.data) || value.data;
        }
        if (typeof value.url === 'string') {
            const found = extractBase64FromDataUri(value.url);
            if (found) return found;
        }

        for (const key of ['choices', 'message', 'delta', 'content', 'images', 'image_url', 'inlineData', 'inline_data', 'parts', 'output', 'data']) {
            const found = inspect(value[key]);
            if (found) return found;
        }

        return null;
    };

    // Concatenate SSE text chunks first because a data URI may be split across deltas.
    const streamedText = extractTextResponse(parsed);
    const streamedImage = streamedText ? extractBase64FromDataUri(streamedText) : null;
    if (streamedImage) return streamedImage;

    for (const payload of payloads) {
        const found = inspect(payload);
        if (found) return found;
    }

    return null;
};

/**
 * Check connection to 9Router
 */
export const checkConnection = async (customUrl?: string, customApiKey?: string): Promise<NineRouterStatus> => {
    const baseUrl = customUrl !== undefined ? normalizeNineRouterUrl(customUrl) : getNineRouterUrl();
    const apiKey = customApiKey !== undefined ? customApiKey.trim() : getNineRouterApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
        console.log('[9Router] Checking connection to:', `${baseUrl}/models`);
        const resp = await fetchWithTimeout(`${baseUrl}/models`, {
            method: 'GET',
            headers
        }, 10000);

        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                return {
                    connected: false,
                    errorType: 'auth',
                    errorMessage: 'API Key không hợp lệ hoặc thiếu quyền truy cập (HTTP 401/403). Vui lòng nhập API Key Cấu hình đúng.',
                    lastChecked: Date.now()
                };
            }
            if (resp.status === 404) {
                return {
                    connected: false,
                    errorType: 'unknown',
                    errorMessage: 'Không tìm thấy endpoint /models (HTTP 404). Hãy đảm bảo Endpoint URL kết thúc bằng /v1.',
                    lastChecked: Date.now()
                };
            }
            return {
                connected: false,
                errorType: 'unknown',
                errorMessage: `Lỗi HTTP ${resp.status}`,
                lastChecked: Date.now()
            };
        }

        const data = await resp.json();
        const models = Array.isArray(data?.data)
            ? data.data.map((m: any) => String(m.id || m))
            : [];

        return {
            connected: true,
            models,
            lastChecked: Date.now()
        };
    } catch (err: any) {
        console.error('[9Router] Connection error:', err);
        return {
            connected: false,
            errorType: 'network',
            errorMessage: 'Không thể kết nối tới máy chủ Cấu hình. Vui lòng kiểm tra lại URL endpoint.',
            lastChecked: Date.now()
        };
    }
};

/**
 * Helper to map aspect ratio to pixel string or standard ratio name
 */
const mapRatioForNineRouter = (aspectRatio?: string): string => {
    switch (aspectRatio) {
        case '16:9': return '16:9';
        case '9:16': return '9:16';
        case '4:3': return '4:3';
        case '3:4': return '3:4';
        case '3:2': return '3:2';
        case '2:3': return '2:3';
        case '1:1':
        default: return '1:1';
    }
};

/**
 * Mandatory physical realism & scale grounding appended to all shots
 */
const MANDATORY_GROUNDING_DIRECTIVE = `
*** MANDATORY PHYSICAL REALISM & 1:1 HUMAN SCALE (NON-NEGOTIABLE) ***
- FEET FIRMLY ON SOLID GROUND: Subjects MUST have their feet firmly planted on solid physical terrain (cobblestone pathway, dirt trail, stone terrace steps, or marketplace floor) with realistic gravitational contact shadows.
- STRICTLY FORBIDDEN: NEVER render subjects floating in the sky, levitating above valleys, hovering on clouds, or scaled up like 50-meter giant titans towering over miniature landscapes.
- 1:1 HUMAN PROPORTIONS: Subjects must be in authentic 1:1 human proportions relative to all surrounding objects, buildings, market stalls, tents, and trees.`;

/**
 * Mapping camera angle / shot types to exact photographic technical directives
 */
export const getShotTypeDirective = (shotType?: string): string => {
    if (!shotType) return MANDATORY_GROUNDING_DIRECTIVE;
    const lower = shotType.toLowerCase();

    let specificDirective = '';

    if (lower.includes('chân dung') || lower.includes('portrait')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: TIGHT PORTRAIT / BUST SHOT ***
- LENS & OPTICS: 85mm f/1.8 telephoto portrait prime lens, creamy shallow depth of field.
- COMPOSITION: Tight vertical head-and-shoulders to chest bust portrait at eye-level. 
- FOCUS POINT: Razor-sharp focus on subject's facial features, eyes, and intricate traditional neckwear / silver collar ornaments.
- MANDATORY FRAMING RULE: DO NOT PULL CAMERA BACK into a full-body wide shot. The lower body and legs MUST NOT be visible.`;
    } else if (lower.includes('cận cảnh') || lower.includes('macro')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: EXTREME CLOSE-UP (MACRO) ***
- LENS & OPTICS: 105mm f/2.8 Macro lens, extreme micro-focus.
- COMPOSITION: Extreme tight focus highlighting intricate hand-embroidery stitches, jewelry silver carvings, or intense eyes.
- MANDATORY FRAMING RULE: Zero wide perspective, pure intimate close-up detail.`;
    } else if (lower.includes('toàn cảnh') || lower.includes('landscape')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: FULL-BODY ENVIRONMENTAL LANDSCAPE (1:1 SCALE) ***
- LENS & OPTICS: 35mm wide angle, f/8 deep aperture.
- COMPOSITION: Full human figure from head to toe standing firmly on the foreground mountain trail or stone terrace ledge with majestic panoramic landscape in the background.
- GROUND ANCHOR: Subjects must be realistically anchored on solid ground at 1:1 scale relative to the mountains. Never floating or oversized.`;
    } else if (lower.includes('chụp lén') || lower.includes('candid')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: AUTHENTIC CANDID PHOTOGRAPHY ***
- LENS & OPTICS: 50mm f/2.0 standard lens at eye level.
- COMPOSITION: Unposed, natural snapshot capturing spontaneous emotion, candid movement, and genuine village interaction, walking on authentic village paths.`;
    } else if (lower.includes('flycam') || lower.includes('drone')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: ELEVATED DRONE PERSPECTIVE (SEMI-HIGH ANGLE) ***
- LENS & OPTICS: Drone camera positioned at a moderate elevated height (3 to 5 meters above ground), angled 30-45 degrees downward facing the subjects.
- COMPOSITION: Subjects are FIRMLY STANDING or walking on a solid mountain path, stone terrace edge, or viewpoint rock overlooking the terraced valley.
- REALISTIC PHYSICS: Clear ground contact with natural cast shadows under feet. Absolutely NO high-altitude 500m views where subjects float in the sky or look like 100m giants standing on miniature villages.`;
    } else if (lower.includes('từ trên cao') || lower.includes("bird's eye") || lower.includes('birds eye')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: HIGH-ANGLE ELEVATED OVERVIEW ***
- LENS & OPTICS: 35mm lens looking downward at a 45-degree angle from an elevated hillside or upper terrace.
- COMPOSITION: High-angle view looking down at the subjects who are visibly standing or walking on solid cobblestone, dirt trail, or market ground.
- GROUND CONTACT: The ground surface under their feet must be clearly visible and grounded. Never hovering in mid-air.`;
    } else if (lower.includes('từ dưới đất') || lower.includes("worm's eye") || lower.includes('worms eye')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: WORM'S EYE GROUND-LEVEL PERSPECTIVE ***
- LENS & OPTICS: Ultra-low angle lens positioned right at ground level (dirt/grass/pebble level) looking upward.
- COMPOSITION: Subjects' traditional footwear and feet making direct, tangible contact with the solid ground in the immediate foreground, rising gracefully against the mountain sky.`;
    } else if (lower.includes('góc thấp') || lower.includes('low angle')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: LOW-ANGLE HEROIC PERSPECTIVE ***
- LENS & OPTICS: 28mm-35mm wide lens placed at knee-height looking slightly upward.
- COMPOSITION: Imposing and heroic stance, feet firmly anchored on the trail/stones in the foreground, balanced against the dramatic mountain sky.`;
    } else if (lower.includes('góc rộng') || lower.includes('wide angle')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: ENVIRONMENTAL WIDE ANGLE (24mm) ***
- LENS & OPTICS: 24mm wide angle lens at chest/eye level.
- COMPOSITION: Broad panoramic perspective showing grounded subjects in 1:1 human scale within the vast natural environment.`;
    } else if (lower.includes('góc nhìn thứ nhất') || lower.includes('pov')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: FIRST-PERSON POINT-OF-VIEW (POV) ***
- LENS & OPTICS: 35mm natural human field of view at eye level.
- COMPOSITION: Immersive first-person perspective as if the viewer is standing directly in front of the subjects (1.5 - 2 meters away) on the mountain path or market stall.`;
    } else if (lower.includes('góc qua vai') || lower.includes('over-the-shoulder')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: OVER-THE-SHOULDER (OTS) COMPOSITION ***
- LENS & OPTICS: 50mm/85mm portrait lens.
- COMPOSITION: Framing over the soft-focus foreground shoulder/back of one person, focusing sharply on the face and outfit of the partner standing opposite them on solid ground.`;
    } else if (lower.includes('góc nghiêng') || lower.includes('dutch angle')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: DYNAMIC DUTCH ANGLE (10-15° TILT) ***
- LENS & OPTICS: 35mm lens subtly tilted 10-15 degrees off horizontal axis.
- COMPOSITION: Dynamic fashion editorial energy while maintaining natural human gravity and solid footing on the terrain.`;
    } else if (lower.includes('mắt cá') || lower.includes('fish-eye') || lower.includes('fisheye')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: CURVED FISHEYE LENS (180° FOV) ***
- LENS & OPTICS: Fisheye lens with barrel distortion around the perimeter.
- COMPOSITION: Subjects centered in the frame, standing firmly on the earth with dramatic curved horizon around them.`;
    } else if (lower.includes('studio')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: HIGH-END COMMERCIAL STUDIO SHOT ***
- LENS & OPTICS: 85mm f/5.6 commercial portrait lens.
- COMPOSITION: 3-point key and rim studio lighting, clean background, subjects standing or seated on solid studio floor with natural floor shadows.`;
    } else if (lower.includes('điện ảnh') || lower.includes('cinematic')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: ANAMORPHIC CINEMATIC MASTERPIECE ***
- LENS & OPTICS: Anamorphic cinema prime lens, 2.39:1 widescreen cinematic feel, subtle horizontal lens flare.
- COMPOSITION: Moody chiaroscuro lighting, grounded 1:1 scale human subjects, cinematic film color grading.`;
    } else if (lower.includes('ngược sáng') || lower.includes('silhouette')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: DRAMATIC BACKLIT SILHOUETTE ***
- LENS & OPTICS: Golden hour backlighting, high contrast silhouette with rim lighting around garments and hair, standing firmly on a mountain crest.`;
    } else if (lower.includes('bokeh')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: SHALLOW DEPTH OF FIELD (f/1.2 BOKEH) ***
- LENS & OPTICS: 85mm f/1.2 ultra-fast lens.
- COMPOSITION: Dreamy spherical bokeh light orbs in background, tack-sharp grounded subject in foreground.`;
    } else if (lower.includes('nhòe chuyển động') || lower.includes('motion blur')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: ARTISTIC MOTION BLUR (SLOW SHUTTER) ***
- LENS & OPTICS: 1/15s slow shutter capture.
- COMPOSITION: Dynamic motion blur in the flowing fabric and traditional pleated skirt folds, while the grounded body remains stable.`;
    } else if (lower.includes('phản chiếu') || lower.includes('reflection')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: WATER MIRROR REFLECTION ***
- LENS & OPTICS: 35mm/50mm lens.
- COMPOSITION: Subjects standing by the edge of a flooded terraced rice field or mountain stream, with their full reflection cast clearly on the water surface.`;
    } else if (lower.includes('khung trong khung') || lower.includes('framed shot')) {
        specificDirective = `*** MANDATORY CAMERA FRAMING: NATURAL FRAME-WITHIN-A-FRAME ***
- LENS & OPTICS: 50mm lens.
- COMPOSITION: Subjects framed naturally through a traditional wooden doorway, window, or pine branches, standing naturally inside or outside the space.`;
    } else {
        specificDirective = `*** MANDATORY CAMERA FRAMING: ${shotType} ***
- Strict adherence to the selected angle, lens perspective, and realistic 1:1 framing distance.`;
    }

    return `${specificDirective}\n${MANDATORY_GROUNDING_DIRECTIVE}`;
};

/**
 * Composition and camera framing directive to prevent subject cutoff while respecting shotType.
 */
export const getAspectFramingDirective = (aspectRatio?: string, shotType?: string): string => {
    const lowerShot = (shotType || '').toLowerCase();
    const isPortraitOrMacro = lowerShot.includes('chân dung') ||
        lowerShot.includes('portrait') ||
        lowerShot.includes('cận cảnh') ||
        lowerShot.includes('macro');

    switch (aspectRatio) {
        case '9:16':
            if (isPortraitOrMacro) {
                return `*** MANDATORY 9:16 VERTICAL PORTRAIT COMPOSITION ***
- TARGET RATIO: 9:16 Vertical Portrait Orientation.
- FRAMING: Intimate vertical bust/portrait shot. Keep subject centered with headroom above head and frame stopping at chest/waist level.
- NEVER CUT OFF: Top of hairstyles, hats, or lateral edges of face must remain within safe margins.`;
            }
            return `*** MANDATORY 9:16 VERTICAL COMPOSITION DIRECTIVE ***
- TARGET RATIO: 9:16 Ultra-tall vertical portrait orientation.
- CAMERA FRAMING: Well-proportioned vertical framing. Keep all characters centered.
- MANDATORY SAFE ZONE: Leave generous empty margins (at least 20% empty background buffer) on BOTH sides.
- NEVER CROP SUBJECTS: Heads, hair, entire bodies, and outfits MUST be completely contained inside the central safe zone.`;

        case '16:9':
            if (isPortraitOrMacro) {
                return `*** MANDATORY 16:9 CINEMATIC CLOSE-UP / PORTRAIT COMPOSITION ***
- TARGET RATIO: 16:9 Cinematic Landscape Orientation.
- FRAMING: Cinematic medium-close portrait framing with character positioned harmoniously within the golden-ratio thirds.
- VERTICAL SAFE ZONE: Provide generous clearance above head and below shoulders.`;
            }
            return `*** MANDATORY 16:9 WIDESCREEN FRAMING & CAMERA COMPOSITION DIRECTIVE ***
- TARGET RATIO: 16:9 Cinematic Landscape Orientation.
- CAMERA FRAMING: Wide panoramic landscape framing with expansive horizontal views.
- VERTICAL SAFE ZONE: Provide generous clearance above heads (headroom) and below feet (footroom).
- NEVER CROP SUBJECTS: Never cut off the top of heads, hairstyles, hats, or bottom of shoes/feet.`;

        case '3:4':
            return `*** MANDATORY 3:4 PORTRAIT FRAMING DIRECTIVE ***
- TARGET RATIO: 3:4 Vertical Portrait.
- CAMERA FRAMING: Well-composed portrait shot with at least 15% safety margins on left and right borders.
- Keep subjects fully contained inside the frame without touching the lateral edges.`;

        case '4:3':
            return `*** MANDATORY 4:3 COMPOSITION DIRECTIVE ***
- TARGET RATIO: 4:3 Balanced Composition.
- Ample vertical and horizontal safety margins on all borders.`;

        default:
            return `*** ASPECT RATIO: ${aspectRatio || '1:1'} ***
- Balanced centered composition with generous safety borders on all sides.`;
    }
};

export const aspectRatioToPixelSize = (aspectRatio?: string, resolution?: string): string => {
    const res = (resolution || 'FHD').toUpperCase();
    const is4K = res === '4K';
    const is2K = res === '2K';
    const isHD = res === 'HD';

    switch (aspectRatio) {
        case '16:9':
            if (is4K) return '3840x2160';
            if (is2K) return '2560x1440';
            if (isHD) return '1280x720';
            return '1920x1080';
        case '9:16':
            if (is4K) return '2160x3840';
            if (is2K) return '1440x2560';
            if (isHD) return '720x1280';
            return '1080x1920';
        case '4:3':
            if (is4K) return '2880x2160';
            if (is2K) return '1920x1440';
            if (isHD) return '1152x864';
            return '1440x1080';
        case '3:4':
            if (is4K) return '2160x2880';
            if (is2K) return '1440x1920';
            if (isHD) return '864x1152';
            return '1080x1440';
        case '3:2':
            if (is4K) return '3240x2160';
            if (is2K) return '2160x1440';
            if (isHD) return '1216x816';
            return '1620x1080';
        case '2:3':
            if (is4K) return '2160x3240';
            if (is2K) return '1440x2160';
            if (isHD) return '816x1216';
            return '1080x1620';
        case '1:1':
        default:
            if (is4K) return '3840x3840';
            if (is2K) return '2048x2048';
            if (isHD) return '1024x1024';
            return '1536x1536';
    }
};

export const getOpenAiStandardSize = (aspectRatio?: string): string => {
    switch (aspectRatio) {
        case '16:9':
        case '3:2':
        case '21:9':
            return '1792x1024';
        case '9:16':
        case '2:3':
        case '3:4':
            return '1024x1792';
        case '4:3':
            return '1024x768';
        case '1:1':
        default:
            return '1024x1024';
    }
};

const getModelWithAspectSuffix = (baseModel: string, aspectRatio?: string): string => {
    if (!aspectRatio || aspectRatio === '1:1') return baseModel;
    const ratioMap: Record<string, string> = {
        '16:9': '16-9',
        '9:16': '9-16',
        '4:3': '4-3',
        '3:4': '3-4',
        '3:2': '3-2',
        '2:3': '2-3',
        '21:9': '21-9'
    };
    const suffix = ratioMap[aspectRatio] || '';
    if (!suffix) return baseModel;
    if (baseModel.endsWith(`-${suffix}`)) return baseModel;
    return `${baseModel}-${suffix}`;
};

/**
 * Generate Text via 9Router (/v1/chat/completions)
 */
export const generateTextViaNineRouter = async (
    prompt: string,
    model?: string,
    systemInstruction?: string,
    referenceImages?: NineRouterLabeledReferenceImage[]
): Promise<string | null> => {
    const baseUrl = getNineRouterUrl();
    const apiKey = getNineRouterApiKey();
    const activeModel = model || getNineRouterTextModel();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const messages: Array<{ role: string; content: any }> = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    // Support multimodal vision inspection for gemini-3-flash
    if (referenceImages && referenceImages.length > 0) {
        const userParts: any[] = [];
        userParts.push({
            type: 'text',
            text: `ATTACHED REFERENCE IMAGES (${referenceImages.length} items): Please inspect each garment/accessory image carefully and reflect its exact visual details into the prompts.`
        });
        referenceImages.forEach((ref) => {
            userParts.push({
                type: 'text',
                text: `[REFERENCE: ${ref.label}]`
            });
            userParts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${ref.mimeType || 'image/jpeg'};base64,${ref.data}`,
                    detail: 'high'
                }
            });
        });
        userParts.push({
            type: 'text',
            text: prompt
        });
        messages.push({ role: 'user', content: userParts });
    } else {
        messages.push({ role: 'user', content: prompt });
    }

    // Build priority candidates list for graceful fallback
    const primaryModel = model || getNineRouterTextModel();
    const candidateModels: string[] = Array.from(new Set([
        primaryModel,
        'claude-opus-5-5-high',
        'chatgpt-6.1-sol',
        'gemini-4-argon',
        'gemini-3.8-flash',
        'gemini-3-flash'
    ])).filter(Boolean);

    let lastError: any = null;

    for (const candidateModel of candidateModels) {
        try {
            console.log(`[CLIProxyAPI] Attempting prompt text generation with candidate: ${candidateModel}`);
            const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: candidateModel,
                    messages,
                    temperature: 0.7,
                    max_tokens: 8192,
                    max_completion_tokens: 8192,
                    stream: false
                })
            }, 60000);

            if (!resp.ok) {
                const errText = await resp.text();
                console.warn(`[CLIProxyAPI] Candidate ${candidateModel} failed with HTTP ${resp.status}: ${errText.slice(0, 160)}`);
                lastError = new Error(`HTTP ${resp.status}: ${errText}`);
                // Quota exhausted (429) or invalid model (400) or server error (500/503) -> continue to next candidate!
                continue;
            }

            const parsed = await parseNineRouterResponse(resp);
            const content = extractTextResponse(parsed);
            if (content) {
                console.log(`[CLIProxyAPI] Successfully generated text using candidate: ${candidateModel}`);
                return content;
            }
        } catch (err: any) {
            console.warn(`[CLIProxyAPI] Candidate ${candidateModel} threw error:`, err?.message || err);
            lastError = err;
        }
    }

    throw lastError || new Error('Máy chủ Cấu hình không trả về nội dung text. Đã thử tất cả các model text dự phòng.');
};

export interface ChatMessageItem {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatResponseResult {
    content: string;
    modelUsed: string;
    modelName: string;
}

/**
 * Generate multi-turn chat responses through 9Router text models
 * with auto fallback across Claude Opus 5.5, ChatGPT 6.1, Gemini 4, Gemini 3.8
 * and fallback to Google Gemini system key if NineRouter is unreachable.
 */
export const generateChatCompletionViaNineRouter = async (
    chatMessages: ChatMessageItem[],
    preferredModel?: string,
    systemInstruction?: string
): Promise<ChatResponseResult> => {
    const baseUrl = getNineRouterUrl();
    const apiKey = getNineRouterApiKey();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    // Format chat messages
    chatMessages.forEach(m => {
        messages.push({
            role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
            content: m.content
        });
    });

    // Build candidate models order
    const defaultTextModel = getNineRouterTextModel();
    const cleanPreferred = preferredModel && preferredModel !== 'auto'
        ? preferredModel.replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim()
        : null;

    const baseCandidates = [
        'claude-opus-5-5-high',
        'chatgpt-6.1-sol',
        'gemini-4-argon',
        'gemini-3.8-flash',
        'gemini-3-flash'
    ];

    const candidateModels: string[] = Array.from(new Set([
        cleanPreferred,
        defaultTextModel,
        ...baseCandidates
    ])).filter(Boolean) as string[];

    let lastError: any = null;

    // Check if NineRouter gateway is enabled
    if (isNineRouterEnabled()) {
        for (const candidateModel of candidateModels) {
            try {
                console.log(`[CLIProxyAPI Chat] Attempting chatbot reply with model: ${candidateModel}`);
                const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: candidateModel,
                        messages,
                        temperature: 0.7,
                        max_tokens: 2048,
                        stream: false
                    })
                }, 35000);

                if (!resp.ok) {
                    const errText = await resp.text();
                    console.warn(`[CLIProxyAPI Chat] Model ${candidateModel} failed with HTTP ${resp.status}: ${errText.slice(0, 160)}`);
                    lastError = new Error(`HTTP ${resp.status}: ${errText}`);
                    continue;
                }

                const parsed = await parseNineRouterResponse(resp);
                const content = extractTextResponse(parsed);
                if (content && content.trim()) {
                    const matchedModel = SUPPORTED_TEXT_MODELS.find(m => m.id === candidateModel);
                    const modelName = matchedModel ? matchedModel.shortName : candidateModel;
                    return {
                        content: content.trim(),
                        modelUsed: candidateModel,
                        modelName
                    };
                }
            } catch (err: any) {
                console.warn(`[CLIProxyAPI Chat] Model ${candidateModel} error:`, err?.message || err);
                lastError = err;
            }
        }
    }

    // Fallback: If NineRouter fails, try direct Gemini with system API key
    try {
        const { getSystemApiKey, GEMINI_VIP_MODEL } = await import('./geminiCoreService');
        const systemKey = getSystemApiKey();
        if (systemKey) {
            console.log('[Chatbot Fallback] Falling back to Google Gemini system key...');
            const geminiContents: any[] = [];
            if (systemInstruction) {
                geminiContents.push({ role: 'user', parts: [{ text: systemInstruction }] });
                geminiContents.push({ role: 'model', parts: [{ text: 'Tôi hiểu rõ nhiệm vụ hỗ trợ người dùng.' }] });
            }
            chatMessages.forEach(m => {
                geminiContents.push({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                });
            });

            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VIP_MODEL}:generateContent?key=${systemKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: geminiContents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1000
                        }
                    })
                }
            );

            if (resp.ok) {
                const data = await resp.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && text.trim()) {
                    return {
                        content: text.trim(),
                        modelUsed: GEMINI_VIP_MODEL,
                        modelName: 'Gemini Backup'
                    };
                }
            }
        }
    } catch (fallbackErr) {
        console.error('[Chatbot Fallback Error]:', fallbackErr);
    }

    throw lastError || new Error('Không thể kết nối đến các model sinh text. Vui lòng thử lại sau giây lát.');
};

/**
 * Convert base64 Data URI or raw base64 to binary Blob for multipart/form-data upload
 */
const base64ToBlob = (base64Data: string, mimeType: string = 'image/jpeg'): Blob => {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(cleanBase64.replace(/\s+/g, ''));
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

/**
 * Extract image data from any response format (JSON data array, b64_json, url, or chat completion)
 */
const extractAnyImageFromResponse = async (parsed: ParsedNineRouterResponse): Promise<string | null> => {
    const payloads = parsed.events.length > 0 ? parsed.events : (parsed.json ? [parsed.json] : []);
    const imageItems = payloads.flatMap(p => Array.isArray(p?.data) ? p.data : []);
    const first = imageItems[0];
    if (first?.b64_json && first.b64_json.length > 100) return first.b64_json;
    if (first?.url) {
        const dataUrl = extractBase64FromDataUri(first.url);
        if (dataUrl) return dataUrl;
        if (first.url.startsWith('http')) {
            const imgResp = await fetch(first.url);
            if (imgResp.ok) {
                const arrayBuffer = await imgResp.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(arrayBuffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary);
            }
        }
    }
    const chatFallback = extractImageFromChatResponse(parsed);
    if (chatFallback) return chatFallback;
    return null;
};

/**
 * Generate images through 9Router / CLIProxyAPI.
 * Reference-based requests use native multimodal chat so the image model sees
 * the original input pixels and complete prompt in one request.
 */
export const generateImageViaNineRouter = async (
    request: NineRouterImageRequest
): Promise<string | null> => {
    const baseUrl = getNineRouterUrl();
    const apiKey = getNineRouterApiKey();
    const activeModel = (request.model || getNineRouterImageModel())
        .replace(/^ag\//i, '')
        .replace(/^openrouter\//i, '')
        .trim();

    const rawRefImages = request.referenceImages || [];
    // Automatically downscale and compress reference images (saving ~90% bandwidth)
    const referenceImages = await optimizeReferenceImages(rawRefImages);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const ratio = mapRatioForNineRouter(request.aspectRatio);
    const standardSize = getOpenAiStandardSize(request.aspectRatio);
    const framingDirective = getAspectFramingDirective(request.aspectRatio, request.shotType);
    const shotDirective = getShotTypeDirective(request.shotType);

    // Strict directives enforcing Korean visual idol aesthetic, aspect ratio, physical grounding, and 100% outfit cloning
    const strictFramingHeader = `*** MANDATORY CANVAS ASPECT RATIO: ${ratio} ***
*** MANDATORY PHYSICAL REALISM & 1:1 HUMAN SCALE (NON-NEGOTIABLE) ***
- PHYSICAL GROUNDING (CRITICAL): Subjects MUST have their feet firmly planted on solid physical terrain (dirt trail, cobblestones, stone terrace steps, market floor) with realistic contact shadows. ABSOLUTELY FORBIDDEN to depict subjects floating in the sky, hovering above mountains, or rendered as giant titans towering over miniature landscapes.
- 1:1 REALISTIC HUMAN SCALE: Characters must be depicted in exact 1:1 human proportions relative to all surrounding elements (market stalls, houses, tents, fences, and trees).
*** MANDATORY KOREAN IDOL VISUAL & 100% OUTFIT CLONING PROTOCOL ***
- CHARACTER VISUAL (MANDATORY): Always depict stunning, ultra-attractive Korean K-Pop Idol / Ulzzang visuals (flawless porcelain glass skin chok-chok, captivating charismatic eyes, natural double eyelids, sharp jawline, tall and graceful build).
- REFERENCE PHOTOS ROLE: Input reference images are strictly for CLOTHING, TEXTILES, AND ACCESSORIES ONLY. DO NOT copy faces, skin tones, or ages from the reference images (ignore any mannequin, artisan, or person in the reference photos).
- OUTFIT REPLICATION: Faithfully clone 100% of the authentic traditional H'Mông hand-embroidery, pleated batik indigo skirts, vivid brocade motifs, silver torque collar necklaces, and accessories onto the handsome/beautiful Korean idol.
- CANVAS SAFE ZONE (Ratio ${ratio}): Strictly compose all subjects completely within canvas safe zone without cutting heads, hair, or ornaments.`;
    const fullDirective = [strictFramingHeader, framingDirective, shotDirective].filter(Boolean).join('\n\n');
    const combinedPrompt = `${fullDirective}\n\nSCENE DESCRIPTION & REQUIREMENTS:\n${request.prompt}`;

    // Build candidate models order based on user selection
    const isGeminiSelected = activeModel.toLowerCase().includes('gemini');
    const candidateModels: string[] = isGeminiSelected
        ? Array.from(new Set([
            activeModel === 'gemini-3-pro-image' ? 'gemini-3.1-flash-image' : activeModel,
            'gemini-3.1-flash-image',
            'gpt-image-2.5',
            'gpt-image-2',
            'gpt-image-1.5'
        ])).filter(Boolean)
        : Array.from(new Set([
            activeModel || 'gpt-image-2.5',
            'gpt-image-2.5',
            'gpt-image-2',
            'gpt-image-1.5',
            'gemini-3.1-flash-image'
        ])).filter(Boolean);

    let lastError: any = null;

    for (const candidateModel of candidateModels) {
        try {
            console.log(`[CLIProxyAPI] Attempting image generation with candidate: ${candidateModel}, ratio: ${ratio}, size: ${standardSize}`);

            // PATH A: Gemini multimodal via /v1/chat/completions
            if (candidateModel.toLowerCase().includes('gemini')) {
                const userContent: any[] = [{
                    type: 'text',
                    text: `*** DIRECT MULTIMODAL REFERENCE INSTRUCTION ***
Inspect all ${referenceImages.length} attached input reference image(s).
CRITICAL RULES:
1. PHYSICAL GROUNDING & 1:1 HUMAN SCALE: Subjects MUST have their feet firmly planted on solid ground (dirt path, stone steps, market floor) with realistic contact shadows. NEVER depict humans floating in the sky or rendered as giant titans above the landscape. Human scale relative to surrounding stalls and buildings must be strictly 1:1.
2. CHARACTER VISUAL: The character MUST be an ultra-attractive Korean K-Pop Idol / Ulzzang (flawless luminous porcelain glass skin, double eyelids, captivating eyes, sharp jawline, high fashion charisma).
3. CLOTHING & ACCESSORIES ONLY: Attached images provide CLOTHING, TEXTILES, EMBROIDERY, AND ACCESSORIES ONLY. DO NOT use the face, skin tone, or identity from the reference image. Clone 100% of the traditional H'Mông embroidery, pleated skirts, brocade patterns, and silver torque collar necklaces onto this Korean idol model.
4. The background must strictly follow the scene description below, NOT the reference photos' backgrounds.`
                }];

                referenceImages.forEach((img, idx) => {
                    userContent.push({
                        type: 'text',
                        text: `INPUT REFERENCE ${idx + 1}: ${img.label || `Subject / Outfit ${idx + 1}`}`
                    });
                    userContent.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`,
                            detail: 'high'
                        }
                    });
                });

                userContent.push({
                    type: 'text',
                    text: combinedPrompt
                });

                const chatBody: any = {
                    model: candidateModel,
                    messages: [{ role: 'user', content: userContent }],
                    modalities: ['image', 'text'],
                    image_config: {
                        aspect_ratio: ratio
                    },
                    stream: false
                };

                const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(chatBody)
                }, 120000);

                if (resp.ok) {
                    const parsed = await parseNineRouterResponse(resp);
                    const image = await extractAnyImageFromResponse(parsed);
                    if (image) {
                        console.log(`[CLIProxyAPI] Successfully generated image via /v1/chat/completions (${candidateModel})`);
                        return image;
                    }
                } else {
                    const errText = await resp.text();
                    console.warn(`[CLIProxyAPI] Candidate ${candidateModel} /chat/completions returned HTTP ${resp.status}: ${errText}`);
                }
            }

            // PATH B: Reference-based image editing via /v1/images/edits
            if (referenceImages.length > 0) {
                // Step B1: Try multipart/form-data with Binary Blobs
                try {
                    const formData = new FormData();
                    formData.append('model', candidateModel);
                    formData.append('prompt', combinedPrompt);
                    formData.append('size', standardSize);
                    formData.append('quality', 'high');
                    formData.append('input_fidelity', 'high');
                    formData.append('response_format', 'b64_json');
                    formData.append('aspect_ratio', ratio);

                    referenceImages.forEach((img, idx) => {
                        const blob = base64ToBlob(img.data, img.mimeType || 'image/jpeg');
                        if (idx === 0) {
                            formData.append('image', blob, `ref_${idx + 1}.jpg`);
                        }
                        formData.append('images', blob, `ref_${idx + 1}.jpg`);
                    });

                    const formHeaders: Record<string, string> = {};
                    if (apiKey) formHeaders['Authorization'] = `Bearer ${apiKey}`;

                    const respMultipart = await fetchWithTimeout(`${baseUrl}/images/edits`, {
                        method: 'POST',
                        headers: formHeaders,
                        body: formData
                    }, 120000);

                    if (respMultipart.ok) {
                        const parsed = await parseNineRouterResponse(respMultipart);
                        const image = await extractAnyImageFromResponse(parsed);
                        if (image) {
                            console.log(`[CLIProxyAPI] Successfully generated image via /images/edits (multipart: ${candidateModel})`);
                            return image;
                        }
                    }
                } catch (formErr) {
                    console.warn('[CLIProxyAPI] Multipart /images/edits failed, trying JSON:', formErr);
                }

                // Step B2: Try application/json on /v1/images/edits
                try {
                    const editPayload: any = {
                        model: candidateModel,
                        prompt: combinedPrompt,
                        images: referenceImages.map(img => ({
                            image_url: `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                        })),
                        image: `data:${referenceImages[0].mimeType || 'image/jpeg'};base64,${referenceImages[0].data}`,
                        size: standardSize,
                        quality: 'high',
                        input_fidelity: 'high',
                        aspect_ratio: ratio,
                        n: 1,
                        response_format: 'b64_json',
                        image_config: {
                            aspect_ratio: ratio
                        }
                    };

                    const respJson = await fetchWithTimeout(`${baseUrl}/images/edits`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(editPayload)
                    }, 120000);

                    if (respJson.ok) {
                        const parsed = await parseNineRouterResponse(respJson);
                        const image = await extractAnyImageFromResponse(parsed);
                        if (image) {
                            console.log(`[CLIProxyAPI] Successfully generated image via /images/edits (JSON: ${candidateModel})`);
                            return image;
                        }
                    }
                } catch (jsonErr) {
                    console.warn('[CLIProxyAPI] JSON /images/edits failed:', jsonErr);
                }
            }

            // PATH C: Text-to-Image / Fallback via /v1/images/generations
            try {
                const genPayload: any = {
                    model: candidateModel,
                    prompt: combinedPrompt,
                    n: 1,
                    response_format: 'b64_json',
                    size: standardSize,
                    quality: 'high',
                    aspect_ratio: ratio,
                    image_config: {
                        aspect_ratio: ratio
                    },
                    extra_body: {
                        aspect_ratio: ratio,
                        size: standardSize
                    }
                };

                const respGen = await fetchWithTimeout(`${baseUrl}/images/generations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(genPayload)
                }, 90000);

                if (respGen.ok) {
                    const parsed = await parseNineRouterResponse(respGen);
                    const image = await extractAnyImageFromResponse(parsed);
                    if (image) {
                        console.log(`[CLIProxyAPI] Successfully generated image via /images/generations (${candidateModel})`);
                        return image;
                    }
                } else if (respGen.status === 400 && standardSize !== '1024x1024') {
                    // Fallback to square size if gateway rejects custom aspect size
                    const respSquare = await fetchWithTimeout(`${baseUrl}/images/generations`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            ...genPayload,
                            size: '1024x1024'
                        })
                    }, 90000);

                    if (respSquare.ok) {
                        const parsed = await parseNineRouterResponse(respSquare);
                        const image = await extractAnyImageFromResponse(parsed);
                        if (image) {
                            console.log(`[CLIProxyAPI] Generated image via /images/generations fallback square (${candidateModel})`);
                            return image;
                        }
                    }
                }
            } catch (genErr) {
                console.warn('[CLIProxyAPI] /images/generations failed:', genErr);
            }
        } catch (candidateErr: any) {
            console.error(`[CLIProxyAPI] Candidate ${candidateModel} failed:`, candidateErr);
            lastError = candidateErr;
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new Error('Máy chủ Cấu hình không trả về dữ liệu ảnh. Vui lòng kiểm tra lại trạng thái kết nối.');
};
