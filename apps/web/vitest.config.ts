import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Vite 6+ (rolldown) uses oxc instead of esbuild; the JSX transform option
  // must be configured under `oxc` or JSX test files fail to parse.
  oxc: {
    jsx: { runtime: 'automatic' },
    include: /\.(tsx?|jsx)$/,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    // Explicit allowlist: web unit tests + shared harness dirs that test WEB code.
    // e2e/perf/a11y/smoke live under Playwright; workers-integration has its own suite.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      '../../tests/hooks/**/*.{test,spec}.{ts,tsx}',
      '../../tests/integration/**/*.{test,spec}.{ts,tsx}',
      '../../tests/components/**/*.{test,spec}.{ts,tsx}',
      '../../tests/fuzz/**/*.{test,spec}.{ts,tsx}',
      '../../tests/unit/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      '.turbo',
      // Wrong-harness tests meant for Playwright / live-network runners
      '../../tests/{e2e,perf,a11y,smoke}/**',
      '../../tests/live/**',
    ],
    setupFiles: ['../../tests/vitest.setup.ts'],
  },
});
