# 裁定 ES 查询期 principals 对称后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
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
