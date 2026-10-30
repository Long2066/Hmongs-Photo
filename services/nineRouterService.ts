/**
 * NineRouter Integration Service
 * 
 * This service provides integration with 9Router,
 * a local/remote OpenAI-compatible routing gateway running at http://127.0.0.1:20128.
 */

import { optimizeReferenceImages } from './imageOptimizer';

// --- Constants ---
const DEFAULT_NINEROUTER_URL = 'http://158.178.235.87:20128/v1';
const DEFAULT_IMAGE_MODEL = 'ag/gemini-3.1-flash-image';
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
        id: 'ag/gemini-3.1-flash-image',
        name: 'Gemini 3.1 Flash (Chuẩn ảnh mẫu)',
        shortName: 'Gemini 3.1 Flash',
        tag: 'Khuyên dùng - Chuẩn ảnh mẫu',
        tagColor: 'emerald',
        description: 'Tốc độ 5-10s, chuẩn ảnh tham chiếu, giữ 100% khuôn mặt & ghép trang phục H’Mông',
        speed: 'fast',
        isDefault: true
    },
    {
        id: 'ag/gemini-3.8-flash',
        name: 'Gemini 3.8 Flash (Thế hệ mới)',
        shortName: 'Gemini 3.8 Flash',
        tag: 'Thế hệ mới',
        tagColor: 'blue',
        description: 'Phiên bản mới nhất, cân bằng tối ưu giữa tốc độ tạo và độ chi tiết',
        speed: 'fast'
    },
    {
        id: 'ag/gemini-3.1-pro',
        name: 'Gemini 3.1 Pro Studio',
        shortName: 'Gemini 3.1 Pro',
        tag: 'Chi tiết cao',
        tagColor: 'indigo',
        description: 'Chất lượng ảnh studio độ nét cao, tái hiện hoa văn trang phục tinh xảo',
        speed: 'medium'
    },
    {
        id: 'gpt-image-2.5',
        name: 'GPT Image 2.5 (OpenAI)',
        shortName: 'GPT Image 2.5',
        tag: 'OpenAI - Mới nhất',
        tagColor: 'emerald',
        description: 'Model GPT mới nhất, tối ưu tạo ảnh nghệ thuật từ mô tả văn bản',
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
    // Dispatch event for real-time UI updates
    window.dispatchEvent(new CustomEvent('ninerouter-status-changed', {
        detail: { enabled: value }
    }));
};

export const isNineRouterEnabled = (): boolean => {
    const val = localStorage.getItem(NINEROUTER_ENABLED_KEY);
    // Default to true if not explicitly set to false
    if (val === null) return true;
    return val === 'true';
};

export const setNineRouterUrl = (url: string): void => {
    localStorage.setItem(NINEROUTER_URL_KEY, normalizeNineRouterUrl(url));
};

export const getNineRouterUrl = (): string => {
    const url = localStorage.getItem(NINEROUTER_URL_KEY) || DEFAULT_NINEROUTER_URL;
    return normalizeNineRouterUrl(url);
};

export const setNineRouterApiKey = (key: string): void => {
    localStorage.setItem(NINEROUTER_API_KEY_KEY, key.trim());
};

export const getNineRouterApiKey = (): string => {
    return localStorage.getItem(NINEROUTER_API_KEY_KEY) || '';
};

export const setNineRouterImageModel = (model: string): void => {
    const cleanModel = model.trim() || DEFAULT_IMAGE_MODEL;
    localStorage.setItem(NINEROUTER_IMAGE_MODEL_KEY, cleanModel);
    window.dispatchEvent(new CustomEvent('ninerouter-model-changed', {
        detail: { model: cleanModel }
    }));
};

export const getNineRouterImageModel = (): string => {
    const stored = localStorage.getItem(NINEROUTER_IMAGE_MODEL_KEY);
    // Reset to default Gemini model if not set or if temporarily set to gpt-image-2.5 from prior migration
    if (!stored || stored === 'gpt-image-2.5' || !SUPPORTED_IMAGE_MODELS.some(m => m.id === stored)) {
        return DEFAULT_IMAGE_MODEL;
    }
    return stored;
};

export const setNineRouterTextModel = (model: string): void => {
    const cleanModel = model.trim() || DEFAULT_TEXT_MODEL;
    localStorage.setItem(NINEROUTER_TEXT_MODEL_KEY, cleanModel);
    window.dispatchEvent(new CustomEvent('ninerouter-textmodel-changed', {
        detail: { model: cleanModel }
    }));
};

