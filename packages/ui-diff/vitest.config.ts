import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/cli.ts', 'src/index.ts', 'src/types.ts'],
      thresholds: {
        branches: 80,
      },
      reportOnFailure: true,
    },
  },
});
