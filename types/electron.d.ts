// TypeScript declarations for Electron API exposed via preload.js

interface ElectronAPI {
    // File System
    selectDownloadFolder: () => Promise<{ success: boolean; path?: string }>;
    getDownloadPath: () => Promise<string>;
    saveFile: (base64: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;

    // Browser Utils
    openIncognito: (url: string) => Promise<{ success: boolean; fallback?: boolean }>;

    // Auto-Update
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    installUpdate: () => void;
    getAppVersion: () => Promise<string>;

    // Update Event Listeners
    onUpdateAvailable: (callback: (info: any) => void) => void;
    onUpdateProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => void;
    onUpdateDownloaded: (callback: (info: any) => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;

    // Platform Info
    isElectron: boolean;
    platform: 'win32' | 'darwin' | 'linux';
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
