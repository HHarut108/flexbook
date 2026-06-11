import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
  build: {
    // Bumped from the default 500 KB just so the warning is informational
    // rather than alarming — `manualChunks` below + per-route lazy imports
    // keep the main bundle well under this.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Stable vendor chunks. The big wins:
        //   - `react-vendor` rarely changes, so returning visitors get a
        //     long-lived 304 instead of refetching React on every deploy.
        //   - `leaflet` is heavy (~150 KB) and only used on map screens —
        //     splitting it lets the home/auth/marketing pages skip it
        //     entirely. Combined with the lazy imports in screens that
        //     actually render a map, this keeps leaflet out of the
        //     critical path.
        //   - `analytics` (posthog) is dynamically imported via
        //     analytics.ts, so it already lives in its own chunk — the
        //     entry here mostly serves as documentation.
        //   - `icons` (lucide-react) is widely referenced; keeping it in
        //     its own chunk avoids busting the main hash whenever an icon
        //     gets added or removed somewhere in the app.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet', 'react-leaflet'],
          icons: ['lucide-react'],
          'date-utils': ['date-fns'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'FlexBook — Fast Travel Assistant',
        short_name: 'FlexBook',
        description: 'Find the cheapest multi-stop flights. No account needed.',
        theme_color: '#3730A3',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/api\/airports\//i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'airports-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/api\/airlines\//i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'airlines-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/api\/country-info/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'country-info-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@fast-travel/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
        changeOrigin: true,
      },
    },
  },
});
