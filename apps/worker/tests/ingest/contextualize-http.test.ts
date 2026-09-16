/**
 * 目标：L1 情境前缀必须走 OpenAI 兼容 chat（temp=0），失败一律抛出以便回退 L0。
 * 需求：prds/04-pipelines/01-offline-ingest.md §4 / §4.1 / §4.2 · 功能表 §6 `ingest.contextualize`
 * 被测：contextualizeChunk · buildContextualizeUserPrompt
 * 简介：注入 fetchImpl；429 / 网络 / 空输出 / 超长输出 / 缺 baseUrl 都抛，不静默返回空串。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildContextualizeUserPrompt,
  CONTEXTUALIZE_OUTPUT_MAX_CHARS,
  CONTEXTUALIZE_SYSTEM_PROMPT,
  contextualizeChunk,
} from '../../src/ingest/contextualize-http.js';

function chatResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

const BASE = {
  baseUrl: 'http://gw.local/v1',
  apiKey: 'k',
  model: 'gpt-4o-mini',
  title: '请假制度',
  docExcerpt: '本制度规定请假流程。',
  chunk: '请假须提前一个工作日提交书面申请。',
};

describe('buildContextualizeUserPrompt', () => {
  it('按 PRD §4.1 冻结字段拼装；无摘要给占位', () => {
    const withExcerpt = buildContextualizeUserPrompt(BASE);
    expect(withExcerpt).toContain('文档标题: 请假制度');
    expect(withExcerpt).toContain('文档摘要/前缀: 本制度规定请假流程。');
    expect(withExcerpt).toContain('块正文: 请假须提前一个工作日提交书面申请。');

    expect(buildContextualizeUserPrompt({ ...BASE, docExcerpt: '' })).toContain(
      '文档摘要/前缀: （无）',
    );
  });

  it('系统提示要求只输出一句、不要引号与解释', () => {
    expect(CONTEXTUALIZE_SYSTEM_PROMPT).toContain('只输出这一句，不要引号与解释');
  });
});

describe('contextualizeChunk', () => {
  it('成功：返回单行前缀，且请求带 temperature=0 与 chat/completions', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('http://gw.local/v1/chat/completions');
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        temperature: number;
        messages: { role: string; content: string }[];
      };
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.temperature).toBe(0);
      expect(body.messages[0]?.role).toBe('system');
      return chatResponse('  「请假流程的提交与审批要求」\n');
    });

    const prefix = await contextualizeChunk({ ...BASE, fetchImpl: fetchImpl as typeof fetch });
    expect(prefix).toBe('请假流程的提交与审批要求');
  });

  it('多行 / 空白压成单行', async () => {
    const fetchImpl = vi.fn(async () =>
      chatResponse('请假流程说明\n   审批与提交要求   '),
    ) as unknown as typeof fetch;
    expect(await contextualizeChunk({ ...BASE, fetchImpl })).toBe('请假流程说明 审批与提交要求');
  });

  it('429 / 网络错 / 畸形响应都抛错（不得当成功）', async () => {
    const tooMany = vi.fn(async () => ({ ok: false, status: 429 }) as Response);
    await expect(
      contextualizeChunk({ ...BASE, fetchImpl: tooMany as unknown as typeof fetch }),
    ).rejects.toThrow(/429/);

    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(
      contextualizeChunk({ ...BASE, fetchImpl: down as unknown as typeof fetch }),
    ).rejects.toThrow(/ECONNRESET/);

    const malformed = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response);
    await expect(
      contextualizeChunk({ ...BASE, fetchImpl: malformed as unknown as typeof fetch }),
    ).rejects.toThrow(/malformed/);
  });

  it('空输出 / 超长输出都抛错（超长按 PRD ≤25 词折算上限）', async () => {
    const empty = vi.fn(async () => chatResponse('   \n  '));
    await expect(
      contextualizeChunk({ ...BASE, fetchImpl: empty as unknown as typeof fetch }),
    ).rejects.toThrow(/empty/);

    const long = vi.fn(async () =>
      chatResponse('前缀'.repeat(CONTEXTUALIZE_OUTPUT_MAX_CHARS)),
    );
    await expect(
      contextualizeChunk({ ...BASE, fetchImpl: long as unknown as typeof fetch }),
    ).rejects.toThrow(/too long/);
  });

  it('缺 GATEWAY_BASE_URL 直接抛（不发请求）', async () => {
    const fetchImpl = vi.fn();
    await expect(
      contextualizeChunk({ ...BASE, baseUrl: '', fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/GATEWAY_BASE_URL/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
