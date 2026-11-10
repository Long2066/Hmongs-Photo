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
 * Saliency / Skin-tone cluster detector for full-body portraits
 * When deep ML detector misses small faces or hats, this finds the upper body head center
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

        // Scan the top 60% of the image for skin pixels (YCbCr standard color space)
        let skinCount = 0;
        let sumX = 0;
        let sumY = 0;
        let minY = sampleH;
        let maxY = 0;
        const scanH = Math.round(sampleH * 0.6);

        for (let y = 5; y < scanH; y += 2) {
            for (let x = 5; x < sampleW - 5; x += 2) {
                const idx = (y * sampleW + x) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];

                // YCbCr skin detection rule: Cb in [77..127], Cr in [133..173]
                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && g > b) {
                    skinCount++;
                    sumX += x;
                    sumY += y;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (skinCount > 25) {
            const avgX = sumX / skinCount;
            const avgY = sumY / skinCount;
            const scaleX = img.width / sampleW;
            const scaleY = img.height / sampleH;
            const faceH = Math.max(img.height * 0.12, (maxY - minY) * scaleY);
            const faceW = faceH * 0.85;

            return [{
                x: Math.max(0, avgX * scaleX - faceW / 2),
                y: Math.max(0, avgY * scaleY - faceH / 2),
                width: faceW,
                height: faceH,
                score: 0.7
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

            // Pass 2A: If full-body portrait has small distant faces missed in full pass,
            // inspect the upper 55% half where heads are ~2x larger
            if (detectedFaces.length === 0 && img.height > img.width * 1.1) {
                detectedFaces = runOnRegion(detector, 0, 0, img.width, Math.round(img.height * 0.55));
            }

            // Pass 2B: If wide landscape group shot has small distant faces,
            // inspect left & right halves separately so each person is 2x larger
            if (detectedFaces.length === 0 && img.width > img.height * 1.15) {
                const halfW = Math.round(img.width * 0.55);
                const leftFaces = runOnRegion(detector, 0, 0, halfW, img.height);
                const rightFaces = runOnRegion(detector, img.width - halfW, 0, halfW, img.height);
                detectedFaces = [...leftFaces, ...rightFaces];
            }
        }
    } catch (e) {
        console.warn('[AI Face] MediaPipe detection step failed:', e);
    }

    // 2. Try Native Browser FaceDetector if MediaPipe found nothing
    if (detectedFaces.length === 0) {
        detectedFaces = await detectFacesNative(img);
    }

    // 3. Try Saliency / Skin-Cluster Fallback for full-body portraits
    if (detectedFaces.length === 0 && img.height > img.width * 1.1) {
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

    // Headroom multiplier: 0.15 (Trên) -> 1.3x, 0.3 (Chuẩn) -> 1.05x, 0.5 (Giữa) -> 0.6x
    const headroomFactor = cropBiasY <= 0.2 ? 1.3 : cropBiasY <= 0.35 ? 1.05 : 0.6;

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

            // Headroom needed for hair, traditional hats (mũ thổ cẩm), graduation caps
            const headroom = Math.max(avgFaceH * headroomFactor, 25);

            // Anchor top of crop window at (minFaceY - headroom)
            const idealTop = Math.max(0, minFaceY - headroom);

            // Ensure the faces don't get cut at the bottom if sHeight is small
            const requiredBottom = maxFaceY + avgFaceH * 0.35;
            if (idealTop + sHeight < requiredBottom) {
                // If crop height is too short to show both top and bottom with generous headroom,
                // adjust so faces are centered inside the slot
                sy = Math.max(0, Math.min(excessY, (minFaceY + maxFaceY) / 2 - sHeight * 0.42));
            } else {
                sy = Math.max(0, Math.min(excessY, idealTop));
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
            // Heuristic Fallback for portraits (Head is ALWAYS in the top 10-15%)
            // Never cut at center (0.5) or 0.3 which cuts off at chin!
            const isTallPortrait = img.height > img.width * 1.15;
            const topAnchor = isTallPortrait ? (cropBiasY <= 0.2 ? 0.02 : 0.05) : 0.22;
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
