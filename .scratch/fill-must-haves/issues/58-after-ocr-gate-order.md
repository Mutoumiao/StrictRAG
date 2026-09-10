# 裁定 OCR 开闸后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 57

## Question

[OCR 开闸最小闭环](./57-ocr-gate-min.md) 已 `resolved`。`INGEST_OCR_ENABLED` 默认关；逻辑 stage `ocr`；可注入抽取器；低置信 `needs_review` 且不留可 chunk 正文。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- P4 可动手代码真空已尽
- OCR 开闸切边（真引擎 / Cloud / 默认开 / 历史 needs_ocr 自动重跑 / 过短 utf8 用 OCR 洗 ready）不并进已关工单

候选：

1. **P5 余量**：真 OCR 引擎接线、历史 `needs_ocr` 重跑、敏感 KB Cloud 策略、容量 / 熔断生产调优、在线抽样、CoVe / 超长异步
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规）
4. **本图暂停执行**，等图外 L2 人签或真 OCR 引擎选型
5. **回头 P4 人签/面板雾**（须先确认那是代码缺口）

本工单只锁顺序与切边，不写产品代码。

## Answer

OCR 开闸之后，**P5 仍有一张可动手代码真空**：历史 `needs_ocr` 没有运营重跑入口。现有 `POST …/reindex` 一律入队 `chunk`；chunk 已拒 `needs_ocr` / `needs_review`，开闸后卡住的扫描件无法进 `ocr`。这不是真引擎选型，也不是仓库默认开。

**在线编写留雾**。P3b 余量仍锁。P4 人签 / 面板增强仍不是代码缺口。**不暂停**等人签或引擎选型（人签与 Tesseract/Cloud 不挡本张入场项）。

本图 **继续 P5**。本批只做历史 `needs_ocr` 重跑最小闭环。不是真引擎、不是 Cloud OCR、不是默认开、不是 worker 启动自动全库重跑、不是用 OCR 洗短 utf8 页眉。

本批一张：

- [历史 needs_ocr 重跑最小闭环](./59-ocr-rerun-min.md) — 开放前沿。`needs_ocr`（非 utf8 文本层）与 `needs_review` 走现有 reindex 入队 `ocr`；成功才按今日 chunk 抬 `indexVersion` 走双就绪。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（再认证 / 面板增强 / tau* 接运行时 / live judge / Grafana）、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 熔断生产调优 / 在线抽样 / CoVe）。

未改产品代码。

## Comments

- 2026-09-10 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1 的可动手切片。继续 P5。在线编写留雾。不回头解 P3b。不暂停。不回头 P4 人签/面板雾。
- Q2：本批只做 Q7 运营触发重跑。不是真引擎、不是 Cloud、不是默认开、不是启动自动全库。
- Q3：一张工单。现有 reindex 按文档状态入队 `ocr` 或 `chunk`。无新 HTTP、无新物理队列。
- Q4：`needs_review` 同入口；`extractMethod=text` 的短 utf8 仍入队 chunk（Q3 不洗）。失败不抬 version。关闸时 worker 打回 `needs_ocr`。
- Q5：默认开强制 / 角色码 / 默认开 OCR 仍锁。
