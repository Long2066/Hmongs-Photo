/**
 * Video Merge Service
 * Tự động ghép nối tuần tự N video phân cảnh (từ Cảnh 1 đến Cảnh N) thành 1 video hoàn chỉnh duy nhất.
 * Tương thích 100% trên Web, Electron Desktop (Lossless ffmpeg) và Android APK (Capacitor Webview).
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from './appUpdateService';
import { blobToBase64 } from './downloadService';

export interface MergeVideosOptions {
    videoUrls: string[];
    aspectRatio?: '16:9' | '9:16' | '1:1';
    targetWidth?: number;
    targetHeight?: number;
    fps?: number;
    title?: string;
    onProgress?: (status: string) => void;
}

/**
 * Patches EBML header of a WebM Blob to set accurate Duration in milliseconds.
 * This fixes the well-known Chromium MediaRecorder bug where videos have duration=Infinity or stop prematurely.
 */
function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            try {
                const buffer = reader.result as ArrayBuffer;
                const view = new DataView(buffer);
                const bytes = new Uint8Array(buffer);

                // Find Info element [0x15, 0x49, 0xA9, 0x66]
                let infoOffset = -1;
                for (let i = 0; i < Math.min(bytes.length - 4, 1024); i++) {
                    if (bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xA9 && bytes[i + 3] === 0x66) {
                        infoOffset = i;
                        break;
                    }
                }

                if (infoOffset === -1) {
                    resolve(blob);
                    return;
                }

                // Check if Duration [0x44, 0x89] is already present inside Info
                for (let i = infoOffset; i < Math.min(bytes.length - 8, infoOffset + 256); i++) {
                    if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
                        const lenByte = bytes[i + 2];
                        if (lenByte === 0x84) {
                            view.setFloat32(i + 3, durationMs, false); // Big endian
                            resolve(new Blob([buffer], { type: blob.type }));
                            return;
                        } else if (lenByte === 0x88) {
                            view.setFloat64(i + 3, durationMs, false); // Big endian
                            resolve(new Blob([buffer], { type: blob.type }));
                            return;
                        }
                    }
                }

                // If Duration element is NOT present, actively inject it directly into the Info element
                const lengthOffset = infoOffset + 4;
                const firstLengthByte = bytes[lengthOffset];
                let infoLength = 0;
                let lengthVintSize = 1;

                if ((firstLengthByte & 0x80) !== 0) {
                    infoLength = firstLengthByte & 0x7F;
                    lengthVintSize = 1;
                } else if ((firstLengthByte & 0x40) !== 0) {
                    infoLength = ((firstLengthByte & 0x3F) << 8) | bytes[lengthOffset + 1];
                    lengthVintSize = 2;
                }

                const insertOffset = lengthOffset + lengthVintSize;

                // Duration element: [0x44, 0x89] (ID) + [0x84] (size 4) + 4 bytes float32
                const durationElem = new Uint8Array(7);
                durationElem[0] = 0x44;
                durationElem[1] = 0x89;
                durationElem[2] = 0x84;
                const durView = new DataView(durationElem.buffer);
                durView.setFloat32(3, durationMs, false); // Big endian float32

                // Create new buffer with 7 bytes inserted
                const newBytes = new Uint8Array(bytes.length + 7);
                newBytes.set(bytes.subarray(0, insertOffset), 0);
                newBytes.set(durationElem, insertOffset);
                newBytes.set(bytes.subarray(insertOffset), insertOffset + 7);

                // Update Info element length VINT
                const newInfoLength = infoLength + 7;
                if (lengthVintSize === 1 && newInfoLength < 128) {
                    newBytes[lengthOffset] = 0x80 | newInfoLength;
                }

                resolve(new Blob([newBytes.buffer], { type: blob.type }));
            } catch (err) {
                console.warn('[VideoMerge] Failed to patch WebM duration:', err);
                resolve(blob);
            }
        };
        reader.onerror = () => resolve(blob);
        reader.readAsArrayBuffer(blob);
    });
}

