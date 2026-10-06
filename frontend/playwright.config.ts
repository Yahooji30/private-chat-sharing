import { defineConfig, devices } from '@playwright/test'

const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export default defineConfig({
  testDir: './e2e', timeout: 60_000, fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: base, trace: 'retain-on-failure', launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] } },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /(mobile|pwa)\.spec\.ts/ }, { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
    { name: 'pwa', use: { ...devices['Pixel 7'] }, testMatch: /pwa\.spec\.ts/ }],
  webServer: process.env.E2E_BASE_URL ? undefined : [
    { command: 'pnpm --filter @sync/backend dev', url: 'http://localhost:4000/api/health', reuseExistingServer: true, cwd: '..' },
    { command: 'NUXT_PUBLIC_RT_URL=http://localhost:4001 pnpm dev', url: base, reuseExistingServer: true, timeout: 120_000 },
  ],
})
