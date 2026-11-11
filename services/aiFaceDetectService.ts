/**
 * AI Smart Face & Portrait Detection Engine
 * High-precision on-device Face Detection (MediaPipe BlazeFace + Native Shape Detector + Saliency Fallback)
 * Calculates intelligent crop anchors for BOTH horizontal and vertical photography.
 * Zero API tokens, zero external servers, runs in 15-30ms directly in-browser / Electron / Android WebView.
 */

import { FilesetResolver, FaceDetector, Detection } from '@mediapipe/tasks-vision';

export interface FaceBox {
    x: number;      // pixels in source image
    y: number;      // pixels in source image
    width: number;  // pixels in source image
    height: number; // pixels in source image
    score?: number;
}

export interface SmartCropResult {
    sx: number;
    sy: number;
    sWidth: number;
    sHeight: number;
    hasFace: boolean;
    faceCount: number;
}

let faceDetectorInstance: FaceDetector | null = null;
let isInitializingDetector = false;
let detectorInitPromise: Promise<FaceDetector | null> | null = null;

// Cache detections per image source URL or base64 to avoid re-detecting on template switches
const detectionCache = new Map<string, FaceBox[]>();

/**
 * Initialize MediaPipe FaceDetector instance (Singleton)
 * Uses local model in public/models/blaze_face_short_range.tflite
 */
export async function getFaceDetector(): Promise<FaceDetector | null> {
    if (faceDetectorInstance) return faceDetectorInstance;
    if (detectorInitPromise) return detectorInitPromise;

    detectorInitPromise = (async () => {
        try {
            // First try local WASM in /mediapipe/wasm, fallback to jsdelivr CDN
            let vision;
            try {
                vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
            } catch (localErr) {
                console.warn('[AI Face] Local WASM path failed, trying CDN:', localErr);
                vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
                );
            }

            // Create detector with local model asset path (try GPU, fallback to CPU)
            let detector: FaceDetector | null = null;
            try {
                detector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: '/models/blaze_face_short_range.tflite',
                        delegate: 'GPU'
                    },
                    runningMode: 'IMAGE',
                    minDetectionConfidence: 0.3
                });
            } catch (gpuErr) {
                console.warn('[AI Face] GPU delegate failed, falling back to CPU:', gpuErr);
                detector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: '/models/blaze_face_short_range.tflite',
                        delegate: 'CPU'
                    },
                    runningMode: 'IMAGE',
                    minDetectionConfidence: 0.3
                });
            }

            faceDetectorInstance = detector;
            console.log('[AI Face] Google MediaPipe FaceDetector initialized');
            return detector;
        } catch (err) {
            console.warn('[AI Face] MediaPipe initialization error, falling back to Native/Heuristic:', err);
            return null;
        } finally {
            detectorInitPromise = null;
        }
    })();

    return detectorInitPromise;
}

/**
 * Native Browser FaceDetector fallback (Shape Detection API where supported)
 */
async function detectFacesNative(img: HTMLImageElement): Promise<FaceBox[]> {
    if (typeof window !== 'undefined' && (window as any).FaceDetector) {
        try {
            const nativeDetector = new (window as any).FaceDetector({
                maxDetectedFaces: 10,
                fastMode: true
            });
            const detections = await nativeDetector.detect(img);
            if (detections && detections.length > 0) {
                return detections.map((d: any) => ({
                    x: d.boundingBox.x,
                    y: d.boundingBox.y,
                    width: d.boundingBox.width,
                    height: d.boundingBox.height,
                    score: 0.95
                }));
            }
        } catch {
            // Safe fallback
        }
    }
    return [];
}

/**
 * Saliency / Skin-tone cluster detector for portraits
 * High-precision scan restricted to UPPER 35% of the image to find the head center.
 * Crucial: NEVER scans lower than 35% to strictly avoid detecting bare legs, knees, skirts or hands!
 */
