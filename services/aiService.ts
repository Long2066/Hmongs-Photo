import { getApiKey as getStoredApiKey, isProUser, getUseProApi, saveHistory, updateKeyStatus } from './storageService';
import { getSystemApiKey, GEMINI_VIP_MODEL, GEMINI_IMAGE_MODEL, GEMINI_TEXT_MODEL, getSelectedImageModel, isSelectedModelVipOnly, AVAILABLE_IMAGE_MODELS, getModelConfig } from './geminiCoreService';
import { GoogleGenAI, Modality } from "@google/genai";
import * as antigravityService from './antigravityService';
import * as geminiOAuthService from './geminiOAuthService';
import * as nineRouterService from './nineRouterService';
import { optimizeReferenceImages } from './imageOptimizer';

// --- GENERATION MODE TYPES ---
export type GenerationMode = 'ninerouter' | 'antigravity' | 'oauth' | 'vip' | 'free' | 'none';

// --- SYSTEM KEY USAGE TRACKING ---
// Track when system key is used (for smart credits deduction in App.tsx)
let _usedSystemKey = false;
export const setUsedSystemKey = (value: boolean) => { _usedSystemKey = value; };
export const getUsedSystemKey = () => _usedSystemKey;
export const resetUsedSystemKey = () => { _usedSystemKey = false; };

// --- VIP/PRO API DETECTION ---
const getVIPApiKey = (): string | null => {
    const isPro = isProUser();
    const useProApi = getUseProApi();
    console.log('[DEBUG aiService] getVIPApiKey check:', { isPro, useProApi });

    if (isPro && useProApi) {
        const key = getSystemApiKey();
        console.log('[DEBUG aiService] System key obtained:', !!key);
        return key;
    }
    return null;
};

// --- AUTO FALLBACK FOR PRO USERS (DISABLED - ISOLATED MODES) ---
// This is kept for reference but no longer used for fallback
const getSystemKeyForProUser = (): string | null => {
    const isPro = isProUser();
    if (isPro) {
        const key = getSystemApiKey();
        console.log('[DEBUG aiService] Pro user fallback - System key:', !!key);
        return key;
    }
    return null;
};

// --- DETERMINE CURRENT MODE (ISOLATED - NO FALLBACK) ---
/**
 * Determines the current generation mode based on user configuration.
 * Priority: NINEROUTER > ANTIGRAVITY > VIP > FREE
 * Returns 'none' if no mode is available or NineRouter/Antigravity is enabled but disconnected.
 */
export const determineCurrentMode = async (): Promise<{
    mode: GenerationMode;
    reason?: 'antigravity_disconnected' | 'no_api_key' | 'not_pro';
}> => {
    // Check if 9Router is enabled
    const nineRouterEnabled = nineRouterService.isNineRouterEnabled();
    if (nineRouterEnabled) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            return { mode: 'ninerouter' };
        }
        return { mode: 'none', reason: 'antigravity_disconnected' }; // Treated as general local server disconnection
    }

    // Check if Antigravity is enabled
    const antigravityEnabled = antigravityService.isAntigravityEnabled();

    if (antigravityEnabled) {
        const status = await antigravityService.checkConnection();
        if (status.connected) {
            return { mode: 'antigravity' };
        }
        // Antigravity enabled but not connected - return none with reason
        return { mode: 'none', reason: 'antigravity_disconnected' };
    }

    // Check OAuth mode (Google account login)
    if (geminiOAuthService.isOAuthEnabled()) {
        const ready = await geminiOAuthService.isOAuthReady();
        if (ready) {
            return { mode: 'oauth' };
        }
    }

    // Check VIP mode (PRO user with useProApi enabled)
    const isPro = isProUser();
    const useProApi = getUseProApi();
    if (isPro && useProApi) {
        return { mode: 'vip' };
    }

    // Check FREE mode (has API key)
    const userApiKey = getStoredApiKey('gemini');
    if (userApiKey) {
        return { mode: 'free' };
    }

    // Nothing available
    return { mode: 'none', reason: 'no_api_key' };
};

/**
 * Get available modes for the user
 */
export const getAvailableModes = async (): Promise<{
    ninerouter: boolean;
    antigravity: boolean;
    oauth: boolean;
    vip: boolean;
    free: boolean;
}> => {
    const nineRouterEnabled = nineRouterService.isNineRouterEnabled();
    let nineRouterAvailable = false;
    if (nineRouterEnabled) {
        const status = await nineRouterService.checkConnection();
        nineRouterAvailable = status.connected;
    }

    const antigravityEnabled = antigravityService.isAntigravityEnabled();
    let antigravityAvailable = false;

    if (antigravityEnabled) {
        const status = await antigravityService.checkConnection();
        antigravityAvailable = status.connected;
    }

    const oauthAvailable = geminiOAuthService.isOAuthEnabled() && await geminiOAuthService.isOAuthReady();

    return {
        ninerouter: nineRouterAvailable,
        antigravity: antigravityAvailable,
        oauth: oauthAvailable,
        vip: isProUser(),
        free: !!getStoredApiKey('gemini')
    };
};

// --- QUALITY ENHANCEMENT CONSTANTS (Exported for Antigravity) ---
export const ULTRA_SHARP_QUALITY = `
OUTPUT QUALITY REQUIREMENTS(MANDATORY):
- Resolution: 8K UHD(7680x4320 pixels equivalent quality), ultra high definition
- Sharpness: Razor-sharp edges, crystal clear even at 400% zoom, no blur whatsoever
- Detail Level: Skin pores visible, fabric textures highly detailed, individual hair strands defined
- Noise: Zero noise, perfectly clean image
- Compression: No artifacts, no banding, no pixelation
- Focus: Perfect tack-sharp focus across entire frame
- Dynamic Range: Full HDR, no clipping in highlights or shadows
- Color: Vibrant, accurate colors with rich tonal depth
`;

// NEW: Aspect ratio enforcement - TUYỆT ĐỐI tuân thủ tỷ lệ khung hình
export const ASPECT_RATIO_ENFORCEMENT = `
*** 🚨 CRITICAL: MANDATORY ASPECT RATIO COMPLIANCE - ABSOLUTE PRIORITY #1 🚨 ***

THE OUTPUT IMAGE DIMENSIONS MUST EXACTLY MATCH THE SPECIFIED ASPECT RATIO.
THIS IS THE HIGHEST PRIORITY REQUIREMENT - FAILURE TO COMPLY WILL RESULT IN REJECTION.

STRICT DIMENSIONAL RULES (NON-NEGOTIABLE):
• 1:1 (SQUARE): Width = Height EXACTLY. Examples: 1024x1024, 2048x2048
• 16:9 (LANDSCAPE/WIDE): Width:Height = 16:9 EXACTLY. Examples: 1920x1080, 3840x2160, 1280x720
• 9:16 (PORTRAIT/VERTICAL/TIKTOK): Width:Height = 9:16 EXACTLY. Examples: 1080x1920, 720x1280
• 4:3: Width:Height = 4:3 EXACTLY. Examples: 1600x1200, 1024x768
• 3:4: Width:Height = 3:4 EXACTLY. Examples: 1200x1600, 768x1024
• 3:2: Width:Height = 3:2 EXACTLY. Examples: 1800x1200, 1200x800
• 2:3: Width:Height = 2:3 EXACTLY. Examples: 1200x1800, 800x1200

*** COMPOSITION GUIDELINES BY ASPECT RATIO ***
FOR 16:9 (LANDSCAPE):
- Frame as WIDE SHOT or MEDIUM-WIDE SHOT
- Show FULL BODY from head to feet with ample space above head
- Include environmental context on left and right sides
- Subject should occupy about 40-60% of frame height
- Leave breathing room at top of frame (don't cut off head!)

FOR 9:16 (PORTRAIT/VERTICAL):
- Frame as CLOSE-UP or UPPER BODY SHOT
- Show from above head to chest/waist area
- Subject should be centered and fill most of frame width
- Focus on face and upper body details
- Leave small margin at top for head

FOR 1:1 (SQUARE):
- Frame as MEDIUM SHOT - head to knees or full body
- Center the subject in frame
- Balance between subject size and background

FOR 3:4 or 2:3 (TALL PORTRAIT):
- FULL BODY shot from head to feet preferred
- Good for standing poses with vertical emphasis

PROHIBITED ACTIONS:
❌ DO NOT cut off heads, faces, or important body parts
❌ DO NOT crop the image after generation
❌ DO NOT stretch or distort to fit a different ratio
❌ DO NOT add black bars, letterboxing, or pillarboxing
`;

// NEW: Output beauty enhancement - làm đẹp output
export const OUTPUT_BEAUTY_ENHANCEMENT = `
*** OUTPUT QUALITY BEAUTIFICATION (KEEP FACE IDENTICAL) ***
- LIGHTING: Professional studio lighting, soft and even, no harsh shadows on face
- SKIN: Smooth and flawless texture, natural skin tone enhancement, healthy glow
- BRIGHTNESS: Increase overall brightness for a fresh, vibrant, luminous look
- CONTRAST: Optimal contrast for clear, defined features without losing detail
- SHARPNESS: Crisp and sharp details, especially around eyes, hair, and clothing
- COLOR: Natural, vibrant colors with balanced saturation, avoid washed-out look
- EYES: Bright, clear eyes with natural catchlight, sparkling and alive
- HAIR: Neat, well-defined, shiny and healthy looking
- RETOUCHING: Light retouching for minor skin blemishes only (NOT face structure, moles, or natural marks)
- OVERALL: Output should look like a professional studio photograph with premium quality
`;

// CRITICAL: Face identity preservation for profile/upscale/restore features - ENHANCED VERSION
export const FACE_IDENTITY_PRESERVATION = `
*** ABSOLUTE FACE IDENTITY LOCK - ZERO TOLERANCE - THIS IS #1 PRIORITY ***

🚨 CRITICAL: THIS REQUIREMENT OVERRIDES ALL OTHER INSTRUCTIONS 🚨
THE FACE MUST BE 100% IDENTICAL TO INPUT - NO EXCEPTIONS WHATSOEVER

1. MANDATORY PRESERVATION (PIXEL-PERFECT):
   - The output face MUST be 100% IDENTICAL to the input face - CLONE IT EXACTLY
   - EYE COLOR, SHAPE, SIZE, DISTANCE must be IDENTICAL to input - NO CHANGES
   - NOSE SHAPE, SIZE, BRIDGE, TIP, NOSTRILS must be IDENTICAL to input - NO CHANGES
   - LIP SHAPE, SIZE, THICKNESS must be IDENTICAL to input - NO CHANGES
   - FACE WIDTH, LENGTH, RATIO must be IDENTICAL to input - NO CHANGES
   - JAW SHAPE, CHIN SHAPE must be IDENTICAL to input - NO CHANGES
   - CHEEKBONE POSITION, FOREHEAD SHAPE must be IDENTICAL to input - NO CHANGES
   - SKIN TEXTURE, MOLES, NATURAL MARKS must be PRESERVED - NO REMOVAL
   - Face proportions and ratios MUST remain UNCHANGED
   - Facial bone structure CANNOT be modified in ANY way

2. ABSOLUTELY PROHIBITED MODIFICATIONS (VIOLATION = FAILURE):
   - 🚫 ABSOLUTELY NO artificial beautification or enhancement of facial features
   - 🚫 ABSOLUTELY NO face morphing or blending with other faces
   - 🚫 ABSOLUTELY NO changing eye size, shape, color, or position
   - 🚫 ABSOLUTELY NO nose reshaping, refinement, or resizing
   - 🚫 ABSOLUTELY NO lip enhancement, modification, or resizing
   - 🚫 ABSOLUTELY NO face slimming, widening, or reshaping
   - 🚫 ABSOLUTELY NO jaw or chin modification
   - 🚫 ABSOLUTELY NO forehead modification
   - 🚫 ABSOLUTELY NO cheekbone modification
   - 🚫 ABSOLUTELY NO skin smoothing that removes natural texture
   - 🚫 ABSOLUTELY NO changing facial proportions
   - 🚫 DO NOT make the person look like a different person
   - 🚫 DO NOT use generic AI-generated face features
   - 🚫 DO NOT "improve" or "enhance" the face - KEEP IT EXACTLY AS IS

3. ALLOWED MODIFICATIONS ONLY:
   - ✅ Lighting and color correction (keep face structure identical)
   - ✅ Background changes
   - ✅ Resolution enhancement (upscaling)
   - ✅ Minor skin blemish removal (pimples only, NOT moles or natural marks)
   - ✅ Hair styling changes (if explicitly requested)
   - ✅ Clothing/outfit changes (if explicitly requested)

4. VERIFICATION RULE:
   - If shown side-by-side, a family member MUST immediately recognize this as the SAME person
   - The person themselves MUST recognize their own face without any sense of "that doesn't look like me"
   - ANY deviation from the original face = FAILED OUTPUT
`;

// Clean output requirements - remove all unwanted elements
export const CLEAN_OUTPUT_REQUIREMENTS = `
*** CLEAN OUTPUT REQUIREMENTS (ABSOLUTELY MANDATORY - TOP PRIORITY) ***

STEP 1 - INPUT IMAGE ANALYSIS:
First, analyze the input image(s) for any unwanted elements to REMOVE:
- Social media UI: Hearts, comments, share buttons, like counts, follower counts
- Phone UI: Status bars, battery indicators, time, network icons, notification bars
- Platform overlays: TikTok effects, Instagram filters, Facebook frames, Snapchat elements
- Text overlays: Usernames, captions, watermarks, dates, hashtags, song titles
- Decorative elements: Stickers, emojis, borders, vignettes

STEP 2 - OUTPUT GENERATION:
Generate a COMPLETELY CLEAN output:
- NO text, watermarks, logos, or any overlay graphics whatsoever
- NO UI elements of any kind (buttons, icons, indicators)
- NO social media elements (hearts, comments, share, save icons)
- NO platform-specific effects or filters
- NO date/time stamps or location tags
- NO phone frames, bezels, or screen artifacts
- Output MUST look like a professional studio photograph
- Output should be suitable for printing without any screen elements
`;

// Prevent AI from adding unwanted accessories/props
export const NO_EXTRA_ACCESSORIES = `
*** ACCESSORY CONSTRAINT (CRITICAL) ***
- DO NOT add any accessories, props, or items that are NOT explicitly provided in the input images
- If no accessory input is provided, the character should NOT hold or wear any additional items
- Only include accessories/props that are EXPLICITLY uploaded as reference images
- NO musical instruments, bags, phones, flowers, or any props unless specifically provided
- If male accessory input is empty, male character has empty hands
- If female accessory input is empty, female character has empty hands
`;

