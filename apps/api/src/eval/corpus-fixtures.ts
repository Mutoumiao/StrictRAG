/**
 * 评测语料夹具的读取面（入库 CLI 与跑批 CLI 共用）。
 *
 * 逻辑 id ↔ 文件的绑定**从目录结构派生**（`fixtures/ingest-samples/<name>` → `ingest-samples/<name>`，
 * `fixtures/l2/corpus/<name>` → `l2-corpus/<name>`），禁止在脚本里再手抄一份清单（手抄会漂）；
 * 权威对照仍是两份 fixtures README 的表格（`fixtures/l1` 与 `fixtures/l2`），由对账测例机械核对。
 *
 * 只做 I/O（读文件字节 + sha256）与派生；账本形状 / 指纹纯函数在 `@strict-rag/contracts/eval-corpus-ledger`。
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { corpusFingerprint } from '@strict-rag/contracts/eval-corpus-ledger';

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

/** monorepo 根（`apps/api/src/eval` → 上溯 4 层）。 */
export function defaultRepoRoot(fromFile = import.meta.url): string {
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
