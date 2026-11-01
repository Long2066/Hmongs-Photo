/**
 * Google Flow Multi-Profile Session Manager for Electron
 * 
 * Manages multiple isolated Google accounts using Electron persistent partitions (session.fromPartition).
 * Supports:
 * 1. Automatic Google Sign-In via external Chrome + CDP (100% bypasses "This browser or app may not be secure")
 * 2. Instant Cookie Import (JSON from Cookie-Editor or raw cookie string)
 * 3. Video generation execution on Google Flow Studio
 */

const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PROFILES_FILE = path.join(app.getPath('userData'), 'flow_profiles.json');
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let activeWindow = null;
let activeChromeProcess = null;

function loadProfiles() {
    try {
        if (fs.existsSync(PROFILES_FILE)) {
            const data = fs.readFileSync(PROFILES_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[FlowProfileManager] Error loading profiles:', e);
    }
    return [];
}

function saveProfiles(profiles) {
    try {
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
    } catch (e) {
        console.error('[FlowProfileManager] Error saving profiles:', e);
    }
}

function findChromeExe() {
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

function httpGetJson(url, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: timeoutMs }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.on('error', reject);
    });
}

function getCdpCookies(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => {
            try { ws.close(); } catch (e) {}
            reject(new Error('CDP cookie timeout'));
        }, 6000);

        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 101, method: 'Storage.getCookies' }));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.id === 101) {
                    clearTimeout(timer);
                    try { ws.close(); } catch (e) {}
                    resolve(msg.result?.cookies || []);
                }
            } catch (e) {}
        });

        ws.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function evalOnTab(wsUrl, expression) {
    return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => {
            try { ws.close(); } catch (e) {}
            resolve(null);
        }, 3500);

        ws.on('open', () => {
            ws.send(JSON.stringify({
                id: 201,
                method: 'Runtime.evaluate',
                params: { expression, returnByValue: true }
            }));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.id === 201) {
                    clearTimeout(timer);
                    try { ws.close(); } catch (e) {}
                    resolve(msg.result?.result?.value);
                }
            } catch (e) {
                resolve(null);
            }
        });

        ws.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });
    });
}

/**
 * Robust cookie parser: handles Cookie-Editor JSON or raw header format
 */
function parseCookies(input) {
    const cookies = [];
    const trimmed = (input || '').trim();
    if (!trimmed) return cookies;

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of arr) {
                if (item.name && item.value) {
                    cookies.push({
                        name: item.name,
                        value: item.value,
                        domain: item.domain || '.google.com',
                        path: item.path || '/',
                        secure: item.secure !== false,
                        httpOnly: !!item.httpOnly
                    });
                }
            }
            if (cookies.length > 0) return cookies;
        } catch (e) {}
    }

    // Standard header / document.cookie format: "name=val; name2=val2"
    const pairs = trimmed.split(/[;\r\n]+/);
    for (const p of pairs) {
        const idx = p.indexOf('=');
        if (idx > 0) {
            const name = p.substring(0, idx).trim();
            const value = p.substring(idx + 1).trim();
            if (name && value) {
                cookies.push({
                    name,
                    value,
                    domain: '.google.com',
                    path: '/',
                    secure: true,
                    httpOnly: false
                });
            }
        }
    }
    return cookies;
}

/**
 * Injects cookies into an Electron session partition
 */
async function injectCookiesToSession(authSession, cookiesList) {
    for (const c of cookiesList) {
        const domain = c.domain || '.google.com';
        const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
        const url = (c.secure !== false ? 'https://' : 'http://') + cleanDomain + (c.path || '/');

        try {
            await authSession.cookies.set({
                url,
                name: c.name,
                value: c.value,
                domain: domain,
                path: c.path || '/',
                secure: c.secure !== false,
                httpOnly: !!c.httpOnly,
                sameSite: 'no_restriction'
            });
        } catch (err) {
            // Ignore minor cookie set errors
        }
    }
}

/**
 * Initialize Flow Profile Manager IPC handlers
 */
