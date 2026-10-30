/**
 * NineRouter Integration Service
 * 
 * This service provides integration with 9Router,
 * a local/remote OpenAI-compatible routing gateway running at http://127.0.0.1:20128.
 */

import { optimizeReferenceImages } from './imageOptimizer';

// --- Constants ---
const DEFAULT_NINEROUTER_URL = 'http://158.178.235.87:20128/v1';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5';
const DEFAULT_TEXT_MODEL = 'claude-sonnet-4-6';

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
        id: 'gpt-image-2.5',
        name: 'GPT Image 2.5',
        shortName: 'GPT 2.5',
        tag: 'Cao cấp',
        tagColor: 'purple',
        description: 'Tái tạo ánh sáng, da dẻ và chi tiết trang phục với độ chân thực cao nhất',
        speed: 'medium',
        isDefault: true
    },
    {
        id: 'ag/gemini-3.1-flash-image',
        name: 'Gemini 3.1 Flash Image',
        shortName: 'Gemini 3.1 Flash',
        tag: 'Nhanh nhất',
        tagColor: 'emerald',
        description: 'Tốc độ 3-5s, tối ưu chuẩn xác khuôn mặt & ghép trang phục H’Mông',
        speed: 'fast'
    },
    {
        id: 'ag/gemini-3-pro-image',
        name: 'Gemini 3 Pro Studio',
        shortName: 'Gemini 3 Pro',
        tag: 'Chi tiết cao',
        tagColor: 'blue',
        description: 'Chất lượng ảnh studio sắc nét, render text và hoa văn trang phục tinh xảo',
        speed: 'medium'
    },
    {
        id: 'imagen-3.0-generate-002',
        name: 'Imagen 3.0 Ultra',
        shortName: 'Imagen 3',
        tag: 'Điện ảnh',
        tagColor: 'amber',
        description: 'Phong cách photorealism điện ảnh, chiều sâu và màu sắc mượt mà',
        speed: 'medium'
    },
    {
        id: 'gpt-image-1.5',
        name: 'GPT Image 1.5',
        shortName: 'GPT 1.5',
        tag: 'Cân bằng',
        tagColor: 'indigo',
        description: 'Cân bằng tốc độ và độ sắc nét, tiết kiệm quota',
        speed: 'fast'
    },
    {
        id: 'ag/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash',
        shortName: 'Gemini 2.5',
        tag: 'Ổn định',
        tagColor: 'slate',
        description: 'Mô hình dự phòng ổn định cao, phản hồi nhanh',
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
    return localStorage.getItem(NINEROUTER_IMAGE_MODEL_KEY) || DEFAULT_IMAGE_MODEL;
};

export const setNineRouterTextModel = (model: string): void => {
    const cleanModel = model.trim() || DEFAULT_TEXT_MODEL;
    localStorage.setItem(NINEROUTER_TEXT_MODEL_KEY, cleanModel);
    window.dispatchEvent(new CustomEvent('ninerouter-textmodel-changed', {
        detail: { model: cleanModel }
    }));
};

