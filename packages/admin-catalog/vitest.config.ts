import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/admin-catalog',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
