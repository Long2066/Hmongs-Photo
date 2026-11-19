/**
 * Native Muse Engine for ToolMedia
 * Replaces muse2api completely using Electron's native Chromium, Session, and Account Pooling.
 * 
 * - Multi-account storage with auto-rotation across accounts
 * - Auto-imports existing accounts from D:\muse2api-main\data\accounts.json
 * - Automatic Keepalive Heartbeat & Cloud VM Pre-Wake every 10 minutes
 * - In-app visual 1-click login window (captures cookies and adds to account pool)
 * - OpenAI compatible /v1/chat/completions, /v1/images/generations, /v1/tasks/videos
 */

const { BrowserWindow, session, app } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');

const MUSE_SITE = 'https://muse.ai';
const SESSION_API = `${MUSE_SITE}/api/session`;
const VM_WAKE_API = `${MUSE_SITE}/api/hatch/vm/wake`;
const NEW_THREAD_URL = `${MUSE_SITE}/thread/new`;

const PARTITION_NAME = 'persist:muse_session';
let keepaliveTimer = null;
let activeWorkerWindow = null;
let isWorkerBusy = false;

// Account pool
let museAccounts = [];
let currentAccountIndex = 0;

function getAccountsFilePath() {
    return path.join(app.getPath('userData'), 'muse_accounts.json');
}

function getLegacyCookieBackupPath() {
    return path.join(app.getPath('userData'), 'muse_cookies.json');
}

/**
 * Load all Muse accounts from userData/muse_accounts.json,
 * auto-importing from D:\muse2api-main\data\accounts.json if available.
 */
function loadAllAccounts() {
    museAccounts = [];
    const accountsPath = getAccountsFilePath();

    // 1. Read from userData/muse_accounts.json
    if (fs.existsSync(accountsPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
            if (Array.isArray(raw)) {
                museAccounts = raw.filter(a => a && a.cookies && a.cookies.hatch_sess);
            }
        } catch (e) {
            console.warn('[NativeMuse] Error parsing local muse_accounts.json:', e.message);
        }
    }

    // 2. Auto-import from D:\muse2api-main\data\accounts.json if available
    const muse2apiPath = 'D:\\muse2api-main\\data\\accounts.json';
    if (fs.existsSync(muse2apiPath)) {
        try {
            const m2aAccounts = JSON.parse(fs.readFileSync(muse2apiPath, 'utf-8'));
            if (Array.isArray(m2aAccounts)) {
                for (const mAcc of m2aAccounts) {
                    if (!mAcc || !mAcc.cookies || !mAcc.cookies.hatch_sess) continue;
                    const sess = mAcc.cookies.hatch_sess;
                    const exists = museAccounts.some(a => a.cookies && a.cookies.hatch_sess === sess);
                    if (!exists) {
                        const label = mAcc.label || mAcc.id || `Acc Muse ${museAccounts.length + 1}`;
                        museAccounts.push({
                            id: mAcc.id || 'acc_' + Math.random().toString(36).slice(2, 10),
                            label,
                            cookies: mAcc.cookies,
                            status: mAcc.status || 'active',
                            created_at: mAcc.created_at || Date.now()
                        });
                        console.log('[NativeMuse] Auto-imported account from muse2api:', label);
                    }
                }
            }
        } catch (e) {
            console.warn('[NativeMuse] Error importing from muse2api accounts.json:', e.message);
        }
    }

    // 3. Fallback: check legacy muse_cookies.json
    const legacyPath = getLegacyCookieBackupPath();
    if (fs.existsSync(legacyPath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
            if (saved && saved.hatch_sess) {
                const exists = museAccounts.some(a => a.cookies && a.cookies.hatch_sess === saved.hatch_sess);
                if (!exists) {
                    museAccounts.push({
                        id: 'acc_legacy_' + Date.now().toString(36),
                        label: 'Tài khoản chính',
                        cookies: saved,
                        status: 'active',
                        created_at: Date.now()
                    });
                }
            }
        } catch (e) { }
    }

    saveAllAccounts();
    console.log(`[NativeMuse] Loaded ${museAccounts.length} active Muse account(s).`);
    return museAccounts;
}

