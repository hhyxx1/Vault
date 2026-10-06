import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-production',
  use: { baseURL: 'http://127.0.0.1:4174', launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? 'chrome' : undefined } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
