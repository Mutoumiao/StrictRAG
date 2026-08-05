import type { AskMode } from './state.js';

/** ADR-032 / 流水线 §7.1 mode 默认表（客户端不可覆盖） */
export type GraphBudget = {
  maxLLMCalls: number;
  maxRetrieveCalls: number;
};

export function budgetForMode(mode: AskMode): GraphBudget {
  switch (mode) {
    case 'strict':
      return { maxLLMCalls: 20, maxRetrieveCalls: 6 };
    case 'fast':
      return { maxLLMCalls: 8, maxRetrieveCalls: 2 };
    case 'balanced':
    default:
      return { maxLLMCalls: 16, maxRetrieveCalls: 6 };
  }
}

/** 尝试占用 1 次 retrieve；不足则 false */
export function tryChargeRetrieve(used: number, max: number): boolean {
  return used < max;
}

/** 尝试占用 n 次 LLM chat；不足则 false */
export function tryChargeLlm(used: number, max: number, n = 1): boolean {
  return used + n <= max;
}
