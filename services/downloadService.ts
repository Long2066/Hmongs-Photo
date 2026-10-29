/**
 * Download Service - Handles file downloads for both web and mobile (Android/iOS)
 * Uses Capacitor Filesystem for native mobile, fallback to data URL for web
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
 * Download base64 image to device
 * - On Android/iOS: Saves to Downloads folder using Capacitor Filesystem
 * - On Web: Uses traditional data URL download
 */
export async function downloadImage(base64: string, filename: string): Promise<DownloadResult> {
    // Ensure filename has extension
    if (!filename.endsWith('.png') && !filename.endsWith('.jpg') && !filename.endsWith('.jpeg')) {
        filename = `${filename}.png`;
    }

    if (isNativePlatform()) {
        return downloadNative(base64, filename);
    } else {
        return downloadWeb(base64, filename);
    }
}

/**
 * Native download using Capacitor Filesystem
 */
async function downloadNative(base64: string, filename: string): Promise<DownloadResult> {
    try {
        // Request permissions first (Android requires this)
        const permResult = await Filesystem.checkPermissions();
        if (permResult.publicStorage !== 'granted') {
            const reqResult = await Filesystem.requestPermissions();
            if (reqResult.publicStorage !== 'granted') {
                return {
                    success: false,
                    message: 'Cần cấp quyền truy cập bộ nhớ để tải ảnh'
                };
            }
        }

        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const uniqueFilename = `ToolPhoto_${timestamp}_${filename}`;

        // Write file to Downloads directory
        const result = await Filesystem.writeFile({
            path: uniqueFilename,
            data: base64,
            directory: Directory.Documents, // Use Documents as it's more accessible
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

        // Fallback: try saving to cache and letting user share
        try {
            const timestamp = Date.now();
            const uniqueFilename = `ToolPhoto_${timestamp}_${filename}`;

            const result = await Filesystem.writeFile({
                path: uniqueFilename,
                data: base64,
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
                message: `Lỗi tải ảnh: ${error.message || 'Unknown error'}`
            };
        }
    }
}

/**
 * Web download using traditional data URL method
 */
function downloadWeb(base64: string, filename: string): DownloadResult {
    try {
        // Convert base64 to blob for better compatibility
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        // Create object URL and trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return {
            success: true,
            message: `✅ Đang tải: ${filename}`
        };
    } catch (error: any) {
        console.error('[Download] Web download failed:', error);
        return {
            success: false,
            message: `Lỗi tải ảnh: ${error.message || 'Unknown error'}`
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
