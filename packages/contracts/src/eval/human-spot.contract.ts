/**
 * 人工抽检账本（评测 PRD §6 硬门「≥20 条，错 ≤1」的登记面）。
 * 承载面 = 文件（JSON）：不进 PG、不开 HTTP 端点、无迁移。
 * 「错」的口径 PRD 未定义机械口径 → 由抽检人按 rubric 判；本契约只承载整数与可选明细。
 */
import { z } from 'zod';

export const HumanSpotLedgerItemSchema = z
  .object({
    caseId: z.string().min(1),
    wrong: z.boolean(),
    note: z.string().optional(),
  })
  .strict();
export type HumanSpotLedgerItem = z.infer<typeof HumanSpotLedgerItemSchema>;

/**
 * 唯一机械校验的不变式：`errors <= checked`；**给了 `items` 时**
 * `items.length === checked` 且 `items` 里 `wrong` 的条数 `=== errors`。
 */
export const HumanSpotLedgerSchema = z
  .object({
    evalRunId: z.string().min(1),
    sampledBy: z.string().min(1),
    sampledAt: z.string().min(1),
    checked: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    items: z.array(HumanSpotLedgerItemSchema).optional(),
  })
  .strict()
  .superRefine((ledger, ctx) => {
    if (ledger.errors > ledger.checked) {
      ctx.addIssue({
        code: 'custom',
        path: ['errors'],
        message: 'errors must be <= checked',
      });
    }
    if (!ledger.items) return;
    if (ledger.items.length !== ledger.checked) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'items.length must equal checked',
      });
    }
    const wrongCount = ledger.items.filter((i) => i.wrong).length;
    if (wrongCount !== ledger.errors) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'items with wrong=true must equal errors',
      });
    }
  });
export type HumanSpotLedger = z.infer<typeof HumanSpotLedgerSchema>;

/**
 * 报告落点：条数 / 错数 / 来源。
 * 缺测**不写 0 条** —— 报告里该字段为 `null`（「没人登记」与「登记了但 0 条」必须可分辨）。
 */
export type HumanSpotReport = {
  checked: number;
  errors: number;
  /** 账本来源：api CLI 与 worker 批跑同构 = 账本文件路径 */
  source: string;
};

/** 账本 → 报告字段。两侧共用一份，禁止单边另写一份口径。 */
export function toHumanSpotReport(ledger: HumanSpotLedger, source: string): HumanSpotReport {
  return { checked: ledger.checked, errors: ledger.errors, source };
}
