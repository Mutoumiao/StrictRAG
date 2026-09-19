# QUAL-E4：pending_review 人工处理

Type: task
Status: resolved
Blocked by: 04

## Question

剧本 E4 的剩余部分：「跨 doc 近重复：指标可见；`pending_review` 可人工处理」。前图 80 已做同库近重复默认 `skip_index` + 报告写冲突对；95 已落 `dedupe_cross_doc_rate`（分母 0 → NULL 不写 0）。

**本票在 [裁定 pending_review 落点 / 端点 / KB 策略位](./04-dec-pending-review.md) 落定后实现**：按决定落「落点 + 人工处理端点 + KB 策略位」。

约束：

- 不得与 `needs_ocr` / 审批闸混用语义（`pending_review` 是去重语义，不是扫描语义）。
- 未记录如实「未记录」，不得补 0 假装。
- 不改 ADR-053 策略语义；不发明「高度重复」阈值（数据 PRD 无定义）。
- 端点须走 `packages/contracts` 信封；admin 入口是否含在本票以 04 的决定为准。

补测：放行 / 驳回两条路径 + 非成员 / 无权限拒绝 + 与既有去重报告的数值自洽。

## Answer

按前置 [04 的裁定](./04-dec-pending-review.md) 实现。

### 一、落点（迁移 `0021`）

- `packages/db/src/schema/kb/chunks.ts` 新增 `duplicateOf`（`duplicate_of`，可空）与 `dedupeStatus`（`dedupe_status`，可空）。
- 迁移 `packages/db/drizzle/0021_chunks_dedupe_review.sql`（手写 SQL + journal `idx: 21`）：加两列，**不设默认**（旧行保持 `NULL` = 不适用）。
- `packages/db/src/schema/kb/ingest-reports.ts` 的冲突对类型放宽为 `action: 'skip_index' | 'pending_review'` + 可选 `heldChunkId`。

### 二、KB 策略位

- 契约：`CrossDocDedupeActionSchema = z.enum(['skip_index','pending_review'])` + `DEFAULT_CROSS_DOC_DEDUPE_ACTION` + 纯函数 `parseCrossDocDedupeAction()`（缺省 / 脏值一律回落 `skip_index`）。
- `PatchKbSettingsBodySchema` 收该键；`KbSettingsSchema`（GET）回该键。
- **`downrank`（PRD 合法值但本仓无实现）→ 400 明确拒绝**，不留静默通道；测例 `packages/contracts/tests/kb/cross-doc-dedupe-action.test.ts` 钉住。
- `mergeKbSettingsPatch` 写 `config_json.crossDocDedupeAction` 并产出 diff（复用既有审计）。

### 三、worker 行为

`apps/worker/src/ingest/pipeline.ts` 的 chunk 段：

- 新增 `loadCrossDocDedupeAction(db, kbId)`（读 `knowledge_bases.config_json`）。
- `pending_review` 时：冲突块**落库**（`dedupeStatus='pending_review'` + `duplicateOf=<对方权威 chunkId>`），报告冲突对带 `heldChunkId`；该块**不进 manifest** → 不 embed / 不 ES（保守取「暂不 index」）。
- `skip_index`（默认）路径**逐位不变**；计数口径不变（待审也计入 `crossDocDropped`，与 95 的公式一致）。
- 全文都待审 → 与既有「无可索引块」同口径走 `EMPTY_CHUNKS`，**不得 ready**。

### 四、人工处理端点

- `POST /api/v1/documents/:docId/dedupe-conflicts/:chunkId/resolve`，body `{ winner: 'this' | 'other' }`。
- 权限 `doc.editor` ——**与 `PATCH /documents/:docId`、`PUT …/acl` 同码同姿态**（仓内文档写路径一贯不额外叠可见性闸；本票**不新开**一套更严或更松的闸，也不新增权限码，遵裁定 87「不改码表」）。
- 语义：仅 `pending_review` 可处理（否则 400；不存在 404）；`other` 保留 `duplicate_of`、`this` 清 `duplicate_of`，两者都清 `dedupe_status`。**只动这两列**，**不碰对方文档**。
- **不代跑 reindex**：`winner='this'` 时回 `reindexRequired: true`，重新入库仍由持 `doc.reindex` 的人触发 —— 这是刻意的**不做权限升级**（若本端点代为入队，等于把 `doc.reindex` 送给了只持 `doc.editor` 的人）。
- 契约：`packages/contracts/src/ingest/dedupe-conflict.contract.ts`。

### 五、测例（12 条）

- `packages/contracts/tests/kb/cross-doc-dedupe-action.test.ts`（3）：白名单通过 / `downrank` 与未知值拒 / 读取口径回落。
- `apps/worker/tests/ingest/cross-doc-pending-review.test.ts`（4）：held 行落库且不进 manifest + 报告带 `heldChunkId`；全文待审 → `EMPTY_CHUNKS`；默认 `skip_index` 行为不变；脏值（`downrank`）回落。
- `apps/api/tests/ingest/dedupe-conflict-resolve.test.ts`（5）：`other` / `this` 两种落库形状（含 `reindexRequired`）；非待审 400 且不改数据；不存在 404；坏 body 400。
- 三处均登记各自 `tests/index.md`。

### 六、本票不做（裁定四已写）

`downrank` 的检索层降权；自动 reindex 对方文档；interim「暂均 index」可配置（PRD 未给键名，记入地图雾中）；admin 审阅页（功能表 §4.3 的 UI 面，P1，另议）；生产 LSH（现为字 3-gram Jaccard）。
