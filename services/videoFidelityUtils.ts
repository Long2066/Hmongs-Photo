import { analyzeVoiceDirective } from './scenePromptUtils.ts';

export type VideoFrameFitMode = 'safe_contain' | 'smart_face_crop';

export interface SimpleFaceBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface VideoFrameLayoutResult {
    mode: 'direct' | 'contain_blur' | 'crop';
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}

export interface BuildFaceLockPromptOptions {
    strictIdentityLock?: boolean;
    strictMotionLock?: boolean;
    characterDna?: string;
}

/**
 * Pure helper computing face-safe Video Reference Frame layout.
 * - 'safe_contain' preserves 100% of head, headdress, and full outfit with zero cropping or stretching
 *   when input aspect ratio differs notably from target video ratio (e.g. 9:16 photo into 16:9 video).
 * - 'smart_face_crop' fills the full target frame while anchoring around detected faces & headroom.
 */
export const computeSmartVideoFrameLayout = (
    imgWidth: number,
    imgHeight: number,
    targetWidth: number,
    targetHeight: number,
    faces: SimpleFaceBox[] = [],
    fitMode: VideoFrameFitMode = 'safe_contain'
): VideoFrameLayoutResult => {
    const safeW = Math.max(1, imgWidth);
    const safeH = Math.max(1, imgHeight);
    const imgRatio = safeW / safeH;
    const targetRatio = targetWidth / targetHeight;
    const mismatch = Math.max(imgRatio / targetRatio, targetRatio / imgRatio);

    if (mismatch <= 1.03) {
        return {
            mode: 'direct',
            sx: 0,
            sy: 0,
            sw: safeW,
            sh: safeH,
            dx: 0,
            dy: 0,
            dw: targetWidth,
            dh: targetHeight
        };
    }

    if (fitMode === 'safe_contain' && mismatch > 1.08) {
        const scale = Math.min(targetWidth / safeW, targetHeight / safeH);
        const dw = Math.max(1, Math.round(safeW * scale));
        const dh = Math.max(1, Math.round(safeH * scale));
        const dx = Math.round((targetWidth - dw) / 2);
        const dy = Math.round((targetHeight - dh) / 2);
        return {
            mode: 'contain_blur',
            sx: 0,
            sy: 0,
            sw: safeW,
            sh: safeH,
            dx,
            dy,
            dw,
            dh
        };
    }

    // Cover crop (source region -> full target canvas) with strict face + headroom anchoring
    if (imgRatio < targetRatio) {
        const sw = safeW;
        const sh = Math.max(1, Math.min(safeH, Math.round(safeW / targetRatio)));
        const excessY = Math.max(0, safeH - sh);
        let sy = Math.round(excessY * 0.08);

        if (faces.length > 0) {
            const minFaceY = Math.min(...faces.map(f => f.y));
            const maxFaceY = Math.max(...faces.map(f => f.y + f.height));
            const avgFaceH = faces.reduce((sum, f) => sum + f.height, 0) / faces.length;
            const headroom = Math.max(avgFaceH * 1.35, 32);
            const idealTop = Math.max(0, minFaceY - headroom);
            const requiredBottom = maxFaceY + avgFaceH * 0.3;

            if (idealTop + sh < requiredBottom) {
                sy = Math.max(0, Math.min(excessY, Math.round(idealTop)));
            } else {
                const facesSpan = requiredBottom - idealTop;
                const extraSlack = sh - facesSpan;
                sy = Math.max(0, Math.min(excessY, Math.round(idealTop - extraSlack * 0.3)));
            }
        }

        return {
            mode: 'crop',
            sx: 0,
            sy,
            sw,
            sh,
            dx: 0,
            dy: 0,
            dw: targetWidth,
            dh: targetHeight
        };
    }

    // Image is wider than target ratio: horizontal cover crop centered around faces
    const sh = safeH;
    const sw = Math.max(1, Math.min(safeW, Math.round(safeH * targetRatio)));
    const excessX = Math.max(0, safeW - sw);
    let sx = Math.round(excessX / 2);

    if (faces.length > 0) {
        const minFaceX = Math.min(...faces.map(f => f.x));
        const maxFaceX = Math.max(...faces.map(f => f.x + f.width));
        const faceCenterX = (minFaceX + maxFaceX) / 2;
        sx = Math.max(0, Math.min(excessX, Math.round(faceCenterX - sw / 2)));
    }

    return {
        mode: 'crop',
        sx,
        sy: 0,
        sw,
        sh,
        dx: 0,
        dy: 0,
        dw: targetWidth,
        dh: targetHeight
    };
};

