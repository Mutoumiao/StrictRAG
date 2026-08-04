/**
 * 双 JWT 身份。
 * 目标：access 短无状态 + refresh 有状态可轮换。
 * Better Auth 接入后可替换本模块，客户端 TokenPair 形状保持不变。
 */

import { SignJWT, jwtVerify } from 'jose';
import { uuidv7 } from 'uuidv7';

import type { AccessTokenClaims, RefreshTokenClaims } from '../types.js';
import type { AuthApp } from '@strict-rag/contracts';

const encoder = new TextEncoder();

function toSecret(secret: string): Uint8Array {
  return encoder.encode(secret);
}

export async function signAccessToken(params: {
  claims: AccessTokenClaims;
  secret: string;
  ttlSec: number;
}): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sid: params.claims.sid,
    app: params.claims.app,
    roles: params.claims.roles,
  };
  if (params.claims.tenantId) payload.tenantId = params.claims.tenantId;
  if (params.claims.email) payload.email = params.claims.email;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(params.claims.sub)
    .setJti(uuidv7())
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + params.ttlSec)
    .sign(toSecret(params.secret));
}

export async function signRefreshToken(params: {
  claims: Omit<RefreshTokenClaims, 'jti'>;
  secret: string;
  ttlSec: number;
}): Promise<{ token: string; jti: string }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const jti = uuidv7();
  const token = await new SignJWT({
    sid: params.claims.sid,
    app: params.claims.app,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(params.claims.sub)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + params.ttlSec)
    .sign(toSecret(params.secret));
  return { token, jti };
}

export async function verifyAccessToken(params: {
  token: string;
  secret: string;
  expectedApp?: AuthApp | AuthApp[];
}): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(params.token, toSecret(params.secret), {
    algorithms: ['HS256'],
  });
  const sid = payload.sid;
  const app = payload.app;
  const roles = payload.roles;
  const sub = payload.sub;
  const expected = params.expectedApp;

  if (
    typeof sid !== 'string' ||
    typeof app !== 'string' ||
    typeof sub !== 'string' ||
    !Array.isArray(roles) ||
    roles.some((r) => typeof r !== 'string')
  ) {
    throw new Error('Invalid access token claims');
  }
  if (expected) {
    const ok = Array.isArray(expected) ? expected.includes(app as AuthApp) : app === expected;
    if (!ok) throw new Error('Unexpected app claim');
  }

  return {
    sub,
    sid,
    app: app as AuthApp,
    roles: roles as string[],
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

export async function verifyRefreshToken(params: {
  token: string;
  secret: string;
  expectedApp?: AuthApp;
}): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(params.token, toSecret(params.secret), {
    algorithms: ['HS256'],
  });
  const sid = payload.sid;
  const app = payload.app;
  const jti = payload.jti;
  const sub = payload.sub;

  if (
    typeof sid !== 'string' ||
    typeof app !== 'string' ||
    typeof jti !== 'string' ||
    typeof sub !== 'string'
  ) {
    throw new Error('Invalid refresh token claims');
  }
  if (params.expectedApp && app !== params.expectedApp) {
    throw new Error('Unexpected app claim');
  }

  return {
    sub,
    sid,
    app: app as AuthApp,
    jti,
  };
}
