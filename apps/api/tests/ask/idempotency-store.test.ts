/**
 * 目标：幂等键的作用域与后端适配必须可核对：键含 tenant/user/kb，抢占/复用/释放语义确定。
 * 需求：prds/03-data §2.1（Redis `ask:idem:{key}` TTL 10m）· prds/01-architecture §3（Redis key 含 tenant）
 * 被测：services/ask/idempotency.ts（askIdemKey · normalizeIdempotencyKey · claimAskIdem · 内存与 ioredis 适配）
 * 简介：TTL 冻结 600s；同原始键不同用户/库得到不同键；claim 首次成功、二次复用首次 requestId；释放后可重抢；ioredis 适配发出 SET key value EX ttl NX。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  ASK_IDEM_KEY_PREFIX,
  ASK_IDEM_RAW_KEY_MAX,
  ASK_IDEM_TTL_SEC,
  askIdemKey,
  claimAskIdem,
  createIoredisAskIdemStore,
  createMemoryAskIdemStore,
  normalizeIdempotencyKey,
  releaseAskIdem,
} from '../../src/services/ask/idempotency.js';

const T1 = '01900000-0000-7000-8000-000000000001';
const U1 = '01900000-0000-7000-8000-0000000000a1';
const U2 = '01900000-0000-7000-8000-0000000000a2';
const KB1 = '01900000-0000-7000-8000-0000000000b1';
const KB2 = '01900000-0000-7000-8000-0000000000b2';

describe('幂等键构造与归一', () => {
  it('TTL 与长度上限为冻结值', () => {
    expect(ASK_IDEM_TTL_SEC).toBe(600);
    expect(ASK_IDEM_RAW_KEY_MAX).toBe(200);
  });

  it('键含 tenant / user / kb，同原始键在不同作用域下不相等', () => {
    const base = { tenantId: T1, userId: U1, kbId: KB1, rawKey: 'r-1' };
    const key = askIdemKey(base);
    expect(key.startsWith(ASK_IDEM_KEY_PREFIX)).toBe(true);
    expect(key).toContain(T1);
    expect(key).toContain(U1);
    expect(key).toContain(KB1);
    expect(key).not.toBe(askIdemKey({ ...base, userId: U2 }));
    expect(key).not.toBe(askIdemKey({ ...base, kbId: KB2 }));
    expect(key).not.toBe(askIdemKey({ ...base, tenantId: '01900000-0000-7000-8000-000000000002' }));
  });

  it('空白 header 视为未带；两侧空白被裁剪', () => {
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey(null)).toBeNull();
    expect(normalizeIdempotencyKey('   ')).toBeNull();
    expect(normalizeIdempotencyKey('  abc  ')).toBe('abc');
  });
});

describe('抢占 / 复用 / 释放', () => {
  it('首次 claim 成功，二次 claim 复用首次 requestId', async () => {
    const store = createMemoryAskIdemStore();
    const first = await claimAskIdem(store, 'k', 'req-1');
    const second = await claimAskIdem(store, 'k', 'req-2');

    expect(first).toEqual({ status: 'claimed' });
    expect(second).toEqual({ status: 'reuse', requestId: 'req-1' });
  });

  it('释放后可重新抢占（跑图抛错重试路径）', async () => {
    const store = createMemoryAskIdemStore();
    await claimAskIdem(store, 'k', 'req-1');
    await releaseAskIdem(store, 'k');
    const again = await claimAskIdem(store, 'k', 'req-2');

    expect(again).toEqual({ status: 'claimed' });
  });

  it('claim 带上 TTL 秒数', async () => {
    const setNxEx = vi.fn(async () => true);
    const store = { setNxEx, get: async () => null, del: async () => undefined };
    await claimAskIdem(store, 'k', 'req-1');

    expect(setNxEx).toHaveBeenCalledWith('k', 'req-1', 600);
  });
});

describe('ioredis 适配', () => {
  it('发出 SET key value EX ttl NX；OK → true，null → false', async () => {
    const client = {
      set: vi.fn(async () => 'OK' as const),
      get: vi.fn(async () => 'req-1'),
      del: vi.fn(async () => 1),
    };
    const store = createIoredisAskIdemStore(client);

    await expect(store.setNxEx('k', 'v', 600)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 600, 'NX');
    await expect(store.get('k')).resolves.toBe('req-1');
    await store.del('k');
    expect(client.del).toHaveBeenCalledWith('k');
  });

  it('SET 返回 null（键已存在）→ false', async () => {
    const client = {
      set: vi.fn(async () => null),
      get: vi.fn(async () => 'req-1'),
      del: vi.fn(async () => 1),
    };
    await expect(createIoredisAskIdemStore(client).setNxEx('k', 'v', 600)).resolves.toBe(false);
  });
});
