# 01 · 研究：末步 ask 的失败形态与三契约可达面

Type: research
Status: claimed
Parent: ../map.md

## Question

把「无 Gateway 时末步必失败」这件事的**现状面**核到能做裁定的粒度：

1. **失败的确切形态**：`scripts/smoke-half.mjs` 第 8 步失败时到底做什么（断言什么字段、退出码、stdout 是否含可诊断信息）；api 侧此时返回什么（HTTP 码 / `status` / `reason` / `suggestedActions`）。**在真栈上实测一次**（无 `GATEWAY_BASE_URL`），把逐字输出记下来。
2. **三契约的最小形状**：ask 图在 `GATEWAY_MODE=mock` 与 `=http` 下分别调用哪些 purpose（route / generate / claim_split / judge / embed / rerank？），每次调用**期望的响应形状**（JSON 字段）在代码哪一处解析、解析失败时如何降级（是拒答还是抛错）。「mock chat 不是 JSON」具体指哪一次调用、mock 返回什么。
3. **检索侧的两条契约**：embeddings 与 rerank 在**默认**（`INGEST_EMBED_MODE=mock` / `RETRIEVE_ES_MODE=mock`）下是否真的需要上游？换言 ── 末步失败到底是**只**缺 chat（JSON）三条，还是也缺 embed / rerank。
4. **若走「路 A 建桩」**：桩的最小实现面是什么（要覆盖几个 purpose、每个响应最小 JSON 形状）、落点候选（独立 `scripts/*.mjs` 还是 `apps/api` 里的档位）、**零生产代码改动**的接法（把桩当一台真 HTTP Gateway 用 `GATEWAY_BASE_URL` 指过去）是否真的可行、爆炸面（多少测例会受影响；`GATEWAY_MODE` 相关断言在哪些文件）。
5. **若走「路 B 不建桩」**：要让失败**可诊断**，落点在哪几处（`smoke-half.mjs` 的诊断分支 / `GET /ready` 是否已报 gateway 状态 / `docs/ops/half-smoke.md` / `docs/ops/operable-stack.md` / 模块状态），以及「第三人会读的顺序」是什么。
6. **反方证据**：全仓找「mock chat 非 JSON 是有意设计」的证据（PRD / spec / 注释 / 测例），逐条给 `路径:行号`；以及有没有**已经存在**的桩 / fake gateway（`tests/` 里的、`scripts/` 里的），避免重复造。

**判据**：每条结论能指到源码路径（行号写在工单里，不写进 module-status）。未核实项显式标「未核实」。
