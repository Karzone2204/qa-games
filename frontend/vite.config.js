// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Provide a development proxy so frontend can call backend without CORS issues when
// VITE_API_BASE is not explicitly set. If VITE_API_BASE is defined we skip proxying
// and the app will call that absolute URL directly.
const target = process.env.VITE_API_BASE || 'http://localhost:4000';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react"],
  },
  server: {
    host: true,
    strictPort: false,
    port: 5173,
    proxy: !process.env.VITE_API_BASE ? {
      '/api': { target, changeOrigin: true },
      '/auth': { target, changeOrigin: true },
      '/tools': { target, changeOrigin: true },
      '/scores': { target, changeOrigin: true },
      '/datagen': { target, changeOrigin: true },
      '/llm': { target, changeOrigin: true },
    } : undefined
  }
});
