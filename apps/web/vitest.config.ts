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
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../../tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', '.turbo'],
    setupFiles: ['../../tests/vitest.setup.ts'],
  },
});
