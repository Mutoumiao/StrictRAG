# 裁定上传 MIME 白名单后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 72

## Question

[上传 MIME 白名单最小闭环](./72-upload-mime-whitelist-min.md) 完成后（本张创建时仍 blocked）。complete 拒未知 MIME / octet-stream；checksum 可落库。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- MIME 切边（类型分区 CRUD / 上传表单标部门 / MD/TXT 更严体积 / 魔数嗅探）不并进已关工单
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

上传 MIME 白名单最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **类型分区 CRUD**：[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 与后续 GET /doc-types、MIME 工单划出后未回补。功能表 §4.2 / ADR-054：设置「文档类型」分区须 **code、显示名、排序、启用；增删改**。仓内 PATCH 只收 `string[]`，admin 是逗号串；GET /doc-types 的 `label` 暂等于 `code`；无停用（只能从枚举删掉）。这不是重开第三批收官，是收「后批」从未落地的设置分区。

不并进：上传表单标部门、MD/TXT 更严体积档、魔数嗅探、独立子资源 HTTP、新 `kb_doc_types` 表、ES `doc_type` terms、改码级联改文档、BlockNote。

本图 **补类型分区 CRUD 最小闭环**。

本批一张：

- [类型分区 CRUD 最小闭环](./74-doc-type-catalog-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2、上传表单标部门、PG 硬删与 HTTP ES purge、MD/TXT 更严体积档、魔数嗅探。

未改产品代码。

## Comments

- 2026-09-15 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包（真引擎是选型）。不选 3。不选 4。不选 5。本批补类型分区 CRUD。
- Q2：一张工单。仍走 PATCH settings（HTTP 二选一已选 PATCH，不另开子资源）。catalog `{code,label,sort,enabled}` 进 `config_json`；GET /doc-types 只回启用项真 label。
- Q3：`docTypes` string[] 仍是启用码派生（旧 PATCH 简写仍合法）；`docTypeItems` 与 `docTypes` 互斥。重复码 400。空 catalog = 现语义（ask 不限；文档标注只能清 null）。
- Q4：停用 ≠ 删除：停用不出成员 GET、不能新标、ask scope 非法；已标文档不级联改。无新表。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
