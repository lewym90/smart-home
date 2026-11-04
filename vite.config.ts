import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'img/*.webp'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,webp,svg}'], navigateFallback: 'index.html' },
      manifest: {
        name: 'Smart Home',
        short_name: 'Smart Home',
        description: 'Jeden dom. Jedna aplikacja. Koniec z żonglerką.',
        lang: 'pl',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        background_color: '#040d18',
        theme_color: '#040d18',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
