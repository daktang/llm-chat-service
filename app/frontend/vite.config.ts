import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';
import { atoms } from '@metagptx/web-sdk/plugins';
import { gunzipSync } from 'zlib';

// ⚠️ 환경변수 검증: 설정하지 않으면 서버가 시작되지 않습니다.
function requireProcessEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`\n❌ 환경변수 ${key}가 설정되지 않았습니다.`);
    console.error(`   .envrc 파일에서 ${key}를 설정한 후 source .envrc를 실행하세요.\n`);
    process.exit(1);
  }
  return value;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 환경변수 필수 검증 (dev/build 모두)
  const litellmBaseUrl = requireProcessEnv('VITE_LITELLM_BASE_URL');
  requireProcessEnv('VITE_LITELLM_API_KEY');
  const port = parseInt(process.env.VITE_PORT || '3000');

  return {
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
      port,
      proxy: {
        // LiteLLM API proxy: /llm/v1/* → LITELLM_BASE_URL/v1/*
        '/llm': {
          target: litellmBaseUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/llm/, ''),
          configure: (proxy) => {
            // ── REQUEST 로그 ──
            proxy.on('proxyReq', (proxyReq, req) => {
              // gzip 압축 응답 방지 → 서버가 plain text로 응답하도록
              proxyReq.removeHeader('accept-encoding');

              const timestamp = new Date().toISOString();
              const bodyChunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
              req.on('end', () => {
                const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString('utf-8') : '';
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

            // ── RESPONSE 로그 ──
            proxy.on('proxyRes', (proxyRes, req) => {
              const timestamp = new Date().toISOString();
              const chunks: Buffer[] = [];
              proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
              proxyRes.on('end', () => {
                const rawBuffer = Buffer.concat(chunks);
                let responseBody: string;

                // gzip 응답인 경우 디코딩 시도
                const encoding = proxyRes.headers['content-encoding'];
                try {
                  if (encoding === 'gzip') {
                    responseBody = gunzipSync(rawBuffer).toString('utf-8');
                  } else {
                    responseBody = rawBuffer.toString('utf-8');
                  }
                } catch {
                  responseBody = rawBuffer.toString('utf-8');
                }

                console.log(`\n${'═'.repeat(60)}`);
                console.log(`📥 [RESPONSE] ${timestamp}`);
                console.log(`${'─'.repeat(60)}`);
                console.log(`  Status : ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
                console.log(`  Path   : ${req.url}`);
                if (responseBody) {
                  try {
                    const parsed = JSON.parse(responseBody);
                    const str = JSON.stringify(parsed, null, 2);
                    console.log(`  Body   : ${str.substring(0, 2000)}${str.length > 2000 ? '\n  ... (truncated)' : ''}`);
                  } catch {
                    console.log(`  Body   : ${responseBody.substring(0, 2000)}`);
                  }
                }
                console.log(`${'═'.repeat(60)}`);
              });
            });

            // ── ERROR 로그 ──
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
  };
});