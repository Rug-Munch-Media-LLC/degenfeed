import { defineConfig } from 'vitest/config';

// Local config so monetization tests never inherit the monorepo-root
// setupFiles path (which resolves against this package dir and 404s).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
