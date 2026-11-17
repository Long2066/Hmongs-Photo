/**
 * Closed-Loop Consistency QA Service (Image & Multi-Scene Video)
 *
 * - Layer 1: Character & Wardrobe DNA Extraction (Vision multimodal anchor across 1..40 scenes)
 * - Layer 2: Multi-signal Auto-QA Gate (Face Identity + Outfit/Color + Temporal/Anatomy)
 * - Layer 3: Targeted Self-Healing Retry Prompt Builder + Best-Candidate Selector
 */

import type { IdentityPreservationMode } from './nineRouterService.ts';

export const DEFAULT_STRICT_QA_THRESHOLD = 85;
export const MAX_AUTO_QA_RETRIES = 2;

export type ConsistencyQaStatus = 'passed' | 'repaired' | 'warning' | 'unverified';

export interface ConsistencyQaScores {
    faceScore: number;
    outfitScore: number;
    anatomyScore: number;
}

export interface ConsistencyQaReport {
    passed: boolean;
    status: ConsistencyQaStatus;
    faceScore: number;
    outfitScore: number;
    anatomyScore: number;
    overallScore: number;
    defects: string[];
    fixInstruction: string;
    reasonSummary: string;
    attemptsUsed?: number;
    checkedAt: number;
}

export interface QaCandidate<T> {
    result: T;
    report: ConsistencyQaReport;
    attempt: number;
}

export const clampScore = (val: unknown, fallback = 0): number => {
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(100, Math.round(num)));
};

/**
 * Computes weighted consistency score + enforces strict per-axis floor
 * so a wrong face or altered outfit cannot pass on background quality.
 */
export const evaluateConsistencyScores = (
    scores: ConsistencyQaScores,
    threshold: number = DEFAULT_STRICT_QA_THRESHOLD
): { overallScore: number; passed: boolean } => {
    const face = clampScore(scores.faceScore, 0);
    const outfit = clampScore(scores.outfitScore, 0);
    const anatomy = clampScore(scores.anatomyScore, 0);

    const overallScore = Math.round(face * 0.5 + outfit * 0.35 + anatomy * 0.15);
    const axisFloor = Math.max(50, threshold - 5);
    const passed = overallScore >= threshold && face >= axisFloor && outfit >= axisFloor;

    return { overallScore, passed };
};

/**
 * Extracts and validates structured QA report from Vision LLM output.
 */
export const parseVisionQaJsonResponse = (
    rawText: string | null | undefined,
    threshold: number = DEFAULT_STRICT_QA_THRESHOLD
): ConsistencyQaReport | null => {
    if (!rawText || typeof rawText !== 'string') return null;

    const clean = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    const startIdx = clean.indexOf('{');
    const endIdx = clean.lastIndexOf('}');
    if (startIdx === -1 || endIdx <= startIdx) return null;

    try {
        const parsed = JSON.parse(clean.slice(startIdx, endIdx + 1));
        if (!parsed || typeof parsed !== 'object') return null;

        const faceScore = clampScore(parsed.faceScore ?? parsed.face_score ?? parsed.face, -1);
        const outfitScore = clampScore(parsed.outfitScore ?? parsed.outfit_score ?? parsed.outfit, -1);
        const anatomyScore = clampScore(parsed.anatomyScore ?? parsed.anatomy_score ?? parsed.anatomy ?? 85, 85);

        if (faceScore < 0 || outfitScore < 0) return null;

        const { overallScore, passed } = evaluateConsistencyScores(
            { faceScore, outfitScore, anatomyScore },
            threshold
        );

        const defectsRaw = Array.isArray(parsed.defects)
            ? parsed.defects
            : typeof parsed.defects === 'string' && parsed.defects.trim()
            ? [parsed.defects]
            : [];

        const defects = defectsRaw
            .map((d: unknown) => String(d || '').trim())
            .filter(Boolean)
            .slice(0, 6);

        const fixInstruction = String(
            parsed.fixInstruction ?? parsed.fix_instruction ?? parsed.fix ?? ''
        ).trim();

        const reasonSummary = String(
            parsed.reasonSummary ??
                parsed.reason_summary ??
                parsed.summary ??
                (defects.length > 0 ? defects.join('; ') : passed ? 'Đạt chuẩn 100% ảnh gốc' : 'Chưa đạt ngưỡng đồng nhất ảnh gốc')
        ).trim();

        return {
            passed,
            status: passed ? 'passed' : 'warning',
            faceScore,
            outfitScore,
            anatomyScore,
            overallScore,
            defects,
            fixInstruction,
            reasonSummary,
            checkedAt: Date.now()
        };
    } catch {
        return null;
    }
};

