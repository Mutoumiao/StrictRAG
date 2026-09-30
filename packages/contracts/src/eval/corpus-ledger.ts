/**
 * 评测语料「逻辑 id → documents.id」映射账本（评测 PRD §3 / §6 的 Hit@20 数据面）。
 *
 * 为什么走子路径导出（`@strict-rag/contracts/eval-corpus-ledger`）而不进主入口：本文件用
 * `node:crypto`（与 `./l1-repro.js` 同一套 `createHash('sha256')` 用法），而 contracts 主入口
 * 会被 web / admin 客户端打包（`transpilePackages`）—— node 内置模块进客户端图会让 Next 构建失败。
 *
 * 纪律（工单 02 裁定 1 / 3 / 4）：
 * - **一份账本 = 一个 KB**：L1 / L2 走两个独立 KB env，账本按 `kbId` 分辨（文件名含 kbId）。
 * - 形状与解析口径**唯一锚住**在本文件；入库 CLI 与跑批 CLI 共用，禁止单边另写一份。
 * - 确定性：`entries` 按 `logicalId` 升序；同一输入跨进程同输出（排序不是可选项）。
 * - `corpusFingerprint` 对**所有语料文件**（`fixtures/ingest-samples/*.txt` 与
 *   `fixtures/l2/corpus/*.txt`）按 `logicalId` 升序取 `logicalId + ':' + sha256(文件字节)` 拼接后再 sha256。
 * - **未映射继续算 miss**：`resolveExpectedDocIds` 对账本里没有的逻辑 id **原样保留**（比对必然不中），
 *   **绝不**变成 `null` / 「该门不适用」。
 * - 逻辑 id 的绑定来自夹具目录结构（入库 CLI 派生），本文件只承载形状与纯函数，不做任何 I/O。
 */
import { createHash } from 'node:crypto';

/** 账本版本（形状变更须升版并回写本文件头）。 */
export const CORPUS_LEDGER_VERSION = 1;

/** 账本条目：一条 = 一个逻辑 id ↔ 当前 KB 内一篇文档。 */
export type CorpusLedgerEntry = {
  /** 夹具逻辑 id（如 `ingest-samples/01-doc` / `l2-corpus/travel-stay`） */
  logicalId: string;
  /** 当前 KB 内 `documents.id`（uuid v7） */
  docId: string;
  /** 文档标题（入库取文件名去扩展名），供 `GET …/documents` 人工对账 */
  title: string;
  /** 仓库相对路径（posix），如 `fixtures/ingest-samples/01-doc.txt` */
  sourceFile: string;
  /** 源文件字节的 sha256（小写十六进制）；「夹具被改」能定位到具体文件 */
  sourceSha256: string;
};

/** 映射账本：`version` / `kbId` / `tenantId` / `generatedAt` / `corpusFingerprint` / `entries`。 */
export type CorpusLedger = {
  version: typeof CORPUS_LEDGER_VERSION;
  kbId: string;
  tenantId: string;
  /** 生成时刻（与仓内写库口径一致的本地格式串；由调用方提供，不在本文件造时间） */
  generatedAt: string;
  /** 语料指纹（对全部语料文件按逻辑 id 升序算得） */
  corpusFingerprint: string;
  /** 按 `logicalId` 升序 */
  entries: CorpusLedgerEntry[];
};

/** 报告 `docMapSource` 两态：`ledger` = 按账本解析过；`none` = 未传账本（逐位保持今天语义）。 */
export const DOC_MAP_SOURCES = ['ledger', 'none'] as const;
export type DocMapSource = (typeof DOC_MAP_SOURCES)[number];

/** 跑批报告顶层三键（**都不进任何判定**）。 */
export type DocMapSummary = {
  docMapSource: DocMapSource;
  /** 成功换成 uuid 的**去重后**逻辑 id 数（未传账本 → 0） */
  docMapResolved: number;
  /** 账本里没有的逻辑 id（字典序去重；未传账本 → `[]`） */
  docMapUnmappedIds: string[];
};

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function str(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`corpus ledger ${label} must be a non-empty string`);
  }
  return value.trim();
}

/** 逻辑 id 升序比较（逐码点，不依赖 locale；同 id 视为等价）。 */
function compareLogicalId(a: CorpusLedgerEntry, b: CorpusLedgerEntry): number {
  if (a.logicalId < b.logicalId) return -1;
  if (a.logicalId > b.logicalId) return 1;
  return 0;
}

