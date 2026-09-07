# 裁定 ES 查询期部门对称后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 39

## Question

[ES 查询期部门对称最小闭环](./39-es-dept-query-filter-min.md) 已 `resolved`。enforce 开且非超管时 ES 用 `ownerDeptId` terms 收窄；关时仍只 tenantId+kbId；PG `filterDocsForDeptAcl` 仍把关可见级。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是敏感解禁。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- ES 部门 terms 切边（默认开强制 / 用 ES 替换 PG 可见级）不并进已关工单

候选：

1. **P3b 余量**：aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
2. **在线编写**（P2.x 完整体验）
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

ES 查询期部门对称之后，**在线编写留雾**（P2.x，不并进）。本图继续 **P3b 余量**。本批只做 aclPrincipals 全文最小闭环。不默认打开 `DEPT_ACL_ENFORCE`、不做敏感解禁、不跳 P4、不等人签。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [aclPrincipals 全文最小闭环](./41-acl-principals-min.md) — 开放前沿。可空用户 uuid 数组；缺省 null = KB 成员可读；显式 `[]` = 非超管不可读。列表 / 详情 / chunks / retrieve 语料同滤。不跟部门强制开关。切边见该工单正文。

仍留雾：敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal、ES principals terms、在线编写。

未改产品代码。

## Comments

- 2026-09-07 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续 P3b 余量。在线编写留雾（P2.x）。不跳 P4、不暂停。
- Q2：本批只做 aclPrincipals 全文最小闭环。不默认开 enforce、不解禁。B2 上敏感库前必签，解禁挂在文档 ACL 之后。
- Q3：一张工单。PG 列 + PATCH/回读 + 列表/详情/chunks/retrieve 同滤。ES terms / 角色码 / reindex-on-change 划出。
- Q4：缺省 null = 成员可读；显式 `[]` = 非超管不可读。显式名单不跟 `DEPT_ACL_ENFORCE`（宁拒勿妄）。超管 `roleBypassesKbMembership` 绕过。
- Q5：元素只用户 uuid。非法 uuid 400。超长数组 400。角色 principal / ES 对称 / 敏感解禁留雾。
- 2026-09-07 自行确认落盘：关本工单；建 [aclPrincipals 全文最小闭环](./41-acl-principals-min.md)。
