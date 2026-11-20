/**
 * Standalone Muse Gateway Process Manager for ToolMedia Electron
 * Manages the self-contained muse-gateway.exe binary on port 18610.
 * Requires ZERO external Python or Git installations on any Windows machine.
 */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

let museProcess = null;
let isStarting = false;
let isStopping = false;

function findBinary() {
    const candidates = [
        // 1. Packaged Electron extraResource
        process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'muse-gateway', 'muse-gateway.exe') : null,
        // 2. Relative to electron folder
        path.join(__dirname, 'bin', 'muse-gateway', 'muse-gateway.exe'),
        // 3. Dev root paths
        'D:\\ToolMedia\\electron\\bin\\muse-gateway\\muse-gateway.exe',
        'D:\\ToolMedia\\dist\\muse-gateway\\muse-gateway.exe',
        'D:\\muse2api-main\\dist\\muse-gateway\\muse-gateway.exe'
    ];

    for (const p of candidates) {
        if (p && typeof p === 'string' && fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

function getDataDir() {
    let base = '';
    try {
        base = (app && typeof app.getPath === 'function')
            ? app.getPath('userData')
            : path.join(process.env.APPDATA || '.', 'ImageTool');
    } catch {
        base = path.join(process.env.APPDATA || '.', 'ImageTool');
    }

    const dataDir = path.join(base, 'muse-data');
    if (!fs.existsSync(dataDir)) {
        try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { }
    }

    // Ensure api_key file exists with default 123456
    const keyFile = path.join(dataDir, 'api_key');
    if (!fs.existsSync(keyFile)) {
        try { fs.writeFileSync(keyFile, '123456\n', 'utf8'); } catch (e) { }
    }

    // Ensure accounts.json exists by copying template if missing
    const accFile = path.join(dataDir, 'accounts.json');
    if (!fs.existsSync(accFile)) {
        const templateCandidates = [
            process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'muse-gateway', 'data', 'accounts.json') : null,
            path.join(__dirname, 'bin', 'muse-gateway', 'data', 'accounts.json'),
            'D:\\ToolMedia\\electron\\bin\\muse-gateway\\data\\accounts.json',
            'D:\\muse2api-main\\data\\accounts.json'
        ];
        for (const t of templateCandidates) {
            if (t && typeof t === 'string' && fs.existsSync(t)) {
                try {
                    fs.copyFileSync(t, accFile);
                    console.log(`[MuseManager] Seeded accounts.json from ${t}`);
                    break;
                } catch (e) { }
            }
        }
    }

    return dataDir;
}

function killPort18610() {
    try {
        const stdout = execSync('netstat -ano | findstr :18610', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5 && parts[1].includes(':18610') && parts[3] === 'LISTENING') {
                const pid = parseInt(parts[parts.length - 1], 10);
                if (pid && pid > 0 && pid !== process.pid) {
                    pids.add(pid);
                }
            }
        }
        for (const pid of pids) {
            try {
                console.log(`[MuseManager] Reclaiming port 18610: killing stale PID ${pid}`);
                execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            } catch (e) { }
        }
    } catch { }
}

function checkModelsEndpoint(timeoutMs = 1500) {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:18610/v1/models', {
            timeout: timeoutMs,
            headers: { 'Authorization': 'Bearer 123456' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ ok: true, models: parsed.data || [] });
                        return;
                    } catch { }
                }
                resolve({ ok: false, status: res.statusCode });
            });
        });
        req.on('error', () => resolve({ ok: false }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    });
}

