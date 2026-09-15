# 文档绑定策略参数快照只读审计最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 89

## Question

补 P2 运营面真空：文档绑定分片策略的参数快照已落库，但**列表 / 详情契约不带**，admin 看不到，运营无法审计「这篇文档当时按什么参数切的」。

权威：功能表 §4.5 文档绑定行「参数快照只读审计」；`prds/05-api/01-http-api-hono.md` 文档元数据「`chunk_strategy_params_snapshot` 只读展示」；ADR-053。

现状（源码）：

- 写入侧已齐：`apps/api/src/services/ingest-complete-pending.ts`（complete）· `apps/api/src/routes/documents/index.ts` write 与 reindex（`documentRepo.setChunkStrategy`）都写 `documents.chunk_strategy_params`
- 列：`packages/db/src/schema/kb/documents.ts` `chunkStrategy` / `chunkStrategyParams`
- 读出口缺：`packages/contracts/src/ingest/document.contract.ts` 的 `DocumentListItemSchema` **不含** `chunkStrategy` 与 `chunkStrategyParams`
- admin 文档页只在**创建面**选策略，详情/行展开不展示当时用过的码与快照

口径：

- **只读**：`chunkStrategy`（码）与 `chunkStrategyParams`（快照 JSON）进列表项 / 详情；`DocumentDetailSchema` 继承列表项即可
- 快照为 null 时展示「未记录快照」，**不得**编造 / 用默认值冒充
- **禁止**新增写路径：不给 PATCH 加这两个字段，不做 paramSchema 动态表单，不改 worker
- 禁止新增原生 `<select>`
- 测例禁止依赖墙钟

### 做

- contracts：列表项加 `chunkStrategy` + `chunkStrategyParams`（缺省 null）
- api：`routes/documents/mappers.ts` 带出两字段
- admin：文档行展开只读展示策略码与快照 JSON（无则「未记录快照」）
- 测例：
  - contracts：列表项含两字段，缺省 null
  - api：mapper 带出 `chunkStrategy` / `chunkStrategyParams`
  - admin：行展开展示码与快照；空快照显示「未记录快照」

### 不做

- 不给文档 PATCH 加策略 / 快照写入
- paramSchema 通用动态表单引擎 / 平台策略 CRUD 页
- 改 worker 切块或忽略快照
- citation 去重 / 断线重拉 / 孤儿清理 / 签字包链 / `dedupe_cross_doc_rate` / metrics 维
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api chunk-strategies + directory-structure、admin quality-guidelines；`docs/module-status/` api · admin · contracts。禁止 push。禁止 `task.py create`。

## Answer

文档绑定策略参数快照只读审计最小闭环已落地。

- 契约：`DocumentListItemSchema` 增 `chunkStrategy`（码）与 `chunkStrategyParams`（快照 JSON），缺省 `null`；详情继承列表项，一并获得。
- api：`routes/documents/mappers.ts` 从行带出两字段（未记录 → `null`）。
- admin：文档行展开新增「分片策略（历史，只读）」，走纯函数 `strategySnapshotLabel(code, params)` —— 有码有快照给「码 · JSON」，有码无快照给「未记录快照」，无码给「未记录分片策略」，**不用默认值冒充**。
- **未新增写路径**：PATCH 仍不收这两字段；未做 paramSchema 表单、未改 worker。

证据：`packages/contracts/src/ingest/document.contract.ts` · `apps/api/src/routes/documents/mappers.ts` · `apps/admin/src/app/(ops)/documents/list.services.ts` `strategySnapshotLabel` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · 测例 contracts `tests/ingest/document-contract.test.ts` · api `tests/ingest/document-mappers.test.ts`（9）· admin `tests/ops/document-strategy-snapshot.test.ts`（3）+ `tests/ops/documents-workspace.test.tsx`（行展开断言）。

验证：contracts 201 / api 映射 12 / admin 34 文件 167 测试全绿；`pnpm check-types` 8/8 绿。

未 `task.py create`。未 push。

## Comments

- 2026-09-16 认领并在主分支执行。权威切边见 [裁定分片策略审计后下一步](./89-after-chunk-strategy-audit-order.md)。
