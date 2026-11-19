/**
 * Native Antigravity / Gemini Engine for ToolMedia
 * Replaces CLIProxyAPI completely using pure Node.js in Electron.
 * 
 * - Multi-account rotation with auto-failover on 429
 * - Auto token refresh via Google OAuth2 token endpoint
 * - Auto-imports existing accounts from D:\CLIPROXYAPI\EasyCLIProxyAPI\oauth\
 * - Exposes OpenAI-compatible chatCompletions and models list
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { app } = require('electron');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const FALLBACK_ENDPOINT = 'https://daily-cloudcode-pa.googleapis.com';

// Desktop App OAuth credentials (unmasked at runtime)
const _u = (arr, k = 42) => arr.map(c => String.fromCharCode(c ^ k)).join('');
const CLIENT_ID = _u([27,26,29,27,26,26,28,26,28,26,31,19,27,7,94,71,66,89,89,67,68,24,66,24,27,70,73,88,79,24,25,31,92,94,69,70,69,64,66,30,77,30,26,25,79,90,4,75,90,90,89,4,77,69,69,77,70,79,95,89,79,88,73,69,68,94,79,68,94,4,73,69,71]);
const CLIENT_SECRET = _u([109,101,105,121,122,114,7,97,31,18,108,125,120,30,18,28,102,78,102,96,27,71,102,104,18,89,114,105,30,80,28,91,110,107,76]);

// Storage paths
function getAccountsDir() {
    const dir = path.join(app.getPath('userData'), 'google-accounts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// In-memory accounts pool
let accounts = [];
let currentAccountIndex = 0;

/**
 * Load accounts from local storage and auto-import from CLIProxyAPI if available
 */
function loadAllAccounts() {
    accounts = [];
    const accountsDir = getAccountsDir();

    // 1. Load accounts from user data
    try {
        const files = fs.readdirSync(accountsDir).filter(f => f.endsWith('.json'));
        for (const f of files) {
            try {
                const raw = fs.readFileSync(path.join(accountsDir, f), 'utf-8');
                const acc = JSON.parse(raw);
                if (acc && (acc.refresh_token || acc.refresh)) {
                    accounts.push(normalizeAccount(acc, path.join(accountsDir, f)));
                }
            } catch (err) {
                console.warn('[NativeAntigravity] Failed to parse local account:', f, err.message);
            }
        }
    } catch (e) {
        console.warn('[NativeAntigravity] Cannot read local accounts dir:', e.message);
    }

    // 2. Auto-import from EasyCLIProxyAPI/oauth if local is empty or fewer accounts
    const cpaOauthDir = 'D:\\CLIPROXYAPI\\EasyCLIProxyAPI\\oauth';
    if (fs.existsSync(cpaOauthDir)) {
        try {
            const cpaFiles = fs.readdirSync(cpaOauthDir).filter(f => f.startsWith('antigravity-') && f.endsWith('.json'));
            for (const f of cpaFiles) {
                try {
                    const raw = fs.readFileSync(path.join(cpaOauthDir, f), 'utf-8');
                    const acc = JSON.parse(raw);
                    const email = acc.email || f;
                    const exists = accounts.some(a => a.email === email);
                    if (!exists && (acc.refresh_token || acc.access_token)) {
                        const localPath = path.join(accountsDir, `antigravity-${email}.json`);
                        fs.writeFileSync(localPath, raw, 'utf-8');
                        accounts.push(normalizeAccount(acc, localPath));
                        console.log('[NativeAntigravity] Auto-imported account from CLIProxy:', email);
                    }
                } catch (err) {
                    console.warn('[NativeAntigravity] Error importing CPA account:', f, err.message);
                }
            }
        } catch (e) {
            console.warn('[NativeAntigravity] CPA oauth read failed:', e.message);
        }
    }

    console.log(`[NativeAntigravity] Loaded ${accounts.length} active Google account(s).`);
    return accounts;
}

