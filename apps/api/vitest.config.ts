import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/api',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
