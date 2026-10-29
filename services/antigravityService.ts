/**
 * Antigravity Manager Service
 * 
 * This service provides integration with Antigravity Manager,
 * allowing users to use Google OAuth accounts instead of API keys
 * for Gemini API access.
 * 
 * Antigravity Manager runs locally at http://127.0.0.1:8045 and provides:
 * - Google GenAI SDK compatible proxy (recommended)
 * - OpenAI-compatible API endpoints
 * - Automatic account rotation to avoid rate limits
 * - Multi-account pooling for higher quota
 */

// Import Google GenAI SDK for using with Antigravity proxy
import { GoogleGenAI } from "@google/genai";

// Import VIP quality constraints from aiService
import {
    ULTRA_SHARP_QUALITY,
    KOREAN_CHARACTER_DEFAULTS,
    CLEAN_OUTPUT_REQUIREMENTS,
    NO_EXTRA_ACCESSORIES,
    FACE_IDENTITY_PRESERVATION,
    ASPECT_RATIO_ENFORCEMENT
} from './aiService';
import { getSelectedResolution } from './geminiCoreService';

// --- Constants ---
const DEFAULT_ANTIGRAVITY_URL = 'http://127.0.0.1:8045';
const ANTIGRAVITY_ENABLED_KEY = 'antigravity_enabled';
const ANTIGRAVITY_URL_KEY = 'antigravity_url';
const ANTIGRAVITY_API_KEY_KEY = 'antigravity_api_key';

// Default API Key (fallback if not detected)
const DEFAULT_API_KEY = 'sk-antigravity';

// Common ports used by Antigravity Tools
const POSSIBLE_PORTS = [8045, 19527, 8080, 3000, 5000, 8000];

// --- Aspect Ratio to Size Mapping for OpenAI-compatible format ---
// Antigravity uses OpenAI format with "size" parameter instead of aspect ratio
const aspectRatioToSize = (aspectRatio?: string): string => {
    switch (aspectRatio) {
        case '16:9': return '1280x720';
        case '9:16': return '720x1280';
        case '4:3': return '1216x896';
        case '3:4': return '896x1216';
        case '3:2': return '1216x896';
        case '2:3': return '896x1216';
        case '1:1':
        default: return '1024x1024';
    }
};

// Get model name with aspect ratio suffix for Antigravity
// IMPORTANT:
// - Prefer base model + size param (recommended by Antigravity)
// - Some versions also support ratio suffix format: gemini-3-pro-image-16-9
const getModelWithAspectSuffix = (baseModel: string, aspectRatio?: string): string => {
    // Only add suffix for image generation models
    if (!baseModel.includes('image')) return baseModel;

    // Aspect ratio suffix: "16:9" -> "16-9"
    const ratioMap: Record<string, string> = {
        '16:9': '16-9',
        '9:16': '9-16',
        '4:3': '4-3',
        '3:4': '3-4',
        '3:2': '3-2',
        '2:3': '2-3',
        '21:9': '21-9',
        '1:1': '',
    };
    const ratioSuffix = aspectRatio ? ratioMap[aspectRatio] || '' : '';

    // Build full model name: gemini-3-pro-image[-ratio]
    // Examples: gemini-3-pro-image-9-16, gemini-3-pro-image-16-9
    let result = baseModel;
    if (ratioSuffix) result += `-${ratioSuffix}`;

    console.log(`[Antigravity] Model mapping: ${baseModel} + ${aspectRatio || '1:1'} → ${result}`);
    return result;
};

// Backward compatibility for old naming conventions seen in some forks
const getModelWithLegacyXSuffix = (baseModel: string, aspectRatio?: string): string => {
    if (!baseModel.includes('image')) return baseModel;

    const ratioMap: Record<string, string> = {
        '16:9': '16x9',
        '9:16': '9x16',
        '4:3': '4x3',
        '3:4': '3x4',
        '3:2': '3x2',
        '2:3': '2x3',
        '21:9': '21x9',
        '1:1': '',
    };
    const ratioSuffix = aspectRatio ? ratioMap[aspectRatio] || '' : '';
    return ratioSuffix ? `${baseModel}-${ratioSuffix}` : baseModel;
};

const buildImageModelCandidates = (baseModel: string, aspectRatio?: string): string[] => {
    const candidates = [
        baseModel,
        getModelWithAspectSuffix(baseModel, aspectRatio),
        getModelWithLegacyXSuffix(baseModel, aspectRatio),
        'gemini-3-pro-image',
        'gemini-3-pro-image-preview',
        getModelWithAspectSuffix('gemini-3-pro-image', aspectRatio),
        getModelWithLegacyXSuffix('gemini-3-pro-image', aspectRatio),
        'imagen-4.0-ultra-generate-001',
        'imagen-3.0-generate-002',
        getModelWithAspectSuffix('gemini-2.5-flash-image', aspectRatio),
        getModelWithLegacyXSuffix('gemini-2.5-flash-image', aspectRatio),
        'gemini-2.5-flash-image'
    ];

    return candidates.filter((v, i, a) => !!v && a.indexOf(v) === i);
};

let cachedModelList: { baseUrl: string; modelIds: string[]; ts: number } | null = null;
const MODELS_CACHE_TTL_MS = 15000;

const getAvailableModelIds = async (baseUrl: string): Promise<string[] | null> => {
    if (cachedModelList && cachedModelList.baseUrl === baseUrl && Date.now() - cachedModelList.ts < MODELS_CACHE_TTL_MS) {
        return cachedModelList.modelIds;
    }

    try {
        const resp = await fetchWithTimeout(`${baseUrl}/v1/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAntigravityApiKey()}`
            }
        }, 4000);

        if (!resp.ok) return null;

        const json = await resp.json();
        const ids = Array.isArray(json?.data)
            ? json.data.map((m: any) => String(m?.id || '')).filter(Boolean)
            : [];

        if (ids.length > 0) {
            cachedModelList = { baseUrl, modelIds: ids, ts: Date.now() };
            return ids;
        }
    } catch {
        // ignore
    }

    return null;
};

const isModelNotFoundError = (status: number, errorText: string): boolean => {
    if (status === 404) return true;
    const msg = (errorText || '').toLowerCase();
    return msg.includes('requested entity was not found') ||
        msg.includes('not_found') ||
        msg.includes('model not found') ||
        msg.includes('unknown model');
};

