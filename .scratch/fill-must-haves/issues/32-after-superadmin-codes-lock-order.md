# 裁定写路径锁超管全码后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 31

## Question

[写路径锁超管全码](./31-lock-superadmin-full-codes.md) 已 `resolved`。PUT/PATCH 改少超管绑码 400；admin 角色页勾选/保存不可点。启动引导超管（env 创建）与写路径锁都已齐。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- 启动引导切边与写路径锁切边不并进已关工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、三平面配额、修改日志、在线编写（完整体验 P2.x）
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

写路径锁超管全码之后，本图继续收 **剩余 P2 半接线**。本批只做修改日志最小闭环。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [修改日志最小闭环](./33-settings-audit-min.md) — 开放前沿。KB settings PATCH 已有 `merged.diff`（谁改了哪些字段的旧→新），只打 Pino、不可查询。本张落可查询行 + 库级 GET + admin 设置页列表。切边见该工单正文。

仍留雾：失败 Webhook、三平面配额、在线编写。

未改产品代码。

## Comments

- 2026-09-07 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「写路径锁超管全码后下一步」，不写产品代码。用户授权本图全程自行决策。
- Q1：选 1。继续收剩余 P2 半接线。不转 P3b、不跳 P4、不暂停等人签。
- Q2：选 修改日志最小闭环。settings PATCH 已有 diff 未落表，是半接线。失败 Webhook 是真空、三平面配额是新子系统、在线编写仍是 P2.x，均留雾。
- Q3：选 1。一张执行工单：落库 + GET + admin 设置页列表。
- Q4：选 1。只记 KB settings PATCH 的 `merged.diff`。不把 `admin_write` 中间件全路径落表。空 diff 不写行。
- Q5：选 1。`GET /api/v1/knowledge-bases/:kbId/settings-audit`；权限与 settings 相同（`kb.config.write` + 成员闸）。空列表 200。
- Q6：选 1。admin 挂知识库设置页一节，只展示本库已落行（谁 / 何时 / 字段旧→新）。无独立路由。
- Q7：选 1。禁止落密钥。diff 只用现有 `merged.diff` 键。不记 tauClaim / qualitySnapshot。
- 2026-09-07 自行确认落盘：关本工单；建 [修改日志最小闭环](./33-settings-audit-min.md)。
