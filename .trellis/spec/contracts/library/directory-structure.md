# contracts · 目录结构

## 当前树

```text
packages/contracts/
  package.json          # exports: "." + "./testing"
  tsconfig.json · eslint.config.js
  tests/
    index.md            # 本包测例导航
  src/
    index.ts            # 生产聚合导出（不含 testing）
    testing.ts          # 测试辅助入口 → ask/fixtures
    common/
      biz-code.ts       # BizCode 常量 + 类型（值 = PRD 短名）
      response.ts       # ApiMeta / ApiResponse / buildSuccess|Failure
    system/
      health.contract.ts
      dashboard.contract.ts       # B6 数据面板 summary（≤5 只读指标）
      departments.contract.ts     # B5
      model-gateway.contract.ts   # B3
      platform-users-roles.contract.ts  # B4
    auth/
      session.contract.ts   # TokenPair 等
    ingest/
      document.contract.ts
      chunk.contract.ts       # B1 分片 list/detail（ADR-052）
    ask/
      index.ts
      ask.contract.ts       # AskRequest/Response · options/scope strict
      reason.ts             # AskReason
      fixtures.ts           # makeAnsweredFinal / makeAbstainedFinal（测试）
      session.contract.ts
      feedback.contract.ts
      member.contract.ts
    kb/
      kb-settings.contract.ts   # B2 设置 GET data / PATCH body（ADR-054）
    async/
      queues.ts
```

## 组织约定

| 域目录 | 放什么 |
|--------|--------|
| `common/` | 横切：业务码、响应信封、分页等 |
| `system/` | 健康/就绪 · **dashboard summary（B6）** · departments · model-gateway · platform 用户角色 |
| `auth/` | 登录/TokenPair/会话身份 DTO |
| `ingest/` | 入库文档 DTO + **分片只读** list/detail（body **与** 全部成功响应） |
| `ask/` | ask / session / feedback / member / reason / SSE |
| `kb/` | 知识库设置 settings（B2） |
| `async/` | 队列名等跨进程常量 |

**不要**全塞进 `common/`；新域按 PRD 资源增加。  
**纪律**：每个对外 HTTP 端点的 wire 类型都在本包；前端只 import 本包类型（admin：模块 `api.ts`；web：`src/api/*`）。

## 导出规则

| 子路径 | 入口 | 用途 |
|--------|------|------|
| `"."` | `src/index.ts` | **生产** Schema / BizCode / DTO |
| `"./testing"` | `src/testing.ts` | **仅测试** ask final 工厂等；**禁止**挂进主 index |

- 内部 re-export 使用 ESM 后缀 `.js`  
- 生产：`import { AskRequestSchema, BizCode, ... } from '@strict-rag/contracts'`  
- 测试：`import { makeAbstainedFinal, makeAnsweredFinal } from '@strict-rag/contracts/testing'`  
- **禁止**业务 runtime 依赖 `./testing`（边界：主入口不 re-export fixtures）

### Scenario: 跨层 ask final fixture（R10）

#### 1. Scope / Trigger
- 跨层：contracts schema ↔ web RTL ↔（可选）api 形状对齐  
- 新增/改 `AskResponse` 字段或拒答 UI 时

#### 2. Signatures
- `makeAnsweredFinal(overrides?: Partial<AskResponse>): AskResponse`  
- `makeAbstainedFinal(overrides?: Partial<AskResponse>): AskResponse`  
- 导出：`@strict-rag/contracts/testing`

#### 3. Contracts
- 工厂输出必须通过 `AskResponseSchema.safeParse`  
- UUID 字段合法；`status`/`reason` 与 PRD reason 枚举一致

#### 4. Validation & Error Matrix
- fixture 不过 schema → contracts 单测红（R10）  
- web 使用过期手抄 JSON → 跨层假绿（禁止）

#### 5. Good / Base / Bad
- Good：contracts fixture 测 + web 同工厂 RTL  
- Base：`makeAbstainedFinal()` 默认 low_retrieval  
- Bad：apps/web 与 packages 各维护一份字面量 final

#### 6. Tests Required
- `packages/contracts/tests/ask/fixtures.test.ts`：`R10:` safeParse answered/abstained  
- web ask-panel / hooks：同工厂；关键 it 标题可挂 R2/R10

#### 7. Wrong vs Correct
```ts
// Wrong — 主入口泄漏测试工厂
export * from './ask/fixtures.js'; // in index.ts

// Correct
// package.json: "./testing": "./src/testing.ts"
// index.ts 不导出 fixtures
```

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
