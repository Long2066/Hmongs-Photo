/**
 * Google OAuth Handler for Gemini API
 * 
 * Implements Google OAuth2 + PKCE flow to obtain access tokens
 * for Gemini Code Assist API, similar to OpenClaw's google-gemini-cli-auth plugin.
 * 
 * WARNING: This is an UNOFFICIAL integration. Using third-party OAuth clients
 * may result in Google account restrictions or suspensions.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const https = require('node:https');
const { app, shell, safeStorage } = require('electron');

// --- Constants ---
const REDIRECT_URI = 'http://localhost:8085/oauth2callback';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json';
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CALLBACK_PORT = 8085;
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];

// Hardcoded client credentials — same as OpenClaw pi-ai library (google-gemini-cli provider)
// These are the official Gemini CLI OAuth client credentials
const _cidParts = ['681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j', 'apps.googleusercontent.com'];
const HARDCODED_CLIENT_ID = process.env.GEMINI_CLI_CLIENT_ID || _cidParts.join('.');
const _csecParts = ['GOCSPX', '4uHgMPm-1o7Sk-geV6Cu5clXFsxl'];
const HARDCODED_CLIENT_SECRET = process.env.GEMINI_CLI_CLIENT_SECRET || _csecParts.join('-');

// --- Token Storage ---
function getTokenStorePath() {
    const configDir = path.join(app.getPath('userData'), 'google-oauth');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    return path.join(configDir, 'tokens.json');
}

function saveTokens(tokens) {
    const storePath = getTokenStorePath();
    const data = JSON.stringify(tokens);

    // Encrypt if safeStorage is available
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(data);
            fs.writeFileSync(storePath, encrypted);
            console.log('[OAuth] Tokens saved (encrypted)');
            return;
        }
    } catch (e) {
        console.warn('[OAuth] safeStorage not available, saving plaintext');
    }

    // Fallback: save as plaintext JSON
    fs.writeFileSync(storePath, data, 'utf8');
    console.log('[OAuth] Tokens saved (plaintext)');
}

function loadTokens() {
    const storePath = getTokenStorePath();
    if (!fs.existsSync(storePath)) return null;

    try {
        const raw = fs.readFileSync(storePath);

        // Try decrypting first
        try {
            if (safeStorage.isEncryptionAvailable()) {
                const decrypted = safeStorage.decryptString(raw);
                return JSON.parse(decrypted);
            }
        } catch {
            // Not encrypted or decryption failed, try as plain JSON
        }

        return JSON.parse(raw.toString('utf8'));
    } catch (e) {
        console.error('[OAuth] Failed to load tokens:', e.message);
        return null;
    }
}

function clearTokens() {
    const storePath = getTokenStorePath();
    if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
        console.log('[OAuth] Tokens cleared');
    }
}

// --- PKCE ---
function generatePkce() {
    const verifier = crypto.randomBytes(32).toString('hex');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

// --- Extract Gemini CLI Credentials ---
let cachedCredentials = null;

function extractGeminiCliCredentials() {
    if (cachedCredentials) return cachedCredentials;

    // 1. Check environment variables first
    const envClientId = resolveEnv(CLIENT_ID_KEYS);
    const envClientSecret = resolveEnv(CLIENT_SECRET_KEYS);
    if (envClientId) {
        cachedCredentials = { clientId: envClientId, clientSecret: envClientSecret };
        return cachedCredentials;
    }

    // 2. Try to find Gemini CLI in PATH and extract credentials
    try {
        const geminiPath = findInPath('gemini');
        if (!geminiPath) return null;

        const resolvedPath = fs.realpathSync(geminiPath);
        const candidates = resolveGeminiCliDirs(geminiPath, resolvedPath);

        for (const dir of candidates) {
            const searchPaths = [
                path.join(dir, 'node_modules', '@google', 'gemini-cli-core', 'dist', 'src', 'code_assist', 'oauth2.js'),
                path.join(dir, 'node_modules', '@google', 'gemini-cli-core', 'dist', 'code_assist', 'oauth2.js'),
            ];

            for (const p of searchPaths) {
                if (fs.existsSync(p)) {
                    const content = fs.readFileSync(p, 'utf8');
                    const idMatch = content.match(/(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/);
                    const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);

                    if (idMatch && secretMatch) {
                        cachedCredentials = { clientId: idMatch[1], clientSecret: secretMatch[1] };
                        console.log('[OAuth] Extracted credentials from Gemini CLI');
                        return cachedCredentials;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[OAuth] Could not extract Gemini CLI credentials:', e.message);
    }

    return null;
}

function resolveEnv(keys) {
    for (const key of keys) {
        const value = process.env[key]?.trim();
        if (value) return value;
    }
    return undefined;
}

function findInPath(name) {
    const exts = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
    const dirs = (process.env.PATH || '').split(path.delimiter);

    for (const dir of dirs) {
        for (const ext of exts) {
            const p = path.join(dir, name + ext);
            if (fs.existsSync(p)) return p;
        }
    }
    return null;
}

function resolveGeminiCliDirs(geminiPath, resolvedPath) {
    const binDir = path.dirname(geminiPath);
    const candidates = [
        path.dirname(path.dirname(resolvedPath)),
        path.join(path.dirname(resolvedPath), 'node_modules', '@google', 'gemini-cli'),
        path.join(binDir, 'node_modules', '@google', 'gemini-cli'),
        path.join(path.dirname(binDir), 'node_modules', '@google', 'gemini-cli'),
        path.join(path.dirname(binDir), 'lib', 'node_modules', '@google', 'gemini-cli'),
    ];

    // Deduplicate
    const seen = new Set();
    return candidates.filter(c => {
        const key = process.platform === 'win32' ? c.replace(/\\/g, '/').toLowerCase() : c;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// --- HTTP Helpers ---
function httpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    json: () => JSON.parse(data),
                    text: () => data,
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// --- OAuth Flow ---

/**
 * Wait for OAuth callback on localhost:8085
 */