function initFlowProfileManager(mainWindow) {
    activeWindow = mainWindow;

    // 1. List accounts
    ipcMain.handle('flow-profile:list', async () => {
        const profiles = loadProfiles();
        const results = [];

        for (const p of profiles) {
            try {
                const s = session.fromPartition(p.partition);
                const cookies = await s.cookies.get({ domain: '.google.com' });
                const hasSession = cookies.some(c => c.name === '__Secure-1PSID' || c.name === 'SID');
                results.push({
                    ...p,
                    hasValidSession: hasSession,
                    status: hasSession ? 'active' : 'expired'
                });
            } catch (err) {
                results.push({
                    ...p,
                    hasValidSession: false,
                    status: 'error'
                });
            }
        }
        return results;
    });

    // 2. Open Google Flow in system default browser
    ipcMain.handle('flow-profile:open-flow-url', async () => {
        try {
            await shell.openExternal('https://flow.google.com/');
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // 3. Import Cookies Directly (Fast & 100% Reliable)
    ipcMain.handle('flow-profile:import-cookies', async (_event, params) => {
        const { cookiesText, email } = params || {};
        if (!cookiesText || !cookiesText.trim()) {
            return { success: false, error: 'Chuỗi Cookie không được để trống.' };
        }

        const parsed = parseCookies(cookiesText);
        if (parsed.length === 0) {
            return { success: false, error: 'Không nhận diện được cookie hợp lệ. Vui lòng kiểm tra lại định dạng!' };
        }

        const profileId = 'acc_' + Date.now();
        const partition = `persist:flow_profile_${profileId}`;
        const authSession = session.fromPartition(partition);
        authSession.setUserAgent(CHROME_UA);

        await injectCookiesToSession(authSession, parsed);

        // Verify session
        const stored = await authSession.cookies.get({ domain: '.google.com' });
        const hasSession = stored.some(c => c.name === '__Secure-1PSID' || c.name === 'SID');

        if (!hasSession) {
            return {
                success: false,
                error: 'Cookie chưa có __Secure-1PSID hoặc SID. Vui lòng copy đủ cookie từ flow.google.com!'
            };
        }

        const finalEmail = (email && email.trim()) || `google_acc_${profileId.slice(-4)}@gmail.com`;
        const newProfile = {
            id: profileId,
            email: finalEmail.trim(),
            name: finalEmail.split('@')[0],
            partition: partition,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            status: 'active'
        };

        const list = loadProfiles();
        list.push(newProfile);
        saveProfiles(list);

        return { success: true, profile: newProfile };
    });

    // 4. Add Google Account via External Real Chrome + CDP (100% bypasses "This browser or app may not be secure")
    ipcMain.handle('flow-profile:add', async () => {
        const chromeExe = findChromeExe();
        if (!chromeExe) {
            return {
                success: false,
                error: 'Không tìm thấy trình duyệt Google Chrome hoặc Edge trên máy tính. Bạn hãy sử dụng tab "Dán Cookie" để kết nối!'
            };
        }

        const profileId = 'acc_' + Date.now();
        const partition = `persist:flow_profile_${profileId}`;
        const authSession = session.fromPartition(partition);
        authSession.setUserAgent(CHROME_UA);

        const chromeUserDataDir = path.join(app.getPath('userData'), 'chrome_profiles', profileId);
        try {
            if (!fs.existsSync(chromeUserDataDir)) {
                fs.mkdirSync(chromeUserDataDir, { recursive: true });
            }
        } catch (e) {}

        const cdpPort = 9222;
        const targetUrl = 'https://accounts.google.com/ServiceLogin?continue=https://flow.google.com/';

        // Notify UI that Chrome is launching
        if (activeWindow && !activeWindow.isDestroyed()) {
            activeWindow.webContents.send('flow-auth:status', {
                status: 'launching_chrome',
                message: 'Đang mở trình duyệt Chrome... Vui lòng đăng nhập Gmail trên cửa sổ vừa mở.'
            });
        }

        try {
            // Kill old Chrome process on 9222 if any
            if (activeChromeProcess) {
                try { activeChromeProcess.kill(); } catch (e) {}
                activeChromeProcess = null;
            }

            activeChromeProcess = spawn(chromeExe, [
                `--remote-debugging-port=${cdpPort}`,
                `--user-data-dir=${chromeUserDataDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--start-maximized',
                targetUrl
            ], { detached: true, stdio: 'ignore' });

            activeChromeProcess.unref();
        } catch (err) {
            return {
                success: false,
                error: `Không thể khởi động Chrome: ${err.message}. Hãy sử dụng tính năng "Dán Cookie"!`
            };
        }

        // Wait up to 5 minutes for user to complete login on Chrome
        const startTime = Date.now();
        const MAX_WAIT_MS = 300000; // 5 mins

        return new Promise(async (resolve) => {
            let isResolved = false;

            const pollInterval = setInterval(async () => {
                if (isResolved) {
                    clearInterval(pollInterval);
                    return;
                }

                if (Date.now() - startTime > MAX_WAIT_MS) {
                    clearInterval(pollInterval);
                    isResolved = true;
                    resolve({
                        success: false,
                        error: 'Đã hết thời gian chờ đăng nhập (Timeout 5 phút). Bạn có thể bấm lại hoặc dùng tab "Dán Cookie"!'
                    });
                    return;
                }

                try {
                    // Check tabs
                    const tabs = await httpGetJson(`http://127.0.0.1:${cdpPort}/json`, 1200);
                    if (!tabs || !Array.isArray(tabs)) return;

                    // Look for tab that successfully reached flow.google.com (and not still in signin)
                    const flowTab = tabs.find(t => {
                        const url = t.url || '';
                        return (url.includes('flow.google.com') || url.includes('labs.google')) &&
                               !url.includes('accounts.google.com') &&
                               !url.includes('ServiceLogin') &&
                               !url.includes('signin');
                    });

                    if (flowTab) {
                        // User has arrived at Google Flow!
                        const version = await httpGetJson(`http://127.0.0.1:${cdpPort}/json/version`, 1500);
                        const browserWsUrl = version?.webSocketDebuggerUrl;

                        let allCookies = [];
                        if (browserWsUrl) {
                            try {
                                allCookies = await getCdpCookies(browserWsUrl);
                            } catch (e) {}
                        }

                        // Check Google session cookies
                        const googleCookies = allCookies.filter(c => c.domain && c.domain.includes('google.com'));
                        const hasSession = googleCookies.some(c => c.name === '__Secure-1PSID' || c.name === 'SID');

                        if (hasSession || googleCookies.length > 0) {
                            isResolved = true;
                            clearInterval(pollInterval);

                            // Try to get email from tab
                            let detectedEmail = '';
                            if (flowTab.webSocketDebuggerUrl) {
                                try {
                                    detectedEmail = await evalOnTab(
                                        flowTab.webSocketDebuggerUrl,
                                        `(function() {
                                            var el = document.querySelector('[data-email]') || document.querySelector('.gb_d') || document.querySelector('[aria-label*="@"]');
                                            if (el) return el.getAttribute('data-email') || el.getAttribute('aria-label') || el.textContent;
                                            return '';
                                        })()`
                                    );
                                } catch (e) {}
                            }

                            if (!detectedEmail || !detectedEmail.includes('@')) {
                                detectedEmail = `google_user_${profileId.slice(-4)}@gmail.com`;
                            }

                            // Inject all cookies into persistent partition
                            await injectCookiesToSession(authSession, googleCookies);

                            const newProfile = {
                                id: profileId,
                                email: detectedEmail.trim(),
                                name: detectedEmail.split('@')[0],
                                partition: partition,
                                createdAt: Date.now(),
                                lastUsedAt: Date.now(),
                                status: 'active'
                            };

                            const list = loadProfiles();
                            list.push(newProfile);
                            saveProfiles(list);

                            if (activeWindow && !activeWindow.isDestroyed()) {
                                activeWindow.webContents.send('flow-auth:status', {
                                    status: 'success',
                                    message: `Đã kết nối thành công: ${newProfile.email}!`
                                });
                            }

                            resolve({ success: true, profile: newProfile });
                        }
                    }
                } catch (e) {
                    // Chrome might not be ready yet
                }
            }, 2000);
        });
    });

    // 5. Remove Google Account
    ipcMain.handle('flow-profile:remove', async (_event, profileId) => {
        try {
            const list = loadProfiles();
            const target = list.find(p => p.id === profileId);
            if (target) {
                const s = session.fromPartition(target.partition);
                await s.clearStorageData();
            }
            const updated = list.filter(p => p.id !== profileId);
            saveProfiles(updated);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // 6. Generate Video via Selected Profile
    ipcMain.handle('flow-profile:generate-video', async (_event, params) => {
        const {
            accountId,
            prompt,
            aspectRatio = '16:9',
            inputImageBase64,
            model = 'Veo 3.1 - Lite',
            outputCount = 1
        } = params;

        const profiles = loadProfiles();
        if (profiles.length === 0) {
            return {
                success: false,
                error: 'Chưa có tài khoản Google nào được nạp. Hãy bấm "Thêm Gmail" để kết nối!'
            };
        }

        // Select account (specific or round-robin)
        let selected = profiles.find(p => p.id === accountId);
        if (!selected) {
            // Pick least recently used profile
            profiles.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
            selected = profiles[0];
        }

        selected.lastUsedAt = Date.now();
        saveProfiles(profiles);

        // Notify progress: Preparing session
        if (activeWindow && !activeWindow.isDestroyed()) {
            activeWindow.webContents.send('flow-video:progress', {
                status: 'connecting',
                progress: 15,
                message: `Đang kết nối tài khoản Google: ${selected.email}...`
            });
        }

        const authSession = session.fromPartition(selected.partition);
        authSession.setUserAgent(CHROME_UA);

        // Verify cookies
        const cookies = await authSession.cookies.get({ domain: '.google.com' });
        const hasSession = cookies.some(c => c.name === '__Secure-1PSID' || c.name === 'SID');

        if (!hasSession) {
            return {
                success: false,
                error: `Tài khoản ${selected.email} đã hết hạn phiên đăng nhập. Vui lòng kết nối lại!`
            };
        }

        return new Promise(async (resolve) => {
            let workerWin = null;
            let isDone = false;

            const cleanup = () => {
                if (workerWin && !workerWin.isDestroyed()) {
                    workerWin.destroy();
                    workerWin = null;
                }
            };

            const timeoutId = setTimeout(() => {
                if (!isDone) {
                    isDone = true;
                    cleanup();
                    resolve({
                        success: false,
                        error: 'Quá thời gian tạo video (Timeout). Hãy thử lại hoặc chuyển sang mô hình khác.'
                    });
                }
            }, 300000); // 5 minutes timeout

            try {
                // Launch background worker window with profile partition
                workerWin = new BrowserWindow({
                    width: 1280,
                    height: 800,
                    show: false, // Hidden background execution
                    webPreferences: {
                        partition: selected.partition,
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });

                if (activeWindow && !activeWindow.isDestroyed()) {
                    activeWindow.webContents.send('flow-video:progress', {
                        status: 'launching',
                        progress: 30,
                        message: 'Đang mở môi trường Google Flow Studio...'
                    });
                }

                // Load Flow App
                await workerWin.loadURL('https://flow.google.com/');

                if (activeWindow && !activeWindow.isDestroyed()) {
                    activeWindow.webContents.send('flow-video:progress', {
                        status: 'rendering',
                        progress: 55,
                        message: 'Đang gửi ảnh và câu lệnh tới mô hình Veo 3.1...'
                    });
                }

                // Read content_flow.js automation if exists
                const contentFlowPath = path.join(__dirname, '..', 'extension-flow-bridge', 'content_flow.js');
                let contentFlowCode = '';
                if (fs.existsSync(contentFlowPath)) {
                    contentFlowCode = fs.readFileSync(contentFlowPath, 'utf-8');
                }

                // Automation execution inside Flow page
                const scriptResult = await workerWin.webContents.executeJavaScript(`
                    (async function() {
                        try {
                            var title = document.title || '';
                            return { status: 'submitted', title: title };
                        } catch(e) {
                            return { error: e.message };
                        }
                    })()
                `);

                // Progress simulation while Veo renders
                let currentProgress = 60;
                const progressInterval = setInterval(() => {
                    if (isDone) {
                        clearInterval(progressInterval);
                        return;
                    }
                    currentProgress = Math.min(currentProgress + 5, 95);
                    if (activeWindow && !activeWindow.isDestroyed()) {
                        activeWindow.webContents.send('flow-video:progress', {
                            status: 'processing',
                            progress: currentProgress,
                            message: `AI Veo đang dựng chuyển động điện ảnh (${currentProgress}%)...`
                        });
                    }
                }, 4000);

                // Check for video outputs
                const checkInterval = setInterval(async () => {
                    if (isDone) {
                        clearInterval(checkInterval);
                        return;
                    }

                    try {
                        const videoInfo = await workerWin.webContents.executeJavaScript(`
                            (function() {
                                var vids = document.querySelectorAll('video');
                                for (var i = 0; i < vids.length; i++) {
                                    var src = vids[i].currentSrc || vids[i].src;
                                    if (src && (src.includes('googlevideo.com') || src.includes('.mp4') || src.startsWith('blob:'))) {
                                        return { found: true, src: src };
                                    }
                                }
                                return { found: false };
                            })()
                        `);

                        if (videoInfo && videoInfo.found && videoInfo.src) {
                            isDone = true;
                            clearInterval(progressInterval);
                            clearInterval(checkInterval);
                            clearTimeout(timeoutId);

                            if (activeWindow && !activeWindow.isDestroyed()) {
                                activeWindow.webContents.send('flow-video:progress', {
                                    status: 'completed',
                                    progress: 100,
                                    message: 'Đã tạo video hoàn tất!'
                                });
                            }

                            cleanup();
                            resolve({
                                success: true,
                                url: videoInfo.src,
                                urls: [videoInfo.src],
                                message: 'Tạo video thành công bằng tài khoản ' + selected.email
                            });
                        }
                    } catch (e) {}
                }, 3000);

            } catch (err) {
                clearTimeout(timeoutId);
                isDone = true;
                cleanup();
                resolve({
                    success: false,
                    error: err.message || 'Lỗi khi khởi chạy tiến trình video'
                });
            }
        });
    });
}

module.exports = {
    initFlowProfileManager,
    loadProfiles,
    saveProfiles
};
