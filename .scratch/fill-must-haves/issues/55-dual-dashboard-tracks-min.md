# 双轨看板最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 54

## Question

补 P4 余量：质量看板 vs 延迟看板分开展示。这是本批唯一一张执行工单。

权威：[裁定 generate fallback 后下一步](./54-after-generate-fallback-order.md)。在线编写仍 P2.x。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- B6 `GET /admin/dashboard/summary` 冻结 5 字段，`.strict()`，**禁止**往信封塞质量/延迟
- `/eval` 已有 2×2 / Hit@k / tau* / auroc；dashboard 页零分区
- `ask_traces.latency_ms` 已落库；summary 只有 `askCount24h` 次数

口径：

- **不**改 `DashboardSummarySchema` / summary GET 形状
- 新契约 `DashboardTracksSchema`：`quality` + `latency` 两个对象；未知字段拒
- 新 GET `/api/v1/admin/dashboard/tracks`，始终 `requirePermission('dashboard.view')`（不要求 `eval.run`）
- **质量**：最近一笔 `status=succeeded` 且 `runType=golden_2x2` 的 L1（按 `ranAt` 降序）。无则字段全 null。展示 2×2 / coverage / hitAtK / tauStar / judgeAuroc。**不**回 `signoffEligible` / `businessPass` / 题面
- **延迟**：近 24h `ask_traces`：`askCount`、有 `latency_ms` 的 `scoredCount`、`avgMs` / `p95Ms`（无有效样本 → null）。窗口与 summary 的 `since24hLocal` 相同
- admin `/dashboard`：保留原 5 卡；其下两个只读区块「质量」「延迟」。文案钉 **≠ APM / ≠ 准出**
- 质量数字是工程账本，**禁止**写成签字 PASS
- **无** Grafana / 时序图 / 新菜单路由 / schema 迁移

### 做

- `@strict-rag/contracts`：`DashboardTracksSchema`（及 quality/latency 子对象）；summary 测例仍拒未知字段
- api：`DashboardRepo` 可注入 `latestL1Quality` / `latencySince`；`getDashboardTracks`；route GET tracks
- 纯函数 `percentileCont`（p95）便于单测；PG 路径可用同口径或 SQL `percentile_cont`
- admin：`api.ts` / `services.ts` 拉 tracks；工作区两区块；summary 失败与 tracks 失败互不吞掉
- 测例：
  - 契约：tracks 合法；未知字段拒；summary 仍拒 extra
  - HTTP：无码 403；无 Bearer 401；有码空质量 + 零延迟；注入 L1 与 p95 回读
  - summary GET 形状不变
  - admin：403 不请求 tracks；有码见「质量」「延迟」；有数字可见矩阵 A
- 覆盖分册 I4：延后 → 部分测（Grafana / 准出仍缺口）

### 不做

- 改 B6 summary 信封或超过 5 个 summary 字段
- Grafana / 时序 / 告警大盘
- 再认证 / 签字公式 / 写 `TAU_CLAIM`
- 把 mock L1 写成业务 PASS
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8
- 人签 / `businessPass`

收工：`.trellis/spec/` api `dashboard.md`；`docs/module-status/` api · admin · contracts；`docs/testing/coverage/03-ops.md` I4。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/dashboard.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

双轨看板最小闭环已落地。

- 契约：`DashboardTracksSchema` 独立信封；`DashboardSummarySchema` 仍 ≤5、拒未知字段。
- `GET /api/v1/admin/dashboard/tracks`：`dashboard.view`。质量 = 最近一笔成功 `golden_2x2` L1（无则 null；不含签字字段）。延迟 = 24h `askCount` / `scoredCount` / `avgMs` / `p95Ms`（无样本 → null）。
- admin `/dashboard`：原 5 卡保留；质量 / 延迟两区块。tracks 失败不清成「暂无 L1」；两侧失败互不吞。
- 覆盖 I4：延后 → 部分测。未做 Grafana / 准出。

未做：再认证、数据面板增强、写 `TAU_CLAIM`、默认开强制、角色 principal。未 `task.py create`。未 push。

证据：`packages/contracts/src/system/dashboard.contract.ts` · `apps/api/src/services/dashboard.ts` · `apps/api/src/routes/dashboard.ts` · `apps/admin/src/app/(ops)/dashboard/_components/dashboard-workspace.tsx` · `packages/contracts/tests/system/dashboard-contract.test.ts` · `apps/api/tests/ops/dashboard-http.test.ts` · `apps/admin/tests/ops/dashboard-workspace.test.tsx`。

## Comments

- 2026-09-09 认领并执行。权威切边见 [裁定 generate fallback 后下一步](./54-after-generate-fallback-order.md)。
- 审查指出 tracks 失败会画成「暂无 L1」、失败不清旧数据；已收紧并补测。
