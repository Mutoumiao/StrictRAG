# 裁定 KB 消费绑定后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 78

## Question

[KB 消费绑定最小闭环](./78-kb-consume-bindings-min.md) 完成后（本张创建时仍 blocked）。KB PUT 只收 generate/embed/rerank；设置页三档 ClosedSelect。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- KB 绑定切边（再认证 / 平台绑定页 / catalog 权限 / fallbacks 多行 / paramSchema）不并进已关工单
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

KB 消费绑定最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **同 KB 跨文档去重**：[入库报告最小闭环](./22-ingest-report-min.md) 只写真事并显式省略跨 doc。功能表 §5.4 / §6 与入库 PRD §5：文档内必做，**同 KB 跨文档默认 on**，默认动作 `skip_index`，报告须能点开冲突对，禁止无提示静默丢条款。仓内只做文档内 `toLowerCase` 字符串 Set；报告契约拒绝 `crossDocDropped`；`chunks` 无 `searchable` / `duplicate_of`。重复条款会占满 Top-K。这不是重开 22，是收从未落地的默认 on 闸。

不并进：`pending_review` 人工二选一、`downrank`、跨 KB、MinHash LSH 生产索引、L0 vs L1 Hit@k、paramSchema 表单、BlockNote。

本图 **补同 KB 跨文档去重最小闭环**。

本批一张：

- [同 KB 跨文档去重最小闭环](./80-cross-doc-dedupe-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余、B8 / B9 / QUAL-2、MD/TXT 更严体积、魔数嗅探、paramSchema `contextMode` 真开关、反馈回流黄金集、角色树状勾选、`pending_review`、生产 LSH。

未改产品代码。

## Comments

- 2026-09-15 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包。不选 3。不选 4。不选 5。本批补同 KB 跨文档去重。
- Q2：一张工单。默认 `skip_index`；入库报告写冲突对与跨 doc dropped。近重复用字 3-gram Jaccard≥0.9（无新依赖）。不并进 pending_review。
- Q3：只比同 KB、他文档、当前 version、`status=ready` 且 lifecycle 为 draft/active。不比 archived/superseded（避免替代文被旧文挡住）。跨 KB 不比。
- Q4：skip 的块不进 manifest / 不 embed / 不 ES。冲突对记 otherDocId + otherChunkId + action。searchable 被清空仍不得 ready。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
