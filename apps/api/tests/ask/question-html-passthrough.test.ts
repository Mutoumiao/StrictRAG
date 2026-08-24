/**
 * 目标：含 HTML/特殊字符的问句必须原样进入 retrieve，不得被 escape 破坏检索语义。
 * 需求：剧本 H7 · prds/10-delivery/03-acceptance-scenarios.md
 * 被测：runAskGraph（retrieve.question）
 * 简介：问句含 `<b>年假</b>` / `&lt;` 时 retrieve 收到的 question 等于原始字符串。
 */

import { describe, expect, it } from 'vitest';

import {
  baseInput,
  deps,
  evidenceOk,
  happyChat,
  runAskGraph,
} from './_support/graph-harness.js';

describe('ask question HTML passthrough', () => {
  it('HTML tags and entities reach retrieve unchanged', async () => {
    const question = '请说明 <b>年假</b> 与 &lt; 的规则有多少天？';
    let seen: string | undefined;
    const r = await runAskGraph(
      baseInput({ question }),
      deps({
        chat: happyChat,
        retrieve: async (input) => {
          seen = input.question;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
      }),
    );
    expect(seen).toBe(question);
    expect(seen).toContain('<b>年假</b>');
    expect(seen).toContain('&lt;');
    expect(seen).not.toContain('&lt;b&gt;');
    expect(r.status).toBe('answered');
  });
});
