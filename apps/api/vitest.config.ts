import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@strict-rag/api',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    /**
     * 本包含集成式用例：**在 `it()` 体内** `await import(重模块)`（`src/app.ts` / `services/ask/execute.ts`）。
     * 这段导入时间计在**用例超时**里（不是收集期），全量跑并行 worker 抢 CPU 时实测可达 6s+，
     * 默认 5000ms 会间歇红。放宽只影响失败暴露时间，不放宽任何断言。
     */
    testTimeout: 20_000,
  },
});
