import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';
import { atoms } from '@metagptx/web-sdk/plugins';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    viteSourceLocator({
      prefix: 'mgx', // 前缀用于标识源代码位置，不能修改
    }),
    react(),
    atoms(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // 监听所有网络接口
    port: parseInt(process.env.VITE_PORT || '3000'),
    proxy: {
      // LiteLLM API proxy: /llm/v1/* → LITELLM_BASE_URL/v1/*
      '/llm': {
        target: process.env.VITE_LITELLM_BASE_URL || 'https://openllm.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/llm/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const timestamp = new Date().toISOString();
            const bodyChunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
            req.on('end', () => {
              const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString() : '';
              console.log(`\n${'═'.repeat(60)}`);
              console.log(`📤 [REQUEST] ${timestamp}`);
              console.log(`${'─'.repeat(60)}`);
              console.log(`  Method : ${proxyReq.method}`);
              console.log(`  Path   : ${proxyReq.path}`);
              console.log(`  Host   : ${proxyReq.getHeader('host')}`);
              const authHeader = proxyReq.getHeader('authorization');
              if (authHeader) {
                const authStr = String(authHeader);
                console.log(`  Auth   : ${authStr.substring(0, 15)}...`);
              }
              if (body) {
                try {
                  const parsed = JSON.parse(body);
                  console.log(`  Body   :`, JSON.stringify(parsed, null, 2));
                } catch {
                  console.log(`  Body   : ${body.substring(0, 500)}`);
                }
              }
              console.log(`${'═'.repeat(60)}`);
            });
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const timestamp = new Date().toISOString();
            const chunks: Buffer[] = [];
            proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
            proxyRes.on('end', () => {
              const responseBody = Buffer.concat(chunks).toString();
              console.log(`\n${'═'.repeat(60)}`);
              console.log(`📥 [RESPONSE] ${timestamp}`);
              console.log(`${'─'.repeat(60)}`);
              console.log(`  Status : ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
              console.log(`  Path   : ${req.url}`);
              if (responseBody) {
                try {
                  const parsed = JSON.parse(responseBody);
                  // Truncate large responses (e.g., model list, long completions)
                  const str = JSON.stringify(parsed, null, 2);
                  console.log(`  Body   : ${str.substring(0, 2000)}${str.length > 2000 ? '\n  ... (truncated)' : ''}`);
                } catch {
                  console.log(`  Body   : ${responseBody.substring(0, 2000)}`);
                }
              }
              console.log(`${'═'.repeat(60)}`);
            });
          });
          proxy.on('error', (err, req) => {
            const timestamp = new Date().toISOString();
            console.error(`\n${'═'.repeat(60)}`);
            console.error(`🔴 [PROXY ERROR] ${timestamp}`);
            console.error(`${'─'.repeat(60)}`);
            console.error(`  Path   : ${req.url}`);
            console.error(`  Error  : ${err.message}`);
            console.error(`${'═'.repeat(60)}`);
          });
        },
      },
      '/api': {
        target: `http://localhost:8000`,
        changeOrigin: true,
      },
    },
    watch: { usePolling: true, interval: 600 },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'utils-vendor': [
            'axios',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'date-fns',
            'lucide-react',
          ],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
