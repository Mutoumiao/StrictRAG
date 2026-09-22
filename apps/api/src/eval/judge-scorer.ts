/**
 * 校准打分器接线（`purpose: judge`）—— 评测 PRD §4 校准集 / §6 硬门。
 *
 * 分工：**来源由入口侧声明**（env `JUDGE_CALIB_SCORER` → `judgeAurocSourceFor`），本文件只负责
 * 「怎么打分」与 go/no-go。真 Gateway 是唯一能产可签字分数的来源；mock Gateway 的分数**不得**
 * 标成 live（否则就是 PRD §6.1 禁的「mock 数字进签字包」）。
 *
 * 复用 ask 的 judge prompt 与解析（`graph/prompts` + `graph/parse`），不另写一份口径。
 */
import { parseJudgeScores } from '../graph/parse.js';
import { judgeSystemPrompt, judgeUserPrompt } from '../graph/prompts.js';
import type { GraphEvidence } from '../graph/state.js';
import { GatewayConfigError, getGateway, getGatewayConfig } from '../services/gateway/index.js';

import type { JudgeCalibCase } from './l1-matrix.js';

/** 打分调用：返回原始 chat 文本（失败抛错，不得静默降级成「缺测」） */
export type JudgeChatFn = (req: {
  purpose: 'judge';
  messages: Array<{ role: 'system' | 'user'; content: string }>;
}) => Promise<string>;

export type JudgeScorer = (cases: readonly JudgeCalibCase[]) => Promise<Array<number | null>>;

/** 校准题的 evidence 文本作为单块证据；chunkId 是本地占位，不进检索、不进 trace */
const CALIB_CHUNK_ID = 'judge-calib';

/**
 * 真 Gateway 打分器。每条校准题 → 单 claim + 单 evidence 块 → `judgeSystemPrompt` /
 * `judgeUserPrompt` / `parseJudgeScores`（与 ask verify 同一套 prompt 与解析）。
 * 单条解析失败**抛错**：真打分器坏了要让整批红，不许当成「这一条没测」。
 */
export function createGatewayJudgeScorer(chat: JudgeChatFn): JudgeScorer {
  return async (cases) => {
    const out: Array<number | null> = [];
    for (const c of cases) {
      const evidence: GraphEvidence[] = [
        { chunkId: CALIB_CHUNK_ID, docId: c.id, text: c.evidence },
      ];
      const text = await chat({
        purpose: 'judge',
        messages: [
          { role: 'system', content: judgeSystemPrompt() },
          {
            role: 'user',
            content: judgeUserPrompt([{ text: c.claim, chunkIds: [CALIB_CHUNK_ID] }], evidence),
          },
        ],
      });
      out.push(parseJudgeScores(text, 1)[0] ?? null);
    }
    return out;
  };
}

export type JudgeScorerGoNoGo = { ok: true } | { ok: false; reason: string };

/**
 * go/no-go：声明 `http`（= 报告 `live`）时 Gateway 必须真配成 `http`（`GATEWAY_MODE=http`
 * 或设了 `GATEWAY_BASE_URL`）。否则 client 会是 mock → 分数会被标成 live（禁止）。
 * 非 `http` 声明无需检查（不打真 Gateway）。
 */
export function judgeScorerGoNoGo(input: {
  scorerMode: string;
  gatewayMode: 'mock' | 'http';
}): JudgeScorerGoNoGo {
  if (input.scorerMode !== 'http') return { ok: true };
  if (input.gatewayMode !== 'http') {
    return {
      ok: false,
      reason:
        'JUDGE_CALIB_SCORER=http 需要 GATEWAY_MODE=http（或 GATEWAY_BASE_URL）：mock Gateway 的分数不得标成 live',
    };
  }
  return { ok: true };
}

/**
 * 从进程 env 构造 live 打分器（CLI `JUDGE_CALIB_SCORER=http` 用）。
 * Gateway 侧不齐 → 抛 `GatewayConfigError`（入口 exit 2），不得静默降级成缺测或 mock。
 */
export function liveJudgeScorerFromEnv(): JudgeScorer {
  const gate = judgeScorerGoNoGo({
    scorerMode: 'http',
    gatewayMode: getGatewayConfig().mode,
  });
  if (!gate.ok) throw new GatewayConfigError(gate.reason);
  const client = getGateway();
  return createGatewayJudgeScorer(async (req) => (await client.chat(req)).text);
}
