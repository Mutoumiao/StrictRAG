#!/usr/bin/env node
/**
 * HALF-SEED：1 KB + 把当前用户加成成员 + 1 篇可问文档（ready∧active）。
 * 可重复跑（每次新建一套并打印 uuid）。不改 AUTH 默认。
 *
 *   pnpm seed:demo
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const TENANT = process.env.DEMO_TENANT_ID ?? '01900000-0000-7000-8000-000000000001';
const TIMEOUT_MS = Number(process.env.DEMO_TIMEOUT_MS ?? 120_000);
const POLL_MS = Number(process.env.DEMO_POLL_MS ?? 1_000);
const FIXTURE = path.join(repoRoot, 'fixtures', 'ingest-samples', '01-doc.txt');

async function api(method, urlPath, { body, headers, rawBody } = {}) {
  const url = urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`;
  const init = { method, headers: { ...(headers ?? {}) } };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) {
    init.headers['content-type'] = init.headers['content-type'] ?? 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

/** 与 apps/api/src/routes/auth.ts admin/dev-login 成功码对齐（ok(..., 201)） */
export const ADMIN_DEV_LOGIN_OK_STATUS = 201;

export function inviteOk(status, json) {
  return status === 200 || status === 201 || json?.error?.code === 'CONFLICT';
}

export function assertOk(step, res, expectStatus) {
  if (res.status !== expectStatus) {
    throw new Error(`${step}: HTTP ${res.status} ${JSON.stringify(res.json)}`);
  }
  if (res.json && res.json.ok === false) {
    throw new Error(`${step}: ${JSON.stringify(res.json.error)}`);
  }
}

async function main() {
  const login = await api('POST', '/api/v1/auth/admin/dev-login', {
    body: { email: 'half-seed@local.dev', roleTemplate: 'super_admin', tenantId: TENANT },
  });
  assertOk('dev-login', login, ADMIN_DEV_LOGIN_OK_STATUS);
  const token = login.json.data.accessToken;
  const userId = login.json.data.session.userId;
  const auth = { authorization: `Bearer ${token}` };

  const kbRes = await api('POST', '/api/v1/knowledge-bases', {
    body: { tenantId: TENANT, name: `demo-seed-${Date.now()}` },
    headers: auth,
  });
  assertOk('create-kb', kbRes, 201);
  const kbId = kbRes.json.data.id;

  const inv = await api('POST', `/api/v1/knowledge-bases/${kbId}/members`, {
    body: { userId, role: 'admin' },
    headers: auth,
  });
  if (!inviteOk(inv.status, inv.json)) {
    assertOk('invite', inv, 200);
  }

  const content = await readFile(FIXTURE);
  const up = await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
    body: { title: 'demo-seed-doc', contentType: 'text/plain' },
    headers: auth,
  });
  assertOk('upload-url', up, 201);
  const { docId, uploadUrl } = up.json.data;
  assertOk(
    'put',
    await api('PUT', uploadUrl, { rawBody: content, headers: { ...auth, 'content-type': 'text/plain' } }),
    200,
  );
  assertOk(
    'complete',
    await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`, {
      body: {},
      headers: auth,
    }),
    200,
  );
  assertOk('approve', await api('POST', `/api/v1/documents/${docId}/approve`, { headers: auth }), 200);
  assertOk('scan', await api('POST', `/api/v1/documents/${docId}/scan`, { headers: auth }), 200);

  const deadline = Date.now() + TIMEOUT_MS;
  let status = '';
  while (Date.now() < deadline) {
    const d = await api('GET', `/api/v1/documents/${docId}`, { headers: auth });
    assertOk('get', d, 200);
    status = d.json.data.status;
    const embed = d.json.data.embedReady === true || d.json.data.embedReady === 1;
    const es = d.json.data.esReady === true || d.json.data.esReady === 1;
    if (status === 'ready' && embed && es) break;
    if (status === 'failed' || status === 'needs_ocr') {
      throw new Error(`seed doc ${status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (status !== 'ready') throw new Error(`timeout status=${status}`);
  const patch = await api('PATCH', `/api/v1/documents/${docId}/lifecycle`, {
    body: { lifecycle: 'active' },
    headers: auth,
  });
  assertOk('active', patch, 200);
  console.log(`SEED_KB_ID=${kbId}`);
  console.log(`SEED_DOC_ID=${docId}`);
  console.log('Paste kb uuid into admin/web last-kb-id. Retrieval gate is still ready∧active.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('FAIL:', err.message ?? err);
    process.exit(1);
  });
}

export { main };
