import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "FREQUENCY",
        short_name: "FREQUENCY",
        description: "A game about being found. Drift through the dark until your signal meets a stranger's.",
        theme_color: "#0d0b1f",
        background_color: "#05040d",
        display: "standalone",
        orientation: "any",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // music is fetched on demand and then kept for offline play
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.(?:mp3|ogg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "frequency-audio",
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
  },
});
