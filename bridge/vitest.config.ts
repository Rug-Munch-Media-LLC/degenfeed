import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15_000,
    // EADDRINUSE(8787) flake: several test files boot the REAL server, which
    // binds BRIDGE_PORT|8787; vitest's per-file concurrency runs them at once
    // and one bind loses (full-suite turbo run, 2026-10-31). Sequential files
    // make the package deterministic; cross-package isolation is unchanged.
    fileParallelism: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
});
