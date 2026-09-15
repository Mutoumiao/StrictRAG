# Research: 类型分区 CRUD 之后下一步可动手缺口

- **Query**: 对照功能表「必须具备」与源码，找出 wayfinder 地图「按功能表补全必须具备」里下一步可动手、不依赖人签 / 真引擎选型 / 解锁站规的产品语义缺口
- **Scope**: mixed（功能表 + `prds/00–11` + 源码；`docs/module-status` 仅作镜像）
- **Date**: 2026-09-15

权威：WHAT = `prds/00–11`；功能表 = `prds/12-delivery-guides/14-模块需求功能表.md`（派生，冲突跟 PRD）；IS = 源码。地图 = `.scratch/fill-must-haves/map.md`。已关执行工单 01–74。前线开放：`.scratch/fill-must-haves/issues/75-after-doc-type-catalog-order.md`。

无活跃 Trellis task（`task.py current` 为空）。本文件按用户指定路径落盘，不是 `{TASK_DIR}/research/`。

---

## 0. 结论（给 75 用）

**不应暂停。** 剩余必须具备里仍有不依赖人签 / 真 OCR 引擎 / 解锁站规（默认开 `DEPT_ACL_ENFORCE`、角色 principal、默认开 OCR、默认开 rewrite）的产品语义真空。

**推荐下一张唯一执行工单题目：**

> 上传与编写表单标部门与可见级最小闭环

理由：功能表 §4.3 / 前端 IA §2.4.1 要求**上传**即可标所属部门与可见级别；complete / write 契约与落库已有字段，admin 入场表单不发。`dataClass=sensitive` 时 complete 须 ACL 就绪（部门路径或显式名单），入场表单两路都不发，**敏感库无法从 admin 上传/编写走完登记**。这不是重开 74，也不是默认开强制。

75 题面里的五选一（BlockNote 余量 / P5 真引擎 / 解锁 P3b 站规 / 暂停 / P4 人签雾）都不是卡住的产品路径。

---

## 1. 已锁、不要当缺口重开

| 项 | 口径 |
|----|------|
| P2 第三批语义收官；P2.5 工程路径齐 | 人签 / 准出 PASS / 默认开 rewrite 图外 |
| BlockNote / editor-draft / web 编辑器 | P2.x 完整体验余量；62 已做 Markdown 提交审批 |
| P3a Full 图 | 等 L2 人签（图外） |
| LangGraph 重构 | 另起路线（`apps/api/src/graph/run.ts` 仍是线性状态机） |
| B8 / B9 / QUAL-2 | 真 ES+IK / 真 RustFS / 真杀毒，不进本回合 |
| P3b 可动手最小闭环 | 已齐；**仓库默认开** `DEPT_ACL_ENFORCE`、角色 principal 仍锁 |
| P4 可动手代码真空 | 已尽；人签 / 再认证 / 数据面板增强 / Grafana / 独立 `tau_sweep` 入队 / 把 tau* 接到运行时 / live judge 仍缺口但不是本回合代码真空 |
| P5 OCR 开闸 + 历史重跑 | 已齐（默认关）；真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe = 选型或后批 |
| 默认开 rewrite | 不进执行 |
| 74 切边 | 独立写资源 / 新表 / ES `doc_type` terms / 改码级联 / 魔数嗅探 / MD/TXT 更严体积 **不并进已关工单**；后两项见 §3.2、§4 |

---

## 2. 功能表入场行对照（压缩）

只记「本图仍可能当缺口」的行。齐的主路径不展开。

### 2.1 已齐（不要再开）