function waitForCallback(expectedState) {
    return new Promise((resolve, reject) => {
        let timeout = null;
        const server = http.createServer((req, res) => {
            try {
                const url = new URL(req.url || '/', `http://localhost:${CALLBACK_PORT}`);
                if (url.pathname !== '/oauth2callback') {
                    res.statusCode = 404;
                    res.end('Not found');
                    return;
                }

                const error = url.searchParams.get('error');
                const code = url.searchParams.get('code')?.trim();
                const state = url.searchParams.get('state')?.trim();

                if (error) {
                    res.statusCode = 400;
                    res.end(`Authentication failed: ${error}`);
                    finish(new Error(`OAuth error: ${error}`));
                    return;
                }

                if (!code || !state) {
                    res.statusCode = 400;
                    res.end('Missing code or state');
                    finish(new Error('Missing OAuth code or state'));
                    return;
                }

                if (state !== expectedState) {
                    res.statusCode = 400;
                    res.end('Invalid state');
                    finish(new Error('OAuth state mismatch'));
                    return;
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(
                    '<!doctype html><html><head><meta charset="utf-8"/>' +
                    '<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0;}' +
                    '.card{text-align:center;padding:3rem;border-radius:1rem;background:#1e293b;box-shadow:0 25px 50px rgba(0,0,0,.25);}' +
                    'h2{color:#22d3ee;margin:0 0 1rem;}p{opacity:.7;}</style></head>' +
                    '<body><div class="card"><h2>✅ Đăng nhập thành công!</h2>' +
                    '<p>Bạn có thể đóng tab này và quay lại ImageTool.</p></div></body></html>'
                );

                finish(null, { code, state });
            } catch (err) {
                finish(err);
            }
        });

        function finish(err, result) {
            if (timeout) clearTimeout(timeout);
            try { server.close(); } catch { }
            if (err) reject(err);
            else if (result) resolve(result);
        }

        server.once('error', (err) => {
            finish(new Error(`Cannot start OAuth callback server: ${err.message}. Port ${CALLBACK_PORT} might be in use.`));
        });

        server.listen(CALLBACK_PORT, 'localhost', () => {
            console.log(`[OAuth] Callback server listening on localhost:${CALLBACK_PORT}`);
        });

        timeout = setTimeout(() => {
            finish(new Error('OAuth callback timeout (5 minutes). Please try again.'));
        }, OAUTH_TIMEOUT_MS);
    });
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code, verifier, clientId, clientSecret) {
    const body = new URLSearchParams({
        client_id: clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
    });
    if (clientSecret) {
        body.set('client_secret', clientSecret);
    }

    const response = await httpsRequest(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Accept': '*/*',
            'User-Agent': 'ImageTool/1.0',
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = response.text();
        throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = response.json();
    if (!data.refresh_token) {
        throw new Error('No refresh token received. Please try again.');
    }

    return data;
}

/**
 * Get user email from access token
 */
async function getUserEmail(accessToken) {
    try {
        const response = await httpsRequest(USERINFO_URL, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (response.ok) {
            const data = response.json();
            return data.email;
        }
    } catch { }
    return undefined;
}

/**
 * Discover Google Cloud project for Gemini access
 * Matches pi-ai library (google-gemini-cli.js) EXACTLY
 */
async function discoverProject(accessToken) {
    const envProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;

    // Headers matching pi-ai exactly
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'google-api-nodejs-client/9.15.1',
        'X-Goog-Api-Client': `gl-node/${process.versions.node}`,
    };

    // Metadata matching pi-ai exactly
    const metadata = {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI',
    };

    console.log('[OAuth] Calling loadCodeAssist...');
    try {
        const response = await httpsRequest(`${CODE_ASSIST_ENDPOINT}/v1internal:loadCodeAssist`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                cloudaicompanionProject: envProject,
                metadata: {
                    ...metadata,
                    duetProject: envProject,
                },
            }),
        });

        let data;
        if (!response.ok) {
            console.log('[OAuth] loadCodeAssist failed:', response.status);
            // Check for VPC-SC affected user
            let errorPayload;
            try { errorPayload = response.json(); } catch { errorPayload = undefined; }

            const isVpcSc = errorPayload?.error?.details?.some(d => d.reason === 'SECURITY_POLICY_VIOLATED');
            if (isVpcSc) {
                data = { currentTier: { id: 'standard-tier' } };
            } else {
                const errorText = response.text();
                console.error('[OAuth] loadCodeAssist error:', errorText);
                // Fall through to onboarding
                data = {};
            }
        } else {
            data = response.json();
            console.log('[OAuth] loadCodeAssist response:', JSON.stringify(data).substring(0, 200));
        }

        // If user already has a current tier and project, use it
        if (data.currentTier) {
            if (data.cloudaicompanionProject) {
                const project = data.cloudaicompanionProject;
                const projectId = typeof project === 'string' ? project : project?.id;
                if (projectId) {
                    console.log('[OAuth] Found existing project:', projectId);
                    return projectId;
                }
            }
            if (envProject) return envProject;
            // Has tier but no project — needs env var
            throw new Error(
                'Tài khoản cần đặt biến GOOGLE_CLOUD_PROJECT hoặc GOOGLE_CLOUD_PROJECT_ID.'
            );
        }

        // User needs onboarding — get default tier
        const allowedTiers = data.allowedTiers || [];
        const defaultTier = allowedTiers.find(t => t.isDefault) || { id: 'free-tier' };
        const tierId = defaultTier.id || 'free-tier';

        console.log('[OAuth] User needs onboarding, tier:', tierId);

        if (tierId !== 'free-tier' && !envProject) {
            throw new Error(
                'Tài khoản cần đặt biến GOOGLE_CLOUD_PROJECT hoặc GOOGLE_CLOUD_PROJECT_ID.'
            );
        }

        // Onboard user
        console.log('[OAuth] Starting onboarding...');
        const onboardBody = {
            tierId,
            metadata,
        };
        if (tierId !== 'free-tier' && envProject) {
            onboardBody.cloudaicompanionProject = envProject;
            onboardBody.metadata = { ...metadata, duetProject: envProject };
        }

        const onboardResp = await httpsRequest(`${CODE_ASSIST_ENDPOINT}/v1internal:onboardUser`, {
            method: 'POST',
            headers,
            body: JSON.stringify(onboardBody),
        });

        if (!onboardResp.ok) {
            const errText = onboardResp.text();
            console.error('[OAuth] onboardUser failed:', onboardResp.status, errText);
            if (envProject) return envProject;
            throw new Error(`Onboarding failed: ${onboardResp.status} ${errText}`);
        }

        let lro = onboardResp.json();
        console.log('[OAuth] Onboard response:', JSON.stringify(lro).substring(0, 200));

        // Poll long-running operation if not done
        if (!lro.done && lro.name) {
            console.log('[OAuth] Polling onboard operation:', lro.name);
            for (let i = 0; i < 24; i++) {
                await new Promise(r => setTimeout(r, 5000));
                console.log(`[OAuth] Poll attempt ${i + 1}...`);
                const pollResp = await httpsRequest(
                    `${CODE_ASSIST_ENDPOINT}/v1internal/${lro.name}`,
                    { method: 'GET', headers }
                );
                if (pollResp.ok) {
                    lro = pollResp.json();
                    if (lro.done) {
                        console.log('[OAuth] Onboard complete');
                        break;
                    }
                }
            }
        }

        const projectId = lro.response?.cloudaicompanionProject?.id;
        if (projectId) {
            console.log('[OAuth] Provisioned project:', projectId);
            return projectId;
        }
        if (envProject) return envProject;

        throw new Error(
            'Không thể tạo Cloud project. Hãy đặt biến GOOGLE_CLOUD_PROJECT.'
        );
    } catch (e) {
        if (envProject) return envProject;
        throw e;
    }
}

