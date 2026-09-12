# 裁定历史 needs_ocr 重跑后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 59

## Question

[历史 needs_ocr 重跑最小闭环](./59-ocr-rerun-min.md) 已 `resolved`。现有 reindex 对卡在 OCR 闸的扫描件入队 `ocr`；短 utf8 页眉仍不洗 ready；失败不抬 `indexVersion`。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- P4 可动手代码真空已尽
- OCR 开闸 / 历史重跑切边（真引擎 / Cloud / 默认开 / 启动自动全库 / 过短 utf8 用 OCR 洗 ready）不并进已关工单

候选：

1. **P5 余量**：真 OCR 引擎接线、敏感 KB Cloud 策略、启动自动全库重跑、容量 / 熔断生产调优、在线抽样、CoVe / 超长异步
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规）
4. **本图暂停执行**，等图外 L2 人签或真 OCR 引擎选型
5. **回头 P4 人签/面板雾**（须先确认那是代码缺口）

本工单只锁顺序与切边，不写产品代码。

## Answer

历史 needs_ocr 重跑之后，**P5 可动手代码真空已尽**。OCR 开闸与运营 reindex 入队 `ocr` 已齐（默认关）。真引擎 / Cloud 是选型，不是卡住的产品路径。启动自动全库仍锁。容量 / 熔断生产调优无产品数字会空转。在线抽样 / CoVe / 超长异步零接线，且不是本批 OCR 入场遗留。Q6（body 先于 manifest、无 ready 后 patch body）与 AA8（无 OCR 策略码即可选）源码已满足，覆盖表「延后」落后。`dogfood_ocr` 字段 / docs-guard / extract 超时是测或标签，不是第二套状态机。

**在线编写留雾**。P3b 余量仍锁。P4 人签 / 面板增强仍不是代码缺口。

本图 **暂停执行**。等图外 L2 人签或真 OCR 引擎选型。不并进真引擎接线、不默认开、不自动全库、不洗短 utf8、不单开补测工单冒充真空。

无本批执行工单。前线空：目的地未达，等人签 / 选型 / 解锁站规后再开下一张。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（再认证 / 面板增强 / tau* 接运行时 / live judge / Grafana）、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 熔断生产调优 / 在线抽样 / CoVe）、B8 / B9 / QUAL-2。

未改产品代码。

## Comments

- 2026-09-12 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 4。P5 可动手真空已尽。在线编写留雾。不回头解 P3b。不回头 P4 人签/面板雾。不把引擎 / Cloud / 抽样 / CoVe 当本批代码刀。
- Q2：不新开执行工单。Q6 / AA8 不单开补测。不接 mock 抽取器到生产 `index.ts`。
- Q3：`dogfood_ocr` 不塞进现有八态 `opsLabel`。无功能表行则不加列。
- Q4：默认开强制 / 角色码 / 默认开 OCR / 启动自动全库仍锁。
- Q5：目的地未达；地图保持 open。前线空 = 等人签或真 OCR 引擎选型，不是本图已走完。
