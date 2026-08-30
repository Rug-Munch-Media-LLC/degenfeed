import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3456',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'axe-a11y',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /a11y\/.*\.spec\.ts/,
    },
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      snapshotDir: './e2e/snapshots',
      maxDiffPixelRatio: 0.02,
    },
  ],
  webServer: {
    // Standalone-appropriate: `next start` cannot serve an `output:
    // 'standalone'` build, so build once and run the generated server.js
    // directly (this also matches how the Docker image boots the app).
    // Port 3456 is free on the CI runner / dev host — :3000 is Forgejo.
    command: 'pnpm --filter degenfeed build && node apps/web/.next/standalone/apps/web/server.js',
    port: 3456,
    reuseExistingServer: !process.env.CI,
    timeout: 300000,
    env: {
      PORT: '3456',
      HOSTNAME: '127.0.0.1',
    },
  },
});
