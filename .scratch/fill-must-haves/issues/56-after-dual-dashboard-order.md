# 裁定双轨看板后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
Blocked by: 55

## Question

[双轨看板最小闭环](./55-dual-dashboard-tracks-min.md) 已 `resolved`。admin `/dashboard` 质量 / 延迟两个只读区块；新 GET tracks 不改 B6 summary 信封；质量来自最近一笔成功 L1 工程账本（≠ 准出）；延迟为 24h avg/p95。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- Hit@k / τ 扫描 / AUROC / generate fallback / 双轨看板切边（逻辑 id 映射 / 写 env / 改签字公式 / Grafana / 塞 B6 / `GENERATE_MIN_NODES`）不并进已关工单

候选：

1. **P4 余量**：L1 门禁包人签与再认证、数据面板增强
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规：默认开强制或角色 principal）
4. **本图暂停执行**，等图外 L2 人签
5. **转向 P5**（OCR 开闸等；须先确认功能表入场是否已到）

本工单只锁顺序与切边，不写产品代码。
