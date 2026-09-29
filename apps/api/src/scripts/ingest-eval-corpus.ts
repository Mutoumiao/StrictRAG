/**
 * 评测语料入库 CLI：把 `fixtures/ingest-samples/*.txt` 与 `fixtures/l2/corpus/*.txt` 逐篇经既有 HTTP 面
 * 送入某个 KB，并写出「逻辑 id → documents.id」映射账本（工单 02 裁定 1 / 2）。
 *
 * 走既有 HTTP 面（upload-url → PUT → complete → approve → scan → 轮询 ready → lifecycle=active），
 * **不新增端点 / 表 / 迁移**；逻辑 id 由目录结构派生（`ingest-samples/<name>` / `l2-corpus/<name>`）。
 * 账本落 `artifacts/eval-corpus-ledger-<kbId>.json`（`artifacts/` 已 gitignore，属运行产物不入库）。
 *
 * **ADR-048 #4 四眼**：审批必须换第二个身份（`ingest-eval-reviewer@local.dev` / `kb_admin`）。本 CLI 全步带
 * token，故 `approve` 会 hydration 出 actor；同一身份自审会被四眼闸 403。流程对首篇发一次自审探针，断言其
 * 必为 403（带 token 时 actor 已知，与 `AUTH_ENFORCE` 无关），再换审批人 token 正式 approved。
 *
 * **审批人成员边界（显式，不静默）**：`AUTH_ENFORCE=false`（默认）时审批人无需是该 KB 成员即可通过
 * （成员闸为 `whenEnforced`）；`AUTH_ENFORCE=true` 时审批人**必须是该 KB 成员**，本 CLI **不做**自动加成员
 * —— 该模式下需先人工把审批人加为该 KB 成员，否则 `approve` 被拒、CLI 如实失败并点名逻辑 id。
 *
 * 用法（仓库根；api + worker 已在跑）：
 *   INGEST_KB_NAME=eval-corpus-kb pnpm --filter @strict-rag/api exec tsx src/scripts/ingest-eval-corpus.ts
 *   INGEST_KB_ID=<kb-uuid>      pnpm --filter @strict-rag/api exec tsx src/scripts/ingest-eval-corpus.ts
 *
 * 环境变量：
 *   INGEST_KB_NAME    新建 KB 名（与 INGEST_KB_ID 二选一；两者都不设 → exit 2）
 *   INGEST_KB_ID      复用既有 KB（优先于 INGEST_KB_NAME）
 *   API_BASE          默认 http://127.0.0.1:4000
 *   INGEST_TENANT_ID  默认 01900000-0000-7000-8000-000000000001
 *   INGEST_OUT_DIR    默认 <repo>/artifacts
 *   INGEST_TIMEOUT_MS 轮询总超时，默认 120000
 *   INGEST_POLL_MS    轮询间隔，默认 1000
 *
 * 退出码：0 全入库并写出账本；2 缺配置 / 非法数值；1 入库或轮询失败（失败点名到逻辑 id）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCorpusLedger,
  type CorpusLedger,
  type CorpusLedgerEntry,
} from '@strict-rag/contracts/eval-corpus-ledger';
import { formatLocalDateTime } from '@strict-rag/db';

import {
  defaultRepoRoot,
  readFixtureCorpus,
  type FixtureCorpusFile,
} from '../eval/corpus-fixtures.js';

const DEFAULT_API_BASE = 'http://127.0.0.1:4000';
const DEFAULT_TENANT_ID = '01900000-0000-7000-8000-000000000001';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 1_000;

/**
 * 两个 dev-login 身份：uploader 走上传/complete/scan/读取；reviewer **只**用于 approve（ADR-048 #4 四眼：
 * 提交人不得批自己的单）。两者 tenant 同 `INGEST_TENANT_ID`。
 */
export const INGEST_IDENTITIES = {
  uploader: { email: 'ingest-eval-corpus@local.dev', roleTemplate: 'super_admin' },
  reviewer: { email: 'ingest-eval-reviewer@local.dev', roleTemplate: 'kb_admin' },
} as const;
export type IngestIdentity = keyof typeof INGEST_IDENTITIES;

export type IngestCliEnv = {
  baseUrl: string;
  tenantId: string;
  /** 复用既有 KB（优先） */
  kbId?: string;
  /** 新建 KB 名 */
  kbName?: string;
  outDir: string;
  timeoutMs: number;
  pollMs: number;
};

export type IngestCliParse =
  | { ok: true; env: IngestCliEnv }
  | { ok: false; exitCode: 2; message: string };

