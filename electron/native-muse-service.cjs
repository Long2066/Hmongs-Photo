/**
 * Native Muse Engine for ToolMedia
 * Replaces muse2api completely using Electron's native Chromium and Session.
 * 
 * - Persistent session storage with session.fromPartition('persist:muse_session')
 * - Automatic Keepalive Heartbeat every 10 minutes to prevent cookie expiration
 * - In-app visual 1-click login window (automatically captures cookies and closes)
 * - OpenAI compatible /v1/chat/completions, /v1/images/generations, /v1/tasks/videos
 */

const { BrowserWindow, session, app } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');

const MUSE_SITE = 'https://muse.ai';
const SESSION_API = `${MUSE_SITE}/api/session`;
const NEW_THREAD_URL = `${MUSE_SITE}/thread/new`;

const PARTITION_NAME = 'persist:muse_session';
let keepaliveTimer = null;
let activeWorkerWindow = null;
let isWorkerBusy = false;

// Cookie storage backup in userData
function getCookieBackupPath() {
    return path.join(app.getPath('userData'), 'muse_cookies.json');
}

function getMuseSession() {
    return session.fromPartition(PARTITION_NAME);
}

/**
 * Get current session cookies for muse.ai
 */
async function getMuseCookies() {
    const ses = getMuseSession();
    const cookies = await ses.cookies.get({ domain: 'muse.ai' });
    const jar = {};
    for (const c of cookies) {
        jar[c.name] = c.value;
    }

    // Fallback: check backup file if session cookies empty
    if (!jar['hatch_sess']) {
        const backupPath = getCookieBackupPath();
        if (fs.existsSync(backupPath)) {
            try {
                const saved = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
                if (saved['hatch_sess']) {
                    return saved;
                }
            } catch (e) { }
        }
    }
    return jar;
}

/**
 * Save cookies to persistent session and disk backup
 */
async function saveMuseCookies(cookieMap) {
    const ses = getMuseSession();
    for (const [name, value] of Object.entries(cookieMap)) {
        if (!value) continue;
        try {
            await ses.cookies.set({
                url: MUSE_SITE,
                name,
                value,
                domain: '.muse.ai',
                path: '/',
                secure: true,
                sameSite: 'lax',
                expirationDate: Math.floor(Date.now() / 1000) + (365 * 24 * 3600)
            });
        } catch (e) {
            console.warn(`[NativeMuse] Error setting cookie ${name}:`, e.message);
        }
    }

    // Save to backup file
    try {
        fs.writeFileSync(getCookieBackupPath(), JSON.stringify(cookieMap, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[NativeMuse] Error saving backup cookies:', e.message);
    }
}

/**
 * Heartbeat: Renew session with https://muse.ai/api/session
 * Rotates cookies and extends session expiry indefinitely
 */
async function renewSession() {
    const cookies = await getMuseCookies();
    if (!cookies['hatch_sess']) {
        return { ok: false, message: 'Chưa có session cookie' };
    }

    console.log('[NativeMuse] Heartbeat: renewing session with muse.ai...');
    const cookieHeader = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    return new Promise((resolve) => {
        const req = https.request(SESSION_API, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Referer': NEW_THREAD_URL,
                'Cookie': cookieHeader,
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                const setCookies = res.headers['set-cookie'];
                if (setCookies && Array.isArray(setCookies)) {
                    const updated = { ...cookies };
                    for (const sc of setCookies) {
                        const parts = sc.split(';')[0].split('=');
                        if (parts.length >= 2) {
                            updated[parts[0].trim()] = parts.slice(1).join('=').trim();
                        }
                    }
                    await saveMuseCookies(updated);
                    console.log('[NativeMuse] Session renewed successfully! Cookies rotated.');
                }
                resolve({ ok: res.statusCode === 200, status: res.statusCode });
            });
        });

        req.on('error', (err) => {
            console.warn('[NativeMuse] Heartbeat error:', err.message);
            resolve({ ok: false, error: err.message });
        });
        req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        req.end();
    });
}

/**
 * Start periodic keepalive heartbeat (every 10 minutes)
 */
