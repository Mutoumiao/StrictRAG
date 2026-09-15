# Research: KB 消费绑定之后下一步可动手缺口

- **Query**: 对照功能表「必须具备」与源码，找出 wayfinder 地图「按功能表补全必须具备」里，在工单 78 已完成后，下一步可动手、不依赖人签 / 真引擎选型 / 解锁站规的产品语义缺口
- **Scope**: mixed（功能表 + `prds/00–11` + 源码；`docs/module-status` 仅作镜像）
- **Date**: 2026-09-15

权威：WHAT = `prds/00–11`；功能表 = `prds/12-delivery-guides/14-模块需求功能表.md`（派生，冲突跟 PRD）；IS = 源码。地图 = `.scratch/fill-must-haves/map.md`。已关执行到 78；前线 grilling = `.scratch/fill-must-haves/issues/79-after-kb-consume-bindings-order.md`（claimed）。过期线索 = `.scratch/fill-must-haves/research-next-after-74.md`（写给 75；**76 上传标部门、78 KB 消费绑定已落地，不得再当缺口**）。

无活跃 Trellis task。本文件按用户指定路径落盘，不是 `{TASK_DIR}/research/`。

---

## 0. 结论（给 79 用）

**不应暂停。** 人签 / 真 OCR / 解锁站规（仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal、默认开 OCR、默认开 rewrite）之外，目的地里仍有可动手的产品语义真空。

**推荐下一张唯一执行工单题目：**

> 同 KB 跨文档去重最小闭环

理由：功能表 §5.4 / §6 与入库 PRD §5 把「文档内必做 + **同 KB 跨文档默认 on**」冻成召回核上游；默认动作 `skip_index`，入库报告须能点开冲突对，禁止无提示静默丢条款。源码只做文档内 `toLowerCase` 字符串 Set；`chunks` 无 `searchable` / `duplicate_of`；报告契约**禁止**冒充 `crossDocDropped`。重复条款会占满 Top-K，这是卡住的入库→检索产品路径，不是重开 22、不是人签、不是真引擎。

79 题面五选一（BlockNote 余量 / P5 真引擎 / 解锁 P3b 站规 / 暂停 / P4 人签雾）都不是这条路径。

**paramSchema 判定（78 划出、须单独说）**：对照 `prds/00–11`，设置弹窗「按 `paramSchema` 渲染（含 `contextMode`）」是 **P2 硬必须**，不是可选。但 **不是本张下一张**：注册表字段与 GET schema 已有（工单 06）；worker **不消费**快照里的 `chunkTokens` / `overlap` / `contextMode`；默认种子 `contextMode=l1_llm` 而管道只写死 `title / section`。先做通用动态表单会写成假开关。后批最小切片应是 **一个 `contextMode` 控件 + worker 真分支**，不是表单引擎，也不是平台策略 CRUD 页。

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
| P4 可动手代码真空 | 已尽；人签 / 再认证 / 数据面板增强 / Grafana / 独立 `tau_sweep` 入队 / tau* 接运行时 / live judge 不是本回合代码真空 |
| P5 OCR 开闸 + 历史重跑 | 已齐（默认关）；真引擎 / Cloud / 自动全库 = 选型 |
| 76 切边 | 强制必填 / 默认开强制 / 上传标类型 / 入场 `aclPrincipals` / MD/TXT 更严 / 魔数 **不并进已关工单**；后两项见 §4 |
| 78 切边 | 再认证 / 改 judge / `GENERATE_MIN_NODES` / 改 catalog 权限 / 平台绑定页 / fallbacks 多行 / paramSchema 动态表单 **不并进已关工单** |
| 76 已落地 | 创建面 ClosedSelect 标部门 / 可见级；complete / write 带字段。**不要再当缺口** |
| 78 已落地 | KB PUT 只收 generate/embed/rerank；judge 400；设置页三档 ClosedSelect；空档跟随平台。**不要再当缺口** |

---

## 2. 功能表入场行对照（压缩）

只记「本图仍可能当缺口」的行。齐的主路径不展开。

### 2.1 已齐（不要再开）

