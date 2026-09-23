# 落地：ask 分册五行（D-拼句 · H1 · H5e · U8 · J7c）

Type: task
Status: open
Blocked by: 02-dec-per-row-ruling

## Question

按工单 02 的裁定，把 ask 分册这五行收口到位（源码改动仅在裁定要求时；其余为覆盖表口径订正 + 补钉住那一支的测例）：

- `D-拼句`（`docs/testing/coverage/00-ask.md`）· `H1` · `H5e` · `U8` · `J7c`

落地范围（以工单 02 裁定为准）：

1. **源码侧**（若裁定为甲或「需要新增面且离线可做」）：改 `apps/api/src/graph/route-rules.ts` / `apps/api/src/env.ts` / 限流响应头等**且必须收紧或逐位等价**。例：若裁定 H1 要补 `Retry-After` 头，则必须是**新增头**且不改变既有 429 语义与 `retryAfterSec`；若裁定 U8 / J7c 要补启动侧检测，须是**加严**（原先放行的场景变拒绝），并配一条负向测例。
2. **测例**：新增测例只进 `apps/api/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」**简体中文**，并登记 `apps/api/tests/index.md`。凡裁定为「乙」的行，**必须**有一条测例钉住「源码实际满足的那一支」（如 U8 的 400 路径已有测 → 补一条明确的 `it` 名指向该 Then 行号，别让它只作为别的测试的副产品）。
3. **覆盖表**：`docs/testing/coverage/00-ask.md` 这五行的「缺口」列按工单 02 的统一写法改写（去掉「源码侧待定」），覆盖值按裁定重判。

纪律：

- **不许**改 `prds/*`；**不许**改 `fixtures/*`；**不许**动任何仓库默认开关。
- **不许**删 / 跳既有 `it`。既有测例若因口径订正需要改 `it` 名，改后必须仍断言同一事实。
- 若某行裁定为**丙 / 丁**（ADR-ready 或撞外部基建），把裁定书 / 债写到 `.trellis/spec/api/` 或 `docs/module-status/api.md` 对应位置，**不改 PRD**。
- 收尾跑 `pnpm check-types` + `pnpm lint`（零 warning）+ `pnpm run test --filter @strict-rag/api`。

## 产出

- 源码 / 测例 / 覆盖表改动（可提交的 diff）。
- 本工单 `## Answer`：五行逐行的「收口动作 → 落到哪个文件 → 证据」+ 反证记录（至少把一行改回旧口径 / 拆掉新测例，看是否变红）。