export const KOREAN_CHARACTER_DEFAULTS = `
*** MANDATORY KOREAN VISUAL IDOL AESTHETICS (HIGH FASHION ETHNIC FUSION) ***
- MALE CHARACTER (KOREAN K-POP IDOL VISUAL):
  * Extremely handsome Korean male, 18-22 years old, tall athletic build (182cm+).
  * Flawless luminous porcelain glass skin (chok-chok, translucent, zero blemishes, radiant milky complexion).
  * K-pop idol center visual aesthetic: sharp defined jawline, captivating charismatic eyes with natural double eyelids, high straight nose bridge, stylized K-drama actor curtain hairstyle.
  * Tuyệt sắc mỹ nam Hàn Quốc, thần thái cuốn hút, sang trọng, thời thượng và cuốn hút.

- FEMALE CHARACTER (KOREAN ULZZANG IDOL VISUAL):
  * Exceptionally gorgeous Korean female, 18-21 years old, tall, slim, and graceful proportions.
  * Flawless Korean glass skin (dewy porcelain texture, translucent, bright, perfectly smooth and radiant).
  * Natural Korean idol makeup: soft gradient coral-peach lips, delicate aegyo-sal, soft straight eyebrows, pure enchanting facial features.
  * Tuyệt sắc mỹ nữ Hàn Quốc, thần thái dịu dàng, quý phái, thanh tao và hiện đại.

*** STRICT INPUT CLOTHING & ACCESSORY CLONING PROTOCOL (100% NON-NEGOTIABLE) ***
- The reference image(s) represent the CLOTHING, TEXTILES, AND ACCESSORIES ONLY (ignore any person, model, face, skin tone, mannequin, or background in the reference photo).
- FAITHFUL OUTFIT REPLICATION: You MUST clone 100% of the authentic garment, fabrics, colors, textures, cuts, hand-embroidery patterns, tassels, and accessories DIRECTLY from the input reference photo(s) onto the handsome/beautiful Korean idol.
- COLOR FIDELITY: Strictly preserve the original outfit colors (whether red, blue, green, white, yellow, black, indigo, or multicolor). NEVER change the color palette or replace the outfit style with an unrelated traditional costume.
- ACCESSORY FIDELITY: Only include jewelry, headwear, or collars if they are visibly present in the input reference photos. Do NOT hallucinate unrequested silver torque collars or extra jewelry.

*** MANDATORY PHYSICAL GROUNDING & 1:1 HUMAN SCALE (NON-NEGOTIABLE) ***
- The character(s) MUST be physically grounded on solid terrain (mountain path, stone steps, market floor) with feet firmly planted and realistic contact shadows.
- STRICTLY FORBIDDEN: Characters floating in the sky, hovering in mid-air, or appearing as 100-meter giant titans towering over miniature landscapes.
- The character scale relative to buildings, market stalls, and landscape must be exact 1:1 realistic human proportions.
`;

// --- TYPES ---
export interface ImagePart {
    data: string; // base64 string
    mimeType: string;
}

export interface CreativeRefImages {
    male: ImagePart[];
    female: ImagePart[];
    maleAccessories: ImagePart[];
    femaleAccessories: ImagePart[];
}

// --- CLIENT HELPERS ---
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

/**
 * OAuth wrapper: bypasses @google/genai SDK entirely.
 * Uses Cloud Code Assist proxy (cloudcode-pa.googleapis.com) as the base URL.
 * This is the same endpoint OpenClaw uses for google-gemini-cli provider.
 *
 * API calls are routed through Electron's main process via IPC to bypass
 * browser CORS restrictions (cloudcode-pa.googleapis.com has no CORS headers).
 */
const createOAuthGeminiWrapper = (accessToken: string, projectId?: string) => {
    const baseUrl = 'https://cloudcode-pa.googleapis.com';

    const generateContent = async (params: {
        model: string;
        contents: any;
        config?: any;
    }) => {
        const modelName = params.model.startsWith('models/')
            ? params.model
            : `models/${params.model}`;

        const url = `${baseUrl}/${modelName}:generateContent`;

        // Build request body
        const body: any = {
            contents: Array.isArray(params.contents) ? params.contents : [params.contents],
        };

        // Map SDK config to API format
        if (params.config) {
            body.generationConfig = {} as any;
            if (params.config.responseModalities) {
                body.generationConfig.responseModalities = params.config.responseModalities;
            }
            if (params.config.seed !== undefined) {
                body.generationConfig.seed = params.config.seed;
            }
            if (params.config.imageConfig) {
                body.generationConfig.imageGenerationConfig = params.config.imageConfig;
            }
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        };
        if (projectId && projectId !== 'unknown') {
            headers['x-goog-user-project'] = projectId;
        }

        console.log('[OAuth CCA] Calling:', url);

        // Route through Electron IPC to bypass CORS
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.googleOAuthApiCall) {
            const result = await electronAPI.googleOAuthApiCall({
                url,
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!result.ok) {
                const errorText = result.text || result.error || `HTTP ${result.status}`;
                console.error('[OAuth CCA] Error:', result.status, errorText);
                throw new Error(`Gemini OAuth error ${result.status}: ${errorText}`);
            }

            return result.json;
        }

        // Fallback: direct fetch (won't work in browser due to CORS)
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OAuth CCA] Error:', response.status, errorText);
            throw new Error(`Gemini OAuth error ${response.status}: ${errorText}`);
        }

        return response.json();
    };

    // Return an object that mimics GoogleGenAI interface
    return {
        models: {
            generateContent,
        },
    } as unknown as GoogleGenAI;
};

/**
 * Smart client helper: returns an OAuth wrapper if OAuth is enabled and ready,
 * otherwise falls back to the provided API key using the standard SDK.
 * Returns null if no auth method is available.
 */
const getEffectiveGeminiClient = async (fallbackApiKey?: string | null): Promise<GoogleGenAI | null> => {
    // Try OAuth first
    if (geminiOAuthService.isOAuthEnabled()) {
        try {
            const tokenResult = await geminiOAuthService.getOAuthAccessToken();
            if (tokenResult.success && tokenResult.token) {
                console.log('[OAuth] Using OAuth fetch wrapper for API call');
                return createOAuthGeminiWrapper(tokenResult.token, tokenResult.projectId);
            }
        } catch (err) {
            console.warn('[OAuth] Failed to get token, falling back to API key:', err);
        }
    }

    // Fall back to provided API key
    if (fallbackApiKey) {
        return getGeminiClient(fallbackApiKey);
    }

    return null;
};

/**
 * Enforce aspect ratio by cropping the center of the image to match the requested ratio.
 * This is a GUARANTEED way to get the correct output dimensions.
 */
export const enforceAspectRatio = async (base64Image: string, aspectRatio: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Parse aspect ratio
            const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
            if (!widthRatio || !heightRatio) {
                resolve(base64Image); // Invalid ratio, return original
                return;
            }

            const targetRatio = widthRatio / heightRatio;
            const currentRatio = img.width / img.height;

            let cropWidth: number, cropHeight: number, offsetX: number, offsetY: number;

            if (Math.abs(currentRatio - targetRatio) < 0.01) {
                // Already correct ratio
                console.log('[AspectRatio] Image already has correct ratio:', aspectRatio);
                resolve(base64Image);
                return;
            }

            if (currentRatio > targetRatio) {
                // Image is wider than target, crop width
                cropHeight = img.height;
                cropWidth = Math.round(cropHeight * targetRatio);
                offsetX = Math.round((img.width - cropWidth) / 2);
                offsetY = 0;
            } else {
                // Image is taller than target, crop height
                cropWidth = img.width;
                cropHeight = Math.round(cropWidth / targetRatio);
                offsetX = 0;
                offsetY = Math.round((img.height - cropHeight) / 2);
            }

            console.log(`[AspectRatio] Cropping from ${img.width}x${img.height} to ${cropWidth}x${cropHeight} for ratio ${aspectRatio}`);

            const canvas = document.createElement('canvas');
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(base64Image);
                return;
            }

            ctx.drawImage(img, offsetX, offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Use JPEG format with high quality for better performance and smaller size
            const result = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
            console.log(`[AspectRatio] Successfully enforced ${aspectRatio} ratio`);
            resolve(result);
        };

        img.onerror = () => {
            console.error('[AspectRatio] Failed to load image');
            resolve(base64Image); // Return original on error
        };

        img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    });
};

/**
 * Enforce aspect ratio by adding blurred padding to match the requested ratio.
 * This method PRESERVES all original content (no cropping) by extending the image.
 * Uses a blurred version of the edges as the background for seamless look.
 */
export const enforceAspectRatioWithPadding = async (base64Image: string, aspectRatio: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Parse aspect ratio
            const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
            if (!widthRatio || !heightRatio) {
                resolve(base64Image);
                return;
            }

            const targetRatio = widthRatio / heightRatio;
            const currentRatio = img.width / img.height;

            // Check if already correct ratio
            if (Math.abs(currentRatio - targetRatio) < 0.01) {
                console.log('[AspectRatio Padding] Image already has correct ratio:', aspectRatio);
                resolve(base64Image);
                return;
            }

            let newWidth: number, newHeight: number;
            let offsetX: number, offsetY: number;

            if (currentRatio < targetRatio) {
                // Image is narrower than target - add padding on left/right
                newHeight = img.height;
                newWidth = Math.round(newHeight * targetRatio);
                offsetX = Math.round((newWidth - img.width) / 2);
                offsetY = 0;
            } else {
                // Image is shorter than target - add padding on top/bottom
                newWidth = img.width;
                newHeight = Math.round(newWidth / targetRatio);
                offsetX = 0;
                offsetY = Math.round((newHeight - img.height) / 2);
            }

            console.log(`[AspectRatio Padding] Extending from ${img.width}x${img.height} to ${newWidth}x${newHeight} for ratio ${aspectRatio}`);

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(base64Image);
                return;
            }

            // Create a blurred background by scaling up the image and blurring
            // First, draw the scaled and blurred version as background
            ctx.filter = 'blur(30px)';
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            ctx.filter = 'none';

            // Add a dark overlay for better contrast
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, newWidth, newHeight);

            // Draw the original image centered on top (crisp, no blur)
            ctx.drawImage(img, offsetX, offsetY, img.width, img.height);

            // Return base64 without the data URL prefix
            const result = canvas.toDataURL('image/png').split(',')[1];
            console.log(`[AspectRatio Padding] Successfully added padding for ${aspectRatio} ratio`);
            resolve(result);
        };

        img.onerror = () => {
            console.error('[AspectRatio Padding] Failed to load image');
            resolve(base64Image);
        };

        img.src = `data:image/png;base64,${base64Image}`;
    });
};

/**
 * Get the active image model based on VIP status and user selection.
 * - VIP users can use any model they selected
 * - Free users always use GEMINI_IMAGE_MODEL regardless of selection
 */
const getActiveImageModel = (): string => {
    const isVip = isProUser() && getUseProApi();
    const selectedModel = getSelectedImageModel();

    // If user selected a VIP-only model but is not VIP, fallback to free model
    if (isSelectedModelVipOnly() && !isVip) {
        console.log('[Model] User selected VIP model but not VIP, using free model');
        return GEMINI_IMAGE_MODEL;
    }

    console.log('[Model] Active model:', selectedModel, 'VIP:', isVip);
    return selectedModel;
};

// --- UNIFIED IMAGE GENERATION HELPER ---
// This helper handles both VIP (System Key) and FREE (User Key) modes with automatic fallback
interface GenerateImageOptions {
    prompt: string;
    referenceImages?: ImagePart[];
    aspectRatio?: string;
    seed?: number;
    onStatus?: (msg: string) => void;
}

const generateImageWithSystemKey = async (
    systemKey: string,
    prompt: string,
    referenceImages?: any[],
    aspectRatio?: string
): Promise<string | null> => {
    try {
        const ai = getGeminiClient(systemKey);
        const refParts: any[] = [];
        (referenceImages || []).forEach((img, idx) => {
            if (img.label) {
                refParts.push({ text: `*** INPUT REFERENCE ${idx + 1}: ${img.label} ***` });
            }
            refParts.push({
                inlineData: {
                    data: img.data,
                    mimeType: img.mimeType
                }
            });
        });

        const activeModel = getActiveImageModel();
        const response = await ai.models.generateContent({
            model: activeModel,
            contents: {
                parts: [
                    ...refParts,
                    { text: prompt }
                ]
            },
            config: {
                imageConfig: aspectRatio ? { aspectRatio: aspectRatio as any } : undefined
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    // CRITICAL: Mark that system key was used for billing
                    setUsedSystemKey(true);
                    console.log('[BILLING] System key used successfully, marked for deduction');
                    return part.inlineData.data;
                }
            }
        }
    } catch (e) {
        console.error("Gemini VIP Gen failed:", e);
    }
    return null;
};

const generateImageUnified = async (
    options: GenerateImageOptions
): Promise<string | null> => {
    const { prompt, referenceImages: rawRefImages = [], aspectRatio, seed, onStatus } = options;
    const referenceImages = await optimizeReferenceImages(rawRefImages);

    // PRIORITY 0: Antigravity mode (if enabled)
    if (antigravityService.isAntigravityEnabled()) {
        if (onStatus) onStatus('[Antigravity] Đang kiểm tra kết nối...');
        const status = await antigravityService.checkConnection();

        if (status.connected) {
            if (onStatus) onStatus('[Antigravity VIP] Đang tạo ảnh qua Google Account...');
            try {
                // Note: prompt here is simple, so let Antigravity add VIP constraints
                const result = await antigravityService.generateImageViaAntigravity({
                    prompt,
                    referenceImages,
                    aspectRatio,
                    model: 'gemini-3-pro-image', // Correct Antigravity image model
                    useVIPPrompt: true, // Add VIP constraints for quality
                    sessionSeed: seed
                });

                if (result) {
                    console.log('[Antigravity] Image generated successfully');
                    return result;
                }
                console.warn('[Antigravity] Generation returned null, falling back...');
            } catch (err) {
                console.error('[Antigravity] Generation failed:', err);
            }
            if (onStatus) onStatus('[Antigravity] Lỗi, đang thử phương thức khác...');
        } else {
            if (onStatus) onStatus('[Antigravity] Không kết nối được, dùng API Key...');
        }
    }

    // PRIORITY 0.5: Google OAuth mode
    if (geminiOAuthService.isOAuthEnabled()) {
        if (onStatus) onStatus('[OAuth] Đang lấy token Google...');
        const tokenResult = await geminiOAuthService.getOAuthAccessToken();

        if (tokenResult.success && tokenResult.token) {
            if (onStatus) onStatus('[OAuth] Đang tạo ảnh qua Google OAuth...');
            try {
                // Create OAuth wrapper (direct fetch, no SDK ?key= issue)
                const ai = createOAuthGeminiWrapper(tokenResult.token, tokenResult.projectId);

                const activeModel = getActiveImageModel();
                const refParts = referenceImages.map(img => ({
                    inlineData: { data: img.data, mimeType: img.mimeType }
                }));

                const response = await ai.models.generateContent({
                    model: activeModel,
                    contents: {
                        parts: [...refParts, { text: prompt }]
                    },
                    config: {
                        responseModalities: [Modality.TEXT, Modality.IMAGE],
                        imageConfig: aspectRatio ? { aspectRatio: aspectRatio as any } : undefined,
                        seed: seed
                    }
                });

                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            console.log('[OAuth] Image generated successfully');
                            return part.inlineData.data;
                        }
                    }
                }
                console.warn('[OAuth] No image in response');
            } catch (err) {
                console.error('[OAuth] Generation failed:', err);
            }
            if (onStatus) onStatus('[OAuth] Lỗi, đang thử phương thức khác...');
        } else {
            if (onStatus) onStatus('[OAuth] Token không hợp lệ, dùng API Key...');
        }
    }

    // PRIORITY 1: VIP mode uses the system Gemini key
    const vipKey = getVIPApiKey();
    if (vipKey) {
        if (onStatus) onStatus('[VIP] Đang tạo ảnh với Gemini VIP...');

        try {
            const result = await generateImageWithSystemKey(vipKey, prompt, referenceImages, aspectRatio);
            if (result) {
                console.log('[VIP] Image generated successfully with Gemini system key');
                return result;
            }
            console.warn('[VIP] Gemini system key generation returned null');
            if (onStatus) onStatus('[VIP] Lỗi tạo ảnh, vui lòng thử lại');
        } catch (err) {
            console.error('[VIP] Gemini system key generation failed:', err);
            if (onStatus) onStatus('[VIP] Lỗi, vui lòng thử lại sau');
        }
    }

    // FALLBACK or PRIMARY (FREE mode): Use User's Gemini Key
    const userApiKey = getStoredApiKey('gemini');
    if (userApiKey) {
        if (onStatus) onStatus('Đang tạo ảnh với Gemini (User Key)...');
        const ai = getGeminiClient(userApiKey);

        // Prepare reference parts for Gemini
        const refParts = referenceImages.map(img => ({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType
            }
        }));

        const response = await ai.models.generateContent({
            model: getActiveImageModel(),
            contents: {
                parts: [
                    ...refParts,
                    { text: prompt }
                ]
            },
            config: {
                imageConfig: aspectRatio ? { aspectRatio: aspectRatio as any } : undefined,
                seed: seed
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
    }

    return null;
};

// --- UTILS ---
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for parallel execution with concurrency control and staggered start
const parallelWithConcurrency = async <T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
    onProgress?: (completed: number, total: number) => void,
    staggerDelayMs: number = 300 // Reduced to 300ms for faster start
): Promise<T[]> => {
    const results: T[] = new Array(tasks.length);
    let currentIndex = 0;
    let completed = 0;

    const executeNext = async (workerIndex: number): Promise<void> => {
        // Stagger start: each worker waits a bit before starting
        if (staggerDelayMs > 0 && workerIndex > 0) {
            await delay(staggerDelayMs * workerIndex);
        }

        while (currentIndex < tasks.length) {
            const index = currentIndex++;
            try {
                results[index] = await tasks[index]();
            } catch (error) {
                console.error(`Task ${index} failed:`, error);
                results[index] = null as any;
            }
            completed++;
            if (onProgress) onProgress(completed, tasks.length);

            // Add small delay between tasks for same worker to spread load
            // Reduced to 100ms for faster throughput
            if (staggerDelayMs > 0 && currentIndex < tasks.length) {
                await delay(100);
            }
        }
    };

    // Start workers with staggered timing
    const workerCount = Math.min(concurrency, tasks.length);
    const workers = Array(workerCount)
        .fill(null)
        .map((_, i) => executeNext(i));

    await Promise.all(workers);
    return results;
};

