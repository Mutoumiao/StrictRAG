/**
 * 目标：同文档入库互斥，忙则 DOC_LOCK_BUSY。
 * 需求：X-04
 * 被测：tryAcquireDocLock · releaseDocLock · withDocLock · createIoredisDocLock
 * 简介：Redis SET NX EX；Lua 按 token 释放；非 Redlock。
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createIoredisDocLock,
  DEFAULT_DOC_LOCK_TTL_SEC,
  docLockKey,
  mintDocLockToken,
  releaseDocLock,
  RELEASE_LOCK_LUA,
  tryAcquireDocLock,
  withDocLock,
  type DocLockStore,
  type IoredisLike,
} from '../../src/ingest/doc-lock.js';

/** 进程内锁替身：真实驱动 setNxEx / releaseIfOwner 语义 */
function createMemoryStore(): DocLockStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async setNxEx(key, value) {
      if (map.has(key)) return false;
      map.set(key, value);
      return true;
    },
    async releaseIfOwner(key, token) {
      if (map.get(key) !== token) return false;
      map.delete(key);
      return true;
    },
  };
}

describe('docLockKey / mintDocLockToken', () => {
  it('key is stable and namespaced by docId', () => {
    expect(docLockKey('doc-a')).toBe('sr:ingest:doc-lock:doc-a');
    expect(docLockKey('doc-b')).toBe('sr:ingest:doc-lock:doc-b');
    expect(docLockKey('doc-a')).not.toBe(docLockKey('doc-b'));
  });

  it('mintDocLockToken returns uuid-shaped token', () => {
    const t = mintDocLockToken();
    expect(t).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('default TTL is 180s', () => {
    expect(DEFAULT_DOC_LOCK_TTL_SEC).toBe(180);
  });
});

describe('tryAcquireDocLock / releaseDocLock (shipped)', () => {
  it('first acquire wins; second fails until release', async () => {
    const store = createMemoryStore();
    const a = 'token-a';
    const b = 'token-b';

    expect(await tryAcquireDocLock(store, 'd1', a, 60)).toBe(true);
    expect(store.map.get(docLockKey('d1'))).toBe(a);

    expect(await tryAcquireDocLock(store, 'd1', b, 60)).toBe(false);
    expect(store.map.get(docLockKey('d1'))).toBe(a);

    expect(await releaseDocLock(store, 'd1', a)).toBe(true);
    expect(store.map.has(docLockKey('d1'))).toBe(false);

    expect(await tryAcquireDocLock(store, 'd1', b, 60)).toBe(true);
    expect(store.map.get(docLockKey('d1'))).toBe(b);
  });

  it('release with wrong token does not delete holder lock', async () => {
    const store = createMemoryStore();
    await tryAcquireDocLock(store, 'd2', 'holder', 30);
    expect(await releaseDocLock(store, 'd2', 'intruder')).toBe(false);
    expect(store.map.get(docLockKey('d2'))).toBe('holder');
  });

  it('different docs do not contend', async () => {
    const store = createMemoryStore();
    expect(await tryAcquireDocLock(store, 'x', 't1')).toBe(true);
    expect(await tryAcquireDocLock(store, 'y', 't2')).toBe(true);
  });
});

describe('createIoredisDocLock (shipped adapter)', () => {
  it('SET NX EX OK → acquire true; null → false', async () => {
    const set = vi
      .fn<IoredisLike['set']>()
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);
    const evalFn = vi.fn<IoredisLike['eval']>().mockResolvedValue(1);
    const store = createIoredisDocLock({ set, eval: evalFn });

    expect(await tryAcquireDocLock(store, 'd3', 'tok', 42)).toBe(true);
    expect(set).toHaveBeenCalledWith(docLockKey('d3'), 'tok', 'EX', 42, 'NX');

    expect(await tryAcquireDocLock(store, 'd3', 'tok2', 42)).toBe(false);
  });

  it('releaseIfOwner runs Lua with key+token', async () => {
    const set = vi.fn<IoredisLike['set']>().mockResolvedValue('OK');
    const evalFn = vi.fn<IoredisLike['eval']>().mockResolvedValue(1);
    const store = createIoredisDocLock({ set, eval: evalFn });
    expect(await releaseDocLock(store, 'd4', 'tok-z')).toBe(true);
    expect(evalFn).toHaveBeenCalledWith(
      RELEASE_LOCK_LUA,
      1,
      docLockKey('d4'),
      'tok-z',
    );
  });

  it('release returns false when eval returns 0', async () => {
    const store = createIoredisDocLock({
      set: async () => 'OK',
      eval: async () => 0,
    });
    expect(await releaseDocLock(store, 'd5', 'x')).toBe(false);
  });
});

describe('withDocLock (shipped orchestration)', () => {
  it('runs fn when lock acquired and releases after', async () => {
    const store = createMemoryStore();
    let ran = false;
    const out = await withDocLock(store, 'd6', async () => {
      ran = true;
      expect(store.map.has(docLockKey('d6'))).toBe(true);
      return 99;
    });
    expect(out).toBe(99);
    expect(ran).toBe(true);
    expect(store.map.has(docLockKey('d6'))).toBe(false);
  });

  it('does not run fn when lock busy; throws DOC_LOCK_BUSY', async () => {
    const store = createMemoryStore();
    await tryAcquireDocLock(store, 'd7', 'other');
    const fn = vi.fn(async () => 'nope');
    await expect(withDocLock(store, 'd7', fn)).rejects.toThrow(/DOC_LOCK_BUSY/);
    expect(fn).not.toHaveBeenCalled();
    expect(store.map.get(docLockKey('d7'))).toBe('other');
  });

  it('releases lock even when fn throws', async () => {
    const store = createMemoryStore();
    await expect(
      withDocLock(store, 'd8', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(store.map.has(docLockKey('d8'))).toBe(false);
  });
});
