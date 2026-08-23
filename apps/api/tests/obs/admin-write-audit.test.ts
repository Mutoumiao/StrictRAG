/**
 * 目标：管理写路径必须打审计日志且不落表、不含敏感键。
 * 需求：ARCH-P1b-2
 * 被测：adminWriteAuditMiddleware / shouldAuditAdminWrite
 * 简介：不落表。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as loggerMod from '../../src/logger.js';
import type { ApiVariables } from '../../src/middleware/request-id.js';
import {
  adminWriteAuditMiddleware,
  buildAdminWritePayload,
  extractKbIdFromPath,
  shouldAuditAdminWrite,
} from '../../src/middleware/admin-write-audit.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

/** 单测：日志 payload 不得含敏感键名（仅测试用，不进生产模块） */
function assertNoSensitiveLogKeys(obj: Record<string, unknown>): boolean {
  const forbidden = new Set([
    'authorization',
    'password',
    'apikey',
    'api_key',
    'token',
    'secret',
    'refreshtoken',
    'accesstoken',
  ]);
  for (const key of Object.keys(obj)) {
    if (forbidden.has(key.toLowerCase())) return false;
  }
  return true;
}

describe('shouldAuditAdminWrite', () => {
  it('成员 / 审批 / 生命周期写 → true', () => {
    expect(
      shouldAuditAdminWrite('POST', '/api/v1/knowledge-bases/kb1/members'),
    ).toBe(true);
    expect(
      shouldAuditAdminWrite('DELETE', '/api/v1/knowledge-bases/kb1/members/u1'),
    ).toBe(true);
    expect(shouldAuditAdminWrite('POST', '/api/v1/documents/d1/approve')).toBe(true);
    expect(shouldAuditAdminWrite('POST', '/api/v1/documents/d1/reject')).toBe(true);
    expect(shouldAuditAdminWrite('PATCH', '/api/v1/documents/d1/lifecycle')).toBe(true);
  });

  it('平台 admin 写 + KB settings PATCH → true', () => {
    expect(shouldAuditAdminWrite('POST', '/api/v1/admin/users')).toBe(true);
    expect(shouldAuditAdminWrite('PATCH', '/api/v1/admin/roles/r1')).toBe(true);
    expect(shouldAuditAdminWrite('PUT', '/api/v1/admin/model-bindings')).toBe(true);
    expect(
      shouldAuditAdminWrite('PATCH', '/api/v1/knowledge-bases/kb1/settings'),
    ).toBe(true);
  });

  it('GET / ask / auth / health → false', () => {
    expect(shouldAuditAdminWrite('GET', '/api/v1/knowledge-bases/kb1/members')).toBe(
      false,
    );
    expect(shouldAuditAdminWrite('POST', '/api/v1/knowledge-bases/kb1/ask')).toBe(false);
    expect(shouldAuditAdminWrite('POST', '/api/v1/auth/admin/dev-login')).toBe(false);
    expect(shouldAuditAdminWrite('POST', '/api/v1/auth/web/token/refresh')).toBe(false);
    expect(shouldAuditAdminWrite('GET', '/health')).toBe(false);
    expect(shouldAuditAdminWrite('GET', '/ready')).toBe(false);
    expect(shouldAuditAdminWrite('GET', '/metrics')).toBe(false);
  });

  it('非管理写（upload complete / sessions）→ false', () => {
    expect(
      shouldAuditAdminWrite(
        'POST',
        '/api/v1/knowledge-bases/kb1/documents/d1/complete',
      ),
    ).toBe(false);
    expect(
      shouldAuditAdminWrite('POST', '/api/v1/knowledge-bases/kb1/sessions'),
    ).toBe(false);
  });
});

