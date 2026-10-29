const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // ============ FILE SYSTEM ============
    selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),
    getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
    saveFile: (base64, filename) => ipcRenderer.invoke('save-file', { base64, filename }),

    // ============ BROWSER UTILS ============
    openIncognito: (url) => ipcRenderer.invoke('open-incognito', url),

    // ============ AUTO-UPDATE ============
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Update event listeners
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),

    // ============ ANTIGRAVITY AUTO-UPDATE ============
    antigravityDownloadInstaller: (downloadUrl) => ipcRenderer.invoke('antigravity:download-installer', downloadUrl),
    antigravityInstall: (installerPath) => ipcRenderer.invoke('antigravity:install', installerPath),
    antigravityAutoUpdate: (downloadUrl) => ipcRenderer.invoke('antigravity:auto-update', downloadUrl),
    antigravityOpenApp: () => ipcRenderer.invoke('antigravity:open-app'),

    // Antigravity update event listeners
    onAntigravityDownloadProgress: (callback) => ipcRenderer.on('antigravity:download-progress', (event, progress) => callback(progress)),
    onAntigravityUpdateStatus: (callback) => ipcRenderer.on('antigravity:update-status', (event, status) => callback(status)),

    // ============ GOOGLE OAUTH FOR GEMINI ============
    googleOAuthStart: () => ipcRenderer.invoke('google-oauth:start'),
    googleOAuthGetToken: () => ipcRenderer.invoke('google-oauth:get-token'),
    googleOAuthStatus: () => ipcRenderer.invoke('google-oauth:status'),
    googleOAuthLogout: () => ipcRenderer.invoke('google-oauth:logout'),
    googleOAuthCheckCli: () => ipcRenderer.invoke('google-oauth:check-cli'),
    googleOAuthApiCall: (params) => ipcRenderer.invoke('google-oauth:api-call', params),

    // ============ PLATFORM INFO ============
    isElectron: true,
    platform: process.platform
});

// Log that preload has been loaded
console.log('Preload script loaded successfully');
