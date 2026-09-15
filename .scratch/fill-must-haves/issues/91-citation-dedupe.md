# citation chunk 级去重最小闭环

Type: task
Label: wayfinder:task
Status: pending
Assignee: —
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
