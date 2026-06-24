import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['icon-512x512.png', 'icon-192x192.png', 'icon-maskable-512x512.png'],
      manifest: {
        name: 'Paczka INFA - Pliki',
        short_name: 'Paczka INFA',
        description: 'Serwer plików Paczka INFA',
        theme_color: '#1976d2',
        background_color: '#121212',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        lang: 'pl',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'screenshot-wide.jpg',
            sizes: '1266x585',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Paczka INFA - widok desktopowy'
          },
          {
            src: 'screenshot-mobile.jpg',
            sizes: '585x1266',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Paczka INFA - widok mobilny'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/dc(\/|$)/, /^\/view\//, /^\/download\//, /^\/download-folder\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  envDir: '..',
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8081',
      '/download': 'http://localhost:8081',
      '/download-folder': 'http://localhost:8081',
      '/view': 'http://localhost:8081',
      '/indeks.csv': 'http://localhost:8081',
    }
  }
})
