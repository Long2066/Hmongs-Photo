

import { GoogleGenAI, Modality } from "@google/genai";

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

// Helper for rate limit handling with retry logic
const callWithRetry = async <T>(
    fn: () => Promise<T>,
    retries: number = 6, // High retry count for stability
    baseDelay: number = 15000, // Start with 15s delay
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
                // Aggressive Exponential backoff: 15s, 30s, 60s, 120s...
                const backoff = baseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 5000;
                const waitTime = backoff + jitter;

                if (onStatus) {
                    onStatus(`Hệ thống đang quá tải (429), chờ ${Math.round(waitTime / 1000)}s để thử lại lần ${attempt}/${retries}...`);
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: 'Hello'
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
        'Truyền thống H’Mông cổ điển': 'Classic Traditional Hmong Style: Authentic vintage aesthetic, focus on highly detailed hand-embroidery (Paj Ntaub), heavy silver jewelry (Xauv), hemp fabrics, natural lighting, earthy tones, mountainous village background, respectful cultural representation.',
        'H’Mông hiện đại – bản sắc kết hợp thời trang': 'Modern Hmong Fusion: High-fashion editorial look, contemporary streetwear silhouettes mixed with traditional Hmong batik patterns and neon accents, urban chic backdrop, bold makeup, sharp focus.',
        'H’Mông cổ tích – Fantasy': 'Hmong Fantasy Folklore: Ethereal and magical atmosphere, glowing flora, mystical misty mountains, characters wearing elaborate fantasy versions of Hmong attire with exaggerated jewelry, dreamlike lighting, enchanting vibe.',
        'H’Mông 3D Animation': '3D Animation Style (Pixar/Disney): Cute and expressive character design, soft subsurface scattering on skin, vibrant colors, exaggerated but appealing proportions, warm global illumination, storytelling composition.',
        'H’Mông Cinematic – Điện ảnh 4K': 'Cinematic 4K Masterpiece: Dramatic lighting (Rembrandt/Chiaroscuro), shallow depth of field (Bokeh), highly detailed skin texture, emotional atmosphere, wide aspect ratio feeling, blockbuster color grading, epic scale.',
        'H’Mông Documentaries – Phong cách phim tài liệu': 'National Geographic Documentary: Raw and gritty realism, natural lighting, candid moments, deep cultural depth, sharp focus on eyes and traditional craftsmanship, highly detailed environment, storytelling.',
        'H’Mông Watercolor – Sơn thủy màu nước': 'Traditional Watercolor Painting: Soft wet-on-wet brush strokes, ink wash mountains, artistic and fluid, dripping paint effects, pastel color palette, serene and poetic atmosphere.',
        'H’Mông Manga – Anime Nhật Bản': 'Japanese Anime/Manga Style: Cel shading, vibrant colors, expressive large eyes, dynamic action lines, 2D aesthetic, detailed background art similar to Makoto Shinkai films.',
        'H’Mông Realistic Portrait – Siêu thực 8K': '8K Hyper-Realistic Portrait: Macro photography, visible pores, vellus hair, perfect studio lighting, extremely sharp eyes, intricate details on silver necklace and embroidery, lifelike.',
        'H’Mông Cyberpunk – Tương lai kết hợp văn hóa': 'Hmong Cyberpunk: Futuristic setting, neon lights (blue/magenta), rain-slicked streets, traditional patterns mixed with cybernetic implants or high-tech accessories, glowing techwear, dystopian yet beautiful.',
        'Giấc mơ': 'Surreal Dreamscape: Floating elements, illogical but beautiful composition, soft fog, pastel and ethereal colors, subconscious symbolism, soft focus.',
        'Ảo ảnh': 'Optical Illusion / Glitch Art: Distorted reality, chromatic aberration, digital artifacts, mesmerizing patterns, psychological atmosphere, avant-garde.',
        'Chân thực': 'Standard Photorealistic: Balanced lighting, true-to-life colors, natural skin tones, sharp focus, no filters.',
        'Điện ảnh': 'Standard Cinematic: Dramatic shadows, moody lighting, film grain, cinematic color grading.',
        'Studio chuyên nghiệp': 'Professional Studio Photography: Solid or gradient background, 3-point lighting setup, perfect rim light, sharp subject, fashion magazine quality.',
        'Thời trang': 'High Fashion Editorial: Trendy poses, avant-garde makeup, focus on outfit silhouette, dramatic angles, vogue style.'
    };
    return mapping[style] || 'High quality, photorealistic, Hmong cultural elements.';
};