function saveAllAccounts() {
    try {
        fs.writeFileSync(getAccountsFilePath(), JSON.stringify(museAccounts, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[NativeMuse] Error saving muse_accounts.json:', e.message);
    }
}

function getMuseSession() {
    return session.fromPartition(PARTITION_NAME);
}

/**
 * Get cookies of the primary or current active account
 */
async function getMuseCookies() {
    if (museAccounts.length === 0) loadAllAccounts();
    if (museAccounts.length > 0) {
        return museAccounts[0].cookies;
    }
    return {};
}

/**
 * Save new cookies into the account pool (adds new account or updates existing)
 */
async function saveMuseCookies(cookieMap, label = '') {
    if (!cookieMap || !cookieMap.hatch_sess) return;
    if (museAccounts.length === 0) loadAllAccounts();

    const existing = museAccounts.find(a => a.cookies && a.cookies.hatch_sess === cookieMap.hatch_sess);
    if (existing) {
        existing.cookies = { ...existing.cookies, ...cookieMap };
        if (label) existing.label = label;
        existing.status = 'active';
        existing.updated_at = Date.now();
    } else {
        const id = 'acc_' + Math.random().toString(36).slice(2, 10);
        const name = label || `Muse ${museAccounts.length + 1}`;
        museAccounts.push({
            id,
            label: name,
            cookies: cookieMap,
            status: 'active',
            created_at: Date.now()
        });
        console.log('[NativeMuse] Added new Muse account to pool:', name);
    }

    saveAllAccounts();

    // Also inject into active session
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
        } catch (e) { }
    }
}

/**
 * Renew session and wake VM for a single account
 */
function renewAccountSession(acc) {
    return new Promise((resolve) => {
        const cookieHeader = Object.entries(acc.cookies || {})
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

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
            res.on('end', () => {
                const setCookies = res.headers['set-cookie'];
                if (setCookies && Array.isArray(setCookies)) {
                    for (const sc of setCookies) {
                        const parts = sc.split(';')[0].split('=');
                        if (parts.length >= 2) {
                            acc.cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
                        }
                    }
                }

                // Check VM state and pre-wake if needed
                try {
                    const body = JSON.parse(data);
                    if (body && body.vm_id && body.vm_state !== 'RUNNING') {
                        wakeMuseVm(body.vm_id, cookieHeader);
                    }
                } catch (e) { }

                resolve({ ok: res.statusCode === 200, status: res.statusCode });
            });
        });

        req.on('error', (err) => resolve({ ok: false, error: err.message }));
        req.setTimeout(12000, () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        req.end();
    });
}

/**
 * Heartbeat: Renew sessions for all accounts in the pool
 */
async function renewSession() {
    if (museAccounts.length === 0) loadAllAccounts();
    if (museAccounts.length === 0) {
        return { ok: false, message: 'Chưa có tài khoản Muse nào' };
    }

    console.log(`[NativeMuse] Heartbeat: renewing sessions for ${museAccounts.length} account(s)...`);
    for (const acc of museAccounts) {
        if (!acc.cookies || !acc.cookies.hatch_sess) continue;
        try {
            await renewAccountSession(acc);
        } catch (e) {
            console.warn(`[NativeMuse] Error renewing ${acc.label}:`, e.message);
        }
    }
    saveAllAccounts();
    return { ok: true, count: museAccounts.length };
}

/**
 * Pre-wake Muse Cloud VM to keep it running and eliminate wake latency
 */
function wakeMuseVm(vmId, cookieHeader) {
    try {
        const payload = JSON.stringify({
            vm_id: vmId,
            retry_count: 0,
            connect_attempt_id: require('crypto').randomUUID()
        });
        const req = https.request(VM_WAKE_API, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Referer': NEW_THREAD_URL,
                'Cookie': cookieHeader,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            console.log(`[NativeMuse] Pre-waking cloud VM ${vmId} -> HTTP ${res.statusCode}`);
        });
        req.on('error', () => { });
        req.write(payload);
        req.end();
    } catch (e) { }
}

/**
 * Start periodic keepalive heartbeat (every 10 minutes)
 */
