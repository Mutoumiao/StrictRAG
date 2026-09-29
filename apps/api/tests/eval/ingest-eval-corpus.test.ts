/**
 * 目标：评测语料入库 CLI 必须按目录结构派生逻辑 id、逐篇入库并写出确定性账本；审批换第二身份；失败点名逻辑 id。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 1 / 2 / 3）· ADR-048 #4
 * 被测：parseIngestCliEnv · buildLedgerFromIngest · ledgerFileName · ingestEvalCorpus
 * 简介：缺配置 exit 2；同输入账本等价；审批只用审批人 token；自审探针钉 403；缺 docId / 入库失败 / 非 ready 点名逻辑 id。
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  INGEST_IDENTITIES,
  buildLedgerFromIngest,
  ingestEvalCorpus,
  ledgerFileName,
  parseIngestCliEnv,
  type CorpusIngestClient,
  type IngestCliEnv,
  type IngestIdentity,
} from '../../src/scripts/ingest-eval-corpus.js';
import {
  defaultRepoRoot,
  readFixtureCorpus,
  type FixtureCorpusFile,
} from '../../src/eval/corpus-fixtures.js';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'ingest-corpus-'));
  tmpDirs.push(d);
  return d;
}

const REPO_ROOT = defaultRepoRoot(import.meta.url);

function baseEnv(over: Partial<IngestCliEnv> = {}): IngestCliEnv {
  return {
    baseUrl: 'http://127.0.0.1:4000',
    tenantId: '01900000-0000-7000-8000-000000000001',
    kbId: 'kb-1',
    outDir: tmp(),
    timeoutMs: 2_000,
    pollMs: 5,
    ...over,
  };
}

/** 记录 dev-login 身份 / token 与 approve / 自审探针实际收到的 token */
type IngestSpy = {
  devLogins: IngestIdentity[];
  devLoginTokens: string[];
  probeTokens: string[];
  approveTokens: string[];
};
function newSpy(): IngestSpy {
  return { devLogins: [], devLoginTokens: [], probeTokens: [], approveTokens: [] };
}

/** 假客户端：可注入「某标题上传失败」「某文档终态失败」「永不就绪」「自审探针状态」四类场景 */
function fakeClient(
  input: {
    failTitle?: string;
    terminalTitle?: string;
    neverReady?: boolean;
    selfApproveStatus?: number;
  } = {},
  spy: IngestSpy = newSpy(),
): CorpusIngestClient {
  let seq = 0;
  const titleByDoc = new Map<string, string>();
  return {
    async health() {},
    async ready() {},
    async devLogin(identity) {
      spy.devLogins.push(identity);
      const token = `tok-${identity}`;
      spy.devLoginTokens.push(token);
      return { token, userId: `uid-${identity}` };
    },
    async probeSelfApproval({ token }) {
      spy.probeTokens.push(token);
      return { status: input.selfApproveStatus ?? 403 };
    },
    async createKb() {
      return 'kb-created';
    },
    async uploadUrl({ title }) {
      if (input.failTitle && title === input.failTitle) throw new Error('upload 500');
      const docId = `doc-${seq++}-${title}`;
      titleByDoc.set(docId, title);
      return { docId, uploadUrl: `https://objects.local/${docId}` };
    },
    async putObject() {},
    async complete() {},
    async approve({ token }) {
      spy.approveTokens.push(token);
    },
    async scan() {},
    async getDocument({ docId }) {
      if (input.terminalTitle && titleByDoc.get(docId) === input.terminalTitle) {
        return { status: 'failed', lifecycle: 'draft' };
      }
      if (input.neverReady) return { status: 'uploaded', lifecycle: 'draft' };
      return { status: 'ready', lifecycle: 'draft' };
    },
    async setActive() {},
  };
}

describe('parseIngestCliEnv', () => {
  it('缺 INGEST_KB_ID 与 INGEST_KB_NAME → exit 2', () => {
    const parsed = parseIngestCliEnv({}, REPO_ROOT);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.exitCode).toBe(2);
      expect(parsed.message).toMatch(/INGEST_KB_ID|INGEST_KB_NAME/);
    }
  });

  it('INGEST_KB_ID 或 INGEST_KB_NAME 任一 → ok；非法数值 → exit 2', () => {
    const byId = parseIngestCliEnv({ INGEST_KB_ID: 'kb-x' }, REPO_ROOT);
    expect(byId).toMatchObject({ ok: true });
    if (byId.ok) expect(byId.env.kbId).toBe('kb-x');

    const byName = parseIngestCliEnv({ INGEST_KB_NAME: 'kb-new' }, REPO_ROOT);
    expect(byName).toMatchObject({ ok: true });
    if (byName.ok) expect(byName.env.kbName).toBe('kb-new');

    const bad = parseIngestCliEnv({ INGEST_KB_ID: 'k', INGEST_TIMEOUT_MS: '0' }, REPO_ROOT);
    expect(bad.ok).toBe(false);

    const reuse = parseIngestCliEnv({ INGEST_KB_ID: 'k', INGEST_KB_NAME: 'n' }, REPO_ROOT);
    if (reuse.ok) expect(reuse.env.kbId).toBe('k');
  });
});

describe('ledgerFileName', () => {
  it('含 kbId，L1 / L2 互不覆盖', () => {
    expect(ledgerFileName('kb-a')).toBe('eval-corpus-ledger-kb-a.json');
    expect(ledgerFileName('kb-b')).not.toBe(ledgerFileName('kb-a'));
  });
});

