import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' https://gxfnmpqbuamzilgeogfh.supabase.co https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://www.googleapis.com https://oauth2.googleapis.com https://drive.google.com https://tmpfiles.org https://api.groq.com https://api.microlink.io",
        "worker-src 'self' blob:",
        "frame-src 'self' https://drive.google.com",
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


