import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev:phone` (mode "phone") → self-signed HTTPS on port 5174, because phones only allow
// the microphone on secure pages. `npm run dev` stays plain HTTP on 5173.
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone'
  return {
    plugins: [react(), ...(phone ? [basicSsl()] : [])],
    server: {
      // Port 5173 matches the backend's default CORS origin (app/config.py → cors_origins).
      port: phone ? 5174 : 5173,
      strictPort: true,
      // Listen on the local network too, so a phone on the same Wi-Fi can open it.
      host: true,
    },
  }
})