export const getNineRouterTextModel = (): string => {
    const stored = localStorage.getItem(NINEROUTER_TEXT_MODEL_KEY);
    // If empty or still using legacy sonnet/gemini models, auto-migrate to DEFAULT_TEXT_MODEL
    if (!stored || stored.startsWith('ag/') || stored.includes('sonnet') || stored.includes('gemini')) {
        return DEFAULT_TEXT_MODEL;
    }
    return stored;
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
 * Mapping camera angle / shot types to exact photographic technical directives
 */
export const getShotTypeDirective = (shotType?: string): string => {
    if (!shotType) return '';
    const lower = shotType.toLowerCase();

    if (lower.includes('chân dung') || lower.includes('portrait')) {
        return `*** MANDATORY CAMERA FRAMING: TIGHT PORTRAIT / BUST SHOT ***
- LENS & OPTICS: 85mm f/1.8 telephoto portrait prime lens, creamy shallow depth of field.
- COMPOSITION: Tight vertical head-and-shoulders to chest bust portrait. 
- FOCUS POINT: Razor-sharp focus on subject's facial features, eyes, and intricate traditional neckwear / silver collar ornaments.
- MANDATORY FRAMING RULE: DO NOT PULL CAMERA BACK into a full-body wide shot. The lower body and legs MUST NOT be visible.`;
    }

    if (lower.includes('cận cảnh') || lower.includes('macro')) {
        return `*** MANDATORY CAMERA FRAMING: EXTREME CLOSE-UP (MACRO) ***
- LENS & OPTICS: 105mm f/2.8 Macro lens, extreme micro-focus.
- COMPOSITION: Extreme tight focus highlighting intricate hand-embroidery stitches, jewelry silver carvings, or intense eyes.
- MANDATORY FRAMING RULE: Zero wide perspective, pure intimate close-up detail.`;
    }

    if (lower.includes('toàn cảnh') || lower.includes('landscape')) {
        return `*** MANDATORY CAMERA FRAMING: FULL-BODY ENVIRONMENTAL LANDSCAPE ***
- LENS & OPTICS: 35mm wide angle, f/8 deep aperture.
- COMPOSITION: Full human figure from head to toe standing within grand panoramic mountain landscapes.`;
    }

    if (lower.includes('chụp lén') || lower.includes('candid')) {
        return `*** MANDATORY CAMERA FRAMING: AUTHENTIC CANDID PHOTOGRAPHY ***
- LENS & OPTICS: 50mm f/2.0 standard lens.
- COMPOSITION: Unposed, natural snapshot capturing spontaneous emotion, candid movement, and genuine village interaction.`;
    }

    if (lower.includes('flycam') || lower.includes('drone')) {
        return `*** MANDATORY CAMERA FRAMING: HIGH-ALTITUDE AERIAL DRONE SHOT ***
- LENS & OPTICS: Ultra-wide drone camera looking down from high elevation.
- COMPOSITION: Dramatic top-down bird's-eye perspective capturing subject amidst vast terraced mountains.`;
    }

    if (lower.includes('góc thấp') || lower.includes('low angle')) {
        return `*** MANDATORY CAMERA FRAMING: LOW-ANGLE HERO PERSPECTIVE ***
- LENS & OPTICS: 28mm wide lens placed low to ground looking upward.
- COMPOSITION: Imposing, proud, and heroic stature against the open sky.`;
    }

    if (lower.includes('góc rộng') || lower.includes('wide angle')) {
        return `*** MANDATORY CAMERA FRAMING: WIDE ANGLE VIEW (24mm) ***
- LENS & OPTICS: 24mm wide angle lens.
- COMPOSITION: Broad panoramic perspective showing both the character and extensive natural environment.`;
    }

    if (lower.includes('studio')) {
        return `*** MANDATORY CAMERA FRAMING: HIGH-END COMMERCIAL STUDIO SHOT ***
- LENS & OPTICS: 85mm f/5.6 commercial portrait lens.
- COMPOSITION: 3-point key and rim studio lighting, clean background, fashion magazine aesthetic.`;
    }

    if (lower.includes('điện ảnh') || lower.includes('cinematic')) {
        return `*** MANDATORY CAMERA FRAMING: ANAMORPHIC CINEMATIC MASTERPIECE ***
- LENS & OPTICS: Anamorphic cinema prime lens, 2.39:1 letterbox cinematic feel, subtle horizontal lens flare.
- COMPOSITION: Moody chiaroscuro lighting and cinematic film color grading.`;
    }

    if (lower.includes('ngược sáng') || lower.includes('silhouette')) {
        return `*** MANDATORY CAMERA FRAMING: DRAMATIC BACKLIT SILHOUETTE ***
- LENS & OPTICS: Golden hour backlighting, high contrast silhouette with rim lighting around garments and hair.`;
    }

    if (lower.includes('bokeh')) {
        return `*** MANDATORY CAMERA FRAMING: SHALLOW DEPTH OF FIELD (f/1.2 BOKEH) ***
- LENS & OPTICS: 85mm f/1.2 ultra-fast lens.
- COMPOSITION: Dreamy spherical bokeh light orbs in background, tack-sharp subject.`;
    }

    return `*** MANDATORY CAMERA FRAMING: ${shotType} ***
- Strict adherence to the selected angle, lens perspective, and framing distance.`;
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
    systemInstruction?: string
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

    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    try {
        console.log(`[9Router] Sending chat request to model: ${activeModel}`);
        const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: activeModel,
                messages,
                temperature: 0.7,
                max_tokens: 8192,
                max_completion_tokens: 8192,
                stream: false
            })
        }, 60000);

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${errText}`);
        }

        const parsed = await parseNineRouterResponse(resp);
        const content = extractTextResponse(parsed);
        if (!content) {
            throw new Error('Máy chủ Cấu hình không trả về nội dung text. Hãy kiểm tra Text Model trong cấu hình.');
        }
        return content;
    } catch (err: any) {
        console.error('[9Router] Chat completion error:', err);
        throw err;
    }
};

/**
 * Generate images through 9Router.
 * Reference-based requests use native multimodal chat so the image model sees
 * the original input pixels and complete prompt in one request.
 */
export const generateImageViaNineRouter = async (
    request: NineRouterImageRequest
): Promise<string | null> => {
    const baseUrl = getNineRouterUrl();
    const apiKey = getNineRouterApiKey();
    const activeModel = request.model || getNineRouterImageModel();
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
    const pixelSize = aspectRatioToPixelSize(request.aspectRatio, request.resolution);
    const framingDirective = getAspectFramingDirective(request.aspectRatio, request.shotType);
    const shotDirective = getShotTypeDirective(request.shotType);
    const fullDirective = [framingDirective, shotDirective].filter(Boolean).join('\n\n');

    try {
        if (referenceImages.length > 0) {
            // Native multimodal path for Gemini models (ag/gemini-3.1-flash-image, ag/gemini-3.8-flash, etc.):
            // Original image pixels and complete prompt are sent in one request matching Gemini API specs.
            if (activeModel.toLowerCase().includes('gemini')) {
                const userContent: any[] = [{
                    type: 'text',
                    text: `DIRECT MULTIMODAL REFERENCE PROTOCOL
