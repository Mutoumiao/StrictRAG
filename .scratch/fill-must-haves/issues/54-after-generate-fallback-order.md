# 裁定 generate fallback 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 53

## Question

[generate 多模型 fallback 最小闭环](./53-generate-fallback-min.md) 已 `resolved`。绑定 generate `fallbacks` 在 ask 运行时 opt-in 切链；切到备用才 `fallbackUsed=true`；无 `GENERATE_MIN_NODES`；图层不二次计费。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- Hit@k / τ 扫描 / AUROC / generate fallback 切边（逻辑 id 映射 / 写 env / 改签字公式 / 独立 `tau_sweep` 或 `verifier_calib` 入队 / live judge 真跑 / `GENERATE_MIN_NODES` / `fallbackUsed` 进图）不并进已关工单

候选：

1. **P4 余量**：L1 门禁包人签与再认证、双轨看板、数据面板增强
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规：默认开强制或角色 principal）
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

generate fallback 之后，**在线编写留雾**（P2.x，不并进）。P3b 余量仍锁。**不暂停**等人签。本图继续 **P4**。本批只做双轨看板最小闭环（剧本 I4）。

不做再认证（源码零钩子，本质图外人签）。不做「数据面板增强」（B6 信封冻结 ≤5，Grafana/时序是雾）。不回头解 P3b 站规。不把 tau* 接到运行时、不写 `TAU_CLAIM`、不新开 `verifier_calib`、不接签字公式、不加 `GENERATE_MIN_NODES`。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [双轨看板最小闭环](./55-dual-dashboard-tracks-min.md) — 开放前沿。admin `/dashboard` 质量 / 延迟两个只读区块；新 GET 不改 B6 `DashboardSummary`。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（再认证 / 面板增强 / 把 tau* 接到运行时 / live judge 真跑 / 独立 `tau_sweep`·`verifier_calib` 入队）。

未改产品代码。

## Comments

- 2026-09-09 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续 P4。在线编写留雾。不回头解 P3b 站规。不暂停。
- Q2：本批只做双轨看板。人签/再认证仍图外。不做数据面板增强、不塞 B6。
- Q3：一张工单。新 tracks GET + admin 两区块。质量读最近一笔成功 L1；延迟读 24h `ask_traces.latency_ms`。≠ APM / ≠ 准出。
- Q4：`dashboard.view` 即可；不要求 `eval.run`。不展示 `signoffEligible` / `businessPass`。
- Q5：默认开强制 / 角色码仍锁。不写 `TAU_CLAIM`。
