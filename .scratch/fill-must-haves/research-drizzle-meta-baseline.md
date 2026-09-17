# 取证报告 · `packages/db/drizzle/meta/` 基线缺失 → `db:generate` 不可用

| 字段 | 内容 |
|------|------|
| 类型 | 只读调研（**未**修改任何源码 / 配置 / 迁移 / 测试；**未**运行 `drizzle-kit generate` 或任何会写 `packages/db/drizzle/` 的命令） |
| 取证时间 | 2026-09-17 |
| 取证基线 | `main` @ `a7aa2bd`（`docs(fill-must-haves): 地图补本轮收口门禁数字`，2026-09-16） |
| 关联工单 | `.scratch/fill-must-haves/map.md` → `Not yet specified` · 「工程债（迁移工具）」 |
| 输出用途 | wayfinder 地图「下一张裁定工单」的取证材料 |

> **后记（2026-09-17 · 本批收口时补）**：本报告卡在 `a7aa2bd` 基线，故正文写「缺 `0001`–`0018` 共 **18** 份快照」「基线快照应命名 `0018_snapshot.json`」。本批工单 105 新增了迁移 `0019_ingest_report_contextualize_counts`（手写 SQL + 手写 journal 条目 idx 19），因此**当前事实是**：journal **20** 条（idx 0–19）、缺 `0001`–`0019` 共 **19** 份快照、基线快照应命名 **`0019_snapshot.json`**（**不能**叫 `0020`——那是下一次 `generate` 要写出的文件名）。报告其余结论（死因机制、`check` 假绿、`migrate` 不读快照、生成器无 `IF NOT EXISTS`、零漂移、无生产上线证据、推荐 A1）**不随该编号变化**，仍成立。地图同一处已按 19 修正。

---

## 0. 结论先行（TL;DR）

1. **债真实存在**：`packages/db/drizzle/meta/` 物理上只有 `0000_snapshot.json` 与 `_journal.json` 两个文件，而 `_journal.json` 有 **19 条** 条目（`idx` 0–18）对应 **19 个** `.sql` 文件。**缺 18 份快照**（`0001`–`0018`），不是文档里写的 `0001–0016`。
2. **已知事实的两处精度修正**：
   - 「`db:generate` 会重写全部 **26** 张表」→ 精确为 **25 张**：`schema_meta` 已被 `0000_snapshot.json` 覆盖且当前 schema 与之逐列一致，`generate` 不会重复产出它；产出为 **25 条 `CREATE TABLE` + 10 条 `CREATE UNIQUE INDEX`**。
   - 缺失范围是 `0001`–`0018`（18 份），而 `docs/module-status/db.md:54`、`.trellis/spec/db/backend/database-guidelines.md:193`、`.scratch/fill-must-haves/map.md:134` 三处仍写「`0001–0016` 快照未入库」——**文档陈述已滞后于仓库事实**。
3. **死因机制已用源码坐实（本轮新证据）**：`drizzle-kit` 取「最新快照」与做 `check` 校验时，都**只读 `meta/` 目录下物理存在的文件**（`readdirSync`），**不与 `_journal.json` 交叉校验**。因此缺快照既让 `generate` 退化为「从 `0000` 状态全量追平」，又让 `drizzle-kit check` **假绿**（永远输出不了这个债）。
4. **额外的严重性证据（本轮新证据）**：已安装的 `drizzle-kit@0.31.10` 生成器**不输出 `IF NOT EXISTS`**（PostgreSQL 建表模板为 `CREATE TABLE ${name} (`；`ALTER TABLE … ADD COLUMN "x"`；整份 bundle 里字符串 `IF NOT EXISTS` 出现 **0 次**）。故一份 `generate` 产物在**已建表的库上会直接报 `relation "…" already exists`**——「禁止提交 generate 产出」不是整洁性偏好，而是**避免 `migrate` 被写死**的硬约束。
5. **当前 schema 与 migration 反向核对结果：逐表一致，零漂移**。26 张表、350 个列、10 个显式唯一索引，**表集合完全一致，列名集合逐表完全一致**（脚本化核对，见 §3.3）。这是「重建基线的风险可控」的关键前提。
6. **无任何生产上线证据**（§7）：仓库无 Dockerfile / k8s / CD 部署件；compose 仅用于本地中间件（`docker/docker-compose.yml:13` 明写「业务进程 api/worker 仍用本地 `pnpm dev`（不在 compose 内）」）；模块成熟度是 `db`「可联调」、入库闭环「可演示（默认 mock）」；试点人签未完成（`map.md:16`「P3a 仍等 L2 人签」「人签仍图外」）。**故路径 B 的前提「生产尚未上线」成立**。
7. **推荐**：先做 **A1（只补 1 份 `0018_snapshot.json`）** 恢复 `generate` 增量能力（债务立即停止扩大），同步做 **C 的文档部分**（把 Gotcha 升为正式约定 + 明写 `db:generate` 误用事故面）；**不推荐 B2（压扁重编号）**——收益只是编号美观，代价是 6 处以上文档证据指针失效 + 所有本地库需重建。

---

## 1. `packages/db/drizzle/` 完整清单 与 `_journal.json`

### 1.1 目录清单（19 个 `.sql` + 2 个 meta 文件）

```
packages/db/drizzle/
├─ 0000_phase0_schema_meta.sql
├─ 0001_phase1_kb_docs.sql
├─ 0002_phase2_ask_foundation.sql
├─ 0003_b3_model_gateway.sql
├─ 0004_b4_platform_roles.sql
├─ 0005_b5_departments.sql
├─ 0006_b10_eval_runs.sql
├─ 0007_p3b_doc_dept_meta.sql
├─ 0008_p3b_dept_cross_grants.sql
├─ 0009_chunk_strategy_layers.sql
├─ 0010_eval_floor.sql
├─ 0011_ingest_reports.sql
├─ 0012_permission_definitions.sql
├─ 0013_kb_settings_audits.sql
├─ 0014_p3b_acl_principals.sql
├─ 0015_ingest_report_cross_doc.sql
├─ 0016_ingest_report_context_source.sql
├─ 0017_ask_traces_citations.sql
├─ 0018_ingest_report_dedupe_rate.sql
└─ meta/
   ├─ 0000_snapshot.json      ← 唯一一份快照
   └─ _journal.json
```

**结论**：migration 编号 `0000`–`0018`（共 19 个）。**19 个 `.sql` 全部存在**；`meta/` 下应存在 `0000_snapshot.json`–`0018_snapshot.json`（19 份），**实际只有 1 份 → 缺 18 份**。

### 1.2 `.sql` ↔ journal 条目一致性（脚本核对）

| 核对项 | 结果 |
|--------|------|
| journal 条目数 | **19**（`idx` 0–18，连续无缺号） |
| `.sql` 文件数 | **19** |
| `entry.tag` 与 `.sql` 文件名（去扩展名）逐条相等 | **true（19/19 全部相等）** |
| 存在 `.sql` 但 journal 无条目 | 无 |
| journal 有条目但无 `.sql` | 无 |

**结论：`.sql` 与 journal 条目**完全一一对应，不存在不一致**。真实缺口只在 `meta/*_snapshot.json`。**

### 1.3 `when` 时间戳取证（旁证「手写 journal」这一实践）