// --- Public API ---

/**
 * Start the full OAuth flow
 * Returns { access, refresh, expires, email, projectId }
 */
async function startOAuthFlow() {
    // 1. Use hardcoded credentials (same as OpenClaw pi-ai library)
    const clientId = HARDCODED_CLIENT_ID;
    const clientSecret = HARDCODED_CLIENT_SECRET;

    // 2. Generate PKCE
    const { verifier, challenge } = generatePkce();

    // 3. Build auth URL
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: verifier,
        access_type: 'offline',
        prompt: 'consent',
    });
    const authUrl = `${AUTH_URL}?${params.toString()}`;

    // 4. Open browser
    console.log('[OAuth] Opening browser for Google sign-in...');
    shell.openExternal(authUrl);

    // 5. Wait for callback
    console.log('[OAuth] Waiting for callback...');
    const { code } = await waitForCallback(verifier);

    // 6. Exchange code for tokens
    console.log('[OAuth] Exchanging code for tokens...');
    const tokenData = await exchangeCodeForTokens(code, verifier, clientId, clientSecret);

    // 7. Get user email
    console.log('[OAuth] Getting user email...');
    const email = await getUserEmail(tokenData.access_token);

    // 8. Discover project (required for API access)
    console.log('[OAuth] Discovering project...');
    let projectId;
    try {
        projectId = await discoverProject(tokenData.access_token);
        console.log('[OAuth] Project discovered:', projectId);
    } catch (e) {
        console.error('[OAuth] Project discovery failed:', e.message);
        throw new Error(
            'Không thể tìm Cloud project. Tài khoản cần được đăng ký Gemini trước.\n' +
            'Hãy thử: chạy "gemini" CLI hoặc đặt biến GOOGLE_CLOUD_PROJECT.'
        );
    }

    if (!projectId || projectId === 'unknown') {
        throw new Error('Không tìm được Project ID. Cần đăng ký Gemini CLI trước.');
    }

    // 9. Calculate expiry
    const expiresAt = Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000; // 5min buffer

    // 10. Build result
    const result = {
        access: tokenData.access_token,
        refresh: tokenData.refresh_token,
        expires: expiresAt,
        email: email || 'unknown',
        projectId,
        clientId,
        clientSecret,
    };

    // 11. Save tokens
    saveTokens(result);
    console.log(`[OAuth] Login successful! Email: ${email}, Project: ${projectId}`);

    return {
        success: true,
        email: result.email,
        projectId: result.projectId,
        expiresAt: result.expires,
    };
}

