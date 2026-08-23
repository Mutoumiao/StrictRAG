/**
 * 目标：当前 KB 选择必须读写 admin 独立 key，失败则污染 web 或选库丢失。
 * 需求：壳 KB 上下文
 * 被测：readStoredKbId / writeStoredKbId
 * 简介：localStorage key。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { readStoredKbId, writeStoredKbId } from '@/lib/kb-context';

describe('kb-context', () => {
  beforeEach(() => localStorage.clear());

  it('写 admin KB key，不污染 web', () => {
    writeStoredKbId('kb-1');
    expect(readStoredKbId()).toBe('kb-1');
    expect(localStorage.getItem('strict-rag:admin:last-kb-id')).toBe('kb-1');
    expect(localStorage.getItem('strict-rag:web:last-kb-id')).toBeNull();
  });
});