function startKeepalive(intervalMs = 10 * 60 * 1000) {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => {
        renewSession().catch(e => console.warn('[NativeMuse] Heartbeat catch:', e));
    }, intervalMs);

    // Run first renewal immediately after 5 seconds
    setTimeout(() => {
        renewSession().catch(() => { });
    }, 5000);
    console.log('[NativeMuse] Session Keep-Alive Heartbeat activated.');
}

/**
 * In-app Visual Login Window for Muse.ai
 * Opens a 100% brand new, isolated Incognito session every single time.
 * Zero cached cookies, zero previous history.
 */
async function openLoginWindow(parentWindow) {
    // 100% FRESH INCOGNITO PARTITION EVERY TIME
    const incognitoId = 'muse_incognito_' + Date.now();
    const incognitoSession = session.fromPartition(incognitoId, { cache: false });
    
    try {
        await incognitoSession.clearStorageData();
        await incognitoSession.clearCache();
    } catch (e) {
        console.warn('[NativeMuse] Cache clear error:', e.message);
    }

    return new Promise((resolve) => {
        const win = new BrowserWindow({
            width: 580,
            height: 760,
            title: 'Đăng nhập Muse.ai (Cửa sổ Ẩn Danh Mới 100%)',
            parent: parentWindow || undefined,
            modal: false,
            autoHideMenuBar: true,
            webPreferences: {
                partition: incognitoId,
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        win.loadURL('https://muse.ai/login');

        // Check for session cookies on navigation or interval
        const checkInterval = setInterval(async () => {
            try {
                if (win.isDestroyed()) {
                    clearInterval(checkInterval);
                    return;
                }
                const cookies = await incognitoSession.cookies.get({ domain: 'muse.ai' });
                const hasSess = cookies.some(c => c.name === 'hatch_sess');
                if (hasSess) {
                    console.log('[NativeMuse] Incognito login successful! Intercepted session cookie.');
                    clearInterval(checkInterval);

                    const jar = {};
                    cookies.forEach(c => { jar[c.name] = c.value; });
                    await saveMuseCookies(jar);

                    // Auto renew immediately
                    await renewSession();

                    if (!win.isDestroyed()) win.close();
                    resolve({ success: true, cookies: jar });
                }
            } catch (e) {
                console.warn('[NativeMuse] Login check error:', e);
            }
        }, 1200);

        win.on('closed', () => {
            clearInterval(checkInterval);
            resolve({ success: false, closed: true });
        });
    });
}

/**
 * Open external Google Chrome in Incognito mode
 */
function openExternalChromeIncognito(url = 'https://muse.ai/login') {
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(process.env.PROGRAMFILES || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) {
            const flag = p.toLowerCase().includes('edge') ? '-inprivate' : '--incognito';
            require('child_process').spawn(p, [flag, url], { detached: true, stdio: 'ignore' }).unref();
            return { success: true, browser: p };
        }
    }
    return { success: false, error: 'Không tìm thấy Google Chrome trên máy' };
}

/**
 * Ensure the background headless worker window is ready
 */
async function getWorkerWindow() {
    if (activeWorkerWindow && !activeWorkerWindow.isDestroyed()) {
        return activeWorkerWindow;
    }

    activeWorkerWindow = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
            partition: PARTITION_NAME,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    await activeWorkerWindow.loadURL(NEW_THREAD_URL);
    return activeWorkerWindow;
}

/**
 * Handle OpenAI-compatible Chat Completion using Muse Assistant
 */
async function handleChatCompletions(body) {
    const messages = body.messages || [];
    const prompt = messages
        .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
        .join('\n\n');

    const resultText = await executeMuseAutomation(prompt, 'chat');
    return {
        id: 'chatcmpl-muse-' + Date.now().toString(36),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'muse-chat',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: resultText
                },
                finish_reason: 'stop'
            }
        ],
        usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 }
    };
}

/**
 * Handle Image Generation
 */
async function handleImageGeneration(body) {
    const prompt = body.prompt || '';
    const imageUrl = await executeMuseAutomation(prompt, 'image');

    return {
        created: Math.floor(Date.now() / 1000),
        data: [
            {
                url: imageUrl,
                revised_prompt: prompt
            }
        ]
    };
}

/**
 * Handle Video Generation Task
 */
