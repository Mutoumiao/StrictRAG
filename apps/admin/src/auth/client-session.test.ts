import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearClientSession,
  readClientSession,
  saveClientSession,
} from '@/auth/client-session';

const ADMIN_KEY = 'strict-rag:admin:client-session';
const WEB_KEY = 'strict-rag:web:client-session';

const sample = {
  accessToken: 'admin-at',
  refreshToken: 'admin-rt',
  session: {
    sessionId: 'as-1',
    userId: 'au-1',
    app: 'admin' as const,
    roles: ['kb_admin'],
    permissions: ['admin.shell'],
    expiresAtMs: 4_102_444_800_000,
  },
};

describe('admin client-session', () => {
  beforeEach(() => {
    clearClientSession();
    localStorage.clear();
  });

  it('仅写 admin key，与 web 隔离', () => {
    saveClientSession(sample);
    expect(localStorage.getItem(ADMIN_KEY)).toBeTruthy();
    expect(localStorage.getItem(WEB_KEY)).toBeNull();
    expect(readClientSession()?.accessToken).toBe('admin-at');
  });
});