/** 解析校验单条；脏形状抛错（与 `expectedDocIds` 同纪律，禁止静默当无名单）。 */
function parseEntry(raw: unknown, index: number): CorpusLedgerEntry {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError(`corpus ledger entries[${index}] must be an object`);
  }
  const row = raw as Record<string, unknown>;
  const sourceSha256 = str(row.sourceSha256, `entries[${index}].sourceSha256`);
  if (!SHA256_HEX_RE.test(sourceSha256)) {
    throw new TypeError(`corpus ledger entries[${index}].sourceSha256 must be sha256 hex`);
  }
  return {
    logicalId: str(row.logicalId, `entries[${index}].logicalId`),
    docId: str(row.docId, `entries[${index}].docId`),
    title: str(row.title, `entries[${index}].title`),
    sourceFile: str(row.sourceFile, `entries[${index}].sourceFile`),
    sourceSha256,
  };
}

/**
 * 排序确定性：按 `logicalId` 升序返回新数组（不改入参）。
 * 同一输入跨进程同输出 —— 换序不算换账本（`docId` 与 `logicalId` 一一对应）。
 */
export function sortLedgerEntries(
  entries: ReadonlyArray<CorpusLedgerEntry>,
): CorpusLedgerEntry[] {
  return [...entries].map((e) => ({ ...e })).sort(compareLogicalId);
}

/**
 * 语料指纹：按 `logicalId` 升序取 `logicalId + ':' + sourceSha256`，以 `\n` 连接后取 sha256。
 * 只吃「逻辑 id + 文件哈希」两侧（不含 docId / title）—— 故「同一份夹具 + 同一条命令」可在
 * 同构环境重建**除 uuid 外逐键等价**的账本，且指纹逐位可核对。
 */
export function corpusFingerprint(
  entries: ReadonlyArray<Pick<CorpusLedgerEntry, 'logicalId' | 'sourceSha256'>>,
): string {
  const rows = entries
    .map((e) => ({ logicalId: e.logicalId.trim(), sourceSha256: e.sourceSha256.trim() }))
    .sort((a, b) => (a.logicalId < b.logicalId ? -1 : a.logicalId > b.logicalId ? 1 : 0));
  return sha256Hex(rows.map((r) => `${r.logicalId}:${r.sourceSha256}`).join('\n'));
}

/**
 * 造账本（入库 CLI 用）：排序 → 校验（无重复逻辑 id / 合法 sha）→ 算指纹。
 * 非法（重复 / 空 / 坏 sha）抛错，禁止造出一份「可解析但不自洽」的账本。
 */
export function buildCorpusLedger(input: {
  kbId: string;
  tenantId: string;
  generatedAt: string;
  entries: ReadonlyArray<CorpusLedgerEntry>;
}): CorpusLedger {
  const kbId = str(input.kbId, 'kbId');
  const tenantId = str(input.tenantId, 'tenantId');
  const generatedAt = str(input.generatedAt, 'generatedAt');
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new TypeError('corpus ledger entries must be a non-empty array');
  }
  const entries = input.entries.map((e, i) => parseEntry(e, i));
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.logicalId)) {
      throw new TypeError(`corpus ledger duplicate logicalId: ${e.logicalId}`);
    }
    seen.add(e.logicalId);
  }
  const sorted = sortLedgerEntries(entries);
  return {
    version: CORPUS_LEDGER_VERSION,
    kbId,
    tenantId,
    generatedAt,
    corpusFingerprint: corpusFingerprint(sorted),
    entries: sorted,
  };
}

/**
 * 解析校验账本：形状 + 确定性（按 `logicalId` 升序重排） + 自洽（`corpusFingerprint` 须等于按
 * entries 重算的指纹）。脏形状 / 版号不符 / 指纹不自洽一律抛错 —— 传了账本却用不上时静默降级比报错危险。
 */