const getImageQualityHints = (): { quality?: 'hd' | 'medium'; imageSize?: '4K' | '2K' } => {
    const resolution = getSelectedResolution();
    if (resolution === '4K') return { quality: 'hd', imageSize: '4K' };
    if (resolution === '2K') return { quality: 'medium', imageSize: '2K' };
    return {};
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType || 'image/jpeg' });
};

const extractImageFromOpenAIImageResponse = (data: any): string | null => {
    const first = data?.data?.[0];
    if (!first) return null;

    if (typeof first.b64_json === 'string' && first.b64_json.length > 100) {
        return first.b64_json;
    }

    if (typeof first.url === 'string') {
        const dataUrlMatch = first.url.match(/^data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)$/);
        if (dataUrlMatch) return dataUrlMatch[1];
    }

    return null;
};

const generateImageViaOpenAIImagesEndpoints = async (
    baseUrl: string,
    modelCandidates: string[],
    prompt: string,
    aspectRatio?: string,
    referenceImages: Array<{ data: string; mimeType: string }> = []
): Promise<string | null> => {
    const { quality, imageSize } = getImageQualityHints();
    const useEditsEndpoint = referenceImages.length > 0;
    let selectedCandidates = useEditsEndpoint
        ? modelCandidates.filter(m => m.includes('pro-image')).slice(0, 3)
        : modelCandidates;

    // If Antigravity exposes model list, keep only actually available models.
    // This avoids long retries on models that upstream does not have.
    const availableModelIds = await getAvailableModelIds(baseUrl);
    if (availableModelIds && availableModelIds.length > 0) {
        const availableLower = new Set(availableModelIds.map(m => m.toLowerCase()));
        const exactMatches = selectedCandidates.filter(c => availableLower.has(c.toLowerCase()));

        if (exactMatches.length > 0) {
            selectedCandidates = exactMatches;
        } else {
            const discoveredImageModels = availableModelIds.filter(m => /image|imagen/i.test(m));
            if (discoveredImageModels.length > 0) {
                selectedCandidates = discoveredImageModels.slice(0, 3);
                console.warn('[Antigravity Images] Using discovered image-capable models from /v1/models:', selectedCandidates);
            }
        }
    }

    selectedCandidates = selectedCandidates.filter((v, i, a) => !!v && a.indexOf(v) === i);

    const effectiveImageSize = useEditsEndpoint && imageSize === '4K' ? '2K' : imageSize;
    const effectiveQuality = useEditsEndpoint && quality === 'hd' ? 'medium' : quality;
    const timeoutMs = useEditsEndpoint ? 120000 : 90000;

    if (useEditsEndpoint && imageSize === '4K') {
        console.warn('[Antigravity Images] image edits + 4K is very slow, auto-downgrading to 2K for stability');
    }

    if (selectedCandidates.length === 0) {
        console.error('[Antigravity Images] No image model candidate available.');
        return null;
    }

    for (const currentModel of selectedCandidates) {
        try {
            let response: Response;

            if (useEditsEndpoint) {
                const formData = new FormData();
                formData.append('model', currentModel);
                formData.append('prompt', prompt);
                formData.append('n', '1');
                formData.append('response_format', 'b64_json');
                if (aspectRatio) formData.append('aspect_ratio', aspectRatio);
                if (effectiveImageSize) formData.append('image_size', effectiveImageSize);

                referenceImages.forEach((img, index) => {
                    const blob = base64ToBlob(img.data, img.mimeType || 'image/jpeg');
                    const ext = img.mimeType?.includes('png') ? 'png' : 'jpg';
                    formData.append(`image${index + 1}`, blob, `reference-${index + 1}.${ext}`);
                });

                console.log('[Antigravity Images] Trying /v1/images/edits with model:', currentModel, 'aspectRatio:', aspectRatio, 'imageSize:', effectiveImageSize, 'refs:', referenceImages.length, 'timeoutMs:', timeoutMs);

                response = await fetchWithTimeout(`${baseUrl}/v1/images/edits`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getAntigravityApiKey()}`
                    },
                    body: formData
                }, timeoutMs);
            } else {
                const payload: any = {
                    model: currentModel,
                    prompt,
                    n: 1,
                    response_format: 'b64_json',
                    size: aspectRatio || '1:1'
                };

                if (effectiveQuality) payload.quality = effectiveQuality;
                if (effectiveImageSize) payload.image_size = effectiveImageSize;

                console.log('[Antigravity Images] Trying /v1/images/generations with model:', currentModel, 'size:', payload.size, 'quality:', effectiveQuality || 'default', 'imageSize:', effectiveImageSize || 'default', 'timeoutMs:', timeoutMs);

                response = await fetchWithTimeout(`${baseUrl}/v1/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAntigravityApiKey()}`
                    },
                    body: JSON.stringify(payload)
                }, timeoutMs);
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Antigravity Images] Failed:', response.status, errorText);

                if (response.status === 429) {
                    console.error('[Antigravity] QUOTA EXHAUSTED DETECTED - Please switch account!');
                    return null;
                }

                if (isModelNotFoundError(response.status, errorText)) {
                    console.warn(`[Antigravity Images] Model not found: ${currentModel}. Trying fallback model...`);
                    continue;
                }

                continue;
            }

            const data = await response.json();
            const extracted = extractImageFromOpenAIImageResponse(data);
            if (extracted) {
                console.log('[Antigravity Images] Success with model:', currentModel);
                return extracted;
            }

            console.warn('[Antigravity Images] No image data in response for model:', currentModel);
        } catch (err) {
            console.error('[Antigravity Images] Endpoint error with model:', currentModel, err);
        }
    }

    return null;
};

// Cache duration for connection status (30 seconds)
const STATUS_CACHE_DURATION = 30000;

// Get API key from localStorage or use default
const getAntigravityApiKey = (): string => {
    return localStorage.getItem(ANTIGRAVITY_API_KEY_KEY) || DEFAULT_API_KEY;
};

// Save API key to localStorage
export const setAntigravityApiKey = (key: string): void => {
    localStorage.setItem(ANTIGRAVITY_API_KEY_KEY, key);
};

// Get current saved API key (for UI display)
export const getSavedApiKey = (): string => {
    return localStorage.getItem(ANTIGRAVITY_API_KEY_KEY) || '';
};

// --- Types ---
export interface AntigravityStatus {
    connected: boolean;
    version?: string;
    accountCount?: number;
    lastChecked: number;
}

export interface AntigravityImageRequest {
    prompt: string;
    referenceImages?: Array<{ data: string; mimeType: string }>;
    aspectRatio?: string;
    model?: string;
    // VIP-related options
    useVIPPrompt?: boolean;
    hasMaleAccessories?: boolean;
    hasFemaleAccessories?: boolean;
    sessionSeed?: number;
}

// --- VIP Prompt Builder ---
/**
 * Build a VIP-enhanced prompt with all quality constraints
 * This ensures Antigravity outputs match VIP mode quality
 */
const buildVIPPrompt = (
    basePrompt: string,
    options?: {
        aspectRatio?: string;
        hasMaleAccessories?: boolean;
        hasFemaleAccessories?: boolean;
        sessionSeed?: number;
    }
): string => {
    const { aspectRatio, hasMaleAccessories = false, hasFemaleAccessories = false, sessionSeed } = options || {};

    const accessoryConstraint = hasMaleAccessories || hasFemaleAccessories
        ? `- ACCESSORY CLONING: The accessory image(s) provided MUST appear in the output EXACTLY as shown.
         - Male has accessory: ${hasMaleAccessories ? 'YES - clone it exactly' : 'NO - empty hands'}
         - Female has accessory: ${hasFemaleAccessories ? 'YES - clone it exactly' : 'NO - empty hands'}`
        : `- NO ACCESSORIES PROVIDED: Both characters should have EMPTY HANDS. Do NOT add any props, instruments, or items.`;

    // --- SUBJECT CUTOFF PREVENTION LOGIC ---
    // Problem: When generating 1:1 and then cropping to 16:9, vertical info (heads/feet) is lost.
    // Solution: Force "Zoom Out" / "Wide Shot" when aspect ratio is not 1:1, so the subject fits in the center.
    let zoomInstructions = "";
    if (aspectRatio && aspectRatio !== '1:1') {
        zoomInstructions = `
        🚨 FRAMING REQUIREMENT:
        - CAMERA ANGLE: WIDE ANGLE SHOT, ZOOM OUT, FAR AWAY.
        - COMPOSITION: Subject MUST be small in the center with A LOT of empty space around.
        - FULL BODY: Ensure the ENTIRE subject (head to toe) is visible with ample headroom.
        - DO NOT CROP: Do not cut off the head or feet. Keep the subject fully contained in the center.
        `;
    }

    return `
🚨🚨🚨 ASPECT RATIO: ${aspectRatio || '1:1'} - THIS IS MANDATORY AND NON-NEGOTIABLE 🚨🚨🚨
${ASPECT_RATIO_ENFORCEMENT}

${zoomInstructions}

*** MASTER IDENTITY & OUTFIT CONSTRAINT PROTOCOL ***

*** CRITICAL: PERSON IN CLOTHING ENFORCEMENT ***
- OUTPUT MUST BE: A COMPLETE PHOTOGRAPH of REAL PERSON(S) wearing the clothing
- NEVER output: Just clothing without a person, mannequin displays, flat-lay product shots, or clothing on hangers
- MANDATORY: Every generated image MUST show a FULL HUMAN BODY (or at minimum half-body portrait) with the person WEARING the outfit
- The person(s) should be in a NATURAL POSE in the scene, interacting with the environment
- REJECT any output that shows only the garment/fabric without a human wearing it

${KOREAN_CHARACTER_DEFAULTS}

VIRTUAL TRY-ON ENFORCEMENT: 
- The input images are NOT just inspiration. They are TEXTURES to be mapped.
- You MUST clone the patterns, colors, cuts, and every detail of the clothing EXACTLY 100%.
- CLOTHING MUST BE WORN BY THE PERSON - never floating, never displayed separately
${sessionSeed ? `- IDENTITY LOCK: Use SEED ${sessionSeed} to maintain consistent features across all generated images.` : ''}
- GENDER BINDING: Apply 'Male Outfit' inputs ONLY to the Male character. Apply 'Female Outfit' inputs ONLY to the Female character.
${accessoryConstraint}

${NO_EXTRA_ACCESSORIES}

${CLEAN_OUTPUT_REQUIREMENTS}

${ULTRA_SHARP_QUALITY}

SCENE DESCRIPTION: ${basePrompt}

⚠️ FINAL REMINDER: OUTPUT MUST BE EXACTLY ${aspectRatio || '1:1'} ASPECT RATIO - DO NOT DEVIATE ⚠️
`;
};

// --- Storage Functions ---
export const setAntigravityEnabled = (value: boolean): void => {
    localStorage.setItem(ANTIGRAVITY_ENABLED_KEY, value ? 'true' : 'false');
    // Dispatch event for real-time UI updates
    window.dispatchEvent(new CustomEvent('antigravity-status-changed', {
        detail: { enabled: value }
    }));
};

export const isAntigravityEnabled = (): boolean => {
    return localStorage.getItem(ANTIGRAVITY_ENABLED_KEY) === 'true';
};

export const setAntigravityUrl = (url: string): void => {
    localStorage.setItem(ANTIGRAVITY_URL_KEY, url.trim() || DEFAULT_ANTIGRAVITY_URL);
};

export const getAntigravityUrl = (): string => {
    return localStorage.getItem(ANTIGRAVITY_URL_KEY) || DEFAULT_ANTIGRAVITY_URL;
};

// --- Connection Check ---
let cachedStatus: AntigravityStatus | null = null;

/**
 * Timeout helper for fetch requests
 */
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 20000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
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

/**
 * Check if Antigravity Manager is running and accessible
 * OPTIMIZED: Checks all ports in parallel (RACE strategy) for instant feedback
 */
export const checkConnection = async (): Promise<AntigravityStatus> => {
    // Return cached status if still valid
    if (cachedStatus && (Date.now() - cachedStatus.lastChecked) < STATUS_CACHE_DURATION) {
        return cachedStatus;
    }

    const savedUrl = getAntigravityUrl();

    // Fast path: only check saved URL first to avoid noisy probing logs
    const savedStatus = await tryConnection(savedUrl);
    if (savedStatus.connected) {
        cachedStatus = savedStatus;
        return cachedStatus;
    }

    // Fallback: if saved URL failed, try auto-discovering another port once
    const activeConn = await findBestConnection();
    if (activeConn) {
        if (activeConn.url !== savedUrl) {
            console.log(`[Antigravity] Auto-detected new port: ${activeConn.url}`);
            setAntigravityUrl(activeConn.url);
        }
        cachedStatus = activeConn.status;
        return cachedStatus;
    }

    // Nothing worked
    cachedStatus = {
        connected: false,
        lastChecked: Date.now()
    };
    return cachedStatus;
};

/**
 * Helper to race connections and find the first working one
 */
const findBestConnection = async (): Promise<{ url: string, status: AntigravityStatus } | null> => {
    const savedUrl = getAntigravityUrl();
    const candidates = [savedUrl, ...POSSIBLE_PORTS.map(p => `http://127.0.0.1:${p}`)].filter((v, i, a) => a.indexOf(v) === i);

    // Create a promise for each candidate that resolves ONLY if connected, otherwise rejects
    const checks = candidates.map(async (url) => {
        const status = await tryConnection(url);
        if (status.connected) return { url, status };
        throw new Error('Not connected');
    });

    try {
        // Promise.any returns the first successfully fulfilled promise
        return await Promise.any(checks);
    } catch (e) {
        return null;
    }
};

/**
 * Try to connect to a specific Antigravity URL
 * Now accepts multiple response codes as "connected"
 */
const tryConnection = async (baseUrl: string): Promise<AntigravityStatus> => {
    // Try multiple endpoints - some Antigravity versions don't support /v1/models
    const endpoints = ['/v1/models', '/v1/chat/completions'];

    for (const endpoint of endpoints) {
        try {
            // Short timeout for connection check (2s is enough for localhost)
            const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
                method: endpoint === '/v1/chat/completions' ? 'POST' : 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAntigravityApiKey()}`
                },
                // For POST, send minimal body
                ...(endpoint === '/v1/chat/completions' && {
                    body: JSON.stringify({ model: 'gemini-3-flash', messages: [] })
                })
            }, 2000);

            // Strict check to avoid false positives from unrelated local services.
            const serverExists = endpoint === '/v1/models'
                ? (response.status === 200 || response.status === 401 || response.status === 403 || response.status === 429)
                : (response.status === 200 || response.status === 400 || response.status === 401 || response.status === 403 || response.status === 405 || response.status === 429);

            if (serverExists) {
                console.log(`[Antigravity] Connected to ${baseUrl} via ${endpoint} (status: ${response.status})`);

                let accountCount = 0;
                try {
                    if (endpoint === '/v1/models' && response.ok) {
                        const data = await response.json();
                        const isOpenAIModelList = data?.object === 'list' && Array.isArray(data?.data);
                        const hasAccountList = Array.isArray(data?.accounts);

                        // Reject false positives: a random service returning 200 on /v1/models
                        if (!isOpenAIModelList && !hasAccountList) {
                            continue;
                        }

                        if (isOpenAIModelList) {
                            accountCount = data.accounts?.length || 1;
                        } else if (hasAccountList) {
                            accountCount = data.accounts.length;
                        }
                    }
                } catch { /* ignore parse errors */ }

                return {
                    connected: true,
                    accountCount,
                    lastChecked: Date.now()
                };
            }
        } catch (error) {
            // Connection failed for this endpoint, try next
            continue;
        }
    }

    return {
        connected: false,
        lastChecked: Date.now()
    };
};

/**
 * Force refresh connection status
 */
export const refreshConnectionStatus = async (): Promise<AntigravityStatus> => {
    cachedStatus = null;
    return checkConnection();
};

/**
 * AUTO-DETECT Antigravity Configuration
 * Scans all common ports and tries to connect.
 * If found, saves the port and attempts to sync API key.
 * Returns the detected config or null if not found.
 */
export interface AntigravityDetectionResult {
    found: boolean;
    url?: string;
    port?: number;
    authRequired?: boolean;
    apiKey?: string;
    error?: string;
}

export const autoDetectAntigravity = async (
    onProgress?: (message: string) => void
): Promise<AntigravityDetectionResult> => {
    onProgress?.('[Auto-detect] Đang quét các cổng...');

    // Try all ports in parallel
    const portChecks = POSSIBLE_PORTS.map(async (port) => {
        const url = `http://127.0.0.1:${port}`;
        try {
            // First, try WITHOUT any auth to see if port is even open
            const responseNoAuth = await fetchWithTimeout(`${url}/v1/models`, {
                method: 'GET'
            }, 1500);

            if (responseNoAuth.ok) {
                // Connected and auth is OFF
                return { port, url, authRequired: false };
            } else if (responseNoAuth.status === 401 || responseNoAuth.status === 403) {
                // Connected but auth is required
                return { port, url, authRequired: true };
            }
        } catch {
            // Connection failed
        }
        return null;
    });

    const results = await Promise.all(portChecks);
    const found = results.find(r => r !== null);

    if (!found) {
        onProgress?.('[Auto-detect] Không tìm thấy Antigravity trên bất kỳ cổng nào');
        return { found: false, error: 'Không tìm thấy Antigravity. Hãy kiểm tra app đã được bật chưa.' };
    }

    onProgress?.(`[Auto-detect] Tìm thấy Antigravity tại ${found.url}`);

    // Save the detected URL
    setAntigravityUrl(found.url);

    // If auth is required, we need to try fetching config or prompt user
    if (found.authRequired) {
        onProgress?.('[Auto-detect] Authorization đang BẬT - Cần nhập API key');

        // Try common API keys
        const commonKeys = ['sk-antigravity', getAntigravityApiKey()];
        for (const key of commonKeys) {
            try {
                const testResp = await fetchWithTimeout(`${found.url}/v1/models`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${key}` }
                }, 1500);

                if (testResp.ok) {
                    // This key works!
                    setAntigravityApiKey(key);
                    onProgress?.(`[Auto-detect] Kết nối thành công với key: ${key.substring(0, 10)}...`);
                    return {
                        found: true,
                        url: found.url,
                        port: found.port,
                        authRequired: true,
                        apiKey: key
                    };
                }
            } catch { }
        }

        // None of the common keys worked - user needs to input manually
        return {
            found: true,
            url: found.url,
            port: found.port,
            authRequired: true,
            error: 'Authorization đang bật nhưng key không khớp. Vui lòng nhập API key từ Antigravity.'
        };
    }

    // Auth is OFF - we're good to go
    onProgress?.('[Auto-detect] Kết nối thành công!');
    return {
        found: true,
        url: found.url,
        port: found.port,
        authRequired: false
    };
};

// --- API Functions ---

// Available text models in Antigravity (ordered by QUALITY - strongest first)
// Using PRO models for best prompt quality
const TEXT_MODELS_PRIORITY = [
    'gemini-3-pro',             // Strongest - best for prompt generation
    'gemini-2.5-pro',           // Strong fallback
    'gemini-3-flash',           // Fast fallback if PRO unavailable
    'gemini-2.5-flash',         // Last resort
];
const DEFAULT_TEXT_MODEL = 'gemini-3-pro';

/**
 * Generate text content via Antigravity (OpenAI compatible)
 * Now tries multiple models if one fails!
 */
export const generateTextViaAntigravity = async (
    prompt: string,
    model: string = DEFAULT_TEXT_MODEL,
    systemInstruction?: string
): Promise<string | null> => {
    const baseUrl = getAntigravityUrl();
    const MAX_RETRIES_PER_MODEL = 2;
    const BASE_DELAY_MS = 3000; // 3 seconds base delay

    const messages: Array<{ role: string; content: string }> = [];

    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    // Build model list: requested model first, then fallbacks
    const modelsToTry = [model, ...TEXT_MODELS_PRIORITY.filter(m => m !== model)];

    for (const currentModel of modelsToTry) {
        console.log(`[Antigravity] Trying model: ${currentModel}`);

        for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
            try {
                const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAntigravityApiKey()}`
                    },
                    body: JSON.stringify({
                        model: currentModel,
                        messages: messages,
                        temperature: 0.7
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const content = data.choices?.[0]?.message?.content;
                    if (content) {
                        console.log(`[Antigravity] ✅ Success with model: ${currentModel}`);
                        return content;
                    }
                }

                const errorText = await response.text();

                // Check for rate limit (429) or server overload (503)
                if (response.status === 429 || response.status === 503) {
                    // Try to parse wait time from error message
                    const waitMatch = errorText.match(/wait\s*(\d+)\s*s/i);
                    const serverWaitTime = waitMatch ? parseInt(waitMatch[1], 10) * 1000 : 0;

                    // Quick backoff: 3s, 6s
                    const backoffDelay = BASE_DELAY_MS * Math.pow(2, attempt);
                    const waitTime = Math.max(serverWaitTime, backoffDelay) + Math.random() * 500;

                    console.warn(`[Antigravity] Rate limit on ${currentModel} (${response.status}). Attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL}. Waiting ${Math.round(waitTime / 1000)}s...`);

                    if (attempt < MAX_RETRIES_PER_MODEL - 1) {
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // Retry same model
                    } else {
                        console.warn(`[Antigravity] Model ${currentModel} exhausted, trying next model...`);
                        break; // Try next model
                    }
                }

                // Other error (400, 404, etc.) - skip to next model immediately
                console.warn(`[Antigravity] Model ${currentModel} returned ${response.status}, trying next...`);
                break;

            } catch (error: any) {
                const errorMsg = error?.message || String(error);
                console.error(`[Antigravity] Error with model ${currentModel}:`, errorMsg);

                // Check if it's a rate limit error
                const isRateLimit = errorMsg.includes('429') ||
                    errorMsg.toLowerCase().includes('quota') ||
                    errorMsg.toLowerCase().includes('exhausted');

                if (isRateLimit && attempt < MAX_RETRIES_PER_MODEL - 1) {
                    const backoffDelay = BASE_DELAY_MS * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    continue;
                }

                break; // Try next model
            }
        }
    }

    console.error('[Antigravity] Text generation failed with all models');
    return null;
};

/**
 * Generate image via Antigravity using OpenAI-compatible format
 * 
 * Antigravity provides OpenAI-compatible API at /v1/chat/completions
 * For image generation, we use multimodal messages with base64 images
 * 
 * UPDATED: Now uses VIP-quality prompts by default for better output
 */
/**
 * Generate image via Antigravity using OpenAI-compatible format
 * 
 * Antigravity provides OpenAI-compatible API at /v1/chat/completions
 * For image generation, we use multimodal messages with base64 images
 * 
 * UPDATED: Optimized for speed with timeouts and fast-fail
 */
export const generateImageViaAntigravity = async (
    request: AntigravityImageRequest
): Promise<string | null> => {
    const baseUrl = getAntigravityUrl();

    try {
        const {
            prompt,
            referenceImages = [],
            aspectRatio,
            useVIPPrompt = true,
            hasMaleAccessories = false,
            hasFemaleAccessories = false,
            sessionSeed
        } = request;

        // Build enhanced VIP prompt if enabled (default: true)
        const enhancedPrompt = useVIPPrompt
            ? buildVIPPrompt(prompt, {
                aspectRatio,
                hasMaleAccessories,
                hasFemaleAccessories,
                sessionSeed
            })
            : prompt;

        // Add prompt text with image generation instruction
        const imagePrompt = aspectRatio
            ? `🚨 GENERATE IMAGE WITH EXACT ASPECT RATIO: ${aspectRatio} - NO EXCEPTIONS 🚨\n\n${enhancedPrompt}\n\n[FINAL CHECK: Output MUST be EXACTLY ${aspectRatio} aspect ratio]`
            : `Generate an image. ${enhancedPrompt}`;

        // SPEED OPTIMIZATION: Skip Imagen endpoint (doesn't work with Antigravity)
        // Go directly to OpenAI-compatible endpoint for fastest generation

        // --- Use OpenAI-compatible /v1/chat/completions endpoint ---
        const baseModel = request.model || 'gemini-3-pro-image';
        const imageSize = aspectRatioToSize(aspectRatio);
        const modelCandidates = buildImageModelCandidates(baseModel, aspectRatio);

        // PRIMARY PATH (official Antigravity image endpoints)
        const endpointResult = await generateImageViaOpenAIImagesEndpoints(
            baseUrl,
            modelCandidates,
            imagePrompt,
            aspectRatio,
            referenceImages
        );
        if (endpointResult) {
            return endpointResult;
        }

        if (referenceImages.length > 0) {
            // For image-to-image flows, /v1/images/edits is the correct endpoint.
            // Falling back to chat completions usually repeats the same upstream 404 and wastes quota.
            console.error('[Antigravity] /v1/images/edits failed for all candidates. Skipping chat fallback for image-to-image.');
            return null;
        }

        console.warn('[Antigravity] Official image endpoints failed, falling back to /v1/chat/completions');

        // Build multimodal content for OpenAI format
        const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

        // Add reference images first (if any)
        for (const img of referenceImages) {
            contentParts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${img.mimeType};base64,${img.data}`
                }
            });
        }

        // Add prompt text
        contentParts.push({
            type: 'text',
            text: imagePrompt
        });

        for (const currentModel of modelCandidates) {
            console.log('[Antigravity OpenAI] Using model:', currentModel, 'size:', imageSize, 'aspectRatio:', aspectRatio);

            const response = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAntigravityApiKey()}`
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [{
                        role: 'user',
                        content: contentParts
                    }],
                    // Size parameter for aspect ratio (OpenAI DALL-E format)
                    size: imageSize,
                    max_tokens: 8192,
                    temperature: 0.7
                })
            }, 180000);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Antigravity OpenAI] Failed:', response.status, errorText);

                if (response.status === 429) {
                    console.error('[Antigravity] QUOTA EXHAUSTED DETECTED - Please switch account!');
                    return null;
                }

                if (isModelNotFoundError(response.status, errorText)) {
                    console.warn(`[Antigravity OpenAI] Model not found: ${currentModel}. Trying fallback model...`);
                    continue;
                }

                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                const dataUrlMatch = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
                if (dataUrlMatch) {
                    console.log('[Antigravity OpenAI] Success with model:', currentModel, 'aspect ratio:', aspectRatio);
                    return dataUrlMatch[1];
                }

                if (/^[A-Za-z0-9+/=]{100,}$/.test(content.trim())) {
                    console.log('[Antigravity OpenAI] Success (raw base64) with model:', currentModel, 'aspect ratio:', aspectRatio);
                    return content.trim();
                }

                const base64Pattern = content.match(/([A-Za-z0-9+/=]{1000,})/);
                if (base64Pattern) {
                    console.log('[Antigravity OpenAI] Success (extracted base64) with model:', currentModel, 'aspect ratio:', aspectRatio);
                    return base64Pattern[1];
                }
            }

            console.warn('[Antigravity OpenAI] No image in response for model:', currentModel);
        }

        return null;

    } catch (error: any) {
        console.error('[Antigravity] Image generation error:', error);

        // CHECK FOR QUOTA ERROR
        const errMsg = JSON.stringify(error).toLowerCase();
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted')) {
            console.error('[Antigravity] QUOTA EXHAUSTED DETECTED - Please switch account!');
        }

        return null;
    }
};

