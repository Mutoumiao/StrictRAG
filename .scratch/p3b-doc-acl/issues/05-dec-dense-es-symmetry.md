# 裁定：dense ∥ ES 对称的实现路径

Type: grilling
Status: resolved
Blocked by: 02

## 问题

ADR-009 `prds/11-decisions/00-adr-index.md:152` 逐字：「**dense 与 ES 对称**：共用 `buildAclFilter(ctx)`；**禁止**仅 ES 滤、dense 裸召回（含「dense top-k 再交 ES」）」。现状：`buildAclFilter` 只在 ES 稀疏路被调用（`apps/api/src/services/retrieve/es-sparse.ts:234`），dense 走 PG 语料余弦。

## Answer

**裁定：取等价形态（B）——「PG 语料 = ACL 真值源；ES 查询期 filter 是 PG 谓词的严格超集（只做粗收窄），且 ES 命中一律经语料求交收口」。不实现 pgvector 查询期 filter（路径 A）。ADR-009 `:152` 的"共用 `buildAclFilter`"字面未满足 → 记 ADR 债。**

### 1. 为何不选路径 A

- **前置不存在**：本仓 dense 取候选不是数据库向量检索，而是「一次 `select` 该 KB 全部 `chunk_embeddings`（jsonb `number[]`）进内存 + JS `cosine()`」（`corpus.ts:117-121`、`retrieve.ts:163-170`）。数据库**无 `vector` 列、无扩展**（`packages/db/src/schema/kb/chunk-embeddings.ts:6` 明写"生产可换 pgvector 列"；`packages/db/drizzle/0000–0022` 无 `CREATE EXTENSION vector`）。要在 dense 查询期落 filter，须先加列 + HNSW + 回填既有 jsonb 向量 + 迁移 —— 这是**独立前置**（不被 B8 阻塞，被"pgvector 未实现"阻塞），且不在本图。
- **收益为零**：若只写成 `inArray(chunkEmbeddings.chunkId, allowedChunkIds)`，与今天**逐位等价**（`corpus.ts:119` 本就只取语料内 chunk），不产生任何新语义；为等价结果引入"两套 ACL 真值源需防漂移"的风险，是净负。
- **改为 pgvector 会动摇既定形态**：那会把「语料装载 = ACL 真值」改成"SQL WHERE 也是 ACL 谓词"，须与 PG 谓词同步演进，属架构变更，须 ADR。

### 2. 等价形态的成立条件（三条，均可核对）

1. **dense 与 mock-sparse 的输入同为 `corpus`**（`retrieve.ts:163-170`、`:205-212`），而 `corpus` 由 `loadCorpusFromDb` 在装载期过 `filterDocsForDeptAcl` + `filterDocsForAclPrincipals`（`corpus.ts:85-98`）→ dense 可达集合 ⊆ PG 真值集合。
2. **ES 命中必须落在 corpus 内**（`retrieve.ts:195` 的 `sparseRanked.filter((id) => byId.has(id))`），且 `sparseRanked` 只进入 RRF 融合与排序（`:220`、`:279`），不用于 membership / evidence 归属（candidates 由 corpus 建 `:234-242`，evidence 由 candidates 派生 `:282-306`）。
3. **ES 查询期谓词是 PG 谓词的超集**（弱化），才能满足"ES 收紧 ⇒ 只会少召回、不会多放行"。

**失效条件（必须同时成立才安全）**：任一处一旦把 ES 命中用于计数 / 直接渲染 / 直接作为 PG-Mongo 取正文的输入，或 `byId` 不再等于 ACL 真值源，本裁定立即失效，须回到"真 filter"路径。

### 3. 本图的动作（不是"什么都不做"）

- 任务票 `09` 会在**保持超集性质**的前提下**加深 ES 侧收窄**（补 `visibilityLevel` 级别组 + 缺 `ownerDeptId` 的库级分支）：这既是"ES 更接近 PG"的正向推进，也顺手消掉 `retrieve.ts:195` 兜底下"不可读命中白占 `size` 槽"的召回副作用。
- **"只加严"证明（写入任务票与测例注释）**：PG 可见 ⇒ 存在匹配部门 `eff ≥ vis` 且 `vis ≤ 用户可达级别上限` → 级别组命中；库级文档 PG 可见 ⇒ `vis ≤ (任一处负责人 ? 30 : 20)` → 同上命中。故新增条件只缩小 ES 命中集，不丢 PG 可见文档。
- **不得**为了"字面共用"而把 ES 侧条件改宽来提高一致性（方向相反）。

### 4. 记债（须 ADR → 改 PRD → 升版才能销账，本图不改 `prds/00–11`）

| 债 | 出处 | 性质 |
|---|---|---|
| 「dense ∥ ES **共用** `buildAclFilter(ctx)`」字面未满足 | ADR-009 `prds/11-decisions/00-adr-index.md:152` | 形态债；实质安全性由"语料求交 + 超集谓词"承担 |
| ES PRD 「与 dense 共用 `buildAclFilter(ctx)` 生成 filter，禁止两路各写一份 ACL」 | `prds/03-data/03-elasticsearch-bm25.md:163` | 同上 |
| dense 无查询期 WHERE 已含 ACL（PRD 期望形态） | `prds/04-pipelines/02-online-ask-langgraph.md:188` | 依赖 pgvector，属独立前置 |

已把上述三处写进 map「Not yet specified」，并要求任务票 `12` 在 `docs/module-status/api.md` 里以**不带行号**的表述记录该债。

### 5. 未验证

pgvector 是否存在（已核 `packages/db/drizzle/` 全 23 个迁移文件与 `chunk-embeddings.ts`）——**已核，无**。ES 真集群行为未验证（本裁定不依赖它）。