// --- PROMPT OPTIMIZER ---
export const optimizePrompt = async (apiKey: string, rawInput: string): Promise<string> => {
    const ai = getGeminiClient(apiKey);
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

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
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
    inputCounts: { male: number, female: number, maleAcc: number, femaleAcc: number }
): Promise<string> => {
    const ai = getGeminiClient(apiKey);

    let modeInstruction = "";
    if (outputMode === 'couple') {
        modeInstruction = "OUTPUT MODE: COUPLE (TOGETHER). You MUST generate prompts where BOTH the Male character AND the Female character appear TOGETHER in the same scene interacting naturally.";
    } else {
        modeInstruction = "OUTPUT MODE: SINGLE (SEPARATE). You MUST generate prompts for SOLO portraits (1 person per image). If both Male and Female inputs are present, ALTERNATE prompts between genders (Male, Female, Male...).";
    }

    const styleDetail = getStylePrompt(style);

    const systemInstruction = `
    You are an AI Art Director for a professional Hmong Photography Studio.
    Task: Generate exactly ${count} distinct but thematically linked English prompts based on the Topic: "${topic}".
    
    *** ABSOLUTE RULES FOR INPUT ACCURACY ***
    1. REFERENCE OBJECTS: The user has uploaded specific images for OUTFITS and ACCESSORIES.
       - If 'Male Accessory' exists: Your prompt MUST explicitly state: "The male character is holding/using the [describe item based on topic context] shown in the reference image."
       - If 'Female Accessory' exists: Your prompt MUST explicitly state: "The female character is holding/using the [describe item] shown in the reference image."
    2. INJECT MANDATORY PHRASE: Every prompt MUST strictly contain: "wearing the exact Reference Outfit shown in the input".
    3. CHARACTER BASE: "A tall, attractive Korean-like beauty with natural skin texture".
    4. STYLE: "${styleDetail}"
    5. SHOT TYPE: "${shotType}"
    6. ${modeInstruction}

    Output format: Just the prompts, separated by double newlines. No numbering, no introduction.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
    onImageGenerated: (index: number, base64: string | null) => void
): Promise<void> => {
    const ai = getGeminiClient(apiKey);

    // Flatten reference images
    const allRefParts = [
        ...refImages.male,
        ...refImages.female,
        ...refImages.maleAccessories,
        ...refImages.femaleAccessories
    ].map(img => ({
        inlineData: {
            data: img.data,
            mimeType: img.mimeType
        }
    }));

    // Fixed seed logic for consistency
    const sessionSeed = Math.floor(Math.random() * 1000000);

    const promises = prompts.map(async (prompt, index) => {
        try {
            onStatusUpdate(`Đang tạo ảnh ${index + 1}...`);

            // MASTER CONSTRAINT PROTOCOL
            const masterConstraint = `
            *** MASTER IDENTITY & OUTFIT CONSTRAINT PROTOCOL ***
            1. VIRTUAL TRY-ON ENFORCEMENT: The input images are NOT just inspiration. They are TEXTURES to be mapped. You must clone the patterns, colors, and cuts of the clothing exactly.
            2. IDENTITY LOCK: Use SEED ${sessionSeed} to strictly maintain facial features across all generated images.
            3. GENDER BINDING: Apply 'Male Outfit' inputs ONLY to the Male character. Apply 'Female Outfit' inputs ONLY to the Female character.
            4. ACCESSORY CLONING: If an accessory image is provided (e.g., Khene/Instrument), it must appear in the output exactly as shown.
            `;

            const fullPrompt = `${masterConstraint}\n\nSCENE DESCRIPTION: ${prompt}\n\nQUALITY: ${resolution === '4K' ? "UHD, 8k, hyper-detailed, masterpiece" : "High quality, detailed"}.`;

            // Wrap with retry
            const base64Image = await callWithRetry(
                async () => {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image-preview',
                        contents: {
                            parts: [
                                ...allRefParts,
                                { text: fullPrompt }
                            ]
                        },
                        config: {
                            imageConfig: {
                                aspectRatio: aspectRatio as any
                            },
                            seed: sessionSeed
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
                3, // retries
                5000, // delay
                (msg) => onStatusUpdate(`[Ảnh ${index + 1}] ${msg}`)
            );

            onImageGenerated(index, base64Image);
        } catch (error) {
            console.error(`Error generating image ${index}:`, error);
            onImageGenerated(index, null);
        }
    });

    await Promise.all(promises);
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
    onImageGenerated: (index: number, base64: string | null) => void
): Promise<{ prompts: string[] }> => {
    const ai = getGeminiClient(apiKey);

    const basePrompt = `Generate a professional ID photo/headshot of this person.
    Gender: ${gender}.
    Clothing: ${clothing}.
    Hairstyle: ${hairstyle}.
    Background Color: ${bgColor}.
    Lighting: Professional studio lighting, even and soft.
    Expression: Neutral to slight smile, professional confidence.
    Ensure high fidelity to the facial features of the input image.`;

    const prompts = [
        basePrompt + " Variation 1: Standard professional look.",
        basePrompt + " Variation 2: Slightly brighter lighting.",
        basePrompt + " Variation 3: slightly different angle (very subtle).",
        basePrompt + " Variation 4: High contrast professional look."
    ];

    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const promises = prompts.map(async (prompt, index) => {
        try {
            onStatusUpdate(`Đang xử lý ảnh thẻ ${index + 1}...`);

            const base64Image = await callWithRetry(
                async () => {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image-preview',
                        contents: {
                            parts: [inputPart, { text: prompt }]
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

            onImageGenerated(index, base64Image);

        } catch (e) {
            console.error(e);
            onImageGenerated(index, null);
        }
    });

    await Promise.all(promises);
    return { prompts };
};

// --- EDIT IMAGE ---
export const editImage = async (apiKey: string, imagePart: ImagePart, prompt: string): Promise<string | null> => {
    const ai = getGeminiClient(apiKey);
    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    return await callWithRetry(async () => {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
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
        } catch (e) {
            throw e;
        }
    });
};

// --- OUTFIT MIX & MATCH ---
export const mixMatchOutfit = async (
    apiKey: string,
    outfit1: ImagePart,
    outfit2: ImagePart
): Promise<string | null> => {
    const ai = getGeminiClient(apiKey);
    const parts = [
        { inlineData: { data: outfit1.data, mimeType: outfit1.mimeType } },
        { inlineData: { data: outfit2.data, mimeType: outfit2.mimeType } }
    ];

    const prompt = `
    OUTFIT MIXING TASK:
    Analyze the two input outfit images.
    Create a NEW fashion design that combines elements from both inputs.
    - Blend the textures, patterns, and silhouettes.
    - Create a harmonious fusion.
    - Display the result as a high-quality fashion photograph on a mannequin or model.
    - Style: Modern Avant-Garde Fusion.
    `;

    return await callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
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
};

// --- CLOTHING EXTRACTION ---
export const extractClothing = async (
    apiKey: string,
    imagePart: ImagePart
): Promise<string | null> => {
    const ai = getGeminiClient(apiKey);
    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const prompt = `
    CLOTHING EXTRACTION TASK:
    Analyze the input image carefully. Identify the main outfit/clothing worn by the person.
    ACTION:
    1. Completely remove the person (head, hands, skin, legs, feet) and the background.
    2. Isolate ONLY the clothing/outfit.
    3. Present the clothing on a transparent background or plain white background, similar to a "Ghost Mannequin" or "Flat Lay" product photography style.
    4. Ensure the clothing retains all original textures, colors, and folds.
    5. The output should be just the clothes, ready for an e-commerce catalog.
    `;

    return await callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
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
};

// --- SCENE RELIGHTING ---
export const relightImage = async (
    apiKey: string,
    imagePart: ImagePart,
    lightingStyle: string
): Promise<string | null> => {
    const ai = getGeminiClient(apiKey);
    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    let lightingDesc = "";
    switch (lightingStyle) {
        case 'hoang_hon': lightingDesc = "Golden Hour / Sunset: Warm, soft, low-angle sunlight, orange and purple hues in the sky, dramatic silhouettes."; break;
        case 'studio': lightingDesc = "Professional Studio: Clean, bright 3-point lighting, neutral background, high contrast, perfect for portraits."; break;
        case 'neon': lightingDesc = "Cyberpunk Neon: Blue and magenta rim lighting, dark background, futuristic atmosphere, high contrast."; break;
        case 'rung_toi': lightingDesc = "Dark Forest / Moonlight: Cool blue tones, dappled light through trees, mysterious and moody atmosphere."; break;
        case 'ban_dem': lightingDesc = "Night City / Bokeh: City lights in background, dark ambiance, sharp focus on subject."; break;
        default: lightingDesc = lightingStyle;
    }

    const prompt = `RELIGHTING TASK. Transform the lighting of this image strictly to: ${lightingDesc}. Keep the subject exactly the same, but completely change the environment lighting and atmosphere.`;

    return await callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
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
};

// --- UPSCALE IMAGE ---
export const upscaleImage = async (apiKey: string, imagePart: ImagePart, resolution: '2K' | '4K'): Promise<string | null> => {
    const ai = getGeminiClient(apiKey);
    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const prompt = `Restoration and Upscaling Task. 
    Transform this image into extreme ${resolution} resolution. 
    Sharpen all details, fix compression artifacts, denoise, and enhance texture fidelity. 
    Do not change the subject or composition, only improve the quality to professional high-definition standards.
    Output must be crystal clear.`;

    return await callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview', // Using Flash as it acts as a good img2img refiner
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
};

// --- GENERATE PROFILE PIC ---
export const generateProfilePic = async (
    apiKey: string,
    imagePart: ImagePart,
    style: string,
    platform: string,
    resolution: '2K' | '4K'
): Promise<string | null> => {
    const ai = getGeminiClient(apiKey);
    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const prompt = `Generate a Professional Profile Picture for ${platform}.
    Style: ${style}.
    Resolution: ${resolution}.
    Requirements: Headshot or bust, professional studio lighting, clear face, confident expression.
    Background: Clean, professional, suited for ${platform}.
    Preserve facial identity of the input image strictly.
    High quality, sharp focus.`;

    return await callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
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
};

// --- DREAM JOB HELPER: CLEANUP & UPSCALE ---
// Now returns string directly or throws. Retry wrapper in main function will handle errors.
const cleanupAndUpscale = async (apiKey: string, imagePart: ImagePart): Promise<string> => {
    const ai = getGeminiClient(apiKey);
    const inputPart = {
        inlineData: {
            data: imagePart.data,
            mimeType: imagePart.mimeType
        }
    };

    const prompt = `
    RESTORATION AND CLEANUP TASK:
    1.  **Upscale to 4K**: Increase resolution and sharpness significantly.
    2.  **Remove Text/Logos**: Identify and completely REMOVE any text, watermarks, logos, dates, or overlay graphics. Fill the gaps naturally.
    3.  **Preserve Subject**: Do NOT change the person's face or identity.
    4.  **Enhance Quality**: Fix blurriness, noise, and compression artifacts.
    Output: A clean, sharp, high-quality version of the original photo.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
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
    throw new Error("Cleanup model returned no image.");
};

