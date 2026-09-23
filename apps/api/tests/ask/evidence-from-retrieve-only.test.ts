/**
 * 目标：evidence_snapshot 只能来自本轮 retrieve（图上唯一写点），会话窗文本不得进 evidence。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 零容忍「历史文本进 evidence」· 裁定 02 裁定 4
 * 被测：runAskGraph（evidence_snapshot 的来源与写点）
 * 简介：注入 retrieve 与 chat stub，会话窗放独特串；断言 evidence_snapshot 逐字段等于 retrieve 输出、
 *       窗文本不出现在任何 evidence_snapshot[].text；并守住 run.ts 的 evidence 写点唯一（源码形状守卫）。
 *       本不变式是 PRD 那句「历史文本进 evidence」的真机械对应物 —— 图内缺陷路径不存在，
 *       抓的是「语料/会话文本混进输出来源」，故不得拿上轮 assistant 观测文本当泄漏判据（会假红）。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  baseInput,
  CHUNK,
  deps,
  evidenceOk,
  runAskGraph,
  SID,
  STANDALONE,
  type GraphChat,
} from './_support/graph-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUN_TS = path.resolve(here, '../../src/graph/run.ts');

const WINDOW_SECRET = 'WINDOW_SECRET_9f2c';
const EMPTY_META = { esMode: 'mock', candidateCount: 0, denseHits: 0, sparseHits: 0 };

describe('runAskGraph · evidence 只来自 retrieve', () => {
  it('会话窗文本进 rewrite 提示词，但不进 evidence_snapshot（逐字段等于 retrieve 输出）', async () => {
    const seen: { purpose: string; text: string }[] = [];
    const chat: GraphChat = async (purpose, messages) => {
      seen.push({ purpose, text: messages.map((m) => m.content).join('\n') });
      if (purpose === 'rewrite') return JSON.stringify({ standalone: STANDALONE, resolved: true });
      if (purpose === 'generate') {
        return JSON.stringify({ answer: '年假为15天。', citations: [CHUNK], insufficient: false });
      }
      if (purpose === 'claim_split') {
        return JSON.stringify({ claims: [{ text: '年假为15天', chunkIds: [CHUNK] }] });
      }
      if (purpose === 'judge') return JSON.stringify({ scores: [0.9] });
      throw new Error(`unexpected purpose ${purpose}`);
    };

    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        chat,
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: WINDOW_SECRET },
          { role: 'assistant', content: `${WINDOW_SECRET}_A` },
        ],
      }),
    );

    // 非空转：窗确实被 loader 取到、确实进了 rewrite 提示词
    const rewritePrompt = seen.find((s) => s.purpose === 'rewrite')?.text ?? '';
    expect(rewritePrompt).toContain(WINDOW_SECRET);
    expect(r.rewriteUsed).toBe(true);
    expect(r.reason).toBe('verified');

    // 写点唯一：evidence_snapshot 逐字段等于 retrieve 输出，没有任何追加 / 替换 / 改写
    expect(r.evidence_snapshot).toEqual(evidenceOk);
    expect(r.evidence_snapshot).toHaveLength(evidenceOk.length);

    // 会话窗文本不得出现在任何 evidence 正文 / 引用里
    const joined = r.evidence_snapshot.map((e) => e.text).join('\0');
    expect(joined).not.toContain(WINDOW_SECRET);
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(WINDOW_SECRET);
    expect(JSON.stringify(r.citations)).not.toContain(WINDOW_SECRET);
  });

  it('retrieve 无证据（拒答路径）→ evidence_snapshot 为空，绝不回填会话窗文本', async () => {
    const rewriteOnly: GraphChat = async (purpose) => {
      if (purpose === 'rewrite') return JSON.stringify({ standalone: STANDALONE, resolved: true });
      throw new Error(`unexpected purpose ${purpose}`);
    };
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        chat: rewriteOnly,
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: WINDOW_SECRET }],
        retrieve: async () => ({ ok: true, evidence: [], meta: EMPTY_META }),
      }),
    );

    expect(r.reason).toBe('low_retrieval');
    expect(r.status).toBe('abstained');
    expect(r.evidence_snapshot).toEqual([]);
    expect(r.citations).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(WINDOW_SECRET);
  });

  it('未走 retrieve 的轮（chitchat）也不得带任何 evidence —— window 文本没有第二条入 evidence 的路', async () => {
    const chat: GraphChat = async (purpose) => {
      if (purpose === 'rewrite') return JSON.stringify({ standalone: '谢谢', resolved: true });
      throw new Error(`unexpected purpose ${purpose}`);
    };
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        chat,
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: WINDOW_SECRET }],
      }),
    );

    expect(r.reason).toBe('chitchat');
    expect(r.evidence_snapshot).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(WINDOW_SECRET);
  });
});

/**
 * 源码形状守卫：行为型测例拦不住「写点被搬去别处但内容恰好相同」，
 * 故把 run.ts 的 evidence 写点逐字钉住 —— 加第二个写点 / 换来源即红。
 */
describe('run.ts · evidence 写点唯一（源码形状守卫）', () => {
  it('evidence_snapshot 只有两处（retrieve 分支的写 + finalize 的回读），写点来源 = r.evidence', () => {
    const src = readFileSync(RUN_TS, 'utf8');
    expect(src.match(/evidence_snapshot:/g) ?? []).toHaveLength(2);
    expect(src.match(/evidence_snapshot:\s*evidence,/g) ?? []).toHaveLength(1);
    expect(
      src.match(/const evidence:\s*GraphEvidence\[\]\s*=\s*r\.evidence\.map\(/g) ?? [],
    ).toHaveLength(1);
  });
});
