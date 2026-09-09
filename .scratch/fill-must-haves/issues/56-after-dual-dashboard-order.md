# 裁定双轨看板后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
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

## Answer

双轨看板之后，**P4 可动手代码真空已尽**：再认证仍是图外人签（零钩子）；数据面板增强是 Grafana/时序雾（B6 信封已冻）。**在线编写留雾**。P3b 余量仍锁。**不暂停**等人签（人签不挡本图其余入场项）。

本图 **转向 P5**。本批只做 OCR 开闸最小闭环。功能表入场：目的地已含 P5 OCR；ADR-043 默认 P5 开闸（不是提前启用）。默认开关仍关；无引擎不得假抽正文；不接 Cloud OCR；不加真 Tesseract 依赖。

本批一张：

- [OCR 开闸最小闭环](./57-ocr-gate-min.md) — 开放前沿。`INGEST_OCR_ENABLED` 默认 false；逻辑 stage `ocr`；可注入抽取器。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（再认证 / 面板增强 / tau* 接运行时 / live judge / Grafana）、P5 其余（容量、熔断生产调优、在线抽样、CoVe / 超长异步、真 OCR 引擎）。

未改产品代码。

## Comments

- 2026-09-09 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 5。转向 P5。不继续 P4 余量（人签/雾）。在线编写留雾。不回头解 P3b。不暂停。
- Q2：本批只做 OCR 开闸。不是真引擎、不是 Cloud OCR、不是默认开。
- Q3：一张工单。开关 + 逻辑 stage + 注入抽取器。关路径保持 `needs_ocr` + `NO_TEXT_LAYER`。
- Q4：低置信 → `needs_review` + `OCR_LOW_CONFIDENCE`，不得 ready。无抽取器 → `OCR_UNAVAILABLE`，不得假正文。
- Q5：staging/prod 开闸无 `INGEST_OCR_ADR_REF` 只告警可启动（对照缺引擎不挡 P2 启动）。默认开强制 / 角色码仍锁。