async function start() {
    if (isStarting) return;
    isStarting = true;

    try {
        // First check if already responding
        const alreadyRunning = await checkModelsEndpoint(800);
        if (alreadyRunning.ok) {
            console.log('[MuseManager] muse-gateway is already running and active on port 18610.');
            isStarting = false;
            return true;
        }

        const exePath = findBinary();
        if (!exePath) {
            console.warn('[MuseManager] muse-gateway.exe binary not found.');
            isStarting = false;
            return false;
        }

        killPort18610();

        const dataDir = getDataDir();
        console.log(`[MuseManager] Spawning muse-gateway: ${exePath}`);
        console.log(`[MuseManager] Using data directory: ${dataDir}`);

        const childEnv = {
            ...process.env,
            MUSE2API_HOST: '127.0.0.1',
            MUSE2API_PORT: '18610',
            MUSE2API_API_KEY: '123456',
            MUSE2API_ADMIN_KEY: '123456',
            MUSE2API_DATA_DIR: dataDir,
            MUSE2API_DRIVER: 'browser',
            MUSE2API_CDP_PORT: '19210',
            MUSE2API_HEADLESS: 'true',
            PYTHONUNBUFFERED: '1'
        };

        museProcess = spawn(exePath, [], {
            cwd: path.dirname(exePath),
            env: childEnv,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        museProcess.stdout.on('data', (d) => {
            const str = d.toString().trim();
            if (str) console.log(`[MuseGateway] ${str}`);
        });

        museProcess.stderr.on('data', (d) => {
            const str = d.toString().trim();
            if (str && !str.includes('DeprecationWarning')) {
                console.log(`[MuseGateway err] ${str}`);
            }
        });

        museProcess.on('exit', (code, sig) => {
            console.log(`[MuseManager] muse-gateway exited with code=${code}, sig=${sig}`);
            museProcess = null;
        });

        // Wait up to 30 seconds for port 18610 to become ready
        for (let attempt = 1; attempt <= 60; attempt++) {
            await new Promise(r => setTimeout(r, 500));
            const check = await checkModelsEndpoint(600);
            if (check.ok) {
                console.log(`[MuseManager] muse-gateway ready on http://127.0.0.1:18610 (models=${check.models.length})`);
                isStarting = false;
                return true;
            }
        }

        console.warn('[MuseManager] muse-gateway did not respond on port 18610 within 30 seconds.');
    } catch (e) {
        console.error('[MuseManager] Failed to start muse-gateway:', e);
    } finally {
        isStarting = false;
    }
    return false;
}

function stop() {
    if (isStopping) return;
    isStopping = true;
    console.log('[MuseManager] Stopping muse-gateway...');

    if (museProcess && museProcess.pid) {
        try {
            execSync(`taskkill /F /T /PID ${museProcess.pid}`, { stdio: 'ignore' });
        } catch { }
        museProcess = null;
    }

    // Also cleanly clean up port 18610
    killPort18610();
    isStopping = false;
}

function normalizeCookies(input) {
    let cookieMap = {};
    if (!input) return { cookieMap, cookieString: '' };

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return normalizeCookies(JSON.parse(trimmed));
            } catch (e) { }
        }
        // Header string: key=value; key2=value2
        const parts = trimmed.split(/[;\n]+/);
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart || !trimmedPart.includes('=')) continue;
            const eqIdx = trimmedPart.indexOf('=');
            const k = trimmedPart.slice(0, eqIdx).trim();
            const v = trimmedPart.slice(eqIdx + 1).trim();
            if (k) cookieMap[k] = v;
        }
    } else if (Array.isArray(input)) {
        for (const item of input) {
            if (item && item.name) {
                cookieMap[String(item.name).trim()] = String(item.value || '').trim();
            }
        }
    } else if (typeof input === 'object' && input !== null) {
        if (Array.isArray(input.cookies)) {
            return normalizeCookies(input.cookies);
        }
        for (const [k, v] of Object.entries(input)) {
            if (k && v !== undefined && v !== null) {
                cookieMap[String(k).trim()] = String(v).trim();
            }
        }
    }

    const cookieString = Object.entries(cookieMap)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    return { cookieMap, cookieString };
}

async function getStatus() {
    const check = await checkModelsEndpoint(1000);
    const dataDir = getDataDir();
    const accPath = path.join(dataDir, 'accounts.json');

    let accounts = [];
    if (fs.existsSync(accPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(accPath, 'utf8'));
            if (Array.isArray(raw)) {
                accounts = raw;
            }
        } catch { }
    }

    // Try fetching live accounts from admin API if running
    if (check.ok) {
        try {
            const adminData = await new Promise((resolve) => {
                const req = http.get('http://127.0.0.1:18610/admin/accounts', {
                    timeout: 1200,
                    headers: { 'Authorization': 'Bearer 123456' }
                }, (res) => {
                    let buf = '';
                    res.on('data', d => buf += d);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(buf);
                            resolve(parsed.data || []);
                        } catch { resolve(null); }
                    });
                });
                req.on('error', () => resolve(null));
                req.on('timeout', () => { req.destroy(); resolve(null); });
            });
            if (Array.isArray(adminData) && adminData.length > 0) {
                accounts = adminData;
            }
        } catch { }
    }

    const activeCount = accounts.filter(a => a.status === 'active' || (a.enabled !== false && a.status !== 'invalid' && a.status !== 'expired')).length;
    const hasActive = activeCount > 0;

    return {
        configured: check.ok && accounts.length > 0,
        running: check.ok,
        engine: 'muse-gateway-standalone',
        port: 18610,
        accountsCount: accounts.length,
        activeAccountsCount: activeCount,
        hasActiveAccounts: hasActive,
        modelsCount: check.models ? check.models.length : 0,
        accounts: accounts.map(a => ({
            id: a.id,
            label: a.label || a.id,
            status: a.status || 'unknown',
            valid: a.status === 'active',
            last_error: a.last_error || null
        }))
    };
}

