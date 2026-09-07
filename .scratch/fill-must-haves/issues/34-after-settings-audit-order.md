# 裁定修改日志最小闭环后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 33

## Question

[修改日志最小闭环](./33-settings-audit-min.md) 已 `resolved`。KB settings PATCH 有 diff 落 `kb_settings_audits`；GET settings-audit 可查；admin 设置页一节。`admin_write` 仍是 Pino、不落表。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- 修改日志切边（全路径落表 / 角色用户审批日志 / 导出）不并进已关工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、三平面配额、在线编写（完整体验 P2.x）
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

修改日志最小闭环之后，本图继续收 **剩余 P2 半接线**。本批只做三平面配额最小闭环。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [三平面配额最小闭环](./35-quota-planes-min.md) — 开放前沿。ask / ingest 分平面限流（默认 0=关）互不阻断；ask 触顶仍 429 不装 answered；指标带 `plane`。aux 只留标签、不跑。切边见该工单正文。

仍留雾：失败 Webhook、在线编写。

未改产品代码。

## Comments

- 2026-09-07 按图顺序认领本工单。开放前沿无执行工单。用户授权本图全程自行决策。
- Q1：选 1。继续收剩余 P2。不转 P3b、不跳 P4、不等人签。
- Q2：选 三平面配额最小闭环。剧本 R5/R8/R9 是已写清的 P2 必签。失败 Webhook 全仓无契约、问题还不够尖。在线编写仍是 P2.x。
- Q3：选 1。一张执行工单。不拆 metrics 与限流为两张。
- Q4：选 1。ask 继续 `ASK_RATE_LIMIT_RPM`（默认 0）；新增 `INGEST_RATE_LIMIT_RPM`（默认 0）打在 complete 入队。两平面独立 store。不改仓库默认 0。
- Q5：选 1。ask 触顶仍 HTTP 429 + 现有 `RATE_LIMITED`（web 配额文案不破）；details 带 `plane=ask` 与 `ask_quota_exhausted`。禁止 200 空答 answered。
- Q6：选 1。指标 `ask_total` / llm / rerank 带 `plane=ask`；complete 触顶或入队打 `plane=ingest`。aux 平面常量可有、不跑 R12。
- Q7：选 1。不做 embed TPM、不做 maxEmbedCalls、不做 Redis 集群配额、不做进程内全局限流、不做 L0 网关、不默认打开。
- 2026-09-07 自行确认落盘：关本工单；建 [三平面配额最小闭环](./35-quota-planes-min.md)。
