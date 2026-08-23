import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/worker',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