- web P2：登录、成员库选择器、无库空态、会话壳、档位、类型 scope 消费、SSE、拒答卡、建议动作、429 文案、反馈类别、引用点回快照、`coref_unresolved` 卡（P2.5 消费）
- admin P2 运营最小：建库、审批、成员改角色、分片只读、设置基本信息 / 档位 / 类型分区 CRUD（74）、策略弹窗最小、修改日志、上传 MIME+checksum（72）、Reindex 人选、双轴标签、四态 lifecycle、替代、删除+purge 入队、在线编写 Markdown、入库报告最小、评测底线、用户/部门壳、末位超管提示、超管全码锁、顶栏 KB `ClosedSelect`
- api P2 主路径：ask 同步+SSE、空库 200+`kb_not_ready`、`GET /me/permissions`、成员 PUT role、MIME 白名单、生效区间、supersede、DELETE+purge、`GET /doc-types`、`no_docs_in_scope`、ask 审计、三平面配额最小、失败 Webhook 最小、ES 查询期 tenantId+kbId / 部门 / principals（强制默认关）
- P3b 可动手最小、P4 可动手最小、P5 开闸+重跑：见地图 Notes

### 2.2 仍缺或半接线、且可动手（详见 §3）

| # | 缺口 | 入场 | 判定 |
|---|------|------|------|
| 1 | 上传/编写入场不标部门与可见级 | P2 字段 | **缺（表单）**；API 字段已有 |
| 2 | KB 消费绑定分区：仅 embed 手填；PUT 整表替换且未禁 judge | P2 | **半接线** |
| 3 | 跨文档去重 / `pending_review` / 入库报告冲突对 | P1–P2 | **缺（完整语义）**；22 只写真事 |
| 4 | 角色授码树状勾选 | P2 | **半接线**（扁平勾选） |
| 5 | 分片策略参数只读审计展示 | P2 | **缺（展示）**；快照列已写 |
| 6 | paramSchema 动态表单 / 平台策略 CRUD 页 | P2 | **缺（运营扩展）**；06 划出 |
| 7 | 反馈队列回流黄金集 | P2 | **缺**；12 划出 |
| 8 | L0 模板 / L1 `contextualize` | P1 | **半接线**（写死 `title / section`） |
| 9 | 断线按 `requestId` 重拉终态 | P2 | **缺**；10 划出（审计 GET ≠ 重放） |
| 10 | 质量只读「签字包链」 | P2 | **半接线**（有 id，无链） |

### 2.3 看起来像缺口、本回合不当执行工单

| 项 | 为何不进 |
|----|----------|
| MD/TXT 更严体积 | PRD / ADR-039 / 功能表均写 **「可选 / 可更严」**，不是硬必须；50 MiB 默认闸已在 |
| 魔数 / 文件头嗅探 | `prds/00–11` **无条款**；039 只要求 MIME/扩展名 + checksum |
| ES `doc_type` terms / dense 查询期 WHERE | 当前 `runRetrieve` 先按类型滤 PG 语料，http ES 命中再 `byId.has` 相交；类型语义已对称。换查询期谓词是架构升级，09/70/74 已划出 |
| PG 硬删 / HTTP ES `_delete_by_query` / chunk 清扫 | 68 最小闭环已 archived+mock purge；三存生产对齐偏 B8/B9 |
| `allowedDocIds` 成员大列表 | ADR-009 **已关**：P2 主路径不物化全库 id；19 明确不做 |
| 独立 `approval_ticket` 资源 | 审批中心按文档 approve/reject 已通；不是入场真空 |
| `/health/ready` 路径名、`/metrics` 裸奔 | 存活/就绪已有 `/health`+`/ready`；metrics 是基建债 |
| `fetch-models` 上游代理 | 当前预设 `supportsFetchModels: false`，手填模型已有 |
| 句级 `[chunkId]` / 重叠句归属 / Langfuse SDK | 第三批质量半接线，08 已划出；不挡入场 |
| 原生 `<select>` 换 `ClosedSelect` | 站规余量，不是功能表语义（文档页上传策略 / 行内部门仍是原生 select） |

---

## 3. 可动手候选（按卡住产品路径排序）

### 3.1 【推荐下一张】上传与编写表单标部门与可见级

- **功能表定位**
  - §4.3「部门与可见级别」：上传/编辑/列表可标所属部门、可见级别；入场 **P2 字段**（检索强制 P3b）
  - §5.2 部门：文档 PATCH 可带部门/级别（P2 壳）