| idx | tag | `when` | ISO | 整点对齐 |
|-----|-----|--------|-----|----------|
| 0 | 0000_phase0_schema_meta | 1754280000000 | 2025-08-04T04:00:00Z | ✅ |
| 1 | 0001_phase1_kb_docs | 1754283600000 | 2025-08-04T05:00:00Z | ✅ |
| 2 | 0002_phase2_ask_foundation | 1754352000000 | 2025-08-05T00:00:00Z | ✅ |
| 3 | 0003_b3_model_gateway | 1754524800000 | 2025-08-07T00:00:00Z | ✅ |
| 4 | 0004_b4_platform_roles | 1754611200000 | 2025-08-08T00:00:00Z | ✅ |
| 5 | 0005_b5_departments | 1754697600000 | 2025-08-09T00:00:00Z | ✅ |
| 6 | 0006_b10_eval_runs | 1754937600000 | 2025-08-11T18:40:00Z | ❌ |
| 7 | 0007_p3b_doc_dept_meta | 1755360000000 | 2025-08-16T16:00:00Z | ✅ |
| 8 | 0008_p3b_dept_cross_grants | 1755446400000 | 2025-08-17T16:00:00Z | ✅ |
| 9 | 0009_chunk_strategy_layers | 1756339200000 | 2025-08-28T00:00:00Z | ✅ |
| 10 | 0010_eval_floor | 1756512000000 | 2025-08-30T00:00:00Z | ✅ |
| 11 | 0011_ingest_reports | 1756515600000 | 2025-08-30T01:00:00Z | ✅ |
| 12 | 0012_permission_definitions | 1756600000000 | 2025-08-31T00:26:40Z | ❌ |
| 13 | 0013_kb_settings_audits | 1756686400000 | 2025-09-01T00:26:40Z | ❌ |
| **14** | **0014_p3b_acl_principals** | **1788777151700** | **2026-09-07T10:32:31.700Z** | ❌（毫秒级，机器时间戳） |
| 15 | 0015_ingest_report_cross_doc | 1789488000000 | 2026-09-15T16:00:00Z | ✅ |
| 16 | 0016_ingest_report_context_source | 1789574400000 | 2026-09-16T16:00:00Z | ✅ |
| 17 | 0017_ask_traces_citations | 1789660800000 | 2026-09-17T16:00:00Z | ✅ |
| 18 | 0018_ingest_report_dedupe_rate | 1789747200000 | 2026-09-18T16:00:00Z | ✅ |

**要点**：
- `drizzle-kit` 写 journal 时用的是 `when: +new Date()`（`node_modules/drizzle-kit/bin.cjs:32953`），即**真实毫秒时间戳**。
- 索引 **14** 是唯一一个带毫秒尾数的时间戳（`…151700`），与 `drizzle-kit` 行为一致 → **`0014` 那一次很可能真的跑过 `generate`**；其余 17 条的 `when` 全是整点/整天取整值 → **人工写的**。
- 结合 §1.1 的缺失事实：`0014` 那一次 `generate` 产出的 `0014_snapshot.json` **从未入库**。
- 注意 `idx` 17 的 `when`（2026-09-17）与 `idx` 18（2026-09-18）**晚于**文件作者声明的最后更新时间 2026-09-16（`docs/module-status/db.md:9`），且 `idx` 18 的 ISO 落在取证日之后一天——这些是**人工取整时随手多推一天**的痕迹，可作「手写 journal」的旁证（非缺陷）。

### 1.4 `meta/_journal.json` 完整内容（逐字节照录）

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    { "idx": 0,  "version": "7", "when": 1754280000000, "tag": "0000_phase0_schema_meta",             "breakpoints": true },
    { "idx": 1,  "version": "7", "when": 1754283600000, "tag": "0001_phase1_kb_docs",                 "breakpoints": true },
    { "idx": 2,  "version": "7", "when": 1754352000000, "tag": "0002_phase2_ask_foundation",          "breakpoints": true },
    { "idx": 3,  "version": "7", "when": 1754524800000, "tag": "0003_b3_model_gateway",               "breakpoints": true },
    { "idx": 4,  "version": "7", "when": 1754611200000, "tag": "0004_b4_platform_roles",              "breakpoints": true },
    { "idx": 5,  "version": "7", "when": 1754697600000, "tag": "0005_b5_departments",                 "breakpoints": true },
    { "idx": 6,  "version": "7", "when": 1754937600000, "tag": "0006_b10_eval_runs",                  "breakpoints": true },
    { "idx": 7,  "version": "7", "when": 1755360000000, "tag": "0007_p3b_doc_dept_meta",              "breakpoints": true },
    { "idx": 8,  "version": "7", "when": 1755446400000, "tag": "0008_p3b_dept_cross_grants",          "breakpoints": true },
    { "idx": 9,  "version": "7", "when": 1756339200000, "tag": "0009_chunk_strategy_layers",          "breakpoints": true },
    { "idx": 10, "version": "7", "when": 1756512000000, "tag": "0010_eval_floor",                     "breakpoints": true },
    { "idx": 11, "version": "7", "when": 1756515600000, "tag": "0011_ingest_reports",                 "breakpoints": true },
    { "idx": 12, "version": "7", "when": 1756600000000, "tag": "0012_permission_definitions",         "breakpoints": true },
    { "idx": 13, "version": "7", "when": 1756686400000, "tag": "0013_kb_settings_audits",            "breakpoints": true },
    { "idx": 14, "version": "7", "when": 1788777151700, "tag": "0014_p3b_acl_principals",             "breakpoints": true },
    { "idx": 15, "version": "7", "when": 1789488000000, "tag": "0015_ingest_report_cross_doc",        "breakpoints": true },
    { "idx": 16, "version": "7", "when": 1789574400000, "tag": "0016_ingest_report_context_source",   "breakpoints": true },
    { "idx": 17, "version": "7", "when": 1789660800000, "tag": "0017_ask_traces_citations",           "breakpoints": true },
    { "idx": 18, "version": "7", "when": 1789747200000, "tag": "0018_ingest_report_dedupe_rate",      "breakpoints": true }
  ]
}
```

> 说明：源文件为 2 空格缩进的 139 行 JSON（`packages/db/drizzle/meta/_journal.json`）；上表为同内容的逐条一行表记，字段值、顺序、条目数与源文件完全一致（仅 `idx` 14 的 `when` 为 13 位毫秒值 `1788777151700`，见 `_journal.json:103-109`）。

### 1.5 git 历史取证：这些快照**从未被提交过**

```bash
git log --all --pretty=format: --name-only -- "packages/db/drizzle/meta/*" | Sort-Object -Unique
# → packages/db/drizzle/meta/_journal.json
# → packages/db/drizzle/meta/0000_snapshot.json

git log --all --oneline --diff-filter=D -- "packages/db/drizzle/meta/*"
# → （空）

