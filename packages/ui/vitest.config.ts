import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@degenfeed/storage': path.resolve(__dirname, '../storage/src'),
      '@degenfeed/types': path.resolve(__dirname, '../types/src'),
      '@degenfeed/utils': path.resolve(__dirname, '../utils/src'),
      '@degenfeed/token-gate': path.resolve(__dirname, '../token-gate/src'),
      '@degenfeed/realtime': path.resolve(__dirname, '../realtime/src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo'],
    setupFiles: [],
  },
});
