/**
 * 目标：live 闸组合在真实 handler 下拒绝未审批 complete。
 * 需求：complete 闸
 * 被测：createApp document gates
 * 简介：无 Docker / not ready 时 skip。
 */

import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { createApp } from '../../src/app.js';
import { ensureUserByEmail } from '../../src/services/members.js';
import { effectiveMaxUploadBytes, getStorage } from '../../src/services/storage.js';

type ApiJson<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message?: string };
};

const TENANT = '01900000-0000-7000-8000-000000000001';

async function probeReady(): Promise<boolean> {
  try {
    const app = createApp();
    const res = await app.request('/ready');
    const body = (await res.json()) as { ready?: boolean };
    return body.ready === true;
  } catch {
    return false;
  }
}

async function createKb(app: ReturnType<typeof createApp>, name: string): Promise<string> {
  const admin = await ensureUserByEmail({
    email: `live-gate-${name}@local.dev`,
    tenantId: TENANT,
  });
  const res = await app.request('/api/v1/knowledge-bases', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, initialAdminUserId: admin.id }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as ApiJson<{ id: string }>;
  expect(body.ok).toBe(true);
  return body.data!.id;
}

/**
 * Live 门禁：走 createApp().request 真 handler + 真实 PG/storage。
 * 无 Docker / not ready 时 skip（不让默认 unit 挂掉）。
 * 全链路 ≥10 ready 用 `pnpm demo:ingest`（需 api+worker 进程）。
 */
describe('document gates live (app.request)', () => {
  it('unapproved complete→scan returns FORBIDDEN', async (ctx) => {
    if (!(await probeReady())) {
      ctx.skip();
      return;
    }

    const app = createApp();
    const kbId = await createKb(app, `live-gate-scan-${uuidv7().slice(0, 8)}`);

    const up = await app.request(`/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'pending-scan', contentType: 'text/plain' }),
    });
    expect(up.status).toBe(201);
    const upBody = (await up.json()) as ApiJson<{ docId: string; uploadUrl: string }>;
    const docId = upBody.data!.docId;
    const putPath = upBody.data!.uploadUrl;

    const put = await app.request(putPath, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'live gate body for unapproved scan path — enough chars.',
    });
    expect(put.status).toBe(200);

    const complete = await app.request(
      `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    expect(complete.status).toBe(200);

    const scan = await app.request(`/api/v1/documents/${docId}/scan`, { method: 'POST' });
    expect(scan.status).toBe(403);
    const scanBody = (await scan.json()) as ApiJson;
    expect(scanBody.ok).toBe(false);
    expect(scanBody.error?.code).toBe('FORBIDDEN');
  });

  it('complete rejects object over upload limit (PAYLOAD_TOO_LARGE)', async (ctx) => {
    if (!(await probeReady())) {
      ctx.skip();
      return;
    }

    const app = createApp();
    const kbId = await createKb(app, `live-gate-size-${uuidv7().slice(0, 8)}`);

    const up = await app.request(`/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'oversize', contentType: 'application/octet-stream' }),
    });
    const upBody = (await up.json()) as ApiJson<{ docId: string; objectKey: string }>;
    const docId = upBody.data!.docId;
    const objectKey = upBody.data!.objectKey;

    // 绕过 HTTP PUT 上限，直接写对象，验证 complete 权威闸
    const max = effectiveMaxUploadBytes();
    const huge = Buffer.alloc(max + 1, 0x61);
    await getStorage().putObject(objectKey, huge, 'application/octet-stream');

    const complete = await app.request(
      `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    expect(complete.status).toBe(413);
    const body = (await complete.json()) as ApiJson;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('PATCH active on non-ready returns CONFLICT', async (ctx) => {
    if (!(await probeReady())) {
      ctx.skip();
      return;
    }

    const app = createApp();
    const kbId = await createKb(app, `live-gate-lc-${uuidv7().slice(0, 8)}`);
    const up = await app.request(`/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'not-ready', contentType: 'text/plain' }),
    });
    const upBody = (await up.json()) as ApiJson<{ docId: string; uploadUrl: string }>;
    const docId = upBody.data!.docId;
    await app.request(upBody.data!.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'not ready yet body content for lifecycle conflict test.',
    });
    await app.request(`/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    const patch = await app.request(`/api/v1/documents/${docId}/lifecycle`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycle: 'active' }),
    });
    expect(patch.status).toBe(409);
    const body = (await patch.json()) as ApiJson;
    expect(body.error?.code).toBe('CONFLICT');
  });
});
