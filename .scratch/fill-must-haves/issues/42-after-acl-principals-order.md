# 裁定 aclPrincipals 全文最小闭环后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 41

## Question

[aclPrincipals 全文最小闭环](./41-acl-principals-min.md) 已 `resolved`。可空用户 uuid 数组可存可回读；缺省 null = 成员可读；显式 `[]` = 非超管不可读；列表 / 详情 / chunks / retrieve 语料同滤；不跟部门强制开关。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是敏感解禁。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- aclPrincipals 切边（角色码 / ES terms / 用 principals 替换部门闸 / 自动 reindex）不并进已关工单

候选：

1. **P3b 余量**：敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal、ES principals terms
2. **在线编写**（P2.x 完整体验）
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

aclPrincipals 全文最小闭环之后，**在线编写留雾**（P2.x，不并进）。本图继续 **P3b 余量**。本批只做 ES 查询期 principals 对称最小闭环。不默认打开 `DEPT_ACL_ENFORCE`、不做敏感解禁、不加角色 principal、不跳 P4、不等人签。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [ES 查询期 principals 对称最小闭环](./43-es-principals-query-filter-min.md) — 开放前沿。mapping/bulk 写可选 `aclPrincipals`；非超管查询期 `must_not exists` ∪ `term userId` 收窄；超管 bypass 不加该 clause。不跟部门强制开关。PG `filterDocsForAclPrincipals` 仍把关。切边见该工单正文。

仍留雾：敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal、在线编写。

未改产品代码。

## Comments

- 2026-09-08 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续 P3b 余量。在线编写留雾（P2.x）。不跳 P4、不暂停。
- Q2：本批只做 ES 查询期 principals 对称。不默认开 enforce、不解禁、不加角色码。B2 上敏感库前必签；解禁仍挂文档 ACL 之后且 complete 闸语义不改。
- Q3：一张工单。worker/api mapping + bulk 写字段 + 查询期 bool should。PG 可见级闸不拆掉。改名单不自动 reindex。
- Q4：缺字段 / 不写 = 未设（成员可读，ES 用 must_not exists 纳入）；显式 `[]` 写入空数组（非超管不可命中）；名单含当前 userId 用 term 纳入。超管 `roleBypassesKbMembership` 不加 principals clause。
- Q5：显式名单不跟 `DEPT_ACL_ENFORCE`（与 PG 闸一致）。角色 principal / 默认开强制 / 敏感解禁留雾。
