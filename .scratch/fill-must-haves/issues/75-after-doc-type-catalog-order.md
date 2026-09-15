# 裁定类型分区 CRUD 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 74

## Question

[类型分区 CRUD 最小闭环](./74-doc-type-catalog-min.md) 完成后（本张创建时仍 blocked）。设置可维护 code / 显示名 / 排序 / 启用；成员 GET 只见启用项。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- 类型分区切边（上传表单标部门 / MD/TXT 更严体积 / 魔数嗅探 / 独立写资源 / 新表）不并进已关工单
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

类型分区 CRUD 最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **上传表单标部门**：[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 与后续工单划出后未回补。功能表 §4.3：上传 / 编辑 / 列表可标所属部门、可见级别（**P2 字段**；检索强制仍 P3b）。仓内 complete / write 契约已收 `ownerDeptId` / `visibilityLevel`；列表与行展开可 PATCH；admin 上传只传策略 + checksum，编写只传 title / markdown / 策略，创建路径不能标。这不是重开第三批收官，是收「后批」从未落地的创建面字段。

不并进：MD/TXT 更严体积档、魔数嗅探、上传标类型、aclPrincipals 创建面、新部门列表口、paramSchema 动态表单、BlockNote。

本图 **补上传表单标部门最小闭环**。

本批一张：

- [上传表单标部门最小闭环](./76-upload-dept-fields-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2、MD/TXT 更严体积档、魔数嗅探、paramSchema 动态表单、PG 硬删与 HTTP ES purge。

未改产品代码。

## Comments

- 2026-09-15 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包（真引擎是选型）。不选 3。不选 4。不选 5。本批补上传表单标部门。
- Q2：一张工单。admin 上传与在线编写创建面可标 `ownerDeptId` / `visibilityLevel`，complete / write 带上已有字段。新下拉走 ui `ClosedSelect`。复用现有 `GET /departments`（仍要 `dept.manage`）。不新开部门列表口。
- Q3：可空。空归属 = 库级 `null`。可见级默认 20（列默认）。无 `dept.manage` 时创建面只留库级，不新开 uuid 粘贴。不强制必填。
- Q4：列表 / 行展开 PATCH 不改。不默认开 `DEPT_ACL_ENFORCE`。不把详情页既有原生 `<select>` 并进本张。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
