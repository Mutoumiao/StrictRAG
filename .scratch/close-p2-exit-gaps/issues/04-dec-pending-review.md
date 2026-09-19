# 裁定 pending_review 落点 / 端点 / KB 策略位

Type: grilling
Status: resolved
Blocked by: 02

## Question

剧本 E4 要求「跨 doc 近重复：指标可见；`pending_review` 可人工处理」。前图 80 只做了「同库近重复默认 `skip_index` + 报告写冲突对」，95 落了 `dedupe_cross_doc_rate` 指标；`pending_review` 当时以「落点 / 端点 / KB 策略位三处未冻」划出。

请裁定三处，各自给出**可直接编码**的结论：

1. **落点**：被判为跨文档近重复的 chunk 存在哪里、状态字段叫什么、粒度是文档级还是 chunk 级；与既有 `documents.status` / `lifecycle` 的关系（不得混用 `needs_ocr` / 审批闸语义）。
2. **人工处理端点**：谁（权限码）在哪个资源上放行或驳回；请求 / 响应形状（须走 `packages/contracts` 的 `ApiResponse` 信封与既有错误码体系）；admin 侧入口是否本图包含。
3. **KB 策略位**：是否进 `config_json`、默认值、「未写跟 env」口径；开启后默认行为是 `skip_index` 还是 `pending_review`。

另须说明：**未记录与已记录的空值**如何区分（沿用 95 的「分母 0 → NULL 不写 0」口径），以及本图**不做**的部分（例如自动 LSH、人工阈值发明）。

## Answer

### 一、事实基线（PRD 原文，逐行）

| 出处 | 原文要点 |
|------|----------|
| `prds/04-pipelines/01-offline-ingest.md:237-243` | §5.1「跨 doc 命中动作」三值：`skip_index`（**默认**）· `downrank` · `pending_review`。`pending_review` 逐字：「**近似但可能效力不同**（管理员标记或启发式）：不静默 skip，**入审队列**，双方可暂均 index 或均不 index（**KB 策略**）；**须人工二选一**」 |
| 同上 `:243` | 「跨 doc 命中时入库报告**必须可点开冲突对**；**禁止无提示静默丢条款**」 |
| `prds/03-data/01-postgresql-schema.md:249` | `chunks` 字段 `duplicate_of`：「跨 doc 去重命中权威 chunk；**冲突待审可 `dedupe_status=pending_review`**」 |
| `prds/05-api/01-http-api-hono.md:183` | 分片列表项（最小）含 `searchable`、`duplicateOf?` |
| `prds/12-delivery-guides/14-模块需求功能表.md:299` | §4.3「入库报告：…去重冲突对…；`pending_review` 须人工二选一」**P1** |
| `prds/12-delivery-guides/14-模块需求功能表.md:473` | §6「动作默认 `skip_index`，可选 `downrank` / `pending_review`（须人工二选一，禁止无提示静默丢条款）；searchable chunk 集被去重清空 → 不得 ready」 |
| `prds/10-delivery/03-acceptance-scenarios.md:116` | 剧本 E4 Then：「跨 doc 近重复 \| 指标可见；`pending_review` 可人工处理」 |
| `prds/10-delivery/01-phased-roadmap.md:32` | Phase 1 做：「doc 内 + 跨 doc 去重（默认 on；冲突可 `pending_review`）」 |

### 二、现状（IS）

- 跨文档判定在 `apps/worker/src/ingest/cross-doc-dedupe.ts`；`CrossDocConflict.action` **硬编码字面量 `'skip_index'`**（`:21`、`:63`），无 KB 策略位。
- `chunks` 表**没有** `duplicate_of` / `dedupe_status` / `searchable` 列（`packages/db/src/schema/kb/chunks.ts`）。
- `skip_index` 的现实现是**丢弃该块**（不进 manifest）→ 没有「已入库但不可检索」的表示。
- 无任何 dedupe 审阅路由；权限码表（`packages/admin-catalog/src/permissions.ts`）无 dedupe 专属码。

### 三、裁定

**1. 落点 —— chunk 级，两列，列名取自 PRD 03 §3.2（不另起名）**