// Helper for rate limit handling with retry logic
const callWithRetry = async <T>(
    fn: () => Promise<T>,
    retries: number = 3, // Reduced default retries to Fail Fast
    baseDelay: number = 1000, // Reduced to 1 second (was 10s)
    onStatus?: (msg: string) => void
): Promise<T> => {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (e: any) {
            const errorBody = e.error || e;
            const errorCode = errorBody.code || e.status;
            const errorMessage = (errorBody.message || e.message || JSON.stringify(e)).toLowerCase();

            const isQuota =
                errorCode === 429 ||
                errorCode === 503 ||
                errorMessage.includes('429') ||
                errorMessage.includes('quota') ||
                errorMessage.includes('resource_exhausted') ||
                errorMessage.includes('overloaded');

            if (isQuota && attempt < retries) {
                attempt++;
                // Aggressive Exponential backoff but starting small: 1s, 2s, 4s...
                const backoff = baseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 1000; // Reduced jitter
                const waitTime = backoff + jitter;

                if (onStatus) {
                    onStatus(`Hệ thống đang quá tải, chờ ${Math.round(waitTime / 1000)}s để thử lại lần ${attempt}/${retries}...`);
                }
                console.warn(`Hit 429/503 (Attempt ${attempt}). Waiting ${waitTime}ms.`, e);
                await delay(waitTime);
            } else {
                throw e;
            }
        }
    }
};

// --- API KEY VALIDATION ---
export const validateGeminiKey = async (apiKey: string): Promise<{ isValid: boolean, isQuota?: boolean }> => {
    try {
        const ai = getGeminiClient(apiKey);
        // Use text model for validation (always supported, faster)
        const response = await ai.models.generateContent({
            model: GEMINI_TEXT_MODEL, // Latest text model for validation
            contents: 'Say "OK" if you can read this.'
        });
        return { isValid: !!response.text };
    } catch (e: any) {
        console.error("Gemini validation failed:", e);
        const errorBody = e.error || e;
        const errorCode = errorBody.code || e.status;
        const errorMessage = (errorBody.message || e.message || JSON.stringify(e)).toLowerCase();

        const isQuota =
            errorCode === 429 ||
            errorCode === 503 ||
            errorMessage.includes('429') ||
            errorMessage.includes('quota') ||
            errorMessage.includes('resource_exhausted');

        return { isValid: false, isQuota };
    }
};

// --- STYLE TRANSLATION HELPER ---
const getStylePrompt = (style: string): string => {
    const mapping: Record<string, string> = {
        'Truyền thống H’Mông cổ điển': 'Classic Traditional Hmong Style: Authentic vintage aesthetic, documentary realism, focus on highly detailed hand-embroidery (Paj Ntaub), heavy silver jewelry (Xauv), hemp fabrics, natural mountain daylight, earthy tones, mountainous village background, realistic 1:1 human scale, respectful cultural representation.',
        'H’Mông hiện đại – bản sắc kết hợp thời trang': 'Modern Hmong Fusion: High-fashion editorial look, contemporary streetwear silhouettes mixed with authentic traditional Hmong batik patterns and embroidery, stylish highland backdrop, grounded natural posture, sharp focus.',
        'H’Mông cổ tích – Fantasy': 'Hmong Fantasy Folklore: Enchanting and mystical atmosphere, soft morning mist drifting through mountains, lush blooming flora, characters wearing elaborate traditional Hmong attire with glowing accents, naturally grounded on solid terrain at realistic human scale.',
        'H’Mông 3D Animation': '3D Cinematic Animation (Pixar/Disney aesthetic): Expressive character design, soft subsurface scattering on skin, vibrant colors, warm global illumination, grounded storytelling composition in a charming highland village.',
        'H’Mông Cinematic – Điện ảnh 4K': 'Cinematic 4K Masterpiece: Dramatic lighting (chiaroscuro / volumetric sunbeams), shallow depth of field, highly detailed skin texture, emotional atmosphere, 2.39:1 widescreen cinema framing, blockbuster color grading, grounded realism.',
        'H’Mông Documentaries – Phong cách phim tài liệu': 'National Geographic Documentary: Raw authentic realism, natural sunlight, candid moments, deep cultural depth, sharp focus on eyes and traditional craftsmanship, realistic environmental scale, deep cultural respect.',
        'H’Mông Watercolor – Sơn thủy màu nước': 'Traditional Watercolor Painting: Soft wet-on-wet brush strokes, ink wash mountains, artistic and fluid, dripping paint accents, pastel color palette, serene and poetic atmosphere.',
        'H’Mông Manga – Anime Nhật Bản': 'Japanese Anime/Manga Style: Makoto Shinkai aesthetic, luminous skies, vibrant colors, expressive eyes, detailed painted mountain scenery, clean cel-shading.',
        'H’Mông Realistic Portrait – Siêu thực 8K': '8K Hyper-Realistic Photography: Visible micro skin pores, vellus hair, perfect studio lighting, extremely sharp eyes, intricate authentic textile embroidery details directly cloned from the input reference, lifelike 1:1 anatomy.',
        'H’Mông Cyberpunk – Tương lai kết hợp văn hóa': 'Hmong Cyberpunk: Futuristic highland setting, neon accents (cyan/magenta) woven into traditional batik patterns, evening mist, futuristic lanterns, grounded cyberpunk aesthetic.',
        'Giấc mơ': 'Ethereal Dreamscape: Soft morning mist drifting over mountain ridges, gentle golden hour glow, poetic and atmospheric lighting, pastel and ethereal tones, dreamy shallow depth of field, characters naturally grounded in a serene highland landscape at 1:1 human scale.',
        'Ảo ảnh': 'Prismatic Optical Art: Subtle kaleidoscopic lens refractions, soft natural light streaks, high-fashion editorial aesthetics, artistic color spectrums, perfectly grounded subjects with true-to-life physical proportions.',
        'Chân thực': 'Standard Photorealistic: Balanced natural lighting, true-to-life colors, authentic skin tones, sharp focus, unmanipulated real-world perspective and scale.',
        'Điện ảnh': 'Standard Cinematic: Dramatic shadows, moody lighting, film grain, cinematic color grading, 1:1 human scale.',
        'Studio chuyên nghiệp': 'Professional Studio Photography: Solid or gradient backdrop, 3-point softbox lighting setup, perfect rim light, sharp subject, fashion magazine quality.',
        'Thời trang': 'High Fashion Editorial: High-fashion posture, avant-garde makeup, focus on outfit silhouette, dramatic yet realistic lighting, vogue style.'
    };
    return mapping[style] || 'High quality, photorealistic, Hmong cultural elements, 1:1 realistic human scale.';
};

// --- CHARACTER AESTHETIC DIRECTIVE HELPER ---
export const getCharacterAestheticDirective = (style?: string): string => {
    // Default and only character aesthetic: Korean K-Pop Idol / Ulzzang Hot Boy & Hot Girl wearing authentic H'Mông regalia
    return KOREAN_CHARACTER_DEFAULTS;
};

// --- PROMPT OPTIMIZER ---
export const optimizePrompt = async (apiKey: string, rawInput: string): Promise<string> => {
    // Check VIP mode first
    const systemApiKey = getVIPApiKey();
    const useVip = systemApiKey !== null;

    const systemInstruction = `
    You are a professional Photography Prompt Engineer.
    Task: Convert the user's simple description into a high-end AI image generation prompt.
    
    Structure the output to include:
    1. Subject Description (Detailed)
    2. Camera Angle & Composition (e.g., Low angle, rule of thirds)
    3. Lighting (e.g., Softbox, cinematic, volumetric)
    4. Technical Specs (e.g., 85mm lens, f/1.8, 8k, UHD)
    5. Vibe/Atmosphere
    
    Input: "${rawInput}"
    
    Output Format: A single paragraph, concise but rich in technical keywords. No introduction.
    `;

    // PRIORITY -1: NineRouter mode (isolated; never fall back to billable providers)
    if (nineRouterService.isNineRouterEnabled()) {
        console.log('[9Router] Optimizing prompt...');
        const status = await nineRouterService.checkConnection();
        if (!status.connected) {
            throw new Error(status.errorMessage || 'Cấu hình chưa kết nối.');
        }

        const result = await nineRouterService.generateTextViaNineRouter(
            systemInstruction + "\n\nInput: " + rawInput
        );
        if (!result) {
            throw new Error('Cấu hình không trả về nội dung text. Hãy kiểm tra Text Model.');
        }
        return result;
    }

    try {
        // Use VIP system key for text generation
        if (useVip && systemApiKey) {
            try {
                const aiSystem = getGeminiClient(systemApiKey);
                const response = await aiSystem.models.generateContent({
                    model: GEMINI_TEXT_MODEL, // Use text model for prompt generation
                    contents: [
                        { role: 'user', parts: [{ text: systemInstruction + "\n\nInput: " + rawInput }] }
                    ]
                });
                if (response.text) return response.text;
            } catch (err) {
                console.error('VIP prompt generation failed:', err);
                // Will fall through to Gemini fallback
            }
        }

        // Non-VIP or Fallback: Use Gemini
        const geminiApiKey = getStoredApiKey('gemini');
        if (!geminiApiKey) {
            return rawInput; // Return original if no key available
        }

        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const response = await ai.models.generateContent({
            model: GEMINI_TEXT_MODEL,  // Text-only model for optimization
            contents: rawInput,
            config: { systemInstruction }
        });
        return response.text || rawInput;
    } catch (e) {
        console.error("Optimizer failed", e);
        return rawInput;
    }
};

