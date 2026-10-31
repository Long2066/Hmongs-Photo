import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        react(),
        {
            name: 'cors-proxy-plugin',
            configureServer(server) {
                server.middlewares.use('/api/cors-proxy', async (req, res) => {
                    try {
                        const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
                        const targetUrl = reqUrl.searchParams.get('url');
                        if (!targetUrl) {
                            res.statusCode = 400;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: 'Missing target url parameter' }));
                            return;
                        }

                        const headers: Record<string, string> = {};
                        for (const [key, value] of Object.entries(req.headers)) {
                            const lower = key.toLowerCase();
                            if (!['host', 'origin', 'referer'].includes(lower) && typeof value === 'string') {
                                headers[key] = value;
                            }
                        }

                        const chunks: Buffer[] = [];
                        for await (const chunk of req) {
                            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                        }
                        const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

                        const response = await fetch(targetUrl, {
                            method: req.method,
                            headers,
                            body: (req.method !== 'GET' && req.method !== 'HEAD') ? body : undefined
                        });

                        res.statusCode = response.status;
                        response.headers.forEach((val, key) => {
                            if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
                                res.setHeader(key, val);
                            }
                        });

                        const arrayBuffer = await response.arrayBuffer();
                        res.end(Buffer.from(arrayBuffer));
                    } catch (err: any) {
                        res.statusCode = 502;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: err.message || 'Proxy Error' }));
                    }
                });
            }
        }
    ],
    server: {
        port: 5174,
    },
    build: {
        outDir: 'dist',
    },
});