- web P2：登录、成员库选择器、无库空态、会话壳、档位、类型 scope 消费、SSE、拒答卡、建议动作、429、反馈类别、引用点回快照、`coref_unresolved` 卡
- admin P2 运营最小：建库、审批、成员改角色、分片只读、设置基本信息 / 档位 / 类型分区 CRUD（74）、策略弹窗启用+recommended（06）、修改日志、上传 MIME+checksum（72）、创建面部门/可见级（76）、KB 消费三档（78）、Reindex 人选、双轴标签、四态 lifecycle、替代、删除+purge、在线编写 Markdown、入库报告最小（22，只写真事）、评测底线、用户/部门壳、末位超管、超管全码锁、顶栏 KB `ClosedSelect`
- api P2 主路径：ask 同步+SSE、空库 200+`kb_not_ready`、`GET /me/permissions`、成员 PUT role、MIME 白名单、生效区间、supersede、DELETE+purge、`GET /doc-types`、`no_docs_in_scope`、ask 审计、三平面配额、失败 Webhook、ES 查询期 tenantId+kbId / 部门 / principals（强制默认关）、KB PUT 消费白名单
- P3b 可动手最小、P4 可动手最小、P5 开闸+重跑：见地图 Notes

### 2.2 仍缺或半接线、且可动手（详见 §3）

| # | 缺口 | 入场 | 判定 |
|---|------|------|------|
| 1 | 同 KB 跨文档去重 / 报告冲突对 | P1–P2 | **缺（完整语义）**；22 只写真事、文档内 Set |
| 2 | L0 模板真用快照 / L1 `contextualize` 可关 | P1 | **半接线**（写死 `title / section`；种子却是 `l1_llm`） |
| 3 | 设置弹窗按 schema 渲染 `contextMode` | P2 | **半接线**（表有 `paramSchema`，弹窗不渲染、worker 不读） |
| 4 | 反馈队列回流黄金集 | P2 | **半接线**（状态枚举有 `promoted_to_gold`，无写题、无按钮） |
| 5 | 角色授码树状勾选 | P2 | **半接线**（扁平勾选） |
| 6 | 分片策略参数快照只读审计展示 | P2 | **缺（展示）**；列已写 |
| 7 | 断线按 `requestId` 重拉终态 | P2 | **缺**；10 划出（审计 GET ≠ 重放） |
| 8 | 质量只读「签字包链」 | P2 | **半接线**（有 id，无链） |
| 9 | 入场 `aclPrincipals` | P2 字段 / 敏感闸 | **缺（表单）**；complete 已收字段；76 明确不做 |

### 2.3 看起来像缺口、本回合不当执行工单

见 §4。

---

## 3. 可动手候选（按卡住产品路径排序）

### 3.1 【推荐下一张】同 KB 跨文档去重最小闭环

- **功能表定位**
  - §5.4 召回核：`结构切块 → 文档内去重 + 默认同 KB 跨文档去重 → L0/L1`
  - §4.3 / §5.2 入库报告：去重冲突对、跨 doc skip；`pending_review` 须人工二选一 — 入场 **P1–P2**
  - §6 worker：文档内必做；同 KB 跨文档默认 on（MinHash/simhash 量级）；默认 `skip_index`
- **PRD 条款**
  - `prds/04-pipelines/01-offline-ingest.md` §5：同 KB 跨文档 **必须、默认 on**；`skip_index` 不写向量/ES、记 `duplicate_of`、`searchable=false`；报告须可点开冲突对；禁止无提示静默丢条款
  - `prds/11-decisions/00-adr-index.md`：doc 内必做 + 同 KB 跨 doc MinHash/simhash 默认 on
  - `prds/10-delivery/01-phased-roadmap.md`：P1 含 doc 内 + 跨 doc 去重
  - 验收：`prds/10-delivery/03-acceptance-scenarios.md`「跨 doc 近重复」；测试覆盖 `docs/testing/coverage/01-ingest.md` E4 已标缺实现
- **源码证据**
  - 仅文档内：`apps/worker/src/ingest/pipeline.ts`（`seen` + `body.toLowerCase()`，约 494–514 行）
  - 报告最小且测例钉死不装齐：`packages/db/src/schema/kb/ingest-reports.ts`；`packages/contracts/tests/ingest/ingest-report-contract.test.ts` 拒 `crossDocDropped`；`apps/api/tests/ingest/ingest-report-http.test.ts` 拒 `crossDoc`
  - `packages/db/src/schema/kb/chunks.ts` 无 `searchable` / `duplicate_of`；contracts `searchable` 仅可选字段
  - 工单 22 明确不做跨 doc MinHash / `pending_review` / L0 vs L1 Hit@k
