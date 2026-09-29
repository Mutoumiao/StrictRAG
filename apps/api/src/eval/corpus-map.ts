/**
 * 跑批侧读账本 + 新鲜度校验（工单 02 裁定 3 / 4）。
 *
 * 只认账本里的精确 uuid；账本 `kbId` 或 `corpusFingerprint` 与本次 run / 当前夹具不符 → 拒跑（exit 2）。
 * 「docId 是否仍在库内」**不做**运行时校验（会让 eval CLI 引入新的 DB 读，扩大回归面）—— 改由
 * 账本记 `title` + `GET …/documents` 全量人工对账（裁定 4，显式划出）。
 */
import { readFileSync } from 'node:fs';

import { parseCorpusLedger, type CorpusLedger } from '@strict-rag/contracts/eval-corpus-ledger';

import { fixtureCorpusFingerprint } from './corpus-fixtures.js';

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
