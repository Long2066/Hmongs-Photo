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
            let payloadBase64: string | undefined = !isUrl ? dataOrUrl : undefined;
            if (!isUrl && dataOrUrl.startsWith('blob:')) {
                const blobResp = await fetch(dataOrUrl);
                const blob = await blobResp.blob();
                payloadBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const res = reader.result as string;
                        resolve(res.includes(',') ? res.split(',')[1] : res);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }

            const res = await ApkInstaller.saveMediaToGallery?.({
                url: isUrl ? dataOrUrl : undefined,
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
            // Convert blob URL to Base64 so Node filesystem writes the real binary file
            const blobResp = await fetch(dataOrUrl);
            const blob = await blobResp.blob();
            const base64Str = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result as string;
                    resolve(res.includes(',') ? res.split(',')[1] : res);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            result = await (window as any).electronAPI.saveFile(base64Str, filename);
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
        // Request permissions first (Android requires this)
        const permResult = await Filesystem.checkPermissions();
        if (permResult.publicStorage !== 'granted') {
            const reqResult = await Filesystem.requestPermissions();
            if (reqResult.publicStorage !== 'granted') {
                return {
                    success: false,
                    message: 'Cần cấp quyền truy cập bộ nhớ để tải tệp'
                };
            }
        }

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

        // Write file to Documents directory
        const result = await Filesystem.writeFile({
            path: uniqueFilename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
        });

        console.log('[Download] File saved to:', result.uri);

        return {
            success: true,
            message: `✅ Đã lưu: ${uniqueFilename}`,
            path: result.uri
        };
    } catch (error: any) {
        console.error('[Download] Native download failed:', error);

        // Fallback: try saving to cache
        try {
            const timestamp = Date.now();
            const uniqueFilename = `ToolPhoto_${timestamp}_${filename}`;

            let fallbackData = dataOrUrl;
            if (fallbackData.includes(',')) fallbackData = fallbackData.split(',')[1];

            const result = await Filesystem.writeFile({
                path: uniqueFilename,
                data: fallbackData,
                directory: Directory.Cache
            });

            return {
                success: true,
                message: `✅ Đã lưu vào cache: ${uniqueFilename}`,
                path: result.uri
            };
        } catch (fallbackError) {
            return {
                success: false,
                message: `Lỗi tải tệp: ${error.message || 'Unknown error'}`
            };
        }
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
