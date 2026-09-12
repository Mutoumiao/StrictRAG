# 裁定暂停后继续走哪条

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 60

## Question

[裁定历史 needs_ocr 重跑后下一步](./60-after-ocr-rerun-order.md) 曾锁 **本图暂停执行**。用户现要求继续 wayfinder，视为解除暂停，不是 L2 人签，也不是真 OCR 引擎选型。

已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- P3a 仍等 L2 人签（图外；继续 ≠ 人签）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- P4 可动手代码真空已尽
- P5 OCR 开闸 / 历史重跑切边（真引擎 / Cloud / 默认开 / 启动自动全库 / 过短 utf8 用 OCR 洗 ready）不并进已关工单
- 继续 ≠ 接 Tesseract/Cloud、≠ 默认开 rewrite

候选：

1. **P5 余量**（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）
2. **在线编写**（P2.x 完整体验里可动手的最小页+HTTP）
3. **回头 P3b 余量**（须先解锁站规）
4. **再暂停**
5. **回头 P4 人签/面板雾**

本工单只锁顺序与切边，不写产品代码。

## Answer

暂停已解除。P5 可动手真空仍尽；真引擎仍要选型。P3a 仍等人签。P3b / P4 人签站规仍锁。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **在线编写**：审批闸已有，页与提交 HTTP 没有。`doc.editor` 文案已是「编写与提交发布」；`sourceType` 默认 `upload`；仓内无 BlockNote。

本图 **补在线编写最小闭环**。不是 BlockNote，不是草稿协议，不是 web 用户编辑器，不是跳过审批 / scan。Markdown 正文由服务端落对象，`sourceType=write`，进现有 pending → 审批 → scan。

本批一张：

- [在线编写最小闭环](./62-online-write-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2。

未改产品代码。

## Comments

- 2026-09-12 用户要求继续 wayfinder，按解除暂停认领。
- Q1：选 2。在线编写。不接真引擎。不回头解 P3b。不再暂停。不回头 P4。
- Q2：一张工单。无 BlockNote。无草稿 HTTP。无新菜单。
- Q3：`doc.editor` 写路径；`doc.upload` 仍只文件上传。不入队 scan。
- Q4：空正文 400。过短交给 worker 既有字数闸。敏感 complete 同闸。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 启动自动全库仍锁。
