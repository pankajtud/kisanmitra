import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Budget: initial JS payload under 200 KB gzipped on a ₹6,000 Android phone
 * over 3G (CLAUDE.md §2.5). `npm run build` prints the gzipped sizes — check
 * them before adding a dependency.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      // Workbox precaches the whole shell, so a cold start with no network
      // still boots the app (§2.1).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'किसान मित्र',
        short_name: 'किसान मित्र',
        description: 'खेती का खर्च और स्टॉक का हिसाब',
        lang: 'hi',
        dir: 'ltr',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf7f0',
        theme_color: '#1b5e20',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    // One bundle beats many round trips on a slow link.
    cssCodeSplit: false,
    reportCompressedSize: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
