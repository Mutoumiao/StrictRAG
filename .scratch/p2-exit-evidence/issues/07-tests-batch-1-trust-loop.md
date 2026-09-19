# 补测批 1 · 信任环收口（ask 图 / 会话 / 建库）

Type: task
Status: open
Blocked by: —

## Question

把覆盖表 P2 必签余量中「信任环」这 11 行补到有实质断言：**A1 · A2 · A3 · A4 · D-fast · D3 · H5 · H6 · K1 · U2 · U5**。

每行今天缺哪条断言、源码现状、建议落点见 `research/coverage-partial-tests.md` 对应剧本小节。预计 12–13 条 `it`，落点：

- 新建：`apps/api/tests/kb/create-kb-with-models.test.ts` · `apps/api/tests/ingest/upload-to-active-retrievable.test.ts` · `apps/api/tests/ask/answer-kind.test.ts` · `apps/api/tests/ask/abstain-suggested-actions.test.ts` · `apps/api/tests/ask/false-premise.test.ts` · `apps/api/tests/ask/gateway-chain-fail.test.ts`
- 补 `it`：`apps/api/tests/ask/route-rules.test.ts` · `apps/api/tests/ask/http-stream.test.ts` · `apps/api/tests/ask/evidence-verbatim.test.ts` · `apps/api/tests/sessions/http.test.ts`

夹具复用 `apps/api/tests/ask/_support/graph-harness.ts` 与会话内存仓。

约束：测例只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 简介」简体中文，同步登记 `apps/api/tests/index.md`（存货闸漏行即红）；**禁止**按源码一对一镜像造测例；质量红线（min 否决 · 合法 draft 必 verify · 历史≠evidence）不得为凑绿而放宽。

## Answer

（进行中）
