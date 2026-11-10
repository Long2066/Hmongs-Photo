/**
 * App Update Service
 * Checks for updates from GitHub Releases for Desktop (Electron) and Mobile (Android APK)
 * Supports in-app 1-touch APK download & installation with progress tracking
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { version as packageVersion } from '../package.json';

// GitHub repository info
const GITHUB_OWNER = 'Long2066';
const GITHUB_REPO = 'Hmongs-Photo';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Native APK Installer Plugin registered in MainActivity.java
export interface ApkInstallerPlugin {
    canRequestPackageInstalls(): Promise<{ value: boolean }>;
    openInstallPermissionSettings(): Promise<void>;
    install(options: { filePath: string }): Promise<{ success: boolean }>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

// Keep the displayed version in sync with the packaged app
export const APP_VERSION = packageVersion;

export interface UpdateInfo {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    downloadUrl: string | null;
    publishedAt: string;
    isAndroid: boolean;
}

/**
 * Check if running on native mobile (Android/iOS) via Capacitor
 */
export function isMobilePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

/**
 * Check if running in Electron desktop
 */
export function isElectronPlatform(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

/**
 * Compare two semver versions
 * Returns true if latest > current
 */
export function isNewerVersion(current: string, latest: string): boolean {
    const parseVersion = (v: string): number[] => {
        return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    };

    const [c1, c2, c3] = parseVersion(current);
    const [l1, l2, l3] = parseVersion(latest);

    if (l1 > c1) return true;
    if (l1 < c1) return false;
    if (l2 > c2) return true;
    if (l2 < c2) return false;
    return (l3 || 0) > (c3 || 0);
}

/**
 * Find APK download URL from release assets
 */
function findApkUrl(assets: any[]): string | null {
    if (!assets || !Array.isArray(assets)) return null;

    const apkAsset = assets.find(asset =>
        asset.name?.toLowerCase().endsWith('.apk') ||
        asset.content_type === 'application/vnd.android.package-archive'
    );

    return apkAsset?.browser_download_url || null;
}

/**
 * Check for updates from GitHub Releases
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const isAndroid = isMobilePlatform();
    const currentVersion = APP_VERSION;

    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
            },
            signal: AbortSignal.timeout(12000)
        });

        if (!response.ok) {
            console.warn('[AppUpdate] GitHub API error:', response.status);
            return {
                hasUpdate: false,
                currentVersion,
                latestVersion: currentVersion,
                releaseNotes: '',
                downloadUrl: null,
                publishedAt: '',
                isAndroid
            };
        }

        const data = await response.json();
        const latestVersion = data.tag_name?.replace(/^v/, '') || data.name?.replace(/^v/, '') || '';
        const hasUpdate = isNewerVersion(currentVersion, latestVersion);
        const downloadUrl = isAndroid ? findApkUrl(data.assets) : null;

        console.log(`[AppUpdate] Current: ${currentVersion}, Latest: ${latestVersion}, HasUpdate: ${hasUpdate}`);

        return {
            hasUpdate,
            currentVersion,
            latestVersion,
            releaseNotes: data.body || '',
            downloadUrl,
            publishedAt: data.published_at || '',
            isAndroid
        };
    } catch (error) {
        console.error('[AppUpdate] Failed to check for updates:', error);
        return {
            hasUpdate: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseNotes: '',
            downloadUrl: null,
            publishedAt: '',
            isAndroid
        };
    }
}

/**
 * Helper: Convert Uint8Array to base64 in safe chunks
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 0x8000; // 32KB chunking
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)) as any);
    }
    return btoa(binary);
}

/**
 * In-app APK Downloader & Installer for Android
 * Downloads APK with progress reporting and directly launches Android Package Installer
 */
export async function downloadAndInstallApk(
    apkUrl: string,
    onProgress?: (percent: number) => void
): Promise<{ success: boolean; message?: string }> {
    if (!isMobilePlatform()) {
        await openDownloadPage(apkUrl);
        return { success: true };
    }

    try {
        console.log('[AppUpdate] Starting APK download from:', apkUrl);
        onProgress?.(5);

        // Check if permission to install unknown apps is granted (Android 8.0+)
        try {
            const perm = await ApkInstaller.canRequestPackageInstalls();
            if (perm && !perm.value) {
                console.warn('[AppUpdate] Install permission not granted yet, requesting settings');
                await ApkInstaller.openInstallPermissionSettings();
            }
        } catch (permErr) {
            console.warn('[AppUpdate] Could not check package install permission:', permErr);
        }

        // Fetch APK with progress tracking
        const res = await fetch(apkUrl);
        if (!res.ok) throw new Error(`Tải APK thất bại (HTTP ${res.status})`);

        const contentLength = Number(res.headers.get('content-length')) || 0;
        const reader = res.body?.getReader();

        if (!reader) {
            // Fallback: arrayBuffer directly
            const buffer = await res.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            onProgress?.(80);

            const base64Data = uint8ArrayToBase64(bytes);
            const fileName = 'ImageTool_latest.apk';

            await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache,
                recursive: true
            });

            const uriResult = await Filesystem.getUri({
                directory: Directory.Cache,
                path: fileName
            });

            onProgress?.(100);
            await ApkInstaller.install({ filePath: uriResult.uri });
            return { success: true };
        }

        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedLength += value.length;

            if (contentLength > 0) {
                const percent = Math.min(95, Math.round((receivedLength / contentLength) * 90) + 5);
                onProgress?.(percent);
            }
        }

        // Merge chunks
        const allBytes = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            allBytes.set(chunk, position);
            position += chunk.length;
        }

        onProgress?.(95);

        // Convert and write to Cache directory
        const base64Data = uint8ArrayToBase64(allBytes);
        const fileName = 'ImageTool_latest.apk';

        await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
        });

        const uriResult = await Filesystem.getUri({
            directory: Directory.Cache,
            path: fileName
        });

        onProgress?.(100);
        console.log('[AppUpdate] APK saved to:', uriResult.uri, 'Launching installer...');

        // Trigger native system package installer
        await ApkInstaller.install({ filePath: uriResult.uri });
        return { success: true };
    } catch (err: any) {
        console.error('[AppUpdate] Direct install failed, falling back to browser download:', err);
        // Fallback: Open in device browser
        await openDownloadPage(apkUrl);
        return {
            success: false,
            message: err?.message || 'Không thể tự động cài đặt. Đang mở trình duyệt để tải file APK.'
        };
    }
}

/**
 * Get current app version
 */
export function getCurrentVersion(): string {
    return APP_VERSION;
}

/**
 * Open browser to download APK
 */
export async function openDownloadPage(url?: string): Promise<void> {
    const downloadUrl = url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    if (isMobilePlatform()) {
        try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: downloadUrl });
        } catch {
            window.open(downloadUrl, '_blank');
        }
    } else {
        window.open(downloadUrl, '_blank');
    }
}
