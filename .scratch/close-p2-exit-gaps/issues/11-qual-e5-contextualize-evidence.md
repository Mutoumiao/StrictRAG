# QUAL-E5：L1 contextualize 故障 → L0 回退仍 ready

Type: task
Status: open
Blocked by: 02

## Question

剧本 E5：「L1 contextualize 故障 → L0 回退仍 ready」。前图 101 已落 `contextualize-http.ts`（OpenAI 兼容 chat，temp=0，PRD §4.1 冻结模板；空 / 超长 / 非 2xx / 畸形一律抛）+ `INGEST_CONTEXTUALIZE_MODE`（**默认 off**）+ 逐块调用（任一块回退即整轮 `l0_fallback`，不阻断、不改正文）；105 已把 `contextualize_l1_ok` / `contextualize_l0_fallback` 落库。

**第一步先判定这是「缺实现」还是「缺测」**，给出源码行与现有测例证据。然后：

- **若缺测**：按 E5 的 Then 补**故障注入**测——Gateway 5xx / 超时 / 畸形响应 / 空串各一条，断言文档仍 `ready`、`contextSource = l0_fallback`，且入库报告两计数**口径自洽**（不得出现「情境 `l0_fallback` · L0 回退 0」的自我矛盾行）。
- **若缺实现**：补最小实现。

**禁止**把「默认 off」当作 E5 已满足（默认关不等于故障路径正确）。**未验证真 Gateway** 的事实如实写出。

## Answer

<!-- 解析时写 -->
