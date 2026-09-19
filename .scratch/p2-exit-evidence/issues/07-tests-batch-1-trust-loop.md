# 补测批 1 · 信任环收口（ask 图 / 会话 / 建库）

Type: task
Status: resolved
Blocked by: —

## Question

把覆盖表 P2 必签余量中「信任环」这 11 行补到有实质断言：**A1 · A2 · A3 · A4 · D-fast · D3 · H5 · H6 · K1 · U2 · U5**。

每行今天缺哪条断言、源码现状、建议落点见 `research/coverage-partial-tests.md` 对应剧本小节。预计 12–13 条 `it`，落点：

- 新建：`apps/api/tests/kb/create-kb-with-models.test.ts` · `apps/api/tests/ingest/upload-to-active-retrievable.test.ts` · `apps/api/tests/ask/answer-kind.test.ts` · `apps/api/tests/ask/abstain-suggested-actions.test.ts` · `apps/api/tests/ask/false-premise.test.ts` · `apps/api/tests/ask/gateway-chain-fail.test.ts`
- 补 `it`：`apps/api/tests/ask/route-rules.test.ts` · `apps/api/tests/ask/http-stream.test.ts` · `apps/api/tests/ask/evidence-verbatim.test.ts` · `apps/api/tests/sessions/http.test.ts`

夹具复用 `apps/api/tests/ask/_support/graph-harness.ts` 与会话内存仓。

约束：测例只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 简介」简体中文，同步登记 `apps/api/tests/index.md`（存货闸漏行即红）；**禁止**按源码一对一镜像造测例；质量红线（min 否决 · 合法 draft 必 verify · 历史≠evidence）不得为凑绿而放宽。

## Answer

11 行全部补到有实质断言，**没有一行属于「无法断言」**。改动只在 `apps/api/tests/` 内。

**新建 6 个文件**

| 行 | 文件 | 断言要点 |
|----|------|----------|
| A1 | `kb/create-kb-with-models.test.ts`（2 it） | 建 KB → `PUT model-bindings` 配 generate/embed/rerank → 解析出 chat/embed/rerank 模型名、provider baseUrl、`embedDims`、rerank 端点优先 DB；另一条断言只配 generate 时 embed/rerank **回落 env 且不假装已配** |
| A2 | `ingest/upload-to-active-retrievable.test.ts`（2 it） | upload-url → PUT 对象 → complete 三跳后仍 pending/draft；`PATCH lifecycle=active` **409**、ask 得 `kb_not_ready` 且语料为空；夹具置 `ready` 后 active 200、ask `answered/verified`、citation 指回该文档 |
| A3 | `ask/answer-kind.test.ts`（3 it） | 真图：同步与 `data-ask-final` 双路都断言 `answerKind=knowledge` 且带 citation；寒暄轮 `chitchat`、拒答轮 `undefined` |
| A4 | `ask/abstain-suggested-actions.test.ts`（1 it 覆盖 3 种 reason） | `low_retrieval` / `kb_not_ready` / `rerank_unavailable` 三组 `suggestedActions` 非空、各含主按钮、SSE 与同步逐字相等、三组**互不相同** |
| D3 | `ask/false-premise.test.ts`（3 it） | 库外假前提必走 single；无库内证据 → `low_retrieval` 拒答且 `answerKind` 非 chitchat/knowledge；只有不对题邻居 → `model_abstained` 且 citations 空 |
| H5 | `ask/gateway-chain-fail.test.ts`（1 it） | mock 网关双节点全 5xx → triedNodes `[0,1]`、图 `abstained/internal_guard`、answer 空、`llmCalls=1`（未进 verify），且**有证据也不胡答** |

**补 `it` 4 个文件**

- `ask/route-rules.test.ts`（D-fast）：`mode=fast` 下直断言「图内 chat purpose 不含 `route`，恰为 generate/claim_split/judge」。
- `ask/http-stream.test.ts`（H6）：拒答轮 SSE 不含 `text-delta`/`text-start`，part 类型集合恰为 `{data-status, data-ask-final}`。
- `ask/evidence-verbatim.test.ts`（K1）：手机号片段经 retrieve 后在 generate/claim_split/judge 三处 prompt、`citation.preview`、`evidence_snapshot.text` **全等原文**。
- `sessions/http.test.ts`（U2 / U5）：U2 断言 `limit=2` 两页无重复且并集覆盖全部、`offset=99` 空页、`limit=0/101` 与 `offset=-1/abc` → 400；U5 在 B 会话发问时 `window(B)` 只有 B 的文本、不含 A 的问/答原文，进 rewrite 的 user prompt 与落库 transcript 同样隔离。

**验证**：`pnpm --filter @strict-rag/api test` → **148 文件 / 919 通过 + 3 skipped**（既有 live-gate skip）；`check-types` 通过；`lint --max-warnings 0` 零 warning；`apps/api/tests/index.md` 新增 6 行并同步 4 行锚点（存货闸随测试一并通过）。全仓 `pnpm test` 在收口时 **11/11**。

**边界**：未改源码；未用 skip；断言都落在可观测终态（HTTP 信封 / SSE part / 图终态 / 绑定解析结果），没有「断言内部函数被调用过」式镜像测。质量红线未放宽。