export function parseCorpusLedger(raw: unknown): CorpusLedger {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('corpus ledger must be an object');
  }
  const row = raw as Record<string, unknown>;
  if (row.version !== CORPUS_LEDGER_VERSION) {
    throw new TypeError(`corpus ledger version must be ${CORPUS_LEDGER_VERSION}`);
  }
  const kbId = str(row.kbId, 'kbId');
  const tenantId = str(row.tenantId, 'tenantId');
  const generatedAt = str(row.generatedAt, 'generatedAt');
  const fingerprint = str(row.corpusFingerprint, 'corpusFingerprint');
  if (!SHA256_HEX_RE.test(fingerprint)) {
    throw new TypeError('corpus ledger corpusFingerprint must be sha256 hex');
  }
  const rawEntries = row.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new TypeError('corpus ledger entries must be a non-empty array');
  }
  const entries = rawEntries.map((e, i) => parseEntry(e, i));
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.logicalId)) {
      throw new TypeError(`corpus ledger duplicate logicalId: ${e.logicalId}`);
    }
    seen.add(e.logicalId);
  }
  const sorted = sortLedgerEntries(entries);
  if (corpusFingerprint(sorted) !== fingerprint) {
    throw new TypeError('corpus ledger corpusFingerprint does not match its entries');
  }
  return {
    version: CORPUS_LEDGER_VERSION,
    kbId,
    tenantId,
    generatedAt,
    corpusFingerprint: fingerprint,
    entries: sorted,
  };
}

/** logicalId → docId 查找表（内部；重复逻辑 id 已由 parse/build 拒绝）。 */
function docIdMap(ledger: CorpusLedger): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of ledger.entries) map.set(e.logicalId, e.docId);
  return map;
}

/**
 * 按账本把期望逻辑 id 解析为 uuid：**命中的换成 uuid；账本里没有的原样保留**。
 * 原样保留 = `hitAtKCase` 拿逻辑 id 比 uuid 必然不中 → 记 miss（**绝不**变成 `null`）。
 * 逐项 trim → 去空项；空名单 → `[]`（与 `hitAtKCase` 的「无非空名单不计分」同入口）。
 */
export function resolveExpectedDocIds(
  expected: readonly string[] | null | undefined,
  ledger: CorpusLedger,
): string[] {
  const map = docIdMap(ledger);
  const out: string[] = [];
  for (const raw of expected ?? []) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (id.length === 0) continue;
    out.push(map.get(id) ?? id);
  }
  return out;
}

/**
 * 汇总报告三键（**不进任何判定**）：
 * - `docMapSource`：未传账本（`ledger === null`）→ `none`；否则 `ledger`。
 * - `docMapResolved`：成功换成 uuid 的去重逻辑 id 数。
 * - `docMapUnmappedIds`：账本里没有的逻辑 id，字典序去重（含**全部**被引用到的逻辑 id，不只是命中题）。
 */
export function summarizeDocMap(
  expectedById: ReadonlyArray<readonly string[] | null | undefined>,
  ledger: CorpusLedger | null,
): DocMapSummary {
  const ids = new Set<string>();
  for (const list of expectedById) {
    for (const raw of list ?? []) {
      if (typeof raw !== 'string') continue;
      const id = raw.trim();
      if (id.length > 0) ids.add(id);
    }
  }
  if (!ledger) {
    return { docMapSource: 'none', docMapResolved: 0, docMapUnmappedIds: [] };
  }
  const map = docIdMap(ledger);
  let resolved = 0;
  const unmapped: string[] = [];
  for (const id of ids) {
    if (map.has(id)) resolved += 1;
    else unmapped.push(id);
  }
  unmapped.sort();
  return { docMapSource: 'ledger', docMapResolved: resolved, docMapUnmappedIds: unmapped };
}

/** 可检索姿态：`status` 必须等于它（检索闸双就绪之一，禁止散落字面量）。 */
export const RETRIEVABLE_STATUS = 'ready';
/** 可检索姿态：`lifecycle` 必须等于它（检索闸双就绪之一，禁止散落字面量）。 */
export const RETRIEVABLE_LIFECYCLE = 'active';

/**
 * 库内文档行的对账投影：`docId` 之外还带 `kbId` / `title` / `status` / `lifecycle`。
 * 由调用方注入的 `lookupDocs` 产出（本文件不做任何 DB I/O）。
 */
export type LedgerDocRef = {
  docId: string;
  kbId: string;
  title: string;
  status: string;
  lifecycle: string;
};

/** 单条对账失配：`logicalId` + `docId` + 类型 + 实测到的库内字段（取不到则缺省）。 */
export type LedgerReconcileIssue = {
  logicalId: string;
  docId: string;
  reason: 'missing' | 'not_retrievable' | 'title_mismatch';
  observed?: { kbId?: string; title?: string; status?: string; lifecycle?: string };
};

/** 对账差异：三类**互斥**，各自可分辨；`ok = 三类皆空`。 */
export type LedgerReconcileDiff = {
  ok: boolean;
  missing: LedgerReconcileIssue[];
  notRetrievable: LedgerReconcileIssue[];
  titleMismatch: LedgerReconcileIssue[];
};

