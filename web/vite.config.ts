import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 4392, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:18300', changeOrigin: false } } },
  preview: { port: 4393 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 700 },
})
