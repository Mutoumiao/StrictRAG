/**
 * 目标：access jti 与 refresh 轮转在同一秒内可区分。
 * 需求：prds/09-security
 * 被测：issueTokenPair / rotateRefresh
 * 简介：同秒可区分。
 */

import { afterEach, describe, expect, it } from 'vitest';

import { clearRefreshStore } from '../../src/auth/identity/refresh-store.js';
import {
  AuthIdentityError,
  issueTokenPair,
  refreshTokenPair,
  verifyBearerAccess,
} from '../../src/auth/identity/token-service.js';

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
