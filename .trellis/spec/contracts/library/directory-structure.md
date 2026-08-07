# contracts · 目录结构

## 当前树

```text
packages/contracts/
  package.json          # exports: "." → ./src/index.ts
  tsconfig.json · eslint.config.js
  src/
    index.ts            # 聚合导出
    common/
      biz-code.ts       # BizCode 常量 + 类型（值 = PRD 短名）
      response.ts       # ApiMeta / ApiResponse / buildSuccess|Failure
    system/
      health.contract.ts
    auth/
      session.contract.ts   # TokenPair 等
    ingest/
      document.contract.ts
      chunk.contract.ts       # B1 分片 list/detail（ADR-052）
      chunk.contract.test.ts
    ask/
      index.ts
      ask.contract.ts       # AskRequest/Response · options/scope strict
      reason.ts             # AskReason
      session.contract.ts
      feedback.contract.ts
      member.contract.ts
      ask.contract.test.ts
    kb/
      kb-settings.contract.ts   # B2 设置 GET data / PATCH body（ADR-054）
      kb-settings.contract.test.ts
    async/
      queues.ts
```

## 组织约定

| 域目录 | 放什么 |
|--------|--------|
| `common/` | 横切：业务码、响应信封、分页等 |
| `system/` | 健康检查、就绪、运维探针 |
| `auth/` | 登录/TokenPair/会话身份 DTO |
| `ingest/` | 入库文档 DTO + **分片只读** list/detail（body **与** 全部成功响应） |
| `ask/` | ask / session / feedback / member / reason / SSE |
| `kb/` | 知识库设置 settings（B2） |
| `async/` | 队列名等跨进程常量 |

**不要**全塞进 `common/`；新域按 PRD 资源增加。  
**纪律**：每个对外 HTTP 端点的 wire 类型都在本包；前端只 import 本包类型（admin：模块 `api.ts`；web：`src/api/*`）。

## 导出规则

- 包入口仅 `"."` → `src/index.ts`  
- 内部 re-export 使用 ESM 后缀 `.js`  
- 消费方：`import { AskRequestSchema, BizCode, ... } from '@strict-rag/contracts'`

## Ask 契约要点（S2）

| Schema | 要点 |
|--------|------|
| `AskOptionsSchema` | **仅** stream/debug/mode/locale；`.strict()` |
| `AskScopeSchema` | 顶层 `docTypes`；禁止进 options |
| `AskRequestSchema` | question + sessionId? + scope? + options?；`.strict()` |
| `AskResponseSchema` | 同步 JSON ≡ 流式 `data-ask-final` 同源 |

## 依赖

- 运行时：仅 `zod`（catalog）  
- **禁止**依赖 apps 或 `db` / `ui`（契约层纯净）
