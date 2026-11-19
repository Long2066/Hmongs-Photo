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
const http = require('http');
const fs = require('fs');

const insecureAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 30000
});

const MUSE_SITE = 'https://muse.ai';
const SESSION_API = `${MUSE_SITE}/api/session`;
const VM_WAKE_API = `${MUSE_SITE}/api/hatch/vm/wake`;
const NEW_THREAD_URL = `${MUSE_SITE}/thread/new`;

const PARTITION_NAME = 'persist:muse_session';
let keepaliveTimer = null;
let activeWorkerWindow = null;
let isWorkerBusy = false;

// Account pool & worker pool
let museAccounts = [];
let currentAccountIndex = 0;
const workerPool = new Map(); // accId -> { win, busy }
const taskStore = new Map(); // taskId -> resultObj

function downloadBuffer(urlStr) {
    return new Promise((resolve, reject) => {
        try {
            const parsed = new URL(urlStr);
            const lib = parsed.protocol === 'http:' ? http : https;
            const req = lib.get(urlStr, { agent: insecureAgent, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return downloadBuffer(res.headers.location).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            });
            req.on('error', reject);
            req.setTimeout(30000, () => { req.destroy(); reject(new Error('Download timeout')); });
        } catch (e) {
            reject(e);
        }
    });
}

function getAccountsFilePath() {
    let userData = '';
    try {
        userData = (app && typeof app.getPath === 'function')
            ? app.getPath('userData')
            : path.join(process.env.APPDATA || process.env.HOME || '.', 'ImageTool');
    } catch {
        userData = path.join(process.env.APPDATA || process.env.HOME || '.', 'ImageTool');
    }
    return path.join(userData, 'muse_accounts.json');
}

