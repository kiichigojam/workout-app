import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8800',
      '/habits': 'http://localhost:8800',
      '/health': 'http://localhost:8800',
      '/nutrition': 'http://localhost:8800',
      '/users': 'http://localhost:8800',
    },
  },
})
