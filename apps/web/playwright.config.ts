import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.VAULT_E2E_PORT ?? 5173)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  use: { baseURL, trace: 'retain-on-failure', launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? 'chrome' : undefined } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: !process.env.CI },
})