- **为何可动手**
  - 不等人签、不选 OCR、不解锁部门强制、不改 rewrite
  - 卡住路径：近重复块默认可索引 → 污染 dense/ES Top-K；运营看不到冲突对；与「默认 on」冻款相反
- **建议切边（一张工单最小闭环）**
  - **做**：同 KB、当前激活/在建 version 近重复（MinHash 或 simhash 量级，阈值可先冻 Jaccard≈0.9 或等价）；命中默认 `skip_index`（不 embed / 不 ES）；落 `duplicate_of` + 不可检索；入库报告写出冲突对与跨 doc dropped 计数；searchable 被清空仍不得 ready（已有文档内清空失败可复用）
  - 测例：两篇同 KB 近重复 → 后文块 skip；报告可读冲突对；跨 KB 不比；禁止把未实现字段填 0
  - **不做**：`pending_review` 人工二选一 UI；`downrank`；跨 KB；L0 vs L1 Hit@k；换切块算法；默认开强制 / OCR / rewrite
- **体积**：中偏大（schema + worker 比较 + 报告 + admin 展示）。仍应 **一张**；不要把 pending_review 和 L1 塞进来
- **不是重开 22**：22 只写真事并显式省略跨 doc；本张补从未落地的默认 on 闸

### 3.2 L0 模板真用快照 / 关 L1（不为假 `l1_llm`）

- **功能表定位**：§6 `ingest.contextualize` — **P1**；关 L1 须 `contextMode=l0_template`；看板标「召回增强关闭」
- **PRD**：`prds/04-pipelines/01-offline-ingest.md` §4：L0 模板 `{doc_title} / {section_path}`；L1 经 Gateway `purpose=contextualize`，失败回退 L0；Phase 1 至少 L0 全量；建议 L1 默认可关
- **源码证据**
  - 前缀写死：`apps/worker/src/ingest/pipeline.ts` `prefix = \`${doc.title} / section\``
  - `splitByChunkStrategy` 不读 `chunkTokens` / overlap
  - 种子默认 `contextMode: 'l1_llm'`：`packages/contracts/src/ingest/chunk-strategy.ts`
  - worker `GATEWAY_*` 仅占位，pipeline 未调网关（`docs/module-status/worker.md`）
  - 仓内无「召回增强关闭」文案
- **切边**
  - **做（若作后一张，不要并进 3.1）**：L0 用文档标题（有小节则拼 path）；快照 `contextMode=l0_template` 时不声称 L1；报告可记 `context_source=l0`
  - **不做（本张/紧后都不要）**：真跑 L1 LLM（要 Gateway `contextualize` + 费用 + 回退，体积大，另张）；通用 paramSchema 引擎
- **排序**：召回质量；现 stub 仍能索引。排第 2。假 `l1_llm` 是语义债，但不如跨 doc 默认闸缺席挡检索污染
- **体积**：小（只做 L0 对齐）到中（若连 worker 读快照）

### 3.3 paramSchema：`contextMode` 单控件（不是动态表单引擎）

- **功能表定位**：§4.2 / §4.5 / 前端 IA §2.3 — 弹窗按策略 `paramSchema` 渲染参数（含 `contextMode` L0/L1）— **P2 硬必须**
- **PRD**：`prds/00-product/05-frontend-ia.md` §2.3「按策略 schema 渲染参数」；ADR-053 注册表含 `paramSchema`
- **源码证据**
  - 表与 HTTP 已有：`packages/db/src/schema/kb/chunk-strategy-definitions.ts`；`apps/api/src/routes/chunk-strategies.ts` GET schema
  - 弹窗只启用 + recommended：`apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx`
  - 工单 06 明确不做「按 paramSchema 做成完整动态表单引擎（含 contextMode）」