async function handleVideoGeneration(body) {
    const prompt = body.prompt || '';
    const videoUrl = await executeMuseAutomation(prompt, 'video');

    return {
        id: 'task-muse-' + Date.now().toString(36),
        status: 'completed',
        created_at: Math.floor(Date.now() / 1000),
        video_url: videoUrl,
        output: {
            url: videoUrl
        }
    };
}

/**
 * In-Page execution via Electron webContents
 */
async function executeMuseAutomation(prompt, kind = 'chat') {
    while (isWorkerBusy) {
        await new Promise(r => setTimeout(r, 500));
    }
    isWorkerBusy = true;

    try {
        const win = await getWorkerWindow();
        const wc = win.webContents;

        // Navigate to new thread
        await win.loadURL(NEW_THREAD_URL);
        await new Promise(r => setTimeout(r, 2000));

        // Inject prompt into textarea and click submit
        const script = `
        (async () => {
            const ta = document.querySelector('textarea');
            if (!ta) return { ok: false, error: 'Textarea not found' };
            
            // Set value and trigger input events
            ta.value = ${JSON.stringify(prompt)};
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            
            await new Promise(r => setTimeout(r, 300));
            
            // Look for send button or press Enter
            const btn = document.querySelector('button[type="submit"]') || 
                        document.querySelector('button[aria-label*="Send" i]') ||
                        ta.parentElement.querySelector('button');
            
            if (btn && !btn.disabled) {
                btn.click();
            } else {
                ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            }
            return { ok: true };
        })()
        `;

        const injected = await wc.executeJavaScript(script);
        if (!injected || !injected.ok) {
            throw new Error(`Không thể nhập prompt vào Muse: ${injected?.error || 'Unknown'}`);
        }

        // Wait for response bubble or media
        const maxWaitSec = kind === 'video' ? 180 : (kind === 'image' ? 60 : 45);
        const startTime = Date.now();

        while ((Date.now() - startTime) < (maxWaitSec * 1000)) {
            await new Promise(r => setTimeout(r, 1500));

            const checkScript = `
            (() => {
                // Check for videos
                const video = document.querySelector('video source') || document.querySelector('video');
                if (video && video.src && !video.src.startsWith('blob:')) {
                    return { done: true, type: 'video', url: video.src };
                }

                // Check for generated images
                const imgs = Array.from(document.querySelectorAll('img[src*="musecdn"], img[src*="cloudflare"], img[src*="storage"]'));
                if (imgs.length > 0) {
                    const lastImg = imgs[imgs.length - 1];
                    if (lastImg.src) return { done: true, type: 'image', url: lastImg.src };
                }

                // Check for text assistant bubbles
                const bubbles = Array.from(document.querySelectorAll('div[class*="hatch-agent-bubble-bg"], div[data-testid*="agent-bubble"]'));
                if (bubbles.length > 0) {
                    const text = bubbles[bubbles.length - 1].innerText.trim();
                    const isStopVisible = !!document.querySelector('button[aria-label*="Stop" i]');
                    if (text && !isStopVisible) {
                        return { done: true, type: 'text', text };
                    }
                }

                return { done: false };
            })()
            `;

            const status = await wc.executeJavaScript(checkScript);
            if (status && status.done) {
                if (kind === 'chat') return status.text || 'Hoàn tất kịch bản.';
                if (kind === 'image' || kind === 'video') return status.url || status.text || '';
            }
        }

        throw new Error(`Quá thời gian chờ Muse tạo ${kind} (${maxWaitSec}s).`);
    } finally {
        isWorkerBusy = false;
    }
}

/**
 * Return list of models for GET /v1/models
 */
function getModelsList() {
    return {
        object: 'list',
        data: [
            { id: 'muse-chat', object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'muse-native' },
            { id: 'muse-image', object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'muse-native' },
            { id: 'muse-video', object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'muse-native' }
        ]
    };
}

module.exports = {
    getMuseCookies,
    saveMuseCookies,
    renewSession,
    startKeepalive,
    openLoginWindow,
    openExternalChromeIncognito,
    handleChatCompletions,
    handleImageGeneration,
    handleVideoGeneration,
    getModelsList,
    getStatus: async () => {
        const cookies = await getMuseCookies();
        return {
            configured: !!cookies['hatch_sess'],
            hasDeviceAuth: !!cookies['hatch_native_auth_device']
        };
    }
};
