# 裁定替代联动后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 66

## Question

[替代联动最小闭环](./66-supersede-link-min.md) 完成后（本张创建时仍 blocked）。POST supersede 写两列，后继升 active，旧文关默认检索。PATCH lifecycle 仍可无后继废止。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- DELETE / 三存对齐 / purge 不并进已关工单
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- P4 可动手代码真空已尽
- P5 OCR 开闸 / 历史重跑切边不并进已关工单

候选：

1. **在线编写余量**：BlockNote、editor-draft、web 用户编辑器
2. **P5 余量**：真 OCR 引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe
3. **回头 P3b 余量**（须先解锁站规）
4. **本图暂停执行**，等图外 L2 人签或真 OCR 引擎选型
5. **回头 P4 人签/面板雾**

本工单只锁顺序与切边，不写产品代码。

## Answer

替代联动最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **删除与 purge**：[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 与后续生效区间 / 替代联动工单划出后未回补。功能表 §5.2 文档读写含 DELETE；ADR-020 / 存储边界：PG 软删/archived → 入队 purge → 删 ES/Mongo/RustFS。仓内无 `DELETE /documents/:docId`，无 `purge` 逻辑 stage，PATCH archived 只改 lifecycle。这不是重开第三批收官，是收「后批」从未落地的删除闸。

不并进：PG 文档行硬删、PG chunk/embedding 行清扫、HTTP ES deleteByQuery（B8）、operator 删自己上传的独立码、ingest_jobs 转换账全表、BlockNote。

本图 **补删除与 purge 最小闭环**。

本批一张：

- [删除与 purge 最小闭环](./68-document-delete-purge-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2、PG 硬删与 chunk 清扫、HTTP ES purge。

未改产品代码。

## Comments

- 2026-09-14 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包（真引擎是选型）。不选 3。不选 4。不选 5。本批补删除与 purge。
- Q2：一张工单。DELETE HTTP + archived + 入队 purge + worker mock 适配器 + admin 按钮。PATCH archived 仍不入队。
- Q3：`DELETE /documents/:docId`，无 body，码 `doc.lifecycle`（WhenEnforced）。先 PG archived，再入队 `stage=purge`。`isDefaultRetrievable` 不改。
- Q4：缺文档 404。已 archived 仍可入队 purge（幂等）。在途入库不 409（worker 同 doc 锁）。无新权限码。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
