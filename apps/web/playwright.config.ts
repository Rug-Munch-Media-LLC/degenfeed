import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '..',
  testMatch: [
    'apps/web/e2e/**/*.{spec,test}.ts',
    'tests/e2e/**/*.{spec,test}.ts',
    'tests/a11y/**/*.{spec,test}.ts',
  ],
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'axe-a11y',
      testMatch: /tests\/a11y\/.*\.(spec|test)\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: /tests\/e2e\/mobile\.(spec|test)\.ts/,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    // Standalone-appropriate: `next start` cannot serve an `output:'standalone'`
    // build, so build once and run the generated server.js directly (matches
    // how the Docker image boots the app). :3456 is free — :3000 is Forgejo.
    command: 'pnpm --filter degenfeed build && node .next/standalone/apps/web/server.js',
    port: 3456,
    reuseExistingServer: !process.env.CI,
    timeout: 300000,
    env: {
      PORT: '3456',
      HOSTNAME: '127.0.0.1',
    },
  },
});
