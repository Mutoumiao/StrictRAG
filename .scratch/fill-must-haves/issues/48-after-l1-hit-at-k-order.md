# 裁定 L1 Hit@k 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 47

## Question

[L1 Hit@k 最小闭环](./47-l1-hit-at-k-min.md) 已 `resolved`。有非空 `expectedDocIds` 的 L1 题按 evidence `docId` 交集计 Hit@k；不改 2×2、不进 `signoffEligible`。逻辑 id 映射仍缺口。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- Hit@k 切边（逻辑 id 映射 / 改签字公式 / A 格下限）不并进已关工单

候选：

1. **P4 余量**：L1 门禁包人签与再认证、τ 扫描、Judge AUROC、多模型 fallback、双轨看板、数据面板增强
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规：默认开强制或角色 principal）
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

Hit@k 之后，**在线编写留雾**（P2.x，不并进）。P3b 余量仍锁（默认开强制会打破 AE3；角色 principal 命名空间仍雾）。**不暂停**等人签。本图继续 **P4**。本批只做 L1 τ 扫描最小闭环。不做 AUROC / 再认证流程 / 多模型 fallback / 双轨看板 / 数据面板增强。不新开 HTTP `tau_sweep` 入队。不写 `TAU_CLAIM`。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [L1 τ 扫描最小闭环](./49-l1-tau-sweep-min.md) — 开放前沿。L1 批跑按 `minSupport` 离线扫网格得 tau*；不改本跑 2×2、不进 `signoffEligible`、不写 env。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（AUROC / 再认证 / fallback / 双轨看板 / 面板增强）。

未改产品代码。

## Comments

- 2026-09-08 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续 P4。在线编写留雾。不回头解 P3b 站规。不暂停。
- Q2：本批只做 τ 扫描。人签仍图外。不做 AUROC / 再认证 HTTP / 多模型 fallback / 双轨看板。
- Q3：一张工单。纯函数 + 挂现有 L1 批跑 + 内口 `minSupport` + admin 展示。不新开 `tau_sweep` 入队。
- Q4：离线重阈；有分才翻转；tau* = 满足试点 coverageMin∧cRateMax 的最大网格 τ。不改本跑 2×2 / `signoffEligible`。
- Q5：不写 `TAU_CLAIM`。`unsupported_claims` 必须带回 minSupport。默认开强制 / 角色码仍锁。
