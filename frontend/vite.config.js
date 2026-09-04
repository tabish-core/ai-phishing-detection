import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Local dev: the backend (FastAPI on :8000) is expected to run alongside
// Vite. The proxy below forwards /api/* to the local backend so the
// production code path (`fetch('/api/analyze', …)`) keeps working
// without a hard-coded localhost URL in the React source.
const BACKEND_TARGET = process.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
