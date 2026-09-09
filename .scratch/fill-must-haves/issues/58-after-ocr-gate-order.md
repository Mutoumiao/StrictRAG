# 裁定 OCR 开闸后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
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
