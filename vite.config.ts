import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './', // Important for Electron file:// protocol
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000, // Increase warning limit
      sourcemap: false, // Disable sourcemaps in production for smaller bundle
      // Use default esbuild minifier (faster than terser)
      rollupOptions: {
        output: {
          // Manual chunks for better caching and loading
          manualChunks: {
            // Core React & libraries
            'vendor-react': ['react', 'react-dom'],
            // Firebase - lazy load
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics'],
            // Google AI SDK
            'vendor-genai': ['@google/genai'],
          },
        },
      },
    },
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

              const headers: Record<string, string> = {
                'ngrok-skip-browser-warning': 'true'
              };
              for (const [key, value] of Object.entries(req.headers)) {
                const lower = key.toLowerCase();
                if (!['host', 'origin', 'referer'].includes(lower) && typeof value === 'string') {
                  headers[key] = value;
                }
              }
              headers['ngrok-skip-browser-warning'] = 'true';

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
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Optimize deps for faster dev server
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['@google/genai'], // Don't pre-bundle heavy deps
    },
  };
});
