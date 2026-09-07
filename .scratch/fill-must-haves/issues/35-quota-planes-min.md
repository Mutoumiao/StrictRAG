# 三平面配额最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 34

## Question

补三平面配额最小闭环。这是剩余 P2 半接线里本批唯一一张执行工单。

权威：[裁定修改日志最小闭环后下一步](./34-after-settings-audit-order.md)；`docs/testing/coverage/03-ops.md` 剧本 R5 / R8 / R9；`docs/ops/rate-limit-and-metrics.md`（生产主闸仍在网关 L0；进程内是试点护栏）。现有 `ASK_RATE_LIMIT_RPM` 默认 0，只限 ask，无 `plane` 标签。

### 做

- **平面**：`ask` | `ingest` | `aux`。ask 与 ingest 有独立固定窗口；aux 只留标签/常量，本张不跑。
- **ask**：继续 `ASK_RATE_LIMIT_RPM`（默认 0=关）。键带平面前缀，不得与 ingest 共用计数。触顶：HTTP **429** + `RATE_LIMITED`（**不**改 web 已测的码）；`details` 含 `plane: 'ask'` 与 `ask_quota_exhausted`。禁止 200 空答 `answered`。
- **ingest**：新 env `INGEST_RATE_LIMIT_RPM`（默认 0=关；Zod 与 ask 同形）。打在 `POST …/documents/:docId/complete`（入队前）。触顶 429 `RATE_LIMITED`，`details.plane='ingest'`。键按 tenant+kb，与 ask 分 store。
- **隔离（R5）**：注入测：打满 ask 后 complete 仍 200（ingest 未开或未满）；打满 ingest 后 ask 仍可达（未开或未满）。
- **指标（R9）**：`recordAskResult` / `recordLlmCall` / `recordRerank` 带 `plane=ask`；ingest complete 成功或限流打 `plane=ingest`。aux 不打运行时。
- **默认**：两 RPM 保持 0。禁止改仓库 `.env.example` 成正数冒充试点已开。
- **测例**（api）：
  - ask RPM>0 触顶 429 + details.plane=ask + ask_quota_exhausted；web 仍认 `RATE_LIMITED`
  - ingest RPM>0 触顶 complete 429 + plane=ingest
  - 打满 ask 不阻断 complete；打满 ingest 不阻断 ask
  - `/metrics` 快照含 `plane=ask` / `plane=ingest`
  - RPM=0 两平面都不限

### 不做

- embed TPM / 半套 ready（R6）
- `maxEmbedCalls` 启动 warning（R4）
- staging 缺配额 fail-closed（R10）
- rerank/aux 运行时平面（R11/R12 延后）
- Redis 集群配额 / 进程内全路由中间件 / L0 网关
- 改 `RATE_LIMITED` 为新业务码（会破 web 429 文案）
- 把仓库默认 RPM 改成正数
- 失败 Webhook / 在线编写 / 修改日志返工
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构
- 浏览器 E2E

收工：更新 `.trellis/spec/` 与 `docs/ops/rate-limit-and-metrics.md`；回写 `docs/module-status/`；coverage 03-ops 剧本 R5/R8/R9。`.trellis/tasks/` 若无则跳过。禁止 `task.py create`。禁止 push。

写代码前读 `.trellis/spec/` 对应包（api / contracts）与 HOW `.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头目标/简介简体中文，登记 index。现有 `tests/obs/rate-limit.test.ts` 与 `apps/web/tests/ask/quota-429.test.tsx` 必须仍绿。

## Answer

ask 继续 `ASK_RATE_LIMIT_RPM`（默认 0），ingest 新增 `INGEST_RATE_LIMIT_RPM`（默认 0，Zod 同形）。两平面独立固定窗口、分 store / 分前缀；aux 只留 `QUOTA_PLANES` 常量，不跑。

ask 触顶 HTTP 429 + 业务码仍是 `RATE_LIMITED`（web 配额文案不破）；`details` 含 `plane: 'ask'` 与 `ask_quota_exhausted: true`；不执行图、禁止 200 空答 `answered`。ingest 闸打在 `POST …/documents/:docId/complete` 落 pending 前；触顶 429 `RATE_LIMITED`，`details.plane='ingest'`。打满 ask 不阻断 complete；打满 ingest 不阻断 ask。

`recordAskResult` / `recordLlmCall` / `recordRerank` 带 `plane=ask`；complete 成功或限流打 `ingest_complete_total{plane=ingest}`。仓库两 RPM 保持 0。生产主闸仍在网关 L0；进程内非集群。

未做：embed TPM / `maxEmbedCalls` / staging fail-closed / aux 运行时 / Redis 集群配额 / 进程内全路由中间件 / 改 `RATE_LIMITED` / 默认打开 RPM / Webhook / 在线编写 / P3 / 人签 / rewrite / LangGraph / E2E。未 `task.py create`。`.trellis/tasks/` 目录不存在，已跳过。

证据：`apps/api/src/obs/rate-limit.ts` · `obs/metrics.ts` · `routes/ask.ts` · `routes/documents/index.ts` · `env.ts` · `apps/api/tests/obs/quota-planes.test.ts`。

## Comments

- 2026-09-07 认领并执行。权威切边见 [裁定修改日志最小闭环后下一步](./34-after-settings-audit-order.md)。