describe('buildLedgerFromIngest', () => {
  const files: FixtureCorpusFile[] = readFixtureCorpus(REPO_ROOT);

  it('全部文件有 docId → 账本按逻辑 id 升序（同输入等价）', () => {
    const map = new Map(files.map((f, i) => [f.logicalId, `doc-${i}`]));
    const ledger = buildLedgerFromIngest({
      kbId: 'kb-1',
      tenantId: 't-1',
      generatedAt: '2026-09-29 10:00:00',
      files,
      docIdByLogicalId: map,
    });
    const ids = ledger.entries.map((e) => e.logicalId);
    expect(ids).toEqual([...ids].sort());
    expect(ledger.entries).toHaveLength(files.length);
    expect(ledger.kbId).toBe('kb-1');
  });

  it('某逻辑 id 缺 docId → 抛错点名（不静默跳过）', () => {
    const map = new Map(files.slice(1).map((f, i) => [f.logicalId, `doc-${i}`]));
    const missing = files[0].logicalId;
    expect(() =>
      buildLedgerFromIngest({
        kbId: 'kb-1',
        tenantId: 't-1',
        generatedAt: '2026-09-29 10:00:00',
        files,
        docIdByLogicalId: map,
      }),
    ).toThrow(new RegExp(`缺 docId.*${missing.replace(/[/\\]/g, '\\$&')}`));
  });
});

describe('ingestEvalCorpus', () => {
  it('全绿 → 写出账本文件；条目数 = 夹具数；kbId 落账本', async () => {
    const env = baseEnv();
    const result = await ingestEvalCorpus({ env, repoRoot: REPO_ROOT, client: fakeClient() });
    expect(result.kbId).toBe('kb-1');
    expect(existsSync(result.ledgerPath)).toBe(true);
    const onDisk = JSON.parse(readFileSync(result.ledgerPath, 'utf8')) as {
      entries: unknown[];
      kbId: string;
    };
    expect(onDisk.kbId).toBe('kb-1');
    expect(onDisk.entries).toHaveLength(readFixtureCorpus(REPO_ROOT).length);
    expect(result.ledger.entries.every((e) => e.docId.startsWith('doc-'))).toBe(true);
  });

  it('未传 kbId → 新建 KB 并落账本', async () => {
    const env = baseEnv({ kbId: undefined, kbName: 'eval-corpus-kb' });
    const result = await ingestEvalCorpus({ env, repoRoot: REPO_ROOT, client: fakeClient() });
    expect(result.kbId).toBe('kb-created');
    expect(path.basename(result.ledgerPath)).toBe('eval-corpus-ledger-kb-created.json');
  });

  it('某篇入库失败 → 抛错点名该逻辑 id', async () => {
    await expect(
      ingestEvalCorpus({
        env: baseEnv(),
        repoRoot: REPO_ROOT,
        client: fakeClient({ failTitle: '03-doc' }),
      }),
    ).rejects.toThrow(/入库失败 logical id=ingest-samples\/03-doc/);
  });

  it('某篇终态非 ready → 抛错点名该逻辑 id', async () => {
    await expect(
      ingestEvalCorpus({
        env: baseEnv(),
        repoRoot: REPO_ROOT,
        client: fakeClient({ terminalTitle: '05-doc' }),
      }),
    ).rejects.toThrow(/终态非 ready.*ingest-samples\/05-doc/);
  });

  it('永远不就绪 → 轮询超时并点名未 ready 的逻辑 id', async () => {
    await expect(
      ingestEvalCorpus({
        env: baseEnv({ timeoutMs: 30, pollMs: 5 }),
        repoRoot: REPO_ROOT,
        client: fakeClient({ neverReady: true }),
      }),
    ).rejects.toThrow(/轮询超时（未 ready）.*ingest-samples\/01-doc/);
  });
});

describe('ingestEvalCorpus · 四眼审批（ADR-048 #4）', () => {
  it('dev-login 两次（uploader / reviewer），审批只用审批人 token', async () => {
    const spy = newSpy();
    const result = await ingestEvalCorpus({
      env: baseEnv(),
      repoRoot: REPO_ROOT,
      client: fakeClient({}, spy),
    });
    // ① 审批收到的 token 全是审批人（reviewer），从不是上传者
    const files = readFixtureCorpus(REPO_ROOT).length;
    expect(spy.approveTokens).toHaveLength(files);
    expect(spy.approveTokens.every((t) => t === 'tok-reviewer')).toBe(true);
    expect(spy.approveTokens).not.toContain('tok-uploader');
    // ② 两个身份各 dev-login 一次，token 不同
    expect(spy.devLogins).toEqual(['uploader', 'reviewer']);
    expect(spy.devLoginTokens).toHaveLength(2);
    expect(new Set(spy.devLoginTokens).size).toBe(2);
    // 自审探针只用上传者身份，且只在首篇发一次
    expect(spy.probeTokens).toEqual(['tok-uploader']);
    expect(result.ledger.entries).toHaveLength(files);
  });

  it('自审探针拿到的不是 403 → CLI 如实失败并点名逻辑 id（四眼闸缺失要响亮）', async () => {
    await expect(
      ingestEvalCorpus({
        env: baseEnv(),
        repoRoot: REPO_ROOT,
        client: fakeClient({ selfApproveStatus: 200 }),
      }),
    ).rejects.toThrow(/入库失败 logical id=ingest-samples\/01-doc: 四眼闸缺失.*200/);
  });

  it('身份常量：审批人是 kb_admin 的独立主体（邮箱与上传者不同）', () => {
    expect(INGEST_IDENTITIES.reviewer).toEqual({
      email: 'ingest-eval-reviewer@local.dev',
      roleTemplate: 'kb_admin',
    });
    expect(INGEST_IDENTITIES.uploader.email).not.toBe(INGEST_IDENTITIES.reviewer.email);
  });
});