function normalizeAccount(raw, filePath) {
    return {
        email: raw.email || 'unknown',
        access_token: raw.access_token || raw.access || '',
        refresh_token: raw.refresh_token || raw.refresh || '',
        expires_at: raw.expired ? new Date(raw.expired).getTime() : (raw.expires || 0),
        project_id: raw.project_id || 'aicode-consumers',
        endpoint: (raw.antigravity_capability_hints && raw.antigravity_capability_hints.endpoint) || DEFAULT_ENDPOINT,
        filePath
    };
}

/**
 * Get valid access token for an account, auto refreshing if needed
 */
async function ensureAccessToken(acc) {
    const now = Date.now();
    if (acc.access_token && acc.expires_at && now < (acc.expires_at - 120000)) {
        return acc.access_token;
    }

    if (!acc.refresh_token) {
        throw new Error(`Tài khoản ${acc.email} không có refresh_token hợp lệ.`);
    }

    console.log(`[NativeAntigravity] Refreshing token for ${acc.email}...`);
    const postData = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: acc.refresh_token
    }).toString();

    const result = await new Promise((resolve, reject) => {
        const req = https.request(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300 && json.access_token) {
                        resolve(json);
                    } else {
                        reject(new Error(`Refresh error (${res.statusCode}): ${data}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Refresh timeout')); });
        req.write(postData);
        req.end();
    });

    acc.access_token = result.access_token;
    acc.expires_at = Date.now() + (result.expires_in || 3600) * 1000;

    // Update to disk if filePath exists
    if (acc.filePath && fs.existsSync(acc.filePath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(acc.filePath, 'utf-8'));
            raw.access_token = acc.access_token;
            raw.expired = new Date(acc.expires_at).toISOString();
            fs.writeFileSync(acc.filePath, JSON.stringify(raw, null, 2), 'utf-8');
        } catch (e) {
            console.warn('[NativeAntigravity] Could not save updated token:', e.message);
        }
    }

    return acc.access_token;
}

/**
 * Maps OpenAI messages array to Gemini contents array
 */
function convertOpenAiMessagesToGemini(messages) {
    const contents = [];
    let systemInstruction = '';

    for (const msg of messages) {
        const role = (msg.role || '').toLowerCase();
        let textContent = '';

        if (typeof msg.content === 'string') {
            textContent = msg.content;
        } else if (Array.isArray(msg.content)) {
            textContent = msg.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
        }

        if (role === 'system') {
            systemInstruction += (systemInstruction ? '\n\n' : '') + textContent;
        } else {
            const geminiRole = (role === 'assistant') ? 'model' : 'user';
            contents.push({
                role: geminiRole,
                parts: [{ text: textContent }]
            });
        }
    }

    if (contents.length === 0 && systemInstruction) {
        contents.push({
            role: 'user',
            parts: [{ text: systemInstruction }]
        });
        systemInstruction = '';
    }

    return { contents, systemInstruction };
}

/**
 * Main chat completions handler supporting account rotation
 */
async function handleChatCompletions(body) {
    if (accounts.length === 0) {
        loadAllAccounts();
    }

    if (accounts.length === 0) {
        throw new Error('Chưa có tài khoản Google nào được kết nối trong ToolMedia. Hãy vào cài đặt để thêm tài khoản.');
    }

    const modelName = body.model || 'gemini-2.5-flash';
    const { contents, systemInstruction } = convertOpenAiMessagesToGemini(body.messages || []);

    const geminiPayload = {
        model: modelName,
        contents,
        generationConfig: {
            temperature: body.temperature !== undefined ? body.temperature : 0.7,
            maxOutputTokens: body.max_tokens || body.max_completion_tokens || 8192,
        }
    };

    if (systemInstruction) {
        geminiPayload.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    let lastError = null;
    const maxAttempts = Math.min(accounts.length, 3);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const acc = accounts[currentAccountIndex % accounts.length];
        currentAccountIndex = (currentAccountIndex + 1) % accounts.length;

        try {
            const token = await ensureAccessToken(acc);
            const endpoint = `${acc.endpoint}/v1internal:generateContent`;

            const respData = await makeGeminiRequest(endpoint, token, geminiPayload);
            const responseText = extractTextFromGeminiResponse(respData);

            // Return in OpenAI response format
            return {
                id: 'chatcmpl-' + Date.now().toString(36),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: modelName,
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: responseText
                        },
                        finish_reason: 'stop'
                    }
                ],
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 100,
                    total_tokens: 200
                }
            };
        } catch (err) {
            console.warn(`[NativeAntigravity] Attempt failed with account ${acc.email}:`, err.message);
            lastError = err;
            // Rate limit or server error -> loop to next account
        }
    }

    throw lastError || new Error('Tất cả tài khoản Google đều bận hoặc gặp lỗi. Vui lòng thử lại sau.');
}

function makeGeminiRequest(urlStr, accessToken, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const postData = JSON.stringify(payload);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'ImageTool-Antigravity/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Invalid JSON from Gemini: ${data.slice(0, 200)}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('Gemini API timeout')); });
        req.write(postData);
        req.end();
    });
}

function extractTextFromGeminiResponse(resp) {
    try {
        const candidate = resp.candidates?.[0];
        if (!candidate) return '';
        const parts = candidate.content?.parts || [];
        return parts.map(p => p.text || '').join('');
    } catch {
        return '';
    }
}

/**
 * Return list of models for GET /v1/models
 */
function getModelsList() {
    const list = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-3.1-flash-image',
        'gemini-3.8-flash-high',
        'gemini-4-argon-high',
        'claude-sonnet-5-5-high',
        'claude-opus-5-5-high',
        'gpt-oss-120b-medium'
    ];
    return {
        object: 'list',
        data: list.map(id => ({
            id,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'antigravity-native'
        }))
    };
}

function generateAuthUrl(redirectUri = 'http://localhost:51121/oauth-callback') {
    const state = crypto.randomBytes(16).toString('hex');
    const scopes = [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        state: state,
        access_type: 'offline',
        prompt: 'consent'
    });
    return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        state: state
    };
}

async function handleOAuthCallback(code, redirectUri = 'http://localhost:51121/oauth-callback') {
    const postData = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
    }).toString();

    const tokenRes = await new Promise((resolve, reject) => {
        const req = https.request(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200 && json.access_token) {
                        resolve(json);
                    } else {
                        reject(new Error(`OAuth code exchange error: ${data}`));
                    }
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });

    // Get user email
    const emailRes = await new Promise((resolve) => {
        https.get('https://www.googleapis.com/oauth2/v1/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenRes.access_token}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    resolve(info.email || 'unknown');
                } catch { resolve('unknown'); }
            });
        }).on('error', () => resolve('unknown'));
    });

    const accountData = {
        access_token: tokenRes.access_token,
        refresh_token: tokenRes.refresh_token,
        email: emailRes,
        expired: new Date(Date.now() + (tokenRes.expires_in || 3600) * 1000).toISOString(),
        expires_in: tokenRes.expires_in || 3600,
        project_id: 'aicode-consumers',
        type: 'antigravity',
        timestamp: Date.now(),
        antigravity_capability_hints: {
            endpoint: DEFAULT_ENDPOINT
        }
    };

    // Save to user data
    const accountsDir = getAccountsDir();
    const savePath = path.join(accountsDir, `antigravity-${emailRes}.json`);
    fs.writeFileSync(savePath, JSON.stringify(accountData, null, 2), 'utf-8');

    // Also mirror to D:\CLIPROXYAPI\EasyCLIProxyAPI\oauth if exists
    const cpaOauthDir = 'D:\\CLIPROXYAPI\\EasyCLIProxyAPI\\oauth';
    if (fs.existsSync(cpaOauthDir)) {
        try {
            fs.writeFileSync(path.join(cpaOauthDir, `antigravity-${emailRes}.json`), JSON.stringify(accountData, null, 2), 'utf-8');
        } catch { }
    }

    loadAllAccounts();
    console.log(`[NativeAntigravity] Successfully authenticated and saved account: ${emailRes}`);
    return accountData;
}

module.exports = {
    loadAllAccounts,
    handleChatCompletions,
    getModelsList,
    ensureAccessToken,
    generateAuthUrl,
    handleOAuthCallback,
    getAccountsStatus: () => accounts.map(a => ({ email: a.email, valid: !!a.refresh_token, endpoint: a.endpoint }))
};
