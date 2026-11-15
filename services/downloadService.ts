/**
 * Download Service - Handles file downloads for Web, Mobile (Android/iOS), and Electron Desktop
 * - Electron Desktop: Writes directly to user's configured custom folder (zero copy)
 * - Android/iOS: Streams chunks directly into Android MediaStore (Movies/ImageTool, Pictures/ImageTool)
 * - Web Browser: Uses standard data URL / blob download with Web Share API fallback for Mobile Web
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from './appUpdateService';

export interface DownloadResult {
    success: boolean;
    message: string;
    path?: string;
}

/**
 * Check if running on native mobile (Android/iOS)
 */
export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

/**
 * Check if running in Electron desktop
 */
export function isElectronPlatform(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

/**
 * Sanitize filename for safe cross-platform file saving
 */
export function sanitizeMediaFilename(name: string): string {
    if (!name || !name.trim()) return `ImageTool_${Date.now()}`;
    let clean = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
    if (clean.length > 80) {
        const dotIdx = clean.lastIndexOf('.');
        if (dotIdx > 0) {
            const ext = clean.substring(dotIdx);
            clean = clean.substring(0, Math.min(dotIdx, 75)) + ext;
        } else {
            clean = clean.substring(0, 80);
        }
    }
    return clean;
}

/**
 * Convert binary Blob into clean Base64 string without data: header
 */
export async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = (reader.result as string) || '';
            const clean = res.includes(',') ? res.split(',')[1] : res;
            resolve(clean);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Convert raw or data base64 into a Blob safely, sanitizing padding and whitespace
 */
export function base64ToBlob(base64: string, defaultMime = 'image/png'): Blob {
    if (!base64 || typeof base64 !== 'string') {
        return new Blob([], { type: defaultMime });
    }
    let mime = defaultMime;
    let clean = base64;
    if (base64.startsWith('data:')) {
        const commaIdx = base64.indexOf(',');
        if (commaIdx !== -1) {
            const header = base64.substring(0, commaIdx);
            clean = base64.substring(commaIdx + 1);
            const mimeMatch = header.match(/^data:([^;]+);/);
            if (mimeMatch) mime = mimeMatch[1];
        }
    }

    // Clean whitespace and normalize URL-safe base64 chars
    clean = clean.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4 !== 0) {
        clean += '=';
    }

    try {
        const byteCharacters = atob(clean);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([byteNumbers], { type: mime });
    } catch (e) {
        console.warn('[base64ToBlob] atob decode error, returning fallback blob:', e);
        return new Blob([], { type: mime });
    }
}

/**
 * Stream binary Blob to Android MediaStore in 256KB chunks via ApkInstaller.saveMediaChunk
 * Completely bypasses IPC memory bounds and saves directly to Movies/ImageTool or Pictures/ImageTool
 */
async function streamBlobViaNativeChunks(blob: Blob, filename: string, mimeType: string): Promise<DownloadResult> {
    if (!ApkInstaller.saveMediaChunk) {
        throw new Error('Native saveMediaChunk plugin is not available');
    }
    const CHUNK_SIZE = 256 * 1024;
    let offset = 0;
    let lastRes: any = null;

    while (offset < blob.size) {
        const nextOffset = Math.min(offset + CHUNK_SIZE, blob.size);
        const slice = blob.slice(offset, nextOffset);
        const isFirst = offset === 0;
        const isLast = nextOffset >= blob.size;

        const chunkBase64 = await blobToBase64(slice);

        lastRes = await ApkInstaller.saveMediaChunk({
            chunk: chunkBase64,
            isFirst,
            isLast,
            filename,
            mimeType
        });

        offset = nextOffset;
    }

    if (lastRes && lastRes.success) {
        return {
            success: true,
            message: lastRes.message || `✅ Đã lưu vào Bộ sưu tập`,
            path: lastRes.path
        };
    }
    throw new Error('Không thể ghi chunk vào thiết bị');
}

/**
 * Fallback saving via Capacitor Filesystem in 256KB chunks (for legacy native APK containers)
 * Bypasses Android 1MB Binder IPC limit completely!
 */
