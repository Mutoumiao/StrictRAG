import { describe, expect, it } from 'vitest';

import { createMemorySessionsRepo } from '../sessions.js';
import {
  clipAssistantContent,
  clipSessionWindow,
  isExplicitDocumentBackref,
  isExplicitSessionBackref,
  uniqueEvidenceDocIds,
} from './session-window.js';

describe('clipSessionWindow', () => {
  it('keeps last 2 users and assistants between/after them', () => {
    const out = clipSessionWindow([
      { role: 'user', content: 'u1 年假' },
      { role: 'assistant', content: 'a1 15天' },
      { role: 'user', content: 'u2 差旅住宿' },
      { role: 'assistant', content: 'a2 上限500' },
      { role: 'user', content: 'u3 那餐补呢？' },
      { role: 'assistant', content: 'a3 待答' },
    ]);
    expect(out.map((t) => t.content)).toEqual(['u2 差旅住宿', 'a2 上限500', 'u3 那餐补呢？', 'a3 待答']);
    expect(out.filter((t) => t.role === 'user')).toHaveLength(2);
  });

  it('single user keeps that user and following assistants', () => {
    const out = clipSessionWindow([
      { role: 'assistant', content: 'orphan' },
      { role: 'user', content: 'only' },
      { role: 'assistant', content: 'reply' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'only' },
      { role: 'assistant', content: 'reply' },
    ]);
  });

  it('no user → empty (skip rewrite)', () => {
    expect(clipSessionWindow([{ role: 'assistant', content: 'hi' }])).toEqual([]);
    expect(clipSessionWindow([])).toEqual([]);
  });

  it('hard cap 6 turns (most recent)', () => {
    const msgs: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: 'u1' },
    ];
    for (let i = 0; i < 5; i++) {
      msgs.push({ role: 'assistant', content: `a${i}` });
    }
    msgs.push({ role: 'user', content: 'u2' });
    msgs.push({ role: 'assistant', content: 'tail' });
    const out = clipSessionWindow(msgs);
    expect(out.length).toBeLessThanOrEqual(6);
    expect(out.filter((t) => t.role === 'user').length).toBeLessThanOrEqual(2);
    expect(out.at(-1)).toEqual({ role: 'assistant', content: 'tail' });
  });

  it('does not clip user content', () => {
    const long = '问'.repeat(200);
    const out = clipSessionWindow([{ role: 'user', content: long }]);
    expect(out[0]?.content).toBe(long);
  });

  it('deepened: last 4 users, hard cap 8', () => {
    const msgs: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: 'u0' },
      { role: 'assistant', content: 'a0' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'u4' },
      { role: 'assistant', content: 'a4' },
    ];
    const def = clipSessionWindow(msgs);
    expect(def.map((t) => t.content)).toEqual(['u3', 'a3', 'u4', 'a4']);
    expect(def.filter((t) => t.role === 'user')).toHaveLength(2);
    expect(def.length).toBeLessThanOrEqual(6);

    const deep = clipSessionWindow(msgs, { deepened: true });
    expect(deep.length).toBeLessThanOrEqual(8);
    expect(deep.filter((t) => t.role === 'user').length).toBeLessThanOrEqual(4);
    expect(deep.map((t) => t.content)).toEqual(['u1', 'a1', 'u2', 'a2', 'u3', 'a3', 'u4', 'a4']);
    expect(deep.map((t) => t.content)).not.toContain('u0');
  });

  it('deepened still clips assistant content', () => {
    const out = clipSessionWindow(
      [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: '住宿上限500元。后续还有长段解释。' },
      ],
      { deepened: true },
    );
    expect(out[1]?.content).toBe('住宿上限500元。');
  });
});

describe('isExplicitSessionBackref', () => {
  it('hits explicit session backref phrases', () => {
    expect(isExplicitSessionBackref('根据刚才说的住宿标准，餐补怎么算？')).toBe(true);
    expect(isExplicitSessionBackref('我之前跟你聊过')).toBe(true);
    expect(isExplicitSessionBackref('我刚刚说过')).toBe(true);
    expect(isExplicitSessionBackref('根据之前说的')).toBe(true);
  });

  it('does not treat bare 刚才 / 之前 as backref', () => {
    expect(isExplicitSessionBackref('刚才提交的请假单进度')).toBe(false);
    expect(isExplicitSessionBackref('之前的制度文件在哪')).toBe(false);
    expect(isExplicitSessionBackref('那餐补呢？')).toBe(false);
  });
});