- **对照 PRD 的硬/软**
  - **硬必须**：运营能把 `contextMode` 从默认 L1 打到 `l0_template`，且 **worker 服从**（否则是假开关）
  - **不是硬必须（本回合）**：通用 JSON schema 表单引擎、平台注册表 CRUD 页、超长表拆分控件、在仅 `structure_paragraph` 可写时扩展任意新 code
- **切边**：一张只做 `contextMode` ClosedSelect + PATCH 写入库覆盖 + 快照进文档；**必须**与 3.2 worker 分支同张或紧后；禁止先做无效果的表单
- **排序**：现仅一套内置策略，不卡上传人选。排第 3，且依赖 3.2，不宜抢 3.1
- **体积**：小（单控件）若拆开；与 3.2 合并则中

### 3.4 反馈队列回流黄金集

- **功能表定位**：§4.1 反馈「回流补库或黄金集」；§12.4 纳入黄金集 → `eval.run` — **P2**
- **源码证据**
  - 枚举已有：`packages/contracts/src/ask/feedback.contract.ts` `promoted_to_gold`
  - `apps/api/src/services/feedback.ts` 只改 status，不 INSERT `gold_questions`
  - admin `/feedback` 仅 dismiss / `linked_doc`（`feedback-workspace.tsx`）
  - 工单 12 明确不做回流
- **切边**：队列动作「纳入黄金集」写 gold-questions（题面从当轮 ask / comment 派生须钉契约）；不改 2×2 公式；不做再认证
- **排序**：评测底线已能手建题。闭环体验债。排第 4
- **体积**：小到中

### 3.5 角色与权限树状勾选

- **功能表定位**：§4.1「树状勾选菜单/操作码」— P2
- **PRD**：`prds/00-product/05-frontend-ia.md` §2.4：编辑 = **树**（L1/L2 菜单 + 操作）勾选 code
- **源码证据**：`apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx` 扁平 `catalog.map` 勾选；`packages/admin-catalog/src/menu-tree.ts` 已有 `MENU_TREE`
- **切边**：按菜单树分组勾选；超管锁全码保持 31；不改鉴权语义
- **排序**：不挡入场/问答。排第 5
- **体积**：小

### 3.6 文档绑定策略参数只读审计

- **功能表定位**：§4.5 文档绑定「参数快照只读审计」
- **源码证据**：complete/reindex 已写 `documents.chunk_strategy_params`（`apps/api/src/services/ingest-complete-pending.ts`）；admin 文档页无展示
- **切边**：详情只读展示码 + 快照 JSON；不改 worker、不做 paramSchema 表单
- **排序**：运营可见性。排第 6
- **体积**：小

### 3.7 断线按 requestId 重拉终态

- **功能表定位**：§3 流式「断线可按 requestId 重拉终态」— P2
- **源码证据**：`apps/api/src/routes/ask.ts` GET 回 `toAskAudit`；注释写明非断线重拉；`apps/web/src/api/ask.ts` 同口径
- **切边**：终态 `AskResponse` 可重拉；禁止用 audit preview 冒充 answered
- **排序**：SSE 主路径已能用。排第 7
- **体积**：中（信封与 web 重挂）

### 3.8 质量只读签字包链

