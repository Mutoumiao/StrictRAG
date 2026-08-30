# 裁定末位超管前端提示后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 20

## Question

[末位超管前端提示](./20-last-superadmin-hint.md) 已 `resolved`。本批鉴权/成员余量（[鉴权路径与成员 PUT](./19-authz-path-and-member-put.md) → 末位超管前端提示）已齐。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是启动引导超管页。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- API 最后超管 400 闸不放宽（已由末位超管前端提示钉死）

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：入库报告、失败 Webhook、三平面配额、修改日志、超管引导页、在线编写（完整体验 P2.x）、库选择器只列成员库
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

末位超管前端提示之后，本图继续收 **剩余 P2 半接线**。本批只做入库报告最小闭环。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [入库报告最小闭环](./22-ingest-report-min.md) — 开放前沿。worker 落可查询报告 + `GET /api/v1/knowledge-bases/:kbId/ingest-report` + admin 文档行展开区入口。只写真事；跨 doc / `pending_review` / Hit@k 抽样 / Webhook 留雾。切边见该工单正文。

仍留雾：失败 Webhook、三平面配额、修改日志、超管引导页、在线编写、库选择器只列成员库。

未改产品代码。

## Comments

- 2026-08-30 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「末位超管前端提示后下一步」，不写产品代码。
- Q1：选 1。继续收剩余 P2 半接线。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 默认开 rewrite / P3a 仍不进执行。切哪些、怎么拆，下一问再锁。
- Q2：选 1。本批只做入库报告最小闭环。失败 Webhook、三平面配额、修改日志、超管引导页、在线编写、库选择器留雾。跨 doc 去重 / `pending_review` 二选一 / L0L1 Hit@k 抽样不并进。拆张与切边下一问再锁。
- Q3：选 1。一张执行工单：worker 落可查询报告 + GET + admin 文档页入口。
- Q4：选 1。`GET /api/v1/knowledge-bases/:kbId/ingest-report`（库级；文档页用当前库拉取，只展示本行文档）。不发明 doc 级路径。
- Q5：选 1。落库并返回已发生的事实；跨 doc / L1 / 冲突对 / Hit@k 省略或显式未实现，禁止填 0 装齐。
- Q6：选 2。读权限 `doc.view` + 文档所属库成员闸。不新码，不用 `kb.config.write`。
- Q7：选 1。admin 挂文档行展开区，紧挨「入库阶段」（同页）。无独立抽屉、无新路由。
- Q8：选 1。库级 GET 只返回已落库的行；无报告文案「暂无入库报告」；空列表 200，不为未完成文档造空壳。
- Q9：选 1。双就绪成功写一版；文档内去重清空失败也写；对账失败写当时对账、不标双就绪。不按 stage 写报告。
- 2026-08-30 用户确认落盘（`/wayfinder 继续`）：关本工单；建 [入库报告最小闭环](./22-ingest-report-min.md)。