- **PRD 条款**
  - `prds/00-product/05-frontend-ia.md` §2.4.1：文档**上传**/编辑/列表 → 所属部门、可见级别
  - `prds/05-api/01-http-api-hono.md` §2.12：`ownerDeptId`、`visibilityLevel` 须入库，禁止仅前端展示
  - `prds/09-security/01-auth-acl-compliance.md` / ADR-057：P2 字段可配；强制默认关
  - 敏感闸：complete 须 ACL 就绪（工单 45；`isSensitiveCompleteBlocked`）
- **源码证据**
  - 契约已有：`packages/contracts/src/ingest/document.contract.ts` `CompleteUploadBodySchema` / `WriteDocumentBodySchema` 含 `ownerDeptId`、`visibilityLevel`；**无** `docType`
  - 落库已有：`apps/api/src/services/ingest-complete-pending.ts` 把 body 部门/名单写入并跑敏感闸
  - 敏感闸：`apps/api/src/services/kb-settings.ts` `isSensitiveCompleteBlocked` — 就绪 =（本库 enforce ∧ 非空 `ownerDeptId`）或 `aclPrincipals` 为数组（含 `[]`）；缺字段不算
  - 上传表单不发：`apps/admin/src/app/(ops)/documents/upload.services.ts` `uploadAdminDocument` 只传 `chunkStrategy` + `checksumSha256`
  - 编写表单不发：`apps/admin/src/app/(ops)/documents/write.services.ts` 只传 title / markdown / chunkStrategy
  - UI：`documents-workspace.tsx` 上传确认条只有策略 `<select>`；行展开才能改部门（那是**编辑**，不是入场）
  - 镜像已挂账：`docs/module-status/admin.md`「上传表单标部门：列表/详情可标；上传 complete 可带但表单未发」
- **为何可动手**
  - 不改仓库默认强制、不加角色 principal、不选 OCR 引擎、不等人签
  - API 已收字段；一张工单只补 admin 入场表单 + 把值送进已有 complete/write
  - 卡住路径：敏感库 admin 上传/编写在 complete 前就被挡；普通库所有新文默认 `ownerDeptId=null`（库级），以后开强制会变成「全员可见库级文」
- **建议切边（一张工单最小闭环）**
  - **做**：上传确认条 + 在线编写面板增加所属部门、可见级；空部门 = 库级 `null`；走已有 complete/write body；新下拉必须 `ClosedSelect`（站规）
  - 测例：表单发出字段；complete 落库；sensitive + 本库 `deptAclEnforce` + 部门 → 过闸；sensitive 且两路都不发 → 仍 400
  - **不做**：上传标类型；入场 `aclPrincipals`（sensitive 且本库强制关仍走名单路径，留雾）；MD/TXT 更严；魔数；默认开强制；把行内已有原生部门 `<select>` 一并改掉；改 `prds/00–11`
- **不是重开 74**：74 只做设置 catalog；上传标部门是其「不做」项，本张新建

### 3.2 KB 消费绑定分区（generate / embed / rerank + 跟随平台 + 禁 judge）

- **功能表定位**：§4.2 / §5.2 / §9.2 / §12.5 — 入场 **P2**；仅 generate/embed/rerank；可跟随平台；禁止改 judge*
- **PRD**：`prds/00-product/05-frontend-ia.md` §2.2；ADR-055（`prds/11-decisions/00-adr-index.md`）：KB 不可覆盖 judge/judge_aux；未覆盖继承平台
- **源码证据**
  - HTTP 已有：`apps/api/src/routes/kb-settings.ts` GET/PUT `…/model-bindings`
  - PUT 复用 `PutPlatformBindingsBodySchema`（含 judge 等全部 purpose），`validatePlatformBindings` 不剥 KB 白名单 → **KB 可写 judge**
  - `replaceKbBindings` 整表删除再插入；设置页清空 embed 会 `PUT { bindings: {} }`，可能误删其它 purpose
  - admin 半接线：`settings-workspace.tsx` 仅「embed primary」手填 Input，无 generate/rerank、无模型池、无「跟随平台」
  - 运行时合并已有：`apps/api/src/services/gateway/bindings.ts` `mergeBindingRows`
