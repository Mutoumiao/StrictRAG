import { defineWorkspace } from 'vitest/config';

/**
 * Monorepo Vitest 工作区：各包可自带 vitest.config.ts，
 * 也可在 src 旁放置 `*.test.ts` 由根 `pnpm test` 统一收集。
 */
export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
]);
