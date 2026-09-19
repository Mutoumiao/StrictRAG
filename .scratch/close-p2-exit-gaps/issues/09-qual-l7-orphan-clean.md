# QUAL-L7：孤儿清理 job（激活版永不删）

Type: task
Status: resolved
Blocked by: 03

## Question

剧本 L7：孤儿清理 job —— 清「半写非激活 version」的对象（PG 向量 / mock ES 单边残留）。护栏：**激活版永不删**。触发含周期 + 文档 `failed`。

前图已查明前置：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败后它指向失败版本，而上一个可检索版本的数据仍在 → 「当前激活 version」不可断言，硬做会误删。**本票在 [裁定文档「当前激活 version」表示](./03-dec-active-version.md) 落定后实现。**

要做的：

1. 按 03 的决定读写「当前激活 version」。
2. 清理 job 本体：识别「单边有向量或 ES」且**非激活** 的残留，幂等、可重入。
3. 周期触发若依赖尚不存在的调度基建，**明说留待**，只落可手工 / 可入队的一次性路径。
4. 失败不得「抬 version」、不得误删激活版。

补测必须包含**反例**：「激活版不被删」；以及「reindex 失败后上一版仍可检索」不被清理破坏。

## Answer

按前置 [03 的裁定](./03-dec-active-version.md) 实现。

### 一、激活表示（迁移 `0020`）

- `packages/db/src/schema/kb/documents.ts` 新增 `activeIndexVersion`（`active_index_version`，**可空无默认**）。
- 迁移 `packages/db/drizzle/0020_documents_active_index_version.sql`（手写 SQL + 手写 journal 条目 `idx: 20`）：加列 + 回填 `status='ready'` 的行，其余留 `NULL`。
- **写入点唯一**：`apps/worker/src/ingest/pipeline.ts` 的 `es_index` 成功那一次 `setDoc`，与 `status='ready'`、`esReady=1` **同一条 UPDATE**（PRD 的「原子激活」）。所有失败路径都不碰它。

### 二、清理 job

新增 `apps/worker/src/ingest/orphan-clean.ts`：

- 纯函数 `planOrphanClean(doc, presence)` 判定该清哪些 version；
- 编排 `cleanOrphans(docId, deps, esSideAvailable)`：先判定，再**双侧**（PG 向量 + mock ES）清理；跳过时不产生任何写；
- 生产接线 `defaultOrphanCleanDeps(db)`；`mockEsStore` 补 `listVersions` / `dropVersion`（按 `docId:vN` 单侧删）。

**对象与护栏**（按 PRD §2.4 逐条）：

| 规则 | 实现 |
|------|------|
| 对象 | **单边**（一侧有、另一侧为空）· 且 `status != ready` · 且非激活、非在飞 |
| 护栏 1 | `index_version != 当前激活` → 激活版永不删 |
| 护栏 2 | `!= documents.index_version` → 在飞版不删 |
| 护栏 3 | `active_index_version IS NULL` → **一律不动手**（宁可不清理） |
| 动作 | PG 向量 + ES 双侧 |
| 完整旧版 | 两侧都有的版本**不属「半套」**，不清（保守） |

### 三、触发

PRD 的触发是「周期 + 文档 `failed`」。**周期调度未落地**（本仓无调度基建，不在本图）。今天落的是 `failed` 那一半：

- `runIngestStage` 在阶段返回 `errorCode` 后调用 `cleanOrphansOnFailure(docId, deps)`；
- 可经 `IngestStageDeps.cleanOrphans` 注入（测例用）；
- **best-effort**：任何异常只 `warn`，**不改变阶段结果**（与失败 Webhook 同型）。

### 四、真 ES 侧

`INGEST_ES_MODE != 'mock'`（真 ES 属 B8 延期）时**整体跳过**（reason `es_side_unavailable`）：判定依赖两侧计数，缺一侧就不该动手。**未**实现真 ES 的按 version 删除。

### 五、测例（14 条 · 反例优先）

- `tests/ingest/orphan-clean.test.ts`（9 条）：三条护栏反例（激活版 / 在飞版 / 无激活表示）· `status=ready` 不进范围 · 完整旧版不清 · 正例清 v1 双侧 · 「无激活表示不得调用任何删除」· ES 侧不可用连库都不查 · 文档不存在。
- `tests/ingest/orphan-clean-on-failure.test.ts`（2 条）：embed 失败仍返回 `EMBED_FAILED` 且清理被调用一次；清理抛错只吞掉、结果不变。
- **反证**：把失败触发条件断开后，接线测例 **2/2 变红** → 已完整还原。
- 两处均登记 `apps/worker/tests/index.md`。

### 六、本图不做（写明）

周期调度基建；真 ES 集群侧清理（B8）；ACL 收紧的自动 reindex（前图 106 已裁决，不构成安全洞）。