describe('extractKbIdFromPath / buildAdminWritePayload', () => {
  it('extracts kbId', () => {
    expect(extractKbIdFromPath('/api/v1/knowledge-bases/kb-abc/members')).toBe('kb-abc');
    expect(extractKbIdFromPath('/api/v1/documents/d1/approve')).toBeUndefined();
  });

  it('payload has admin_write fields and no secrets', () => {
    const p = buildAdminWritePayload({
      method: 'post',
      path: '/api/v1/documents/d1/approve',
      status: 200,
      durationMs: 12,
    });
    expect(p).toEqual({
      event: 'admin_write',
      method: 'POST',
      path: '/api/v1/documents/d1/approve',
      status: 200,
      durationMs: 12,
    });
    expect(assertNoSensitiveLogKeys(p as unknown as Record<string, unknown>)).toBe(true);
  });

  it('assertNoSensitiveLogKeys rejects secret keys', () => {
    expect(assertNoSensitiveLogKeys({ authorization: 'Bearer x' })).toBe(false);
    expect(assertNoSensitiveLogKeys({ password: 'x' })).toBe(false);
    expect(assertNoSensitiveLogKeys({ apiKey: 'x' })).toBe(false);
    expect(assertNoSensitiveLogKeys({ event: 'admin_write', path: '/x' })).toBe(true);
  });
});

describe('adminWriteAuditMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function miniApp() {
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', adminWriteAuditMiddleware);
    app.post('/api/v1/documents/:docId/approve', (c) => {
      c.set('auth', {
        userId: 'u-admin',
        sessionId: 's1',
        app: 'admin',
        roles: ['super_admin'],
        tenantId: 't1',
      });
      return c.json({ ok: true }, 200);
    });
    app.post('/api/v1/documents/:docId/reject', () => {
      throw new Error('simulated approve failure');
    });
    app.get('/api/v1/documents/:docId', (c) => c.json({ ok: true }, 200));
    app.post('/api/v1/knowledge-bases/:kbId/ask', (c) => c.json({ ok: true }, 200));
    return app;
  }

  it('写路径完成后 info 打出 event=admin_write', async () => {
    const info = vi.fn();
    vi.spyOn(loggerMod, 'childLogger').mockReturnValue({
      info,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as ReturnType<typeof loggerMod.childLogger>);

    const app = miniApp();
    const res = await app.request('/api/v1/documents/doc-1/approve', {
      method: 'POST',
      headers: { 'x-request-id': 'req-audit-1' },
    });
    expect(res.status).toBe(200);
    expect(info).toHaveBeenCalledTimes(1);
    const [payload, msg] = info.mock.calls[0] as [Record<string, unknown>, string];
    expect(msg).toBe('admin write');
    expect(payload.event).toBe('admin_write');
    expect(payload.method).toBe('POST');
    expect(payload.path).toBe('/api/v1/documents/doc-1/approve');
    expect(payload.status).toBe(200);
    expect(typeof payload.durationMs).toBe('number');
    expect(assertNoSensitiveLogKeys(payload)).toBe(true);
    expect(JSON.stringify(payload).toLowerCase()).not.toMatch(
      /authorization|password|apikey|api_key|secret/,
    );

    expect(loggerMod.childLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-audit-1',
        userId: 'u-admin',
        tenantId: 't1',
      }),
    );
  });

  it('handler throw 仍打 admin_write（status=500）', async () => {
    const info = vi.fn();
    vi.spyOn(loggerMod, 'childLogger').mockReturnValue({
      info,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as ReturnType<typeof loggerMod.childLogger>);

    const app = miniApp();
    // Hono 默认把未处理 throw 收成 500 Response；中间件 finally 仍应打点
    const res = await app.request('/api/v1/documents/doc-1/reject', { method: 'POST' });
    expect(res.status).toBe(500);
    expect(info).toHaveBeenCalledTimes(1);
    const [payload] = info.mock.calls[0] as [Record<string, unknown>];
    expect(payload.event).toBe('admin_write');
    expect(payload.status).toBe(500);
    expect(payload.path).toBe('/api/v1/documents/doc-1/reject');
  });

  it('GET 与 ask 不打操作日志', async () => {
    const info = vi.fn();
    vi.spyOn(loggerMod, 'childLogger').mockReturnValue({
      info,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as ReturnType<typeof loggerMod.childLogger>);

    const app = miniApp();
    await app.request('/api/v1/documents/doc-1', { method: 'GET' });
    await app.request('/api/v1/knowledge-bases/kb1/ask', { method: 'POST' });
    expect(info).not.toHaveBeenCalled();
  });
});
