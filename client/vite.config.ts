import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API calls — backend routes are mounted at /api/..., so do NOT rewrite the path.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Static media uploads served by the backend at /media/...
      '/media': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
