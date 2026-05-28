import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8081',
      '/download': 'http://localhost:8081',
      '/download-folder': 'http://localhost:8081',
      '/view': 'http://localhost:8081',
      '/admin/view': 'http://localhost:8081',
      '/indeks.csv': 'http://localhost:8081',
    }
  }
})
