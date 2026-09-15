# 裁定反馈回流黄金集后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-agent
Blocked by: 84

## Question

[反馈回流黄金集最小闭环](./84-feedback-promote-gold-min.md) 完成后（本张创建时仍 blocked）。运营可把 open 反馈纳入 `gold_questions`；用户提交不得直写黄金集。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal、不是 QUAL-G3 gold.yaml 审核闸。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 用户编辑器）仍是 P2.x 余量
- 反馈回流切边（gold.yaml / 自动入队评测 / 改 2×2 / 再认证）不并进已关工单
- L0/contextMode 切边（真 L1 Gateway / 通用表单引擎）不并进已关工单
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
