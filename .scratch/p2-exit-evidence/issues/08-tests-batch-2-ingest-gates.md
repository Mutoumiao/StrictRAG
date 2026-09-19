# 补测批 2 · 入库闸与双就绪（worker 为主）

Type: task
Status: open
Blocked by: —

## Question

把覆盖表 P2 必签余量中「入库闸与双就绪」这 19 行补到有实质断言：**L1 · L2 · L3 · L4 · L5 · L9 · M1 · M2 · M5 · M6 · Q1 · Q2 · Q5 · Q10 · V1 · V2 · V6 · V8 · AA6**。

预计约 20 条 `it`。落点（worker 为主体，另涉 api / contracts / admin 各一两处）见 `research/coverage-partial-tests.md` 末节的批 2 清单，例如新建 `apps/worker/tests/ingest/dual-ready-embeddings-parity.test.ts` · `es-fail-not-ready.test.ts` · `es-retry-recover.test.ts` · `reindex-atomic-switch.test.ts` · `embed-es-order.test.ts` · `scan-infected-effects.test.ts` · `pdf-text-to-ready.test.ts` · `scan-vs-ocr-startup.test.ts`，api 侧新建 `apps/api/tests/ingest/complete-size-http.test.ts` · `complete-head-authority.test.ts` · `complete-no-scan-enqueue.test.ts` · `no-forged-ready.test.ts` · `reindex-version.test.ts`。

L4 与 AA6 共用同一 `reindex` 夹具，一次搭好覆盖两行。worker 内存 db + mock ES 已足够离线跑全链（参考 `contextualize-fallback-ready.test.ts` 的写法）。

约束：默认 `RETRIEVE_ES_MODE=mock` / `INGEST_ES_MODE=mock` 下写测，**不得**为了凑绿把 mock 结果标成生产 ES 已验；双就绪 ∧ active 检索闸不得放宽；测例登记各包 `tests/index.md`。

## Answer

（进行中）
