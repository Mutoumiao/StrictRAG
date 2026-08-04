#!/usr/bin/env node
/**
 * Phase 1 演示 / 回归：同 KB 上传 fixtures/ingest-samples（≥10）→ 审批 → scan → ready → active。
 *
 * 前置：
 *   docker compose up (PG+Redis) · pnpm db:migrate · pnpm dev:api · pnpm dev:worker
 *
 * 用法（仓库根）：
 *   node scripts/demo-ingest.mjs
 *   pnpm demo:ingest
 *
 * 环境变量：
 *   API_BASE          默认 http://127.0.0.1:4000
 *   DEMO_TENANT_ID    默认 01900000-0000-7000-8000-000000000001
 *   DEMO_TIMEOUT_MS   轮询总超时，默认 120000
 *   DEMO_POLL_MS      轮询间隔，默认 1000
 *
 * 退出码：0 全绿；1 失败。
 *
 * 说明：ES 为 worker 进程内 mock（非生产 ES+IK）；勿据此宣称检索集群已就绪。
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const TENANT = process.env.DEMO_TENANT_ID ?? '01900000-0000-7000-8000-000000000001';
const TIMEOUT_MS = Number(process.env.DEMO_TIMEOUT_MS ?? 120_000);
const POLL_MS = Number(process.env.DEMO_POLL_MS ?? 1_000);
const FIXTURES_DIR = path.join(repoRoot, 'fixtures', 'ingest-samples');

function log(msg, extra) {
  if (extra !== undefined) {
    console.log(msg, typeof extra === 'string' ? extra : JSON.stringify(extra));
  } else {
    console.log(msg);
  }
}

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
  log(`demo-ingest → ${API_BASE}`);

  const health = await api('GET', '/health');
  if (health.status !== 200) {
    throw new Error(`health failed HTTP ${health.status}. Is api running?`);
  }
  log('health', health.json);

  const ready = await api('GET', '/ready');
  if (ready.status !== 200 || ready.json?.ready !== true) {
    throw new Error(
      `ready not green HTTP ${ready.status} body=${JSON.stringify(ready.json)}. Need PG+Redis.`,
    );
  }
  log('ready', ready.json.checks);

  const files = (await readdir(FIXTURES_DIR))
    .filter((f) => f.endsWith('.txt'))
    .sort();
  if (files.length < 10) {
    throw new Error(`need ≥10 fixtures under ${FIXTURES_DIR}, got ${files.length}`);
  }
  log(`fixtures: ${files.length} files`);

  const kbRes = await api('POST', '/api/v1/knowledge-bases', {
    body: { tenantId: TENANT, name: `demo-kb-${Date.now()}` },
  });
  assertOk('create-kb', kbRes, { expectStatus: 201 });
  const kbId = kbRes.json.data.id;
  log(`kbId=${kbId}`);

  const docIds = [];
  for (const file of files) {
    const title = path.basename(file, '.txt');
    const content = await readFile(path.join(FIXTURES_DIR, file));

    const up = await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
      body: { title, contentType: 'text/plain' },
    });
    assertOk(`upload-url ${title}`, up, { expectStatus: 201 });
    const { docId, uploadUrl } = up.json.data;

    const put = await api('PUT', uploadUrl, {
      rawBody: content,
      headers: { 'content-type': 'text/plain' },
    });
    assertOk(`put ${title}`, put, { expectStatus: 200 });

    const complete = await api(
      'POST',
      `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`,
      { body: {} },
    );
    assertOk(`complete ${title}`, complete, { expectStatus: 200 });

    const approve = await api('POST', `/api/v1/documents/${docId}/approve`);
    assertOk(`approve ${title}`, approve, { expectStatus: 200 });

    const scan = await api('POST', `/api/v1/documents/${docId}/scan`);
    assertOk(`scan ${title}`, scan, { expectStatus: 200 });

    docIds.push(docId);
    log(`enqueued ${title} → ${docId}`);
  }

  // 未批 scan 负例（同 KB 另建一篇）
  {
    const up = await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/upload-url`, {
      body: { title: 'unapproved-gate', contentType: 'text/plain' },
    });
    assertOk('gate upload-url', up, { expectStatus: 201 });
    const { docId, uploadUrl } = up.json.data;
    await api('PUT', uploadUrl, {
      rawBody: Buffer.from('gate body for unapproved scan negative test path.'),
      headers: { 'content-type': 'text/plain' },
    });
    await api('POST', `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`, {
      body: {},
    });
    const scan = await api('POST', `/api/v1/documents/${docId}/scan`);
    if (scan.status !== 403 || scan.json?.error?.code !== 'FORBIDDEN') {
      throw new Error(`unapproved scan expected 403 FORBIDDEN, got ${scan.status} ${JSON.stringify(scan.json)}`);
    }
    log('negative: unapproved scan → FORBIDDEN ok');
  }

  const deadline = Date.now() + TIMEOUT_MS;
  let readyCount = 0;
  /** @type {Record<string, string>} */
  const states = {};

  while (Date.now() < deadline) {
    readyCount = 0;
    let terminalFail = 0;
    for (const id of docIds) {
      const d = await api('GET', `/api/v1/documents/${id}`);
      assertOk(`get ${id}`, d, { expectStatus: 200 });
      const { status, lifecycle, errorCode, embedReady, esReady } = d.json.data;
      states[id] = `${status}/${lifecycle} embed=${embedReady} es=${esReady} err=${errorCode ?? ''}`;
      if (status === 'ready') readyCount += 1;
      if (status === 'failed' || status === 'needs_ocr') terminalFail += 1;
    }
    log(`progress ready=${readyCount}/${docIds.length} failedish=${terminalFail}`);
    if (readyCount === docIds.length) break;
    if (readyCount + terminalFail === docIds.length && terminalFail > 0) {
      throw new Error(`terminal non-ready states:\n${Object.entries(states).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  if (readyCount !== docIds.length) {
    throw new Error(
      `timeout: ready=${readyCount}/${docIds.length}\n${Object.entries(states)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')}`,
    );
  }

  let activeCount = 0;
  for (const id of docIds) {
    const patch = await api('PATCH', `/api/v1/documents/${id}/lifecycle`, {
      body: { lifecycle: 'active' },
    });
    assertOk(`active ${id}`, patch, { expectStatus: 200 });
    if (patch.json.data.lifecycle === 'active') activeCount += 1;
  }

  const list = await api('GET', `/api/v1/knowledge-bases/${kbId}/documents`);
  assertOk('list', list, { expectStatus: 200 });
  const rows = list.json.data ?? [];
  const listReady = rows.filter((r) => r.status === 'ready').length;
  const listActive = rows.filter((r) => r.lifecycle === 'active').length;

  log('=== RESULT ===');
  log(`kbId=${kbId}`);
  log(`docs=${docIds.length} ready=${readyCount} active=${activeCount}`);
  log(`list ready=${listReady} active=${listActive}`);
  log('NOTE: ES is in-process mock — not production Elasticsearch+IK.');

  if (readyCount < 10 || activeCount < 10 || listReady < 10 || listActive < 10) {
    throw new Error('AC failed: need ≥10 ready and ≥10 active');
  }

  log('PASS: ≥10 ready + active (S1 demo closed loop)');
}

main().catch((err) => {
  console.error('FAIL:', err.message ?? err);
  process.exit(1);
});