export const getNineRouterTextModel = (): string => {
    return localStorage.getItem(NINEROUTER_TEXT_MODEL_KEY) || DEFAULT_TEXT_MODEL;
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
                    errorMessage: 'API Key không hợp lệ hoặc thiếu quyền truy cập (HTTP 401/403). Vui lòng nhập API Key 9Router đúng.',
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
            errorMessage: 'Không thể kết nối tới 9Router. Vui lòng kiểm tra server 9Router hoặc URL endpoint.',
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
 * Composition and camera framing directive to prevent subject cutoff when rendering non-square ratios.
 * Directs the AI model to frame the subjects centrally with wide safety buffers so subjects are NEVER cropped.
 */
export const getAspectFramingDirective = (aspectRatio?: string): string => {
    switch (aspectRatio) {
        case '9:16':
            return `*** MANDATORY 9:16 VERTICAL FRAMING & CAMERA COMPOSITION DIRECTIVE ***
- TARGET RATIO: 9:16 Ultra-tall vertical portrait orientation.
- CAMERA FRAMING: Wide environmental shot (Full-body / Wide angle). Pull camera back significantly to capture the full environment.
- SUBJECT PLACEMENT: Keep all characters strictly centered within the central 50% width column of the frame.
- MANDATORY SAFE ZONE: Leave generous empty margins (at least 25% empty background buffer) on BOTH the left and right sides.
- NEVER CROP SUBJECTS: Heads, hair, entire bodies, arms, hands, accessories, and wide dresses/skirts MUST be completely contained inside the central safe zone.
- Absolutely DO NOT place people, limbs, or garments near the outer lateral edges.`;

        case '16:9':
            return `*** MANDATORY 16:9 WIDESCREEN FRAMING & CAMERA COMPOSITION DIRECTIVE ***
- TARGET RATIO: 16:9 Cinematic Landscape Orientation.
- CAMERA FRAMING: Wide panoramic landscape framing with expansive horizontal views.
- VERTICAL SAFE ZONE: Provide generous clearance above heads (headroom) and below feet (footroom).
- NEVER CROP SUBJECTS: Never cut off the top of heads, hairstyles, hats, or bottom of shoes/feet.`;

        case '3:4':
            return `*** MANDATORY 3:4 PORTRAIT FRAMING DIRECTIVE ***
- TARGET RATIO: 3:4 Vertical Portrait.
- CAMERA FRAMING: Pulled-back portrait shot with at least 15% safety margins on left and right borders.
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

const aspectRatioToPixelSize = (aspectRatio?: string): string => {
    switch (aspectRatio) {
        case '16:9': return '1280x720';
        case '9:16': return '720x1280';
        case '4:3': return '1152x864';
        case '3:4': return '864x1152';
        case '3:2': return '1216x816';
        case '2:3': return '816x1216';
        case '1:1':
        default: return '1024x1024';
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
            throw new Error('9Router returned no text content. Hãy kiểm tra Text Model trong cấu hình.');
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
    const pixelSize = aspectRatioToPixelSize(request.aspectRatio);
    const framingDirective = getAspectFramingDirective(request.aspectRatio);

    try {
        if (referenceImages.length > 0) {
            // OpenAI / Codex image models (gpt-image-1.5, gpt-image-2, etc.) use /v1/images/edits for image-to-image
            if (activeModel.toLowerCase().includes('gpt-image') || !activeModel.toLowerCase().includes('gemini')) {
                const editPayload = {
                    model: activeModel,
                    prompt: `${framingDirective}\n\n${request.prompt}`,
                    images: referenceImages.map(img => ({
                        image_url: `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                    })),
                    size: pixelSize,
                    n: 1,
                    response_format: 'b64_json'
                };

                console.log(`[9Router] Sending image edit request to model: ${activeModel}, ratio: ${ratio}, size: ${pixelSize}, references: ${referenceImages.length}`);
                const resp = await fetchWithTimeout(`${baseUrl}/images/edits`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(editPayload)
                }, 120000);

                if (!resp.ok) {
                    const errText = await resp.text();
                    throw new Error(`HTTP ${resp.status}: ${errText}`);
                }

                const parsed = await parseNineRouterResponse(resp);
                const image = extractImageFromChatResponse(parsed);
                if (!image) {
                    throw new Error('9Router image edit model không trả về dữ liệu ảnh.');
                }
                return image;
            }

            // Native multimodal path: original image pixels and the complete prompt are
            // sent to the SAME image model, matching Gemini API/PRO semantics.
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
${framingDirective}

${request.prompt}`
            });

            const chatBody: any = {
                model: activeModel,
                messages: [{ role: 'user', content: userContent }],
                modalities: ['text', 'image'],
                stream: false
            };

            // Only send image_config / aspect_ratio if not a Gemini model
            // (Google Antigravity rejects aspect_ratio with "Aspect ratio is not enabled for this model")
            if (!activeModel.toLowerCase().includes('gemini')) {
                chatBody.aspect_ratio = ratio;
                chatBody.size = pixelSize;
                chatBody.image_config = { aspect_ratio: ratio };
                chatBody.extra_body = {
                    aspect_ratio: ratio,
                    size: pixelSize,
                    image_config: { aspect_ratio: ratio }
                };
            }

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
                throw new Error('9Router multimodal image model không trả về dữ liệu ảnh.');
            }
            return image;
        }

        // Pure text-to-image path: Gemini models use /chat/completions with modalities ['text', 'image']
        if (activeModel.toLowerCase().includes('gemini')) {
            const userContent: any[] = [{
                type: 'text',
                text: `${framingDirective}\n\n${request.prompt}`
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
                throw new Error('9Router multimodal image model không trả về dữ liệu ảnh.');
            }
            return image;
        }

        // Standard text-to-image path for other providers:
        const payload = {
            model: activeModel,
            prompt: `${framingDirective}\n\n${request.prompt}`,
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

        console.log(`[9Router] Sending text-to-image request to model: ${activeModel}, ratio: ${ratio}`);
        const resp = await fetchWithTimeout(`${baseUrl}/images/generations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        }, 90000);

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
        if (!first) return null;

        if (typeof first.b64_json === 'string' && first.b64_json.length > 100) {
            return first.b64_json;
        }

        if (typeof first.url === 'string') {
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

        return null;
    } catch (err: any) {
        console.error('[9Router] Image generation error:', err);
        throw err;
    }
};
