import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/supervisor/',
        name: 'InteliMarket — PWA Supervisor',
        short_name: 'Supervisor',
        description: 'Radar de cajas, autorizaciones en piso, bóveda y monitoreo multimoneda en tiempo real.',
        theme_color: '#D97706',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/supervisor',
        categories: ['business', 'finance'],
        lang: 'es',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') && url.origin === self.location.origin,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'intelimarket-api',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 6 },
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(png|svg|jpg|jpeg|webp|gif|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'intelimarket-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/download': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/download': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../ui-web-dist',
    emptyOutDir: true,
  },
})
