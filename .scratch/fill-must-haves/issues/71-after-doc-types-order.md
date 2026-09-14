# 裁定文档类型成员面后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 70

## Question

[文档类型成员面最小闭环](./70-doc-types-member-surface-min.md) 完成后（本张创建时仍 blocked）。成员可读 GET /doc-types；类型收窄空集走 `no_docs_in_scope`；web ClosedSelect 消费枚举。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- 类型分区 CRUD / 上传表单标部门 / MIME 白名单 / 多选勾选组不并进已关工单
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

文档类型成员面最小闭环之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**。P5 真引擎仍是选型。P3b 站规仍锁。P4 人签 / 面板仍不是代码缺口。用户要求继续本图，五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。

目的地里仍缺、且不依赖人签或引擎选型的产品语义是 **上传 MIME 白名单**：[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 与后续工单划出后未回补。功能表 §5.2 / ADR-039 / 安全 PRD §7：`complete` 权威校验 size + **MIME/扩展名白名单** + checksum；禁止可执行与未知 `octet-stream` 默许。仓内 complete 只有体积闸；`docFamilyFromContentType` 把未知类型（含 octet-stream）映射成 `txt`；admin 空 `file.type` 会改写成 `text/plain`。`checksum_sha256` 列已有，complete 不落、不比对。这不是重开第三批收官，是收「后批」从未落地的入库媒体闸。

不并进：类型分区 CRUD、上传表单标部门、MD/TXT 更严体积档、魔数嗅探、QUAL-2 真杀毒、BlockNote。

本图 **补上传 MIME 白名单最小闭环**。

本批一张：

- [上传 MIME 白名单最小闭环](./72-upload-mime-whitelist-min.md) — 开放前沿。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余（真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe）、B8 / B9 / QUAL-2、类型分区 CRUD、上传表单标部门、PG 硬删与 HTTP ES purge、MD/TXT 更严体积档。

未改产品代码。

## Comments

- 2026-09-14 用户要求继续 wayfinder，在主分支推进。授权本图全程自行决策。
- Q1：不选 1（余量）。不选 2 整包（真引擎是选型）。不选 3。不选 4。不选 5。本批补上传 MIME 白名单。
- Q2：一张工单。contracts 白名单 SSOT + complete 权威闸 + upload-url / PUT 纵深 + write 同闸 + checksum 落库/比对 + admin 不再把未知类型改写成 text/plain。
- Q3：允许 pdf / docx 族 / markdown / plain text；未知、octet-stream、可执行、扩展名不在名单 → 415 `UNSUPPORTED_MEDIA_TYPE`。complete 是权威闸。
- Q4：checksum 按对象字节计算并写入 `checksum_sha256`；body 带 `checksumSha256` 且不一致 → 400。不嗅魔数。不改默认 50 MiB / 200 MiB 天花板。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote 仍锁。