// --- BATCH PROMPT GENERATION (TEXT) ---
export const generateBatchPromptsText = async (
    apiKey: string,
    topic: string,
    count: number,
    shotType: string,
    style: string,
    outputMode: 'single' | 'couple',
    inputCounts: { male: number, female: number, maleAcc: number, femaleAcc: number },
    refImages?: CreativeRefImages
): Promise<string> => {
    // Check VIP mode first
    const systemApiKey = getVIPApiKey();
    const useVip = systemApiKey !== null;

    console.log('[VIP Debug] generateBatchPromptsText - VIP Mode:', useVip);

    let modeInstruction = "";
    if (outputMode === 'couple') {
        modeInstruction = `OUTPUT MODE: COUPLE (MALE AND FEMALE TOGETHER).
        You MUST generate prompts where BOTH the Male Korean idol AND the Female Korean idol appear TOGETHER in the same scene interacting naturally.
        MANDATORY DUAL-OUTFIT CLAUSE IN EVERY SINGLE PROMPT:
        - The Male character: explicitly describe "the male idol is wearing 100% of the authentic MALE REFERENCE OUTFIT shown in the input photo, replicating exact colors, jacket/suit cut, trousers, and embroidery".
        - The Female character: explicitly describe "the female idol is wearing 100% of the authentic FEMALE REFERENCE OUTFIT shown in the input photo, replicating exact dress colors, bodice, floral patterns, flared skirt, and matching headdress".
        - ABSOLUTE PROHIBITION: DO NOT describe the female character in generic black/indigo clothing if the input outfit is different (e.g. red, pink, white). BOTH outfits MUST be explicitly designated to their respective models in every single prompt!`;
    } else {
        // SINGLE MODE - Determine gender based on which input slots have images
        const hasMaleInput = inputCounts.male > 0;
        const hasFemaleInput = inputCounts.female > 0;

        if (hasMaleInput && !hasFemaleInput) {
            // ONLY MALE INPUT → ALL prompts must be MALE
            modeInstruction = `OUTPUT MODE: SINGLE (MALE ONLY). 
            ALL ${count} prompts MUST feature ONLY handsome male characters.
            DO NOT generate ANY female characters in ANY prompt.
            Every single prompt must describe a MALE person wearing the male outfit reference.
            This is NON-NEGOTIABLE - all ${count} images will be of MALE characters only.`;
        } else if (hasFemaleInput && !hasMaleInput) {
            // ONLY FEMALE INPUT → ALL prompts must be FEMALE
            modeInstruction = `OUTPUT MODE: SINGLE (FEMALE ONLY). 
            ALL ${count} prompts MUST feature ONLY beautiful female characters.
            DO NOT generate ANY male characters in ANY prompt.
            Every single prompt must describe a FEMALE person wearing the female outfit reference.
            This is NON-NEGOTIABLE - all ${count} images will be of FEMALE characters only.`;
        } else if (hasMaleInput && hasFemaleInput) {
            // BOTH INPUTS → Alternate between genders
            modeInstruction = "OUTPUT MODE: SINGLE (SEPARATE). You MUST generate prompts for SOLO portraits (1 person per image). Since BOTH Male and Female inputs are present, ALTERNATE prompts between genders (Male, Female, Male...).";
        } else {
            // NO INPUTS (fallback) → Default to alternating
            modeInstruction = "OUTPUT MODE: SINGLE (SEPARATE). You MUST generate prompts for SOLO portraits (1 person per image). ALTERNATE prompts between genders (Male, Female, Male...).";
        }
    }

    const styleDetail = getStylePrompt(style);
    const characterAesthetics = getCharacterAestheticDirective(style);
    const shotDirective = nineRouterService.getShotTypeDirective(shotType);

    const labeledReferences: nineRouterService.NineRouterLabeledReferenceImage[] = refImages ? [
        ...(refImages.male || []).map((img, idx) => ({ ...img, label: `MALE OUTFIT ${idx + 1}` })),
        ...(refImages.female || []).map((img, idx) => ({ ...img, label: `FEMALE OUTFIT ${idx + 1}` })),
        ...(refImages.maleAccessories || []).map((img, idx) => ({ ...img, label: `MALE ACCESSORY ${idx + 1}` })),
        ...(refImages.femaleAccessories || []).map((img, idx) => ({ ...img, label: `FEMALE ACCESSORY ${idx + 1}` }))
    ] : [];

    const systemInstruction = `
    You are an AI Art Director for a professional Photography Studio.
    Task: Generate exactly ${count} distinct but thematically linked English prompts based on the Topic: "${topic}".
    
    *** CRITICAL OUTPUT FORMAT ***
    Every prompt MUST describe a COMPLETE SCENE with REAL PERSON(S) wearing the clothing.
    - NEVER create prompts for: just clothing without people, mannequins, flat-lay displays, or product photography
    - ALWAYS describe the PERSON in the scene: their pose, expression, and action
    - MANDATORY: Include phrases like "a person wearing...", "model dressed in...", "character standing/walking/posing in..."
    
    *** MANDATORY PHYSICAL GROUNDING & HUMAN SCALE RULES (STRICT NON-NEGOTIABLE) ***
    1. REALISTIC 1:1 HUMAN SCALE: Characters MUST be rendered in true-to-life 1:1 human scale relative to all surrounding objects, market stalls, houses, tents, and trees. NEVER create prompts that allow characters to appear as giant titans towering over miniature landscapes.
    2. SOLID PHYSICAL GROUND CONTACT: Characters MUST have their feet firmly planted on solid physical terrain (walking along a dirt trail, standing on stone terrace steps, browsing between market stalls on cobblestones). NEVER describe characters hovering in mid-air, floating in the sky, or standing on thin air.
    3. GROUNDED PERSPECTIVE: Even if the camera shot is wide or elevated (flycam/drone/bird's-eye), the subjects MUST be standing firmly on an elevated foreground overlook, mountain ledge, or scenic trail with clear contact shadows, anchored within the landscape.
    
    *** MANDATORY CHARACTER AESTHETICS ***
    ${characterAesthetics}
    
    *** ABSOLUTE RULES FOR INPUT ACCURACY (NON-NEGOTIABLE) ***
    1. REFERENCE OUTFIT CLONING: The outfit reference images are NOT inspiration - they are TEXTURES to be mapped EXACTLY.
       - Clone 100% the patterns, colors, cuts, embroidery, and every detail of the clothing directly from the input photo(s).
       - CRITICAL: DO NOT invent specific colors or clothing items (e.g. NEVER write "indigo skirt", "silver collar", etc.).
       ${outputMode === 'couple' ?
         `- COUPLE REQUIREMENT: Every prompt MUST explicitly describe BOTH the Male idol wearing the MALE Reference Outfit (100% original colors, cuts, and embroidery) AND the Female idol wearing the FEMALE Reference Outfit (100% original colors, bodice, flared skirt, and headdress).` :
         `- Every prompt MUST contain: "THE PERSON is wearing the EXACT Reference Outfit shown in the input photo, replicated 100% with original colors and textures"`
       }
    2. REFERENCE ACCESSORY CLONING: If accessory images are provided:
       - Male Accessory: The male MUST hold/use the EXACT item shown in the reference image
       - Female Accessory: The female MUST hold/use the EXACT item shown in the reference image
    3. NO MODIFICATIONS ALLOWED: Do not change, interpret, or "improve" the outfit/accessories. Clone them EXACTLY.
    4. STYLE COMPLIANCE: "${styleDetail}"
    5. SHOT TYPE & CAMERA COMPOSITION: "${shotType}"
       ${shotDirective}
    6. ${modeInstruction}
    
    *** PROMPT STRUCTURE ***
    ${outputMode === 'couple' ?
      `Each prompt should follow: "[Handsome Korean male idol] wearing 100% of the authentic Male Reference Outfit with exact cuts and embroidery + [stunning Korean female idol] wearing 100% of the authentic Female Reference Outfit with exact colors and headdress + [natural couple interaction/pose firmly grounded on solid terrain] + [scene/background in realistic 1:1 scale] + [cinematic lighting/mood]"
    Example: "A breathtakingly handsome Korean male K-pop idol center visual wearing 100% of the authentic Male Reference Outfit with exact cuts and embroidery, holding hands warmly with an extraordinarily gorgeous Korean female idol wearing 100% of the authentic Female Reference Outfit with exact vibrant colors, floral bodice, flared skirt, and matching headdress, both standing firmly grounded on a cobblestone mountain trail, surrounded by authentic highland village scenery in realistic 1:1 human scale, cinematic golden hour lighting"` :
      `Each prompt should follow: "[Person description with cultural/aesthetic fidelity] + [wearing exact reference outfit] + [action/pose firmly grounded on solid terrain] + [scene/background in realistic 1:1 scale] + [lighting/mood]"
    Example: "A breathtakingly handsome Korean male K-pop idol center visual, flawless porcelain glass skin, captivating eyes, tall athletic build, wearing the EXACT authentic outfit from the input reference photo with 100% color and embroidery fidelity, standing firmly on a stone terrace path with feet grounded on solid rock, surrounded by authentic highland market stalls at realistic 1:1 human scale, shot with authentic photographic composition, cinematic lighting"`
    }

    Output format: Just the prompts, separated by double newlines. No numbering, no introduction.
    `;

    // PRIORITY -1: NineRouter mode (isolated; never fall back to billable providers)
    if (nineRouterService.isNineRouterEnabled()) {
        console.log('[9Router] Checking connection for prompt generation...');
        const status = await nineRouterService.checkConnection();
        if (!status.connected) {
            throw new Error(status.errorMessage || 'Cấu hình chưa kết nối.');
        }

        const textModel = nineRouterService.getNineRouterTextModel();
        console.log(`[9Router] Using 9Router for prompt generation with text model: ${textModel}`);
        const result = await nineRouterService.generateTextViaNineRouter(
            `Generate ${count} prompts for topic: ${topic}`,
            textModel,
            systemInstruction,
            labeledReferences
        );
        if (!result) {
            throw new Error('Cấu hình không trả về nội dung text. Hãy kiểm tra Text Model.');
        }
        return result;
    }

    // PRIORITY 0: Antigravity mode first
    if (antigravityService.isAntigravityEnabled()) {
        console.log('[Antigravity] Checking connection for prompt generation...');
        const status = await antigravityService.checkConnection();
        if (status.connected) {
            console.log('[Antigravity] Using Antigravity for prompt generation');
            try {
                const result = await antigravityService.generateTextViaAntigravity(
                    `Generate ${count} prompts for topic: ${topic}`,
                    'claude-opus-5-5-high',
                    systemInstruction,
                );
                if (result) return result;
                console.warn('[Antigravity] Text generation returned null, falling back...');
            } catch (err) {
                console.error('[Antigravity] Prompt generation failed:', err);
            }
        } else {
            // NOT CONNECTED - Log warning but continue to fallback
            console.warn('[Antigravity] Not connected - falling back to VIP/User key');
        }
    }

    // PRIORITY 1: Use VIP system key for text generation
    if (useVip && systemApiKey) {
        try {
            const aiSystem = getGeminiClient(systemApiKey);
            const response = await aiSystem.models.generateContent({
                model: GEMINI_TEXT_MODEL, // Use text model for prompt generation
                contents: [
                    { role: 'user', parts: [{ text: systemInstruction + "\n\nTask: Generate " + count + " prompts for topic: " + topic }] }
                ]
            });
            if (response.text) return response.text;
        } catch (err) {
            console.error('VIP prompt generation failed:', err);
            // Will fall through to Gemini fallback
        }
    }

    // PRIORITY 2 (Fallback): Use Gemini (GEMINI_TEXT_MODEL for text-only generation)
    const geminiApiKey = getStoredApiKey('gemini');
    if (!geminiApiKey) {
        // IMPROVED ERROR: More helpful message
        const reason = antigravityService.isAntigravityEnabled()
            ? 'Antigravity không kết nối được (hãy bật app Antigravity hoặc tắt chế độ này)'
            : 'Không có API key Gemini';
        throw new Error(`${reason}. Vui lòng nhập API key hoặc bật lại kết nối.`);
    }

    const ai = getGeminiClient(geminiApiKey);
    const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,  // Text-only model for prompt generation
        contents: `Generate ${count} prompts for topic: ${topic}`,
        config: {
            systemInstruction: systemInstruction,
        }
    });

    return response.text || '';
};

