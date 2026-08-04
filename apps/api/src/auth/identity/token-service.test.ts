import { afterEach, describe, expect, it } from 'vitest';

import { clearRefreshStore } from './refresh-store.js';
import {
  AuthIdentityError,
  issueTokenPair,
  refreshTokenPair,
  verifyBearerAccess,
} from './token-service.js';

describe('token-service dual token', () => {
  afterEach(() => {
    clearRefreshStore();
  });

  it('issues and verifies access token', async () => {
    const pair = await issueTokenPair({
      userId: 'u1',
      app: 'admin',
      roles: ['super_admin'],
      email: 'a@example.com',
    });
    expect(pair.tokenType).toBe('Bearer');
    expect(pair.session.permissions.length).toBeGreaterThan(0);

    const claims = await verifyBearerAccess(`Bearer ${pair.accessToken}`, 'admin');
    expect(claims.sub).toBe('u1');
    expect(claims.app).toBe('admin');
  });

  it('refreshes and rotates; replay fails', async () => {
    const pair = await issueTokenPair({
      userId: 'u2',
      app: 'web',
      roles: ['web_consumer'],
    });

    const next = await refreshTokenPair(pair.refreshToken, 'web');
    expect(next.accessToken).not.toBe(pair.accessToken);

    await expect(refreshTokenPair(pair.refreshToken, 'web')).rejects.toBeInstanceOf(
      AuthIdentityError,
    );
  });

  it('rejects wrong app on access', async () => {
    const pair = await issueTokenPair({
      userId: 'u3',
      app: 'web',
      roles: ['web_consumer'],
    });
    await expect(verifyBearerAccess(`Bearer ${pair.accessToken}`, 'admin')).rejects.toBeInstanceOf(
      AuthIdentityError,
    );
  });
});
