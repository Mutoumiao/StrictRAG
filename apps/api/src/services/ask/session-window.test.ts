import { describe, expect, it } from 'vitest';

import { clipAssistantContent, clipSessionWindow } from './session-window.js';

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
