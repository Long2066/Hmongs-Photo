/**
 * App Update Service
 * Checks for updates for Desktop (Electron) and Mobile (Android APK)
 * Supports:
 * 1. Live Silent Over-The-Air (OTA) Web Bundle Update (zero manual installs, applies automatically when online)
 * 2. In-App Direct APK Package Installer as a fallback when native binary changes
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { version as packageVersion } from '../package.json';

// CDN endpoints on Firebase Hosting (global cache, instant response, no GitHub rate limits)
export const OTA_VERSION_URL = 'https://toolphoto-2025.web.app/ota/version.json';

// GitHub repository info for full binary releases
const GITHUB_OWNER = 'Long2066';
const GITHUB_REPO = 'Hmongs-Photo';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Native APK Installer & Silent OTA Plugin registered in MainActivity.java
export interface ApkInstallerPlugin {
    getNativeVersion(): Promise<{ versionName: string; versionCode: number }>;
    applyOtaUpdate(options: { bundleUrl: string; version: string; reloadNow?: boolean }): Promise<{ success: boolean; version: string; path: string }>;
    getPendingAuthUrl(): Promise<{ url: string | null }>;
    canRequestPackageInstalls(): Promise<{ value: boolean }>;
    openInstallPermissionSettings(): Promise<void>;
    install(options: { filePath: string }): Promise<{ success: boolean }>;
    saveMediaToGallery?(options: { url?: string; base64?: string; filename: string; mimeType?: string }): Promise<{ success: boolean; path?: string; message?: string }>;
}

export const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

// Current bundled web version
export const APP_VERSION = packageVersion;

export interface OtaManifest {
    version: string;
    minNativeVersion?: string;
    bundleUrl: string;
    notes?: string;
}

export interface UpdateInfo {
    hasUpdate: boolean;
    isOta: boolean;
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
        return (v || '0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
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
 * Check and perform Silent OTA Update on Mobile (No Manual Install Needed!)
 * Downloads bundle.zip in the background and applies live or on next restart.
 */
export async function checkAndApplySilentOta(reloadNow = false): Promise<{ updated: boolean; version?: string }> {
    if (!isMobilePlatform()) return { updated: false };

    try {
        const res = await fetch(`${OTA_VERSION_URL}?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) return { updated: false };

        const manifest: OtaManifest = await res.json();
        if (!manifest || !manifest.version || !manifest.bundleUrl) return { updated: false };

        if (!isNewerVersion(APP_VERSION, manifest.version)) {
            console.log(`[OTA] App is already on latest web version: v${APP_VERSION}`);
            return { updated: false };
        }

        // Check native binary requirement
        try {
            const nativeInfo = await ApkInstaller.getNativeVersion();
            if (manifest.minNativeVersion && isNewerVersion(nativeInfo.versionName, manifest.minNativeVersion)) {
                console.log(`[OTA] Requires newer native APK v${manifest.minNativeVersion}, skipping OTA`);
                return { updated: false };
            }
        } catch {}

        console.log(`[OTA] New web bundle available: v${manifest.version}. Downloading silently...`);

        // Apply OTA update silently via native plugin
        const otaResult = await ApkInstaller.applyOtaUpdate({
            bundleUrl: manifest.bundleUrl,
            version: manifest.version,
            reloadNow
        });

        if (otaResult && otaResult.success) {
            console.log(`[OTA] Successfully applied v${manifest.version} in background!`);
            window.dispatchEvent(new CustomEvent('ota-update-applied', { detail: { version: manifest.version } }));
            return { updated: true, version: manifest.version };
        }
    } catch (err) {
        console.warn('[OTA] Silent update check skipped:', err);
    }

    return { updated: false };
}

/**
 * Check for updates across OTA and GitHub Releases
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const isAndroid = isMobilePlatform();
    const currentVersion = APP_VERSION;

    // 1. On Mobile: Check OTA manifest first for instant silent updates
    if (isAndroid) {
        try {
            const otaRes = await fetch(`${OTA_VERSION_URL}?t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' },
                signal: AbortSignal.timeout(6000)
            });

            if (otaRes.ok) {
                const manifest: OtaManifest = await otaRes.json();
                if (manifest && manifest.version && isNewerVersion(currentVersion, manifest.version)) {
                    // Check if native APK is sufficient for this OTA bundle
                    let needsNewApk = false;
                    try {
                        const nativeInfo = await ApkInstaller.getNativeVersion();
                        if (manifest.minNativeVersion && isNewerVersion(nativeInfo.versionName, manifest.minNativeVersion)) {
                            needsNewApk = true;
                        }
                    } catch {}

                    if (!needsNewApk) {
                        return {
                            hasUpdate: true,
                            isOta: true,
                            currentVersion,
                            latestVersion: manifest.version,
                            releaseNotes: manifest.notes || 'Tự động cập nhật không cần cài đặt lại app',
                            downloadUrl: manifest.bundleUrl,
                            publishedAt: new Date().toISOString(),
                            isAndroid: true
                        };
                    }
                }
            }
        } catch (e) {
            console.warn('[AppUpdate] OTA check skipped, trying GitHub release:', e);
        }
    }

    // 2. Check GitHub Releases for full binary update
    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            return {
                hasUpdate: false,
                isOta: false,
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
        const downloadUrl = isAndroid ? findApkUrl(data.assets) : null;
        // On Android, only report a GitHub binary update if an actual .apk asset exists in the release.
        // Never redirect mobile users to a Windows-only (.exe) release page.
        const hasUpdate = isNewerVersion(currentVersion, latestVersion) && (!isAndroid || !!downloadUrl);

        return {
            hasUpdate,
            isOta: false,
            currentVersion,
            latestVersion,
            releaseNotes: data.body || '',
            downloadUrl,
            publishedAt: data.published_at || '',
            isAndroid
        };
    } catch (error) {
        console.error('[AppUpdate] Failed to check GitHub releases:', error);
        return {
            hasUpdate: false,
            isOta: false,
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
    const chunkSize = 0x8000;
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)) as any);
    }
    return btoa(binary);
}

/**
 * In-app APK Downloader & Installer for Android
 * Used when full native APK installation is required
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
        onProgress?.(5);

        try {
            const perm = await ApkInstaller.canRequestPackageInstalls();
            if (perm && !perm.value) {
                await ApkInstaller.openInstallPermissionSettings();
            }
        } catch {}

        const res = await fetch(apkUrl);
        if (!res.ok) throw new Error(`Tải APK thất bại (HTTP ${res.status})`);

        const contentLength = Number(res.headers.get('content-length')) || 0;
        const reader = res.body?.getReader();

        if (!reader) {
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

        const allBytes = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            allBytes.set(chunk, position);
            position += chunk.length;
        }

        onProgress?.(95);

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
        await ApkInstaller.install({ filePath: uriResult.uri });
        return { success: true };
    } catch (err: any) {
        console.error('[AppUpdate] Direct install fallback to browser:', err);
        await openDownloadPage(apkUrl);
        return {
            success: false,
            message: err?.message || 'Đang mở trình duyệt để tải file APK.'
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
