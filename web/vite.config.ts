import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `vite build --mode demo` = static demo with an in-memory API (src/mock), served under /demo/operobot2/.
export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? '/demo/operobot2/' : '/',
  plugins: [react()],
  server: { port: 4392, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:18300', changeOrigin: false } } },
  preview: { port: 4393 },
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', chunkSizeWarningLimit: 700, sourcemap: false },
}))