async function saveMuseCookies(cookieInput) {
    const { cookieMap, cookieString } = normalizeCookies(cookieInput);
    if (!cookieString || Object.keys(cookieMap).length === 0) {
        throw new Error('Chuỗi cookie không hợp lệ hoặc rỗng. Vui lòng kiểm tra lại.');
    }

    const nowSec = Date.now() / 1000;
    const accountLabel = `ImageTool-${new Date().toLocaleDateString('vi-VN')}`;

    // 1. Persist directly to accounts.json in dataDir
    const dataDir = getDataDir();
    const accPath = path.join(dataDir, 'accounts.json');
    let list = [];
    if (fs.existsSync(accPath)) {
        try { list = JSON.parse(fs.readFileSync(accPath, 'utf8')); } catch { }
    }
    if (!Array.isArray(list)) list = [];

    // Check if account with same hatch_sess exists
    const inputSess = cookieMap['hatch_sess'];
    let matchedIdx = -1;
    if (inputSess) {
        matchedIdx = list.findIndex(a => a.cookies && a.cookies.hatch_sess === inputSess);
    }

    if (matchedIdx >= 0) {
        list[matchedIdx].cookies = { ...(list[matchedIdx].cookies || {}), ...cookieMap };
        list[matchedIdx].status = 'active';
        list[matchedIdx].enabled = true;
        list[matchedIdx].cooldown_until = 0.0;
        list[matchedIdx].last_error = null;
        list[matchedIdx].last_used_at = nowSec;
        list[matchedIdx].label = list[matchedIdx].label || accountLabel;
    } else {
        // Prepend fresh active account at beginning of rotation pool
        list.unshift({
            id: `acc_${Date.now().toString(36)}`,
            label: accountLabel,
            enabled: true,
            status: 'active',
            cookies: cookieMap,
            created_at: nowSec,
            last_used_at: nowSec,
            cooldown_until: 0.0,
            last_error: null,
            success_count: 0,
            fail_count: 0,
            meta: {}
        });
    }

    try {
        fs.writeFileSync(accPath, JSON.stringify(list, null, 2), 'utf8');
        console.log(`[MuseManager] Saved ${list.length} accounts to ${accPath}`);
    } catch (writeErr) {
        console.error('[MuseManager] Failed to write accounts.json:', writeErr);
    }

    // 2. Also push to admin API if gateway is running
    const postData = JSON.stringify({
        cookies: cookieString,
        label: accountLabel
    });

    try {
        await new Promise((resolve, reject) => {
            const req = http.request('http://127.0.0.1:18610/admin/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer 123456'
                },
                timeout: 5000
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        console.log('[MuseManager] Successfully pushed account to muse2api admin API.');
    } catch (apiErr) {
        console.warn('[MuseManager] muse2api admin API notification notice (accounts.json is saved):', apiErr.message);
    }

    return { success: true, message: 'Đã lưu và kích hoạt tài khoản Muse thành công!' };
}

function openExternalChromeIncognito(url = 'https://muse.ai/login') {
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const flag = p.toLowerCase().includes('edge') ? '-inprivate' : '--incognito';
            try {
                const proc = spawn(p, [flag, url], { detached: true, stdio: 'ignore' });
                proc.unref();
                return { success: true, browser: path.basename(p) };
            } catch (e) { }
        }
    }

    try {
        const proc = spawn('cmd.exe', ['/c', 'start', '', 'chrome', '--incognito', url], { detached: true, stdio: 'ignore' });
        proc.unref();
        return { success: true, browser: 'cmd' };
    } catch {
        return { success: false, error: 'Không thể mở trình duyệt ngoài.' };
    }
}

function openLoginWindow(parentWindow) {
    return new Promise((resolve) => {
        const loginWin = new BrowserWindow({
            width: 900,
            height: 700,
            parent: parentWindow || undefined,
            modal: false,
            title: 'Đăng nhập Muse.ai - ImageTool',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        loginWin.loadURL('https://muse.ai/login');

        let resolved = false;
        const checkInterval = setInterval(async () => {
            if (loginWin.isDestroyed()) {
                clearInterval(checkInterval);
                if (!resolved) resolve({ success: false, error: 'Cửa sổ đã đóng.' });
                return;
            }

            try {
                const [cookiesDomain, cookiesUrl] = await Promise.all([
                    session.defaultSession.cookies.get({ domain: 'muse.ai' }).catch(() => []),
                    session.defaultSession.cookies.get({ url: 'https://muse.ai' }).catch(() => [])
                ]);
                const combined = [...cookiesDomain, ...cookiesUrl];
                const cookieMap = {};
                for (const c of combined) {
                    if (c && c.name && c.value) {
                        cookieMap[c.name] = c.value;
                    }
                }
                const hasSession = Boolean(cookieMap['hatch_sess']) ||
                    Object.keys(cookieMap).some(k => k.toLowerCase().includes('sess') || k.toLowerCase().includes('auth'));

                if (hasSession && Object.keys(cookieMap).length >= 1) {
                    clearInterval(checkInterval);
                    resolved = true;
                    await saveMuseCookies(cookieMap);
                    loginWin.close();
                    resolve({ success: true, message: 'Đăng nhập thành công và đã đồng bộ tài khoản!' });
                }
            } catch (e) { }
        }, 2000);

        loginWin.on('closed', () => {
            clearInterval(checkInterval);
            if (!resolved) resolve({ success: false, error: 'Cửa sổ đăng nhập đã đóng.' });
        });
    });
}

module.exports = {
    start,
    stop,
    getStatus,
    saveMuseCookies,
    openLoginWindow,
    openExternalChromeIncognito,
    getDataDir,
    checkModelsEndpoint
};
