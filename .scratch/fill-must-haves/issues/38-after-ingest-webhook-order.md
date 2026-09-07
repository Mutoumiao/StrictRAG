# 裁定失败 Webhook 最小闭环后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 37

## Question

[失败 Webhook 最小闭环](./37-ingest-failure-webhook-min.md) 已 `resolved`。入库阶段账本失败会向可选 URL POST `ingest.failed`；空 URL 为无操作；失败不阻断状态机。剩余 P2 半接线只剩在线编写（完整体验 P2.x）。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x（BlockNote / 草稿协议），不是本图当前必须具备真空
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- Webhook 切边（HMAC / 重试 / ask 失败）不并进已关工单

候选：

1. **在线编写**（P2.x 完整体验）
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

失败 Webhook 之后，**在线编写留雾**（P2.x，不并进）。本图转向 **P3b**。本批只做 ES 查询期部门对称最小闭环。不默认打开 `DEPT_ACL_ENFORCE`、不做敏感解禁、不做 aclPrincipals 全文用户列表、不跳 P4、不等人签。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [ES 查询期部门对称最小闭环](./39-es-dept-query-filter-min.md) — 开放前沿。enforce 开时 ES 用 `ownerDeptId` terms 收窄；关时仍只 tenantId+kbId。精确可见级仍由现有 PG `filterDocsForDeptAcl` 把关。切边见该工单正文。

仍留雾：在线编写、aclPrincipals 全文、敏感解禁、仓库默认开强制。

未改产品代码。

## Comments

- 2026-09-07 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 2。在线编写留雾（P2.x）。转向 P3b。不跳 P4、不暂停。
- Q2：本批只做 ES 查询期部门对称。不默认开 enforce、不解禁、不做 principals 全文。
- Q3：一张工单。worker 写 ownerDeptId + mapping + query terms。PG 可见级闸不拆掉。
- Q4：enforce 关：query 仍只 tenantId+kbId。超管 bypass：不追加部门 terms。
- Q5：无部门归属的文档：enforce 开时 ES 不靠 ownerDeptId 命中（缺字段不得当全员可见）；PG 仍按现函数。
- 2026-09-07 自行确认落盘：关本工单；建 [ES 查询期部门对称最小闭环](./39-es-dept-query-filter-min.md)。
