/**
 * App Update Service
 * Checks for updates from GitHub Releases for both Desktop (Electron) and Mobile (Android)
 */

import { Capacitor } from '@capacitor/core';

// GitHub repository info
const GITHUB_OWNER = 'longk2tha-rgb';
const GITHUB_REPO = 'ImageTool';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Current app version - should match package.json
const APP_VERSION = '2.25.7'; // Update this when releasing new version

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
 * Check if running on Android/iOS via Capacitor
 */
export function isMobilePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

/**
 * Check if running in Electron
 */
export function isElectronPlatform(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

/**
 * Compare two semver versions
 * Returns true if latest > current
 */
function isNewerVersion(current: string, latest: string): boolean {
    const parseVersion = (v: string): number[] => {
        return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    };

    const [c1, c2, c3] = parseVersion(current);
    const [l1, l2, l3] = parseVersion(latest);

    if (l1 > c1) return true;
    if (l1 < c1) return false;
    if (l2 > c2) return true;
    if (l2 < c2) return false;
    return l3 > c3;
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
 * Works for both mobile and desktop (though desktop uses Electron's built-in updater)
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const isAndroid = isMobilePlatform();
    const currentVersion = APP_VERSION;

    try {
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                // No auth needed for public repos
            },
            // Short timeout
            signal: AbortSignal.timeout(10000)
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
 * Get the current app version
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
        // On mobile, use Capacitor Browser or fallback to window.open
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