async function saveViaFilesystemFallback(blob: Blob, filename: string): Promise<DownloadResult> {
    const CHUNK_SIZE = 256 * 1024;
    const targetDir = Directory.Documents;

    // Try Documents first with sequential chunking
    try {
        for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
            const slice = blob.slice(offset, Math.min(offset + CHUNK_SIZE, blob.size));
            const chunkBase64 = await blobToBase64(slice);
            if (offset === 0) {
                await Filesystem.writeFile({
                    path: filename,
                    data: chunkBase64,
                    directory: targetDir,
                    recursive: true
                });
            } else {
                await Filesystem.appendFile({
                    path: filename,
                    data: chunkBase64,
                    directory: targetDir
                });
            }
        }
        const fileUri = await Filesystem.getUri({
            path: filename,
            directory: targetDir
        });
        return {
            success: true,
            message: `✅ Đã lưu vào Documents: ${filename}`,
            path: fileUri.uri
        };
    } catch (docErr) {
        console.warn('[Download] Filesystem Documents chunk write failed, trying Cache:', docErr);
        // Fallback to Cache directory in chunks
        for (let offset = 0; offset < blob.size; offset += CHUNK_SIZE) {
            const slice = blob.slice(offset, Math.min(offset + CHUNK_SIZE, blob.size));
            const chunkBase64 = await blobToBase64(slice);
            if (offset === 0) {
                await Filesystem.writeFile({
                    path: filename,
                    data: chunkBase64,
                    directory: Directory.Cache,
                    recursive: true
                });
            } else {
                await Filesystem.appendFile({
                    path: filename,
                    data: chunkBase64,
                    directory: Directory.Cache
                });
            }
        }
        const cacheUri = await Filesystem.getUri({
            path: filename,
            directory: Directory.Cache
        });
        return {
            success: true,
            message: `✅ Đã lưu vào bộ nhớ máy: ${filename}`,
            path: cacheUri.uri
        };
    }
}

/**
 * Download base64 image or media URL to device
 * - On Native Android/iOS: Uses MediaStore (Movies/ImageTool or Pictures/ImageTool)
 * - On Electron Desktop: Saves directly to configured custom folder using electronAPI.saveFile
 * - On Web / Mobile Web: Uses Web Share API or traditional download
 */
export async function downloadImage(dataOrUrl: string, filename: string): Promise<DownloadResult> {
    filename = sanitizeMediaFilename(filename);

    const isVideo = filename.toLowerCase().endsWith('.mp4') || filename.toLowerCase().endsWith('.webm');
    if (!filename.includes('.')) {
        filename = `${filename}.${isVideo ? 'mp4' : 'png'}`;
    }

    if (isElectronPlatform() && (window as any).electronAPI?.saveFile) {
        return downloadElectron(dataOrUrl, filename);
    } else if (isNativePlatform()) {
        const mimeType = isVideo ? 'video/mp4' : 'image/png';
        const isUrl = /^https?:\/\//i.test(dataOrUrl);

        // Case 0: Local file path or file:// URL
        if (dataOrUrl.startsWith('file://') || (dataOrUrl.startsWith('/') && !dataOrUrl.startsWith('/v1/'))) {
            try {
                const res = await ApkInstaller.saveMediaToGallery?.({
                    filePath: dataOrUrl,
                    filename,
                    mimeType
                });
                if (res && res.success) {
                    return {
                        success: true,
                        message: res.message || `✅ Đã lưu ${isVideo ? 'video' : 'ảnh'} vào Bộ sưu tập`,
                        path: res.path
                    };
                }
            } catch (err) {
                console.warn('[Download] Native filePath direct save failed:', err);
            }
        }

        // Case 1: Remote HTTP/HTTPS URL
        if (isUrl) {
            try {
                const res = await ApkInstaller.saveMediaToGallery?.({
                    url: dataOrUrl,
                    filename,
                    mimeType
                });
                if (res && res.success) {
                    return {
                        success: true,
                        message: res.message || `✅ Đã lưu ${isVideo ? 'video' : 'ảnh'} vào Bộ sưu tập`,
                        path: res.path
                    };
                }
            } catch (err) {
                console.warn('[Download] Native direct URL download failed, trying WebView fetch stream:', err);
            }
        }

        // Prepare binary Blob for streaming or filesystem fallback
        let mediaBlob: Blob | null = null;
        try {
            if (dataOrUrl.startsWith('http://') || dataOrUrl.startsWith('https://') || dataOrUrl.startsWith('blob:')) {
                const resp = await fetch(dataOrUrl);
                if (resp.ok) {
                    mediaBlob = await resp.blob();
                }
            } else {
                mediaBlob = base64ToBlob(dataOrUrl, mimeType);
            }
        } catch (fetchErr) {
            console.warn('[Download] Failed to convert input to Blob:', fetchErr);
        }

        // If we have a blob, stream to MediaStore
        if (mediaBlob && mediaBlob.size > 0) {
            const actualMime = mediaBlob.type || mimeType;

            // Priority 1: MediaStore chunk streaming (high-speed, directly in Gallery)
            try {
                return await streamBlobViaNativeChunks(mediaBlob, filename, actualMime);
            } catch (chunkErr) {
                console.warn('[Download] Native chunk stream failed, trying Filesystem fallback:', chunkErr);
            }

            // Priority 2: Capacitor Filesystem chunked fallback (works on any older APK container)
            try {
                return await saveViaFilesystemFallback(mediaBlob, filename);
            } catch (fsErr) {
                console.warn('[Download] Filesystem chunked fallback failed, falling back to web download:', fsErr);
            }
        }

        // Priority 3: Fallback web download
        return downloadWeb(dataOrUrl, filename);
    } else {
        return downloadWeb(dataOrUrl, filename);
    }
}

