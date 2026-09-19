# 裁定文档「当前激活 version」表示

Type: grilling
Status: resolved
Blocked by: 02

## Question

「当前激活 version」表示未冻，**同时挡住两处自动化**：孤儿清理（剧本 L7）与文档 ACL 收紧自动 reindex（前图 106 只做了外显 `reindexRequired` + 无泄漏证明）。

今天的死结：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败后它指向**失败版本**，而上一个可检索版本的数据仍在索引里 → 没有可信的「当前激活 version」可断言，硬做孤儿清理会**误删仍在服务的版本**。

请裁定表示落点与语义，逐项回答：

1. **落点**：加列（如 `active_index_version`）/ 加表 / 由 `status=ready` 快照派生 —— 选哪个，为什么；其余方案为何不选。
2. **迁移代价**：是否需要新 migration（本仓手写 SQL + 手写 journal 条目，`db:generate` 不可用），存量行怎么回填。
3. **写入时机**：谁在哪个阶段边界写它；reindex 失败、孤儿清理、删除与 purge 各自如何读它。
4. **一致性**：与 `chunks.index_version`、mock ES 侧 `index_version` 的对账口径；「单边有向量或 ES」的孤儿定义在有了激活表示后如何精确化。
5. **护栏**：写出「激活版永不删」的可测断言形状（反例优先）。
6. **明确留待**：哪些部分依赖尚未存在的基建（例如周期调度），本图不承诺。

答案须落到**可直接编码的精度**（列名 / 写入点 / 读取点 / 失败与回滚行为）。

## Answer

### 一、事实基线（PRD 已冻，逐行）

| 出处 | 原文要点 |
|------|----------|
| `prds/01-architecture/03-storage-boundaries.md:40` | 索引完成：双就绪 → PG `ready` + **原子**激活 version（ADR-038） |
| `prds/01-architecture/03-storage-boundaries.md:41` | 问答只读 `status=ready` ∧ `lifecycle=active` ∧ **匹配当前 `index_version`** + ACL |
| `prds/01-architecture/03-storage-boundaries.md:44` | 半套失败：未 ready 的 version **不进检索**；maintenance 清孤儿 |
| `prds/01-architecture/03-storage-boundaries.md:56-63` | §2.4 孤儿清理：触发 = 周期 + 文档 `failed`；对象 = 单边有向量或 ES、且 `status != ready`、且非活跃重试窗口；**护栏 = `index_version != 当前激活`；激活版永不删**；动作 = PG 向量 + ES 双侧 |
| `prds/01-architecture/03-storage-boundaries.md:46-54` | §2.3 对账 Job（每日/每小时）三项；告警孤儿率 / 缺档率 |
| `prds/02-engineering/02-orm-drizzle.md:29` | 事务用于：文档状态切换、**`index_version` 激活** |
| `prds/06-async/01-bullmq-jobs.md:73` | 「dense 与 sparse 均成功才 `status=ready` **并激活 version**」 |
| `prds/05-api/01-http-api-hono.md:177` | chunks 列表 = 当前**激活** `indexVersion` |
| `prds/03-data/03-elasticsearch-bm25.md:173` | 非激活半套 version 的 ES 文档由 maintenance **双侧**清理 |

**结论**：PRD 早已把「激活 version」当作一个**独立于 `index_version`** 的概念（激活是 ready 那一刻的动作，且要求原子）。仓库 IS 只有 `documents.index_version`，**没有这个表示**。

### 二、现状（IS）

- `documents.index_version` `notNull().default(0)`（`packages/db/src/schema/kb/documents.ts:34`），在 **chunk 段**就 `+1` 并落库（`apps/worker/src/ingest/pipeline.ts:504` → `:659-662`）；失败路径**不回退**。
- 重索引期间文档立刻离开 `ready`：chunk 段 `status='chunking'`（`:439`）→ embed 段 `embedding`（`:686`）→ es_index 段 `indexing_es`（`:803`）。
- 检索语料闸只放 `ready ∧ active`（`apps/api/src/services/retrieve/corpus.ts:42-55`），块闸再要求 `c.indexVersion === doc.indexVersion`（`corpus.ts:107-112`）。
- mock ES 键为 `docId:vN`，字段里没有 version（`apps/worker/src/ingest/es-store.ts:9-11`）。

