import { describe, expect, it, vi } from 'vitest';

import { lookupKbMembership, membershipCacheKey } from './kb-scope.js';

describe('kb-scope membership cache', () => {
  it('membershipCacheKey 区分 user 与 kb', () => {
    expect(membershipCacheKey('u1', 'k1')).not.toBe(membershipCacheKey('u2', 'k1'));
    expect(membershipCacheKey('u1', 'k1')).not.toBe(membershipCacheKey('u1', 'k2'));
    expect(membershipCacheKey('u1', 'k1')).toBe(membershipCacheKey('u1', 'k1'));
  });

  it('同 key 两次 lookup → resolve 只调用 1 次', async () => {
    const resolve = vi.fn(async () => true);
    const cache = new Map<string, boolean>();

    const a = await lookupKbMembership({
      userId: 'u1',
      kbId: 'kb1',
      cache,
      resolve,
    });
    const b = await lookupKbMembership({
      userId: 'u1',
      kbId: 'kb1',
      cache,
      resolve,
    });

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('不同 kb → 各 resolve 一次', async () => {
    const resolve = vi.fn(async (_u: string, kb: string) => kb === 'kb-yes');
    const cache = new Map<string, boolean>();

    const yes = await lookupKbMembership({
      userId: 'u1',
      kbId: 'kb-yes',
      cache,
      resolve,
    });
    const no = await lookupKbMembership({
      userId: 'u1',
      kbId: 'kb-no',
      cache,
      resolve,
    });

    expect(yes).toBe(true);
    expect(no).toBe(false);
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
