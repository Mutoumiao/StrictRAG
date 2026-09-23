# 落地：ask 分册五行（D-拼句 · H1 · H5e · U8 · J7c）

Type: task
Status: claimed（主控 2026-09-23 认领；实现子代理执行）
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

## Answer

### 五行收口（动作 → 文件 → 证据）

| 行 | 收口动作 | 落点 | 证据 |
|---|---|---|---|
| `D-拼句` | `route_source` 取值域对齐 ADR-033 观测四元：类型收为 `'rule_chitchat' \| 'rule_knowledge' \| 'fallback_single'`（`llm` 不预置）；映射 `looksChitchat∧!blocked→rule_chitchat`、后置闸 `looksChitchat∧blocked→rule_knowledge`、知识向线索 ∨ `len>4 → rule_knowledge`，空问 / 模糊短句保持 `fallback_single`；`route_post_block` / `routeLabel` / `route_llm_skipped` 未动 | `apps/api/src/graph/route-rules.ts:6,71,80,90` | `apps/api/tests/ask/route-rules.test.ts` 新 `it('D-拼句: 「你好，请问差旅住宿标准」→ single 非 chitchat，route_source=rule_knowledge')`（:32）钉 single + `route_post_block=false` + `rule_knowledge` |
| `D-拼句`（补） | 钉住纯寒暄支 | `apps/api/tests/ask/route-rules.test.ts` | 新 `it('纯寒暄「你好」→ chitchat，route_source=rule_chitchat')`（:40） |
| `H1` | 不补 `Retry-After` 头（「可带 / 建议」= 许可）；覆盖值改 `已测` | `docs/testing/coverage/00-ask.md:51` | `apps/api/tests/obs/rate-limit.test.ts` 的 `it('限流触发 → 429 + RATE_LIMITED')`、`apps/api/tests/obs/quota-planes.test.ts` 的 `it('ask RPM>0 触顶 → 429 RATE_LIMITED + plane=ask + ask_quota_exhausted，不得 200 answered')` |
| `H5e` | 保留 `部分测`；不建 debug / maintenance 档位（ADR-030/034 + `prds/10-delivery/02-ops-runbook.md:201` 禁止），实质不变式由 `H5c` 覆盖 | `docs/testing/coverage/00-ask.md:59` | 缺口列按裁定原文改写，无「源码侧待定」 |
| `U8` | 不补启动闸（析取已满足，支 B 已落）；覆盖值改 `已测` | `docs/testing/coverage/00-ask.md:87` | `apps/api/tests/kb/settings-http.test.ts` 的 `it('PATCH 含 sessionRewriteEnabledDefault → 400')`（400 `SESSION_REWRITE_DISABLED`） |
| `J7c` | 同 U8（本行回指 U8）；覆盖值改 `已测` | `docs/testing/coverage/00-ask.md:96` | `packages/contracts/tests/kb/settings-contract.test.ts` 的 `it('requires sessionRewrite locked off')` |

本册小计：`已测` 26→30、`部分测` 25→21（64 行不变）→ `docs/testing/coverage/00-ask.md:111-119`。

### 反证（两轮）

1. 把「知识向线索 ∨ `len>4`」支映射改坏为 `rule_chitchat` → 新 `it('D-拼句…')` **变红**（`route_source: 'rule_chitchat'` ≠ 期望 `rule_knowledge`；1 failed | 5 passed）。
2. 映射仍坏、**删掉**该 `it` → **5 passed 全绿**（证明红来自该 `it` × 映射，非他因；反证手段确有区分力）。
**还原后绿**：还原映射与该 `it` 后复跑 —— `pnpm check-types` **8/8**、`pnpm lint` **零 warning**、`pnpm run test --filter @strict-rag/api` **177 文件 / 1098 passed · 3 skipped**（turbo 命中，与首轮绿态同 hash）。

### 未做（「七项不加」守住）

未补 `Retry-After` 头 · 未加 rewrite 启动闸 · 未建 debug / maintenance 档位 · 未新增重提端点 · 未建 worker 指标面 · 未加模型三类闸 · 未收紧 `state.ts:61,124` 与 `ask.contract.ts:129` 宽松类型；未改 `prds/`、`fixtures/`、任何默认开关（`AUTH_ENFORCE` / `SESSION_REWRITE_ENABLED`）。
