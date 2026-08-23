import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/db',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