/**
 * Xây dựng Prompt Face-Lock, Wardrobe-Lock, Motion Stability & Audio/Voice Control
 * Không ép từ khóa "4k photography" vào ảnh 3D/Anime/Minh họa để giữ nguyên phong cách gốc.
 */
export const buildFaceLockPrompt = (
    userPrompt: string,
    isImageToVideo: boolean,
    options: BuildFaceLockPromptOptions = {}
): { prompt: string; negativePrompt: string; isNoVoice: boolean } => {
    const rawWithoutLegacy = (userPrompt || '')
        .replace(/Giữ tuyệt đối khuôn mặt và nhân vật gốc\.\s*/gi, '')
        .replace(/- Cảnh\s*\d+\/\d+/gi, '')
        .trim();

    const voice = analyzeVoiceDirective(rawWithoutLegacy);
    const clean = voice.cleanPrompt;
    const strictIdentity = options.strictIdentityLock !== false;
    const strictMotion = options.strictMotionLock !== false;
    const cleanDna = options.characterDna?.trim();

    let negativePrompt = 'face morphing, changing face, different person, shifting facial features, altered facial structure, mutated eyes, deformed nose, inconsistent identity, ugly, bad anatomy, deformed face during camera movement, duplicate faces, floating facial features, unnatural head movement, distorted jawline, wardrobe change, outfit swap, different clothes, changing dress, changing shirt, altered outfit colors, different hair color, sudden scene cut, style shift, black bars, pillarbox, letterbox';

    if (voice.isNoVoice) {
        negativePrompt += ', human speech, talking, speaking, dialogue, monologue, voiceover, narration, moving lips, open mouth speaking, lipsync, singing, whispering, shouting, subtitles, captions';
    } else if (voice.hasExplicitDialogue) {
        negativePrompt += ', burned-in subtitles, captions, on-screen text';
    }

    const voiceDirective = voice.isNoVoice
        ? "SILENT CHARACTER AUDIO RULE: Keep the character's mouth naturally closed without talking, speaking, or moving lips. Preserve normal realistic environmental ambient and foley sounds matching the scene (wind, footsteps, animals, nature, background ambience) with zero human dialogue or voiceover."
        : voice.hasExplicitDialogue
        ? 'NATURAL CHARACTER DIALOGUE: Animate natural lifelike speech, accurate lip expression, and clear character voice matching the dialogue alongside authentic environmental ambience.'
        : '';

    if (!isImageToVideo) {
        const baseAction = clean || 'Smooth cinematic camera motion, natural lifelike movement, cohesive lighting';
        const parts = [baseAction];
        if (cleanDna) {
            parts.push(`CHARACTER & OUTFIT DNA LOCK (MAINTAIN ACROSS ENTIRE CLIP): ${cleanDna}`);
        }
        if (voiceDirective) {
            parts.push(voiceDirective);
        }
        return {
            prompt: parts.join('. '),
            negativePrompt,
            isNoVoice: voice.isNoVoice
        };
    }

    const parts: string[] = [];

    if (strictIdentity) {
        parts.push(
            'CRITICAL IDENTITY & OUTFIT LOCK: Animate the EXACT person(s) and EXACT outfit from the input reference frame. Strictly clone 100% identical facial features, bone structure, eyes, nose, lips, skin tone, hairstyle, garment colors, embroidery/patterns, and visual style throughout every second of the video. Zero face drift, zero face morphing, zero wardrobe change.'
        );
    }

    const actionSegment = clean
        ? `Action and motion: ${clean}. Maintain the exact visual style, character appearance, and cohesive lighting of the source image.`
        : `Natural subtle cinematic breathing, gentle lifelike movement, and cohesive lighting preserving the exact visual style and appearance of the source image.`;
    parts.push(actionSegment);

    if (strictMotion) {
        parts.push(
            'MOTION STABILITY LOCK: Use smooth, controlled camera movement (gentle slow dolly or subtle pan). Avoid sudden whip-pans, abrupt cuts, extreme head rotations away from the lens, or occluding the face.'
        );
    }

    if (cleanDna) {
        parts.push(`IMMUTABLE CHARACTER DNA SPEC: ${cleanDna}`);
    }

    if (voiceDirective) {
        parts.push(voiceDirective);
    }

    return {
        prompt: parts.join(' '),
        negativePrompt,
        isNoVoice: voice.isNoVoice
    };
};

/**
 * Prevents reference-based image tasks from silently dropping all input photos
 * into text-only /images/generations fallback.
 */
export const canFallbackToTextOnlyImageGeneration = (referenceCount: number): boolean => {
    return referenceCount === 0;
};