git log --oneline -- packages/db/drizzle/meta/_journal.json
# → 17 次提交（0000 初始提交 + 0001…0018 每一版一次）
```

**结论**：
- 全部分支历史上，`meta/` 下**只出现过这 2 个文件**；**不存在任何一次「删除快照」的提交**。
- 即：`0001`–`0018` 的快照**从来没有 `git add` 过**（本地可能生成过随即被删，`0014` 的机器时间戳是旁证）。**无法从 git 历史找回**。
- 每一次 migration 的提交形态都是「`.sql` + 手改 `_journal.json`」，例如 `6f35e30 feat: 文档级 aclPrincipals 用户 uuid 名单最小闭环`：
  ```
  packages/db/drizzle/0014_p3b_acl_principals.sql | 1 +
  packages/db/drizzle/meta/_journal.json          | 7 +++++++
  ```
- `.gitignore` 未排除快照：`git check-ignore -v packages/db/drizzle/meta/0014_snapshot.json` **无输出（exit 1 = 未被忽略）**；`packages/db/.gitignore`、`packages/db/drizzle/.gitignore` 均**不存在**。→ 不是「被忽略所以没提交」，是**没提交**。

---

## 2. `package.json` scripts、drizzle 版本、`drizzle.config.ts`

### 2.1 `packages/db/package.json`（全文 33 行，`"scripts"` 位于 L10–L18，各命令 L11–L17）

```json
"scripts": {
  "build":       "tsc --noEmit",
  "check-types": "tsc --noEmit",
  "lint":        "eslint . --max-warnings 0",
  "test":        "node ../../scripts/check-test-inventory.mjs && vitest run",
  "db:generate": "drizzle-kit generate --config drizzle.config.ts",
  "db:migrate":  "drizzle-kit migrate --config drizzle.config.ts",
  "db:studio":   "drizzle-kit studio --config drizzle.config.ts"
}
```

**要点**：
- **没有 `db:push` 脚本**。但两处规范仍写「生产禁止 `db:push`」（`.trellis/spec/db/backend/database-guidelines.md:191`；`.trellis/spec/db/backend/index.md:19`）——是**预防性禁令**，不是对现存脚本的约束。
- 没有 `db:check` / `db:up` / `db:drop` 脚本（但这几个子命令在已安装的 `drizzle-kit` 里**是存在的**，见 §6.1，可直接 `--config` 调用）。
- 没有 `db:generate` 的防护包装（无 `--name`、无任何「禁止提交」闸门）。

### 2.2 版本

| 项 | 值 | 证据 |
|----|----|------|
| catalog 声明 | `drizzle-orm: ^0.45.2` · `drizzle-kit: ^0.31.4` | `pnpm-workspace.yaml:30` · `pnpm-workspace.yaml:35` |
| **实际安装的 drizzle-kit** | **0.31.10** | `packages/db/node_modules/drizzle-kit/package.json` → `"version": "0.31.10"` |
| `packages/db` 依赖写法 | `drizzle-orm: "catalog:"`（L22）· `drizzle-kit: "catalog:"`（L31，devDep） | `packages/db/package.json` |
| 根脚本 | `db:generate` / `db:migrate`（无 `db:push`） | `package.json:23-24` |

### 2.3 `packages/db/drizzle.config.ts`（全文 20 行）

```ts
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit 配置。
 * DATABASE_URL 仅用于 generate/migrate CLI；运行时连接见 src/client.ts。
 */
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://strict_rag:strict_rag@127.0.0.1:5432/strict_rag';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
  schemaFilter: ['public'],
});
```

**要点**：
- `out: './drizzle'`（相对包目录）→ 生成物直接落在受控目录，无隔离层。
- `schema: './src/schema/index.ts'`（单一入口，`index.ts` 再 re-export 全部表，见 `packages/db/src/schema/index.ts`）。
- **未**配置 `migrations`（迁移记录表名/ schema）→ 用默认 `drizzle.__drizzle_migrations`。
- `strict: true`：会让 drizzle-kit 在**破坏性变更**时要求确认（对 `generate` 的「全量重写」这个场景**不构成保护**，因为增量里全是 `CREATE TABLE`，不是 `DROP`）。
- `dbCredentials` 有默认值 → 没有 `.env` 也能连；`generate` 本身**不需要连库**。

---

## 3. `packages/db/src/schema/` 表清单 ↔ migration 差异核对

### 3.1 表清单（26 张 · 文件名 + 导出符号 + 列数）

列数 = drizzle 列构建器调用数（`...baseColumns` 展开为 5 列：`id` / `created_at` / `created_by` / `updated_at` / `updated_by`，见 `packages/db/src/schema/_shard/base-columns.ts:10-27`）。

| # | 表名 | 导出符号 | schema 文件 | 列数 | 建表 migration |
|---|------|----------|-------------|-----:|----------------|
| 1 | `schema_meta` | `schemaMeta` | `system/schema-meta.ts` | 7 | `0000_phase0_schema_meta.sql` |
| 2 | `knowledge_bases` | `knowledgeBases` | `kb/knowledge-bases.ts` | 10 | `0001_phase1_kb_docs.sql` |
| 3 | `documents` | `documents` | `kb/documents.ts` | 38 | `0001` + 列增量 `0007`/`0014` |
| 4 | `chunks` | `chunks` | `kb/chunks.ts` | 16 | `0001_phase1_kb_docs.sql` |
| 5 | `chunk_manifests` | `chunkManifests` | `kb/chunk-manifests.ts` | 12 | `0001` |
| 6 | `chunk_embeddings` | `chunkEmbeddings` | `kb/chunk-embeddings.ts` | 13 | `0001` |
| 7 | `ingest_jobs` | `ingestJobs` | `kb/ingest-jobs.ts` | 14 | `0001` |
| 8 | `users` | `users` | `system/users.ts` | 12 | `0002_phase2_ask_foundation.sql` |
| 9 | `kb_members` | `kbMembers` | `kb/kb-members.ts` | 9 | `0002` |
| 10 | `ask_sessions` | `askSessions` | `ask/ask-sessions.ts` | 10 | `0002` |
| 11 | `ask_traces` | `askTraces` | `ask/ask-traces.ts` | 25 | `0002` + 列增量 `0017` |
| 12 | `ask_feedback` | `askFeedback` | `ask/ask-feedback.ts` | 15 | `0002` |
| 13 | `model_providers` | `modelProviders` | `system/model-providers.ts` | 14 | `0003_b3_model_gateway.sql` |
| 14 | `model_bindings` | `modelBindings` | `system/model-bindings.ts` | 11 | `0003` |
| 15 | `platform_roles` | `platformRoles` | `system/platform-roles.ts` | 11 | `0004_b4_platform_roles.sql` |
| 16 | `user_roles` | `userRoles` | `system/platform-roles.ts` | 8 | `0004` |
| 17 | `departments` | `departments` | `system/departments.ts` | 12 | `0005_b5_departments.sql` |
| 18 | `user_departments` | `userDepartments` | `system/departments.ts` | 11 | `0005` |
| 19 | `eval_runs` | `evalRuns` | `ask/eval-runs.ts` | 24 | `0006_b10_eval_runs.sql` + 列增量 `0010` |
| 20 | `dept_cross_grants` | `deptCrossGrants` | `system/dept-cross-grants.ts` | 11 | `0008_p3b_dept_cross_grants.sql` |
| 21 | `chunk_strategy_definitions` | `chunkStrategyDefinitions` | `kb/chunk-strategy-definitions.ts` | 9 | `0009_chunk_strategy_layers.sql` |
| 22 | `kb_chunk_strategies` | `kbChunkStrategies` | `kb/kb-chunk-strategies.ts` | 10 | `0009` |
| 23 | `gold_questions` | `goldQuestions` | `ask/gold-questions.ts` | 13 | `0010_eval_floor.sql` |
| 24 | `ingest_reports` | `ingestReports` | `kb/ingest-reports.ts` | 21 | `0011_ingest_reports.sql` + 列增量 `0015`/`0016`/`0018` |
| 25 | `permission_definitions` | `permissionDefinitions` | `system/permission-definitions.ts` | 5 | `0012_permission_definitions.sql` |
| 26 | `kb_settings_audits` | `kbSettingsAudits` | `kb/kb-settings-audits.ts` | 9 | `0013_kb_settings_audits.sql` |

**合计：26 张表 · 350 列。**（`system/departments.ts` 与 `system/platform-roles.ts` 各自导出 2 张表。）

### 3.2 migration 侧汇总（脚本解析 19 个 `.sql`）

| 分类 | 数量 | 明细 |
|------|-----:|------|
| `CREATE TABLE IF NOT EXISTS` | **26** | 表集合与 §3.1 完全一致 |
| `ALTER TABLE … ADD COLUMN IF NOT EXISTS` | **11** | `documents` +3（`owner_dept_id`,`visibility_level`,`acl_principals`）· `eval_runs` +3（`status`,`job_id`,`error_message`）· `ingest_reports` +4（`cross_doc_dropped`,`conflict_pairs`,`context_source`,`dedupe_cross_doc_rate`）· `ask_traces` +1（`citations`） |
| `CREATE UNIQUE INDEX IF NOT EXISTS` | **10** | `kb_members_kb_user_uidx` · `model_bindings_scope_purpose_uidx` · `platform_roles_tenant_code_uidx` · `user_roles_user_role_uidx` · `departments_tenant_code_uidx` · `user_departments_user_dept_uidx` · `dept_cross_grants_user_dept_uidx` · `kb_chunk_strategies_kb_code_uidx` · `gold_questions_kb_case_uidx` · `ingest_reports_doc_version_uidx` |
| 列级唯一约束（非索引语句） | 1 | `schema_meta` 的 `CONSTRAINT "schema_meta_key_unique" UNIQUE("key")`（来自 `text('key').notNull().unique()`） |
| `INSERT`（种子数据） | 1 | `0009_chunk_strategy_layers.sql:28-33` 三条 `chunk_strategy_definitions`（`ON CONFLICT DO NOTHING`；**generate 不会产出**） |

### 3.3 差异核对结论：**逐表逐列一致，零漂移**

用脚本对「schema 列名集合」与「migration 列名集合」做**集合级比对**（`baseColumns` 展开为 5 个物理列名）：

```
schema tables=26  migration tables=26
schema-only:      []          ← schema 有、migration 没有的表
migration-only:   []          ← migration 有、schema 没有的表
columns identical for all shared tables (name-level)
```

- **表差异：0**（26 = 26，双向无独有）
- **列名差异：0**（26 张表逐表比对，无任何一侧独有的列）
- 列数逐表核对同样一致（`schema_meta` 在 SQL 侧多计 1 是因为统计把 `CONSTRAINT … UNIQUE` 行算了进去，实际列 = 7）。

**这是基线重建的关键风险点，而当前答案是「无风险」**：不存在「schema 里已有但 migration 里没有」或反向的表/列。

**未覆盖的核对维度（必须明说，避免高估）**：
- 本核对是**列名级**；**未**机器核对「类型 / 默认值 / NOT NULL / 精度」的文字等价性。例如：
  - `chunk_strategy_definitions.implemented` / `.system` 用的是 `boolean`（SQL `boolean DEFAULT false`），而仓内其他布尔旗标多用 `integer DEFAULT 0`（如 `documents.embed_ready`）。
  - `timestamp(0)`、`varchar(64)`、`jsonb DEFAULT '{}'::jsonb` 等文本形态需人工比对。
- 本核对**不含**索引列顺序、外键（本仓 schema 未声明任何外键）、`onUpdate`/$defaultFn（drizzle 运行期行为，不进 DDL）差异。
- 若采纳路径 A/B，**建议把「类型/默认值级比对」补成一次性人工走查**（26 表 350 列 + 10 索引，规模可控），否则新基线可能把 DDL 文字差异固化成「未来 generate 会试图 ALTER」的假增量。

---

## 4. `0000_snapshot.json` 摘要与其与当前 schema 的差距

### 4.1 格式与内容摘要

| 字段 | 值 | 行 |
|------|-----|----|
| `id` | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` | `meta/0000_snapshot.json:2` |
| `prevId` | `"00000000-0000-0000-0000-000000000000"` | `:3` |
| `version` | `"7"` | `:4` |
| `dialect` | `"postgresql"` | `:5` |
| `tables` | **1 张**：`public.schema_meta` | `:6-68` |
| `enums` / `schemas` / `sequences` / `roles` / `policies` / `views` | 全为 `{}` | `:69-74` |
| `_meta` | `{ "columns": {}, "schemas": {}, "tables": {} }` | `:75-79`（文件共 80 行） |

