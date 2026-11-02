/**
 * Google Flow Multi-Profile Session Manager for Electron
 * 
 * Manages multiple isolated Google accounts using Electron persistent partitions (session.fromPartition).
 * Supports:
 * 1. Automatic Google Sign-In via external Chrome + CDP (100% bypasses "This browser or app may not be secure")
 *    - Auto-closes Chrome window as soon as login is completed!
 * 2. Instant Cookie Import (JSON from Cookie-Editor or raw cookie string)
 * 3. Video generation execution via flow-py engine with real MP4 downloads (NEVER demo trailer reel)
 */

const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PROFILES_FILE = path.join(app.getPath('userData'), 'flow_profiles.json');
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SERVER_URL = 'http://127.0.0.1:8100';

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

function httpGetJson(url, timeoutMs = 2500) {
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

function httpPostJson(url, postData, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const payload = JSON.stringify(postData);
            const req = http.request({
                hostname: u.hostname,
                port: u.port || 80,
                path: u.pathname + u.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: timeoutMs
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

function findFlowServerDir() {
    const candidates = [
        path.join(process.resourcesPath || '', 'flow-py-main'),
        path.join(__dirname, '..', 'flow-py-main'),
        path.join(app.getAppPath(), '..', 'flow-py-main'),
        path.join(app.getAppPath(), 'flow-py-main'),
        path.join(process.cwd(), 'flow-py-main'),
        'd:\\ToolMedia\\flow-py-main'
    ];
    for (const dir of candidates) {
        if (dir && fs.existsSync(path.join(dir, 'server.py'))) {
            return dir;
        }
    }
    return null;
}

function findPythonExecutable() {
    const candidates = [
        'C:\\Python314\\python.exe',
        'C:\\Python313\\python.exe',
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe',
        'C:\\Python310\\python.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
        'python',
        'py'
    ];
    for (const p of candidates) {
        if (p.includes('\\') || p.includes('/')) {
            if (fs.existsSync(p)) return p;
        } else {
            return p;
        }
    }
    return 'python';
}

async function ensureVideoServerRunning() {
    try {
        const health = await httpGetJson(`${SERVER_URL}/health`, 1200);
        if (health && health.status === 'ok') {
            return true;
        }
    } catch (e) {}

    // Not running: Start server.py in background
    const serverDir = findFlowServerDir();
    if (!serverDir) {
        console.error('[FlowProfileManager] Cannot locate flow-py-main/server.py in any candidate path!');
        return false;
    }

    const pyExe = findPythonExecutable();
    const pyScript = path.join(serverDir, 'server.py');
    console.log(`[FlowProfileManager] Auto-starting flow-py server using "${pyExe}" at ${pyScript}...`);

    try {
        const pyProcess = spawn(pyExe, ['-X', 'utf8', 'server.py'], {
            cwd: serverDir,
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        pyProcess.unref();
    } catch (err) {
        console.error('[FlowProfileManager] Failed to spawn python server:', err);
    }

    // Wait up to 12 seconds for server to start
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 600));
        try {
            const health = await httpGetJson(`${SERVER_URL}/health`, 1000);
            if (health && health.status === 'ok') {
                console.log('[FlowProfileManager] Flow server is now ready on port 8100!');
                return true;
            }
        } catch (e) {}
    }
    return false;
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
            } catch (e) {}
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

    // Pre-warm Video Server 8100 immediately at app launch
    ensureVideoServerRunning().then(ok => {
        if (ok) console.log('[FlowProfileManager] Video Server 8100 pre-warmed successfully.');
    }).catch(err => console.debug('[FlowProfileManager] Pre-warm notice:', err));

    // 0. Ensure server IPC
    ipcMain.handle('flow-profile:ensure-server', async () => {
        const ok = await ensureVideoServerRunning();
        return { success: ok };
    });

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

                            // Automatically close Chrome window once auth is completed!
                            if (activeChromeProcess) {
                                try { activeChromeProcess.kill(); } catch (e) {}
                                activeChromeProcess = null;
                            }

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

    // 6. Generate Video via Selected Profile (Using flow-py engine with real MP4 downloads)
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
                progress: 10,
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

        // 1. Ensure Python Flow Server is Running
        if (activeWindow && !activeWindow.isDestroyed()) {
            activeWindow.webContents.send('flow-video:progress', {
                status: 'starting_server',
                progress: 20,
                message: 'Đang khởi động môi trường xử lý Google Flow Studio...'
            });
        }

        const serverReady = await ensureVideoServerRunning();
        if (!serverReady) {
            return {
                success: false,
                error: 'Không thể khởi động bộ xử lý Google Flow (Server 8100). Vui lòng kiểm tra Python trên máy tính!'
            };
        }

        // 2. Submit Job to Flow Server
        if (activeWindow && !activeWindow.isDestroyed()) {
            activeWindow.webContents.send('flow-video:progress', {
                status: 'submitting',
                progress: 35,
                message: 'Đang tải ảnh nguồn và câu lệnh lên mô hình Veo 3.1...'
            });
        }

        const mappedCookies = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly
        }));

        let jobSubmitRes;
        try {
            jobSubmitRes = await httpPostJson(`${SERVER_URL}/v1/videos/generations`, {
                prompt: prompt,
                aspect_ratio: aspectRatio,
                images: inputImageBase64 ? [inputImageBase64] : [],
                model: model,
                count: outputCount,
                cookies: mappedCookies
            }, 25000);
        } catch (postErr) {
            return {
                success: false,
                error: `Lỗi kết nối tới Server Video: ${postErr.message}`
            };
        }

        if (!jobSubmitRes || jobSubmitRes.status !== 202 || !jobSubmitRes.data?.id) {
            const errDetail = jobSubmitRes?.data?.detail || jobSubmitRes?.data?.error || 'Không thể tạo tác vụ video';
            return {
                success: false,
                error: `Google Flow từ chối yêu cầu: ${errDetail}`
            };
        }

        const jobId = jobSubmitRes.data.id;

        // 3. Poll Job Status until completed
        const startTime = Date.now();
        const MAX_POLL_MS = 600000; // 10 minutes timeout

        return new Promise((resolve) => {
            let isDone = false;

            const pollTimer = setInterval(async () => {
                if (isDone) {
                    clearInterval(pollTimer);
                    return;
                }

                if (Date.now() - startTime > MAX_POLL_MS) {
                    clearInterval(pollTimer);
                    isDone = true;
                    resolve({
                        success: false,
                        error: 'Quá thời gian tạo video (Timeout 10 phút). Vui lòng thử lại!'
                    });
                    return;
                }

                try {
                    const statusRes = await httpGetJson(`${SERVER_URL}/v1/videos/generations/${jobId}`, 3000);
                    if (!statusRes) return;

                    // Forward progress text to renderer UI
                    if (activeWindow && !activeWindow.isDestroyed() && statusRes.progress_text) {
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        activeWindow.webContents.send('flow-video:progress', {
                            status: statusRes.status,
                            progress: Math.min(40 + Math.floor(elapsed / 4), 95),
                            message: `${statusRes.progress_text} (${elapsed}s)`
                        });
                    }

                    if (statusRes.status === 'completed') {
                        isDone = true;
                        clearInterval(pollTimer);

                        let finalUrl = statusRes.url || statusRes.urls?.[0] || '';
                        if (finalUrl && finalUrl.startsWith('/')) {
                            finalUrl = `${SERVER_URL}${finalUrl}`;
                        }
                        const finalUrls = (statusRes.urls || [finalUrl]).map(u => u.startsWith('/') ? `${SERVER_URL}${u}` : u);

                        if (activeWindow && !activeWindow.isDestroyed()) {
                            activeWindow.webContents.send('flow-video:progress', {
                                status: 'completed',
                                progress: 100,
                                message: 'Đã tạo video hoàn tất!'
                            });
                        }

                        resolve({
                            success: true,
                            url: finalUrl,
                            urls: finalUrls,
                            message: `Tạo video thành công bằng tài khoản ${selected.email}`
                        });
                        return;
                    }

                    if (statusRes.status === 'failed') {
                        isDone = true;
                        clearInterval(pollTimer);
                        resolve({
                            success: false,
                            error: statusRes.error || 'Quá trình tạo video trên Google Flow thất bại.'
                        });
                        return;
                    }
                } catch (e) {
                    // Ignore transient network errors during poll
                }
            }, 2500);
        });
    });
}

module.exports = {
    initFlowProfileManager,
    loadProfiles,
    saveProfiles
};