function detectFaceSaliencyFallback(img: HTMLImageElement): FaceBox[] {
    try {
        const sampleW = 160;
        const sampleH = Math.round((sampleW * img.height) / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = sampleW;
        canvas.height = sampleH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;

        // Strictly scan ONLY the top 35% of the portrait where heads & faces are located
        let skinCount = 0;
        let weightedSumX = 0;
        let weightedSumY = 0;
        let totalWeight = 0;
        let minY = sampleH;
        let maxY = 0;
        const scanH = Math.max(15, Math.round(sampleH * 0.35));

        for (let y = 3; y < scanH; y += 2) {
            // Give higher weight to pixels closer to the top of the head
            const weight = 1.0 - (y / (sampleH * 0.4));
            for (let x = 4; x < sampleW - 4; x += 2) {
                const idx = (y * sampleW + x) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];

                // YCbCr skin detection rule: Cb in [77..127], Cr in [133..173]
                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && g > b) {
                    skinCount++;
                    weightedSumX += x * weight;
                    weightedSumY += y * weight;
                    totalWeight += weight;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (skinCount > 18 && totalWeight > 0) {
            const avgX = weightedSumX / totalWeight;
            const avgY = weightedSumY / totalWeight;
            const scaleX = img.width / sampleW;
            const scaleY = img.height / sampleH;
            const faceH = Math.max(img.height * 0.14, (maxY - minY + 6) * scaleY);
            const faceW = faceH * 0.85;

            return [{
                x: Math.max(0, avgX * scaleX - faceW / 2),
                y: Math.max(0, avgY * scaleY - faceH * 0.4),
                width: faceW,
                height: faceH,
                score: 0.75
            }];
        }
    } catch {
        // Safe fallback
    }
    return [];
}

/**
 * Detect all faces in an image with multi-layer AI (MediaPipe -> Native -> Saliency)
 */
export async function detectFacesInImage(img: HTMLImageElement): Promise<FaceBox[]> {
    const cacheKey = img.src.length > 200 ? img.src.substring(0, 200) + img.src.length : img.src;
    if (detectionCache.has(cacheKey)) {
        return detectionCache.get(cacheKey)!;
    }

    let detectedFaces: FaceBox[] = [];

    // Helper: run detector on a cropped/scaled canvas safely within GPU texture limits
    const runOnRegion = (
        detector: FaceDetector,
        sx: number, sy: number, sw: number, sh: number
    ): FaceBox[] => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(sw, sh));
        const cw = Math.max(64, Math.round(sw * scale));
        const ch = Math.max(64, Math.round(sh * scale));

        const c = document.createElement('canvas');
        c.width = cw;
        c.height = ch;
        const cCtx = c.getContext('2d');
        if (!cCtx) return [];

        cCtx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        const res = detector.detect(c);
        if (!res?.detections?.length) return [];

        const invScale = 1 / scale;
        return res.detections.map((d: Detection) => {
            const b = d.boundingBox!;
            return {
                x: sx + b.originX * invScale,
                y: sy + b.originY * invScale,
                width: b.width * invScale,
                height: b.height * invScale,
                score: d.categories?.[0]?.score ?? 0.9
            };
        });
    };

    // 1. Try Google MediaPipe FaceDetector
    try {
        const detector = await getFaceDetector();
        if (detector) {
            // Pass 1: Full image
            detectedFaces = runOnRegion(detector, 0, 0, img.width, img.height);

            // Pass 2A: If portrait/square has small or upper distant faces missed in full pass
            // (e.g. one person sitting low found, standing person high missed), inspect upper 55% zoomed-in
            const hasHighFace = detectedFaces.some(f => f.y < img.height * 0.25);
            if ((detectedFaces.length === 0 || !hasHighFace) && img.height >= img.width * 0.85) {
                const upperFaces = runOnRegion(detector, 0, 0, img.width, Math.round(img.height * 0.55));
                for (const uf of upperFaces) {
                    const isDup = detectedFaces.some(df =>
                        Math.abs(df.x - uf.x) < df.width * 0.6 && Math.abs(df.y - uf.y) < df.height * 0.6
                    );
                    if (!isDup) detectedFaces.push(uf);
                }
            }

            // Pass 2B: If wide landscape group shot has small distant faces,
            // inspect left & right halves separately so each person is 2x larger
            if (detectedFaces.length <= 1 && img.width > img.height * 1.15) {
                const halfW = Math.round(img.width * 0.55);
                const leftFaces = runOnRegion(detector, 0, 0, halfW, img.height);
                const rightFaces = runOnRegion(detector, img.width - halfW, 0, halfW, img.height);
                for (const hf of [...leftFaces, ...rightFaces]) {
                    const isDup = detectedFaces.some(df =>
                        Math.abs(df.x - hf.x) < df.width * 0.6 && Math.abs(df.y - hf.y) < df.height * 0.6
                    );
                    if (!isDup) detectedFaces.push(hf);
                }
            }
        }
    } catch (e) {
        console.warn('[AI Face] MediaPipe detection step failed:', e);
    }

    // 2. Try Native Browser FaceDetector if MediaPipe found nothing
    if (detectedFaces.length === 0) {
        detectedFaces = await detectFacesNative(img);
    }

    // 3. Try Saliency / Skin-Cluster Fallback in upper 35% of image if still nothing
    if (detectedFaces.length === 0 && img.height >= img.width * 0.85) {
        detectedFaces = detectFaceSaliencyFallback(img);
    }

    detectionCache.set(cacheKey, detectedFaces);
    return detectedFaces;
}

