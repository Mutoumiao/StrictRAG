# lint 门禁清零最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Blocked by: 98

## Question

`pnpm lint` 在 HEAD（含本图全部已结题工作）即红：`apps/api` 报 **7 条** `@typescript-eslint/no-unused-vars` warning，`--max-warnings 0` 使整条链失败。

明细细则（`pnpm --filter @strict-rag/api lint`）：

| 文件 | 位置 |
|------|------|
| `tests/ask/mongo-body.test.ts` | `ids` ×2（68:28 / 81:28） |
| `tests/env/ready-hard-deps.test.ts` | `_url` `_opts`（26:17 / 26:32） |
| `tests/env/ready-soft-gateway.test.ts` | `_url` `_opts`（同上） |
| `tests/ingest/approve-then-scan.test.ts` | `_id`（42:21） |

口径：这是**清理债**，不是功能缺陷。只消除未使用绑定，**禁止**改断言、改 mock 行为、加 eslint-disable、放宽 eslint 配置或 `--max-warnings`。

### 做

- 逐处消除未使用：能用则用（如断言确实拿到的东西），不能用的删掉或改成不引入绑定（如 `vi.fn(() => ...)` 不声明形参、或用 `void` 消费）。
- 保持各测例**断言语义不变**（行为等价的改写）。
- 跑 `pnpm --filter @strict-rag/api lint`（须 exit 0、**0 problems**）与 `pnpm --filter @strict-rag/api test`（须全绿）。
- 全仓 `pnpm lint` 须 exit 0。

### 不做

- 不放宽 eslint / 不 `eslint-disable` / 不改 `--max-warnings` 阈值。
- 不删测例、不 `skip`、不改断言口径；不顺手重构被测源码。
- 不改 `prds/00–11`；不 `task.py create`；禁止 push。

收工：若 `docs/module-status/*.md` 或 spec 里写过「lint 已知红」的话，同步改掉。

## Answer

**做了什么**（只消除未使用绑定，断言语义一字未改）：

| 文件 | 改法 |
|------|------|
| `tests/ask/mongo-body.test.ts` | 两处 `loadBodies: async (ids) => …` → `async () => …`（mock 本就不消费 ids） |
| `tests/env/ready-hard-deps.test.ts` | `constructor(_url?, _opts?) {}` → `constructor(url?, opts?) { void url; void opts; }` + 注释说明「形参只为对齐 ioredis 构造签名」 |
| `tests/env/ready-soft-gateway.test.ts` | 同上 |
| `tests/ingest/approve-then-scan.test.ts` | `approve: async (_id: string) => …` → `async () => …` |

**没做什么 / 边界**：未放宽 eslint、未加 `eslint-disable`、未改 `--max-warnings`、未删测例、未改任何断言口径、未顺手重构被测源码。

**验证**：`pnpm --filter @strict-rag/api lint` → exit 0、**0 problems**（原先 7 条）；受影响 11 个测例文件 `55 passed`；全仓 `pnpm lint` → **8/8 成功、零 warning**。全仓测试与类型见地图本轮收口处数字。

## Comments

- 2026-09-16 由 [裁定 98](./98-after-96-order.md) 排为本批首位（清理债）：它挡的是后续每张工单的验证可信度。
- 2026-09-16 完成：清零后本图后续所有验证不再需要挂「lint 已知红」免责。
