# 裁定敏感解禁后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 45

## Question

[敏感解禁最小闭环](./45-sensitive-complete-unlock-min.md) 已 `resolved`。sensitive complete 在 ACL 就绪时放行：部门路径（强制 ∧ 归属）或名单路径（`aclPrincipals != null`）。`null` 仍挡。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- 敏感解禁切边（默认开强制 / 把 null 当就绪 / 上传表单名单 / 角色码）不并进已关工单

候选：

1. **P3b 余量**：仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal
2. **在线编写**（P2.x 完整体验）
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

敏感解禁之后，**在线编写留雾**（P2.x，不并进）。P3b 可动手的最小闭环已齐（部门 ES 对称、aclPrincipals、ES principals、敏感解禁）。余下两项本图继续锁：仓库默认开 `DEPT_ACL_ENFORCE`（会打破 AE3 P2 兼容，不是缺代码）、角色 principal（`uuid[]` 装不下 `role:`，命名空间仍雾）。**不暂停**等人签。本图转向 **P4**。本批只做 L1 Hit@k 最小闭环。不做 τ 扫描 / AUROC / 再认证流程 / 多模型 fallback / 双轨看板 / 数据面板增强。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [L1 Hit@k 最小闭环](./47-l1-hit-at-k-min.md) — 开放前沿。有非空 `expectedDocIds` 的题按 evidence `docId` 交集计 Hit@k；不改 2×2、不进 `signoffEligible`。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（再认证 / fallback / 双轨看板 / 面板增强）。

未改产品代码。

## Comments

- 2026-09-08 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 3。P3b 可动手最小闭环已齐。在线编写留雾。不暂停。转向 P4。
- Q2：本批只做 L1 Hit@k。人签仍图外。不做 τ 扫描 / AUROC / 再认证 HTTP / 多模型 fallback / 双轨看板。
- Q3：一张工单。纯函数 + CLI/worker 报告 + 内口 `evidenceDocIds` + admin 展示。
- Q4：无 expected 不计分；hit = 字符串全等交集；k = 该题 `evidence_snapshot` 条数。不改 2×2 / `signoffEligible`。
- Q5：不做逻辑 id 映射。默认开强制 / 角色码仍锁。
