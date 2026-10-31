import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor' || process.env.CAPACITOR === 'true';

  return {
    base: isCapacitor ? './' : '/zunospark/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['zuno-icon.svg', 'zuno-maskable.svg'],
      manifest: {
        id: isCapacitor ? '/' : '/zunospark/',
        name: 'ZunoSpark: Wait-Power & Focus Trainer',
        short_name: 'ZunoSpark',
        description:
          'Help Zuno the Spark-Fox calm his electric tail! Offline-first Wait-Power, memory and coordination games for ages 3–6.',
        theme_color: '#0f0a2c',
        background_color: '#0f0a2c',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        start_url: isCapacitor ? '/' : '/zunospark/',
        scope: isCapacitor ? '/' : '/zunospark/',
        categories: ['education', 'kids', 'games'],
        icons: [
          { src: 'zuno-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'zuno-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,ico,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
};
});
