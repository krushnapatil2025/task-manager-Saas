import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['Print.svg', 'logo.png', 'logo-192.png', 'logo-512.png'],
      manifest: {
        name: 'Task Manager SaaS',
        short_name: 'TaskSaaS',
        id: '/',
        orientation: 'any',
        description: 'Next-gen collaborative task management suite',
        theme_color: '#6366f1',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        screenshots: [
          {
            src: '/logo.png',
            sizes: '1024x1024',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Strideo Desktop Dashboard'
          },
          {
            src: '/logo.png',
            sizes: '1024x1024',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Strideo Mobile App'
          }
        ],
        icons: [
          {
            src: '/logo-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'View Tasks',
            short_name: 'Tasks',
            description: 'Open task boards',
            url: '/admin/tasks',
            icons: [{ src: '/logo-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Team Chat',
            short_name: 'Chat',
            description: 'Open chat channels',
            url: '/chat',
            icons: [{ src: '/logo-192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gxfnmpqbuamzilgeogfh\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
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
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['strideo.cicdprosystems.com', 'task.cicdprosystems.com', 'localhost'],
  },
  server: {
    port: 5173,
    allowedHosts: ['strideo.cicdprosystems.com', 'task.cicdprosystems.com', 'localhost'],
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' https://gxfnmpqbuamzilgeogfh.supabase.co https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://drive.google.com https://tmpfiles.org https://api.groq.com https://api.openai.com https://api.microlink.io https://g.tenor.com https://tenor.googleapis.com",
        "worker-src 'self' blob:",
        "frame-src 'self' https://drive.google.com https://docs.google.com https://accounts.google.com",
        "media-src 'self' blob: data: https: http:"
      ].join('; '),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],
          // Icons (large library — isolate for caching)
          "vendor-icons": ["react-icons"],
          // Date/utility libs
          "vendor-utils": ["moment", "react-hot-toast"],
        },
      },
    },
  },
});


