/**
 * NineRouter Integration Service
 * 
 * This service provides integration with 9Router,
 * a local/remote OpenAI-compatible routing gateway running at http://127.0.0.1:20128.
 */

// --- Constants ---
const DEFAULT_NINEROUTER_URL = 'http://127.0.0.1:20128/v1';
const DEFAULT_IMAGE_MODEL = 'ag/gemini-3.1-flash-image';
const DEFAULT_TEXT_MODEL = 'ag/gemini-3-flash';

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

// --- Storage Functions ---
export const setNineRouterEnabled = (value: boolean): void => {
    localStorage.setItem(NINEROUTER_ENABLED_KEY, value ? 'true' : 'false');
    // Dispatch event for real-time UI updates
    window.dispatchEvent(new CustomEvent('ninerouter-status-changed', {
        detail: { enabled: value }
    }));
};

export const isNineRouterEnabled = (): boolean => {
    return localStorage.getItem(NINEROUTER_ENABLED_KEY) === 'true';
};

export const setNineRouterUrl = (url: string): void => {
    localStorage.setItem(NINEROUTER_URL_KEY, url.trim() || DEFAULT_NINEROUTER_URL);
};

export const getNineRouterUrl = (): string => {
    let url = localStorage.getItem(NINEROUTER_URL_KEY) || DEFAULT_NINEROUTER_URL;
    url = url.trim();
    if (!url) return DEFAULT_NINEROUTER_URL;
    
    // Automatically append /v1 if missing and it's not a direct endpoint
    if (!url.endsWith('/v1') && !url.includes('/v1/')) {
        url = url.replace(/\/$/, '') + '/v1';
    }
    return url;
};

export const setNineRouterApiKey = (key: string): void => {
    localStorage.setItem(NINEROUTER_API_KEY_KEY, key.trim());
};

export const getNineRouterApiKey = (): string => {
    return localStorage.getItem(NINEROUTER_API_KEY_KEY) || '';
};

export const setNineRouterImageModel = (model: string): void => {
    localStorage.setItem(NINEROUTER_IMAGE_MODEL_KEY, model.trim() || DEFAULT_IMAGE_MODEL);
};

export const getNineRouterImageModel = (): string => {
    return localStorage.getItem(NINEROUTER_IMAGE_MODEL_KEY) || DEFAULT_IMAGE_MODEL;
};

export const setNineRouterTextModel = (model: string): void => {
    localStorage.setItem(NINEROUTER_TEXT_MODEL_KEY, model.trim() || DEFAULT_TEXT_MODEL);
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
    let baseUrl = customUrl ? customUrl.trim() : getNineRouterUrl();
    if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
    }
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
        }, 8000);

        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                return {
                    connected: false,
                    errorType: 'auth',
                    errorMessage: 'API Key không hợp lệ hoặc thiếu quyền truy cập.',
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
            errorMessage: 'Không thể kết nối tới 9Router. Vui lòng đảm bảo server đang chạy và URL chính xác.',
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
    const referenceImages = request.referenceImages || [];

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const ratio = mapRatioForNineRouter(request.aspectRatio);

    try {
        if (referenceImages.length > 0) {
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
                text: `FINAL GENERATION INSTRUCTIONS\nTarget aspect ratio: ${ratio}\n\n${request.prompt}`
            });

            console.log(`[9Router] Sending native multimodal image request to model: ${activeModel}, ratio: ${ratio}, references: ${referenceImages.length}`);
            const resp = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: activeModel,
                    messages: [{ role: 'user', content: userContent }],
                    modalities: ['text', 'image'],
                    stream: false
                })
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

        // Pure text-to-image path: no input pixels need to be preserved.
        const payload = {
            model: activeModel,
            prompt: request.prompt,
            n: 1,
            response_format: 'b64_json',
            size: ratio
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
