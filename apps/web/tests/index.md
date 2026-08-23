# @strict-rag/web · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：用户端展示与客户端状态。业务真值（min 否决、verify、检索闸）在 `@strict-rag/api`。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与验收剧本。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | 问答 UI、流式终态、拒答展示、scope 顶层 | `prds/05-api` · P0 R1/R2/R10 |
| `auth/` | 客户端 session 读写 | P0 R4 |
| `sessions/` | 会话壳服务 | `prds/04-pipelines` 历史≠evidence |
| `error-map/` | 业务码文案映射 | P0 R3 |

现行目录尚无文件；下表仍被 Vitest 收集。

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 待处理

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/hooks/use-knowledge-ask.test.ts` | ready 且无合法 final 时不得卡在 loading | P0 R1 | 流式三态；非法终态 → error | 待处理 |
| `../src/components/ask-panel.test.tsx` | 拒答以 alert 展示，非普通答案 | P0 R2 · R10 | 用 contracts testing 工厂 | 待处理 |
| `../src/lib/map-biz-error.test.ts` | 已知业务码保留 code + message | P0 R3 | 纯文案映射 | 待处理 |
| `../src/auth/client-session.test.ts` | clear / 坏 JSON / 无 token → null | P0 R4 | 不测 expires 产品闸（DEC-1） | 待处理 |
| `../src/api/ask.scope.test.ts` | ask 请求 scope 在顶层，不进 options | ADR-050 | 客户端 body 形状 | 待处理 |
| `../src/services/sessions.services.test.ts` | 会话壳服务调用形状 | sessions API | 非 evidence | 待处理 |
