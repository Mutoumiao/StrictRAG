# QUAL-E5：L1 contextualize 故障 → L0 回退仍 ready

Type: task
Status: resolved
Blocked by: 02

## Question

剧本 E5：「L1 contextualize 故障 → L0 回退仍 ready」。前图 101 已落 `contextualize-http.ts`（OpenAI 兼容 chat，temp=0，PRD §4.1 冻结模板；空 / 超长 / 非 2xx / 畸形一律抛）+ `INGEST_CONTEXTUALIZE_MODE`（**默认 off**）+ 逐块调用（任一块回退即整轮 `l0_fallback`，不阻断、不改正文）；105 已把 `contextualize_l1_ok` / `contextualize_l0_fallback` 落库。

**第一步先判定这是「缺实现」还是「缺测」**，给出源码行与现有测例证据。然后：

- **若缺测**：按 E5 的 Then 补**故障注入**测——Gateway 5xx / 超时 / 畸形响应 / 空串各一条，断言文档仍 `ready`、`contextSource = l0_fallback`，且入库报告两计数**口径自洽**（不得出现「情境 `l0_fallback` · L0 回退 0」的自我矛盾行）。
- **若缺实现**：补最小实现。

**禁止**把「默认 off」当作 E5 已满足（默认关不等于故障路径正确）。**未验证真 Gateway** 的事实如实写出。

## Answer

### 判定：**缺测**，不是缺实现

源码已满足剧本 Then：`contextualize-http.ts:57-101`（非 2xx / 畸形 / 空 / 超长一律抛）· `pipeline.ts:534-543`（仅 `l1_llm ∧ mode=http` 才建 L1）· `:559-568`（任一块失败回退 L0，块继续入库）· `:600-619`（`contextSource` 与两计数同口径）· `:935-941`（`es_index` 成功才 `status='ready'`）。既有注入测例只跑到 chunk 段，**「文档仍 ready」这条 Then 无任何端到端断言**（证据见 [`research/gap-is-a.md`](../research/gap-is-a.md)）。

### 补了什么

新增 `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`（7 条），每条都走完 **chunk → embed → es_index** 全链：

| 场景 | 断言 |
|------|------|
| 对照：contextualize 成功 | prefix 用模型输出 · `contextSource=l1_llm` · 计数 `(1,0)` · `status=ready` |
| HTTP **500** / **503** | prefix 回退 L0 · 正文不被改写 · `contextSource=l0_fallback` · 计数 `(0,1)` · `status=ready` |
| 畸形响应（`choices: []`） | 同上 |
| 模型输出空白 | 同上 |
| 网络中断（`AbortError`） | 同上 |
| 口径自洽 | `contextSource=l0_fallback` ⟹ `contextualizeL0Fallback > 0` 且 `contextualizeL1Ok === 0` |

全链断言含 `embedReady === 1` / `esReady === 1` / `status === 'ready'`，并验证报告中已记录的计数**不被 embed / es_index 的空快照复写**。已登记 `apps/worker/tests/index.md`。

### 反证（确认断言有牙齿）

临时把 `pipeline.ts:563-566` 的 `catch` 改为 `throw err`（破坏 L1 回退）→ 该测例 **6/7 变红**（仅成功对照通过）→ 已完整还原（`git diff` 无残留，全仓搜 `TEMP-NEGATIVE-CHECK` 为 0）。

### 未验证 / 未做

- **真 Gateway 未接**：`fetch` 为注入替身，未对真模型端点验证。
- **真超时未验证**：`contextualizeChunk` 无 `timeout` / `AbortSignal` 参数，无注入点；本票以 `fetchImpl` 抛 `AbortError` 近似网络中断。**未**为其新增 timeout 参数（PRD 未要求，避免发明语义）。
- 未改任何默认开关（`INGEST_CONTEXTUALIZE_MODE` 仍 `off`），未放宽门禁。