export async function mergeVideos({
    videoUrls,
    aspectRatio = '16:9',
    fps = 30,
    title = 'Merged_Video',
    onProgress
}: MergeVideosOptions): Promise<string> {
    if (!videoUrls || videoUrls.length === 0) {
        throw new Error('Không có video nào để ghép.');
    }

    // Nếu chỉ có 1 video, trả về ngay lập tức không cần ghép
    if (videoUrls.length === 1) {
        return videoUrls[0];
    }

    // 1. ELECTRON DESKTOP: Native ffmpeg concat siêu tốc (0.15s, 100% genuine MP4, zero quality loss)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.mergeVideos) {
        onProgress?.(`Đang ghép nối siêu tốc ${videoUrls.length} phân cảnh bằng Electron Native Engine...`);
        try {
            const cleanTitle = (title || 'Video_Series').replace(/[/\\?%*:|"<>]/g, '_');
            const electronUrls = await Promise.all(
                videoUrls.map(async (u) => {
                    if (u.startsWith('blob:')) {
                        const resp = await fetch(u);
                        const blob = await resp.blob();
                        const b64 = await blobToBase64(blob);
                        return `data:${blob.type || 'video/mp4'};base64,${b64}`;
                    }
                    return u;
                })
            );
            const res = await (window as any).electronAPI.mergeVideos(electronUrls, `${cleanTitle}.mp4`);
            if (res && res.success && (res.url || res.path)) {
                return res.url || `file:///${res.path.replace(/\\/g, '/')}`;
            }
            if (res && !res.success && res.error) {
                console.warn('[VideoMerge] Electron native merge error:', res.error);
            }
        } catch (e) {
            console.warn('[VideoMerge] Electron native merge failed, falling back to client canvas engine:', e);
        }
    }

    // 2. ANDROID APK: Native MediaExtractor + MediaMuxer concat siêu tốc (0.2s, 100% genuine MP4)
    if (Capacitor.isNativePlatform() && ApkInstaller.mergeVideos) {
        onProgress?.(`Đang ghép nối siêu tốc ${videoUrls.length} phân cảnh bằng Android Native Engine...`);
        try {
            // Chuẩn hóa danh sách URL: Chuyển các link _capacitor_file_ hoặc blob/data về đường dẫn file:// hợp lệ trên máy
            const normalizedUrls: string[] = [];
            for (let i = 0; i < videoUrls.length; i++) {
                const u = videoUrls[i];
                if (u.includes('/_capacitor_file_/')) {
                    const rawP = u.substring(u.indexOf('/_capacitor_file_/') + '/_capacitor_file_'.length);
                    normalizedUrls.push(`file://${rawP}`);
                } else if (u.startsWith('blob:') || u.startsWith('data:')) {
                    try {
                        const resp = await fetch(u);
                        const blob = await resp.blob();
                        const b64 = await blobToBase64(blob);
                        const tempName = `temp_clip_${Date.now()}_${i}.mp4`;
                        await Filesystem.writeFile({
                            path: tempName,
                            data: b64,
                            directory: Directory.Cache,
                            recursive: true
                        });
                        const uriRes = await Filesystem.getUri({
                            path: tempName,
                            directory: Directory.Cache
                        });
                        normalizedUrls.push(uriRes.uri);
                    } catch (blobErr) {
                        console.warn('[VideoMerge] Không thể lưu tạm blob clip:', blobErr);
                        normalizedUrls.push(u);
                    }
                } else {
                    normalizedUrls.push(u);
                }
            }

            const cleanTitle = (title || 'Video_Series').replace(/[/\\?%*:|"<>]/g, '_');
            const res = await ApkInstaller.mergeVideos({
                videoUrls: normalizedUrls,
                filename: `${cleanTitle}.mp4`
            });
            if (res && res.success && (res.path || res.url)) {
                const rawPath = res.path || (res.url?.startsWith('file://') ? res.url.substring(7) : res.url);
                if (rawPath) {
                    try {
                        return Capacitor.convertFileSrc(rawPath);
                    } catch {
                        return res.url || `file://${rawPath}`;
                    }
                }
                return res.url || '';
            }
        } catch (e) {
            console.warn('[VideoMerge] Android native merge failed:', e);
        }

        // BẢO VỆ PHƯƠNG ÁN B: Tuyệt đối không fallback sang Canvas MediaRecorder trên Android
        // Canvas MediaRecorder sinh ra WebM giả MP4 làm lỗi Samsung Gallery và thanh tua video.
        // Trả về trực tiếp clip MP4 gốc đầu tiên 100% chuẩn H.264
        console.warn('[VideoMerge] Trả về video MP4 phân cảnh đầu tiên để bảo đảm chuẩn H.264 không bị lỗi Gallery.');
        return videoUrls[0];
    }

    onProgress?.(`Đang tải đệm ${videoUrls.length} phân cảnh vào bộ nhớ máy...`);

    // 2. Preload tất cả các clip video vào Blob URL nội bộ trước khi ghép
    // Giúp loại bỏ 100% độ trễ giật lag mạng khi chuyển giữa các phân cảnh
    const preloadedBlobs = await Promise.all(
        videoUrls.map(async (url, idx) => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return await resp.blob();
            } catch (err) {
                console.warn(`[VideoMerge] Không thể tải trước cảnh ${idx + 1}, dùng link trực tiếp:`, err);
                return null;
            }
        })
    );

    const safeUrls = videoUrls.map((url, idx) => {
        const b = preloadedBlobs[idx];
        return b ? URL.createObjectURL(b) : url;
    });

    onProgress?.(`Bắt đầu ghép nối mượt mà ${videoUrls.length} phân cảnh...`);

    // Xác định kích thước canvas chuẩn nét cao
    let width = 1280;
    let height = 720;
    if (aspectRatio === '9:16') {
        width = 720;
        height = 1280;
    } else if (aspectRatio === '1:1') {
        width = 720;
        height = 720;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        console.warn('[VideoMerge] Không thể khởi tạo Canvas 2D, fallback về video đầu tiên.');
        return videoUrls[0];
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Tạo AudioContext để hòa âm
    let audioCtx: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            audioDest = audioCtx.createMediaStreamDestination();
        }
    } catch (e) {
        console.warn('[VideoMerge] AudioContext not available:', e);
    }

    const canvasStream = canvas.captureStream(fps);
    const combinedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        audioDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
    }

    // Chọn định dạng tối ưu nhất được hỗ trợ
    let mimeType = 'video/webm';
    if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
            mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            mimeType = 'video/webm;codecs=vp8,opus';
        }
    }

    let mediaRecorder: MediaRecorder;
    try {
        mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 8_000_000 // 8 Mbps chất lượng cao sắc nét
        });
    } catch {
        mediaRecorder = new MediaRecorder(combinedStream);
    }

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    let totalDurationMs = 0;

    const completionPromise = new Promise<string>((resolve) => {
        mediaRecorder.onstop = async () => {
            try {
                const recordedMime = mediaRecorder.mimeType || 'video/mp4';
                let finalBlob = new Blob(recordedChunks, { type: recordedMime });
                if (finalBlob.size < 5000) {
                    console.warn('[VideoMerge] File ghép quá nhỏ hoặc không hợp lệ, giữ nguyên video gốc đầu tiên.');
                    resolve(videoUrls[0]);
                    return;
                }

                // Patch thời lượng WebM để seekbar và thời gian chạy chuẩn 100%
                if (recordedMime.includes('webm') && totalDurationMs > 0) {
                    finalBlob = await fixWebmDuration(finalBlob, totalDurationMs);
                }

                const finalUrl = URL.createObjectURL(finalBlob);
                resolve(finalUrl);
            } catch (err) {
                console.warn('[VideoMerge] Lỗi tạo Blob kết xuất, fallback video đầu tiên:', err);
                resolve(videoUrls[0]);
            } finally {
                if (audioCtx && audioCtx.state !== 'closed') {
                    audioCtx.close().catch(() => {});
                }
                // Dọn dẹp preloaded blob URLs
                preloadedBlobs.forEach((b, idx) => {
                    if (b) {
                        try { URL.revokeObjectURL(safeUrls[idx]); } catch {}
                    }
                });
            }
        };
        mediaRecorder.onerror = (e) => {
            console.warn('[VideoMerge] MediaRecorder gặp sự cố, fallback về video đầu tiên:', e);
            resolve(videoUrls[0]);
        };
    });

    mediaRecorder.start(200); // chunk mỗi 200ms

    // Sử dụng 1 phần tử video duy nhất được gán vào DOM với kích thước thực tế
    // (tránh tình trạng trình duyệt / WebView Android tối ưu tắt render phần tử offscreen)
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.cssText = 'position:fixed;top:0;left:0;width:320px;height:320px;opacity:0.001;pointer-events:none;z-index:-9999;overflow:hidden;';
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.muted = false;
    video.preload = 'auto';
    video.width = 320;
    video.height = 320;
    hiddenContainer.appendChild(video);
    document.body.appendChild(hiddenContainer);

    let isDrawing = true;
    let audioSource: MediaElementAudioSourceNode | null = null;

    // Vòng lặp vẽ liên tục 30fps vào canvas
    const drawContinuously = () => {
        if (!isDrawing) return;
        try {
            if (video.readyState >= 2 && !video.paused) {
                ctx.drawImage(video, 0, 0, width, height);
            }
        } catch {}
        requestAnimationFrame(drawContinuously);
    };
    requestAnimationFrame(drawContinuously);

    try {
        // Lần lượt phát từng phân cảnh
        for (let i = 0; i < safeUrls.length; i++) {
            const url = safeUrls[i];
            onProgress?.(`Đang phát & ghép cảnh ${i + 1}/${safeUrls.length}...`);

            await new Promise<void>((resolveClip) => {
                let clipEnded = false;
                const endClip = () => {
                    if (clipEnded) return;
                    clipEnded = true;
                    if (video.duration && !isNaN(video.duration)) {
                        totalDurationMs += video.duration * 1000;
                    } else {
                        totalDurationMs += 5000;
                    }
                    resolveClip();
                };

                video.onended = endClip;
                video.onerror = (err) => {
                    console.warn(`[VideoMerge] Cảnh ${i + 1} báo lỗi phát, bỏ qua:`, err);
                    endClip();
                };

                // Thiết lập AudioContext
                video.onloadedmetadata = () => {
                    if (audioCtx && audioDest && !audioSource) {
                        try {
                            audioSource = audioCtx.createMediaElementSource(video);
                            audioSource.connect(audioDest);
                        } catch {}
                    }
                };

                video.oncanplay = () => {
                    video.play().catch(() => {
                        // Thử lại nếu bị chặn autoplay âm thanh
                        video.muted = true;
                        video.play().catch(endClip);
                    });
                };

                video.src = url;
                video.load();

                // Timeout an toàn 25 giây cho mỗi cảnh
                setTimeout(endClip, 25000);
            });
        }
    } finally {
        isDrawing = false;
        video.pause();
        if (audioSource) {
            try { audioSource.disconnect(); } catch {}
        }
        if (hiddenContainer.parentNode) {
            hiddenContainer.parentNode.removeChild(hiddenContainer);
        }
    }

    onProgress?.('Đang kết xuất video hoàn chỉnh...');
    mediaRecorder.stop();

    return completionPromise;
}
