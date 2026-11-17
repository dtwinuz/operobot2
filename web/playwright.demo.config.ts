import { defineConfig } from '@playwright/test'

// Smoke test of the static demo build (npm run test:demo).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:47312/demo/operobot2/', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'node scripts/serve-demo.mjs', url: 'http://127.0.0.1:47312/demo/operobot2/', reuseExistingServer: true, timeout: 20_000 },
})