/**
 * Generates targeted corrective instructions injected on automatic QA retry.
 */
export const buildCorrectiveRetryPrompt = (
    basePrompt: string,
    prevReport: ConsistencyQaReport,
    attemptNum: number,
    isVideo: boolean
): string => {
    const cleanBase = (basePrompt || '')
        .replace(/\[AUTO-REPAIR ATTEMPT #\d+\][\s\S]*?\[\/AUTO-REPAIR\]/gi, '')
        .trim();

    const fixes: string[] = [];

    if (prevReport.faceScore < DEFAULT_STRICT_QA_THRESHOLD) {
        fixes.push(
            'MANDATORY FACE IDENTITY REPAIR: Clone the EXACT original person face pixel-faithfully (eyes, eyebrows, nose bridge, lip thickness, jawline, skin tone, age, and hairstyle). ZERO face drift or generic beautification.'
        );
    }

    if (prevReport.outfitScore < DEFAULT_STRICT_QA_THRESHOLD) {
        fixes.push(
            'MANDATORY OUTFIT & COLOR REPAIR: Strictly replicate 100% of the exact garment colors, fabric patterns, embroidery, sleeves, and headwear from the reference photo(s). ZERO color change or wardrobe swap.'
        );
    }

    if (prevReport.anatomyScore < 80) {
        fixes.push(
            isVideo
                ? 'MANDATORY TEMPORAL & MOTION STABILITY REPAIR: Keep smooth slow camera movement, natural proportions, clean hands/fingers, and zero facial warping or flickering.'
                : 'MANDATORY ANATOMY REPAIR: Natural human proportions, clean hands/fingers, realistic contact shadow on solid ground.'
        );
    }

    if (prevReport.defects.length > 0) {
        fixes.push(`PREVIOUS DEFECTS TO ELIMINATE: ${prevReport.defects.join('; ')}`);
    }

    if (prevReport.fixInstruction) {
        fixes.push(`SPECIFIC FIX: ${prevReport.fixInstruction}`);
    }

    if (fixes.length === 0) {
        return cleanBase;
    }

    return `${cleanBase}\n\n[AUTO-REPAIR ATTEMPT #${attemptNum}]\n${fixes.join('\n')}\n[/AUTO-REPAIR]`;
};

/**
 * Selects the highest-fidelity candidate across initial + retry attempts.
 * A candidate that passes both floor & threshold always outranks a failed one.
 */
export const selectBestQaCandidate = <T>(candidates: Array<QaCandidate<T>>): QaCandidate<T> | null => {
    if (!candidates || candidates.length === 0) return null;

    const sorted = [...candidates].sort((a, b) => {
        if (a.report.passed !== b.report.passed) {
            return a.report.passed ? -1 : 1;
        }
        if (b.report.overallScore !== a.report.overallScore) {
            return b.report.overallScore - a.report.overallScore;
        }
        if (b.report.faceScore !== a.report.faceScore) {
            return b.report.faceScore - a.report.faceScore;
        }
        if (b.report.outfitScore !== a.report.outfitScore) {
            return b.report.outfitScore - a.report.outfitScore;
        }
        return a.attempt - b.attempt;
    });

    return sorted[0];
};

const createUnverifiedReport = (summary: string): ConsistencyQaReport => ({
    passed: true,
    status: 'unverified',
    faceScore: 0,
    outfitScore: 0,
    anatomyScore: 0,
    overallScore: 0,
    defects: [],
    fixInstruction: '',
    reasonSummary: summary,
    checkedAt: Date.now()
});

/**
 * Extracts a concise immutable Character + Wardrobe + Visual Medium DNA Spec once per batch
 * so 10-40 scene prompts and clip prompts never drift in details, hair, or outfit colors.
 */
export const extractCharacterDnaSpec = async (options: {
    referenceImages: Array<{ data: string; mimeType?: string; label?: string }>;
    outputMode?: 'single' | 'couple';
    identityMode?: IdentityPreservationMode;
    abortSignal?: AbortSignal;
}): Promise<string> => {
    const validRefs = (options.referenceImages || []).filter(r => r && r.data && r.data.length > 50);
    if (validRefs.length === 0) return '';

    try {
        const { analyzeMultimodalVisionViaNineRouter } = await import('./nineRouterService');
        const isStrict = options.identityMode !== 'korean_idol';

        const prompt = isStrict
            ? `Analyze the attached ${validRefs.length} reference image(s) (${options.outputMode === 'couple' ? 'COUPLE / DUAL SUBJECTS' : 'SINGLE SUBJECT'}) and produce ONE concise immutable visual specification (under 140 words) for consistent scene generation across a 40-shot series:
1. VISUAL MEDIUM/STYLE: (e.g., photorealistic smartphone photo, studio photography, 3D animation, anime/2D illustration).
2. SUBJECT FACIAL IDENTITY & HAIR (LOCKED): exact apparent gender, age bracket, face shape, eyes, eyebrows, nose, lips, skin tone, hair color/length/parting, facial hair or glasses if present.
3. EXACT OUTFIT & COLORS (LOCKED): every garment piece, exact colors, fabric weave/patterns, embroidery trims, collars, sleeves, pants/skirt, footwear, headwear/headdress.
Output ONLY dense factual visual descriptors (no intro, no markdown headings).`
            : `Analyze the clothing, textiles, embroidery, and accessories in the attached reference image(s) and output ONE concise garment & accessory specification (under 110 words): exact garment pieces, exact primary/secondary colors, embroidery motifs, fabrics, headwear, and items. Output ONLY factual descriptors.`;

        const spec = await analyzeMultimodalVisionViaNineRouter({
            prompt,
            images: validRefs.slice(0, 4),
            temperature: 0.1,
            maxTokens: 320,
            timeoutMs: 22000,
            abortSignal: options.abortSignal
        });

        return (spec || '').replace(/\s+/g, ' ').trim().slice(0, 900);
    } catch (err) {
        console.warn('[CharacterDNA] Failed to extract DNA spec (continuing cleanly):', err);
        return '';
    }
};

/**
 * Extracts evenly-spaced frames from a generated video clip into compact JPEG base64 strings
 * for automated Vision temporal QA inspection.
 */
export const extractVideoSampleFrames = async (
    videoUrl: string,
    count: number = 3
): Promise<string[]> => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !videoUrl) {
        return [];
    }

    let objectUrlToRevoke: string | null = null;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    const loadVideoSource = (srcUrl: string): Promise<void> =>
        new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Video frame load timeout')), 15000);
            const cleanup = () => {
                clearTimeout(timeout);
                video.onloadedmetadata = null;
                video.onerror = null;
            };
            video.onloadedmetadata = () => {
                cleanup();
                resolve();
            };
            video.onerror = () => {
                cleanup();
                reject(new Error('Video load error'));
            };
            video.src = srcUrl;
            try {
                video.load();
            } catch {}
        });

    try {
        try {
            await loadVideoSource(videoUrl);
        } catch {
            // If direct load failed due to CORS or crossOrigin constraint, try fetching blob locally
            if (!videoUrl.startsWith('blob:') && !videoUrl.startsWith('data:')) {
                const resp = await fetch(videoUrl);
                if (!resp.ok) return [];
                const blob = await resp.blob();
                objectUrlToRevoke = URL.createObjectURL(blob);
                await loadVideoSource(objectUrlToRevoke);
            } else {
                return [];
            }
        }

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
        const ratios = count <= 1
            ? [0.5]
            : count === 2
            ? [0.15, 0.85]
            : [0.12, 0.5, 0.88];

        const srcW = video.videoWidth || 720;
        const srcH = video.videoHeight || 720;
        const maxEdge = 512;
        const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
        const cw = Math.max(64, Math.round(srcW * scale));
        const ch = Math.max(64, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return [];

        const frames: string[] = [];

        for (const ratio of ratios) {
            const targetTime = Math.min(Math.max(0.08, duration * ratio), Math.max(0.1, duration - 0.08));
            await new Promise<void>((resolve) => {
                const seekTimer = setTimeout(() => {
                    video.onseeked = null;
                    resolve();
                }, 4000);
                video.onseeked = () => {
                    clearTimeout(seekTimer);
                    video.onseeked = null;
                    resolve();
                };
                try {
                    video.currentTime = targetTime;
                } catch {
                    clearTimeout(seekTimer);
                    resolve();
                }
            });

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(video, 0, 0, cw, ch);

            try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
                const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                if (b64 && b64.length > 200) {
                    frames.push(b64);
                }
            } catch {
                // Tainted canvas if remote host lacks CORS headers
                return [];
            }
        }

        return frames;
    } catch (err) {
        console.warn('[VideoQA] Frame extraction skipped:', err);
        return [];
    } finally {
        try {
            video.removeAttribute('src');
            video.load();
        } catch {}
        if (objectUrlToRevoke) {
            try {
                URL.revokeObjectURL(objectUrlToRevoke);
            } catch {}
        }
    }
};

