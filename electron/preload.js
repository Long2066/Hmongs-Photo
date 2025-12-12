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

    // ============ PLATFORM INFO ============
    isElectron: true,
    platform: process.platform
});

// Log that preload has been loaded
console.log('Preload script loaded successfully');
