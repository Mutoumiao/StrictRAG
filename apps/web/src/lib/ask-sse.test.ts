import { describe, expect, it } from 'vitest';

import { parseAskSseText } from './ask-sse-parse';

const CHUNK = '01900000-0000-7000-8000-000000000001';
const DOC = '01900000-0000-7000-8000-000000000002';

describe('parseAskSseText', () => {
  it('只采纳 final，忽略 token 类伪事件', () => {
    const text = [
      'event: status',
      'data: {"phase":"running"}',
      '',
      'event: token',
      'data: {"text":"假流式正文，不得展示为答案"}',
      '',
      'event: final',
      `data: ${JSON.stringify({
        requestId: 'r1',
        status: 'answered',
        answer: '正式答案',
        answerKind: 'knowledge',
        citations: [{ chunkId: CHUNK, docId: DOC, title: '手册' }],
        reason: 'verified',
        suggestedActions: [],
      })}`,
      '',
    ].join('\n');

    const r = parseAskSseText(text);
    expect(r.final?.answer).toBe('正式答案');
    expect(r.final?.status).toBe('answered');
    expect(r.final?.citations).toHaveLength(1);
    expect(r.statuses[0]?.phase).toBe('running');
  });

  it('abstained final + error 可并存（kb_not_ready）', () => {
    const text = [
      'event: error',
      'data: {"code":"KB_NOT_READY","message":"empty","reason":"kb_not_ready"}',
      '',
      'event: final',
      `data: ${JSON.stringify({
        requestId: 'r2',
        status: 'abstained',
        answer: '',
        citations: [],
        reason: 'kb_not_ready',
        userMessage: '知识库尚无可用文档',
        suggestedActions: [{ type: 'ingest', label: '先入库文档' }],
      })}`,
      '',
    ].join('\n');

    const r = parseAskSseText(text);
    expect(r.error?.code).toBe('KB_NOT_READY');
    expect(r.final?.status).toBe('abstained');
    expect(r.final?.reason).toBe('kb_not_ready');
    expect(r.final?.suggestedActions?.[0]?.label).toBe('先入库文档');
  });

  it('非法 final 不采纳', () => {
    const text = ['event: final', 'data: {"status":"answered"}', ''].join('\n');
    const r = parseAskSseText(text);
    expect(r.final).toBeNull();
  });
});
