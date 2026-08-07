import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearClientSession,
  readClientSession,
  saveClientSession,
} from '@/auth/client-session';

const WEB_KEY = 'strict-rag:web:client-session';
const ADMIN_KEY = 'strict-rag:admin:client-session';

const sample = {
  accessToken: 'at-1',
  refreshToken: 'rt-1',
  session: {
    sessionId: 's-1',
    userId: 'u-1',
    app: 'web' as const,
    roles: ['web_consumer'],
    permissions: [],
    expiresAtMs: 4_102_444_800_000,
  },
};

describe('web client-session', () => {
  beforeEach(() => {
    clearClientSession();
    localStorage.clear();
  });

  it('只写 web key，不碰 admin', () => {
    saveClientSession(sample);
    expect(localStorage.getItem(WEB_KEY)).toBeTruthy();
    expect(localStorage.getItem(ADMIN_KEY)).toBeNull();
    expect(readClientSession()?.accessToken).toBe('at-1');
  });

  it('R4: clear 后读不到', () => {
    saveClientSession(sample);
    clearClientSession();
    expect(readClientSession()).toBeNull();
    expect(localStorage.getItem(WEB_KEY)).toBeNull();
  });

  it('R4: 坏 JSON 读路径 → null', () => {
    localStorage.setItem(WEB_KEY, '{not-json');
    expect(readClientSession()).toBeNull();
    expect(localStorage.getItem(WEB_KEY)).toBeNull();
  });

  it('R4: 从未写入 → null（无 token）', () => {
    expect(readClientSession()).toBeNull();
  });
});