// --- IMAGE GENERATION ---
export const generateImagesFromPromptsList = async (
    apiKey: string,
    prompts: string[],
    refImages: CreativeRefImages,
    aspectRatio: string,
    resolution: string,
    onStatusUpdate: (status: string) => void,
    onImageGenerated: (index: number, base64: string | null) => void,
    style?: string,
    shotType?: string
): Promise<void> => {
    // Check if NineRouter mode is enabled
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    let nineRouterConnected = false;

    if (useNineRouterMode) {
        onStatusUpdate('[Cấu hình] Đang kiểm tra kết nối...');
        const status = await nineRouterService.checkConnection();
        nineRouterConnected = status.connected;
        console.log('[9Router Debug] Mode enabled, connected:', nineRouterConnected);
    }

    // Check if Antigravity mode is enabled
    const useAntigravityMode = antigravityService.isAntigravityEnabled();
    let antigravityConnected = false;

    if (useAntigravityMode) {
        onStatusUpdate('[Antigravity] Đang kiểm tra kết nối...');
        const status = await antigravityService.checkConnection();
        antigravityConnected = status.connected;
        console.log('[Antigravity Debug] Mode enabled, connected:', antigravityConnected);
    }

    // Check if VIP mode is enabled
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;

    console.log('[Debug] Antigravity:', useAntigravityMode && antigravityConnected, 'VIP Mode:', useVipMode, 'Key exists:', !!systemApiKey);

    // Get Gemini API key for fallback (user's own key from storage)
    const geminiApiKey = getStoredApiKey('gemini');

    // Create Gemini client for fallback or primary use
    const ai = await getEffectiveGeminiClient(geminiApiKey);

    // Flatten reference images for Gemini
    const allRefImages = [
        ...refImages.male,
        ...refImages.female,
        ...refImages.maleAccessories,
        ...refImages.femaleAccessories
    ];

    // Preserve category and gender binding in the native multimodal image request.
    const rawNineRouterReferences: nineRouterService.NineRouterLabeledReferenceImage[] = [
        ...refImages.male.map((img, index) => ({ ...img, label: `MALE OUTFIT ${index + 1}` })),
        ...refImages.female.map((img, index) => ({ ...img, label: `FEMALE OUTFIT ${index + 1}` })),
        ...refImages.maleAccessories.map((img, index) => ({ ...img, label: `MALE ACCESSORY ${index + 1}` })),
        ...refImages.femaleAccessories.map((img, index) => ({ ...img, label: `FEMALE ACCESSORY ${index + 1}` }))
    ];

    // Automatically optimize reference images (downsample & compress JPEG, saving ~90% bandwidth)
    const labeledNineRouterReferences = await optimizeReferenceImages(rawNineRouterReferences);
    const optimizedAllRefImages = await optimizeReferenceImages(allRefImages);

    // Gemini format
    const allRefParts = optimizedAllRefImages.map(img => ({
        inlineData: {
            data: img.data,
            mimeType: img.mimeType
        }
    }));

    // Fixed seed logic for consistency
    const sessionSeed = Math.floor(Math.random() * 1000000);

    // Determine concurrency based on mode:
    // NineRouter runs 2 parallel workers (supported by lightweight optimized payloads)
    const concurrency = nineRouterConnected ? 2 : antigravityConnected ? 1 : useVipMode ? 2 : 2;
    onStatusUpdate(`🚀 Đang tạo ${prompts.length} ảnh song song (x${concurrency})...`);

    // Create tasks for parallel execution
    const generateSingleImage = async (index: number): Promise<string | null> => {
        const prompt = prompts[index];
        try {
            console.log(`[Parallel] Starting image ${index + 1}/${prompts.length}`);

            // MASTER CONSTRAINT PROTOCOL - Enhanced with Cultural & Technical Compliance
            const hasMaleAccessories = refImages.maleAccessories.length > 0;
            const hasFemaleAccessories = refImages.femaleAccessories.length > 0;

            const characterAesthetics = getCharacterAestheticDirective(style);
            const shotDirective = nineRouterService.getShotTypeDirective(shotType);

    const labeledReferences: nineRouterService.NineRouterLabeledReferenceImage[] = refImages ? [
        ...(refImages.male || []).map((img, idx) => ({ ...img, label: `MALE OUTFIT ${idx + 1}` })),
        ...(refImages.female || []).map((img, idx) => ({ ...img, label: `FEMALE OUTFIT ${idx + 1}` })),
        ...(refImages.maleAccessories || []).map((img, idx) => ({ ...img, label: `MALE ACCESSORY ${idx + 1}` })),
        ...(refImages.femaleAccessories || []).map((img, idx) => ({ ...img, label: `FEMALE ACCESSORY ${idx + 1}` }))
    ] : [];
            const framingDirective = nineRouterService.getAspectFramingDirective(aspectRatio, shotType);

            // Dynamic resolution directive
            const resUpper = (resolution || "FHD").toUpperCase();
            const resolutionDirective = resUpper === "4K"
                ? "*** MANDATORY RESOLUTION: ULTRA-HD 4K (3840px / 2160px canvas) ***\n- Microscopic detail on fabric embroidery, silver jewelry, and skin texture. Absolutely zero blur or digital compression artifacts."
                : resUpper === "2K"
                ? "*** MANDATORY RESOLUTION: 2K QUAD-HD (2560px / 1440px canvas) ***\n- Highly defined textures and crisp contours."
                : "*** RESOLUTION: FULL HD 1080P (High Fidelity) ***";

            // Dynamic person framing enforcement based on shotType
            const isPortrait = shotType?.toLowerCase().includes("chân dung") || shotType?.toLowerCase().includes("portrait");
            const isMacro = shotType?.toLowerCase().includes("cận cảnh") || shotType?.toLowerCase().includes("macro");
            const isCouple = (refImages.male && refImages.male.length > 0) && (refImages.female && refImages.female.length > 0);
            const outfitTryOnDirective = isCouple
                ? `*** COUPLE SCENE & STRICT DUAL-OUTFIT TRY-ON PROTOCOL (MANDATORY) ***
            - DUAL SUBJECT: Both a handsome Korean male K-Pop idol and an exquisitely beautiful Korean female idol appear together in the scene.
            - MALE OUTFIT BINDING: Map 100% of 'INPUT REFERENCE: MALE OUTFIT' exclusively onto the Male model (exact colors, suit/jacket cut, pants, embroidery).
            - FEMALE OUTFIT BINDING: Map 100% of 'INPUT REFERENCE: FEMALE OUTFIT' exclusively onto the Female model (exact dress colors, bodice, sleeves, flared skirt, embroidery, and headdress).
            - ZERO HALLUCINATION ON FEMALE OUTFIT: Strictly FORBIDDEN to render the female in generic black/indigo velvet or generic silver collars. The female model MUST replicate the exact color palette (e.g. red, pink, white, blue) and design from 'INPUT REFERENCE: FEMALE OUTFIT'.
            - COMPLETE REPLICATION: Faithfully reproduce all embroidery motifs, textile patterns, trims, and accessories from both reference photos with 100% fidelity.`
                : (refImages.female && refImages.female.length > 0)
                ? `*** FEMALE SOLO SCENE & OUTFIT TRY-ON PROTOCOL ***
            - FEMALE OUTFIT BINDING: Map 100% of 'INPUT REFERENCE: FEMALE OUTFIT' exclusively onto the Female model (exact dress colors, bodice, sleeves, flared skirt, embroidery, and headdress).
            - ZERO HALLUCINATION ON FEMALE OUTFIT: Strictly FORBIDDEN to render the female in generic black/indigo velvet or generic silver collars. The female model MUST replicate the exact color palette and design from 'INPUT REFERENCE: FEMALE OUTFIT'.`
                : (refImages.male && refImages.male.length > 0)
                ? `*** MALE SOLO SCENE & OUTFIT TRY-ON PROTOCOL ***
            - MALE OUTFIT BINDING: Map 100% of 'INPUT REFERENCE: MALE OUTFIT' exclusively onto the Male model (exact colors, suit/jacket cut, pants, embroidery).
            - Faithfully replicate 100% of the reference garments onto the male model.`
                : `*** VIRTUAL TRY-ON ENFORCEMENT ***
            - Clone 100% the patterns, colors, cuts, and every detail of the clothing directly from the input photo(s).`;

            const personFramingRule = isPortrait
                ? "- MANDATORY FRAMING: TIGHT VERTICAL PORTRAIT (Head and chest bust shot). The person MUST be wearing the upper garment and neck jewelry/accessories. DO NOT PULL BACK to full body; legs/feet must NOT be shown."
                : isMacro
                ? "- MANDATORY FRAMING: EXTREME CLOSE-UP (MACRO). Tight focus on the intricate embroidery craft, silver accessories, or facial details."
                : "- MANDATORY FRAMING & PHYSICAL GROUNDING: FULL BODY OR THREE-QUARTER SHOT. The person MUST have their feet firmly planted on solid physical terrain (dirt path, stone terrace steps, market floor) with realistic contact shadows and exact 1:1 human scale to the environment. ABSOLUTELY NO floating in the air, NO giant titans towering over miniature landscapes.";

            const masterConstraint = `
            🚨🚨🚨 ASPECT RATIO: ${aspectRatio} - THIS IS MANDATORY AND NON-NEGOTIABLE 🚨🚨🚨
            ${ASPECT_RATIO_ENFORCEMENT}

            ${resolutionDirective}
            
            *** MASTER IDENTITY & OUTFIT CONSTRAINT PROTOCOL ***
            
            *** CRITICAL: PERSON IN CLOTHING ENFORCEMENT ***
            - OUTPUT MUST BE: A COMPLETE PHOTOGRAPH of REAL PERSON(S) wearing the clothing
            - NEVER output: Just clothing without a person, mannequin displays, flat-lay product shots, or clothing on hangers
            ${personFramingRule}
            - The person(s) should be in a NATURAL POSE in the scene, interacting with the environment
            - REJECT any output that shows only the garment/fabric without a human wearing it
            
            *** MANDATORY PHYSICAL REALISM & 1:1 HUMAN SCALE ***
            - FEET FIRMLY ON SOLID GROUND: Subjects must stand, walk, or sit directly on visible solid ground with natural contact shadows.
            - ZERO HOVERING / NO GIANTS: Never place subjects floating in the sky or scaled up like titans over miniature scenery. Exact 1:1 realistic human scale is non-negotiable.
            
            ${characterAesthetics}

            *** STRICT CAMERA & COMPOSITION INSTRUCTION ***
            ${shotDirective}
            
            ${outfitTryOnDirective}
            - IDENTITY LOCK: Use SEED ${sessionSeed} to maintain consistent features across all generated images.
            ${hasMaleAccessories || hasFemaleAccessories ?
                    `- ACCESSORY CLONING: The accessory image(s) provided MUST appear in the output EXACTLY as shown.
                 - Male has accessory: ${hasMaleAccessories ? 'YES - clone it exactly' : 'NO - empty hands'}
                 - Female has accessory: ${hasFemaleAccessories ? 'YES - clone it exactly' : 'NO - empty hands'}` :
                    `- NO ACCESSORIES PROVIDED: Both characters should have EMPTY HANDS. Do NOT add any props, instruments, or items.`
                }
            
            ${NO_EXTRA_ACCESSORIES}
            
            ${CLEAN_OUTPUT_REQUIREMENTS}
            
            ${ULTRA_SHARP_QUALITY}
            
            ⚠️ FINAL REMINDER: OUTPUT MUST BE EXACTLY ${aspectRatio} ASPECT RATIO WITH ${resUpper} RESOLUTION QUALITY ⚠️
            `;

            const fullPrompt = `${masterConstraint}\n\n${framingDirective}\n\nSCENE DESCRIPTION: ${prompt}\n\n*** FINAL COMPOSITION RULE ***\nUse the requested scene/background exactly while preserving the labeled outfits and accessories from the original reference pixels. Do not reuse the backgrounds from input reference photos.\n\n[ASPECT RATIO CHECK: Generate this image with EXACTLY ${aspectRatio} dimensions at ${resUpper} resolution]`;

            let base64Image: string | null = null;
            let usedVip = false;
            let usedAntigravity = false;
            let usedNineRouter = false;

            // PRIORITY -1: NineRouter mode (if enabled and connected)
            if (useNineRouterMode && nineRouterConnected && !base64Image) {
                onStatusUpdate(`[Cấu hình] Đang tạo ảnh ${index + 1}/${prompts.length}...`);
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        base64Image = await nineRouterService.generateImageViaNineRouter({
                            prompt: fullPrompt,
                            referenceImages: labeledNineRouterReferences,
                            aspectRatio: aspectRatio,
                            resolution: resolution,
                            shotType: shotType,
                            style: style,
                            taskType: 'create',
                            outputMode: isCouple ? 'couple' : 'single'
                        });
                        if (base64Image) {
                            usedNineRouter = true;
                            console.log(`[9Router] Image ${index + 1} generated successfully`);
                            break;
                        } else {
                            console.warn(`[9Router] Attempt ${attempt + 1}: Image ${index + 1} returned null`);
                            if (attempt < 2) {
                                onStatusUpdate(`[Cấu hình] Thử lại ${attempt + 1}/3 cho ảnh ${index + 1}...`);
                                await delay(2000);
                            }
                        }
                    } catch (err: any) {
                        console.error(`[9Router] Attempt ${attempt + 1} failed:`, err);
                        const errorMsg = err?.message || String(err);
                        const isQuotaError = errorMsg.toLowerCase().includes('quota')
                            || errorMsg.toLowerCase().includes('exhausted')
                            || errorMsg.includes('429');

                        if (isQuotaError) {
                            console.error('[9Router] QUOTA EXHAUSTED - Mode isolated');
                            throw new Error('NINEROUTER_QUOTA_EXHAUSTED');
                        }

                        if (attempt < 2) {
                            onStatusUpdate(`[Cấu hình] Lỗi, thử lại sau 3s (${attempt + 2}/3)...`);
                            await delay(3000);
                        }
                    }
                }

                if (!base64Image) {
                    console.error('[9Router] Failed after all retries - no fallback (isolated mode)');
                    throw new Error('NINEROUTER_FAILED');
                }
            }

            // PRIORITY 0: Antigravity mode (if enabled and connected)
            if (useAntigravityMode && antigravityConnected && !base64Image) {
                onStatusUpdate(`[Antigravity] Đang tạo ảnh ${index + 1}/${prompts.length}...`);

                // SPEED OPTIMIZED: 3 retries with short delay
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        // Note: fullPrompt already contains VIP constraints, so useVIPPrompt=false
                        // to avoid duplicate constraints
                        base64Image = await antigravityService.generateImageViaAntigravity({
                            prompt: fullPrompt,
                            referenceImages: optimizedAllRefImages,
                            aspectRatio: aspectRatio,
                            model: 'gemini-3-pro-image', // Correct Antigravity image model
                            useVIPPrompt: false, // fullPrompt already has VIP constraints
                            hasMaleAccessories,
                            hasFemaleAccessories,
                            sessionSeed
                        });

                        if (base64Image) {
                            usedAntigravity = true;
                            console.log(`[Antigravity] Image ${index + 1} generated successfully with aspect ratio:`, aspectRatio);
                            break; // Success, exit retry loop
                        } else {
                            console.warn(`[Antigravity] Attempt ${attempt + 1}: Image ${index + 1} returned null`);
                            if (attempt < 2) {
                                onStatusUpdate(`[Antigravity] Retry ${attempt + 1}/3 cho ảnh ${index + 1}...`);
                                await delay(2000); // Quick 2s delay
                            }
                        }
                    } catch (err: any) {
                        console.error(`[Antigravity] Attempt ${attempt + 1} failed:`, err);

                        // Smart delay: parse wait time from error message (e.g., "Please wait 29s")
                        const errorMsg = err?.message || String(err);
                        const waitMatch = errorMsg.match(/wait\s*(\d+)\s*s/i);
                        const waitSeconds = waitMatch ? parseInt(waitMatch[1], 10) : 0;

                        // FAST FAIL: Detect quota exhaustion and stop retrying
                        const isQuotaError = errorMsg.toLowerCase().includes('quota')
                            || errorMsg.toLowerCase().includes('exhausted')
                            || errorMsg.includes('429')
                            || errorMsg.includes('RESOURCE_EXHAUSTED');

                        if (isQuotaError) {
                            console.error('[Antigravity] QUOTA EXHAUSTED - Mode isolated, no fallback');
                            // ISOLATED MODE: Throw error instead of fallback
                            throw new Error('ANTIGRAVITY_QUOTA_EXHAUSTED');
                        }

                        if (attempt < 2) {
                            const waitTime = waitSeconds > 0
                                ? (waitSeconds + 1) * 1000 // Use exact wait time + 1s buffer
                                : 3000; // Default 3s

                            onStatusUpdate(`[Antigravity] Chờ ${Math.round(waitTime / 1000)}s rồi thử lại (${attempt + 2}/3)...`);
                            await delay(waitTime);
                        }
                    }
                }

                // ISOLATED MODE: If Antigravity enabled but failed, throw error instead of fallback
                if (!base64Image) {
                    console.error('[Antigravity] Failed after all retries - no fallback (isolated mode)');
                    throw new Error('ANTIGRAVITY_FAILED');
                }
            }

            // PRIORITY 1: VIP mode uses the system Gemini key only
            if (!base64Image && useVipMode) {
                console.log('[VIP] Using Gemini system key for VIP generation');
                onStatusUpdate(`[VIP] Đang tạo ảnh ${index + 1}/${prompts.length}...`);

                try {
                    base64Image = await callWithRetry(
                        async () => generateImageWithSystemKey(systemApiKey!, fullPrompt, labeledNineRouterReferences, aspectRatio),
                        3,
                        5000,
                        (msg) => onStatusUpdate(`[VIP ${index + 1}] ${msg}`)
                    );

                    if (base64Image) {
                        usedVip = true;
                        console.log(`[VIP] Image ${index + 1} generated successfully`);
                    }
                } catch (vipError) {
                    // ISOLATED MODE: VIP fail = throw error, no fallback to FREE
                    console.error('[VIP] Generation failed - isolated mode, no fallback:', vipError);
                    throw new Error('VIP_MODE_FAILED');
                }
            }

            // FREE mode ONLY: Use Gemini API (NO FALLBACK - only runs if mode is explicitly FREE)
            // FIX: Check that Antigravity/NineRouter is BOTH enabled AND connected, not just enabled
            const isAntigravityActive = useAntigravityMode && antigravityConnected;
            const isNineRouterActive = useNineRouterMode && nineRouterConnected;
            if (!base64Image && ai && !useVipMode && !isAntigravityActive && !isNineRouterActive) {
                console.log(`[FREE] Entering FREE mode for image ${index + 1}`, {
                    hasAi: !!ai,
                    useVipMode,
                    useAntigravityMode,
                    antigravityConnected,
                    isAntigravityActive,
                    isNineRouterActive,
                    model: getActiveImageModel()
                });
                onStatusUpdate(`[FREE] Đang tạo ảnh ${index + 1} (Gemini)...`);
                try {
                    base64Image = await callWithRetry(
                        async () => {
                            console.log(`[FREE] Calling Gemini API for image ${index + 1}...`);
                            const response = await ai.models.generateContent({
                                model: getActiveImageModel(),
                                contents: {
                                    parts: [
                                        ...allRefParts,
                                        { text: fullPrompt }
                                    ]
                                },
                                config: {
                                    responseModalities: [Modality.IMAGE, Modality.TEXT], // REQUIRED for image generation
                                    imageConfig: {
                                        aspectRatio: aspectRatio as any // Supported by gemini-2.0-flash-preview-image-generation
                                    }
                                }
                            });

                            console.log(`[FREE] Gemini response for image ${index + 1}:`, {
                                hasCandidates: !!response.candidates,
                                candidateCount: response.candidates?.length,
                                hasContent: !!response.candidates?.[0]?.content,
                                partsCount: response.candidates?.[0]?.content?.parts?.length
                            });

                            if (response.candidates?.[0]?.content?.parts) {
                                for (const part of response.candidates[0].content.parts) {
                                    if (part.inlineData) {
                                        console.log(`[FREE] Image ${index + 1} generated successfully!`);
                                        return part.inlineData.data;
                                    }
                                }
                            }
                            console.warn(`[FREE] No inlineData found for image ${index + 1}`);
                            return null;
                        },
                        3,
                        5000,
                        (msg) => onStatusUpdate(`[FREE ${index + 1}] ${msg}`)
                    );
                } catch (freeError) {
                    console.error(`[FREE] Error in callWithRetry for image ${index + 1}:`, freeError);
                    // Don't re-throw, let it continue to the error handling below
                }
            } else {
                console.log(`[FREE] Skipped FREE mode for image ${index + 1}`, {
                    hasBase64Image: !!base64Image,
                    hasAi: !!ai,
                    useVipMode,
                    isAntigravityActive,
                    isNineRouterActive
                });
            }

            // ISOLATED MODE: No cross-mode fallback - throw error if mode failed
            if (!base64Image) {
                const activeMode = isNineRouterActive ? 'NINEROUTER' : isAntigravityActive ? 'ANTIGRAVITY' : useVipMode ? 'VIP' : 'FREE';
                console.error(`[${activeMode}] Mode failed and no fallback allowed (isolated mode)`);
                throw new Error(`${activeMode}_MODE_FAILED`);
            }

            // Post-process to ensure strict aspect ratio compliance (9:16, 16:9, etc.)
            if (aspectRatio && aspectRatio !== '1:1') {
                try {
                    console.log(`[AspectRatio] Post-processing image ${index + 1} to enforce ratio ${aspectRatio}`);
                    base64Image = await enforceAspectRatio(base64Image, aspectRatio);
                } catch (ratioErr) {
                    console.warn(`[AspectRatio] Could not post-process aspect ratio for image ${index + 1}:`, ratioErr);
                }
            }

            return base64Image;
        } catch (error) {
            console.error(`Error generating image ${index}:`, error);
            return null;
        }
    };

    // Execute all images in parallel with concurrency control
    const tasks = prompts.map((_, index) => async () => {
        const result = await generateSingleImage(index);
        // IMMEDIATE UPDATE: Show image as soon as it is generated
        onImageGenerated(index, result);
        return result;
    });

    const results = await parallelWithConcurrency(tasks, concurrency, (completed, total) => {
        onStatusUpdate(`✨ Hoàn thành ${completed}/${total} ảnh...`);
    });

    onStatusUpdate(`✅ Đã tạo xong ${results.filter(r => r !== null).length}/${prompts.length} ảnh!`);
};