- **为何可动手**：不依赖人签/再认证硬闸（ADR-055 软闸 P2 允许先存）；不解锁部门强制
- **建议切边**
  - **做**：KB PUT 只接受 generate/embed/rerank，其它 purpose 400；空 = 跟随平台（该 purpose 不写行）；设置页三档 ClosedSelect（跟随平台 / 覆盖）；judge 不可见不可写
  - **不做**：再认证流程、改平台绑定页、`GENERATE_MIN_NODES`、默认开 rewrite
- **排序**：ask 已能靠平台绑定跑；不挡入场登记。排第 2，作 75 之后下一张候选

### 3.3 跨文档去重 / `pending_review` / 入库报告冲突对

- **功能表定位**：§4.3 入库报告；§6 去重（文档内必做；同 KB 跨文档默认 on；`pending_review` 须人工二选一）— 入场 P1–P2
- **PRD**：`prds/04-pipelines/01-offline-ingest.md` 去重；ADR 相关入库条款
- **源码证据**：`apps/worker/src/ingest/pipeline.ts` 仅文档内 `toLowerCase` 字符串 Set；工单 22 明确不做跨 doc MinHash / `pending_review` / L0 vs L1 Hit@k
- **为何可动手**：算法与运营面，不依赖真 ES/OCR/人签
- **建议切边**：一张工单只做「同 KB 跨文档 skip_index + 报告写出冲突对」或只做 `pending_review` 二选一，不要两套算法+UI 塞一张
- **排序**：不挡「文档进库」；质量债。比入场部门字段轻、比绑定分区重（体积大）

### 3.4 角色与权限树状勾选

- **功能表定位**：§4.1「角色与权限」树状勾选；入场 P2
- **PRD**：`prds/00-product/05-frontend-ia.md` §2.4：编辑 = 树（L1/L2 菜单 + 操作）勾选 code
- **源码证据**：`apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx` 扁平 `toggleCode`；catalog 有菜单树可用
- **为何可动手**：纯 admin IA，不改鉴权语义
- **建议切边**：按 `admin-catalog` 菜单树分组勾选；超管锁全码保持 31
- **排序**：不挡入场/问答

### 3.5 文档绑定策略参数只读审计

- **功能表定位**：§4.5 / §5.2 文档绑定「参数快照只读审计」；HTTP「文档元数据 `chunk_strategy_params_snapshot` 只读展示」
- **源码证据**：complete/reindex 已写快照列；admin 文档页无展示（grep 无 `chunkStrategyParams`）
- **切边**：详情只读展示码 + 快照 JSON；不改 worker、不做 paramSchema 表单
- **排序**：运营可见性，不挡入场

### 3.6 paramSchema 动态表单 / 平台策略 CRUD 页

- **功能表定位**：§4.2 分片策略按 `paramSchema` 渲染（含 `contextMode`）；§4.5 平台注册表可扩展 — P2
- **源码证据**：工单 06 明确不做动态表单与平台 CRUD 页；现仅 `structure_paragraph` 可写
- **切边**：若做，只做 `contextMode` L0/L1 一个控件，不要通用表单引擎
- **排序**：现仅一套内置策略，不卡上传人选

### 3.7 反馈回流黄金集

- **功能表定位**：§4.1 反馈队列「回流补库或黄金集」；§12.4 纳入黄金集 → `eval.run` — P2
- **源码证据**：admin `/feedback` 仅 dismiss / linked_doc；`/eval` 黄金集独立维护；12 划出回流
- **切边**：队列动作「纳入黄金集」写 gold-questions；不改 2×2 公式
- **排序**：评测底线已能手建题；闭环体验债

### 3.8 L0 模板 / L1 contextualize

- **功能表定位**：§5.4 / §6 `ingest.contextualize` — P1；关 L1 须 `contextMode=l0_template`
- **源码证据**：`apps/worker/src/ingest/pipeline.ts` `prefix = \`${doc.title} / section\``；无 LLM contextualize、无 paramSchema `contextMode`
- **切边**：先把 L0 做成可读模板（标题+小节），L1 LLM 另张（要 Gateway purpose `contextualize`）
- **排序**：召回质量；现有 stub 前缀仍能索引