// --- DREAM JOB GENERATION (BATCH) ---
export const generateDreamJob = async (
    apiKey: string,
    inputs: { image: ImagePart, jobPrompt: string }[],
    onStatusUpdate: (status: string) => void,
    onImageGenerated: (index: number, base64: string | null) => void,
    onInputProcessed: (index: number, base64: string | null) => void
): Promise<void> => {
    const ai = getGeminiClient(apiKey);

    // Process sequentially to avoid 429 Resource Exhausted errors
    for (let index = 0; index < inputs.length; index++) {
        const input = inputs[index];
        const { image, jobPrompt } = input;

        onStatusUpdate(`Đang xử lý ${index + 1}/${inputs.length}: ${jobPrompt}...`);

        let inputImageForGeneration = image;

        // 1. Cleanup Task (With Retry)
        try {
            onStatusUpdate(`[${index + 1}] Đang làm sạch ảnh gốc...`);
            const cleanedImage = await callWithRetry(
                () => cleanupAndUpscale(apiKey, image),
                4, // 4 retries for cleanup
                10000, // Increased base delay
                (msg) => onStatusUpdate(`[${index + 1}] ${msg}`)
            );

            onInputProcessed(index, cleanedImage);

            // Use the cleaned image for the next step to improve quality
            if (cleanedImage) {
                inputImageForGeneration = {
                    data: cleanedImage,
                    mimeType: 'image/jpeg' // Gemini output is usually JPEG/PNG, we can treat as standard image
                };
            }
        } catch (cleanupError) {
            console.warn(`Cleanup skipped for item ${index} due to error`, cleanupError);
            onStatusUpdate(`[${index + 1}] Lỗi làm sạch (hoặc quá tải), dùng ảnh gốc...`);
            // Proceed with original image if cleanup fails
        }

        // Buffer between cleanup and generation - Increase to 5s
        await delay(5000);

        // 2. Dream Job Generation (With Retry)
        const prompt = `
        DREAM JOB VISUALIZATION TASK (VIETNAM CONTEXT):
        Input Image: A photo of a student/child.
        Target Dream Job: ${jobPrompt}.

        STRICT REQUIREMENTS:
        1.  **CONTEXT: VIETNAM (VIỆT NAM).** The setting, background, and environment MUST be distinctly Vietnamese.
        2.  **UNIFORMS:** The character MUST wear the **STANDARD VIETNAMESE UNIFORM** for the job "${jobPrompt}".
            -   If Police (Cong An): Must be the official Green uniform of Vietnam Police.
            -   If Doctor/Nurse: Standard white blouse/scrubs in a modern Vietnamese hospital.
            -   If Army (Bo Doi): Standard Vietnam People's Army green camouflage or dress uniform.
            -   If Pilot/Flight Attendant: Vietnam Airlines or Vietjet style is preferred (Ao Dai for female attendants is excellent).
            -   **ABSOLUTELY NO** US, European, or other foreign flags, badges, or uniform styles.
        3.  **AGE PROGRESSION:** Imagine the person in the input image grown up to 20-25 years old.
        4.  **RESOLUTION:** 4K UHD, Hyper-realistic, 8K detail.
        5.  **EXTREME FACE FIDELITY (MANDATORY):** You MUST strictly preserve the facial features of the input person. The output face MUST look exactly like the input person but aged to 20-25 years old. Do not generate a generic face. Keep the eye shape, nose shape, and mouth shape identical to the input.
        6.  **POSE:** Confident, professional, looking at the camera or in action.
        `;

        const inputPart = {
            inlineData: {
                data: inputImageForGeneration.data,
                mimeType: inputImageForGeneration.mimeType
            }
        };

        const generateStep = async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [inputPart, { text: prompt }]
                },
                config: {
                    imageConfig: {
                        aspectRatio: '3:4'
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
            throw new Error("No image generated");
        };

        try {
            onStatusUpdate(`[${index + 1}] Đang vẽ ước mơ...`);
            const base64Image = await callWithRetry(
                generateStep,
                5, // More retries for the main generation
                15000, // 15s base delay for generation steps
                (msg) => onStatusUpdate(`[${index + 1}] ${msg}`)
            );
            onImageGenerated(index, base64Image);
        } catch (e: any) {
            console.error(`Error generating dream job ${index}:`, e);
            onImageGenerated(index, null);
        }

        // Delay between items to respect Rate Limits
        if (index < inputs.length - 1) {
            // Increase delay to 20 seconds to be extremely safe against 429s during batch processing
            onStatusUpdate(`[${index + 1}] Đang chờ hệ thống (Cool down 20s)...`);
            await delay(20000);
        }
    }
};
