import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/db',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
