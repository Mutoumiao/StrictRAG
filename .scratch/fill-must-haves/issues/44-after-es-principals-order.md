# 裁定 ES 查询期 principals 对称后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 43

## Question

[ES 查询期 principals 对称最小闭环](./43-es-principals-query-filter-min.md) 已 `resolved`。mapping/bulk 写 `aclPrincipals`；显式空写哨兵；非超管查询期 should 收窄；不跟部门强制开关。PG 名单闸仍把关。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是敏感解禁。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- ES principals 切边（哨兵 / PUT mapping / 用 ES 替换 PG 闸 / 自动 reindex）不并进已关工单

候选：

1. **P3b 余量**：敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal
2. **在线编写**（P2.x 完整体验）
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

ES 查询期 principals 对称之后，**在线编写留雾**（P2.x，不并进）。本图继续 **P3b 余量**。本批只做敏感解禁最小闭环。不默认打开 `DEPT_ACL_ENFORCE`、不加角色 principal、不跳 P4、不等人签。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

文档 ACL 用户 uuid 最小 + ES 查询期对称已齐，原先「解禁挂在文档 ACL 之后」的前置已满足。解禁只放宽 complete 闸的 **ACL 就绪** 判定，不改检索过滤。

ACL 就绪 = 部门路径（`deptAclEnforce` ∧ 非空 `ownerDeptId`）**或** 名单路径（`aclPrincipals != null`）。`null` / 缺字段仍挡。不得把功能落地当成全局解禁。

本批一张：

- [敏感解禁最小闭环](./45-sensitive-complete-unlock-min.md) — 开放前沿。sensitive complete 在 ACL 就绪时放行；complete body 可同写 `aclPrincipals`。切边见该工单正文。

仍留雾：仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal、在线编写。

未改产品代码。

## Comments

- 2026-09-08 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续 P3b 余量。在线编写留雾（P2.x）。不跳 P4、不暂停。
- Q2：本批只做敏感解禁。不默认开 enforce、不加角色码。角色 principal 仍要改 uuid[] 列与角色命名空间，留雾。
- Q3：一张工单。只改 complete 闸与可选 body 写名单。检索/列表/ES 不改。
- Q4：部门路径保持；名单路径 `aclPrincipals != null`（`[]` 与 uuid 列表都算已设）。`null` 仍挡。
- Q5：complete 可同请求写名单（与 ownerDeptId 对称）。上传表单名单控件划出。
