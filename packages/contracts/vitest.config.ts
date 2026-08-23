import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/contracts',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
