# 裁定跨文档去重后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 80

## Question

[同 KB 跨文档去重最小闭环](./80-cross-doc-dedupe-min.md) 完成后（本张创建时仍 blocked）。同 KB 近重复默认 skip_index，报告可点冲突对。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- 跨文档去重切边（pending_review / downrank / 跨 KB / 生产 LSH / Hit@k）不并进已关工单
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

同 KB 跨文档去重最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **L0 模板真用快照 + `contextMode` 单控件**。入库 PRD §4：L0 模板 `{doc_title} / {section_path}`（无路径仅标题）；关 L1 须显式 `contextMode=l0_template`，质量看板标「召回增强关闭」。功能表把按 schema 渲染 `contextMode` 冻成 P2 硬必须。仓内 prefix 写死 `` `${title} / section` ``；种子 `contextMode=l1_llm`；worker 不读快照；弹窗不渲染该控件。这是假开关，不是重开 06，也不是真跑 L1 Gateway。

不并进：真 L1 LLM / Gateway `contextualize`、通用 paramSchema 表单引擎、`chunkTokens`/`overlap` 消费、BlockNote、`pending_review`。

本图 **补 L0 模板真用快照 / contextMode 单控件最小闭环**。

本批一张：

- [L0 模板真用快照 / contextMode 单控件最小闭环](./82-l0-context-mode-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余、B8 / B9 / QUAL-2、MD/TXT 更严体积、魔数嗅探、真 L1 contextualize、反馈回流黄金集、角色树状勾选、参数快照只读审计、断线重拉、签字包链、入场 `aclPrincipals`、`pending_review`。

未改产品代码。

## Comments

- 2026-09-15 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包。不选 3。不选 4。不选 5。本批补 L0 快照 + contextMode 单控件。
- Q2：一张工单。worker 必须服从快照。禁止先做无效果表单引擎。禁止本张真跑 L1。
- Q3：L0 无小节路径时只用标题，禁止再写死「 / section」。`l1_llm` 本轮无 Gateway → 回退 L0 并记 `l0_fallback`，不得声称已跑 L1。
- Q4：admin 仅 `structure_paragraph` 一个 ClosedSelect；PATCH `paramOverrides.contextMode`；非法值 400。`l0_template` 时标「召回增强关闭」。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
