# 裁定三平面配额最小闭环后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 35

## Question

[三平面配额最小闭环](./35-quota-planes-min.md) 已 `resolved`。ask / ingest 分平面限流（默认 0）；ask 触顶仍 429 `RATE_LIMITED`；指标带 `plane`。aux 不跑。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- 配额切边（TPM / maxEmbedCalls / Redis 集群 / 默认打开）不并进已关工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、在线编写（完整体验 P2.x）
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

三平面配额最小闭环之后，本图继续收 **剩余 P2 半接线**。本批只做失败 Webhook 最小闭环。不转 P3b、不跳 P4、不暂停等人签。在线编写仍是完整体验 P2.x，留雾。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [失败 Webhook 最小闭环](./37-ingest-failure-webhook-min.md) — 开放前沿。入库阶段失败 POST 可选 URL；空 URL 为无操作；失败不阻断状态机。切边见该工单正文。

仍留雾：在线编写。

未改产品代码。

## Comments

- 2026-09-07 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续剩余 P2。不转 P3b、不跳 P4、不等人签。
- Q2：选 失败 Webhook。全仓无业务 webhook，是 P2 契约真空。在线编写仍是 P2.x。
- Q3：选 1。一张工单。只打入库阶段失败，不打 ask 拒答。
- Q4：选 1。env `INGEST_FAILURE_WEBHOOK_URL` 可选，空=不发。worker 阶段账本失败时 POST JSON。超时短、只试一次、抛错只记日志、不阻断入库。
- Q5：选 1。载荷：`event=ingest.failed` + tenantId/kbId/docId/stage/errorCode/at。无正文、无密钥。
- Q6：选 1。不签名、不重试队列、不 admin 配置页、不 ask 失败 webhook。
- 2026-09-07 自行确认落盘：关本工单；建 [失败 Webhook 最小闭环](./37-ingest-failure-webhook-min.md)。
