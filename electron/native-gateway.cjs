/**
 * Native Embedded Gateway for ToolMedia
 * Replaces both CLIProxyAPI (8317) and muse2api (18610) with native Node.js HTTP servers.
 * 
 * - Port 8317: Google Antigravity / Gemini & Claude routing (zero external Go binary)
 * - Port 18610: Muse.ai Image, Video & Chat routing (zero external Python runtime)
 * - 100% In-process, 0 latency, 0 memory overhead
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const nativeAntigravity = require('./native-antigravity-service.cjs');
const nativeMuse = require('./native-muse-service.cjs');

let server8317 = null;
let server18610 = null;

function setCorsHeaders(res, req) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    const reqHeaders = req?.headers?.['access-control-request-headers'] || '*';
    res.setHeader('Access-Control-Allow-Headers', reqHeaders);
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
}

function parseJsonBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

/**
 * Start the Port 8317 server (replaces CLIProxyAPI)
 */
function startAntigravityGateway(port = 8317) {
    if (server8317) return;

    server8317 = http.createServer(async (req, res) => {
        setCorsHeaders(res, req);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = (req.url || '').split('?')[0];

        // Health check
        if (url === '/health' || url === '/v1/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', engine: 'native-antigravity', accounts: nativeAntigravity.getAccountsStatus().length }));
            return;
        }

        // Models list
        if (req.method === 'GET' && (url === '/models' || url === '/v1/models')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(nativeAntigravity.getModelsList()));
            return;
        }

        // Chat completions
        if (req.method === 'POST' && (url === '/chat/completions' || url === '/v1/chat/completions')) {
            try {
                const body = await parseJsonBody(req);
                const response = await nativeAntigravity.handleChatCompletions(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (err) {
                console.error('[Gateway 8317] Chat error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message, type: 'api_error' } }));
            }
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Route not found: ${url}` } }));
    });

    server8317.listen(port, '127.0.0.1', () => {
        console.log(`[NativeGateway] CLIProxy replacement active on http://127.0.0.1:${port}`);
    });

    server8317.on('error', (err) => {
        console.warn(`[NativeGateway] Port ${port} listen warning:`, err.message);
    });
}

/**
 * Start the Port 18610 server (replaces muse2api)
 */
function startMuseGateway(port = 18610) {
    if (server18610) return;

    server18610 = http.createServer(async (req, res) => {
        setCorsHeaders(res, req);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = (req.url || '').split('?')[0];

        // Health check
        if (url === '/health' || url === '/v1/health') {
            const status = await nativeMuse.getStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', engine: 'native-muse', configured: status.configured, accounts: status.accountsCount || (status.configured ? 1 : 0) }));
            return;
        }

        // Models list
        if (req.method === 'GET' && (url === '/models' || url === '/v1/models')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(nativeMuse.getModelsList()));
            return;
        }

        // Chat completions (muse-chat)
        if (req.method === 'POST' && (url === '/chat/completions' || url === '/v1/chat/completions')) {
            try {
                const body = await parseJsonBody(req);
                const response = await nativeMuse.handleChatCompletions(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (err) {
                console.error('[Gateway 18610] Chat error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message, type: 'api_error' } }));
            }
            return;
        }

        // Image generation (muse-image)
        if (req.method === 'POST' && (url === '/images/generations' || url === '/v1/images/generations')) {
            try {
                const body = await parseJsonBody(req);
                const response = await nativeMuse.handleImageGeneration(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (err) {
                console.error('[Gateway 18610] Image gen error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message, type: 'api_error' } }));
            }
            return;
        }

        // Video tasks (muse-video)
        if (req.method === 'POST' && (url === '/tasks/videos' || url === '/v1/tasks/videos' || url === '/videos' || url === '/v1/videos')) {
            try {
                const body = await parseJsonBody(req);
                const response = await nativeMuse.handleVideoGeneration(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (err) {
                console.error('[Gateway 18610] Video gen error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message, type: 'api_error' } }));
            }
            return;
        }

        // Video task polling status (GET /videos/:id or /v1/videos/:id)
        if (req.method === 'GET' && (url.startsWith('/videos/') || url.startsWith('/v1/videos/') || url.startsWith('/tasks/videos/') || url.startsWith('/v1/tasks/videos/'))) {
            const taskId = url.split('/').pop();
            const task = nativeMuse.getTaskStatus(taskId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(task));
            return;
        }

        // Media streaming & download (served from local cache)
        if ((req.method === 'GET' || req.method === 'HEAD') && (url.startsWith('/media/') || url.startsWith('/v1/media/'))) {
            const filename = path.basename(url);
            const mediaDir = nativeMuse.getMediaDirectory();
            const filePath = path.join(mediaDir, filename);
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                const ext = path.extname(filename).toLowerCase();
                const mimeType = ext === '.mp4' ? 'video/mp4' : (ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'));

                const baseHeaders = {
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Cross-Origin-Resource-Policy': 'cross-origin',
                    'Cross-Origin-Embedder-Policy': 'credentialless'
                };

                const range = req.headers.range;
                if (range && ext === '.mp4') {
                    const parts = range.replace(/bytes=/, '').split('-');
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                    const chunksize = (end - start) + 1;

                    res.writeHead(206, {
                        ...baseHeaders,
                        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                        'Content-Length': chunksize
                    });
                    if (req.method === 'HEAD') {
                        res.end();
                    } else {
                        fs.createReadStream(filePath, { start, end }).pipe(res);
                    }
                    return;
                }

                res.writeHead(200, {
                    ...baseHeaders,
                    'Content-Length': stat.size
                });
                if (req.method === 'HEAD') {
                    res.end();
                } else {
                    fs.createReadStream(filePath).pipe(res);
                }
                return;
            } else {
                res.writeHead(404, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cross-Origin-Resource-Policy': 'cross-origin'
                });
                res.end(JSON.stringify({ error: { message: `Media file ${filename} not found` } }));
                return;
            }
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Route not found: ${url}` } }));
    });

    server18610.listen(port, '127.0.0.1', () => {
        console.log(`[NativeGateway] muse2api replacement active on http://127.0.0.1:${port}`);
    });

    server18610.on('error', (err) => {
        console.warn(`[NativeGateway] Port ${port} listen warning:`, err.message);
    });
}

function startAll() {
    try {
        nativeAntigravity.loadAllAccounts();
        startAntigravityGateway(8317);
        startMuseGateway(18610);
        nativeMuse.startKeepalive();
        console.log('[NativeGateway] Both in-process gateways started successfully.');
    } catch (e) {
        console.error('[NativeGateway] Error during startAll:', e);
    }
}

function stopAll() {
    if (server8317) {
        try { server8317.close(); } catch (e) { }
        server8317 = null;
    }
    if (server18610) {
        try { server18610.close(); } catch (e) { }
        server18610 = null;
    }
}

module.exports = {
    startAll,
    stopAll,
    startAntigravityGateway,
    startMuseGateway
};