// --- ID PHOTOS ---
export const generateIdPhotos = async (
    apiKey: string,
    imagePart: ImagePart,
    clothing: string,
    bgColor: string,
    aspectRatio: string,
    gender: string,
    hairstyle: string,
    onStatusUpdate: (status: string) => void,
    onImageGenerated: (index: number, base64: string | null) => void,
    clothingRef?: { data: string; mimeType: string } // NEW: Reference image from Firestore
): Promise<{ prompts: string[] }> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    let nineRouterConnected = false;

    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        nineRouterConnected = status.connected;
    }

    // Check Antigravity mode
    const useAntigravityMode = antigravityService.isAntigravityEnabled();
    let antigravityConnected = false;

    if (useAntigravityMode) {
        const status = await antigravityService.checkConnection();
        antigravityConnected = status.connected;
    }

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;

    // Get Gemini key for fallback/primary
    const geminiApiKey = getStoredApiKey('gemini');
    const ai = await getEffectiveGeminiClient(geminiApiKey);

    // Different prompt based on whether we have a reference image
    const hasClothingRef = !!clothingRef?.data;

    const basePrompt = hasClothingRef
        ? `PROFESSIONAL ID PHOTO GENERATION WITH CLOTHING REFERENCE - STRICT REQUIREMENTS:
    
    *** CRITICAL: VIRTUAL TRY-ON WITH REFERENCE IMAGE ***
    - A reference clothing image is provided. You MUST use it as the clothing for this person.
    - CLONE 100% the clothing from the reference image: exact colors, patterns, cuts, details
    - Do NOT modify, interpret, or "improve" the clothing - replicate it EXACTLY
    - The person in the input photo MUST be shown wearing this EXACT clothing
    
    *** MANDATORY POSE CORRECTION ***
    - The person MUST face the camera DIRECTLY (perfectly frontal view)
    - Head MUST be perfectly straight and level (no tilt left/right/forward/backward)
    - Eyes MUST look directly at the camera lens
    - Shoulders MUST be square to the camera and level
    - If the input image shows the person at an angle, CORRECT IT to frontal view
    - This is an official document photo - PERFECT ALIGNMENT is mandatory
    
    SUBJECT DETAILS:
    - Gender: ${gender}
    - Clothing: ${clothing} (MUST match the reference image exactly)
    - Hairstyle: ${hairstyle} (neat, well-groomed, professional)
    
    TECHNICAL REQUIREMENTS:
    - Background Color: ${bgColor} (solid, uniform, no gradients)
    - Lighting: Professional studio lighting, even and soft, no harsh shadows
    - Expression: Neutral to slight smile, professional confidence, relaxed
    - Face: High fidelity to facial features from input - KEEP 100% IDENTICAL
    - Framing: Head and shoulders centered, 70% face fill
    - Aspect Ratio: ${aspectRatio} (MANDATORY - MUST MATCH EXACTLY)
    
    ${ASPECT_RATIO_ENFORCEMENT}
    
    ${FACE_IDENTITY_PRESERVATION}
    
    ${OUTPUT_BEAUTY_ENHANCEMENT}
    
    ${CLEAN_OUTPUT_REQUIREMENTS}
    
    ${ULTRA_SHARP_QUALITY}`
        : `PROFESSIONAL ID PHOTO GENERATION - STRICT REQUIREMENTS:
    
    *** MANDATORY POSE CORRECTION ***
    - The person MUST face the camera DIRECTLY (perfectly frontal view)
    - Head MUST be perfectly straight and level (no tilt left/right/forward/backward)
    - Eyes MUST look directly at the camera lens
    - Shoulders MUST be square to the camera and level
    - If the input image shows the person at an angle, CORRECT IT to frontal view
    - This is an official document photo - PERFECT ALIGNMENT is mandatory
    
    SUBJECT DETAILS:
    - Gender: ${gender}
    - Clothing: ${clothing} (professional, wrinkle-free, perfectly fitted)
    - Hairstyle: ${hairstyle} (neat, well-groomed, professional)
    
    TECHNICAL REQUIREMENTS:
    - Background Color: ${bgColor} (solid, uniform, no gradients)
    - Lighting: Professional studio lighting, even and soft, no harsh shadows
    - Expression: Neutral to slight smile, professional confidence, relaxed
    - Face: High fidelity to facial features - KEEP 100% IDENTICAL TO INPUT
    - Framing: Head and shoulders centered, 70% face fill
    - Aspect Ratio: ${aspectRatio} (MANDATORY - MUST MATCH EXACTLY)
    
    ${ASPECT_RATIO_ENFORCEMENT}
    
    ${FACE_IDENTITY_PRESERVATION}
    
    ${OUTPUT_BEAUTY_ENHANCEMENT}
    
    ${CLEAN_OUTPUT_REQUIREMENTS}
    
    ${ULTRA_SHARP_QUALITY}`;

    const prompts = [
        basePrompt + " Variation 1: Standard professional look with perfect frontal alignment.",
        basePrompt + " Variation 2: Slightly brighter lighting, maintaining perfect straight pose.",
        basePrompt + " Variation 3: Subtle lighting variation, ensuring professional straight posture.",
        basePrompt + " Variation 4: High contrast professional look with perfect head alignment."
    ];

    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    // Prepare clothing reference part if available (flat format for generateImageWithSystemKey)
    const clothingRefPart = clothingRef ? {
        data: clothingRef.data,
        mimeType: clothingRef.mimeType
    } : null;

    // All image parts to send to AI (flat format: { data, mimeType })
    const imageParts = clothingRefPart
        ? [imagePart, clothingRefPart] // Face + Clothing reference  
        : [imagePart]; // Face only

    console.log('[ID Photo] 9Router:', useNineRouterMode, 'Antigravity:', useAntigravityMode, 'VIP:', useVipMode, 'Clothing ref:', hasClothingRef);

    // Generate ID photos SEQUENTIALLY to avoid rate limits
    for (let index = 0; index < prompts.length; index++) {
        const prompt = prompts[index];
        try {
            onStatusUpdate(`Đang xử lý ảnh thẻ ${index + 1}/${prompts.length}${useNineRouterMode ? ' (Cấu hình)' : useAntigravityMode ? ' (Antigravity)' : useVipMode ? ' (VIP)' : ''}${hasClothingRef ? ' 👔' : ''}...`);

            let base64Image: string | null = null;

            // PRIORITY -1: NineRouter mode
            if (useNineRouterMode && nineRouterConnected && !base64Image) {
                try {
                    base64Image = await nineRouterService.generateImageViaNineRouter({
                        prompt,
                        referenceImages: imageParts,
                        aspectRatio,
                        taskType: 'profile'
                    });
                    if (base64Image) {
                        console.log(`[ID Photo ${index + 1}] Generated via 9Router`);
                    }
                } catch (err) {
                    console.error('[ID Photo] 9Router failed:', err);
                }
            }

            // PRIORITY 0: Antigravity mode
            if (useAntigravityMode && antigravityConnected && !base64Image) {
                try {
                    base64Image = await antigravityService.generateImageSimple(
                        prompt,
                        imageParts,
                        { aspectRatio }
                    );
                    if (base64Image) {
                        console.log(`[ID Photo ${index + 1}] Generated via Antigravity`);
                    }
                } catch (err) {
                    console.error('[ID Photo] Antigravity failed:', err);
                }
            }

            // VIP Mode: Use Gemini system key only
            if (!base64Image && useVipMode) {
                try {
                    console.log('[ID Photo VIP] Using Gemini system key');
                    base64Image = await callWithRetry(
                        async () => generateImageWithSystemKey(systemApiKey!, prompt, [imagePart, ...(clothingRef ? [clothingRef] : [])], aspectRatio),
                        5,
                        5000,
                        (msg) => onStatusUpdate(`[VIP ID ${index + 1}] ${msg}`)
                    );
                    if (base64Image) {
                        console.log(`[ID Photo ${index + 1}] Generated via VIP Gemini`);
                    }
                } catch (err) {
                    console.error('VIP Gemini mode failed for ID photo:', err);
                    onStatusUpdate(`[VIP] Ảnh ${index + 1} thất bại, tiếp tục...`);
                }
            }

            // FREE Mode ONLY (when not VIP/Antigravity/NineRouter): Use user's Gemini key
            const isAntigravityActive = useAntigravityMode && antigravityConnected;
            const isNineRouterActive = useNineRouterMode && nineRouterConnected;
            if (!base64Image && ai && !useVipMode && !isAntigravityActive && !isNineRouterActive) {
                base64Image = await callWithRetry(
                    async () => {
                        // Build parts with inlineData format for Gemini SDK
                        const clothingRefInline = clothingRef ? {
                            inlineData: {
                                data: clothingRef.data,
                                mimeType: clothingRef.mimeType
                            }
                        } : null;

                        const parts = clothingRefInline
                            ? [inputPart, clothingRefInline, { text: prompt }]
                            : [inputPart, { text: prompt }];

                        const response = await ai.models.generateContent({
                            model: getActiveImageModel(),
                            contents: {
                                parts: parts
                            },
                            config: {
                                imageConfig: {
                                    aspectRatio: aspectRatio as any
                                }
                            }
                        });
                        if (response.candidates?.[0]?.content?.parts) {
                            for (const part of response.candidates[0].content.parts) {
                                if (part.inlineData) return part.inlineData.data;
                            }
                        }
                        return null;
                    },
                    3,
                    5000,
                    (msg) => onStatusUpdate(`[ID ${index + 1}] ${msg}`)
                );
            }

            if (base64Image && aspectRatio && aspectRatio !== '1:1') {
                try {
                    base64Image = await enforceAspectRatio(base64Image, aspectRatio);
                } catch (ratioErr) {
                    console.warn(`[AspectRatio ID] Could not post-process aspect ratio for image ${index + 1}:`, ratioErr);
                }
            }

            onImageGenerated(index, base64Image);

            // Add delay between generations to avoid rate limits (except for last image)
            if (index < prompts.length - 1) {
                // REDUCED DELAY FOR SPEED
                const delayTime = useVipMode ? 500 : 1000; // Drastically reduced from 3000/5000
                // onStatusUpdate(`Chờ ${delayTime / 1000} giây trước ảnh thẻ tiếp theo...`);
                await delay(delayTime);
            }

        } catch (e) {
            console.error(e);
            onImageGenerated(index, null);
        }
    }

    return { prompts };
};

// --- EDIT IMAGE ---
export const editImage = async (apiKey: string, imagePart: ImagePart, prompt: string): Promise<string | null> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();

    // Check Antigravity mode
    const useAntigravityMode = antigravityService.isAntigravityEnabled();

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;

    // Get Gemini key for fallback
    const geminiApiKey = getStoredApiKey('gemini');

    const enhancedPrompt = `${prompt}

${CLEAN_OUTPUT_REQUIREMENTS}

${ULTRA_SHARP_QUALITY}`;

    // PRIORITY -1: NineRouter mode
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            console.log('[Edit] Using 9Router mode');
            try {
                const result = await nineRouterService.generateImageViaNineRouter({
                    prompt: enhancedPrompt,
                    referenceImages: [imagePart],
                    taskType: 'edit'
                });
                if (result) return result;
                throw new Error('NINEROUTER_EDIT_FAILED');
            } catch (err) {
                console.error('[Edit] 9Router failed - isolated mode:', err);
                throw new Error('NINEROUTER_EDIT_FAILED');
            }
        }
    }

    // PRIORITY 0: Antigravity mode
    if (useAntigravityMode) {
        const status = await antigravityService.checkConnection();
        if (status.connected) {
            console.log('[Edit] Using Antigravity mode');
            const result = await antigravityService.generateImageSimple(
                enhancedPrompt,
                [imagePart]
            );
            if (result) return result;
            // ISOLATED MODE: Antigravity enabled but failed - throw error
            console.error('[Edit] Antigravity failed - isolated mode, no fallback');
            throw new Error('ANTIGRAVITY_EDIT_FAILED');
        }
    }

    // VIP Mode: Try Gemini System Key first
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, enhancedPrompt, [imagePart]);
            if (result) return result;
            // ISOLATED MODE: VIP failed - throw error
            throw new Error('VIP_EDIT_FAILED');
        } catch (err) {
            console.error('[VIP] Edit failed - isolated mode:', err);
            throw new Error('VIP_EDIT_FAILED');
        }
    }

    // FREE Mode ONLY (not VIP, not Antigravity, not NineRouter)
    if (geminiApiKey && !useVipMode && !useAntigravityMode && !useNineRouterMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const inputPart = {
            inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType
            }
        };

        return await callWithRetry(async () => {
            const response = await ai.models.generateContent({
                model: getActiveImageModel(),
                contents: {
                    parts: [inputPart, { text: enhancedPrompt }]
                }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return part.inlineData.data;
                    }
                }
            }
            return null;
        });
    }

    return null;
};

// --- BATCH EDIT IMAGES (Multiple outputs) ---
export const editImages = async (
    apiKey: string,
    imagePart: ImagePart,
    prompt: string,
    outputCount: number,
    onStatusUpdate: (status: string) => void,
    onImageGenerated: (index: number, base64: string | null) => void
): Promise<void> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    let nineRouterConnected = false;
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        nineRouterConnected = status.connected;
    }

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;

    // Get Gemini key for fallback
    const geminiApiKey = getStoredApiKey('gemini');
    const ai = await getEffectiveGeminiClient(geminiApiKey);

    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const enhancedPrompt = `${prompt}

${CLEAN_OUTPUT_REQUIREMENTS}

${ULTRA_SHARP_QUALITY}`;

    // Generate multiple variations
    for (let i = 0; i < outputCount; i++) {
        try {
            const variationPrompt = outputCount > 1
                ? `${enhancedPrompt}\n\nVariation ${i + 1}: Create a unique interpretation while following the instructions above.`
                : enhancedPrompt;

            let base64Image: string | null = null;

            // PRIORITY -1: NineRouter mode
            if (useNineRouterMode && nineRouterConnected && !base64Image) {
                onStatusUpdate(`[Cấu hình] Đang chỉnh sửa (${i + 1}/${outputCount})...`);
                try {
                    base64Image = await nineRouterService.generateImageViaNineRouter({
                        prompt: variationPrompt,
                        referenceImages: [imagePart],
                        taskType: 'edit'
                    });
                } catch (err) {
                    console.error('9Router edit failed:', err);
                    onStatusUpdate(`[Cấu hình] Lỗi chỉnh sửa...`);
                }
            }

            // VIP Mode: Use Gemini system key
            if (!base64Image && useVipMode) {
                onStatusUpdate(`[VIP] Đang chỉnh sửa (${i + 1}/${outputCount})...`);
                try {
                    base64Image = await callWithRetry(
                        async () => generateImageWithSystemKey(systemApiKey!, variationPrompt, [imagePart]),
                        3,
                        5000,
                        (msg) => onStatusUpdate(`[VIP ${i + 1}/${outputCount}] ${msg}`)
                    );
                } catch (err) {
                    console.error('VIP Gemini edit failed:', err);
                    onStatusUpdate(`[VIP] Lỗi chỉnh sửa...`);
                }
            }

            // FREE Mode or Fallback: Use Gemini (when not NineRouter active)
            if (!base64Image && ai && !useNineRouterMode) {
                onStatusUpdate(`Đang chỉnh sửa (${i + 1}/${outputCount})...`);
                base64Image = await callWithRetry(
                    async () => {
                        const response = await ai.models.generateContent({
                            model: getActiveImageModel(),
                            contents: {
                                parts: [inputPart, { text: variationPrompt }]
                            }
                        });

                        if (response.candidates?.[0]?.content?.parts) {
                            for (const part of response.candidates[0].content.parts) {
                                if (part.inlineData) {
                                    return part.inlineData.data;
                                }
                            }
                        }
                        return null;
                    },
                    3,
                    5000,
                    (msg) => onStatusUpdate(`[${i + 1}/${outputCount}] ${msg}`)
                );
            }

            onImageGenerated(i, base64Image);

            // Delay between generations to avoid rate limits
            if (i < outputCount - 1) {
                await delay(2000);
            }
        } catch (e) {
            console.error(`Error editing image ${i}:`, e);
            onImageGenerated(i, null);
        }
    }
};