/**
 * Generate image via Antigravity's Imagen endpoint (if available)
 */
const generateImageViaImagen = async (
    baseUrl: string,
    prompt: string,
    aspectRatio?: string
): Promise<string | null> => {
    try {
        // Map aspect ratio to proper image dimensions
        const getSizeFromAspectRatio = (ratio?: string): string => {
            switch (ratio) {
                case '16:9': return '1792x1024';
                case '9:16': return '1024x1792';
                case '4:3': return '1365x1024';
                case '3:4': return '1024x1365';
                case '3:2': return '1536x1024';
                case '2:3': return '1024x1536';
                case '1:1': return '1024x1024';
                default: return '1024x1024';
            }
        };

        const imageSize = getSizeFromAspectRatio(aspectRatio);
        console.log('[Antigravity Imagen] Using size:', imageSize, 'for aspectRatio:', aspectRatio);

        // Try /v1/images/generations endpoint (OpenAI DALL-E compatible)
        const response = await fetch(`${baseUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAntigravityApiKey()}`
            },
            body: JSON.stringify({
                model: 'imagen-3.0-generate-002', // Imagen 3 
                prompt: `IMPORTANT: Generate image with STRICT aspect ratio ${aspectRatio || '1:1'}. ${prompt}`,
                n: 1,
                size: imageSize,
                response_format: 'b64_json'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Antigravity Imagen] Failed:', response.status, errorText);
            return null;
        }

        const data = await response.json();

        if (data.data?.[0]?.b64_json) {
            console.log('[Antigravity Imagen] Image generated successfully');
            return data.data[0].b64_json;
        }

        return null;
    } catch (error) {
        console.error('[Antigravity Imagen] Error:', error);
        return null;
    }
};

