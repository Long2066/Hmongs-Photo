const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const oauthHandler = require('./oauth-handler.cjs');

// Store for user settings
let downloadPath = app.getPath('downloads');

// Keep a global reference of the window object
let mainWindow;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        },
        icon: path.join(__dirname, '../public/icon.png'),
        title: 'ImageTool - AI Studio',
        show: false,
        backgroundColor: '#f8fafc'
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // Check for updates after window shows
        checkForUpdates();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============ AUTO-UPDATER ============
function checkForUpdates() {
    autoUpdater.checkForUpdates().catch(err => {
        console.log('Update check failed:', err);
    });
}

autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', () => {
    console.log('App is up to date');
});

autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    mainWindow.webContents.send('update-error', err.message);
});

// ============ IPC HANDLERS ============

// Handle download update request
ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Handle install update request
ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

// Handle folder picker dialog
ipcMain.handle('select-download-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Chọn thư mục lưu ảnh',
        defaultPath: downloadPath,
        properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        downloadPath = result.filePaths[0];
        return { success: true, path: downloadPath };
    }
    return { success: false };
});

// Get current download path
ipcMain.handle('get-download-path', () => {
    return downloadPath;
});

// Save file to custom folder
ipcMain.handle('save-file', async (event, { base64, filename }) => {
    try {
        const filePath = path.join(downloadPath, filename);
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Open URL in incognito/private mode
ipcMain.handle('open-incognito', async (event, url) => {
    const { exec } = require('child_process');

    // Try Chrome first, then Edge, then Firefox
    const commands = [
        `start chrome --incognito "${url}"`,
        `start msedge --inprivate "${url}"`,
        `start firefox -private-window "${url}"`
    ];

    for (const cmd of commands) {
        try {
            await new Promise((resolve, reject) => {
                exec(cmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            return { success: true };
        } catch {
            continue;
        }
    }

    // Fallback: open in default browser (not incognito)
    shell.openExternal(url);
    return { success: true, fallback: true };
});

// Get app version
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// ============ ANTIGRAVITY OPEN APP ============
// Open Antigravity Tools executable (NOT the code editor!)
ipcMain.handle('antigravity:open-app', async () => {
    // Scan known installation paths for Antigravity Tools ONLY
    // NOTE: Do NOT include Antigravity.exe - that is a CODE EDITOR, not the image generation tool
    const possiblePaths = [
        // User's custom installation path (priority)
        'D:\\APP CÀI NGOÀI\\Antigravity Tools\\antigravity_tools.exe',
        // Standard installation paths
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity Tools', 'antigravity_tools.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Antigravity Tools', 'antigravity_tools.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Antigravity Tools', 'antigravity_tools.exe'),
        path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'Antigravity Tools', 'antigravity_tools.exe')
    ];

    for (const exePath of possiblePaths) {
        if (fs.existsSync(exePath)) {
            console.log('[Antigravity Tools] Opening app at:', exePath);
            shell.openPath(exePath);
            return { success: true, path: exePath };
        }
    }

    console.log('[Antigravity Tools] App not found in any known paths');
    return { success: false, error: 'Antigravity Tools not found' };
});

// ============ ANTIGRAVITY AUTO-UPDATE ============
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

// Download file from URL to destination
async function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const request = protocol.get(url, {
            headers: { 'User-Agent': 'ImageTool' }
        }, (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, destPath, onProgress)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: HTTP ${response.statusCode}`));
                return;
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            const file = fs.createWriteStream(destPath);

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (onProgress && totalSize) {
                    onProgress({
                        percent: Math.round((downloadedSize / totalSize) * 100),
                        downloaded: downloadedSize,
                        total: totalSize
                    });
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });

            file.on('error', (err) => {
                fs.unlink(destPath, () => { }); // Delete partial file
                reject(err);
            });
        });

        request.on('error', reject);
        request.setTimeout(60000, () => {
            request.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

// Download Antigravity installer from GitHub
ipcMain.handle('antigravity:download-installer', async (event, downloadUrl) => {
    try {
        const tempDir = app.getPath('temp');
        const installerPath = path.join(tempDir, 'Antigravity-Tools-Setup.msi');

        console.log('[Antigravity] Downloading from:', downloadUrl);
        console.log('[Antigravity] Saving to:', installerPath);

        // Delete old installer if exists
        if (fs.existsSync(installerPath)) {
            fs.unlinkSync(installerPath);
        }

        await downloadFile(downloadUrl, installerPath, (progress) => {
            mainWindow.webContents.send('antigravity:download-progress', progress);
        });

        console.log('[Antigravity] Download complete');
        return { success: true, path: installerPath };
    } catch (error) {
        console.error('[Antigravity] Download failed:', error);
        return { success: false, error: error.message };
    }
});

// Install Antigravity using MSI (passive mode = auto upgrade)
ipcMain.handle('antigravity:install', async (event, installerPath) => {
    try {
        console.log('[Antigravity] Installing from:', installerPath);

        if (!fs.existsSync(installerPath)) {
            return { success: false, error: 'Installer file not found' };
        }

        // Run MSI installer in passive mode (shows progress, no user interaction)
        // /passive = Passive mode, progress bar only
        // /norestart = Don't restart after install
        return new Promise((resolve) => {
            const installer = spawn('msiexec', [
                '/i', installerPath,
                '/passive',
                '/norestart'
            ], {
                detached: true,
                stdio: 'ignore',
                shell: true
            });

            installer.on('close', (code) => {
                console.log('[Antigravity] Installer exited with code:', code);
                // Clean up installer file
                try {
                    fs.unlinkSync(installerPath);
                } catch { }

                if (code === 0 || code === 3010) { // 3010 = success, restart required
                    resolve({ success: true, code });
                } else {
                    resolve({ success: false, error: `Installation failed with code ${code}` });
                }
            });

            installer.on('error', (err) => {
                console.error('[Antigravity] Installer error:', err);
                resolve({ success: false, error: err.message });
            });

            installer.unref();
        });
    } catch (error) {
        console.error('[Antigravity] Install failed:', error);
        return { success: false, error: error.message };
    }
});

// One-click update: Download and Install
ipcMain.handle('antigravity:auto-update', async (event, downloadUrl) => {
    try {
        mainWindow.webContents.send('antigravity:update-status', { status: 'downloading', message: 'Đang tải xuống...' });

        const tempDir = app.getPath('temp');
        const installerPath = path.join(tempDir, 'Antigravity-Tools-Setup.msi');

        // Delete old installer if exists
        if (fs.existsSync(installerPath)) {
            fs.unlinkSync(installerPath);
        }

        // Download
        await downloadFile(downloadUrl, installerPath, (progress) => {
            mainWindow.webContents.send('antigravity:download-progress', progress);
        });

        mainWindow.webContents.send('antigravity:update-status', { status: 'installing', message: 'Đang cài đặt...' });

        // Install
        return new Promise((resolve) => {
            const installer = spawn('msiexec', [
                '/i', installerPath,
                '/passive',
                '/norestart'
            ], {
                detached: true,
                stdio: 'ignore',
                shell: true
            });

            installer.on('close', (code) => {
                try { fs.unlinkSync(installerPath); } catch { }

                if (code === 0 || code === 3010) {
                    mainWindow.webContents.send('antigravity:update-status', { status: 'complete', message: 'Cài đặt hoàn tất!' });
                    resolve({ success: true });
                } else {
                    mainWindow.webContents.send('antigravity:update-status', { status: 'error', message: `Lỗi cài đặt (code: ${code})` });
                    resolve({ success: false, error: `Exit code: ${code}` });
                }
            });

            installer.on('error', (err) => {
                mainWindow.webContents.send('antigravity:update-status', { status: 'error', message: err.message });
                resolve({ success: false, error: err.message });
            });

            installer.unref();
        });
    } catch (error) {
        mainWindow.webContents.send('antigravity:update-status', { status: 'error', message: error.message });
        return { success: false, error: error.message };
    }
});

// ============ GOOGLE OAUTH FOR GEMINI ============

// Start Google OAuth login flow
ipcMain.handle('google-oauth:start', async () => {
    try {
        const result = await oauthHandler.startOAuthFlow();
        return result;
    } catch (error) {
        console.error('[OAuth IPC] Start failed:', error);
        return { success: false, error: error.message };
    }
});

// Get valid access token (auto-refresh)
ipcMain.handle('google-oauth:get-token', async () => {
    try {
        const result = await oauthHandler.getAccessToken();
        if (!result) return { success: false, error: 'No tokens available' };
        return { success: true, ...result };
    } catch (error) {
        console.error('[OAuth IPC] Get token failed:', error);
        return { success: false, error: error.message };
    }
});

// Get OAuth status
ipcMain.handle('google-oauth:status', async () => {
    try {
        return oauthHandler.getOAuthStatus();
    } catch (error) {
        return { configured: false, error: error.message };
    }
});

// Logout (clear tokens)
ipcMain.handle('google-oauth:logout', async () => {
    try {
        oauthHandler.clearTokens();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Check if Gemini CLI is installed
ipcMain.handle('google-oauth:check-cli', async () => {
    try {
        return oauthHandler.checkGeminiCliInstalled();
    } catch (error) {
        return { installed: false, error: error.message };
    }
});

// Proxy OAuth API calls through Node.js (bypasses CORS)
ipcMain.handle('google-oauth:api-call', async (_event, { url, method, headers, body }) => {
    try {
        console.log('[OAuth IPC Proxy] Calling:', url);
        const response = await fetch(url, {
            method: method || 'POST',
            headers: headers || {},
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        });

        const responseText = await response.text();
        let responseJson = null;
        try { responseJson = JSON.parse(responseText); } catch { /* not JSON */ }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            text: responseText,
            json: responseJson,
        };
    } catch (error) {
        console.error('[OAuth IPC Proxy] Error:', error.message);
        return { ok: false, status: 0, error: error.message };
    }
});

// ============ APP LIFECYCLE ============
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