// --- OUTFIT MIX & MATCH ---
export const mixMatchOutfit = async (
    apiKey: string,
    outfit1: ImagePart,
    outfit2: ImagePart
): Promise<string | null> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            try {
                return await nineRouterService.generateImageViaNineRouter({
                    prompt: `OUTFIT MIXING TASK: Analyze the two input outfit images. Create a NEW fashion design that combines elements from both inputs. Blend the textures, patterns, and silhouettes. Create a harmonious fusion. Display the result as a high-quality fashion photograph on a mannequin or model. Style: Modern Avant-Garde Fusion.`,
                    referenceImages: [outfit1, outfit2],
                    taskType: 'mix'
                });
            } catch (err) {
                console.error('[9Router] mixMatchOutfit failed:', err);
                return null;
            }
        }
    }

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    const prompt = `
    OUTFIT MIXING TASK:
    Analyze the two input outfit images.
    Create a NEW fashion design that combines elements from both inputs.
    - Blend the textures, patterns, and silhouettes.
    - Create a harmonious fusion.
    - Display the result as a high-quality fashion photograph on a mannequin or model.
    - Style: Modern Avant-Garde Fusion.
    
    ${CLEAN_OUTPUT_REQUIREMENTS}
    
    ${ULTRA_SHARP_QUALITY}
    `;

    // VIP Mode
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, prompt, [outfit1, outfit2]);
            if (result) return result;
        } catch (err) {
            console.error('VIP mixMatch failed:', err);
        }
    }

    // FREE Mode or Fallback (not NineRouter)
    if (geminiApiKey && !useNineRouterMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const parts = [
            { inlineData: { data: outfit1.data, mimeType: outfit1.mimeType } },
            { inlineData: { data: outfit2.data, mimeType: outfit2.mimeType } }
        ];

        return await callWithRetry(async () => {
            const response = await ai.models.generateContent({
                model: getActiveImageModel(),
                contents: {
                    parts: [...parts, { text: prompt }]
                },
                config: { imageConfig: { aspectRatio: '1:1' } }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) return part.inlineData.data;
                }
            }
            return null;
        });
    }

    return null;
};

// --- CLOTHING EXTRACTION ---
export const extractClothing = async (
    apiKey: string,
    imagePart: ImagePart
): Promise<string | null> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            try {
                return await nineRouterService.generateImageViaNineRouter({
                    prompt: `CLOTHING EXTRACTION & GHOST MANNEQUIN TASK:
Analyze the input reference image carefully. Identify the exact outfit, clothing, headwear, and authentic accessories worn by the person.
MANDATORY DIRECTIVES:
1. 100% FAITHFUL COLOR & EMBROIDERY ACCURACY: Preserve the EXACT colors of the original outfit (for example, if the outfit is RED with colorful brocade, it MUST be 100% RED with identical brocade). Do NOT change the colors to indigo, blue, or any other style.
2. GHOST MANNEQUIN PRESENTATION: Remove the person completely (no face, head, skin, hands, arms, legs, or body). Present the clothing, headdress, and authentic accessories standing upright on an invisible 3D ghost mannequin against a clean, plain white studio background.
3. PRESERVE EVERY DETAIL: Keep all authentic tassels, trims, embroidery motifs, belts, and fabric textures exactly as they appear in the reference photo.`,
                    referenceImages: [{ ...imagePart, label: 'Costume To Extract' }],
                    taskType: 'extract',
                    aspectRatio: '1:1'
                });
            } catch (err) {
                console.error('[9Router] extractClothing failed:', err);
                return null;
            }
        }
    }

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    const prompt = `CLOTHING EXTRACTION & GHOST MANNEQUIN TASK:
Analyze the input reference image carefully. Identify the main outfit, headwear, and clothing worn by the person.
ACTION:
1. Completely remove the person (head, face, skin, hands, legs, feet) and remove the entire background.
2. Isolate ONLY the clothing/outfit, headwear, and authentic accessories.
3. Present the clothing on a transparent or pure plain white background, in a high-end "Ghost Mannequin" or "Flat Lay" product photography style.
4. CRITICAL MANDATORY COLOR RULE: Ensure the clothing retains all original colors (if the outfit is RED, it must stay 100% RED), fabric textures, embroidery patterns, and folds.
5. The output should be just the authentic clothes, ready for an e-commerce catalog.

${CLEAN_OUTPUT_REQUIREMENTS}

${ULTRA_SHARP_QUALITY}`;

    // VIP Mode
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, prompt, [imagePart]);
            if (result) return result;
        } catch (err) {
            console.error('VIP extractClothing failed:', err);
        }
    }

    // FREE Mode or Fallback (not NineRouter)
    if (geminiApiKey && !useNineRouterMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const inputPart = {
            inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType
            }
        };

        return await callWithRetry(async () => {
            const response = await ai.models.generateContent({
                model: getActiveImageModel(),
                contents: {
                    parts: [inputPart, { text: prompt }]
                },
                config: { imageConfig: { aspectRatio: '1:1' } }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) return part.inlineData.data;
                }
            }
            return null;
        });
    }

    return null;
};

// --- SCENE RELIGHTING ---
export const relightImage = async (
    apiKey: string,
    imagePart: ImagePart,
    lightingStyle: string
): Promise<string | null> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    let lightingDesc = "";
    switch (lightingStyle) {
        case 'hoang_hon': lightingDesc = "Golden Hour / Sunset: Warm, soft, low-angle sunlight, orange and purple hues in the sky, dramatic silhouettes."; break;
        case 'studio': lightingDesc = "Professional Studio: Clean, bright 3-point lighting, neutral background, high contrast, perfect for portraits."; break;
        case 'neon': lightingDesc = "Cyberpunk Neon: Blue and magenta rim lighting, dark background, futuristic atmosphere, high contrast."; break;
        case 'rung_toi': lightingDesc = "Dark Forest / Moonlight: Cool blue tones, dappled light through trees, mysterious and moody atmosphere."; break;
        case 'ban_dem': lightingDesc = "Night City / Bokeh: City lights in background, dark ambiance, sharp focus on subject."; break;
        default: lightingDesc = lightingStyle;
    }

    const prompt = `RELIGHTING TASK. Transform the lighting of this image strictly to: ${lightingDesc}. Keep the subject exactly the same, but completely change the environment lighting and atmosphere.
    
    ${CLEAN_OUTPUT_REQUIREMENTS}
    
    ${ULTRA_SHARP_QUALITY}`;

    // PRIORITY -1: NineRouter mode
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            try {
                return await nineRouterService.generateImageViaNineRouter({
                    prompt,
                    referenceImages: [imagePart],
                    taskType: 'relight'
                });
            } catch (err) {
                console.error('[9Router] relightImage failed:', err);
                return null;
            }
        }
    }

    // VIP Mode
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, prompt, [imagePart]);
            if (result) return result;
        } catch (err) {
            console.error('VIP relightImage failed:', err);
        }
    }

    // FREE Mode or Fallback (not NineRouter)
    if (geminiApiKey && !useNineRouterMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const inputPart = {
            inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType
            }
        };

        return await callWithRetry(async () => {
            const response = await ai.models.generateContent({
                model: getActiveImageModel(),
                contents: {
                    parts: [inputPart, { text: prompt }]
                }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) return part.inlineData.data;
                }
            }
            return null;
        });
    }

    return null;
};

// --- UPSCALE IMAGE ---
export const upscaleImage = async (apiKey: string, imagePart: ImagePart, resolution: '2K' | '4K'): Promise<string | null> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();

    // Check Antigravity mode
    const useAntigravityMode = antigravityService.isAntigravityEnabled();

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    const prompt = `ULTRA-SHARP RESTORATION AND UPSCALING TASK:
    Transform this image into extreme ${resolution} resolution (${resolution === '4K' ? '3840x2160' : '2560x1440'} equivalent quality).
    
    MANDATORY QUALITY REQUIREMENTS:
    - Sharpen all details to razor-sharp clarity
    - Fix all compression artifacts completely
    - Remove all noise while preserving texture details
    - Enhance texture fidelity (skin pores, fabric weave, hair strands)
    - Do NOT change the subject or composition
    - Output must be crystal clear even at 400% zoom
    
    ${CLEAN_OUTPUT_REQUIREMENTS}
    
    ${ULTRA_SHARP_QUALITY}`;

    // PRIORITY -1: NineRouter mode
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            console.log('[Upscale] Using 9Router mode');
            const result = await nineRouterService.generateImageViaNineRouter({
                prompt,
                referenceImages: [imagePart],
                taskType: 'upscale'
            });
            if (result) return result;
            throw new Error('NINEROUTER_UPSCALE_FAILED');
        }
        // NineRouter enabled but not connected
        throw new Error('NINEROUTER_NOT_CONNECTED');
    }

    // PRIORITY 0: Antigravity mode
    if (useAntigravityMode) {
        const status = await antigravityService.checkConnection();
        if (status.connected) {
            console.log('[Upscale] Using Antigravity mode');
            const result = await antigravityService.generateImageSimple(prompt, [imagePart]);
            if (result) return result;
            // ISOLATED MODE: Antigravity failed - throw error
            console.error('[Upscale] Antigravity failed - isolated mode, no fallback');
            throw new Error('ANTIGRAVITY_UPSCALE_FAILED');
        }
        // Antigravity enabled but not connected
        throw new Error('ANTIGRAVITY_NOT_CONNECTED');
    }

    // VIP Mode
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, prompt, [imagePart]);
            if (result) return result;
            throw new Error('VIP_UPSCALE_FAILED');
        } catch (err) {
            console.error('[VIP] Upscale failed - isolated mode:', err);
            throw new Error('VIP_UPSCALE_FAILED');
        }
    }

    // FREE Mode ONLY (not VIP, not Antigravity, not NineRouter)
    if (geminiApiKey && !useVipMode && !useAntigravityMode && !useNineRouterMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const inputPart = {
            inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType
            }
        };

        return await callWithRetry(async () => {
            const response = await ai.models.generateContent({
                model: getActiveImageModel(),
                contents: {
                    parts: [inputPart, { text: prompt }]
                }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return part.inlineData.data;
                    }
                }
            }
            return null;
        });
    }

    return null;
};

// --- BATCH UPSCALE IMAGES (Multiple outputs) ---
export const upscaleImages = async (
    apiKey: string,
    imagePart: ImagePart,
    resolution: '2K' | '4K',
    outputCount: number,
    onStatusUpdate: (status: string) => void,
    onImageGenerated: (index: number, base64: string | null) => void
): Promise<void> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    let nineRouterConnected = false;
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        nineRouterConnected = status.connected;
    }

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');
    const ai = await getEffectiveGeminiClient(geminiApiKey);

    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const variations = [
        'Standard sharpening with balanced detail enhancement',
        'Extra sharp with enhanced micro-textures',
        'High contrast with punchy colors',
        'Soft enhancement with natural skin tones',
        'Film grain removal with smooth gradients',
        'Maximum detail recovery with noise reduction',
        'HDR-style with enhanced dynamic range',
        'Studio quality with professional color grading'
    ];

    for (let i = 0; i < outputCount; i++) {
        try {
            const variationHint = outputCount > 1 ? `\n\nVariation style: ${variations[i % variations.length]}` : '';

            const prompt = `ULTRA-SHARP RESTORATION AND UPSCALING TASK:
            Transform this image into extreme ${resolution} resolution (Output MUST be exactly ${resolution === '4K' ? '4096x4096' : '2560x2560'} pixels).${variationHint}
            
            MANDATORY QUALITY REQUIREMENTS:
            - Sharpen all details to razor-sharp clarity
            - Fix all compression artifacts completely
            - Remove all noise while preserving texture details
            - Enhance texture fidelity (skin pores, fabric weave, hair strands)
            - Do NOT change the subject or composition
            - Output must be crystal clear even at 400% zoom
            
            ${FACE_IDENTITY_PRESERVATION}
            
            ${ULTRA_SHARP_QUALITY}`;

            let base64Image: string | null = null;

            // PRIORITY -1: NineRouter mode
            if (useNineRouterMode && nineRouterConnected && !base64Image) {
                onStatusUpdate(`[Cấu hình] Đang tăng nét (${i + 1}/${outputCount})...`);
                try {
                    base64Image = await nineRouterService.generateImageViaNineRouter({
                        prompt,
                        referenceImages: [imagePart],
                        taskType: 'upscale'
                    });
                } catch (err) {
                    console.error('9Router upscale failed:', err);
                    onStatusUpdate(`[Cấu hình] Lỗi tăng nét...`);
                }
            }

            // VIP Mode: Use Gemini system key
            if (!base64Image && useVipMode) {
                onStatusUpdate(`[VIP] Đang tăng nét (${i + 1}/${outputCount})...`);
                try {
                    base64Image = await callWithRetry(
                        async () => generateImageWithSystemKey(systemApiKey!, prompt, [imagePart]),
                        3,
                        5000,
                        (msg) => onStatusUpdate(`[VIP ${i + 1}/${outputCount}] ${msg}`)
                    );
                } catch (err) {
                    console.error('VIP Gemini upscale failed:', err);
                    onStatusUpdate(`[VIP] Lỗi tăng nét...`);
                }
            }

            // FREE Mode or Fallback (not NineRouter)
            if (!base64Image && ai && !useNineRouterMode) {
                onStatusUpdate(`Đang tăng nét (${i + 1}/${outputCount})...`);
                base64Image = await callWithRetry(
                    async () => {
                        const response = await ai.models.generateContent({
                            model: getActiveImageModel(),
                            contents: {
                                parts: [inputPart, { text: prompt }]
                            }
                        });

                        if (response.candidates?.[0]?.content?.parts) {
                            for (const part of response.candidates[0].content.parts) {
                                if (part.inlineData) {
                                    return part.inlineData.data;
                                }
                            }
                        }
                        return null;
                    },
                    3,
                    5000,
                    (msg) => onStatusUpdate(`[${i + 1}/${outputCount}] ${msg}`)
                );
            }

            onImageGenerated(i, base64Image);

            if (i < outputCount - 1) {
                await delay(2000);
            }
        } catch (e) {
            console.error(`Error upscaling image ${i}:`, e);
            onImageGenerated(i, null);
        }
    }
};

// --- GENERATE PROFILE PIC ---
export const generateProfilePic = async (
    apiKey: string,
    imagePart: ImagePart,
    style: string,
    platform: string,
    resolution: '2K' | '4K'
): Promise<string | null> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();

    // Check Antigravity mode
    const useAntigravityMode = antigravityService.isAntigravityEnabled();

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    const prompt = `Generate a Professional Profile Picture for ${platform}.
    Style: ${style}.
    Resolution: ${resolution}.
    Requirements: Headshot or bust, professional studio lighting, clear face, confident expression.
    Background: Clean, professional, suited for ${platform}.
    Preserve facial identity of the input image strictly.
    
    ${FACE_IDENTITY_PRESERVATION}
    
    ${CLEAN_OUTPUT_REQUIREMENTS}
    
    ${ULTRA_SHARP_QUALITY}`;

    // PRIORITY -1: NineRouter mode
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        if (status.connected) {
            console.log('[Profile] Using 9Router mode');
            const result = await nineRouterService.generateImageViaNineRouter({
                prompt,
                referenceImages: [imagePart],
                aspectRatio: '1:1',
                taskType: 'profile'
            });
            if (result) return result;
            throw new Error('NINEROUTER_PROFILE_FAILED');
        }
        // NineRouter enabled but not connected
        throw new Error('NINEROUTER_NOT_CONNECTED');
    }

    // PRIORITY 0: Antigravity mode
    if (useAntigravityMode) {
        const status = await antigravityService.checkConnection();
        if (status.connected) {
            console.log('[Profile] Using Antigravity mode');
            const result = await antigravityService.generateImageSimple(
                prompt,
                [imagePart],
                { aspectRatio: '1:1' }
            );
            if (result) return result;
            // ISOLATED MODE: Antigravity failed - throw error
            console.error('[Profile] Antigravity failed - isolated mode, no fallback');
            throw new Error('ANTIGRAVITY_PROFILE_FAILED');
        }
        // Antigravity enabled but not connected
        throw new Error('ANTIGRAVITY_NOT_CONNECTED');
    }

    // VIP Mode
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, prompt, [imagePart]);
            if (result) return result;
            throw new Error('VIP_PROFILE_FAILED');
        } catch (err) {
            console.error('[VIP] Profile failed - isolated mode:', err);
            throw new Error('VIP_PROFILE_FAILED');
        }
    }

    // FREE Mode ONLY (not VIP, not Antigravity, not NineRouter)
    if (geminiApiKey && !useVipMode && !useAntigravityMode && !useNineRouterMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const inputPart = {
            inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType
            }
        };

        return await callWithRetry(async () => {
            const response = await ai.models.generateContent({
                model: getActiveImageModel(),
                contents: {
                    parts: [inputPart, { text: prompt }]
                },
                config: {
                    imageConfig: {
                        aspectRatio: '1:1'
                    }
                }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return part.inlineData.data;
                    }
                }
            }
            return null;
        });
    }

    return null;
};