/**
 * Simple image generation for features like ID Photo, Edit, Upscale, Profile, etc.
 * This is a simplified version without the creative constraints.
 * Uses ULTRA_SHARP_QUALITY for maximum quality output.
 */
export const generateImageSimple = async (
    prompt: string,
    referenceImages: Array<{ data: string; mimeType: string }> = [],
    options?: {
        aspectRatio?: string;
        model?: string;
        strictPreserve?: boolean; // For restore: strictly preserve original
    }
): Promise<string | null> => {
    const baseUrl = getAntigravityUrl();
    const { aspectRatio, model = 'gemini-3-pro-image', strictPreserve = false } = options || {};

    // Get image size for OpenAI format
    const imageSize = aspectRatioToSize(aspectRatio);

    // Try multiple model candidates, including base model fallbacks
    const modelsToTry = buildImageModelCandidates(model, aspectRatio);

    // PRIMARY PATH (official Antigravity image endpoints)
    const endpointResult = await generateImageViaOpenAIImagesEndpoints(
        baseUrl,
        modelsToTry,
        prompt,
        aspectRatio,
        referenceImages
    );
    if (endpointResult) {
        return endpointResult;
    }

    if (referenceImages.length > 0) {
        console.error('[Antigravity Simple] /v1/images/edits failed for all candidates. Skipping chat fallback for image-to-image.');
        return null;
    }

    console.warn('[Antigravity Simple] Official image endpoints failed, falling back to /v1/chat/completions');

    for (const currentModel of modelsToTry) {
        try {
            // Build multimodal content for OpenAI format
            const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

            // Add reference images first
            for (const img of referenceImages) {
                contentParts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${img.mimeType};base64,${img.data}`
                    }
                });
            }

            // Build enhanced prompt based on mode
            let enhancedPrompt: string;

            if (strictPreserve) {
                // ... (Keep existing prompt logic) ...
                // For restore: STRICTLY preserve original identity
                enhancedPrompt = `
*** ABSOLUTE IDENTITY PRESERVATION - NON-NEGOTIABLE ***
The input image is a reference photo of a REAL PERSON. You MUST:
1. Keep the EXACT same face - every facial feature must be IDENTICAL
2. Keep the EXACT same body proportions
3. Keep the EXACT same pose and position
4. Keep the EXACT same clothing and accessories
5. Keep the EXACT same background composition
6. Only improve: clarity, sharpness, color vibrancy, remove damage/noise

${FACE_IDENTITY_PRESERVATION}

${ULTRA_SHARP_QUALITY}

${CLEAN_OUTPUT_REQUIREMENTS}

${aspectRatio ? `OUTPUT ASPECT RATIO: ${aspectRatio} (MANDATORY)` : ''}

TASK: ${prompt}

CRITICAL: The output person must be 100% recognizable as the SAME person in the input. NO changes to facial features, body, or pose allowed.
`;
            } else {
                // Normal mode
                enhancedPrompt = `
${ULTRA_SHARP_QUALITY}

${CLEAN_OUTPUT_REQUIREMENTS}

${aspectRatio ? `OUTPUT ASPECT RATIO: ${aspectRatio} (MANDATORY - strictly follow this ratio)` : ''}

TASK: ${prompt}
`;
            }

            contentParts.push({
                type: 'text',
                text: enhancedPrompt
            });

            console.log('[Antigravity Simple] Trying model:', currentModel, 'AspectRatio:', aspectRatio, 'Size:', imageSize);

            // Use OpenAI-compatible endpoint with size parameter
            const response = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAntigravityApiKey()}`
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [
                        {
                            role: 'user',
                            content: contentParts
                        }
                    ],
                    // SIZE PARAMETER - Key for aspect ratio!
                    size: imageSize,
                    max_tokens: 8192,
                    temperature: 0.5
                })
            }, 180000); // 3 minute timeout for image generation

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Antigravity Simple] Model ${currentModel} failed:`, response.status, errorText);

                // FAIL FAST: If 429, don't try other models if they share quota
                if (response.status === 429) {
                    console.warn('[Antigravity Simple] Quota exhausted (429).');
                    // However, different models might have different quotas, so we continue but log it.
                }

                if (isModelNotFoundError(response.status, errorText)) {
                    console.warn(`[Antigravity Simple] Model not found: ${currentModel}. Trying fallback model...`);
                }

                continue; // Try next model
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                // Try multiple patterns to extract base64 image
                // Pattern 1: data URL format
                const dataUrlMatch = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
                if (dataUrlMatch) {
                    console.log(`[Antigravity Simple] Success with model ${currentModel}`);
                    return dataUrlMatch[1];
                }

                // Pattern 2: Raw base64 (long string of base64 chars)
                if (/^[A-Za-z0-9+/=]{100,}$/.test(content.trim())) {
                    console.log(`[Antigravity Simple] Success with model ${currentModel} (raw base64)`);
                    return content.trim();
                }

                // Pattern 3: Check if response contains image in different format
                const base64Pattern = content.match(/([A-Za-z0-9+/=]{1000,})/);
                if (base64Pattern) {
                    console.log(`[Antigravity Simple] Success with model ${currentModel} (extracted base64)`);
                    return base64Pattern[1];
                }
            }

            // If we got here, this model didn't return an image, try next
            continue;

        } catch (error) {
            console.error(`[Antigravity Simple] Error with model ${currentModel}:`, error);
            continue; // Try next model
        }
    }

    // All models failed, try Imagen endpoint as last resort
    console.log('[Antigravity Simple] All models failed, trying Imagen fallback...');
    // TIMEOUT for fallback
    return await Promise.race([
        generateImageViaImagen(baseUrl, prompt, aspectRatio),
        new Promise<string | null>(resolve => setTimeout(() => resolve(null), 20000))
    ]);
};



/**
 * Validate Antigravity connection by making a simple request
 */
export const validateAntigravity = async (): Promise<{ isValid: boolean; message: string }> => {
    try {
        const status = await refreshConnectionStatus();

        if (status.connected) {
            return {
                isValid: true,
                message: `Antigravity đang chạy${status.accountCount ? ` với ${status.accountCount} accounts` : ''}`
            };
        } else {
            return {
                isValid: false,
                message: 'Không thể kết nối Antigravity. Hãy đảm bảo ứng dụng đang chạy.'
            };
        }
    } catch (error) {
        return {
            isValid: false,
            message: 'Lỗi khi kiểm tra kết nối Antigravity'
        };
    }
};

/**
 * Get download link for Antigravity Manager
 */
export const getAntigravityDownloadUrl = (): string => {
    return 'https://github.com/lbjlaq/Antigravity-Manager/releases';
};

/**
 * Open Antigravity Manager download page
 */
export const openAntigravityDownload = (): void => {
    window.open(getAntigravityDownloadUrl(), '_blank');
};

/**
 * TEST: Generate video via Veo 3.1 through Antigravity
 * This is an experimental function to test if Veo works via Antigravity proxy
 */
export const testVeoGeneration = async (
    prompt: string,
    options?: {
        aspectRatio?: '16:9' | '9:16';
        durationSeconds?: number;
    }
): Promise<{ success: boolean; data?: any; error?: string }> => {
    const baseUrl = getAntigravityUrl();
    const { aspectRatio = '16:9', durationSeconds = 5 } = options || {};

    console.log('[Veo Test] Starting video generation test...');
    console.log('[Veo Test] Prompt:', prompt);
    console.log('[Veo Test] AspectRatio:', aspectRatio, 'Duration:', durationSeconds);

    try {
        // First check connection
        const status = await checkConnection();
        if (!status.connected) {
            return { success: false, error: 'Antigravity not connected' };
        }

        // Try calling with veo-3.1 model
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAntigravityApiKey()}`
            },
            body: JSON.stringify({
                model: 'veo-3.1-fast-generate-preview',
                messages: [
                    {
                        role: 'user',
                        content: `Generate a ${durationSeconds} second video with aspect ratio ${aspectRatio}. 
                        
Video description: ${prompt}

Requirements:
- High quality, cinematic
- Smooth motion
- Professional lighting`
                    }
                ],
                max_tokens: 8192,
                temperature: 0.7
            })
        });

        console.log('[Veo Test] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Veo Test] Failed:', response.status, errorText);
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText}`
            };
        }

        const data = await response.json();
        console.log('[Veo Test] Response data:', JSON.stringify(data, null, 2));

        return {
            success: true,
            data: data
        };

    } catch (error: any) {
        console.error('[Veo Test] Error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error'
        };
    }
};

/**
 * Check available models on Antigravity
 */
export const listAntigravityModels = async (): Promise<string[]> => {
    const baseUrl = getAntigravityUrl();

    try {
        const response = await fetch(`${baseUrl}/v1/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAntigravityApiKey()}`
            }
        });

        if (!response.ok) {
            console.error('[Models] Failed to fetch:', response.status);
            return [];
        }

        const data = await response.json();
        console.log('[Models] Available models:', data);

        // OpenAI format: { data: [{ id: 'model-name' }, ...] }
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((m: any) => m.id || m.name);
        }

        return [];
    } catch (error) {
        console.error('[Models] Error:', error);
        return [];
    }
};

// === NEW: Version Management & Installation Check ===

const ANTIGRAVITY_VERSION_KEY = 'antigravity_installed_version';
const ANTIGRAVITY_LAST_UPDATE_CHECK_KEY = 'antigravity_last_update_check';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/lbjlaq/Antigravity-Manager/releases/latest';

export interface AntigravityUpdateInfo {
    hasUpdate: boolean;
    latestVersion: string;
    currentVersion: string | null;
    downloadUrl: string;
    releaseNotes: string;
    publishedAt: string;
    windowsDownloadUrl?: string;
}

/**
 * Check for Antigravity updates from GitHub releases
 */
export const checkForAntigravityUpdates = async (): Promise<AntigravityUpdateInfo | null> => {
    try {
        console.log('[Antigravity] Checking for updates from GitHub...');

        const response = await fetch(GITHUB_RELEASES_API, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            console.error('[Antigravity] GitHub API error:', response.status);
            return null;
        }

        const data = await response.json();
        const latestVersion = data.tag_name?.replace('v', '') || data.name?.replace('v', '') || '';
        const currentVersion = getInstalledVersion();

        // Find Windows .msi download link
        const windowsAsset = data.assets?.find((asset: any) =>
            asset.name?.endsWith('.msi') || asset.name?.includes('windows')
        );

        const updateInfo: AntigravityUpdateInfo = {
            hasUpdate: currentVersion ? compareVersions(currentVersion, latestVersion) : true,
            latestVersion,
            currentVersion,
            downloadUrl: data.html_url || GITHUB_RELEASES_API.replace('/repos/', '/').replace('/releases/latest', '/releases'),
            releaseNotes: data.body || '',
            publishedAt: data.published_at || '',
            windowsDownloadUrl: windowsAsset?.browser_download_url
        };

        console.log('[Antigravity] Update info:', updateInfo);

        // Save last check time
        localStorage.setItem(ANTIGRAVITY_LAST_UPDATE_CHECK_KEY, Date.now().toString());

        return updateInfo;
    } catch (error) {
        console.error('[Antigravity] Failed to check updates:', error);
        return null;
    }
};

/**
 * Compare two version strings (semver)
 * Returns true if latest > current (meaning update available)
 */
export const compareVersions = (current: string, latest: string): boolean => {
    const parseVersion = (v: string) => {
        const cleaned = v.replace(/^v/, '').split('-')[0]; // Remove 'v' prefix and any suffix
        return cleaned.split('.').map(n => parseInt(n, 10) || 0);
    };

    const [c1, c2, c3] = parseVersion(current);
    const [l1, l2, l3] = parseVersion(latest);

    if (l1 > c1) return true;
    if (l1 < c1) return false;
    if (l2 > c2) return true;
    if (l2 < c2) return false;
    return l3 > c3;
};

/**
 * Get the installed version of Antigravity (stored locally)
 */
export const getInstalledVersion = (): string | null => {
    return localStorage.getItem(ANTIGRAVITY_VERSION_KEY);
};

/**
 * Save the installed version of Antigravity
 */
export const saveInstalledVersion = (version: string): void => {
    localStorage.setItem(ANTIGRAVITY_VERSION_KEY, version.replace(/^v/, ''));
};

/**
 * Check if we should show update notification
 * Only check once per 24 hours
 */
export const shouldCheckForUpdates = (): boolean => {
    const lastCheck = localStorage.getItem(ANTIGRAVITY_LAST_UPDATE_CHECK_KEY);
    if (!lastCheck) return true;

    const lastCheckTime = parseInt(lastCheck, 10);
    const hoursSinceLastCheck = (Date.now() - lastCheckTime) / (1000 * 60 * 60);

    return hoursSinceLastCheck >= 24;
};

/**
 * Try to detect installed version from Antigravity API
 */
export const detectInstalledVersion = async (): Promise<string | null> => {
    try {
        // Try the HTTP API endpoint first (port 19527)
        const response = await fetch('http://127.0.0.1:19527/api/version', {
            signal: AbortSignal.timeout(2000)
        });

        if (response.ok) {
            const data = await response.json();
            const version = data.version || data.v;
            if (version) {
                saveInstalledVersion(version);
                return version;
            }
        }
    } catch {
        // API not available, try alternate method
    }

    // If connected, we know it's installed but don't know version
    const status = await checkConnection();
    if (status.connected) {
        // Return stored version or 'unknown'
        return getInstalledVersion() || 'installed';
    }

    return null;
};

/**
 * Check if Antigravity is installed (either by connection or stored version)
 */
export const isAntigravityInstalled = async (): Promise<boolean> => {
    const status = await checkConnection();
    return status.connected || getInstalledVersion() !== null;
};

// Extend Window interface for Electron API
declare global {
    interface Window {
        electronAPI?: {
            antigravityAutoUpdate?: (downloadUrl: string) => Promise<{ success: boolean; error?: string }>;
            onAntigravityDownloadProgress?: (callback: (progress: { percent: number; downloaded: number; total: number }) => void) => void;
            onAntigravityUpdateStatus?: (callback: (status: { status: string; message: string }) => void) => void;
            isElectron?: boolean;
        };
    }
}

export interface AutoUpdateCallbacks {
    onProgress?: (progress: { percent: number; downloaded: number; total: number }) => void;
    onStatus?: (status: { status: string; message: string }) => void;
}

/**
 * One-click auto-update Antigravity: Download and Install automatically
 * Only works in Electron environment
 */
export const autoUpdateAntigravity = async (
    downloadUrl: string,
    callbacks?: AutoUpdateCallbacks
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Check if running in Electron
        if (!window.electronAPI?.antigravityAutoUpdate) {
            console.log('[Antigravity] Not in Electron, opening browser download');
            window.open(downloadUrl, '_blank');
            return { success: false, error: 'Not in Electron environment - opened browser instead' };
        }

        // Set up event listeners for progress
        if (callbacks?.onProgress && window.electronAPI.onAntigravityDownloadProgress) {
            window.electronAPI.onAntigravityDownloadProgress(callbacks.onProgress);
        }

        if (callbacks?.onStatus && window.electronAPI.onAntigravityUpdateStatus) {
            window.electronAPI.onAntigravityUpdateStatus(callbacks.onStatus);
        }

        console.log('[Antigravity] Starting auto-update from:', downloadUrl);

        // Call Electron to download and install
        const result = await window.electronAPI.antigravityAutoUpdate(downloadUrl);

        if (result.success) {
            // Update stored version after successful install
            const updateInfo = await checkForAntigravityUpdates();
            if (updateInfo) {
                saveInstalledVersion(updateInfo.latestVersion);
            }
        }

        return result;
    } catch (error: any) {
        console.error('[Antigravity] Auto-update error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if auto-update is available (running in Electron)
 */
export const isAutoUpdateAvailable = (): boolean => {
    return !!(window.electronAPI?.antigravityAutoUpdate && window.electronAPI?.isElectron);
};
