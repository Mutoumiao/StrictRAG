# 裁定在线编写后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 62

## Question

[在线编写最小闭环](./62-online-write-min.md) 已 `resolved`。运营可在文档页提交 Markdown，`sourceType=write`，进 pending，不入队 scan。无 BlockNote。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
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

在线编写最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**（P2 分期可以没有）。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户刚否决过「等人签或选型才暂停」；五选一里 1/2/3/5 都不是卡住的产品路径，4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **生效区间**：列已有，检索谓词未滤，PATCH 不能写。功能表 §5.4 默认检索谓词含 `effective_from` / `effective_to`。[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 划成后批，[检索语义补钉](./09-retrieval-semantics-patch.md) 再次划出，之后未回补。这不是重开第三批收官，是收「后批」从未落地的检索闸。

不并进：在线抽样（监控，不挡 ask）、CoVe、容量 L（ADR-017 待决）、断线重拉、DELETE / 替代联动、dense 查询期 WHERE、ES 新 terms。

本图 **补生效区间最小闭环**。

本批一张：

- [生效区间最小闭环](./64-effective-window-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2。

未改产品代码。

## Comments

- 2026-09-12 按交接认领。用户授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包（真引擎是选型；抽样是监控）。不选 3。不选 4。不选 5。本批补生效区间。
- Q2：一张工单。PG 语料闸 + PATCH 可写两字段 + admin 文档页可填。
- Q3：叠在 `filterDocsForRetrieve`；`isDefaultRetrievable` 仍只 ready∧active。无 ES terms，无 dense WHERE。
- Q4：两字段皆空=不限。`from <= now` 且（`to` 空或 `to > now`）。`from > to` → 400。格式 `yyyy-MM-dd HH:mm:ss`。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