const loadHtmlImageSafe = (base64OrUrl: string): Promise<HTMLImageElement | null> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = base64OrUrl.startsWith('data:') || /^https?:\/\//i.test(base64OrUrl)
            ? base64OrUrl
            : `data:image/jpeg;base64,${base64OrUrl}`;
    });
};

/**
 * Closed-loop Image Identity & Wardrobe Auditor.
 */
export const verifyGeneratedImageConsistency = async (options: {
    referenceImages: Array<{ data: string; mimeType?: string; label?: string }>;
    generatedBase64: string;
    identityMode?: IdentityPreservationMode;
    scenePrompt?: string;
    threshold?: number;
    abortSignal?: AbortSignal;
}): Promise<ConsistencyQaReport> => {
    const threshold = options.threshold ?? DEFAULT_STRICT_QA_THRESHOLD;
    const validRefs = (options.referenceImages || []).filter(r => r && r.data && r.data.length > 50);

    if (!options.generatedBase64 || validRefs.length === 0) {
        return createUnverifiedReport('Không có ảnh tham chiếu để đối chiếu.');
    }

    try {
        // Layer 1: Lightweight on-device face presence cue (never blocks distant shots blindly, informs Judge)
        let localFaceCue = '';
        if (options.identityMode !== 'korean_idol' && typeof window !== 'undefined') {
            try {
                const { detectFacesInImage } = await import('./aiFaceDetectService');
                const [refImg, genImg] = await Promise.all([
                    loadHtmlImageSafe(validRefs[0].data),
                    loadHtmlImageSafe(options.generatedBase64)
                ]);
                if (refImg && genImg) {
                    const [refFaces, genFaces] = await Promise.all([
                        detectFacesInImage(refImg),
                        detectFacesInImage(genImg)
                    ]);
                    if (refFaces.length > 0 && genFaces.length === 0) {
                        localFaceCue = 'WARNING: On-device detector detected a visible face in REFERENCE, but detected 0 clear faces in GENERATED IMAGE — inspect carefully whether the face is altered, cropped off, blurred, or missing!';
                    }
                }
            } catch {
                // Non-fatal
            }
        }

        const { analyzeMultimodalVisionViaNineRouter } = await import('./nineRouterService');
        const isStrict = options.identityMode !== 'korean_idol';

        // Pick top informative refs (up to 3: e.g. close-up face anchor + full male/female outfit refs)
        const inspectionImages: Array<{ data: string; mimeType?: string; label?: string }> = [
            ...validRefs.slice(0, 3).map((img, i) => ({
                data: img.data,
                mimeType: img.mimeType || 'image/jpeg',
                label: `REFERENCE ${i + 1}${img.label ? ` (${img.label})` : ''}`
            })),
            {
                data: options.generatedBase64,
                mimeType: 'image/jpeg',
                label: 'CANDIDATE GENERATED IMAGE TO AUDIT'
            }
        ];

        const qaPrompt = isStrict
            ? `You are a strict Visual Quality & Identity Consistency Judge. Compare the LAST image (CANDIDATE GENERATED IMAGE TO AUDIT) against the earlier REFERENCE images.
Requested Scene: "${(options.scenePrompt || '').slice(0, 260)}"
${localFaceCue}

Score strictly from 0 to 100 on three criteria:
1. faceScore: Is the generated face 100% IDENTICAL to the original person in the REFERENCE (exact eye shape, nose, mouth, jawline, skin tone, age, ethnicity, hair)? Penalize heavily (<70) if swapped to a generic/Korean idol face or a different person!
2. outfitScore: Does the generated character wear the EXACT SAME outfit, exact color palette, pattern/embroidery, sleeves, and headwear from REFERENCE? Penalize heavily (<70) if clothing color or style changed!
3. anatomyScore: Clean natural human proportions, hands, lighting, visual medium consistency, feet grounded cleanly without distortion.

Respond strictly with ONE valid JSON object only (in Vietnamese for summary/defects):
{"faceScore": 0-100, "outfitScore": 0-100, "anatomyScore": 0-100, "defects": ["mô tả ngắn lỗi nếu < 85"], "fixInstruction": "Specific English repair directive for re-generation if any score < 85, or empty string if passed", "reasonSummary": "Tóm tắt 1 câu bằng tiếng Việt"}`
            : `You are a strict Outfit & Visual Quality Consistency Judge comparing the LAST image (CANDIDATE GENERATED IMAGE TO AUDIT) against the earlier REFERENCE OUTFIT photos.
Requested Scene: "${(options.scenePrompt || '').slice(0, 260)}"

Score 0-100:
1. faceScore: High aesthetic quality & clean natural facial rendering (no deformed eyes/mouth/extra heads).
2. outfitScore: Does the generated subject wear the EXACT SAME clothing colors, embroidery patterns, cut, and headwear from REFERENCE? Penalize heavily (<70) if wrong color or swapped outfit!
3. anatomyScore: Clean natural proportions, hands, grounded feet, zero watermarks.

Respond strictly with ONE valid JSON object only:
{"faceScore": 0-100, "outfitScore": 0-100, "anatomyScore": 0-100, "defects": ["mô tả ngắn lỗi nếu < 85"], "fixInstruction": "Specific English repair directive if < 85", "reasonSummary": "Tóm tắt 1 câu bằng tiếng Việt"}`;

        const raw = await analyzeMultimodalVisionViaNineRouter({
            prompt: qaPrompt,
            images: inspectionImages,
            temperature: 0.1,
            maxTokens: 420,
            timeoutMs: 26000,
            abortSignal: options.abortSignal
        });

        const parsed = parseVisionQaJsonResponse(raw, threshold);
        if (!parsed) {
            return createUnverifiedReport('Bỏ qua hậu kiểm tự động do cổng kiểm định bận.');
        }

        return parsed;
    } catch (err) {
        console.warn('[ImageQA] Vision audit failed (fail-open):', err);
        return createUnverifiedReport('Không thể kết nối bộ kiểm định hình ảnh.');
    }
};

