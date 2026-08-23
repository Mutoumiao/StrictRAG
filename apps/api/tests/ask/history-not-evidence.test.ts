/**
 * 目标：会话历史与加深窗文本不得进入 evidence / 不得充当 verify 依据。
 * 需求：历史≠evidence · prds/04-pipelines
 * 被测：runAskGraph（history / evidence_snapshot）
 * 简介：有 session 仍只凭 evidence 验证；历史与加深窗文本不得进 snapshot/citations。
 */
import { describe, expect, it } from 'vitest';

import {
  baseInput,
  deps,
  happyChat,
  rewriteHappyChat,
  runAskGraph,
  SID,
} from './_support/graph-harness.js';

describe('runAskGraph M3 verify+min+budget', () => {
  it('session history never required for verified (evidence only)', async () => {
    const r = await runAskGraph(
      baseInput({ sessionId: '33333333-3333-7333-8333-333333333333' }),
      deps({ chat: happyChat }),
    );
    expect(r.reason).toBe('verified');
    expect(r.sessionId).toBe('33333333-3333-7333-8333-333333333333');
    // draft 不掺会话文本
    expect(r.answer).not.toMatch(/session|历史|刚才/);
  });
});

describe('runAskGraph P2.5 rewrite min', () => {
  it('history text never enters evidence / evidence_snapshot', async () => {
    const HIST = '会话里的秘密数字999天年假';
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: HIST },
          { role: 'assistant', content: '根据聊天年假999天' },
        ],
        chat: rewriteHappyChat,
      }),
    );
    const texts = r.evidence_snapshot.map((e) => e.text);
    expect(texts.join('\0')).not.toContain(HIST);
    expect(texts.join('\0')).not.toContain('999天年假');
    expect(JSON.stringify(r.citations)).not.toContain(HIST);
    expect(r.reason).toBe('verified');
  });

  it('deepened window text never enters evidence', async () => {
    const window = [
      { role: 'user' as const, content: 'DEEPWIN_SECRET_U1' },
      { role: 'assistant' as const, content: 'DEEPWIN_SECRET_A1' },
      { role: 'user' as const, content: 'DEEPWIN_SECRET_U2' },
      { role: 'assistant' as const, content: 'DEEPWIN_SECRET_A2' },
    ];
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '根据刚才说的住宿标准，餐补怎么算？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => window,
        chat: rewriteHappyChat,
      }),
    );
    const ev = r.evidence_snapshot.map((e) => e.text).join('\0');
    for (const t of window) {
      expect(ev).not.toContain(t.content);
    }
    expect(JSON.stringify(r.citations)).not.toContain('DEEPWIN_SECRET');
    expect(r.sessionDeepened).toBe(true);
    expect(r.reason).toBe('verified');
  });
});