function startKeepalive(intervalMs = 10 * 60 * 1000) {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => {
        renewSession().catch(e => console.warn('[NativeMuse] Heartbeat catch:', e));
    }, intervalMs);

    // Initial load and renewal
    loadAllAccounts();
    setTimeout(() => {
        renewSession().then(res => {
            if (res && res.ok) {
                getWorkerWindow().catch(() => { });
            }
        }).catch(() => { });
    }, 5000);
    console.log('[NativeMuse] Multi-Account Keep-Alive Heartbeat activated.');
}

/**
 * In-app Visual Login Window for Muse.ai
 * Opens a 100% brand new, isolated Incognito session every single time.
 * Appends new account into the pool instead of overwriting existing accounts!
 */
async function openLoginWindow(parentWindow) {
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

        const checkInterval = setInterval(async () => {
            try {
                if (win.isDestroyed()) {
                    clearInterval(checkInterval);
                    return;
                }
                const cookies = await incognitoSession.cookies.get({ domain: 'muse.ai' });
                const hasSess = cookies.some(c => c.name === 'hatch_sess');
                if (hasSess) {
                    clearInterval(checkInterval);

                    const jar = {};
                    cookies.forEach(c => { jar[c.name] = c.value; });

                    const newLabel = `Muse Acc ${museAccounts.length + 1}`;
                    await saveMuseCookies(jar, newLabel);
                    console.log('[NativeMuse] Successfully intercepted & added account to pool:', newLabel);

                    await renewSession();

                    if (!win.isDestroyed()) win.close();
                    resolve({ success: true, cookies: jar, accountsCount: museAccounts.length });
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
 * In-Page execution via Electron webContents with Multi-Account Rotation
 */
async function executeMuseAutomation(prompt, kind = 'chat') {
    while (isWorkerBusy) {
        await new Promise(r => setTimeout(r, 400));
    }
    isWorkerBusy = true;

    try {
        if (museAccounts.length === 0) loadAllAccounts();
        if (museAccounts.length === 0) {
            throw new Error('Chưa có tài khoản Muse nào được nạp cookie trong ToolMedia. Hãy vào cài đặt để thêm tài khoản.');
        }

        // Rotate through accounts
        const acc = museAccounts[currentAccountIndex % museAccounts.length];
        currentAccountIndex = (currentAccountIndex + 1) % museAccounts.length;
        console.log(`[NativeMuse] Executing ${kind} using account: ${acc.label} (${currentAccountIndex}/${museAccounts.length})`);

        const win = await getWorkerWindow();
        const wc = win.webContents;
        const ses = win.webContents.session;

        // Apply account cookies into session
        for (const [name, value] of Object.entries(acc.cookies || {})) {
            if (!value) continue;
            try {
                await ses.cookies.set({
                    url: MUSE_SITE,
                    name,
                    value,
                    domain: '.muse.ai',
                    path: '/',
                    secure: true,
                    sameSite: 'lax'
                });
            } catch (e) { }
        }

        // Navigate to new thread
        if (wc.getURL() !== NEW_THREAD_URL) {
            await win.loadURL(NEW_THREAD_URL);
        }

        // Dynamically wait for textarea to appear (up to 6s, 100ms intervals)
        const script = `
        (async () => {
            let waited = 0;
            while (!document.querySelector('textarea') && waited < 6000) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
            const ta = document.querySelector('textarea');
            if (!ta) return { ok: false, error: 'Textarea not found' };
            
            // Set value and trigger input events
            ta.value = ${JSON.stringify(prompt)};
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            
            await new Promise(r => setTimeout(r, 150));
            
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

        // Wait for response bubble or media with fast 750ms polling
        const maxWaitSec = kind === 'video' ? 180 : (kind === 'image' ? 60 : 45);
        const startTime = Date.now();

        while ((Date.now() - startTime) < (maxWaitSec * 1000)) {
            await new Promise(r => setTimeout(r, 750));

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
    loadAllAccounts,
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
        if (museAccounts.length === 0) loadAllAccounts();
        return {
            configured: museAccounts.length > 0,
            accountsCount: museAccounts.length,
            accounts: museAccounts.map(a => ({
                id: a.id,
                label: a.label || a.id,
                valid: !!(a.cookies && a.cookies['hatch_sess']),
                status: a.status || 'active'
            }))
        };
    }
};