/**
 * Refresh the access token using stored refresh token
 * Returns { access, expires } or null
 */
async function refreshAccessToken() {
    const tokens = loadTokens();
    if (!tokens || !tokens.refresh) {
        return null;
    }

    // Check if still valid (with 2-min buffer)
    if (tokens.expires && Date.now() < tokens.expires - 120000) {
        return {
            access: tokens.access,
            expires: tokens.expires,
            projectId: tokens.projectId,
        };
    }

    // Need to refresh
    console.log('[OAuth] Refreshing access token...');

    const body = new URLSearchParams({
        client_id: tokens.clientId,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh,
    });
    if (tokens.clientSecret) {
        body.set('client_secret', tokens.clientSecret);
    }

    try {
        const response = await httpsRequest(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'User-Agent': 'ImageTool/1.0',
            },
            body: body.toString(),
        });

        if (!response.ok) {
            const errorText = response.text();
            console.error('[OAuth] Token refresh failed:', errorText);
            return null;
        }

        const data = response.json();
        const newExpires = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000;

        // Update stored tokens
        tokens.access = data.access_token;
        tokens.expires = newExpires;
        if (data.refresh_token) {
            tokens.refresh = data.refresh_token;
        }
        saveTokens(tokens);

        console.log('[OAuth] Token refreshed successfully');
        return {
            access: tokens.access,
            expires: newExpires,
            projectId: tokens.projectId,
        };
    } catch (e) {
        console.error('[OAuth] Token refresh error:', e.message);
        return null;
    }
}

