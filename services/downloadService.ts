/**
 * Download Service - Handles file downloads for Web, Mobile (Android/iOS), and Electron Desktop
 * - Electron Desktop: Writes directly to user's configured custom folder (zero copy)
 * - Android/iOS: Streams chunks directly into Android MediaStore (Movies/ImageTool, Pictures/ImageTool)
 * - Web Browser: Uses standard data URL / blob download
 */

import { Capacitor } from '@capacitor/core';
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
 * Convert raw or data base64 into a Blob safely
 */
export function base64ToBlob(base64: string, defaultMime = 'image/png'): Blob {
    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    let mime = defaultMime;
    if (base64.startsWith('data:')) {
        const mimeMatch = base64.match(/^data:([^;]+);/);
        if (mimeMatch) mime = mimeMatch[1];
    }
    const byteCharacters = atob(clean);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}

/**
 * Stream binary Blob to Android MediaStore in 256KB chunks via ApkInstaller.saveMediaChunk
 * Completely bypasses IPC memory bounds and eliminates 'writeFile' errors forever!
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

        const chunkBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.includes(',') ? res.split(',')[1] : res);
            };
            reader.onerror = reject;
            reader.readAsDataURL(slice);
        });

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
 * Download base64 image or media URL to device
 * - On Native Android/iOS: Uses MediaStore (Movies/ImageTool or Pictures/ImageTool)
 * - On Electron Desktop: Saves directly to configured custom folder using electronAPI.saveFile
 * - On Web: Uses traditional data URL / blob download
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

        // Case 1: Remote HTTP/HTTPS URL (Muse, Vivix, OpenRouter, Cloudflare R2)
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

            // Fallback: Fetch in WebView and stream via native chunks
            try {
                const resp = await fetch(dataOrUrl);
                if (resp.ok) {
                    const blob = await resp.blob();
                    const actualMime = blob.type || mimeType;
                    return await streamBlobViaNativeChunks(blob, filename, actualMime);
                }
            } catch (fetchErr) {
                console.warn('[Download] WebView fetch stream failed:', fetchErr);
            }

            return downloadWeb(dataOrUrl, filename);
        }

        // Case 2: blob: URL or data: URL
        if (dataOrUrl.startsWith('blob:') || dataOrUrl.startsWith('data:')) {
            try {
                let blob: Blob;
                if (dataOrUrl.startsWith('blob:')) {
                    const resp = await fetch(dataOrUrl);
                    blob = await resp.blob();
                } else {
                    blob = base64ToBlob(dataOrUrl, mimeType);
                }
                const actualMime = blob.type || mimeType;
                return await streamBlobViaNativeChunks(blob, filename, actualMime);
            } catch (blobErr) {
                console.warn('[Download] Native chunk stream failed, falling back to web download:', blobErr);
                return downloadWeb(dataOrUrl, filename);
            }
        }

        // Case 3: Raw base64 string
        try {
            const blob = base64ToBlob(dataOrUrl, mimeType);
            return await streamBlobViaNativeChunks(blob, filename, mimeType);
        } catch (rawErr) {
            console.warn('[Download] Raw base64 chunk stream failed, falling back to web download:', rawErr);
            return downloadWeb(dataOrUrl, filename);
        }
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
 * Web download using traditional data URL / blob method
 */
function downloadWeb(dataOrUrl: string, filename: string): DownloadResult {
    try {
        if (dataOrUrl.startsWith('http://') || dataOrUrl.startsWith('https://')) {
            fetch(dataOrUrl)
                .then(r => r.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                })
                .catch(e => {
                    console.error('[Download] Web fetch error, attempting direct link click:', e);
                    const link = document.createElement('a');
                    link.href = dataOrUrl;
                    link.target = '_blank';
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                });

            return {
                success: true,
                message: `✅ Đang tải: ${filename}`
            };
        }

        const cleanBase64 = dataOrUrl.includes(',') ? dataOrUrl.split(',')[1] : dataOrUrl;
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const isVideo = filename.toLowerCase().endsWith('.mp4') || filename.toLowerCase().endsWith('.webm');
        const blob = new Blob([byteArray], { type: isVideo ? 'video/mp4' : 'image/png' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 60000);

        return {
            success: true,
            message: `✅ Đang tải: ${filename}`
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