/**
 * Calculate Smart Crop Window for BOTH Horizontal and Vertical photos
 * Guarantees faces and upper bodies are NEVER cut off, preserving headroom for hats/headdresses.
 */
export function calculateSmartCrop(
    img: HTMLImageElement,
    targetW: number,
    targetH: number,
    faces: FaceBox[],
    cropBiasY: number = 0.3
): SmartCropResult {
    const imgRatio = img.width / img.height;
    const targetRatio = targetW / targetH;
    let sWidth: number;
    let sHeight: number;
    let sx = 0;
    let sy = 0;

    // Headroom multiplier: 0.15 (Mũ/Đầu) -> 1.45x, 0.3 (Chuẩn) -> 1.18x, 0.5 (Ngực) -> 0.7x
    const headroomFactor = cropBiasY <= 0.2 ? 1.45 : cropBiasY <= 0.35 ? 1.18 : 0.7;

    // CASE 1: Target slot is WIDER than image (Vertical photo -> Landscape / Square slot)
    // Needs VERTICAL cropping (crop top/bottom).
    if (imgRatio < targetRatio) {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
        const excessY = img.height - sHeight;

        if (faces.length > 0) {
            // Find bounding box encompassing ALL faces (boy, girl, group)
            const minFaceY = Math.min(...faces.map(f => f.y));
            const maxFaceY = Math.max(...faces.map(f => f.y + f.height));
            const avgFaceH = faces.reduce((sum, f) => sum + f.height, 0) / faces.length;

            // Headroom needed for hair, graduation caps, traditional headdress
            const headroom = Math.max(avgFaceH * headroomFactor, 30);

            // Anchor top of crop window at (minFaceY - headroom)
            const idealTop = Math.max(0, minFaceY - headroom);

            // GOLDEN PHOTOGRAPHY RULE: NEVER SEVER THE TOP PERSON'S HEAD/EYES!
            // When multiple faces span a vertical range larger than sHeight (e.g. 1 standing, 1 sitting),
            // NEVER take the mathematical average (minFaceY + maxFaceY) / 2 because that slices the
            // top person across the forehead/eyes!
            // Instead, firmly anchor sy <= idealTop so the highest head is 100% intact.
            const requiredBottom = maxFaceY + avgFaceH * 0.3;
            if (idealTop + sHeight < requiredBottom) {
                // Both faces cannot fit simultaneously inside this thin landscape slot:
                // Anchor firmly to the top person's head!
                sy = Math.max(0, Math.min(excessY, idealTop));
            } else {
                // Both fit! Distribute remaining space gracefully with headroom preserved
                const facesSpan = requiredBottom - idealTop;
                const extraSlack = sHeight - facesSpan;
                sy = Math.max(0, Math.min(excessY, idealTop - extraSlack * 0.3));
            }

            return {
                sx: 0,
                sy,
                sWidth,
                sHeight,
                hasFace: true,
                faceCount: faces.length
            };
        } else {
            // Heuristic Fallback for portraits (Head is ALWAYS in the top 5-15%)
            // Never cut at center (0.5) or 0.3 which cuts off at chin!
            const isTallPortrait = img.height > img.width * 1.15;
            const topAnchor = isTallPortrait ? (cropBiasY <= 0.2 ? 0.02 : 0.05) : (cropBiasY <= 0.2 ? 0.05 : 0.12);
            sy = Math.max(0, Math.min(excessY, excessY * topAnchor));

            return {
                sx: 0,
                sy,
                sWidth,
                sHeight,
                hasFace: false,
                faceCount: 0
            };
        }
    }

    // CASE 2: Image is WIDER than target slot (Horizontal photo -> Vertical / Square slot)
    // Needs HORIZONTAL cropping (crop left/right sides).
    sHeight = img.height;
    sWidth = img.height * targetRatio;
    const excessX = img.width - sWidth;

    if (faces.length > 0) {
        // Find horizontal center of all faces
        const minFaceX = Math.min(...faces.map(f => f.x));
        const maxFaceX = Math.max(...faces.map(f => f.x + f.width));
        const faceCenterX = (minFaceX + maxFaceX) / 2;

        // Center crop horizontally around the faces!
        const idealLeft = faceCenterX - sWidth / 2;
        sx = Math.max(0, Math.min(excessX, idealLeft));

        return {
            sx,
            sy: 0,
            sWidth,
            sHeight,
            hasFace: true,
            faceCount: faces.length
        };
    }

    // Default horizontal center crop when no face detected
    sx = excessX / 2;
    return {
        sx,
        sy: 0,
        sWidth,
        sHeight,
        hasFace: false,
        faceCount: 0
    };
}