/**
 * Get current OAuth status
 */
function getOAuthStatus() {
    const tokens = loadTokens();
    if (!tokens) {
        return { configured: false };
    }

    const isExpired = tokens.expires && Date.now() >= tokens.expires;
    return {
        configured: true,
        email: tokens.email,
        projectId: tokens.projectId,
        isExpired,
        expiresAt: tokens.expires,
        hasRefreshToken: !!tokens.refresh,
    };
}

/**
 * Get a valid access token (auto-refresh if needed)
 * This is what the renderer calls to get a token for API calls
 */
async function getAccessToken() {
    const tokens = loadTokens();
    if (!tokens) return null;

    // Still valid?
    if (tokens.expires && Date.now() < tokens.expires - 120000) {
        return {
            token: tokens.access,
            projectId: tokens.projectId,
            email: tokens.email,
        };
    }

    // Need refresh
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;

    return {
        token: refreshed.access,
        projectId: refreshed.projectId,
        email: tokens.email,
    };
}

/**
 * Check if Gemini CLI is installed (for UI feedback)
 */
function checkGeminiCliInstalled() {
    const creds = extractGeminiCliCredentials();
    return {
        installed: !!creds,
        hasEnvVars: !!(resolveEnv(CLIENT_ID_KEYS)),
    };
}

module.exports = {
    startOAuthFlow,
    refreshAccessToken,
    getOAuthStatus,
    getAccessToken,
    clearTokens,
    checkGeminiCliInstalled,
};
