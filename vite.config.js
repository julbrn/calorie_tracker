import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/calorie_tracker/',
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