`schema_meta` 在快照里的 7 个列（`:7-53`）：`id`(uuid, PK, notNull) · `created_at`(timestamp(0)) · `created_by`(varchar(64)) · `updated_at`(timestamp(0)) · `updated_by`(varchar(64)) · `key`(text, notNull) · `value`(text, notNull)；含 `uniqueConstraints.schema_meta_key_unique`（`columns: ["key"]`, `nullsNotDistinct: false`）；`indexes`/`foreignKeys`/`compositePrimaryKeys`/`policies`/`checkConstraints` 均 `{}`，`isRLSEnabled: false`。

**旁证：这份唯一在库的快照本身很可能也是手写的。**
- `drizzle-kit` 生成快照时用 `const id = randomUUID()`（`node_modules/drizzle-kit/bin.cjs:19851`）→ 真产物 id 是随机 UUID。
- 而库内 id `a1b2c3d4-e5f6-7890-abcd-ef1234567890` 是**键盘顺序式假 UUID**；`prevId` 是**全零 UUID**（`drizzle-kit` 对「首个迁移」正是用全零 prevId，故 prevId 合理，id 不合理）。
- 结论（供裁定参考，非定论）：这份快照**格式自洽、内容与 `0000_phase0_schema_meta.sql` 逐列一致**，但**不是原始 generate 产物**。

### 4.2 与当前 schema 的差距

| 维度 | `0000_snapshot.json` | 当前 schema | 差距 |
|------|---------------------|-------------|------|
| 表数 | **1** | **26** | **+25 张** |
| 列数 | 7 | 350 | +343 |
| 唯一约束/索引 | 1（`schema_meta_key_unique`） | 11（1 列级 + 10 显式索引） | +10 |
| `schema_meta` 本身 | 7 列 | 7 列 | **完全一致 → generate 不会重复产出** |

**这就是「`db:generate` 退化」的精确口径**：`generate` 会以 `0000_snapshot.json` 为 `prev`，diff 出 **25 张新表 + 10 个唯一索引**，写成一个新的 `0019_<name>.sql` + `0019_snapshot.json`，并在 journal 追加第 20 条（`idx: 19`，`when` = 真实时间戳）。

> **修正地图口径**：`map.md:134` 写「会重写全部 **26** 张表的 `CREATE TABLE`」——精确应为 **25 张**（`schema_meta` 不重复）。此修正不影响裁定，但影响工作量估算（少 1 条语句）。

### 4.3 格式版本与 drizzle-kit 版本匹配性

| 项 | 值 | 判定 |
|----|----|------|
| 快照 `version` | `"7"` | — |
| `drizzle-kit` 对 `postgresql` 要求的快照版本 | `{ validator: backwardCompatiblePgSchema, version: 7 }`（`bin.cjs:8139` 起，`version: 7` 在 `L8142`） | **匹配** |
| journal `version` / `dialect` | `"7"` / `"postgresql"` | 匹配 |
| journal 每条 `version` | `"7"`（19/19 条） | 匹配 |
| 已安装 drizzle-kit | `0.31.10` | — |

**结论：格式版本与工具链版本完全匹配，不存在「快照需先 `drizzle-kit up` 升级」的问题。** 债纯粹是「文件不在」，不是「格式过时」。

---

## 5. 现存约定原文

### 5.1 `.trellis/spec/db/backend/database-guidelines.md`

**（a）迁移 runbook（`### 迁移 runbook（X-22 · 最小可执行）`，起始 `L89`；步骤表 L92–L97，「禁项」表 L99 起）**

| 步骤 | 命令 / 动作 |
|------|-------------|
| 1 改 schema | 只改 `packages/db/src/schema/**` |
| 2 生成 | 在 `packages/db`：`pnpm drizzle-kit generate`（以包脚本为准） |
| 3 审 SQL | 读 `drizzle/` 新 migration；**禁**手改历史已应用文件 |
| 4 本地升 | `pnpm` 包内 migrate / 根脚本（见 `docs/module-status` / docker compose） |
| 5 验证 | `pnpm --filter @strict-rag/db test` + api/worker 冒烟 |
| 6 回滚策略 | 前向修复优先；destructive drop 须双人 + 备份 |

**禁项（同节）**：`业务 route 内 CREATE TABLE` → 只走 drizzle-kit；`api/worker 各维护一份 schema` → 唯一 `packages/db`；`未 migrate 就宣称「表已齐」` → IS 以 migration 目录 + 实库为准。

> ⚠️ **规范内部冲突（本轮取证发现）**：同一份 spec 的 runbook 第 2 步要求「`pnpm drizzle-kit generate` 生成」，而下方 Gotcha（L193）承认 generate 已不可用并要求「手写 migration SQL + 手写 journal」。**规范正文与实测债互相矛盾**，这是本债最容易被新人踩中的地方。

**（b）Gotcha 原文（`## 迁移流程` 节，L193，逐字照录）**

> **Gotcha（实测）**：`drizzle/meta/` 只留了 `0000_snapshot.json`（`0001–0016` 的快照未入库），所以 `db:generate` **不再产出增量**，而是把全部表按当前 schema 重写一遍全量 `CREATE TABLE`。当前有效实践是：**手写 migration SQL（`ALTER TABLE … ADD COLUMN IF NOT EXISTS`）+ 手写 `meta/_journal.json` 条目**（tag 用描述名，如 `0017_ask_traces_citations`、`0018_ingest_report_dedupe_rate`，`idx` 递增）；`db:generate` 输出只当对照。**禁止**提交全量 `CREATE TABLE` 的生成结果。补基线快照另开工单。

**（c）同节紧邻的两条通用禁令（L190–L191）**

```
- 评审 migration SQL
- **生产禁止** `db:push` 直接改线上
```

**（d）`.trellis/spec/db/backend/index.md:19`（Quality Check 清单）**
```
- [ ] migrate SQL 可评审；生产禁用裸 `db:push`
```

### 5.2 `docs/module-status/db.md`

**（a）「一句话状态」节后、`## 已具备能力` 之前的 Migrations 小节（L51–L54，逐字照录）**