### 3.9 断线按 requestId 重拉终态

- **功能表定位**：§3 流式回答「断线可按 requestId 重拉终态」— P2
- **源码证据**：`GET /ask/:requestId` 是审计 snapshot（工单 10）；web 无重放 AskResponse；module-status web/api 均写「明确不做」
- **切边**：终态信封可重拉，不是审计页；禁止用 audit preview 冒充 answered
- **排序**：SSE 主路径已能用；体验债

### 3.10 质量只读签字包链

- **功能表定位**：§4.2 质量只读 `tauClaim` + 签字包 id/**链** — P2
- **源码证据**：`KbSettingsSchema.qualitySnapshot` 仅 `tauClaim` / `gatePackageId` / `effectiveAt`；设置页展示这两项
- **切边**：只读展示链上 evalRunId；不写 τ、不做人签
- **排序**：P4 人签仍图外；链展示是壳

---

## 4. 明确不是本张、也不是「必须具备真空」

### 4.1 MD/TXT 更严体积

- 功能表 §5.2 / §6：**「MD/TXT 可更严」**
- ADR-039 / 安全 PRD §7：**「可选分档」**，建议 10 MiB
- 源码：`INGEST_MAX_FILE_BYTES` 默认 50 MiB、天花板 200 MiB；`checkUploadByteSize` 不分族（`apps/api/src/gates/upload-size.ts`、`apps/api/src/env.ts`）
- **判定**：可选能力，不是硬必须。用户允许「若仍是必须具备且真空可开新工单」——对照 PRD **不是必须具备**。不要作为 75 的下一张。若以后产品加严，另开，且不并进部门表单工单。

### 4.2 魔数嗅探

- `prds/` 无「魔数 / 文件头」条款。039 权威闸是 size + MIME/扩展名 + checksum（72 已落）。
- **判定**：非必须具备。保持 74/72 划出。

---

## 5. 仍留雾（依赖人签 / 选型 / 解锁站规）

- L2 准出人签；默认开 rewrite；对外宣传连续追问
- P3a CRAG / multi_hop
- 仓库默认开 `DEPT_ACL_ENFORCE`；角色 principal
- P4：门禁包人签与再认证、数据面板增强、独立 `tau_sweep`/`verifier_calib` 入队、tau* 接运行时、live judge、Grafana
- P5：真 OCR / Cloud / 自动全库 / 容量 / 抽样常态化 / CoVe / 超长异步
- B8 真 ES+IK、B9 真 RustFS/Mongo 生产、QUAL-2 真杀毒
- BlockNote / editor-draft / web 用户编辑器
- LangGraph.js 官方图重构
- 入场 `aclPrincipals`（敏感库在**本库强制关**时的名单路径；部门工单切边外）
- 原生 `<select>` 站规清扫（文档页策略/行内筛选）

---

## 6. 给 75 的裁定建议

1. **不选** 75 题面候选 1/2/3/4/5。
2. **本图补**「上传与编写表单标部门与可见级最小闭环」一张。
3. 其后（不写进本张）：KB 消费绑定白名单 + 三 purpose 跟随平台 → 再视情况去重 / 角色树。
4. 不要把 MD/TXT 更严、魔数、ES terms、PG 硬删并进。
5. 默认开强制 / 角色 principal / 默认开 OCR / 默认开 rewrite / 人签 / 真引擎仍锁。

## Caveats / Not Found

- 无活跃 Trellis task；本报告只写在用户指定路径。
- `docs/module-status/api.md` 仍写「无 PUT KB 绑定 HTTP」——**滞后**。源码 `kb-settings.ts` 已有 PUT；以源码为准。
- 敏感闸「部门路径」要求 **本库** `deptAclEnforce` ∧ 非空部门，不是仓库默认开。设置页已能勾选本库强制（未改不写回）。本张表单 + 已有勾选即可走部门路径，仍不等于解锁仓库默认。
- 未改 map / 工单 / 产品代码。
