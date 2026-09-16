import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
  test: {
    name: '@strict-rag/admin',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    /**
     * 本包含 jsdom 渲染 + 用户交互的集成式用例（建库入口、部门工作区等），
     * 全量跑并行抢 CPU 时实测越过默认 5000ms 会间歇红。放宽只影响失败暴露时间，不放宽任何断言。
     */
    testTimeout: 20_000,
  },
});