function positiveInt(source: NodeJS.ProcessEnv, key: string, fallback: number): number | string {
  const raw = source[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return `${key} must be a positive number`;
  return n;
}

/** 解析 env：`INGEST_KB_ID` / `INGEST_KB_NAME` 至少一个；非法数值 → exit 2。 */
export function parseIngestCliEnv(
  source: NodeJS.ProcessEnv = process.env,
  repoRoot = defaultRepoRoot(import.meta.url),
): IngestCliParse {
  const kbId = source.INGEST_KB_ID?.trim() || undefined;
  const kbName = source.INGEST_KB_NAME?.trim() || undefined;
  if (!kbId && !kbName) {
    return {
      ok: false,
      exitCode: 2,
      message: 'INGEST_KB_ID（复用既有 KB）或 INGEST_KB_NAME（新建 KB）至少设一个',
    };
  }
  const timeout = positiveInt(source, 'INGEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  if (typeof timeout === 'string') return { ok: false, exitCode: 2, message: timeout };
  const poll = positiveInt(source, 'INGEST_POLL_MS', DEFAULT_POLL_MS);
  if (typeof poll === 'string') return { ok: false, exitCode: 2, message: poll };
  return {
    ok: true,
    env: {
      baseUrl: (source.API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/$/, ''),
      tenantId: source.INGEST_TENANT_ID?.trim() || DEFAULT_TENANT_ID,
      kbId,
      kbName,
      outDir: source.INGEST_OUT_DIR?.trim() || path.join(repoRoot, 'artifacts'),
      timeoutMs: timeout,
      pollMs: poll,
    },
  };
}

/** 账本文件名（含 kbId，避免 L1 / L2 两份互相覆盖）。 */
export function ledgerFileName(kbId: string): string {
  return `eval-corpus-ledger-${kbId}.json`;
}

/**
 * 组装账本：每个夹具文件都必须已拿到 docId；缺一个即抛错点名（**不得静默跳过**）。
 */
export function buildLedgerFromIngest(input: {
  kbId: string;
  tenantId: string;
  generatedAt: string;
  files: ReadonlyArray<FixtureCorpusFile>;
  docIdByLogicalId: ReadonlyMap<string, string>;
}): CorpusLedger {
  const entries: CorpusLedgerEntry[] = [];
  const missing: string[] = [];
  for (const file of input.files) {
    const docId = input.docIdByLogicalId.get(file.logicalId);
    if (!docId) {
      missing.push(file.logicalId);
      continue;
    }
    entries.push({
      logicalId: file.logicalId,
      docId,
      title: file.title,
      sourceFile: file.sourceFile,
      sourceSha256: file.sourceSha256,
    });
  }
  if (missing.length > 0) {
    throw new Error(`语料未入库（缺 docId）：${missing.join(', ')}`);
  }
  return buildCorpusLedger({
    kbId: input.kbId,
    tenantId: input.tenantId,
    generatedAt: input.generatedAt,
    entries,
  });
}

export type CorpusIngestClient = {
  health(): Promise<void>;
  ready(): Promise<void>;
  devLogin(identity: IngestIdentity): Promise<{ token: string; userId: string }>;
  /** 自审探针：发一次上传者身份的 approve，回**原始** HTTP 状态（403 = 四眼闸生效；非 403 = 闸缺失）。 */
  probeSelfApproval(input: { docId: string; token: string }): Promise<{ status: number }>;
  createKb(input: { name: string; userId: string; token: string }): Promise<string>;
  uploadUrl(input: { kbId: string; title: string; token: string }): Promise<{
    docId: string;
    uploadUrl: string;
  }>;
  putObject(uploadUrl: string, bytes: Uint8Array): Promise<void>;
  complete(input: { kbId: string; docId: string; token: string }): Promise<void>;
  approve(input: { docId: string; token: string }): Promise<void>;
  scan(input: { docId: string; token: string }): Promise<void>;
  getDocument(input: { docId: string; token: string }): Promise<{
    status: string;
    lifecycle: string;
  }>;
  setActive(input: { docId: string; token: string }): Promise<void>;
};

/** HTTP 实现：语义照 `scripts/demo-ingest.mjs`，但全步带 token（`AUTH_ENFORCE` 开时也成立）；
 * 审批换第二身份 token（ADR-048 #4 四眼）。 */
export function createHttpCorpusIngestClient(input: {
  baseUrl: string;
  tenantId: string;
  fetchImpl?: typeof fetch;
}): CorpusIngestClient {
  const fetchImpl = input.fetchImpl ?? fetch;

  async function call(
    method: string,
    urlPath: string,
    opts: { token?: string; body?: unknown; rawBody?: Uint8Array; contentType?: string } = {},
  ): Promise<{ status: number; json: { ok?: boolean; data?: unknown; error?: unknown } | null }> {
    const url = urlPath.startsWith('http') ? urlPath : `${input.baseUrl}${urlPath}`;
    const headers: Record<string, string> = {};
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    let payload: Uint8Array | string | undefined;
    if (opts.rawBody !== undefined) {
      headers['content-type'] = opts.contentType ?? 'text/plain';
      payload = opts.rawBody;
    } else if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }
    const res = await fetchImpl(url, { method, headers, body: payload });
    const text = await res.text();
    let json: { ok?: boolean; data?: unknown; error?: unknown } | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }

  async function expect(
    method: string,
    urlPath: string,
    opts: { token?: string; body?: unknown; rawBody?: Uint8Array; contentType?: string },
    expectStatus: number,
  ): Promise<{ ok?: boolean; data?: unknown; error?: unknown } | null> {
    const res = await call(method, urlPath, opts);
    if (res.status !== expectStatus) {
      throw new Error(`${method} ${urlPath} expected HTTP ${expectStatus}, got ${res.status}`);
    }
    if (res.json && res.json.ok === false) {
      throw new Error(`${method} ${urlPath} api ok=false: ${JSON.stringify(res.json.error)}`);
    }
    return res.json;
  }

  return {
    async health() {
      await expect('GET', '/health', {}, 200);
    },
    async ready() {
      const json = await expect('GET', '/ready', {}, 200);
      if ((json as { ready?: unknown } | null)?.ready !== true) {
        throw new Error(`ready not green: ${JSON.stringify(json)}`);
      }
    },
    async devLogin(identity) {
      const who = INGEST_IDENTITIES[identity];
      const json = await expect(
        'POST',
        '/api/v1/auth/admin/dev-login',
        {
          body: {
            email: who.email,
            roleTemplate: who.roleTemplate,
            tenantId: input.tenantId,
          },
        },
        201,
      );
      const data = (json?.data ?? {}) as { accessToken?: unknown; session?: { userId?: unknown } };
      const token = data.accessToken;
      const userId = data.session?.userId;
      if (typeof token !== 'string' || !token) throw new Error('dev-login missing accessToken');
      if (typeof userId !== 'string' || !userId) throw new Error('dev-login missing session.userId');
      return { token, userId };
    },
    async createKb({ name, userId, token }) {
      const json = await expect(
        'POST',
        '/api/v1/knowledge-bases',
        { token, body: { name, initialAdminUserId: userId } },
        201,
      );
      const id = (json?.data as { id?: unknown } | undefined)?.id;
      if (typeof id !== 'string' || !id) throw new Error('create-kb missing data.id');
      return id;
    },
    async uploadUrl({ kbId, title, token }) {
      const json = await expect(
        'POST',
        `/api/v1/knowledge-bases/${kbId}/documents/upload-url`,
        { token, body: { title, contentType: 'text/plain' } },
        201,
      );
      const data = (json?.data ?? {}) as { docId?: unknown; uploadUrl?: unknown };
      if (typeof data.docId !== 'string' || !data.docId) throw new Error('upload-url missing docId');
      if (typeof data.uploadUrl !== 'string' || !data.uploadUrl) {
        throw new Error('upload-url missing uploadUrl');
      }
      return { docId: data.docId, uploadUrl: data.uploadUrl };
    },
    async putObject(uploadUrl, bytes) {
      await expect('PUT', uploadUrl, { rawBody: bytes }, 200);
    },
    async complete({ kbId, docId, token }) {
      await expect(
        'POST',
        `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`,
        { token, body: {} },
        200,
      );
    },
    async probeSelfApproval({ docId, token }) {
      // 不走 expect（403 是期望值，不是异常）：回原始状态，交由编排层判定闸是否生效
      const res = await call('POST', `/api/v1/documents/${docId}/approve`, { token });
      return { status: res.status };
    },
    async approve({ docId, token }) {
      await expect('POST', `/api/v1/documents/${docId}/approve`, { token }, 200);
    },
    async scan({ docId, token }) {
      await expect('POST', `/api/v1/documents/${docId}/scan`, { token }, 200);
    },
    async getDocument({ docId, token }) {
      const json = await expect('GET', `/api/v1/documents/${docId}`, { token }, 200);
      const data = (json?.data ?? {}) as { status?: unknown; lifecycle?: unknown };
      return {
        status: typeof data.status === 'string' ? data.status : 'unknown',
        lifecycle: typeof data.lifecycle === 'string' ? data.lifecycle : 'unknown',
      };
    },
    async setActive({ docId, token }) {
      await expect(
        'PATCH',
        `/api/v1/documents/${docId}/lifecycle`,
        { token, body: { lifecycle: 'active' } },
        200,
      );
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type IngestEvalCorpusResult = {
  kbId: string;
  ledgerPath: string;
  ledger: CorpusLedger;
};

/**
 * 入库编排：health→ready→双 dev-login（uploader / reviewer）→建/复用 KB→逐篇
 * upload/put/complete（上传者）→自审探针（首篇，须 403）→approve（审批人）→scan（上传者）→
 * 轮询 ready→lifecycle=active→写账本。失败一律点名到逻辑 id（不静默跳过）。
 */
export async function ingestEvalCorpus(opts: {
  env: IngestCliEnv;
  repoRoot: string;
  client: CorpusIngestClient;
  now?: () => Date;
  log?: (msg: string) => void;
}): Promise<IngestEvalCorpusResult> {
  const log = opts.log ?? (() => {});
  await opts.client.health();
  await opts.client.ready();
  // 两个身份：uploader 走上传 / complete / scan / 读取；reviewer 只用于 approve（ADR-048 #4 四眼）
  const uploader = await opts.client.devLogin('uploader');
  const reviewer = await opts.client.devLogin('reviewer');
  const token = uploader.token;

  const kbId =
    opts.env.kbId ??
    (await opts.client.createKb({ name: opts.env.kbName ?? '', userId: uploader.userId, token }));
  log(`kbId=${kbId}`);

  const files = readFixtureCorpus(opts.repoRoot);
  log(`fixtures: ${files.length} files`);

  const docIdByLogicalId = new Map<string, string>();
  let probedSelfApproval = false;
  for (const file of files) {
    const bytes = readFileSync(path.join(opts.repoRoot, ...file.sourceFile.split('/')));
    try {
      const { docId, uploadUrl } = await opts.client.uploadUrl({
        kbId,
        title: file.title,
        token,
      });
      await opts.client.putObject(uploadUrl, bytes);
      await opts.client.complete({ kbId, docId, token });
      // 首篇：先钉住「上传者自审必 403」（四眼闸生效），确认后再换审批人，避免自审静默通过
      if (!probedSelfApproval) {
        const probe = await opts.client.probeSelfApproval({ docId, token });
        if (probe.status !== 403) {
          throw new Error(`四眼闸缺失：上传者自审 approve 期望 403，实得 ${probe.status}`);
        }
        probedSelfApproval = true;
      }
      await opts.client.approve({ docId, token: reviewer.token });
      await opts.client.scan({ docId, token });
      docIdByLogicalId.set(file.logicalId, docId);
      log(`enqueued ${file.logicalId} → ${docId}`);
    } catch (err) {
      throw new Error(
        `入库失败 logical id=${file.logicalId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const refs = [...docIdByLogicalId.entries()];
  const deadline = Date.now() + opts.env.timeoutMs;
  const ready = new Set<string>();
  for (;;) {
    ready.clear();
    const failedish: string[] = [];
    for (const [logicalId, docId] of refs) {
      const doc = await opts.client.getDocument({ docId, token });
      if (doc.status === 'ready') ready.add(logicalId);
      else if (doc.status === 'failed' || doc.status === 'needs_ocr') {
        failedish.push(`${logicalId}:${doc.status}`);
      }
    }
    if (failedish.length > 0) throw new Error(`终态非 ready：${failedish.join(', ')}`);
    if (ready.size === refs.length) break;
    if (Date.now() >= deadline) {
      const pending = refs.filter(([logicalId]) => !ready.has(logicalId)).map(([id]) => id);
      throw new Error(`轮询超时（未 ready）：${pending.join(', ')}`);
    }
    await sleep(opts.env.pollMs);
  }

  for (const [, docId] of refs) {
    await opts.client.setActive({ docId, token });
  }

  const ledger = buildLedgerFromIngest({
    kbId,
    tenantId: opts.env.tenantId,
    generatedAt: formatLocalDateTime((opts.now ?? (() => new Date()))()),
    files,
    docIdByLogicalId,
  });

  const ledgerPath = path.join(opts.env.outDir, ledgerFileName(kbId));
  mkdirSync(opts.env.outDir, { recursive: true });
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  log(`ledger=${ledgerPath}`);
  log(`entries=${ledger.entries.length} fingerprint=${ledger.corpusFingerprint}`);

  return { kbId, ledgerPath, ledger };
}

async function main(): Promise<void> {
  const repoRoot = defaultRepoRoot(import.meta.url);
  const parsed = parseIngestCliEnv(process.env, repoRoot);
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exit(2);
  }
  const client = createHttpCorpusIngestClient({
    baseUrl: parsed.env.baseUrl,
    tenantId: parsed.env.tenantId,
  });
  try {
    const { kbId, ledgerPath } = await ingestEvalCorpus({
      env: parsed.env,
      repoRoot,
      client,
      log: (msg) => console.log(msg),
    });
    console.log(JSON.stringify({ kbId, ledgerPath }, null, 2));
  } catch (err) {
    console.error('FAIL:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  void main();
}