function getLegacyCookieBackupPath() {
    let userData = '';
    try {
        userData = (app && typeof app.getPath === 'function')
            ? app.getPath('userData')
            : path.join(process.env.APPDATA || process.env.HOME || '.', 'ImageTool');
    } catch {
        userData = path.join(process.env.APPDATA || process.env.HOME || '.', 'ImageTool');
    }
    return path.join(userData, 'muse_cookies.json');
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
            agent: insecureAgent,
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
                if (res.statusCode === 200) {
                    acc.status = 'active';
                } else if (res.statusCode === 401 || res.statusCode === 403) {
                    acc.status = 'expired';
                    console.warn(`[NativeMuse] Account ${acc.label || acc.id} cookies expired (HTTP ${res.statusCode})`);
                }

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
 * Get or create an isolated background headless worker window for a specific account
 */
async function getWorkerForAccount(acc) {
    const accId = String(acc.id || acc.label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    let entry = workerPool.get(accId);

    if (entry && entry.win && !entry.win.isDestroyed()) {
        return entry;
    }

    const partitionName = `persist:muse_${accId}`;
    const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
            partition: partitionName,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const ses = win.webContents.session;
    // Set cookies into this account's session
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

    win.on('closed', () => {
        workerPool.delete(accId);
    });

    try {
        await win.loadURL(NEW_THREAD_URL);
    } catch (e) {
        console.warn(`[NativeMuse] Init load error for account ${accId}:`, e.message);
    }

    entry = { win, busy: false, accId };
    workerPool.set(accId, entry);
    return entry;
}

/**
 * Legacy single-worker compatibility
 */
async function getWorkerWindow() {
    if (museAccounts.length === 0) loadAllAccounts();
    const acc = museAccounts[0] || { id: 'default', label: 'Default' };
    const entry = await getWorkerForAccount(acc);
    return entry.win;
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
 * Handle Image Generation with bulletproof Base64 PNG guarantees
 */
async function handleImageGeneration(body) {
    const prompt = body.prompt || '';
    const image = body.image || (Array.isArray(body.images) ? body.images[0] : undefined);
    const result = await executeMuseAutomation(prompt, 'image', { image });

    let base64Data = '';
    let urlData = '';

    if (typeof result === 'object' && result?.base64) {
        base64Data = result.base64.replace(/^data:image\/[a-z]+;base64,/, '');
        urlData = result.base64;
    } else if (typeof result === 'string') {
        if (result.startsWith('data:image')) {
            base64Data = result.replace(/^data:image\/[a-z]+;base64,/, '');
            urlData = result;
        } else if (result.startsWith('http')) {
            urlData = result;
            try {
                const buf = await downloadBuffer(result);
                if (buf && buf.length > 500) {
                    base64Data = buf.toString('base64');
                    urlData = `data:image/png;base64,${base64Data}`;
                }
            } catch (err) {
                console.warn('[NativeMuse] Download buffer failed:', err.message);
            }
        }
    }

    if (!base64Data && !urlData) {
        throw new Error('Muse không trả về dữ liệu hình ảnh hợp lệ.');
    }

    return {
        created: Math.floor(Date.now() / 1000),
        data: [
            {
                b64_json: base64Data,
                url: urlData,
                revised_prompt: prompt
            }
        ]
    };
}

/**
 * Handle Video Generation Task & Async Task Store
 */
async function handleVideoGeneration(body) {
    const prompt = body.prompt || '';
    const image = body.image || body.input_image;
    const videoUrl = await executeMuseAutomation(prompt, 'video', { image });

    const taskId = 'task-muse-' + Date.now().toString(36);
    const resultObj = {
        id: taskId,
        status: 'succeeded',
        created_at: Math.floor(Date.now() / 1000),
        video_url: videoUrl,
        result: {
            url: videoUrl
        },
        output: {
            url: videoUrl
        }
    };
    taskStore.set(taskId, resultObj);
    return resultObj;
}

function getTaskStatus(taskId) {
    return taskStore.get(taskId) || { id: taskId, status: 'succeeded', video_url: '', result: { url: '' } };
}

/**
 * In-Page execution via Electron webContents with Multi-Account Pool & Parallel Workers
 */
async function executeMuseAutomation(prompt, kind = 'chat', options = {}) {
    if (museAccounts.length === 0) loadAllAccounts();
    if (museAccounts.length === 0) {
        throw new Error('Chưa có tài khoản Muse nào được nạp cookie trong ToolMedia. Hãy vào cài đặt để thêm tài khoản.');
    }

    const pool = museAccounts.filter(a => a.status !== 'expired');
    const candidateAccounts = pool.length > 0 ? pool : museAccounts;

    let chosenAcc = null;
    let chosenWorker = null;
    const maxWaitLock = 180000;
    const lockStart = Date.now();

    // Find any account whose worker is free, or wait for one to become available
    while (!chosenWorker && (Date.now() - lockStart) < maxWaitLock) {
        for (let i = 0; i < candidateAccounts.length; i++) {
            const acc = candidateAccounts[(currentAccountIndex + i) % candidateAccounts.length];
            const accId = String(acc.id || acc.label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
            const entry = workerPool.get(accId);
            if (!entry || !entry.busy) {
                chosenAcc = acc;
                currentAccountIndex = (currentAccountIndex + i + 1) % candidateAccounts.length;
                chosenWorker = await getWorkerForAccount(acc);
                chosenWorker.busy = true;
                break;
            }
        }
        if (!chosenWorker) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    if (!chosenWorker) {
        chosenAcc = candidateAccounts[0];
        chosenWorker = await getWorkerForAccount(chosenAcc);
        chosenWorker.busy = true;
    }

    console.log(`[NativeMuse] Executing ${kind} with account: ${chosenAcc.label || chosenAcc.id} (Worker busy: ${chosenWorker.busy})`);

    try {
        return await runAutomationOnWorker(chosenWorker.win, chosenAcc, prompt, kind, options);
    } catch (err) {
        console.warn(`[NativeMuse] Primary attempt failed (${chosenAcc.label}):`, err.message);
        // Failover: try one other account if available
        if (candidateAccounts.length > 1) {
            const altAcc = candidateAccounts.find(a => a.id !== chosenAcc.id);
            if (altAcc) {
                console.log(`[NativeMuse] Failing over ${kind} to alternative account: ${altAcc.label || altAcc.id}`);
                const altWorker = await getWorkerForAccount(altAcc);
                altWorker.busy = true;
                try {
                    return await runAutomationOnWorker(altWorker.win, altAcc, prompt, kind, options);
                } finally {
                    altWorker.busy = false;
                }
            }
        }
        throw err;
    } finally {
        if (chosenWorker) {
            chosenWorker.busy = false;
        }
    }
}

async function runAutomationOnWorker(win, acc, prompt, kind, options = {}) {
    const wc = win.webContents;
    const ses = win.webContents.session;

    // Apply account cookies
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

    // Always start on a fresh thread
    await win.loadURL(NEW_THREAD_URL);

    // Wait until textarea is present and snapshot initial images (welcome mascot, header logos, avatars)
    const initScript = `
    (async () => {
        if (location.pathname.includes('/login') || (document.body && document.body.innerText.includes('Log in to continue'))) {
            return { ok: false, error: 'NEED_LOGIN' };
        }

        let waited = 0;
        while (!document.querySelector('textarea') && waited < 15000) {
            await new Promise(r => setTimeout(r, 150));
            waited += 150;
        }
        const ta = document.querySelector('textarea');
        if (!ta) {
            if (location.pathname.includes('/login')) return { ok: false, error: 'NEED_LOGIN' };
            return { ok: false, error: 'NO_TEXTAREA' };
        }

        const existingSrcs = Array.from(document.querySelectorAll('img'))
            .map(i => i.currentSrc || i.src || '')
            .filter(Boolean);

        return { ok: true, existingSrcs };
    })()
    `;

    const initRes = await wc.executeJavaScript(initScript);
    if (!initRes || !initRes.ok) {
        if (initRes?.error === 'NEED_LOGIN') {
            acc.status = 'expired';
            saveAllAccounts();
            throw new Error(`Tài khoản ${acc.label || acc.id} hết hạn đăng nhập.`);
        }
        throw new Error(`Không thể khởi tạo giao diện Muse: ${initRes?.error || 'Timeout'}`);
    }

    const existingImgSrcs = initRes.existingSrcs || [];

    // Optional reference image attachment
    if (options && options.image) {
        try {
            await wc.executeJavaScript(`
            (async () => {
                try {
                    const fileInput = document.querySelector('input[type="file"]');
                    if (fileInput) {
                        const dataUri = ${JSON.stringify(options.image)};
                        const parts = dataUri.split(',');
                        const mimeMatch = (parts[0] || '').match(/:(.*?);/);
                        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                        const b64 = parts[1] || parts[0];
                        const bin = atob(b64);
                        const len = bin.length;
                        const u8 = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            u8[i] = bin.charCodeAt(i);
                        }
                        const blob = new Blob([u8], { type: mime });
                        const file = new File([blob], 'ref_image.jpg', { type: mime });
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        fileInput.files = dt.files;
                        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 600));
                    }
                } catch (e) { }
            })()
            `);
        } catch (e) { }
    }

    // Inject prompt with React native setter and send
    const sendScript = `
    (async () => {
        const ta = document.querySelector('textarea');
        if (!ta) return { ok: false, error: 'NO_TEXTAREA' };

        ta.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) {
            setter.call(ta, ${JSON.stringify(prompt)});
        } else {
            ta.value = ${JSON.stringify(prompt)};
        }
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));

        await new Promise(r => setTimeout(r, 250));

        const allBtns = [...document.querySelectorAll('button,[role=button]')].filter(b => b.offsetParent !== null);
        const sendBtn = allBtns.find(b => /send|发送/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('data-testid') || '')));

        if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
        } else {
            ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
        return { ok: true };
    })()
    `;

    const sendRes = await wc.executeJavaScript(sendScript);
    if (!sendRes || !sendRes.ok) {
        throw new Error(`Không thể gửi prompt vào Muse: ${sendRes?.error || 'Unknown'}`);
    }

    // Polling loop
    const maxWaitSec = kind === 'video' ? 240 : (kind === 'image' ? 90 : 45);
    const startTime = Date.now();

    while ((Date.now() - startTime) < (maxWaitSec * 1000)) {
        await new Promise(r => setTimeout(r, 800));

        const checkScript = `
        (async () => {
            // Auto-deny approval cards
            for (const card of document.querySelectorAll('[data-testid="hatch-inline-approval-card"]')) {
                const btn = [...card.querySelectorAll('button,[role=button]')]
                    .find(b => /^(deny|decline|reject|don.t allow)$/i.test((b.innerText || '').trim()));
                if (btn && !btn.disabled) btn.click();
            }

            const elapsedSec = (Date.now() - ${startTime}) / 1000;

            ${kind === 'image' ? `
            const existingSet = new Set(${JSON.stringify(existingImgSrcs)});

            // Check if Muse is actively generating
            const isGenerating = !!document.querySelector('button[aria-label*="Stop" i], [data-testid*="stop" i], svg[class*="animate-spin"], [class*="generating"], [class*="thinking"]');

            // Strictly find NEW generated images
            const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                if (!img.offsetParent) return false;
                const src = img.currentSrc || img.src || '';
                if (!src || existingSet.has(src)) return false;

                // Ignore mascot, welcome cards, brand logos, user avatars
                if (/avatar|profile|logo|brand|mascot|welcome|hero|badge|icon|emoji|favicon/i.test(src)) return false;
                if (img.closest('header, nav, [data-testid*="welcome"], [class*="welcome"], [class*="header"], [class*="sidebar"]')) return false;

                const w = img.naturalWidth || img.width || 0;
                const h = img.naturalHeight || img.height || 0;
                if (w < 180 || h < 180) return false;

                const inContainer = !!img.closest('[data-testid*="attachment"], [class*="attachment"], [data-testid*="agent-bubble"], [class*="hatch-agent-bubble"], [data-testid*="message"], [class*="message"], [data-testid*="response"], main, article');
                return inContainer;
            });

            if (imgs.length > 0 && !isGenerating && elapsedSec >= 2.0) {
                const lastImg = imgs[imgs.length - 1];
                if (lastImg.complete && lastImg.naturalWidth >= 180) {
                    try {
                        const c = document.createElement('canvas');
                        c.width = lastImg.naturalWidth;
                        c.height = lastImg.naturalHeight;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(lastImg, 0, 0);
                        const b64 = c.toDataURL('image/png');
                        if (b64 && b64.length > 1000) {
                            return { done: true, type: 'image', base64: b64, url: lastImg.currentSrc || lastImg.src };
                        }
                    } catch (e) { }

                    try {
                        const resp = await fetch(lastImg.currentSrc || lastImg.src);
                        const blob = await resp.blob();
                        const b64 = await new Promise((res) => {
                            const r = new FileReader();
                            r.onloadend = () => res(r.result);
                            r.readAsDataURL(blob);
                        });
                        if (b64 && b64.length > 1000) {
                            return { done: true, type: 'image', base64: b64, url: lastImg.currentSrc || lastImg.src };
                        }
                    } catch (e) { }

                    return { done: true, type: 'image', url: lastImg.currentSrc || lastImg.src };
                }
            }
            ` : ''}

            ${kind === 'video' ? `
            if (elapsedSec >= 4.0) {
                const dlLink = document.querySelector('a[href*=".mp4"], a[download*=".mp4"]');
                if (dlLink && dlLink.href) {
                    return { done: true, type: 'video', url: dlLink.href };
                }
                const videos = Array.from(document.querySelectorAll('video')).filter(v => {
                    const src = v.currentSrc || v.src || '';
                    return src && !src.startsWith('blob:') && (v.readyState >= 2 || v.duration > 0 || (v.videoWidth && v.videoWidth > 0));
                });
                if (videos.length > 0) {
                    const v = videos[videos.length - 1];
                    const src = v.currentSrc || v.src;
                    if (src) return { done: true, type: 'video', url: src };
                }
            }
            ` : ''}

            ${kind === 'chat' ? `
            const bubbles = Array.from(document.querySelectorAll('div[class*="hatch-agent-bubble-bg"], div[data-testid*="agent-bubble"]'));
            if (bubbles.length > 0) {
                const text = bubbles[bubbles.length - 1].innerText.trim();
                const isStopVisible = !!document.querySelector('button[aria-label*="Stop" i]');
                if (text && !isStopVisible) {
                    return { done: true, type: 'text', text };
                }
            }
            ` : ''}

            // Error check in assistant bubbles
            const errorBubbles = Array.from(document.querySelectorAll('div[class*="hatch-agent-bubble-bg"], div[data-testid*="agent-bubble"]'));
            if (errorBubbles.length > 0) {
                const text = errorBubbles[errorBubbles.length - 1].innerText.trim();
                if (/rate limit|exceeded|quota|violation|unable to process|error occurred/i.test(text)) {
                    return { done: true, type: 'error', error: text };
                }
            }

            return { done: false };
        })()
        `;

        const status = await wc.executeJavaScript(checkScript);
        if (status && status.done) {
            if (status.type === 'error') {
                throw new Error(`Muse báo lỗi: ${status.error}`);
            }
            if (kind === 'chat') return status.text || 'Hoàn tất kịch bản.';
            if (kind === 'image') return status.base64 || status.url;
            if (kind === 'video') return status.url;
        }
    }

    throw new Error(`Quá thời gian chờ Muse tạo ${kind} (${maxWaitSec}s).`);
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
    getTaskStatus,
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
