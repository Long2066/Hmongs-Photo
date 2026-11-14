/**
 * Video Merge Service
 * Tự động ghép nối tuần tự N video phân cảnh (từ Cảnh 1 đến Cảnh N) thành 1 video hoàn chỉnh duy nhất.
 * Tương thích 100% trên Web, Electron Desktop và Android APK (Capacitor Webview).
 */

export interface MergeVideosOptions {
    videoUrls: string[];
    aspectRatio?: '16:9' | '9:16' | '1:1';
    targetWidth?: number;
    targetHeight?: number;
    fps?: number;
    onProgress?: (status: string) => void;
}

export async function mergeVideos({
    videoUrls,
    aspectRatio = '16:9',
    fps = 30,
    onProgress
}: MergeVideosOptions): Promise<string> {
    if (!videoUrls || videoUrls.length === 0) {
        throw new Error('Không có video nào để ghép.');
    }

    // Nếu chỉ có 1 video, trả về ngay lập tức không cần ghép
    if (videoUrls.length === 1) {
        return videoUrls[0];
    }

    onProgress?.(`Bắt đầu ghép nối ${videoUrls.length} phân cảnh...`);

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

    // Xác định định dạng ghi tương thích tốt nhất
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

    const completionPromise = new Promise<string>((resolve, reject) => {
        mediaRecorder.onstop = () => {
            try {
                const finalBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/mp4' });
                const finalUrl = URL.createObjectURL(finalBlob);
                resolve(finalUrl);
            } catch (err) {
                reject(err);
            } finally {
                if (audioCtx && audioCtx.state !== 'closed') {
                    audioCtx.close().catch(() => {});
                }
            }
        };
        mediaRecorder.onerror = (e) => {
            reject(new Error('Lỗi trong quá trình ghi ghép video: ' + String(e)));
        };
    });

    mediaRecorder.start(200); // chunk mỗi 200ms

    // Lần lượt phát và vẽ từng video từ 1 đến N
    for (let i = 0; i < videoUrls.length; i++) {
        const url = videoUrls[i];
        onProgress?.(`Đang ghép phân cảnh ${i + 1}/${videoUrls.length}...`);

        await new Promise<void>((resolveClip) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.src = url;
            video.playsInline = true;
            video.muted = false; // bật âm thanh nếu có
            video.preload = 'auto';

            let animationFrameId: number;
            let audioSource: MediaElementAudioSourceNode | null = null;

            const cleanup = () => {
                cancelAnimationFrame(animationFrameId);
                video.pause();
                video.removeAttribute('src');
                video.load();
                if (audioSource) {
                    try { audioSource.disconnect(); } catch {}
                }
            };

            const drawLoop = () => {
                if (!video.paused && !video.ended) {
                    ctx.drawImage(video, 0, 0, width, height);
                    animationFrameId = requestAnimationFrame(drawLoop);
                }
            };

            video.onloadedmetadata = () => {
                if (audioCtx && audioDest) {
                    try {
                        audioSource = audioCtx.createMediaElementSource(video);
                        audioSource.connect(audioDest);
                    } catch {}
                }
            };

            video.oncanplay = () => {
                video.play().then(() => {
                    drawLoop();
                }).catch(() => {
                    // Nếu lỗi play có tiếng, thử lại muted
                    video.muted = true;
                    video.play().then(() => {
                        drawLoop();
                    }).catch(() => {
                        cleanup();
                        resolveClip();
                    });
                });
            };

            video.onended = () => {
                cleanup();
                resolveClip();
            };

            video.onerror = () => {
                console.warn(`[VideoMerge] Lỗi load cảnh ${i + 1}, bỏ qua và tiếp tục`);
                cleanup();
                resolveClip();
            };

            // Timeout an toàn phòng trường hợp video bị treo
            setTimeout(() => {
                cleanup();
                resolveClip();
            }, 30000); // tối đa 30s mỗi clip
        });
    }

    onProgress?.('Đang kết xuất video hoàn chỉnh...');
    mediaRecorder.stop();

    return completionPromise;
}
