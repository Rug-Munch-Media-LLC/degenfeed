/**
 * StrykerJS mutation testing config — degenfeed-web monorepo.
 *
 * Scope: source-level mutation only; `tests/**`, `e2e/**`, and harness helpers are excluded.
 * Runner: vitest, matching repo `vitest.config.ts`.
 * Thresholds: conservative ratchet for first iteration; increase only after baseline stabilises.
 */

export default {
  // Free workflow keeps first-iteration cost at zero; bump to `incremental` once thresholds are stable.
  // https://stryker-mutator.github.io/docs/stryker/configuration/workflows
  // workflow: 'incremental',

  packageManager: 'pnpm',
  testRunner: 'vitest',
  reporters: ['html', 'clear-text', 'progress'],

  // Target only the high-value source trees in this monorepo.
  mutate: [
    'apps/*/src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
    'workers/*/src/**/*.{ts,tsx}',
  ],

  // Exclude harnesses, tests, and generated/stub files that inflate mutant count.
  exclude: [
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/e2e/**',
    '**/tests/**',
    '**/*.stories.*',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/node_modules/**',
  ],

  // Match vitest config from repo root.
  vitest: {
    configFile: 'vitest.config.ts',
  },

  // Conservative first-pass thresholds — ratchet only upward after baseline.
  thresholds: {
    high: 70,
    low: 60,
    break: 60,
    push: false, // do not fail the build until thresholds are validated
  },

  // Increase timeout because this is a monorepo with many packages.
  timeoutMS: 30000,

  // Single worker to reduce flakiness on first run; increase after baseline stabilises.
  maxConcurrentTestRunners: 1,
};
