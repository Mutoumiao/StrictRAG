#!/usr/bin/env node
/**
 * HALF-SMOKE：单篇 txt 上传→complete→审批→scan→双就绪→active→ask 有引用。
 * 检索闸仍 ready∧active。ES/扫描/向量可为 mock。≠ 生产 ES / ≠ 真杀毒。
 * live ask 须 Gateway 产出合法 JSON；默认 mock chat 不是 JSON → 空引用失败。
 *
 * 前置：PG+Redis · migrate · api+worker（pnpm up:apps）
 *   pnpm smoke:half
 *
 * 退出：0 全绿；1 失败。无 api / 空引用时失败，不伪造绿。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { askHasCitations } from './smoke-ask.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const TENANT = process.env.DEMO_TENANT_ID ?? '01900000-0000-7000-8000-000000000001';
const TIMEOUT_MS = Number(process.env.DEMO_TIMEOUT_MS ?? 120_000);
const POLL_MS = Number(process.env.DEMO_POLL_MS ?? 1_000);
const FIXTURE = path.join(repoRoot, 'fixtures', 'ingest-samples', '01-doc.txt');

async function api(method, urlPath, { body, headers, rawBody } = {}) {
  const url = urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`;
  const init = { method, headers: { ...(headers ?? {}) } };
  if (rawBody !== undefined) {
    init.body = rawBody;
  } else if (body !== undefined) {
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
  return { status: res.status, json, okHttp: res.ok };
}

function assertOk(step, res, { expectStatus } = {}) {
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(
      `${step}: expected HTTP ${expectStatus}, got ${res.status}: ${JSON.stringify(res.json)}`,
    );
  }
  if (res.json && res.json.ok === false) {
    throw new Error(`${step}: api ok=false: ${JSON.stringify(res.json.error ?? res.json)}`);
  }
}

async function main() {
  console.log(`HALF-SMOKE → ${API_BASE}`);
  const health = await api('GET', '/health');
  if (health.status !== 200) {
    throw new Error(`health failed HTTP ${health.status}. Is api running?`);
  }
  const ready = await api('GET', '/ready');
  if (ready.status !== 200 || ready.json?.ready !== true) {
    throw new Error(`ready not green HTTP ${ready.status} body=${JSON.stringify(ready.json)}`);
  }

  const login = await api('POST', '/api/v1/auth/admin/dev-login', {
    body: { email: 'half-smoke@local.dev', roleTemplate: 'super_admin', tenantId: TENANT },
  });
  // auth.ts admin/dev-login 成功信封是 201 + data.accessToken
  assertOk('dev-login', login, { expectStatus: 201 });
  const token = login.json?.data?.accessToken;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`dev-login missing accessToken: ${JSON.stringify(login.json)}`);
  }
  const auth = { authorization: `Bearer ${token}` };

  const kbRes = await api('POST', '/api/v1/knowledge-bases', {
    body: { tenantId: TENANT, name: `half-smoke-${Date.now()}` },
    headers: auth,
  });
  assertOk('create-kb', kbRes, { expectStatus: 201 });
  const kbId = kbRes.json.data.id;

  const content = await readFile(FIXTURE);
  const up = await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
    body: { title: '01-doc', contentType: 'text/plain' },
    headers: auth,
  });
  assertOk('upload-url', up, { expectStatus: 201 });
  const { docId, uploadUrl } = up.json.data;
  const put = await api('PUT', uploadUrl, {
    rawBody: content,
    headers: { ...auth, 'content-type': 'text/plain' },
  });
  assertOk('put', put, { expectStatus: 200 });
  const complete = await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`, {
    body: {},
    headers: auth,
  });
  assertOk('complete', complete, { expectStatus: 200 });
  const approve = await api('POST', `/api/v1/documents/${docId}/approve`, { headers: auth });
  assertOk('approve', approve, { expectStatus: 200 });
  const scan = await api('POST', `/api/v1/documents/${docId}/scan`, { headers: auth });
  assertOk('scan', scan, { expectStatus: 200 });

  const deadline = Date.now() + TIMEOUT_MS;
  let status = '';
  let embedReady = false;
  let esReady = false;
  while (Date.now() < deadline) {
    const d = await api('GET', `/api/v1/documents/${docId}`, { headers: auth });
    assertOk('get-doc', d, { expectStatus: 200 });
    status = d.json.data.status;
    embedReady = d.json.data.embedReady === true || d.json.data.embedReady === 1;
    esReady = d.json.data.esReady === true || d.json.data.esReady === 1;
    console.log(`progress status=${status} embed=${embedReady} es=${esReady}`);
    if (status === 'ready' && embedReady && esReady) break;
    if (status === 'failed' || status === 'needs_ocr') {
      throw new Error(`terminal ${status} ${d.json.data.errorCode ?? ''}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (status !== 'ready' || !embedReady || !esReady) {
    throw new Error(`timeout: status=${status} embed=${embedReady} es=${esReady}`);
  }

  const patch = await api('PATCH', `/api/v1/documents/${docId}/lifecycle`, {
    body: { lifecycle: 'active' },
    headers: auth,
  });
  assertOk('active', patch, { expectStatus: 200 });
  if (patch.json.data.lifecycle !== 'active') {
    throw new Error(`lifecycle not active: ${JSON.stringify(patch.json.data)}`);
  }

  const ask = await api('POST', `/api/v1/knowledge-bases/${kbId}/ask`, {
    body: { question: '检索闸对哪些文档生效？', options: { stream: false } },
    headers: auth,
  });
  assertOk('ask', ask, { expectStatus: 200 });
  if (!askHasCitations(ask.json)) {
    throw new Error(`ask has no citations: ${JSON.stringify(ask.json)}`);
  }
  const cites = ask.json.data.citations;
  if (!cites.some((c) => c && c.docId === docId)) {
    throw new Error(`ask citations miss ingested docId=${docId}: ${JSON.stringify(cites)}`);
  }
  console.log(`PASS kbId=${kbId} docId=${docId} citations=${cites.length}`);
  console.log('NOTE: mock retrieve/scan allowed; not production ES; not QUAL-2.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('FAIL:', err.message ?? err);
    process.exit(1);
  });
}

export { main };
