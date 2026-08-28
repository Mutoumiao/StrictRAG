# @strict-rag/web · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：用户端展示与客户端状态。业务真值（min 否决、verify、检索闸）在 `@strict-rag/api`。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | 问答 UI、流式终态、拒答展示、scope 顶层 | `prds/05-api` · P0 R1/R2/R10 |
| `auth/` | 客户端 session 读写 | P0 R4 |
| `sessions/` | 会话壳服务 | `prds/04-pipelines` 历史≠evidence |
| `error-map/` | 业务码文案映射 | P0 R3 |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `ask/answer-lt-passthrough.test.tsx` | 制度答案含 `a < b` 或 `<工号>` 必须原样可见，不得被剥掉。 | 剧本 K6 · prds/10-delivery/03-acceptance-scenarios.md | `AskPanel`（AnsweredCard） | 答案文本节点原样展示小于号。 | 现行 |
| `ask/citation-chunk-detail.test.tsx` | answered 引用卡片必须可点回当时分片快照，不得编造引用、不得走现网全文。 | 功能表 §5.2 引用回溯 · prds/05-api §2.9 | `AskPanel`（CitationBlock） | 点击引用调 GET /ask/:requestId；展示 snapshot preview；闲聊无点回。 | 现行 |
| `ask/abstain-alert.test.tsx` | 拒答以 alert 展示，不得当成普通答案；kb_not_ready 不进系统错误卡。 | P0 R2 · R10 | `AskPanel` | 用 contracts testing 工厂。 | 现行 |
| `ask/scope-top-level.test.ts` | ask 请求的 scope 必须在顶层，不得进入 options。 | ADR-050 | `buildAskRequestBody · parseScopeDocTypesInput` | 客户端 body 形状。 | 现行 |
| `ask/stream-ready-no-final.test.ts` | 流式 ready 且无合法 final 时不得卡在 loading，必须落到 error。 | P0 R1 | `useKnowledgeAsk` | 流式三态；非法终态 → error；kb_not_ready final 进 abstained。 | 现行 |
| `auth/client-session.test.ts` | clear、坏 JSON 或无 token 时读 session 必须为 null。 | P0 R4 | `readClientSession · clearClientSession · saveClientSession` | 不测 expires 产品闸（DEC-1）。 | 现行 |
| `error-map/map-biz-error.test.ts` | 已知业务码必须保留 code 与 message。 | P0 R3 | `mapBizError` | 纯文案映射。 | 现行 |
| `sessions/session-shell.test.ts` | 会话壳服务调用形状正确，失败可映射且历史不得当 evidence。 | sessions API | `loadSessionList · refreshAfterAskFinal` | 非 evidence。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
