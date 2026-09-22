/**
 * 人工抽检账本加载（文件账本 · 形状见 `@strict-rag/contracts` `HumanSpotLedgerSchema`）。
 * 缺文件 / 非 JSON / 违约一律**抛错** —— 不得退化成「没人登记」：
 * 「登记面坏了」与「没登记」是两种红，混同会让 CLI 静默跑出缺测报告。
 */
import { readFileSync } from 'node:fs';

import { HumanSpotLedgerSchema, type HumanSpotLedger } from '@strict-rag/contracts';

export class HumanSpotLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanSpotLoadError';
  }
}

export function loadHumanSpotLedger(ledgerPath: string): HumanSpotLedger {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch (err) {
    throw new HumanSpotLoadError(
      `cannot read human spot ledger: ${ledgerPath}: ${(err as Error).message}`,
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new HumanSpotLoadError(
      `invalid human spot ledger JSON in ${ledgerPath}: ${(err as Error).message}`,
    );
  }
  const parsed = HumanSpotLedgerSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new HumanSpotLoadError(`invalid human spot ledger in ${ledgerPath}: ${detail}`);
  }
  return parsed.data;
}