### 三、对前图前提的更正（重要）

前图写的「reindex 失败后上一个可检索版本的数据仍在（旧版数据仍在，只是被闸排除）」**只对了一半**：版本 N 的 chunks / embeddings / ES 文档**物理仍在**，但它**并不在被检索** —— 双闸门在文档离开 `ready` 那一刻（chunk 段）就已挡住。

所以孤儿清理的真实风险不是「删掉正在服务的数据」，而是：**在没有激活表示时，清理规则只能靠 `status != ready` 这种粗判，会把「马上要重试的那一版」和「失败后仍要保留的上一版」一起卷进清理范围。** 这仍然需要「当前激活 version」这一表示，但理由要说准。

### 四、裁定

**1. 落点 —— 加列，不建表**
`documents` 新增 `active_index_version integer`，**可空、无默认**（`NULL` = 从未成功激活 / 旧行未回填）。

不取「由 `status=ready` 快照派生」的理由：该派生只在 `status=ready` 的瞬间成立；而需要它的场景恰恰是文档已离开 `ready`（重索引失败）之后 —— 那时已无法回答「哪一版是激活版」。

**2. 写入时机 —— 与 `ready` 同一条 UPDATE（PRD 的「原子」）**
只在 `es_index` 成功那一次 `setDoc` 里写，与 `status='ready'`、`esReady=1` 同语句（`pipeline.ts:936-941`），值取本轮 `indexVersion`。**其它任何阶段不得写该列**；`embed` / `es_index` 的失败路径不得改它。

**3. 读取方**
- **孤儿清理（§2.4）**：仅当某 chunk/ES 行的 `index_version != active_index_version` **且** `!= documents.index_version`（在飞那一版）时才可清。
- **对账 Job（§2.3）**：不改。
- **检索闸**：**不改**。PRD 逐字是「匹配当前 `index_version`」；改成读激活列属于改冻结语义，须 ADR → 改 PRD，不在本图。

**4. 迁移**
`packages/db/drizzle/0020_documents_active_index_version.sql`（手写 SQL + 手写 journal 条目；本仓 `db:generate` 不可用，见 [`research-drizzle-meta-baseline.md`](../fill-must-haves/research-drizzle-meta-baseline.md)）。
列可空无默认；回填 `UPDATE documents SET active_index_version = index_version WHERE status = 'ready'`；其余留 `NULL`。

**5. 护栏语义（写死，反例优先）**

| 场景 | 期望 |
|------|------|
| `active = 1`，存在 v2 半套残留 | **不得**删 v1（激活版） |
| 重索引中：`documents.index_version = 2`、`active = 1`、`status = failed` | **不得**删 v1，**也不得**删在飞的 v2 |
| `active IS NULL`（旧行 / 从未成功） | **一律不动手**（fail-safe：宁可不清理） |
| `active = 2`、`documents.index_version = 2`、v1 残留 | v1 可被**双侧**清理 |

**6. 本图不承诺**
周期触发（依赖尚不存在的调度基建）；对账 Job 的每日/每小时调度；**真 ES 集群**侧清理（B8 延期）——本图只覆盖 mock ES 适配层 + PG 向量侧；自动 reindex-on-tighten 仍不做（前图 106 已裁决）。

**7. 解锁**
本裁定是 [09 QUAL-L7 孤儿清理](./09-qual-l7-orphan-clean.md) 的前置；ACL 收紧自动 reindex 的表示前置也由此解开，但**实现仍不做**（无触发点，且不构成安全洞——见 106）。
