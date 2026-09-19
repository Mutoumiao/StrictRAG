/**
 * 目标：闲聊走 chitchat，知识/政策问句走 single，禁止政策句被当成闲聊；fast 档不得调 LLM route。
 * 需求：prds/04-pipelines/02-online-ask-langgraph.md · 剧本 D-fast
 * 被测：ruleRoute · runAskGraph（chat purpose 序列）
 * 简介：问候为 chitchat；带知识/政策词的问句必须 single；fast 模糊短句走 single 且无 purpose=route。
 */
import { describe, expect, it } from 'vitest';

import {
  baseInput,
  deps,
  happyChat,
  ruleRoute,
  runAskGraph,
  type GraphChat,
} from './_support/graph-harness.js';

describe('ruleRoute (M1)', () => {
  it('chitchat hello', () => {
    expect(ruleRoute('你好').routeLabel).toBe('chitchat');
  });

  it('knowledge question → single', () => {
    expect(ruleRoute('年假有多少天？').routeLabel).toBe('single');
  });

  it('policy word → single not chitchat', () => {
    expect(ruleRoute('你好，年假政策').routeLabel).toBe('single');
  });

  it('D-fast: mode=fast 下短句走 single 且从未以 purpose=route 调 chat', async () => {
    // 模糊短句：非寒暄、非制度词、长度 ≤4 → fallback_single（不是猜 chitchat）
    expect(ruleRoute('随便说说', 'fast')).toMatchObject({
      routeLabel: 'single',
      route_source: 'fallback_single',
      route_llm_skipped: true,
    });

    const purposes: string[] = [];
    const record: GraphChat = async (purpose, messages) => {
      purposes.push(purpose);
      return happyChat(purpose, messages);
    };
    const r = await runAskGraph(baseInput({ mode: 'fast', question: '随便说说' }), deps({ chat: record }));

    expect(purposes).not.toContain('route');
    expect(purposes).toEqual(['generate', 'claim_split', 'judge']);
    expect(r.debug?.routeLabel).toBe('single');
    expect(r.debug?.route_source).toBe('fallback_single');
    expect(r.status).toBe('answered');
  });
});
