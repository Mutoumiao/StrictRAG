import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/contracts',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
