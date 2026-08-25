import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Force automatic JSX runtime — apps/web tsconfig uses `jsx: preserve`
  // (Next.js), which vite's esbuild refuses to execute directly.
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    testTimeout: 15_000,
    // Default environment (packages override per their needs)
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    // Quarantined harnesses — each has its own runner:
    //   tests/e2e, tests/perf, tests/smoke  → Playwright / explicit scripts
    //   tests/a11y                          → axe runner
    //   tests/workers-integration           → `pnpm test:workers` (known-red:
    //       imports packages that don't exist yet: livepeer-provider,
    //       cross-protocol-bridge; API drift vs workers/api). Fix before promoting.
    exclude: [
      'node_modules',
      'dist',
      '.next',
      '.turbo',
      'e2e',
      'tests/e2e/**',
      'tests/perf/**',
      'tests/smoke/**',
      'tests/a11y/**',
      'tests/workers-integration/**',
    ],
    setupFiles: ['tests/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['apps/*/src/**', 'packages/*/src/**', 'workers/*/src/**'],
      thresholds: {
        branches: 50,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
  },
});
