import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@uivisor/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    testTimeout: 60_000,
  },
});
