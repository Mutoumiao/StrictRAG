# citation chunk 级去重最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 90

## Question

补 P2 质量真空：模型重复引用同一分片时，`citations` 现在会把同一个 `chunkId` 列两次，引用数与展示都虚高。

权威：功能表 §10.1 citation 清洗行；`prds/05-api/01-http-api-hono.md` answered 响应 `citations`（引用点）；`prds/08-quality`。

现状（源码）：

- `apps/api/src/graph/run.ts`（约 394–395 行）：`evidenceIds` 为 Set、`validIds = parsed.citations.filter((id) => evidenceIds.has(id))` —— **只过滤合法性，未去重**。
- 后果：模型输出 `[c1, c1, c2]` → `citations` 出现两条同 `chunkId`；`span.end({ citationCount })` 与 web 引用列表同步虚高。
- 既有 `apps/api/tests/ask/citations.test.ts` 覆盖非法引用剥离，但未覆盖重复。

口径：

- `citations` 按 `chunkId` **去重且保序**（保留首次出现位置）；重复不改变是否 answered 的判定（仍是「strip 后为空则拒答」）
- 去重后条数用于 `citationCount`
- **不得**借机改 evidence 集、不改 min 否决 / verify、不改引用内容与 `preview`
- 测例禁止真 Gateway / 真集群 / 墙钟

### 做

- api：citation 合法化时按 chunkId 去重保序
- 测例：模型重复引用同一 chunk → 只出一条；去重后为空仍拒答 `invalid_citations`；不同 chunk 顺序不变

### 不做

- 改 evidence 装载 / 检索 / 打分
- 句级 `[chunkId]` 归属 / 重叠句归属 / Langfuse SDK
- 断线重拉 / 文档策略快照 / 孤儿清理 / 签字包链 / `dedupe_cross_doc_rate` / metrics 维
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 rewrite / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api ask-pipeline；`docs/module-status/` api。禁止 push。禁止 `task.py create`。

## Answer

citation chunk 级去重最小闭环已落地。

- `apps/api/src/graph/run.ts` generate 段：合法引用过滤时**同时按 `chunkId` 去重保序**（`citedOnce` Set，保留首次出现位置）。重复引用不再让 `citations` 长度与 `span.citationCount` 虚高。
- 判定不变：仍是「剥光为空 → `invalid_citations` 拒答」；未动 evidence 装载 / min 否决 / verify / 引用内容与 `preview`。
- 测例（`apps/api/tests/ask/citations.test.ts`，同一「引用清洗」意图）：重复引用同一证据 → 只出一条；两块交错重复 → 保序保留首次出现（`[B, A, B]` → `[B, A]`）。
- `docs/module-status/api.md` 未改：该文件 ask 段没有 citations 行，成熟度与本条债均无变化（HOW 已在 spec 记录）。

证据：`apps/api/src/graph/run.ts` · `apps/api/tests/ask/citations.test.ts`（5）· `.trellis/spec/api/backend/ask-pipeline.md`（`citations[]` 与 generate→claim_split 两行）。

验证：`tests/ask/citations.test.ts` 5 绿；全量 `pnpm --filter @strict-rag/api test` 128 文件 / 818 测试绿。

未 `task.py create`。未 push。

## Comments

- 2026-09-16 认领并在主分支执行。权威切边见 [裁定分片策略审计后下一步](./89-after-chunk-strategy-audit-order.md)。