/**
 * 账本 ↔ 库内文档行对账（纯函数，零 I/O）。按账本 `entries` 顺序逐条判，命中第一类即不再往下判：
 * ① `refs` 里没有该 `docId`，**或**该行 `kbId !== ledger.kbId` → `missing`；
 * ② 行在但 `status !== 'ready'` **或** `lifecycle !== 'active'` → `not_retrievable`；
 * ③ 行在且可检索，但 `title` 与账本条目不逐字相等 → `title_mismatch`。
 * 只查「存在」会放行重跑入库后落 `superseded` 的旧行（必然假 miss），故以可检索姿态为准。
 * **确定性**：输出顺序 = 账本 entries 顺序（账本已按 `logicalId` 升序）。
 */
export function diffLedgerAgainstDocs(
  ledger: CorpusLedger,
  refs: readonly LedgerDocRef[],
): LedgerReconcileDiff {
  const byDocId = new Map<string, LedgerDocRef>();
  for (const ref of refs) byDocId.set(ref.docId, ref);
  const missing: LedgerReconcileIssue[] = [];
  const notRetrievable: LedgerReconcileIssue[] = [];
  const titleMismatch: LedgerReconcileIssue[] = [];
  for (const entry of ledger.entries) {
    const ref = byDocId.get(entry.docId);
    if (!ref || ref.kbId !== ledger.kbId) {
      missing.push({
        logicalId: entry.logicalId,
        docId: entry.docId,
        reason: 'missing',
        ...(ref ? { observed: { kbId: ref.kbId } } : {}),
      });
      continue;
    }
    if (ref.status !== RETRIEVABLE_STATUS || ref.lifecycle !== RETRIEVABLE_LIFECYCLE) {
      notRetrievable.push({
        logicalId: entry.logicalId,
        docId: entry.docId,
        reason: 'not_retrievable',
        observed: {
          kbId: ref.kbId,
          title: ref.title,
          status: ref.status,
          lifecycle: ref.lifecycle,
        },
      });
      continue;
    }
    if (ref.title !== entry.title) {
      titleMismatch.push({
        logicalId: entry.logicalId,
        docId: entry.docId,
        reason: 'title_mismatch',
        observed: {
          kbId: ref.kbId,
          title: ref.title,
          status: ref.status,
          lifecycle: ref.lifecycle,
        },
      });
    }
  }
  return {
    ok: missing.length === 0 && notRetrievable.length === 0 && titleMismatch.length === 0,
    missing,
    notRetrievable,
    titleMismatch,
  };
}

/** 明细条数上限：超过则「…共 N 条」收口（避免把整库细节灌进一条错误）。 */
const RECONCILE_DETAIL_MAX = 5;

function formatReconcileIssue(issue: LedgerReconcileIssue): string {
  const observed = issue.observed;
  const parts = [`${issue.logicalId}→${issue.docId}`, issue.reason];
  if (observed?.kbId !== undefined) parts.push(`kbId=${observed.kbId}`);
  if (observed?.title !== undefined) parts.push(`title=${observed.title}`);
  if (observed?.status !== undefined) parts.push(`status=${observed.status}`);
  if (observed?.lifecycle !== undefined) parts.push(`lifecycle=${observed.lifecycle}`);
  return `[${parts.join(' ')}]`;
}

/**
 * 单条错误消息（供 `CorpusLedgerError`）：必须含三类**计数**与逐条明细
 * （每条点名 `logicalId` + `docId` + 实测 `status` / `lifecycle` / `title` / `kbId` 里可得那几项）。
 * 明细最多列前 5 条，其余以「…共 N 条」收口。禁只报一句「对账失败」，禁降级成「无账本」。
 */
export function formatLedgerReconcileError(diff: LedgerReconcileDiff, kbId: string): string {
  const issues = [...diff.missing, ...diff.notRetrievable, ...diff.titleMismatch];
  const counts = `missing=${diff.missing.length} not_retrievable=${diff.notRetrievable.length} title_mismatch=${diff.titleMismatch.length}`;
  const detail = issues.slice(0, RECONCILE_DETAIL_MAX).map(formatReconcileIssue).join('；');
  const rest = issues.length > RECONCILE_DETAIL_MAX ? `；…共 ${issues.length} 条` : '';
  return `账本与库内文档对不上（KB ${kbId}）：${counts}；明细：${detail}${rest}`;
}
