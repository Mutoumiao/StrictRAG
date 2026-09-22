/**
 * 人工抽检账本加载（文件账本 · 形状见 `@strict-rag/contracts` `HumanSpotLedgerSchema`）。
 * 与 api 侧 `apps/api/src/eval/human-spot.ts` 同构：两条批跑入口认同一份账本契约。
 * 缺文件 / 非 JSON / 违约一律**抛错** —— 不得退化成「没人登记」（那是另一种红）。
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
