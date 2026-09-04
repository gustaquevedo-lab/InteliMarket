import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'deposito-icon.svg'],
      manifest: {
        id: '/',
        name: 'Extra Supermercado — Operaciones & Muelle',
        short_name: 'Extra Muelle',
        description: 'Recepción en depósito, control de lotes y vencimientos, supervisión y radar operativo.',
        theme_color: '#0F172A',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/deposito',
        categories: ['business', 'finance', 'productivity'],
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
          {
            src: 'deposito-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Recepción en Muelle',
            short_name: 'Depósito',
            description: 'Descarga de mercaderías con lotes y vencimiento',
            url: '/deposito',
            icons: [{ src: 'deposito-icon.svg', sizes: '512x512' }],
          },
          {
            name: 'Radar de Supervisor',
            short_name: 'Supervisor',
            description: 'Monitoreo de cajas y autorizaciones en piso',
            url: '/supervisor',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
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