You are receiving ${referenceImages.length} original input image(s), each followed by an authoritative label.
Inspect and use the actual pixels directly. Preserve exact visible garment/accessory colors, patterns, cuts, embroidery, layers, textures and distinguishing details.
Never swap, merge or cross-apply details between labels. Ignore all backgrounds visible inside the reference images; the final background must come only from the generation instructions after the references.`
                }];

                referenceImages.forEach((image, index) => {
                    userContent.push({
                        type: 'text',
                        text: `REFERENCE ${index + 1} — ${image.label || `INPUT IMAGE ${index + 1}`}`
                    });
                    userContent.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}`,
                            detail: 'high'
                        }
                    });
                });

                userContent.push({
                    type: 'text',
                    text: `FINAL GENERATION INSTRUCTIONS
Target aspect ratio: ${ratio}
Target resolution size: ${pixelSize}
${fullDirective}

${request.prompt}`
                });

                const chatBody: any = {
                    model: activeModel,
                    messages: [{ role: 'user', content: userContent }],
                    modalities: ['text', 'image'],
                    stream: false
                };

                console.log(`[9Router] Sending native multimodal image request to model: ${activeModel}, ratio: ${ratio}, pixelSize: ${pixelSize}, references: ${referenceImages.length}`);
                const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(chatBody)
                }, 120000);

                if (!resp.ok) {
                    const errText = await resp.text();
                    throw new Error(`HTTP ${resp.status}: ${errText}`);
                }

                const parsed = await parseNineRouterResponse(resp);
                const image = extractImageFromChatResponse(parsed);
                if (!image) {
                    throw new Error('Máy chủ Cấu hình không trả về dữ liệu ảnh.');
                }
                return image;
            }

            // For non-Gemini models (OpenAI GPT Image models, etc.):
            // On 9Router/OpenAI-compatible gateways, image-to-image with reference inputs uses /v1/images/edits
            const editPayload: any = {
                model: activeModel,
                prompt: `${fullDirective}\n\n${request.prompt}`,
                images: referenceImages.map(img => ({
                    image_url: `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                })),
                image: `data:${referenceImages[0].mimeType || 'image/jpeg'};base64,${referenceImages[0].data}`,
                reference_images: referenceImages.map(img => `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`),
                size: pixelSize,
                aspect_ratio: ratio,
                n: 1,
                response_format: 'b64_json',
                image_config: {
                    aspect_ratio: ratio
                },
                extra_body: {
                    aspect_ratio: ratio,
                    size: pixelSize
                }
            };

            console.log(`[9Router] Sending image edit request to model: ${activeModel}, ratio: ${ratio}, size: ${pixelSize}, references: ${referenceImages.length}`);
            let resp = await fetchWithTimeout(`${baseUrl}/images/edits`, {
                method: 'POST',
                headers,
                body: JSON.stringify(editPayload)
            }, 120000);

            // If 400 error occurs due to strict OpenAI size check, retry /images/edits with standard OpenAI size
            if (!resp.ok && resp.status === 400) {
                const standardSize = getOpenAiStandardSize(request.aspectRatio);
                console.warn(`[9Router] Retrying /images/edits with standard size: ${standardSize}`);
                resp = await fetchWithTimeout(`${baseUrl}/images/edits`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ...editPayload,
                        size: standardSize
                    })
                }, 120000);
            }

            // Fallback: If gateway does not have /images/edits (404/405), fallback to /images/generations
            if (!resp.ok && (resp.status === 404 || resp.status === 405)) {
                console.warn(`[9Router] /images/edits returned HTTP ${resp.status}, falling back to /images/generations`);
                resp = await fetchWithTimeout(`${baseUrl}/images/generations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(editPayload)
                }, 90000);

                if (!resp.ok && resp.status === 400) {
                    const standardSize = getOpenAiStandardSize(request.aspectRatio);
                    resp = await fetchWithTimeout(`${baseUrl}/images/generations`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            model: activeModel,
                            prompt: `${fullDirective}\n\n${request.prompt}`,
                            n: 1,
                            response_format: 'b64_json',
                            size: standardSize
                        })
                    }, 90000);
                }
            }

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(`HTTP ${resp.status}: ${errText}`);
            }

            const parsed = await parseNineRouterResponse(resp);
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

            throw new Error('Máy chủ Cấu hình không trả về dữ liệu ảnh.');
        }

        // Pure text-to-image path: Gemini models use /chat/completions with modalities ['text', 'image']
        if (activeModel.toLowerCase().includes('gemini')) {
            const userContent: any[] = [{
                type: 'text',
                text: `${fullDirective}\n\n${request.prompt}`
            }];
            console.log(`[9Router] Sending text-to-image chat request to Gemini model: ${activeModel}, ratio: ${ratio}`);
            const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: activeModel,
                    messages: [{ role: 'user', content: userContent }],
                    modalities: ['text', 'image'],
                    stream: false
                })
            }, 90000);

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(`HTTP ${resp.status}: ${errText}`);
            }

            const parsed = await parseNineRouterResponse(resp);
            const image = extractImageFromChatResponse(parsed);
            if (!image) {
                throw new Error('Máy chủ Cấu hình không trả về dữ liệu ảnh.');
            }
            return image;
        }

        // Standard text-to-image path for GPT image and other models:
        const payload: any = {
            model: activeModel,
            prompt: `${fullDirective}\n\n${request.prompt}`,
            n: 1,
            response_format: 'b64_json',
            size: pixelSize,
            aspect_ratio: ratio,
            image_config: {
                aspect_ratio: ratio
            },
            extra_body: {
                aspect_ratio: ratio,
                size: pixelSize
            }
        };

        console.log(`[9Router] Sending text-to-image request to model: ${activeModel}, ratio: ${ratio}, size: ${pixelSize}`);
        let resp = await fetchWithTimeout(`${baseUrl}/images/generations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        }, 90000);

        // If 400 error occurs due to strict OpenAI size check, retry with OpenAI standard size
        if (!resp.ok && resp.status === 400) {
            const standardSize = getOpenAiStandardSize(request.aspectRatio);
            console.warn(`[9Router] Retrying with standard size: ${standardSize}`);
            resp = await fetchWithTimeout(`${baseUrl}/images/generations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: activeModel,
                    prompt: `${fullDirective}\n\n${request.prompt}`,
                    n: 1,
                    response_format: 'b64_json',
                    size: standardSize
                })
            }, 90000);
        }

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${errText}`);
        }

        const parsed = await parseNineRouterResponse(resp);
        const payloads = parsed.events.length > 0
            ? parsed.events
            : parsed.json
                ? [parsed.json]
                : [];

        const imageItems = payloads.flatMap(payloadItem => Array.isArray(payloadItem?.data) ? payloadItem.data : []);
        const first = imageItems[0];
        if (first?.b64_json && first.b64_json.length > 100) {
            return first.b64_json;
        }

        if (typeof first?.url === 'string') {
            const dataUrlImage = extractBase64FromDataUri(first.url);
            if (dataUrlImage) return dataUrlImage;

            if (first.url.startsWith('http')) {
                console.log(`[9Router] Downloading image from URL: ${first.url}`);
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
    } catch (err: any) {
        console.error('[9Router] Image generation error:', err);
        throw err;
    }
};