describe('isExplicitDocumentBackref', () => {
  it('hits explicit document backref phrases', () => {
    expect(isExplicitDocumentBackref('这份文档的适用范围是什么')).toBe(true);
    expect(isExplicitDocumentBackref('那份文件还有补充吗')).toBe(true);
    expect(isExplicitDocumentBackref('上面那篇制度谁签的')).toBe(true);
    expect(isExplicitDocumentBackref('该文档的生效日期')).toBe(true);
  });

  it('does not treat 刚才请假 / 那餐补 / 根据刚才说的 as document backref', () => {
    expect(isExplicitDocumentBackref('刚才提交的请假单')).toBe(false);
    expect(isExplicitDocumentBackref('那餐补呢')).toBe(false);
    expect(isExplicitDocumentBackref('根据刚才说的')).toBe(false);
  });

  it('is orthogonal to session backref', () => {
    expect(isExplicitDocumentBackref('这份文档的适用范围是什么')).toBe(true);
    expect(isExplicitSessionBackref('这份文档的适用范围是什么')).toBe(false);
    expect(isExplicitDocumentBackref('根据刚才说的，那份文档还有补充吗')).toBe(true);
    expect(isExplicitSessionBackref('根据刚才说的，那份文档还有补充吗')).toBe(true);
  });
});

describe('uniqueEvidenceDocIds', () => {
  it('preserves order and drops dup / empty', () => {
    expect(
      uniqueEvidenceDocIds([
        { docId: 'a' },
        { docId: 'b' },
        { docId: 'a' },
        {},
        { docId: '' },
      ]),
    ).toEqual(['a', 'b']);
    expect(uniqueEvidenceDocIds(null)).toEqual([]);
    expect(uniqueEvidenceDocIds(undefined)).toEqual([]);
  });
});

describe('document-only backref does not deepen window', () => {
  it('clipSessionWindow stays ≤2 user / ≤6', () => {
    expect(isExplicitDocumentBackref('这份文档的适用范围是什么')).toBe(true);
    expect(isExplicitSessionBackref('这份文档的适用范围是什么')).toBe(false);
    const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
    for (let i = 0; i < 5; i++) {
      msgs.push({ role: 'user', content: `u${i}` });
      msgs.push({ role: 'assistant', content: `a${i}` });
    }
    const out = clipSessionWindow(msgs);
    expect(out.filter((t) => t.role === 'user').length).toBeLessThanOrEqual(2);
    expect(out.length).toBeLessThanOrEqual(6);
  });
});

describe('listLastEvidenceDocIds (memory)', () => {
  it('returns last trace docIds; other session / unowned → []', async () => {
    const mem = createMemorySessionsRepo();
    const a = await mem.create({ kbId: 'kb1', tenantId: 't1', userId: 'u1' });
    const b = await mem.create({ kbId: 'kb1', tenantId: 't1', userId: 'u1' });
    mem.appendTrace({
      sessionId: a.sessionId,
      kbId: 'kb1',
      userId: 'u1',
      requestId: 'r1',
      question: 'q',
      answer: 'a',
      status: 'answered',
      reason: 'verified',
      evidenceDocIds: ['doc-a', 'doc-a', 'doc-b'],
    });
    expect(
      await mem.listLastEvidenceDocIds({
        sessionId: a.sessionId,
        kbId: 'kb1',
        userId: 'u1',
      }),
    ).toEqual(['doc-a', 'doc-b']);
    expect(
      await mem.listLastEvidenceDocIds({
        sessionId: b.sessionId,
        kbId: 'kb1',
        userId: 'u1',
      }),
    ).toEqual([]);
    expect(
      await mem.listLastEvidenceDocIds({
        sessionId: a.sessionId,
        kbId: 'kb1',
        userId: 'other',
      }),
    ).toEqual([]);
  });
});

describe('clipAssistantContent', () => {
  it('truncates to 160 chars', () => {
    const long = `${'字'.repeat(200)}。`;
    expect(clipAssistantContent(long).length).toBeLessThanOrEqual(160);
  });

  it('keeps first sentence only', () => {
    expect(clipAssistantContent('住宿上限500元。后续还有长段解释。')).toBe('住宿上限500元。');
  });

  it('strips citation dump after first sentence block', () => {
    const text = '年假15天。\nCITATIONS:\n[cite:aaaaaaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee] 全文……';
    const out = clipAssistantContent(text);
    expect(out).toBe('年假15天。');
    expect(out).not.toMatch(/CITATIONS|cite:/);
  });
});