// --- BATCH GENERATE PROFILE PICS (Multiple outputs) ---
export const generateProfilePics = async (
    apiKey: string,
    imagePart: ImagePart,
    style: string,
    platform: string,
    resolution: '2K' | '4K',
    outputCount: number,
    onStatusUpdate: (status: string) => void,
    onImageGenerated: (index: number, base64: string | null) => void
): Promise<void> => {
    // Check NineRouter mode
    const useNineRouterMode = nineRouterService.isNineRouterEnabled();
    let nineRouterConnected = false;
    if (useNineRouterMode) {
        const status = await nineRouterService.checkConnection();
        nineRouterConnected = status.connected;
    }

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');
    const ai = await getEffectiveGeminiClient(geminiApiKey);

    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const styleVariations = [
        'Standard professional look with even lighting',
        'Dramatic lighting with subtle shadows',
        'Bright and friendly with warm tones',
        'Cool tones with modern minimalist backdrop',
        'Artistic with slight bokeh background',
        'Corporate formal with neutral background',
        'Creative with gradient background',
        'Premium luxury with soft golden lighting'
    ];

    for (let i = 0; i < outputCount; i++) {
        try {
            const variationHint = outputCount > 1 ? `\n\nVariation: ${styleVariations[i % styleVariations.length]}` : '';

            const prompt = `Generate a Professional Profile Picture for ${platform}.
            
            🚨 CRITICAL: FACE MUST BE 100% IDENTICAL TO INPUT - THIS IS THE #1 PRIORITY 🚨
            
            ${FACE_IDENTITY_PRESERVATION}
            
            ${OUTPUT_BEAUTY_ENHANCEMENT}
            
            Style: ${style}.${variationHint}
            Resolution: ${resolution} (Output MUST be exactly this resolution).
            Requirements: Headshot or bust, professional studio lighting, clear face, confident expression.
            Background: Clean, professional, suited for ${platform}.
            Aspect Ratio: 1:1 (Square - MANDATORY for profile pictures)
            
            IMPORTANT: Keep the person's face EXACTLY as in the input image. NO modifications to facial features allowed.
            Only enhance lighting, background, and overall quality while keeping the face 100% identical.
            
            ${ULTRA_SHARP_QUALITY}`;

            let base64Image: string | null = null;

            // PRIORITY -1: NineRouter mode
            if (useNineRouterMode && nineRouterConnected && !base64Image) {
                onStatusUpdate(`[Cấu hình] Đang tạo Profile (${i + 1}/${outputCount})...`);
                try {
                    base64Image = await nineRouterService.generateImageViaNineRouter({
                        prompt,
                        referenceImages: [imagePart],
                        aspectRatio: '1:1',
                        taskType: 'profile'
                    });
                } catch (err) {
                    console.error('9Router profile failed:', err);
                    onStatusUpdate(`[Cấu hình] Lỗi tạo Profile...`);
                }
            }

            // VIP Mode: Use Gemini system key
            if (!base64Image && useVipMode) {
                onStatusUpdate(`[VIP] Đang tạo Profile (${i + 1}/${outputCount})...`);
                try {
                    base64Image = await callWithRetry(
                        async () => generateImageWithSystemKey(systemApiKey!, prompt, [imagePart], '1:1'),
                        3,
                        5000,
                        (msg) => onStatusUpdate(`[VIP ${i + 1}/${outputCount}] ${msg}`)
                    );
                } catch (err) {
                    console.error('VIP Gemini profile failed:', err);
                    onStatusUpdate(`[VIP] Lỗi tạo Profile...`);
                }
            }

            // FREE Mode or Fallback (not NineRouter)
            if (!base64Image && ai && !useNineRouterMode) {
                onStatusUpdate(`Đang tạo Profile (${i + 1}/${outputCount})...`);
                base64Image = await callWithRetry(
                    async () => {
                        const response = await ai.models.generateContent({
                            model: getActiveImageModel(),
                            contents: {
                                parts: [inputPart, { text: prompt }]
                            },
                            config: {
                                imageConfig: {
                                    aspectRatio: '1:1'
                                }
                            }
                        });

                        if (response.candidates?.[0]?.content?.parts) {
                            for (const part of response.candidates[0].content.parts) {
                                if (part.inlineData) {
                                    return part.inlineData.data;
                                }
                            }
                        }
                        return null;
                    },
                    3,
                    5000,
                    (msg) => onStatusUpdate(`[${i + 1}/${outputCount}] ${msg}`)
                );
            }

            onImageGenerated(i, base64Image);

            // Giảm delay để tăng tốc độ (từ 2000ms -> 800ms)
            if (i < outputCount - 1) {
                await delay(800);
            }
        } catch (e) {
            console.error(`Error generating profile pic ${i}:`, e);
            onImageGenerated(i, null);
        }
    }
};

// --- DREAM JOB HELPER: CLEANUP & UPSCALE ---
// Now returns string directly or throws. Retry wrapper in main function will handle errors.
const cleanupAndUpscale = async (imagePart: ImagePart): Promise<string> => {
    // Check Antigravity mode first (highest priority)
    const useAntigravityMode = antigravityService.isAntigravityEnabled();

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    const prompt = `
    RESTORATION AND CLEANUP TASK:
    1.  **Upscale to 4K**: Increase resolution and sharpness significantly.
    2.  **Remove Text/Logos**: Identify and completely REMOVE any text, watermarks, logos, dates, or overlay graphics. Fill the gaps naturally.
    3.  **Preserve Subject**: Do NOT change the person's face or identity.
    4.  **Enhance Quality**: Fix blurriness, noise, and compression artifacts.
    Output: A clean, sharp, high-quality version of the original photo.
    `;

    // PRIORITY 0: Antigravity mode (best success rate)
    if (useAntigravityMode) {
        try {
            const status = await antigravityService.checkConnection();
            if (status.connected) {
                console.log('[CleanupUpscale] Using Antigravity mode');
                const result = await antigravityService.generateImageSimple(
                    prompt,
                    [imagePart],
                    { strictPreserve: true }
                );
                if (result) {
                    console.log('[CleanupUpscale] Antigravity success');
                    return result;
                }
                // ISOLATED MODE: Antigravity failed - throw error
                console.error('[CleanupUpscale] Antigravity failed - isolated mode');
                throw new Error('ANTIGRAVITY_CLEANUP_FAILED');
            }
            // Antigravity enabled but not connected
            throw new Error('ANTIGRAVITY_NOT_CONNECTED');
        } catch (err) {
            console.error('[CleanupUpscale] Antigravity failed - isolated mode:', err);
            throw new Error('ANTIGRAVITY_CLEANUP_FAILED');
        }
    }

    // PRIORITY 1: VIP Mode
    if (useVipMode && systemApiKey) {
        try {
            const result = await generateImageWithSystemKey(systemApiKey, prompt, [imagePart]);
            if (result) return result;
            throw new Error('VIP_CLEANUP_FAILED');
        } catch (err) {
            console.error('[VIP] CleanupUpscale failed - isolated mode:', err);
            throw new Error('VIP_CLEANUP_FAILED');
        }
    }

    // PRIORITY 2: FREE Mode ONLY (User's Gemini key)
    if (geminiApiKey && !useVipMode && !useAntigravityMode) {
        const ai = await getEffectiveGeminiClient(geminiApiKey) || getGeminiClient(geminiApiKey);
        const inputPart = {
            inlineData: {
                data: imagePart.data,
                mimeType: imagePart.mimeType
            }
        };

        const response = await ai.models.generateContent({
            model: getActiveImageModel(),
            contents: {
                parts: [inputPart, { text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: '3:4' // Maintaining portrait for consistency
                }
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return part.inlineData.data;
            }
        }
    }

    throw new Error("Cleanup model returned no image.");
};

// --- OLD PHOTO RESTORATION ---
export interface RestoreOptions {
    enhancementLevel: 'light' | 'medium' | 'strong'; // Mức độ phục hồi
    colorMode: 'auto' | 'warm' | 'cool' | 'sepia'; // Chế độ màu
    faceEnhance: boolean; // Cải thiện khuôn mặt
}

export const restoreOldPhoto = async (
    apiKey: string,
    imagePart: ImagePart,
    options: RestoreOptions,
    onStatusUpdate: (status: string) => void
): Promise<string | null> => {
    console.log('[DEBUG restoreOldPhoto] Function called with options:', options);

    // Check Antigravity mode
    const useAntigravityMode = antigravityService.isAntigravityEnabled();

    // Check VIP mode
    const systemApiKey = getVIPApiKey();
    const useVipMode = systemApiKey !== null;
    const geminiApiKey = getStoredApiKey('gemini');

    console.log('[DEBUG restoreOldPhoto] Antigravity:', useAntigravityMode, ', VIP mode:', useVipMode, ', System key:', !!systemApiKey, ', User key:', !!geminiApiKey);

    // Enhancement level descriptions
    const levelDescriptions = {
        light: 'subtle enhancement, preserve original texture feel',
        medium: 'balanced restoration with moderate color correction',
        strong: 'aggressive restoration, full color reconstruction'
    };

    // Color mode descriptions
    const colorDescriptions = {
        auto: 'automatically determine best colors based on era and context',
        warm: 'warm golden tones reminiscent of sunset lighting',
        cool: 'cool blue tones for modern aesthetic',
        sepia: 'keep sepia/vintage tone but improve clarity'
    };

    const prompt = `OLD PHOTO RESTORATION TASK - CRITICAL PRECISION REQUIRED

*** AUTO-DETECTION PHASE ***
Analyze this old photo and AUTOMATICALLY detect:
- Gender of person(s): male/female
- Approximate age: child/teen/adult/elderly
- Facial features: face shape, eyes, nose, mouth structure
- Body type: height indication, build
- Clothing era and style
- Hair style and texture
- Any accessories or objects

*** RESTORATION REQUIREMENTS ***
1. IDENTITY PRESERVATION (100% MANDATORY):
   - The restored person MUST be 100% recognizable as the same person in the original
   - Facial structure, proportions, and unique features must remain EXACTLY the same
   - This is the person's historical photo - NO modifications to their appearance allowed

2. ENHANCEMENT LEVEL: ${options.enhancementLevel} - ${levelDescriptions[options.enhancementLevel]}

3. COLOR RESTORATION: ${options.colorMode} - ${colorDescriptions[options.colorMode]}
   ${options.colorMode !== 'sepia' ? '- Convert black & white to full natural color' : ''}
   - Skin tones must look natural and healthy
   - Clothing colors should match the era appropriately
   - Background colors should be realistic

4. DAMAGE REPAIR:
   - Remove all scratches, tears, and fold marks
   - Fix any fading or discoloration
   - Repair missing portions if any
   - Remove dust spots and stains

5. ${options.faceEnhance ? 'FACE ENHANCEMENT: ON - Sharpen facial features, enhance eyes, improve skin clarity while maintaining identity' : 'FACE ENHANCEMENT: OFF - Light touch on face, focus on damage repair only'}

${FACE_IDENTITY_PRESERVATION}

${ULTRA_SHARP_QUALITY}

CRITICAL: The output must look like a modern 8K photograph of the SAME person at the SAME moment in time.`;

    onStatusUpdate(`Đang phân tích ảnh cũ${useAntigravityMode ? ' (Antigravity)' : useVipMode ? ' (VIP)' : ''}...`);

    // PRIORITY 0: Antigravity mode
    if (useAntigravityMode) {
        const status = await antigravityService.checkConnection();
        if (status.connected) {
            onStatusUpdate('[Antigravity] Đang phục hồi và tô màu (giữ nguyên khuôn mặt)...');
            // Use strictPreserve: true to ensure original identity is preserved
            const result = await antigravityService.generateImageSimple(
                prompt,
                [imagePart],
                { strictPreserve: true }
            );
            if (result) return result;
            // ISOLATED MODE: Antigravity failed - throw error
            console.error('[Restore] Antigravity failed - isolated mode, no fallback');
            throw new Error('ANTIGRAVITY_RESTORE_FAILED');
        }
        // Antigravity enabled but not connected
        throw new Error('ANTIGRAVITY_NOT_CONNECTED');
    }

    // VIP Mode: Use Gemini system key
    if (useVipMode) {
        try {
            onStatusUpdate('[VIP] Đang phục hồi và tô màu...');
            const result = await callWithRetry(
                async () => generateImageWithSystemKey(systemApiKey!, prompt, [imagePart]),
                3,
                5000,
                (msg) => onStatusUpdate(`[VIP] ${msg}`)
            );
            if (result) {
                onStatusUpdate('Hoàn thành phục hồi!');
                return result;
            }
            throw new Error('VIP_RESTORE_FAILED');
        } catch (err) {
            console.error('[VIP] Restore failed - isolated mode:', err);
            throw new Error('VIP_RESTORE_FAILED');
        }
    }

    // FREE / OAuth Mode (not VIP, not Antigravity)
    if (!useVipMode && !useAntigravityMode) {
        // getEffectiveGeminiClient tries OAuth first, then falls back to user API key
        const ai = await getEffectiveGeminiClient(geminiApiKey);
        if (ai) {
            const inputPart = {
                inlineData: {
                    data: imagePart.data,
                    mimeType: imagePart.mimeType
                }
            };

            try {
                const result = await callWithRetry(
                    async () => {
                        onStatusUpdate('Đang phục hồi và tô màu...');

                        const response = await ai.models.generateContent({
                            model: getActiveImageModel(),
                            contents: {
                                parts: [inputPart, { text: prompt }]
                            }
                        });

                        if (response.candidates?.[0]?.content?.parts) {
                            for (const part of response.candidates[0].content.parts) {
                                if (part.inlineData) {
                                    onStatusUpdate('Hoàn thành phục hồi!');
                                    return part.inlineData.data;
                                }
                            }
                        }
                        return null;
                    },
                    3,
                    5000,
                    (msg) => onStatusUpdate(`${msg}`)
                );
                if (result) return result;
            } catch (userKeyErr) {
                console.error('[restoreOldPhoto] FREE/OAuth mode failed:', userKeyErr);
            }
        }
    }

    // ISOLATED MODE: No cross-mode fallback
    const activeMode = useAntigravityMode ? 'ANTIGRAVITY' : useVipMode ? 'VIP' : 'FREE';
    throw new Error(`${activeMode}_RESTORE_FAILED`);
};
