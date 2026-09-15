# L0 模板真用快照 / contextMode 单控件最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 81

## Question

补 P1–P2 情境前缀真空：管道写死 `` `${title} / section` ``，快照 `contextMode` 不进 worker，设置弹窗不渲染该控件。这是本批唯一一张执行工单。

权威：[裁定跨文档去重后下一步](./81-after-cross-doc-dedupe-order.md)。同 KB 跨文档去重最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `apps/worker/src/ingest/pipeline.ts` prefix 写死 `` `${doc.title} / section` ``
- `DEFAULT_CHUNK_STRATEGY_PARAMS.contextMode = 'l1_llm'`；`splitByChunkStrategy` 不读快照
- admin 分片弹窗只启用 + recommended；`toPatchItems` 不发 `paramOverrides`
- `GATEWAY_*` 仅占位；pipeline 未调 contextualize
- `chunks` 无 `context_source` 列；入库报告无情境来源

口径：

- L0 模板：`{doc_title}`；有 `section_path` 才拼 ` / {section_path}`。本张无小节路径 → **只用标题**，禁止字面量 `section`
- worker 读 `documents.chunkStrategyParams.contextMode`
- `l0_template` → prefix=L0，报告 `contextSource=l0`
- `l1_llm` → **不**调 Gateway；同一 L0 prefix，报告 `contextSource=l0_fallback`（诚实回退，不得写 `l1_llm`）
- 缺省 / 非法快照值 → 按默认 `l1_llm` 处理（即本轮 `l0_fallback`）
- admin：已实现策略一个 `ClosedSelect`（`l1_llm` / `l0_template`）；禁止新原生 `<select>`
- PATCH `paramOverrides` 写入 `contextMode`；非法值 **400** `VALIDATION_ERROR`
- 生效值 = overrides ∪ paramSchema 默认；`l0_template` 时设置页标注「召回增强关闭」
- 新文档仍走既有 `paramsSnapshotFor`（schema + 库覆盖）
- 旧文档不因改库配置自动换 prefix（须 reindex）
- 禁止把未实现 L1 成功计数填 0 装齐
- `isDefaultRetrievable` **不**改
- 测例禁止依赖墙钟、禁止真集群、禁止真 Gateway

### 做

- contracts：`CONTEXT_MODES` / `parseContextMode` / `l0ContextPrefix` / `resolveContextSource`；报告可含 `contextSource`
- db：`ingest_reports.context_source` 可空；迁移 `0016`
- worker：chunk 读快照写 L0 prefix；报告落 `contextSource`
- api：PATCH 校验 `contextMode`；GET 报告映射新列
- admin：策略弹窗 ClosedSelect；`l0_template` 文案「召回增强关闭」；报告展开可见来源
- 测例：
  - 纯函数：无路径只用标题；有路径才拼接
  - worker：快照 `l0_template` → prefix=标题且报告 `l0`；默认/`l1_llm` → 同一 prefix 且报告 `l0_fallback`；不出现 ` / section`
  - api：PATCH `l0_template` 200 且 overrides 可回读；非法 mode 400
  - admin：打开设置可见情境档；选 L0 后保存带 `paramOverrides.contextMode`
  - contracts / db：新列是事实，仍拒 Hit@k / `contextSource=l1_llm`

### 不做

- 真 L1 LLM / Gateway `purpose=contextualize` / 费用路径
- 通用 paramSchema 动态表单引擎 / 平台策略 CRUD 页
- worker 消费 `chunkTokens` / `overlap` / 换切块算法
- `chunks.context_source` 列（本张全 version 同源，报告即账）
- 质量看板改 τ / 签字包链
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` worker directory-structure + ingest-capability-matrix + api chunk-strategies；`docs/module-status/` worker · api · admin · contracts · db。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/worker/backend/directory-structure.md`、`.trellis/spec/api/backend/chunk-strategies.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

L0 模板真用快照 / contextMode 单控件最小闭环已落地。

- worker 读文档快照 `contextMode`：L0 prefix 无路径只用标题；`l0_template` 报告 `l0`；`l1_llm` / 缺省不调 Gateway，同一 prefix，报告 `l0_fallback`。
- PATCH `paramOverrides.contextMode` 仅两档；非法 400。admin 已实现策略 ClosedSelect；`l0_template` 标「召回增强关闭」。
- 入库报告可含 `contextSource`；GET 与行展开展示。无真 L1 / 无通用表单引擎 / 无 `chunks.context_source` 列。

证据：`packages/contracts/src/ingest/chunk-strategy.ts` · `ingest-report.contract.ts` · `apps/worker/src/ingest/pipeline.ts` · `ingest-report.ts` · `apps/api/src/services/chunk-strategy-catalog.ts` · `apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx` · `apps/worker/tests/ingest/context-mode-obey.test.ts` · `packages/contracts/tests/ingest/context-mode.test.ts`。

未 `task.py create`。未 push。

## Comments

- 2026-09-15 认领并在主分支执行。权威切边见 [裁定跨文档去重后下一步](./81-after-cross-doc-dedupe-order.md)。
