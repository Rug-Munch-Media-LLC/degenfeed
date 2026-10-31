import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite 8 / rolldown uses oxc rather than esbuild: the JSX transform has to be
  // configured here or `.tsx` sources fail to parse while coverage is remapped
  // ("Failed to parse … Excluding it from coverage").
  oxc: {
    jsx: { runtime: 'automatic' },
    include: /\.(tsx?|jsx)$/,
  },
  test: {
    globals: true,
    testTimeout: 15_000,
    // Default environment (packages override per their needs)
    environment: 'node',
    // Root scope ONLY. This config cannot host the workspace aggregate: each
    // package's vitest.config.ts carries its own aliases, environment and
    // setupFiles, so running packages/** from here bypasses them (19 suites,
    // 218 tests fail that way). Per-package runs are `turbo run test`, and the
    // CI `coverage` job runs them with --coverage.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    // Quarantined harnesses — each has its own runner:
    //   tests/e2e, tests/perf, tests/smoke  → Playwright / explicit scripts
    //   tests/a11y                          → axe runner
    //   tests/workers-integration           → `pnpm test:workers` (known-red:
    //       imports packages that don't exist yet: livepeer-provider,
    //       cross-protocol-bridge; API drift vs workers/api). Fix before promoting.
    exclude: [
      'node_modules',
      '**/node_modules/**',
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
      // This root config only executes the root `tests/**` suite, so coverage is
      // scoped to the files those tests actually load (`all: false`). The previous
      // monorepo-wide include glob (apps/*/src, packages/*/src, workers/*/src)
      // measured ~1,000 never-loaded files at 0%, pinning the report at ~1% and
      // failing every threshold — that was the red `pnpm coverage` job. Real
      // per-package coverage is owned by each package's own vitest config and run
      // through `turbo run test`.
      // Only files the root smoke suite actually loads.
      all: false,
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
      ],
      // Floors measured 2026-10-31 against this scoped report (branches 10.97,
      // functions 20.18, lines 18.94, statements 17.96). They are deliberately
      // just under the measured value: they exist to catch a DROP, not to
      // pretend the root smoke suite covers the monorepo. Raise them by
      // measuring, never by guess. Long-term target stays codecov.yml 50%.
      thresholds: {
        branches: 10,
        functions: 20,
        lines: 18,
        statements: 17,
      },
    },
  },
});
