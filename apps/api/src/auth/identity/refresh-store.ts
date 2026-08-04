/**
 * Refresh token 有状态存储（MVP：进程内 Map）。
 * 生产应迁 Redis / PG；接入 Better Auth 后由 BA session 表接管。
 */

import type { AuthApp } from '@strict-rag/contracts';

import type { RefreshTokenRecord } from '../types.js';

const byJti = new Map<string, RefreshTokenRecord>();

export function putRefreshToken(record: RefreshTokenRecord): void {
  byJti.set(record.jti, record);
}

export function getRefreshToken(jti: string): RefreshTokenRecord | undefined {
  return byJti.get(jti);
}

export function markRefreshUsed(jti: string, usedAtMs: number): boolean {
  const row = byJti.get(jti);
  if (!row || row.usedAtMs !== null) return false;
  row.usedAtMs = usedAtMs;
  byJti.set(jti, row);
  return true;
}

export function revokeSession(sessionId: string, atMs: number): void {
  for (const [jti, row] of byJti) {
    if (row.sessionId === sessionId) {
      row.sessionRevokedAtMs = atMs;
      row.revokedAtMs = atMs;
      byJti.set(jti, row);
    }
  }
}

export function listRefreshForApp(app: AuthApp): number {
  let n = 0;
  for (const row of byJti.values()) {
    if (row.app === app && row.revokedAtMs === null) n += 1;
  }
  return n;
}

/** 测试用 */
export function clearRefreshStore(): void {
  byJti.clear();
}
