import { defineWorkspace } from 'vitest/config';

/**
 * Monorepo Vitest 工作区：各包自带 vitest.config.ts。
 * 现行测例在 `<包>/tests/**/*.test.ts(x)`；过渡期仍收集 `src/**/*.test.ts(x)`。
 * HOW：`.trellis/spec/guides/testing.md`
 */
export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
]);
