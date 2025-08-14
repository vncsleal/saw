import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/core/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['packages/core/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        'packages/core/dist/**',
        'packages/cli/**',
        'scripts/**',
        'examples/**'
      ]
    }
  }
});