> ### Migrations（journal 19 条，idx 0–18）
> - `0000_phase0_schema_meta` → `0018_ingest_report_dedupe_rate`（`drizzle/meta/_journal.json`）
> - 脚本：`db:generate` / `db:migrate` / `db:studio`（运维产品化流水线 **不**在本包宣称）
> - **实测债**：`drizzle/meta/` 只留 `0000_snapshot.json`（`0001–0016` 快照未入库）→ `db:generate` 不产增量、会重写全量 `CREATE TABLE`；当前有效实践是**手写 migration SQL + 手写 journal 条目**（`db:generate` 输出只当对照）。补基线快照仍缺口

**（b）同文件其它相关原文**
- `:9` 最近更新：「2026-09-16（`ingest_reports.dedupe_cross_doc_rate`，migration `0018`；`ask_traces.citations`，migration `0017`；均无默认）」
- `:74` 明确未做 / 边界（`## 明确未做 / 边界` 起始 `L64`）：「自动 migration 流水线产品化 | 仅有 drizzle-kit 脚本」
- `:103` 证据表：「Journal | `packages/db/drizzle/meta/_journal.json`」

**（c）地图侧（`.scratch/fill-must-haves/map.md:134`，位于 `## Not yet specified`（`L125`）内，逐字照录）**

> - **工程债（迁移工具）**：`packages/db/drizzle/meta/` 只留 `0000_snapshot.json`（`0001–0016` 快照未入库）→ `db:generate` 不产增量、会重写全部 26 张表的 `CREATE TABLE`。当前靠**手写 migration SQL + 手写 `_journal.json` 条目**维持（migration `0017` 即如此）。补基线快照 / 恢复 generate 流程另开工单；在此之前**禁止**提交 generate 的全量产出

**（d）文档滞后（三处同源）**：`docs/module-status/db.md:54`、`.trellis/spec/db/backend/database-guidelines.md:193`、`map.md:134` 三处都写「`0001–0016` 快照未入库」，**实际缺口已到 `0001–0018`**（`0017`、`0018` 也是手写的）。同一份 `db.md:9` 却已把更新日期写到 2026-09-16 并列出 0017/0018 → **同一文件内自相矛盾**。

---

## 6. `drizzle-kit@0.31.10` 行为取证（本轮新证据，决定「怎么验证」）

以下均从**已安装的** `packages/db/node_modules/drizzle-kit/bin.cjs`（3,693,410 字节）读出，非记忆、非文档。

### 6.1 CLI 子命令清单（`name: "…"` 注册项）

`generate` · `migrate` · `push` · **`check`** · `up` · `drop` · `studio`。

- `check` 的 options = `{ config, dialect, out }`（`bin.cjs:92287-92295`）→ **只需要 `out` + `dialect`，不连库**。
- `generate` 的 options = `{ config, dialect, driver, casing, schema, out, name, breakpoints, custom, prefix }`（`bin.cjs:91954-91967`）→ **没有 `--dry-run`**。

### 6.2 `check` 的实现：**对本题假绿**（关键取证）

```js
// bin.cjs:8127
prepareOutFolder = (out, dialect6) => {
  const meta = path.join(out, "meta");
  const journalPath = path.join(meta, "_journal.json");
  ...
  const journal = JSON.parse(readFileSync(journalPath).toString());
  const snapshots = readdirSync(meta).filter((it) => !it.startsWith("_")).map((it) => path.join(meta, it));
  snapshots.sort();
  return { meta, snapshots, journal };
};
```

- 快照集合来自 **`readdirSync(meta)` 的物理文件**，`journal` 被读出来**但从不用于校验快照是否齐全**。
- `checkHandler`（`bin.cjs:91716`）只做三件事：`nonLatest`（`snapshot.version !== "7"`）、`malformed`（Zod 校验失败）、`idsMap` 里同一 `prevId` 被 ≥2 个快照引用（collision）。
- 目录里只有 1 份 `0000_snapshot.json` → `version = "7"` 通过、Zod 通过、无 collision → **`drizzle-kit check` 静默 exit 0**。

> **可验证结论：`drizzle-kit check` 永远发现不了这个债。** 任何「跑一下 check 就放心」的验证方案都是无效的，必须写进裁定。

### 6.3 `generate` 的 `prev` 取法：取目录里「排序最后」的快照

```js
// bin.cjs:19862
preparePrevSnapshot = (snapshots, defaultPrev) => {
  let prevSnapshot;
  if (snapshots.length === 0) {
    prevSnapshot = defaultPrev;
  } else {
    const lastSnapshot = snapshots[snapshots.length - 1];      // ← 物理目录排序末位
    prevSnapshot = JSON.parse(fs.readFileSync(lastSnapshot).toString());
  }
  return prevSnapshot;
};
```

- `snapshots` 即 §6.2 的 `readdirSync` 结果（`sort()` 后）。当前末位 = `0000_snapshot.json`。
- **推论（对裁定极重要）**：只要在 `meta/` 里放一份**文件名排序在最后、且内容等于当前 schema** 的快照文件，`generate` 就会立刻恢复「无变更 → 无产出」的正常状态。**不需要补齐 18 份历史快照**即可恢复工具链。

### 6.4 产出命名与 journal 追加逻辑

```js
// bin.cjs:32919-32958
if (type === "none") {
  console.log(schema(cur));
  if (sqlStatements.length === 0) { console.log("No schema changes, nothing to migrate 😴"); return; }   // ← 硬指标
}
const lastEntryInJournal = journal.entries[journal.entries.length - 1];
const idx = typeof lastEntryInJournal === "undefined" ? 0 : lastEntryInJournal.idx + 1;
const { prefix, tag } = prepareMigrationMetadata(idx, prefixMode, name);
writeFileSync(path.join(metaFolderPath, `${prefix}_snapshot.json`), JSON.stringify(toSave, null, 2));
...
journal.entries.push({ idx, version: cur.version, when: +new Date(), tag, breakpoints });
writeFileSync(metaJournal, JSON.stringify(journal, null, 2));
writeFileSync(`${outFolder}/${tag}.sql`, sql);
```

- 新 `idx` = journal 末条 `idx + 1` = **19**；新快照名 = **`0019_snapshot.json`**；新 SQL = **`0019_<name>.sql`**；journal 追加第 **20** 条（`when` 为真实毫秒）。
- 快照 id 用 `randomUUID()`，`prevId` = `prev.id`（`bin.cjs:19851-19853`）。
- **`No schema changes, nothing to migrate 😴` 是「基线恢复成功」唯一的、可自动断言的硬指标。**

### 6.5 `migrate` 不读快照 → 解释「为何手写流程今天能跑」

```js
// bin.cjs:92036-92048
const { preparePostgresDB } = await ...;
const { migrate } = await preparePostgresDB(credentials2);
await renderWithTask(new MigrateProgress(),
  migrate({ migrationsFolder: out, migrationsTable: table6, migrationsSchema: schema6 }));
```

- 只传 `migrationsFolder` → `migrate` 依赖 `meta/_journal.json` + `${tag}.sql`，**完全不碰 `*_snapshot.json`**。
- **这就是「手写 SQL + 手写 journal」至今可用的根因**；也意味着**删/加快照不会影响 `migrate`**。

### 6.6 **生成器不输出 `IF NOT EXISTS`**（本债真正的爆炸半径）

