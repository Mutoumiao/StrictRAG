# 检索语义补钉

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent

## Question

补检索期 P2 语义：租户隔离、ACL 对称、稀疏失败 reason、档位预算、正文批取。这是第三批第一张执行工单（开放前沿）。

### 做

- ES 查询期强制 `tenantId` filter（共享索引必须查询期强制，不能事后交 PG）
- `buildAclFilter`：检索期 ACL 对称过滤
- sparse 失败 reason 落 `sparse_unavailable`（不得并入模糊 internal）
- 档位 retrieveK：服务端按 fast 60/10 预算改 retrieveK
- 正文批取 Mongo（弃 PG 演示正文单点取）

### 不做

- dense 查询期 pgvector+WHERE（换生产默认级，同 B8 分层）
- 生效区间（前批已划出）
- parent-child / HyDE / 文档多样性召回扩展（地图 Out of scope）

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api / worker）。权威：功能表 §8、§5.2 检索相关行。

## Answer

已完成第三批第一张执行工单，范围按正文「做 / 不做」锁死：

- **contracts**：`AskReasonSchema` 增 `sparse_unavailable`（`packages/contracts/src/ask/reason.ts`）；`apps/api/src/graph/reasons.ts` 补对应文案。
- **ES 查询期隔离 + 对称 filter**：`apps/api/src/services/retrieve/es-sparse.ts` 新增 `buildAclFilter({tenantId, kbId})`，`searchSparseEs` 查询期强制 `tenantId + kbId` term；`status/lifecycle/indexVersion` 闸门仍由 PG corpus（`loadCorpusFromDb`）对称承载。api 与 worker 的 `ensureSparseIndex` mapping / `bulkIndexSparse` 均写 `tenantId`。
- **sparse 失败 reason**：`runRetrieve` 的 ES sparse 检索失败改为 `sparse_unavailable`（禁止并入 `internal_guard`）；`http` 无 sparseSearch（配置错）仍 `internal_guard`。
- **档位检索预算**：`graph/budget.ts` 新增 `retrieveBudgetForMode`（fast 60/10，balanced/strict 150/20），`runAskGraph` 服务端注入 `retrieveK/rerankTopN`；客户端不可透传。
- **正文批取 Mongo**：`apps/api/src/services/retrieve/mongo-body.ts` 新增 `batchLoadChunkBodies`（切片口径 `contextPrefix + "\n" + text`）；`runRetrieve` 融合后批取权威正文，缺块/拉取失败 fail-closed（`internal_guard`），未注入 loader（`MONGODB_URL` 空）才演示回退 PG `body_text`。worker 侧 `mongo-body.ts` 新增 `upsertChunkBodies`，chunk 阶段写 Mongo `chunk_bodies` 并回写 PG `mongoBodyId`。

**未做（维持划出）**：dense 查询期 pgvector+WHERE、生效区间、parent-child/HyDE/文档多样性、生产 ES+IK/Router（B8）、部门/ACL principals 查询期对称（P3b）。

验证：`pnpm --filter @strict-rag/api check-types` / `worker check-types` / `contracts check-types` 全绿；api 全量测试 97 文件 603 通过（3 skipped）；worker 91 通过；contracts 102 通过。api `lint` 有 5 个既有 warning（非本工单改动文件），未在本工单引入新 warning；worker/contracts lint 绿。

IS 已回写 `docs/module-status/api.md` 与 `worker.md`；HOW 已同步 `.trellis/spec/api/backend/ask-pipeline.md` 与 `index.md`。`.trellis/tasks/08-06-project-backlog/status.md` §0.3 已补四张执行工单指针（09 已完成，10/11/12 未开始）。

`pnpm check:module-status` 剩余 6 条均为既有/误报：STORAGE_MODE=s3（文档已写默认 local，check 提取器误判）、RULE_VIOLATION 概念名、visibility_level 字段名、check.mjs 6-联动正则未识别 ` M`（`docs/module-status/api.md` 已实际修改）、admin-catalog 时效（本工单未触及）。未改 check.mjs 黑名单或 admin-catalog（不在本工单范围）。

