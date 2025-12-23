import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['json', 'json-summary', 'text'],
      include: ['src/**/*.ts'],
    },
    reporters: ['default', 'github-actions'],
  },
});