- **功能表定位**：§4.2 质量只读 `tauClaim` + 签字包 id/**链** — P2
- **源码证据**：`QualitySnapshotSchema` 仅 `tauClaim` / `gatePackageId` / `effectiveAt`（`packages/contracts/src/kb/kb-settings.contract.ts`）
- **切边**：只读展示链上 evalRunId；不写 τ、不做人签
- **排序**：P4 人签仍图外；链展示是壳。排第 8
- **体积**：小

### 3.9 入场 `aclPrincipals`（敏感且本库强制关）

- **功能表定位**：§4.3 部门与可见级已由 76 补表单；敏感闸仍允许「显式名单」路径
- **PRD / 工单 45**：complete 就绪 =（本库 enforce ∧ 非空部门）或 `aclPrincipals` 为数组（含 `[]`）
- **源码**：`CompleteUploadBodySchema` / `WriteDocumentBodySchema` 已收名单；76 创建面不发
- **切边**：仅创建面可选名单 ClosedSelect（有成员列表权限才拉人）；不默认开仓库强制；不加角色 principal
- **排序**：76 后部门路径已能走敏感+本库强制；本项只挡「敏感且强制关」。不当 79 下一张。排第 9
- **体积**：小到中

---

## 4. 看起来像缺口但本回合不当执行工单

| 项 | 为何不进 |
|----|----------|
| MD/TXT 更严体积 | 功能表 / ADR-039 / 安全 PRD 写 **「可更严 / 可选分档」**；50 MiB 默认闸已在。不是硬必须 |
| 魔数 / 文件头嗅探 | `prds/00–11` **无条款**；039 权威是 size + MIME/扩展名 + checksum（72 已落） |
| 上传表单标类型 | 76 切边；complete/write **无** `docType` 字段；PATCH 已能标且须属于 KB 枚举。web「类型引导」是 **P2.x**（IA §3）。列表/编辑已能标，不挡入场登记 |
| 通用 paramSchema 动态表单引擎 / 平台策略 CRUD 页 | 渲染 `contextMode` 是硬必须（§3.3）；**引擎与 CRUD 页**是 06 划出的运营扩展。现仅 `structure_paragraph` 可写 |
| fallbacks 多行编辑 | 功能表 §9.2：**P4**（P2 可单节点）。78 不做且本回合不当必须具备真空 |
| 改平台绑定页 / catalog 权限 / `GENERATE_MIN_NODES` | 78 切边。rerank 最小节点已是 `RERANK_MIN_NODES`（`apps/api/src/services/gateway/resolve.ts`）。平台绑定页已有 purpose 下拉 |
| 再认证 / 改 judge | P4 人签雾；ADR-055 软闸。78 不做 |
| ES `doc_type` terms / dense 查询期 WHERE | 类型语义已由 PG 语料 ∩ ES 命中对称。换查询期谓词是架构升级，09/70/74 划出 |
| PG 硬删 / HTTP ES `_delete_by_query` / chunk 清扫 | 68 已 archived+mock purge；三存生产对齐偏 B8/B9 |
| `allowedDocIds` 成员大列表 | ADR-009 已关；19 明确不做 |
| `/health/ready` 路径名、`/metrics` 裸奔 | 存活/就绪已有 `/health`+`/ready`；metrics 是基建债 |
| `fetch-models` 上游代理 | 预设 `supportsFetchModels: false`，手填已有 |
| 句级 `[chunkId]` / 重叠句归属 / Langfuse SDK | 第三批质量半接线，08 划出；不挡入场 |
| 原生 `<select>` 换 `ClosedSelect` | 站规余量，不是功能表语义（文档行内 / 部门页 / 策略 recommended / 模型页仍有原生 select） |
| `pending_review` 二选一整页 | 与 3.1 同族，但动作是可选；默认是 `skip_index`。不要并进下一张 |

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
- 真 L1 LLM `contextualize`（Gateway 费用路径；可后于 3.2 的 L0 对齐）

---

## 6. 给 79 的裁定建议

1. **不选** 79 题面候选 1/2/3/4/5。
2. **本图补**「同 KB 跨文档去重最小闭环」一张。切边见 §3.1：默认 `skip_index` + 报告冲突对；不要 pending_review、不要 L1、不要 paramSchema 引擎。
3. 其后（不写进本张）：L0 快照对齐 → `contextMode` 单控件（worker 必须服从）→ 反馈回流黄金集 / 角色树。
4. 不要把 MD/TXT 更严、魔数、上传标类型、通用动态表单、fallbacks 多行、平台绑定页改版、入场名单并进。
5. 默认开强制 / 角色 principal / 默认开 OCR / 默认开 rewrite / 人签 / 真引擎仍锁。
6. **暂停**只在剩余项都依赖人签或选型时才合理；当前不是。

## Caveats / Not Found

- 无活跃 Trellis task；本报告只写在用户指定路径。
- `docs/module-status/api.md` 仍可能写「无 PUT KB 绑定」一类旧句——**滞后**。源码 `kb-settings.ts` + `PutKbConsumeBindingsBodySchema` 已落地；以源码为准。
- 跨 doc 若只做「正文完全相等」会弱于 PRD 的 MinHash/simhash 量级；下一张应写近重复，不要用文档内 Set 冒充跨 doc。
- 未改 map / 工单 / 产品代码。
