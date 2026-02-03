import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['json', 'json-summary', 'text'],
      include: ['src/**/*.ts'],
    },
    reporters: ['default', 'github-actions'],
  },
});
