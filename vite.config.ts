import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ALLOWED_IMAGE_HOSTS = new Set([
  'www.desigual.com',
  'desigual.com',
]);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'local-image-proxy',
        configureServer(server) {
          server.middlewares.use('/api/image-proxy', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const targetUrl = reqUrl.searchParams.get('url');

              if (!targetUrl) {
                res.statusCode = 400;
                res.end('Missing url query parameter');
                return;
              }

              let parsedTarget: URL;
              try {
                parsedTarget = new URL(targetUrl);
              } catch {
                res.statusCode = 400;
                res.end('Invalid target url');
                return;
              }

              if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
                res.statusCode = 400;
                res.end('Unsupported protocol');
                return;
              }

              if (!ALLOWED_IMAGE_HOSTS.has(parsedTarget.hostname)) {
                res.statusCode = 403;
                res.end('Host not allowed');
                return;
              }

              const upstream = await fetch(parsedTarget.toString(), {
                headers: {
                  'user-agent': 'Mozilla/5.0 (compatible; StylisteVirtuel/1.0)',
                  accept: 'image/*,*/*;q=0.8',
                },
              });

              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end(`Upstream error: HTTP ${upstream.status}`);
                return;
              }

              const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
              const bytes = Buffer.from(await upstream.arrayBuffer());

              res.statusCode = 200;
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.end(bytes);
            } catch (error) {
              res.statusCode = 500;
              res.end(`Proxy error: ${String(error)}`);
            }
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
