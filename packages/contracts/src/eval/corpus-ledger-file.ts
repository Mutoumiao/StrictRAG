/**
 * 评测语料夹具的读取面 + 跑批侧账本新鲜度校验（api 与 worker 两侧共用）。
 *
 * 本文件是 `apps/api/src/eval/corpus-fixtures.ts` 与 `apps/api/src/eval/corpus-map.ts` 的**上移**：
 * 逻辑与行为逐位不变，仅换了落地位置（worker 无法 import api 专属相对路径），使两条评测入口
 * （api CLI 与 worker 队列）能共用同一份账本解析口径。
 *
 * 为什么要经**子路径**导出而不进主入口（`src/index.ts`）：本文件用 `node:fs`（与
 * `./corpus-ledger.js` 同一纪律），而 contracts 主入口会被 web / admin 客户端打包
 * （`transpilePackages`）—— node 内置模块进客户端图会让 Next 构建失败。故与
 * `./eval-corpus-ledger`（`node:crypto`）/ `./eval-repro` 同款：只走子路径
 * `@strict-rag/contracts/eval-corpus-ledger-file`。
 *
 * 逻辑 id ↔ 文件的绑定**从目录结构派生**（`fixtures/ingest-samples/<name>` → `ingest-samples/<name>`，
 * `fixtures/l2/corpus/<name>` → `l2-corpus/<name>`），禁止在脚本里再手抄一份清单（手抄会漂）；
 * 权威对照仍是两份 fixtures README 的表格（`fixtures/l1` 与 `fixtures/l2`），由对账测例机械核对。
 *
 * 只做 I/O（读文件字节 + sha256）与派生；账本形状 / 指纹纯函数在 `./corpus-ledger.js`。
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { corpusFingerprint, parseCorpusLedger, type CorpusLedger } from './corpus-ledger.js';

/** 两份语料目录与其逻辑 id 前缀（与两份 fixtures README 表格一致）。 */
export const FIXTURE_CORPUS_DIRS = [
  { dir: 'fixtures/ingest-samples', logicalPrefix: 'ingest-samples' },
  { dir: 'fixtures/l2/corpus', logicalPrefix: 'l2-corpus' },
] as const;

export type FixtureCorpusFile = {
  logicalId: string;
  /** 仓库相对路径（posix） */
  sourceFile: string;
  /** 标题 = 文件名去扩展名（与 `upload-url` 的 title 同口径） */
  title: string;
  sourceSha256: string;
};

/** 逻辑 id = `<前缀>/<文件名去 .txt>`（目录结构派生，不查表）。 */
export function deriveLogicalId(logicalPrefix: string, fileName: string): string {
  return `${logicalPrefix}/${fileName.replace(/\.txt$/i, '')}`;
}

/**
 * monorepo 根：**由调用方显式传入一个位于仓内 4 层深处的文件 URL**（通常是调用方自己的
 * `import.meta.url`）。上移后本文件自身位置（`packages/contracts/src/eval`）与仓库根不再差 4 层，
 * 故**不再**沿用「从本文件上溯 4 层」的硬编码默认——由调用方各自算出同一个仓库根
 * （api CLI 侧与 worker 侧都 4 层，例：`apps/api/src/scripts/x.ts` → 仓根）。
 */
export function defaultRepoRoot(fromFile: string): string {
  return path.resolve(path.dirname(fileURLToPath(fromFile)), '../../../..');
}

/**
 * 读全部语料文件（两份目录），按逻辑 id 片段升序（目录内文件名排序 → 全量再由指纹排序兜底）。
 * 目录不存在 / 无 `.txt` → 抛错（缺文件必须响亮，不得静默产出一份空账本）。
 */
export function readFixtureCorpus(repoRoot: string): FixtureCorpusFile[] {
  const out: FixtureCorpusFile[] = [];
  for (const { dir, logicalPrefix } of FIXTURE_CORPUS_DIRS) {
    const abs = path.join(repoRoot, ...dir.split('/'));
    let names: string[];
    try {
      names = readdirSync(abs).filter((f) => f.toLowerCase().endsWith('.txt'));
    } catch (err) {
      throw new Error(`cannot read corpus dir ${abs}: ${err instanceof Error ? err.message : err}`);
    }
    if (names.length === 0) throw new Error(`no corpus .txt under ${abs}`);
    for (const name of names.sort()) {
      const bytes = readFileSync(path.join(abs, name));
      out.push({
        logicalId: deriveLogicalId(logicalPrefix, name),
        sourceFile: `${dir}/${name}`,
        title: path.basename(name, '.txt'),
        sourceSha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
  return out;
}

/** 当前夹具的语料指纹（跑批侧据此校验账本新鲜度）。 */
export function fixtureCorpusFingerprint(repoRoot: string): string {
  return corpusFingerprint(readFixtureCorpus(repoRoot));
}

/**
 * 跑批侧读账本 + 新鲜度校验（工单 02 裁定 3 / 4）。
 *
 * 只认账本里的精确 uuid；账本 `kbId` 或 `corpusFingerprint` 与本次 run / 当前夹具不符 → 拒跑。
 * 「docId 是否仍在库内」**不做**运行时校验（会让 eval CLI 引入新的 DB 读，扩大回归面）—— 改由
 * 账本记 `title` + `GET …/documents` 全量人工对账（裁定 4，显式划出）。
 */
export class CorpusLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorpusLedgerError';
  }
}

/** 读 + 解析账本文件；缺文件 / 非 JSON / 形状违约一律 `CorpusLedgerError`（禁止静默降级）。 */
export function loadCorpusLedgerFile(ledgerPath: string): CorpusLedger {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch (err) {
    throw new CorpusLedgerError(
      `cannot read corpus ledger: ${ledgerPath}: ${err instanceof Error ? err.message : err}`,
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new CorpusLedgerError(
      `invalid corpus ledger JSON in ${ledgerPath}: ${err instanceof Error ? err.message : err}`,
    );
  }
  try {
    return parseCorpusLedger(data);
  } catch (err) {
    throw new CorpusLedgerError(
      `invalid corpus ledger in ${ledgerPath}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

/**
 * 跑批前解析账本：`kbId` 全等 ∧ `corpusFingerprint` 全等（当前夹具重算），任一不符 → 拒跑。
 * 拿 A 库的映射跑 B 库、或拿过期映射跑，都是无意义且危险的。
 */
export function resolveCorpusLedgerForRun(input: {
  ledgerPath: string;
  kbId: string;
  repoRoot: string;
}): CorpusLedger {
  const ledger = loadCorpusLedgerFile(input.ledgerPath);
  if (ledger.kbId !== input.kbId) {
    throw new CorpusLedgerError(
      `corpus ledger kbId ${ledger.kbId} != run KB ${input.kbId}`,
    );
  }
  const current = fixtureCorpusFingerprint(input.repoRoot);
  if (ledger.corpusFingerprint !== current) {
    throw new CorpusLedgerError(
      `corpus ledger corpusFingerprint ${ledger.corpusFingerprint} != current fixtures ${current}`,
    );
  }
  return ledger;
}
