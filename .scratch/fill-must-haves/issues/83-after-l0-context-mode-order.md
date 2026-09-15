# 裁定 L0/contextMode 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 82

## Question

[L0 模板真用快照 / contextMode 单控件最小闭环](./82-l0-context-mode-min.md) 完成后（本张创建时仍 blocked）。运营可把 `contextMode` 打到 `l0_template` 且 worker 服从；`l1_llm` 本轮诚实回退 L0。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- L0/contextMode 切边（真 L1 Gateway / 通用表单引擎 / chunkTokens 消费）不并进已关工单
- 跨文档去重切边（pending_review / downrank / 跨 KB / 生产 LSH）不并进已关工单
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

L0 模板 / contextMode 单控件最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **反馈回流黄金集**。功能表 §4.1 / §12.4：队列「回流补库或黄金集」，纳入后走 `eval.run`。ADR-019：任意 ask 可 feedback，回流黄金集须测试/产品审核。API PRD §2.6：`promoted_to_gold`（须审核）。源码枚举与 PATCH 已有该状态，但只改 `ask_feedback.status`，不 INSERT `gold_questions`；admin 队列无「纳入黄金集」按钮。评测底线已能手建题，缺的是反馈→黄金集闭环，不是重开 12，也不是写 `fixtures/l1/gold.yaml`（QUAL-G3 工程种子审核仍图外）。

不并进：真 L1 Gateway、通用表单引擎、角色树状勾选、参数快照只读审计、断线重拉、签字包链、入场 `aclPrincipals`、自动入队评测、改 2×2、再认证。

本图 **补反馈回流黄金集最小闭环**。

本批一张：

- [反馈回流黄金集最小闭环](./84-feedback-promote-gold-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余、B8 / B9 / QUAL-2、MD/TXT 更严体积、魔数嗅探、真 L1 contextualize、角色树状勾选、参数快照只读审计、断线重拉、签字包链、入场 `aclPrincipals`、`pending_review`、QUAL-G3 gold.yaml 审核闸。

未改产品代码。

## Comments

- 2026-09-15 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包。不选 3。不选 4。不选 5。本批补反馈回流黄金集。
- Q2：一张工单。PATCH `promoted_to_gold` 必须 INSERT `gold_questions`。禁止只改状态装齐。禁止写 gold.yaml。禁止自动入队 eval/runs。
- Q3：题面 = 当时 ask `standaloneQuestion`（非空）否则 `rawQuestion`。comment 只进 rubric。无题面不得晋升。`caseKey=fb-{feedbackId}`。`expectedDocIds` 不抄 evidence。
- Q4：晋升须带 `goldType`（ClosedSelect：可答 / 不可答 / 错误前提）。无类型 400。admin 无 `eval.run` 不展示纳入按钮；API 晋升另验 `eval.run`。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
