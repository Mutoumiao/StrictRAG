/**
 * 目标：mode 预算表与 tryCharge 闸；检索/LLM 额度耗尽不得 answered。
 * 需求：ADR-032 · prds/04-pipelines
 * 被测：budgetForMode / tryChargeLlm / tryChargeRetrieve / runAskGraph 预算路径
 * 简介：校验 mode 默认额度与 tryCharge；检索/LLM 耗尽须 abstained。
 */
import { describe, expect, it } from 'vitest';

import {
  baseInput,
  budgetForMode,
  deps,
  happyChat,
  runAskGraph,
  tryChargeLlm,
  tryChargeRetrieve,
} from './_support/graph-harness.js';

describe('budget table', () => {
  it('mode defaults ADR-032', () => {
    expect(budgetForMode('strict').maxLLMCalls).toBe(20);
    expect(budgetForMode('balanced').maxLLMCalls).toBe(16);
    expect(budgetForMode('fast').maxLLMCalls).toBe(8);
    expect(budgetForMode('fast').maxRetrieveCalls).toBe(2);
  });

  it('tryCharge guards', () => {
    expect(tryChargeLlm(8, 8, 1)).toBe(false);
    expect(tryChargeLlm(7, 8, 1)).toBe(true);
    expect(tryChargeRetrieve(2, 2)).toBe(false);
    expect(tryChargeRetrieve(0, 2)).toBe(true);
  });
});

describe('runAskGraph M1 route+retrieve', () => {
  it('retrieve budget exhausted', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        budgetOverride: { maxLLMCalls: 16, maxRetrieveCalls: 0 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
  });
});

describe('runAskGraph M3 verify+min+budget', () => {
  it('llm budget exhausted before generate', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        budgetOverride: { maxLLMCalls: 0, maxRetrieveCalls: 6 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
  });

  it('llm budget exhausted on claim_split (after generate)', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        budgetOverride: { maxLLMCalls: 1, maxRetrieveCalls: 6 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
  });
});
