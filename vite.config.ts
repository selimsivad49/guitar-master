import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Guitar Master — 毎日のギター練習',
      short_name: 'Guitar Master',
      description: '一日ひとつ、弾けるを増やす。初心者のためのギター練習ノート。',
      lang: 'ja',
      theme_color: '#a84b31',
      background_color: '#f6f3eb',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true,
      clientsClaim: true,
    },
  })],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