`chunks` 新增：
- `duplicate_of uuid`（可空）= 命中的**权威 chunk**；不命中时为 `NULL`。
- `dedupe_status text`（可空）= 仅一个取值 `'pending_review'`；**已处理回到 `NULL`**。

不发明第三个枚举值：PRD 只点名 `pending_review` 这一取值，「处理完」用回到 `NULL` 表达（与仓库「未记录/不适用 = NULL」的既有口径一致，见工单 95/105）。

粒度是 **chunk 级**（非文档级），因为 PRD 命中的是「权威 chunk」，且 `prds/05-api …:183` 的 `duplicateOf` 出现在**分片列表项**里。**不碰 `documents.status` / `lifecycle`**，**不碰审批闸语义**（`approval_status` 不变）。

**2. KB 策略位 —— `config_json.crossDocDedupeAction`**

- 默认 `'skip_index'`（PRD 逐字「默认」）。
- 白名单只接受 `'skip_index' | 'pending_review'`。**`'downrank'` 一律 400 明确拒绝**（PRD 的合法取值，但本仓未实现其检索层降权；接受一个行为不明的值比拒绝更危险）。理由：仓库既定纪律是「不为无实现的值留静默通道」。
- 在**同一天**KB 设置 PATCH 白名单里加该键（`kb.config.write`），并复用「未写跟默认」的口径。

**3. 人工处理端点 —— 新增一条，形状为本仓补形**

PRD 在**别处**已冻该能力与字段（§5.1「须人工二选一」+ 03-data `dedupe_status`），只是 05-api 的路由清单未逐字列出端点 —— 与前图 100（文档 ACL 端点）同型：补进清单，并在 PRD/spec 注明。

- `POST /api/v1/documents/:docId/dedupe-conflicts/:chunkId/resolve`
- body：`{ winner: 'this' | 'other' }`（`this` = 本块为权威、对方记 `duplicate_of`；`other` = 本块记 `duplicate_of` 对方、不入索引）。
- 权限：**`doc.editor`**（与文档 PATCH 同码，沿用前图 100 给 ACL PUT 的先例）**且**须成员闸；**不新增权限码**（裁定 87「不改码表」）。
- 语义：只允许处理 `dedupe_status='pending_review'` 的块；其余 → 400；处理后 `dedupe_status` 回 `NULL`，败者 `duplicate_of` 指向权威块且**不进 manifest / 不 embed / 不 ES**；胜者保持/进入可索引路径。**不自动 reindex 对方文档**（跨文档改写他人检索面属另一议题，无 PRD 依据）。

**4. 待审期间的索引语义（本仓钉法，保守取「暂不 index」）**

命中且策略为 `pending_review` 时：**仍写 `chunks` 行**（这样入库报告能点开冲突对、分片列表能带 `duplicateOf`），但该块 **不进 manifest / 不 embed / 不 ES**，`dedupe_status='pending_review'`。

**不改动对方的既有文档**（哪怕它已在检索）：从本轮的 ingest 去改另一个 active 文档的检索面，破坏「谁写谁负责」的边界，且无 PRD 依据。

PRD 说的「双方可暂均 index 或均不 index（KB 策略）」里的 interim 可配置性**本图不做**：PRD 未给键名，硬做就是发明契约 → 记入图上 Not yet specified。连带后果按 PRD 原文：「searchable chunk 集被去重清空 → 不得 ready」（`:473`），本图不例外。

**5. 未记录与空值**

`dedupe_status` / `duplicate_of` 为 `NULL` = 不适用（未命中/已处理）；**不得**用 `''` 或 0 冒充。入库报告的冲突对计数**不因待审而改变口径**（沿用 95：分母 0 → NULL，不写 0）。

**6. 本图明确不做**

`downrank` 的检索层降权；自动 reindex 对方文档；interim「暂均 index」可配置；admin 侧审阅页（功能表 §4.3 说「文档页抽屉或同页」，属 P1 的 UI 面，本图只落 API 与数据面，UI 另议）；生产 LSH（现为字 3-gram Jaccard）。

**7. 解锁**

→ [10 QUAL-E4](./10-qual-e4-pending-review.md)（实现落点 + 端点 + 策略位）。
