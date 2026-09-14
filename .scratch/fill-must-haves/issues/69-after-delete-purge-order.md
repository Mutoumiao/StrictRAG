# 裁定删除与 purge 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 68

## Question

[删除与 purge 最小闭环](./68-document-delete-purge-min.md) 完成后（本张创建时仍 blocked）。DELETE 写 archived 并入队 purge；worker mock 适配器清对象 / mock ES / 可选 Mongo。PATCH archived 仍不入队。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- DELETE 切边（PG 硬删 / chunk 清扫 / HTTP ES deleteByQuery / 独立删码）不并进已关工单
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

删除与 purge 最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **文档类型成员面**：[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 划出独立 `GET /doc-types` 后未回补。功能表 §5.2 / ADR-050 / HTTP §2.5.2：成员可读 `GET …/doc-types`；ask `scope.docTypes` 过滤必须进 retrieve。设置 GET 仍要 `kb.config.write`，成员没有枚举口。web 现为自由逗号输入。另：双闸后仍有现行文档、类型收窄后语料为空时，retrieve 现误标 `kb_not_ready`；功能表 §5.4 步骤 8 要求细分 `no_docs_in_scope`。这不是重开第三批收官，是收「后批」从未落地的类型成员闸。

不并进：类型分区 CRUD、上传表单标部门、MIME 白名单、ES `doc_type` terms、dense 查询期 WHERE、多选勾选组、BlockNote。

本图 **补文档类型成员面最小闭环**。

本批一张：

- [文档类型成员面最小闭环](./70-doc-types-member-surface-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2、类型分区 CRUD、上传表单标部门、PG 硬删与 HTTP ES purge。

未改产品代码。

## Comments

- 2026-09-14 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包（真引擎是选型）。不选 3。不选 4。不选 5。本批补文档类型成员面。
- Q2：一张工单。GET /doc-types 成员可读 + `no_docs_in_scope` + web ClosedSelect 消费 GET。设置 GET 仍要 config.write。
- Q3：响应 `{ items: [{ code, label }] }`；label 暂等于 code（设置只存码）。空枚举 `items: []`。web 单选或不收窄；不建多选勾选组。
- Q4：双闸+窗口后仍有现行文档、类型 scope 滤空 → `no_docs_in_scope`，禁止再标 `kb_not_ready`。无 scope 或双闸已空仍 `kb_not_ready`。ACL 滤空不改。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
