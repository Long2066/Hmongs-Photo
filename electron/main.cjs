const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const oauthHandler = require('./oauth-handler.cjs');
const flowProfileManager = require('./flow-profile-manager.cjs');

// Modern Chrome User-Agent to bypass Google OAuth "disallowed_useragent" / insecure browser check
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_UA;

app.on('web-contents-created', (_event, contents) => {
    contents.setUserAgent(CHROME_UA);
});

app.on('browser-window-created', (_event, win) => {
    win.webContents.setUserAgent(CHROME_UA);
    if (win !== mainWindow) {
        win.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });
    }
});

// Store for user settings
let downloadPath = app.getPath('downloads');

// Keep a global reference of the window object
let mainWindow;
let localServer = null;
let localServerPort = null;
let quotaOAuthServer = null;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Locate Google Chrome on Windows
 */
function getChromeExecutablePath() {
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Open URL in external Google Chrome browser (bypasses Google embedded webview blocks)
 */
function openInChromeOrBrowser(url) {
    const chromePath = getChromeExecutablePath();
    if (chromePath) {
        console.log('[Browser] Launching Google Chrome directly:', chromePath);
        try {
            const proc = spawn(chromePath, [url], { detached: true, stdio: 'ignore' });
            proc.unref();
            return { success: true, method: 'direct-chrome' };
        } catch (e) {
            console.warn('[Browser] Failed to spawn Chrome directly, falling back:', e);
        }
    }

    try {
        const proc = spawn('cmd.exe', ['/c', 'start', '', 'chrome', url], { detached: true, stdio: 'ignore' });
        proc.unref();
        return { success: true, method: 'cmd-chrome' };
    } catch {
        shell.openExternal(url);
        return { success: true, method: 'openExternal' };
    }
}

/**
 * Automatic OAuth Callback Server for Google Quota Station (port 51121)
 * Automatically receives the redirect from Google OAuth when authenticating on external Chrome,
 * notifies the desktop app renderer via IPC, and cleanly serves a success completion page.
 */
function startQuotaCallbackServer() {
    if (quotaOAuthServer) return;

    try {
        quotaOAuthServer = http.createServer((req, res) => {
            try {
                const reqUrl = req.url || '';
                if (reqUrl.includes('oauth-callback') || reqUrl.includes('code=')) {
                    const fullCallbackUrl = `http://localhost:51121${reqUrl}`;
                    console.log('[QuotaOAuth] Intercepted Google OAuth Callback on 51121:', fullCallbackUrl);

                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Đăng nhập Google thành công - ImageTool</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 64px;
      height: 64px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin: 0 auto 20px;
    }
    h2 { margin: 0 0 10px; font-size: 22px; color: #fff; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: #fff;
      font-weight: bold;
      font-size: 13px;
      padding: 6px 16px;
      border-radius: 20px;
      margin-bottom: 24px;
    }
    .close-hint { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <div class="badge">+10 Lượt tạo ảnh miễn phí</div>
    <h2>Xác thực Google thành công!</h2>
    <p>Hệ thống đã nhận diện tài khoản Google. ImageTool đang tự động cộng <strong>+10 lượt tạo ảnh miễn phí</strong> cho bạn...</p>
    <div class="close-hint">Tab này sẽ tự động đóng sau 3 giây...</div>
  </div>
  <script>
    setTimeout(() => { try { window.close(); } catch(e){} }, 3000);
  </script>
</body>
</html>`);

                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('quota-oauth-captured', fullCallbackUrl);
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.focus();
                    }
                    return;
                }

                res.writeHead(404);
                res.end('Not found');
            } catch (e) {
                console.error('[QuotaOAuth] Handler error:', e);
                res.writeHead(500);
                res.end('Server Error');
            }
        });

        quotaOAuthServer.listen(51121, '127.0.0.1', () => {
            console.log('[QuotaOAuth] Callback listener active on http://127.0.0.1:51121');
        });

        quotaOAuthServer.on('error', (err) => {
            console.warn('[QuotaOAuth] Port 51121 error:', err.message);
        });
    } catch (err) {
        console.warn('[QuotaOAuth] Could not start callback server:', err.message);
    }
}

/**
 * Embedded Lightweight Local Server for Desktop App
 * Solves Firebase Google Sign-In "file:// protocol unauthorized-domain" error
 * by serving the app on authorized origin "http://localhost:<random-port>".
 */
function startLocalServer(distDir) {
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4'
    };

    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const reqUrl = (req.url || '').split('?')[0];

            if (req.method === 'OPTIONS') {
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end();
                return;
            }

            // Google OAuth Bridge callback from external Chrome
            if (req.method === 'POST' && reqUrl === '/api/auth-complete') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        console.log('[AuthBridge] Received Google OAuth from external Chrome:', data.email);

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('external-google-auth-success', data);
                            if (mainWindow.isMinimized()) mainWindow.restore();
                            mainWindow.focus();
                        }

                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({ ok: true }));
                    } catch (err) {
                        res.writeHead(400, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({ ok: false, error: err.message }));
                    }
                });
                return;
            }

            let filePath = path.join(distDir, reqUrl === '/' ? '/index.html' : reqUrl);

            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                filePath = path.join(distDir, 'index.html');
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Server Error');
                } else {
                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(content);
                }
            });
        });

        // 127.0.0.1 with port 0 binds to any available free port automatically
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            localServerPort = port;
            console.log(`[LocalServer] Serving dist at http://localhost:${port}`);
            localServer = server;
            resolve(port);
        });

        server.on('error', (err) => {
            console.error('[LocalServer] Error:', err);
            resolve(null);
        });
    });
}

async function createWindow() {
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

    // Open any external popups / links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        openInChromeOrBrowser(url);
        return { action: 'deny' };
    });

    // Start background Quota Station OAuth callback server (port 51121)
    try {
        startQuotaCallbackServer();
    } catch (e) {
        console.error('[QuotaCallbackServer] Init error:', e);
    }

    // Initialize Flow Profile Manager
    try {
        flowProfileManager.initFlowProfileManager(mainWindow);
    } catch (e) {
        console.error('[FlowProfileManager] Init error:', e);
    }

    // Load the app: Always prefer HTTP origin so Firebase Google OAuth succeeds 100%
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        try {
            const port = await startLocalServer(path.join(__dirname, '../dist'));
            if (port) {
                mainWindow.loadURL(`http://localhost:${port}`);
            } else {
                mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
            }
        } catch (e) {
            console.error('Failed to start local server, fallback to loadFile:', e);
            mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        }
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

// Open URL in external Google Chrome (or default browser fallback)
ipcMain.handle('open-external', async (_event, url) => {
    return openInChromeOrBrowser(url);
});

// Launch Google Auth in real external Google Chrome browser
ipcMain.handle('start-external-google-auth', async () => {
    const port = localServerPort || (process.env.NODE_ENV === 'development' ? 3000 : 51121);
    const bridgeUrl = `http://localhost:${port}/auth-bridge.html`;
    console.log('[AuthBridge] Opening external Chrome for Google Auth:', bridgeUrl);
    return openInChromeOrBrowser(bridgeUrl);
});

// Get app version
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// ============ ANTIGRAVITY OPEN APP ============
ipcMain.handle('antigravity:open-app', async () => {
    const possiblePaths = [
        'D:\\APP CÀI NGOÀI\\Antigravity Tools\\antigravity_tools.exe',
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
async function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const request = protocol.get(url, {
            headers: { 'User-Agent': 'ImageTool' }
        }, (response) => {
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
                fs.unlink(destPath, () => { });
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

ipcMain.handle('antigravity:download-installer', async (event, downloadUrl) => {
    try {
        const tempDir = app.getPath('temp');
        const installerPath = path.join(tempDir, 'Antigravity-Tools-Setup.msi');

        if (fs.existsSync(installerPath)) {
            fs.unlinkSync(installerPath);
        }

        await downloadFile(downloadUrl, installerPath, (progress) => {
            mainWindow.webContents.send('antigravity:download-progress', progress);
        });

        return { success: true, path: installerPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('antigravity:install', async (event, installerPath) => {
    try {
        if (!fs.existsSync(installerPath)) {
            return { success: false, error: 'Installer file not found' };
        }

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
                    resolve({ success: true, code });
                } else {
                    resolve({ success: false, error: `Installation failed with code ${code}` });
                }
            });

            installer.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            installer.unref();
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('antigravity:auto-update', async (event, downloadUrl) => {
    try {
        mainWindow.webContents.send('antigravity:update-status', { status: 'downloading', message: 'Đang tải xuống...' });

        const tempDir = app.getPath('temp');
        const installerPath = path.join(tempDir, 'Antigravity-Tools-Setup.msi');

        if (fs.existsSync(installerPath)) {
            fs.unlinkSync(installerPath);
        }

        await downloadFile(downloadUrl, installerPath, (progress) => {
            mainWindow.webContents.send('antigravity:download-progress', progress);
        });

        mainWindow.webContents.send('antigravity:update-status', { status: 'installing', message: 'Đang cài đặt...' });

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
ipcMain.handle('google-oauth:start', async () => {
    try {
        const result = await oauthHandler.startOAuthFlow();
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('google-oauth:get-token', async () => {
    try {
        const result = await oauthHandler.getAccessToken();
        if (!result) return { success: false, error: 'No tokens available' };
        return { success: true, ...result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('google-oauth:status', async () => {
    try {
        return oauthHandler.getOAuthStatus();
    } catch (error) {
        return { configured: false, error: error.message };
    }
});

ipcMain.handle('google-oauth:logout', async () => {
    try {
        oauthHandler.clearTokens();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('google-oauth:check-cli', async () => {
    try {
        return oauthHandler.checkGeminiCliInstalled();
    } catch (error) {
        return { installed: false, error: error.message };
    }
});

ipcMain.handle('google-oauth:api-call', async (_event, { url, method, headers, body }) => {
    try {
        const response = await fetch(url, {
            method: method || 'POST',
            headers: headers || {},
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        });

        const responseText = await response.text();
        let responseJson = null;
        try { responseJson = JSON.parse(responseText); } catch { }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            text: responseText,
            json: responseJson,
        };
    } catch (error) {
        return { ok: false, status: 0, error: error.message };
    }
});

// ============ APP LIFECYCLE ============
app.whenReady().then(() => {
    // Intercept web requests to ensure Chrome headers and remove Electron markers
    if (session && session.defaultSession) {
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            details.requestHeaders['User-Agent'] = CHROME_UA;
            if (details.requestHeaders['sec-ch-ua']) {
                details.requestHeaders['sec-ch-ua'] = '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"';
            }
            callback({ cancel: false, requestHeaders: details.requestHeaders });
        });
    }
    createWindow();
});

app.on('window-all-closed', () => {
    if (localServer) {
        try { localServer.close(); } catch (e) { }
    }
    if (quotaOAuthServer) {
        try { quotaOAuthServer.close(); } catch (e) { }
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
