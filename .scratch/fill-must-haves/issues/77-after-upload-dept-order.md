# 裁定上传表单标部门后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 76

## Question

[上传表单标部门最小闭环](./76-upload-dept-fields-min.md) 完成后（本张创建时仍 blocked）。创建面可标部门 / 可见级。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- 上传标部门切边（MD/TXT 更严体积 / 魔数嗅探 / 上传标类型 / 新部门列表口 / paramSchema 动态表单）不并进已关工单
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

上传表单标部门最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **KB 消费绑定分区**。功能表 §4.2 / §5.2 / ADR-055：知识库只可覆盖 generate / embed / rerank，可跟随平台，**禁止改 judge\***。仓内 PUT `…/model-bindings` 复用平台 schema，可写 judge；`replaceKbBindings` 整表替换；设置页只有 embed 手填 Input，保存 `{ embed }` 会抹掉其它 purpose。这不是重开第三批收官，是收「后批」从未落地的 KB 消费绑定闸。

不并进：再认证、平台绑定页改版、`GENERATE_MIN_NODES`、paramSchema 动态表单、BlockNote。

本图 **补 KB 消费绑定最小闭环**。

本批一张：

- [KB 消费绑定最小闭环](./78-kb-consume-bindings-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余、B8 / B9 / QUAL-2、MD/TXT 更严体积、魔数嗅探、paramSchema 动态表单、跨文档去重、反馈回流黄金集。

未改产品代码。

## Comments

- 2026-09-15 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包。不选 3。不选 4。不选 5。本批补 KB 消费绑定。
- Q2：一张工单。PUT 只收 generate/embed/rerank；其它 purpose（含 judge）400。空 purpose = 跟随平台（不写行）。设置页三档 ClosedSelect。
- Q3：PUT 仍是该库消费绑定整表替换，但 body 不得含禁写 purpose。admin 保存发三档当前态，空档不进 map。
- Q4：目录 GET 403 时 ClosedSelect 仅「跟随平台」+ 当前已绑 ref，不新开手填。不改平台绑定页。不改 catalog 权限。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
