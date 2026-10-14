import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api/health -> http://localhost:8000/health
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true, // /api/ws/{elderId} -> ws://localhost:8000/ws/{elderId}
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
