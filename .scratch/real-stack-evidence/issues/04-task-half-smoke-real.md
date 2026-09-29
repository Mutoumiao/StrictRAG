# `pnpm smoke:half` 端到端真跑（P-HALF 从「宣称」到「可复现」）

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 02, 03

## Question

在真栈上跑通 HALF-SMOKE：`txt 上传 → complete → 审批 → scan → 双就绪 → active → ask 有引用`。

要点：

1. 前置：`pnpm db:migrate`（工单 03）+ api/worker 起（`pnpm up:apps`，或分别 `pnpm --filter @strict-rag/api start` / `@strict-rag/worker start`）；`.env` 叠加 `.env.operable.example`（**仓库默认不动**）。
2. 跑 `pnpm smoke:half`，记录退出码与 `PASS`/`FAIL` 行；`citations ≥ 1` 且含本次 `docId` 才算真绿。
3. **live ask 的已知前置**：`docs/ops/half-smoke.md` 写「缺 `GATEWAY_BASE_URL` 时默认 mock chat 不是 JSON → ask 拒答 → 空引用失败」。本机无真模型 key → 若因此失败，**先核清**：这是否说明「半产品可运行」这条在**没有 Gateway** 的机器上根本不可复现？还是仓库里另有一条 mock-but-JSON 的路径（查 `apps/api/src/services/gateway/` 的 mock 分支与 `GATEWAY_BASE_URL` 缺失时的行为）？**核清事实**再下结论，不许猜。
4. 若卡在某一步，写清卡点，并把卡点对应的**源码行 / env 项**指出来；若是**源码缺陷**（不是缺 key），当场修并补测例。
5. 顺带跑 `pnpm --filter @strict-rag/worker smoke:mongo`（真 Mongo 正文 upsert 回读）。

产物：`research/04-half-smoke.md`（命令 + 关键输出 + 卡点）。

## Answer

**已解**（结论是「入库段真跑通 + 抓出两处源码缺陷 + ask 段阻塞方精确定位」）。取证全文：[`../research/04-half-smoke.md`](../research/04-half-smoke.md)。

**真跑三轮，抓到两处只在真集群现形的缺陷**：

1. **第一轮**：`approve` 回 403 `self_approve_forbidden` —— `scripts/smoke-half.mjs` 用**同一主体**上传并审批，撞上 ADR-048 #4 四眼闸（`apps/api/src/routes/documents/index.ts:469` 调 `evaluateSelfDecide`）。四眼闸是后加的，脚本没跟着改 → 文档里的「可重复跑通」在源码现状下**不成立**。**修**：先断言同主体 approve 必 403，再换 `half-smoke-reviewer@local.dev`（`kb_admin`）审批 + scan。属**收紧**。
2. **第二轮**：`stage=es_index` 首次执行失败 `ES_RECONCILE_FAILED`，文档被写成 `status=failed`，**靠 BullMQ 重试 2 秒后才转 `ready`**。根因：`bulkIndexSparse` 的 `POST /_bulk` 不带 refresh，ES 近实时语义下紧随其后的 `listIndexedChunkIds`（`_search`）读到 0 命中 → `reconcileIndexed` 判 `missing`。**mock ES 是进程内 set 比对，永不暴露此 bug**。**修**：`POST /_bulk?refresh=wait_for`；新增测例 `apps/worker/tests/ingest/es-bulk-refresh-before-reconcile.test.ts` 钉住该参数与「写后读一次判 ok」。
3. **第三轮（修复后）**：`uploaded → indexing_es → ready` **一次成功**（无 failed 过渡、无重试），四眼闸与 ES 写后读都被脚本覆盖。

**ask 段（未达成，阻塞方精确定位）**：`status=abstained` / `reason=internal_guard`。原因是 `GATEWAY_MODE=http` 要求上游**同时**提供 `chat/completions` + `embeddings` + **`rerank`** 三契约，而 `runRetrieve` **无条件**调 rerank；缺 `GATEWAY_BASE_URL` 时走 mock，mock chat 返回纯文本（非 JSON）→ 解析失败 → `internal_guard`。本机复核：Ollama 有 embedding 与 rerank 模型、**无对话模型**，且不暴露 `/rerank` → 指向本机也不成立。**这是环境/契约边界，不是源码缺陷**，已按既定口径记为雾簇 39（要不要为无 key 机器建 dev-only 桩 = 产品决定，本图不擅自建）。
