/**
 * Download Service - Handles file downloads for Web, Mobile (Android/iOS), and Electron Desktop
 * - Electron Desktop: Writes directly to user's configured custom folder
 * - Android/iOS: Uses Capacitor Filesystem to save to Documents/Downloads
 * - Web Browser: Uses standard data URL / blob download
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ApkInstaller } from './appUpdateService';

interface DownloadResult {
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
 * Download base64 image or media URL to device
 * - On Native Android/iOS: Uses MediaStore (Movies/ImageTool or Pictures/ImageTool) to save directly to Gallery
 * - On Electron Desktop: Saves directly to configured custom folder using electronAPI.saveFile
 * - On Web: Uses traditional data URL / blob download
 */
export async function downloadImage(dataOrUrl: string, filename: string): Promise<DownloadResult> {
    // Ensure filename has valid media extension
    if (!filename.endsWith('.png') && !filename.endsWith('.jpg') && !filename.endsWith('.jpeg') && !filename.endsWith('.webp') && !filename.endsWith('.mp4')) {
        filename = `${filename}.png`;
    }

    if (isElectronPlatform() && (window as any).electronAPI?.saveFile) {
        return downloadElectron(dataOrUrl, filename);
    } else if (isNativePlatform()) {
        const isVideo = filename.endsWith('.mp4');
        const mimeType = isVideo ? 'video/mp4' : 'image/png';

        // 1. Try Native MediaStore downloader via ApkInstaller plugin
        try {
            const isUrl = /^https?:\/\//i.test(dataOrUrl);
            
            // Nếu là URL mạng từ xa (HTTP/HTTPS): để Java stream trực tiếp vào MediaStore, tránh ngốn RAM WebView
            if (isUrl) {
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
            } else if (dataOrUrl.startsWith('blob:') || dataOrUrl.startsWith('data:')) {
                // Nếu là Blob hoặc Data URL: Stream thẳng vào MediaStore Gallery qua native chunk writer
                const blob = dataOrUrl.startsWith('blob:')
                    ? await (await fetch(dataOrUrl)).blob()
                    : await (await fetch(dataOrUrl)).blob();

                if (ApkInstaller.saveMediaChunk) {
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
                            message: lastRes.message || `✅ Đã lưu ${isVideo ? 'video' : 'ảnh'} vào Bộ sưu tập`,
                            path: lastRes.path
                        };
                    }
                } else {
                    // Fallback nếu native app chưa có saveMediaChunk (bản cũ)
                    const payloadBase64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const res = reader.result as string;
                            resolve(res.includes(',') ? res.split(',')[1] : res);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    const res = await ApkInstaller.saveMediaToGallery?.({
                        base64: payloadBase64,
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
                }
            } else {
                // Base64 trực tiếp
                const res = await ApkInstaller.saveMediaToGallery?.({
                    base64: dataOrUrl,
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
            }
        } catch (nativeErr) {
            console.warn('[Download] Native saveMediaToGallery failed, falling back to Filesystem:', nativeErr);
        }

        // 2. Fallback to Filesystem (handles both base64, blob and https:// URLs)
        return downloadNative(dataOrUrl, filename);
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
            // Convert blob URL to ArrayBuffer/Uint8Array for fast zero-copy write
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
 * Native download using Capacitor Filesystem
 */
async function downloadNative(dataOrUrl: string, filename: string): Promise<DownloadResult> {
    try {
        // If URL or blob, fetch and convert to base64 first
        let base64Data = dataOrUrl;
        if (dataOrUrl.startsWith('http://') || dataOrUrl.startsWith('https://') || dataOrUrl.startsWith('blob:')) {
            const res = await fetch(dataOrUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const str = reader.result as string;
                    resolve(str.includes(',') ? str.split(',')[1] : str);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } else if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
        }

        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const uniqueFilename = `ToolPhoto_${timestamp}_${filename}`;

        // Lưu vào Cache directory nếu Scoped Storage trên Android 11+ hạn chế Documents
        try {
            const result = await Filesystem.writeFile({
                path: uniqueFilename,
                data: base64Data,
                directory: Directory.Cache,
                recursive: true
            });

            console.log('[Download] File saved to cache:', result.uri);

            return {
                success: true,
                message: `✅ Đã lưu tệp: ${uniqueFilename}`,
                path: result.uri
            };
        } catch (fsErr) {
            console.warn('[Download] Filesystem.writeFile fallback to web download:', fsErr);
            return downloadWeb(dataOrUrl, filename);
        }
    } catch (error: any) {
        console.error('[Download] Native download failed:', error);
        return {
            success: false,
            message: `Lỗi tải tệp: ${error.message || 'Không thể ghi file'}`
        };
    }
}

/**
 * Web download using traditional data URL / blob method
 */
function downloadWeb(dataOrUrl: string, filename: string): DownloadResult {
    try {
        if (dataOrUrl.startsWith('http://') || dataOrUrl.startsWith('https://')) {
            // Async background blob trigger
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
                .catch(e => console.error('[Download] Web fetch error:', e));

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
        const isVideo = filename.endsWith('.mp4');
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
