import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/worker',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