```js
// bin.cjs:23078-23087  PgCreateTableConvertor
convert(st) {
  ...
  let statement = "";
  const name = schema6 ? `"${schema6}"."${tableName}"` : `"${tableName}"`;
  statement += `CREATE TABLE ${name} (\n`;        // ← 无 IF NOT EXISTS
```
```js
// bin.cjs:23988  PgAddColumnConvertor
return `ALTER TABLE ${tableNameWithSchema} ADD COLUMN "${name}" ${fixedType}${...}${...}${...}${identityStatement};`;
                                                   // ← 无 IF NOT EXISTS
```

全 bundle 检索：**字符串 `IF NOT EXISTS` 出现 0 次**（`Select-String -SimpleMatch` 命中 0 行）。

**后果（比 spec 描述的「产出冗余 SQL」严重得多）**：
- 仓库手写的 26 条建表**全部**是 `CREATE TABLE IF NOT EXISTS`（幂等），而 generate 产物**不幂等**。
- 一份 generate 产物若被提交并进入 journal，`pnpm db:migrate` 在**任何已建表的库**（所有开发机、以及将来的 staging）上会立刻 `error: relation "users" already exists` 而**中断迁移链**；此后新增 migration 都无法 apply，直到人工介入。

> ✅ 这把 `map.md:134`「**禁止**提交 generate 的全量产出」从「整洁性纪律」升级为「**防事故硬闸**」，可直接写进裁定理由。

---

## 7. 「生产是否已上线 / 是否有真实数据」排查（决定路径 B 的前提）

### 7.1 排查结果：**无任何生产上线证据**

| 排查项 | 结果 | 证据 |
|--------|------|------|
| Dockerfile / k8s manifest / CD 部署件 | **不存在** | 全仓 `**/{Dockerfile,*.yml,*.yaml}` 检索 `deploy|k8s|staging|production` → 仅命中 `pnpm-lock.yaml` 的哈希噪声 |
| compose 用途 | **仅本地中间件** | `docker/docker-compose.yml:13`「业务进程 api/worker 仍用本地 `pnpm dev`（不在 compose 内）」 |
| 数据卷 | 4 个**本地**命名卷（`strict-rag-pg-data` 等） | `docker/docker-compose.yml:108-116` |
| 数据卷实况 | **无法核对**（本机 docker daemon 未运行：`open //./pipe/docker_engine: The system cannot find the file specified`） | 本轮 `docker volume ls` 失败 |
| 种子脚本性质 | **演示半链路**，走 HTTP API 造数据 | `scripts/seed-demo.mjs`（`scripts/README.md:8`「HALF-SEED：1 KB + 成员 + 1 篇 active 文档」） |
| 模块成熟度 | `db` = **可联调**；入库闭环 = **可演示**（scan/embed/ES **默认 mock**） | `docs/module-status/db.md:5`；`docs/module-status/README.md:70` |
| 明确的非生产声明 | 「**不是** 生产 ES、**不是** 真杀毒」 | `docs/ops/half-smoke.md:4` |
| 阶段与人签 | Phase 2 出口是「**可签字试点底线**」；人签**未完成** | `prds/10-delivery/01-phased-roadmap.md:41-48`；`.scratch/fill-must-haves/map.md:16`「P3a 仍等 L2 人签」、「人签仍图外」 |
| 全仓文本检索「生产已 / 已上线 / 未上线 / 生产尚未」 | **0 命中** | `grep -i '生产已|已上线|未上线|尚未上线'` over `docs/`、`**/*.md` → No matches |
| 运维 runbook 中「上线前检查」 | **前瞻性条款**（`prod/staging 上线/变更前必须勾选`），非「已上线」记录 | `prds/10-delivery/02-ops-runbook.md:265` |

### 7.2 判定

- **「生产尚未上线」成立**（无部署件、无生产数据证据、人签未过、依赖默认 mock）。→ **路径 B 的准入前提满足。**
- 但**仍有一条真实成本**：所有**开发机本地 PG 卷**都已 apply 过 `0000`–`0018`，其 `__drizzle_migrations` 记录会与任何「重编号 / 压扁」方案冲突 → 需 `docker compose -f docker/docker-compose.yml down -v` 重建本地卷（本地数据全丢，但本地数据本就是 demo 数据）。
- **建议裁定工单把「生产未上线」这一个前提显式写进 Answer**，否则以后翻案时无法证明路径 B 当时可用。

---

## 8. `packages/db/tests/` 中与 migration 一致性相关的测试

### 8.1 结论：**不存在**任何 migration 一致性测试

- 对 `packages/db/tests/` 全目录按 `_journal|drizzle/meta|drizzle-kit|\.sql|migration`（忽略大小写）检索 → **No matches found**。
- 现存 10 个测试文件（`packages/db/tests/index.md` 全表）全部是 **schema 形状断言**或**纯函数断言**，无一读取 `drizzle/`：

| 文件 | 断言对象 |
|------|----------|
| `acl/dept-grants-schema.test.ts` | `deptCrossGrants` 列形状 |
| `acl/permission-definitions-schema.test.ts` | `permissionDefinitions` 列形状 |
| `ask/ask-schema.test.ts` | `askSessions · askTraces · askFeedback · evalRuns · goldQuestions` 导出与关键列 |
| `ingest/documents-schema.test.ts` | `documents` 的 `ownerDeptId` / `visibilityLevel` / `aclPrincipals` |
| `ingest/ingest-reports-schema.test.ts` | `ingestReports` 唯一约束与事实列 |
| `ingest/chunk-strategy-schema.test.ts` | `chunkStrategyDefinitions · kbChunkStrategies` |
| `kb/settings-audits-schema.test.ts` | `kbSettingsAudits` |
| `retrieve/ready-active-gate.test.ts` · `retrieve/effective-window.test.ts` · `env/local-datetime.test.ts` | 纯函数 |

- `packages/db/tests/index.md` 末尾「## 待处理」写「（无。`src/` 下已无 `*.test.ts(x)`。）」——即**没有任何待办行**，也没有 migration 相关行。

### 8.2 现有的两道「门禁」都不覆盖本债

- `packages/db/package.json:14` 的 `test` = `node ../../scripts/check-test-inventory.mjs && vitest run`。该脚本按 `drizzle|migration|\.sql` 检索 → **No matches**，即它只校验「测试文件的登记完整性」，与迁移无关。
- `docs/testing/p0-redlines.md` 的 P0 红线清单里**没有**任何 migration / drizzle 相关条目（检索仅命中 `R10` 行里无关的 `schema` 字样）。

**含义**：本债**没有任何自动化护栏**；且**将来若要防回归（例如「journal 条目必须与 `.sql` 1:1」「新 `.sql` 必须含 `IF NOT EXISTS`」），需要新建测例**（属工具链改动，超出路径 C 的「只改文档」边界）。

---

## 9. 三条路径调研（只读判断，**均未执行**）

### 9.1 路径 A：补齐 `meta/00NN_snapshot.json`

路径 A 内部有两种粒度，**成本差一个数量级**，裁定必须二选一：

#### A1（最小可行 · 只补 1 份「当前状态」快照）

- **做法**：新增 `packages/db/drizzle/meta/0018_snapshot.json`，内容 = **当前 26 表 / 350 列的完整快照**；`prevId` 设为任意未被占用的 UUID（不可等于 `00000000-…-0000`，那会与 `0000_snapshot.json` 的 `prevId` 相撞触发 `check` 的 collision 分支）。
  - **正确生成方式（不污染仓库）**：把 `packages/db`（含 `drizzle/`、`src/schema/`、`drizzle.config.ts`）复制到**仓外临时目录**，在副本里跑一次 `drizzle-kit generate` → 产出 `0019_<name>.sql` + `0019_snapshot.json`；**只取快照**，改名 `0018_snapshot.json`，改写 `id`/`prevId`，**丢弃**那份 `.sql`。
  - **为何必须命名 `0018_` 而不是 `0019_`**：下一次 `generate` 的 `idx` = journal 末条 `+1` = **19** → 会写 `0019_snapshot.json`。若基线快照也叫 `0019_*`，它会被**覆盖**，`prevId` 链变成自引用（不会报错但语义脏）。命名为 `0018`（与 journal 末条 tag 对应）则无冲突。
- **要手写的文件数**：**+1**（`meta/0018_snapshot.json`，可由副本 generate 产物机器生成，无需手敲）。**不动**任何已有 `.sql`、**不动** journal。
- **风险**：**低**。
  - 已知副作用：`0001`–`0017` 快照仍缺，`prevId` 指向一个不存在的 id → 历史链名义残缺（`generate`/`migrate`/`check` 三个命令均不受影响，见 §6.2/6.3/6.5）。
  - 唯一实质风险：基线快照由 schema 生成，而**实库结构来自手写 SQL**；二者若在**类型/默认值级别**有差异（§3.3 未覆盖的维度），未来的增量 migration 会按「schema 的视图」而非「实库真相」推导。**故采纳前应先做一次 §3.3 的类型/默认值级人工走查。**
  - 收益：**债务立即停止扩大**——从下一次 schema 变更起，`generate` 恢复正常增量并自动落快照。
- **可验证方式**（全部只读或副本内）：
  1. 副本或本仓跑 `drizzle-kit generate` → 期望输出 **`No schema changes, nothing to migrate 😴`**（`bin.cjs:32922`）。**这是唯一硬指标。**
  2. `npx drizzle-kit check --config drizzle.config.ts`（只读、不连库）→ 期望**无 collision 无 malformed**（但**不能**用它证明快照齐全，见 §6.2）。
  3. `git status --porcelain packages/db/drizzle` → 期望只有新增的 1 个未跟踪文件。

#### A2（完整历史 · 补 `0001`–`0018` 共 18 份）

- **做法**：利用 git 历史逐版本重建。每个 migration 都有一个对应提交（17 次提交改过 `_journal.json`，见 §1.5），从每个提交取出当时的 `packages/db/src/schema/**`（`git show <sha>:…` 或 `git worktree`）到一个**仓外临时工作区**，按序跑 `drizzle-kit generate`（建议带 `--name` 以复现 tag），累积得到 18 份快照；只把 `*_snapshot.json` 拷回。
- **要手写的文件数**：**+18**（机器生成），外加一次「18 个历史 schema 版本的定位 + 落盘」脚本。
- **风险**：**中**。
  - 历史 schema 目录可能因依赖漂移而无法被 drizzle-kit 解析（如 `_shard/base-columns.ts` 的 import 路径 `../../time.js`、导出名变更）；每个版本需单独试跑。
  - 每步 generate 都会同时产出 `.sql` 噪声；**必须丢弃**（否则触发 §6.6 的 `relation already exists` 事故）。
  - 若某一步生成的 SQL 与仓库手写 SQL **语义不等**，说明当时「schema 与手写 SQL 已有漂移」——这是一个**额外的审计发现**，需人工解释（当前 `HEAD` 上是零漂移，但历史中间态可能有）。
- **可验证方式**：同 A1（最终以 `No schema changes, nothing to migrate 😴` 为硬指标）；另可加「`0018_snapshot.json` 内容与 A1 生成的等价」做交叉校验。
- **收益**：历史链完整、可回溯（`drizzle-kit drop` / `up` 等命令恢复可用语义）；但**对 `generate` 的可用性收益与 A1 完全相同**。

### 9.2 路径 B：把当前 schema 作为新基线（重置 meta、重新编号）

**前提核实：生产未上线 → 允许（§7）。** 路径 B 有两种形态，其中 B1 与 A 收敛，只有 B2 是真「重置」：

#### B1（重置 meta 但保留 19 个历史 `.sql`）

- 实质等价于 **A1/A2**（仍需要至少一份「当前状态」末位快照，否则 generate 依旧退化；journal 也必须保留 19 条，否则 `migrate` 不再 apply 历史 SQL）。
- **无额外收益、无额外成本** → **不建议单列，直接按 A 处理。**

#### B2（压扁为单一基线 migration，重新编号）

- **做法**：删除 `0000`–`0018` 共 19 个 `.sql`，改写成 1 个 `0000_init.sql`（26 条 `CREATE TABLE IF NOT EXISTS` + 10 条 `CREATE UNIQUE INDEX IF NOT EXISTS` + 1 段 `chunk_strategy_definitions` 种子 `INSERT … ON CONFLICT DO NOTHING`，可脚本拼接历史文件并按需补 `IF NOT EXISTS`）；`meta/` 重置为 1 份 `0000_snapshot.json`（由副本 generate 产出）+ 1 条 journal 条目。
- **要手写的文件数**：**净减 18**（19 `.sql` → 1）；`meta/` 净减 1（19 份应有快照 → 1 份实物）；journal 从 19 条 → 1 条。落地成本主要是**删除 + 1 个拼接产物 + 1 份生成快照**。
- **风险**：**中高**，且收益与成本严重不匹配：
  1. **文档证据指针大面积失效（最贵的一项）**。多份文档以「migration 文件名」作为**证据路径**，例如：
     - `.trellis/spec/db/backend/database-guidelines.md:135-136`（`0007_p3b_doc_dept_meta` / `0008_p3b_dept_cross_grants`）、`:148`（`0006_b10_eval_runs`）、`:153`（`0017_ask_traces_citations`）
     - `.trellis/spec/db/backend/index.md:5`（`0007`/`0011`/`0012`/`0013`/`0014`）
     - `docs/module-status/db.md:30-48`（`0003`/`0004`/`0005`/`0009`/`0011`/`0012`/`0013`/`0015`/`0016`/`0017`/`0018`）、`:95-103`（证据表，含 `:98` 的 `0006`/`0010`/`0017` 与 `:100` 的 `0012`）
     - `.scratch/fill-must-haves/map.md:117`（migration `0018`）等
     全部需要批量回写或加「历史编号已废止」注记——这本身是**一次跨包文档返工**。
  2. **所有本地库需重建**：`__drizzle_migrations` 里 19 条旧记录与新 journal 的 `when` 不匹配 → 必须 `docker compose -f docker/docker-compose.yml down -v`（本地 demo 数据全丢，成本可接受但需全员通知）。
  3. **`drizzle-kit migrate` 对 `when` 的敏感**：新 journal 单条 `when` 若晚于旧记录，行为需实测；建议一律「空卷重建」而非原地升级。
  4. 丢失「按阶段/按 B 编号的迁移史」——本仓把 migration 编号当作**节奏证据**（`b9d5740 feat(db): 落地 P3b-META…` 等），压扁后这条审计线消失。
- **可验证方式**：空卷 → `pnpm db:migrate` → 断言 26 张表齐（可 `\dt` 或 `information_schema` 计数）；再跑 `drizzle-kit generate` → 期望 `No schema changes, nothing to migrate 😴`；`pnpm --filter @strict-rag/db test` 绿；`pnpm test` 全仓绿。

### 9.3 路径 C：放弃 `generate`，把「手写 SQL + 手写 journal」固化为团队约定

- **做法（严格照「只改文档，不改工具链」）**：修改 `.trellis/spec/db/backend/database-guidelines.md`：
  - 把 `## 迁移流程` 的 runbook 第 2 步（`pnpm drizzle-kit generate`）**改为**「**新迁移一律手写**：`drizzle/NNNN_<描述名>.sql` + 在 `meta/_journal.json` 追加 `idx` 递增条目」；
  - 把 L193 的 Gotcha **从「实测债」升格为「正式约定」**，并补上 §6.6 的事故面（generate 产物**不带 `IF NOT EXISTS`**，提交后在已建表库上会 `relation already exists` 中断迁移链）；
  - 纠正「`0001–0016`」→「`0001–0018`」；
  - 明确 `db:generate` 的定位：**只在仓外副本里跑，产物不得进入仓库**。
  - 同步修 `docs/module-status/db.md:54`（同样纠正编号口径、补事故面）。
- **要手写的文件数**：**0 个代码/配置文件**；**2 个 markdown**（spec + module-status）。
- **风险**：**中（且是三种路径里唯一「风险只增不减」的）**。
  - **保留了一个可被误触的事故按钮**：`db:generate` 脚本仍在（`packages/db/package.json:15`、根 `package.json:23`），任何人一次误运行就会在 `drizzle/` 里落一份 `0019_*.sql` + `0019_snapshot.json`；若被误提交，`migrate` 在已建表库上**直接失败**（§6.6）。
  - **schema ↔ SQL 漂移风险随时间上升**：今天漂移为零（§3.3 已证），但「纯人工双写」没有机器校验，且 spec 的 runbook 与 Gotcha 现状**互相矛盾**，新人极可能照 runbook 走。
  - 债务**不会停止扩大**：`0019`、`0020`… 继续手写，快照缺口继续加宽（今天是 18，下次变 19）。
- **可验证方式**：**无技术验证手段**——只有文档审阅 + grep 纪律。若要机器护栏，需新建测例（例如断言「journal 条目与 `.sql` 文件 1:1 **且** 每个新建表语句含 `IF NOT EXISTS`」），但**那已属工具链改动，超出路径 C 的自我限定**。

---

## 10. 推荐路径 + 工作量 + 验证方式

### 10.1 推荐：**A1 + C（文档部分）组合**，不采 B2

**理由（按权重）**
1. **A1 是唯一以最小成本终止债务扩大的方案**：1 个生成文件，即恢复 `generate` 增量，`0019` 起每步自动落快照。B2 的额外收益只是「编号美观」，代价却是跨包文档返工 + 全员重建本地库。
2. **A1 的风险已用源码+核对压到最低**：`prev` 只取「物理目录末位快照」（§6.3）、`migrate` 不读快照（§6.5）、schema↔migration 零漂移（§3.3）。
3. **C 的文档部分必须同步做**，因为 `.trellis/spec/db/backend/database-guidelines.md` 的 runbook 第 2 步**当前就在教人跑一个会产事故的命令**；且三处文档的编号口径（`0001–0016`）已与事实（`0001–0018`）不符。
4. **A2 建议作为可选后续**：它不改变 `generate` 可用性（与 A1 等价），只补历史可回溯性；若裁定认为「历史链名义完整」有价值再单开工单。
5. **B2 明确不推荐**：违反「宁拒勿妄 · 证据优先」——它会**抹掉**本仓大量用作证据的 migration 编号，收益仅为形式。

### 10.2 工作量

| 项 | 文件数 | 说明 |
|----|-------:|------|
| **A1 必做** | **+1** | `packages/db/drizzle/meta/0018_snapshot.json`（内容 = 当前 26 表 / 350 列 / 10 唯一索引 / 1 列级唯一；由**仓外副本** `drizzle-kit generate` 产出后改名；`id` 换新 `randomUUID`，`prevId` 换非冲突 UUID） |
| A1 前置审计（强烈建议） | 0（人工走查） | 26 表 350 列 + 10 索引的**类型 / 默认值 / NOT NULL** 与手写 SQL 逐条比对（§3.3 未覆盖维度） |
| **C 文档部分** | **2（改）** | `.trellis/spec/db/backend/database-guidelines.md`（runbook §、L193 Gotcha）· `docs/module-status/db.md:54` |
| C 附带（可选，**属工具链改动**，需裁定显式允许） | +1 | 新建护栏测例（journal ↔ `.sql` 1:1、新建表语句含 `IF NOT EXISTS`），须落 `packages/db/tests/<能力>/` 并登记 `tests/index.md` |
| A2（可选后续） | +18 | 18 份历史快照（脚本化，含 18 个历史 schema 版本定位） |
| B2（不推荐） | 净 −18 | 19 `.sql` → 1 `0000_init.sql`，另有 ~6 处文档证据指针需回写 |

### 10.3 验证方式（按可自动断言强度排序）

| # | 命令 | 期望 | 强度 |
|---|------|------|------|
| V1 | `npx drizzle-kit generate --config packages/db/drizzle.config.ts` | **`No schema changes, nothing to migrate 😴`** | **★ 硬指标**（`bin.cjs:32922`）；A1/A2/B2 都以它判成 |
| V2 | `git status --porcelain packages/db/drizzle` | A1 前：干净；A1 后：仅 1 个新增未跟踪快照；V1 后：**仍只有它**（证明 V1 没写文件） | ★ 硬指标 |
| V3 | `npx drizzle-kit check --config packages/db/drizzle.config.ts` | 无 collision / malformed / nonLatest | ⚠ **弱**：**对本债假绿**（§6.2），**不得单独用作验收** |
| V4 | 空卷 → `pnpm db:migrate` → `information_schema.tables` 计数 | **26**（+ `drizzle.__drizzle_migrations`） | 中（需 docker 起 PG；本轮 daemon 未运行，未能预演） |
| V5 | `pnpm --filter @strict-rag/db test` | 10 文件全绿（`tests/index.md` 全「现行」） | 中（不含 migration 护栏，见 §8） |
| V6 | `pnpm check-types` · `pnpm lint` | 8/8 · 8/8 零 warning（对齐 `map.md:17` 收口数字） | 低（与本题无因果） |
| V7 | 人工：`prevId` ≠ `00000000-0000-0000-0000-000000000000` | 是（否则 V3 报 collision） | 低-中 |

**执行 A1 时的强制纪律（写进裁定 Answer）**
- 生成动作**必须在仓外副本**完成；**不得**在仓库内跑 `drizzle-kit generate`。
- 副本产出的 `0019_*.sql` **一律丢弃**，只保留快照。
- 快照落地后**立刻**跑 V1 + V2；V1 若打印出任何 `CREATE TABLE` 即视为失败（说明快照内容与 schema 不等）。

### 10.4 遗留缺口（本报告**未能**核实项，如实列出）

| 项 | 原因 |
|----|------|
| 本地 PG 卷的实际内容 / `__drizzle_migrations` 表当前记录 | 本机 docker daemon 未运行（`open //./pipe/docker_engine` 失败） |
| schema 与手写 SQL 的**类型 / 默认值 / NOT NULL** 是否逐条等价 | 本轮只做**列名级**机器比对（§3.3），类型级需人工走查 |
| `0014` 那一次 `generate` 是否真的跑过、快照是否被主动删除 | git 历史无删除记录，仅能由 `when` 时间戳（§1.3）推断，属**旁证**非定论 |
| `A1` 落地后的 `generate` 输出是否 100% 无噪声 | 依赖 V1 实跑；**本轮受纪律约束未执行** |

---

### 附：本报告全部证据路径索引

| 主题 | 绝对路径 |
|------|----------|
| journal | `D:\projects\ai-stared-project\StrictRAG\packages\db\drizzle\meta\_journal.json` |
| 唯一快照 | `D:\projects\ai-stared-project\StrictRAG\packages\db\drizzle\meta\0000_snapshot.json` |
| 19 个 migration | `D:\projects\ai-stared-project\StrictRAG\packages\db\drizzle\0000…0018_*.sql` |
| 包 scripts | `D:\projects\ai-stared-project\StrictRAG\packages\db\package.json` · `D:\projects\ai-stared-project\StrictRAG\package.json` |
| drizzle 版本 | `D:\projects\ai-stared-project\StrictRAG\pnpm-workspace.yaml` · `D:\projects\ai-stared-project\StrictRAG\packages\db\node_modules\drizzle-kit\package.json` |
| 配置 | `D:\projects\ai-stared-project\StrictRAG\packages\db\drizzle.config.ts` |
| schema 入口 | `D:\projects\ai-stared-project\StrictRAG\packages\db\src\schema\index.ts` |
| 共用列 | `D:\projects\ai-stared-project\StrictRAG\packages\db\src\schema\_shard\base-columns.ts` |
| 26 张表定义 | `D:\projects\ai-stared-project\StrictRAG\packages\db\src\schema\{system,kb,ask}\*.ts` |
| spec（HOW） | `D:\projects\ai-stared-project\StrictRAG\.trellis\spec\db\backend\database-guidelines.md` · `…\index.md` |
| 模块状态（IS） | `D:\projects\ai-stared-project\StrictRAG\docs\module-status\db.md` · `D:\projects\ai-stared-project\StrictRAG\docs\module-status\README.md` |
| 地图 | `D:\projects\ai-stared-project\StrictRAG\.scratch\fill-must-haves\map.md` |
| drizzle-kit 行为 | `D:\projects\ai-stared-project\StrictRAG\packages\db\node_modules\drizzle-kit\bin.cjs`（L19851 · L19862 · L8127 · L8139 · L8142 · L91716 · L91954 · L92010 · L92048 · L92287 · L23078 · L23086 · L23988 · L32919 · L32922 · L32953） |
| 本地栈 / compose | `D:\projects\ai-stared-project\StrictRAG\docker\docker-compose.yml` · `D:\projects\ai-stared-project\StrictRAG\docs\ops\operable-stack.md` · `D:\projects\ai-stared-project\StrictRAG\docs\ops\half-smoke.md` |
| 测试 | `D:\projects\ai-stared-project\StrictRAG\packages\db\tests\index.md` · `…\tests\**\*.test.ts` · `D:\projects\ai-stared-project\StrictRAG\docs\testing\p0-redlines.md` |
| 阶段 / 上线证据 | `D:\projects\ai-stared-project\StrictRAG\prds\10-delivery\01-phased-roadmap.md` · `…\02-ops-runbook.md` |