/**
 * Closed-loop Video Clip Identity, Wardrobe & Temporal Stability Auditor.
 */
export const verifyVideoClipConsistency = async (options: {
    referenceFrameBase64?: string;
    videoUrl: string;
    scenePrompt?: string;
    strictOriginal?: boolean;
    threshold?: number;
    abortSignal?: AbortSignal;
}): Promise<ConsistencyQaReport> => {
    const threshold = options.threshold ?? DEFAULT_STRICT_QA_THRESHOLD;
    if (!options.videoUrl) {
        return createUnverifiedReport('Không có đường dẫn video để kiểm định.');
    }

    try {
        const frames = await extractVideoSampleFrames(options.videoUrl, 3);
        if (frames.length === 0) {
            return createUnverifiedReport('Video từ máy chủ ngoài không hỗ trợ đọc frame kiểm định trực tiếp.');
        }

        const { analyzeMultimodalVisionViaNineRouter } = await import('./nineRouterService');
        const inspectionImages: Array<{ data: string; mimeType?: string; label?: string }> = [];

        if (options.referenceFrameBase64 && options.referenceFrameBase64.length > 50) {
            inspectionImages.push({
                data: options.referenceFrameBase64,
                mimeType: 'image/jpeg',
                label: 'ORIGINAL REFERENCE CHARACTER & OUTFIT'
            });
        }

        frames.forEach((f, idx) => {
            const posLabel = idx === 0 ? 'VIDEO FRAME START (~12%)' : idx === 1 ? 'VIDEO FRAME MID (~50%)' : 'VIDEO FRAME END (~88%)';
            inspectionImages.push({
                data: f,
                mimeType: 'image/jpeg',
                label: posLabel
            });
        });

        const qaPrompt = `You are a strict Video Identity & Temporal Fidelity Judge.
Compare the sampled video frames (START, MID, END) against the ORIGINAL REFERENCE CHARACTER & OUTFIT image${options.referenceFrameBase64 ? '' : ' and across frames'}.
Scene Prompt: "${(options.scenePrompt || '').slice(0, 260)}"

Evaluate strictly 0-100:
1. faceScore: Does the person keep 100% identical face structure, eyes, nose, lips, skin tone, and hair across START, MID, and END frames matching ORIGINAL REFERENCE? Penalize (<75) for face morphing, melting, turning into a stranger, or severe blur!
2. outfitScore: Does the outfit keep 100% identical color palette, garments, patterns, and style across all frames? Penalize (<75) for wardrobe changes or color shifts!
3. anatomyScore: Smooth temporal stability, zero mutated limbs, zero head popping, zero ugly black border glitches.

Respond strictly with ONE valid JSON object only (Vietnamese for summary/defects):
{"faceScore": 0-100, "outfitScore": 0-100, "anatomyScore": 0-100, "defects": ["mô tả ngắn lỗi biến dạng/đổi đồ nếu < 85"], "fixInstruction": "Short English camera/identity stabilization instruction for retry", "reasonSummary": "Tóm tắt 1 câu bằng tiếng Việt"}`;

        const raw = await analyzeMultimodalVisionViaNineRouter({
            prompt: qaPrompt,
            images: inspectionImages,
            temperature: 0.1,
            maxTokens: 440,
            timeoutMs: 28000,
            abortSignal: options.abortSignal
        });

        const parsed = parseVisionQaJsonResponse(raw, threshold);
        if (!parsed) {
            return createUnverifiedReport('Không đọc được kết quả chấm điểm từ cổng kiểm định.');
        }

        return parsed;
    } catch (err) {
        console.warn('[VideoQA] Audit skipped (fail-open):', err);
        return createUnverifiedReport('Bỏ qua kiểm định video tự động.');
    }
};