/**
 * Electron desktop download using native Node filesystem via IPC
 */
async function downloadElectron(dataOrUrl: string, filename: string): Promise<DownloadResult> {
    try {
        let result: any;
        if (dataOrUrl.startsWith('http://') || dataOrUrl.startsWith('https://')) {
            result = await (window as any).electronAPI.saveFile('', filename, dataOrUrl);
        } else if (dataOrUrl.startsWith('blob:')) {
            // Convert blob URL to ArrayBuffer for zero-copy write
            const blobResp = await fetch(dataOrUrl);
            const blob = await blobResp.blob();
            const arrayBuffer = await blob.arrayBuffer();
            result = await (window as any).electronAPI.saveFile(new Uint8Array(arrayBuffer), filename);
        } else {
            const cleanBase64 = dataOrUrl.includes(',') ? dataOrUrl.split(',')[1] : dataOrUrl;
            result = await (window as any).electronAPI.saveFile(cleanBase64, filename);
        }

        if (result && result.success) {
            console.log('[Download] File saved to custom folder:', result.path);
            return {
                success: true,
                message: `✅ Đã lưu vào thư mục: ${result.path || filename}`,
                path: result.path
            };
        } else {
            console.warn('[Download] Electron saveFile returned error, falling back to web:', result?.error);
            return downloadWeb(dataOrUrl, filename);
        }
    } catch (err: any) {
        console.error('[Download] Failed to save file via Electron:', err);
        return downloadWeb(dataOrUrl, filename);
    }
}

/**
 * Web download using traditional data URL / blob method, with Web Share API for Mobile Web
 */
async function downloadWeb(dataOrUrl: string, filename: string): Promise<DownloadResult> {
    try {
        let blob: Blob | null = null;
        if (dataOrUrl.startsWith('blob:') || dataOrUrl.startsWith('http://') || dataOrUrl.startsWith('https://')) {
            try {
                const resp = await fetch(dataOrUrl);
                if (resp.ok) {
                    blob = await resp.blob();
                }
            } catch (err) {
                console.warn('[downloadWeb] fetch error:', err);
            }
        } else {
            const isVideo = filename.toLowerCase().endsWith('.mp4') || filename.toLowerCase().endsWith('.webm');
            blob = base64ToBlob(dataOrUrl, isVideo ? 'video/mp4' : 'image/png');
        }

        // On mobile browsers / WebViews: Web Share API allows saving directly to device files
        if (blob && typeof navigator !== 'undefined' && (navigator as any).canShare && typeof File !== 'undefined') {
            try {
                const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
                if ((navigator as any).canShare({ files: [file] })) {
                    await (navigator as any).share({
                        files: [file],
                        title: filename,
                        text: `Lưu ${filename}`
                    });
                    return {
                        success: true,
                        message: `✅ Đã mở trình lưu/chia sẻ tệp: ${filename}`
                    };
                }
            } catch (shareErr: any) {
                if (shareErr.name === 'AbortError') {
                    return { success: true, message: `Đã hủy lưu tệp.` };
                }
                console.warn('[downloadWeb] navigator.share failed, fallback to anchor click:', shareErr);
            }
        }

        // Desktop and standard anchor fallback
        const objectUrl = blob ? URL.createObjectURL(blob) : dataOrUrl;
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (blob) {
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        }

        return {
            success: true,
            message: `✅ Đã tải: ${filename}`
        };
    } catch (error: any) {
        console.error('[Download] Web download failed:', error);
        return {
            success: false,
            message: `Lỗi tải tệp: ${error.message || 'Unknown error'}`
        };
    }
}

/**
 * Download multiple images
 */
export async function downloadImages(images: { base64: string; filename: string }[]): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];

    for (let i = 0; i < images.length; i++) {
        const { base64, filename } = images[i];
        const result = await downloadImage(base64, filename);
        results.push(result);

        // Small delay between downloads to avoid overwhelming the system
        if (i < images.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}
