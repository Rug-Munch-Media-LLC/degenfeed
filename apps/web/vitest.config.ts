import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../../tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', '.turbo'],
    setupFiles: ['../../tests/vitest.setup.ts'],
  },
});
