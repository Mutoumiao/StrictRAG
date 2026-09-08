# 裁定 L1 τ 扫描后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
Blocked by: 49

## Question

[L1 τ 扫描最小闭环](./49-l1-tau-sweep-min.md) 已 `resolved`。L1 批跑按 `minSupport` 离线扫网格得 tau*；不改 2×2、不进 `signoffEligible`、不写 `TAU_CLAIM`、不新开 `tau_sweep` 入队。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- Hit@k / τ 扫描切边（逻辑 id 映射 / 写 env / 改签字公式 / 独立 `tau_sweep` 入队）不并进已关工单

候选：

1. **P4 余量**：L1 门禁包人签与再认证、Judge AUROC、多模型 fallback、双轨看板、数据面板增强
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规：默认开强制或角色 principal）
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。
