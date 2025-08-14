import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/core/tests/**/*.test.ts',
      'packages/cli/tests/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: [
        'packages/core/src/**/*.ts',
        'packages/cli/src/**/*.ts'
      ],
      exclude: [
        '**/*.test.ts',
        'packages/**/dist/**',
        'scripts/**',
        'examples/**'
      ]
    }
  }
});
