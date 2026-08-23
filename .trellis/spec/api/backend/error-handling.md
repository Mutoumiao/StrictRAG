# api · 错误处理

## 契约基础（已存在）

使用 `@strict-rag/contracts`：

```typescript
import {
  BizCode,
  buildFailure,
  buildSuccess,
  type ApiMeta,
} from '@strict-rag/contracts';
```

| 场景 | 模式 |
|------|------|
| 成功 | `buildSuccess(data, meta)` / route 用 `ok(c, data)` |
| 业务/可映射失败 | `buildFailure({ code, message, details? }, meta)` / `fail(c, code, message, status)` |
| meta | `{ requestId, timestamp }` |

信封与 `BizCode` 定义见 [contracts-patterns](../../contracts/library/contracts-patterns.md)。

---

## 错误码策略（唯一 · X-11）

| 层 | 约定 |
|----|------|
| **对外 HTTP `error.code` 权威** | **`prds/05-api/01-http-api-hono.md` §4 短名** |
| **实现引用** | 只通过 `@strict-rag/contracts` 的 `BizCode`，**禁止** apps 内第三套字符串 |
| **对齐** | `BizCode` 字符串值 = PRD 短名；`fail()` 直接输出 |
| **扩码顺序** | ① PRD §4 或 ADR 登记短名 → ② `biz-code.ts` → ③ error-handling 表 → ④ 调用方 |

### 实现全集 ↔ PRD §4（对照）

| PRD `error.code`（对外） | HTTP | `BizCode` 常量 | 备注 |
|--------------------------|------|----------------|------|
| `UNAUTHORIZED` | 401 | `BizCode.UNAUTHORIZED` | |
| `FORBIDDEN` | 403 | `BizCode.FORBIDDEN` | |
| `NOT_FOUND` | 404 | `BizCode.NOT_FOUND` | |
| `VALIDATION_ERROR` | 400 | `BizCode.VALIDATION_ERROR` | |
| `CONFLICT` | 409 | `BizCode.CONFLICT` | |
| `PAYLOAD_TOO_LARGE` | 413 | `BizCode.PAYLOAD_TOO_LARGE` | ADR-039 |
| `INTERNAL` | 500 | `BizCode.INTERNAL` | |
| `UPSTREAM_TIMEOUT` | 500 | `BizCode.UPSTREAM_TIMEOUT` | 全局请求超时；`fail` 联合类型无独立 504 |
| `SERVICE_UNAVAILABLE` | 503 | `BizCode.SERVICE_UNAVAILABLE` | |
| `KB_NOT_READY` | 409 | `BizCode.KB_NOT_READY` | ask 前置 |
| `SESSION_REWRITE_DISABLED` | 400 | `BizCode.SESSION_REWRITE_DISABLED` | ADR-047 |
| `RATE_LIMITED` | 429 | `BizCode.RATE_LIMITED` | |
| `INVALID_CREDENTIALS` | 401 | `BizCode.INVALID_CREDENTIALS` | 登录域；须在 §4 可检索或并入 UNAUTHORIZED 叙事 |
| `RULE_VIOLATION` | 400/422 | `BizCode.RULE_VIOLATION` | 业务规则；优先能映射则用 VALIDATION/CONFLICT |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `BizCode.UNSUPPORTED_MEDIA_TYPE` | 上传 MIME |
| `SESSION_DISABLED` | 400 | `BizCode.SESSION_DISABLED` | **兼容别名**＝ rewrite 不可用；**禁止**用于拒多会话壳 |

| 分裂处理（HOW 焊死） | |
|----------------------|--|
| 三源冲突 | **PRD 短名 > contracts 值 > 本文表**；发现 contracts 有、§4 无 → **记债并回写 PRD**（本 closeout 已对齐扩码顺序） |
| ask 拒答 | `reason` 在 **业务 data**，**不是** `error.code` |
| 点分码 | 已废弃；`AUTH.UNAUTHORIZED` 类 **禁止** |

ask 业务拒答 reason（`model_abstained` 等）走 **业务响应**，不要与系统 `error.code` 表混用。

---

## 全局中间件（ARCH-P0 · 已落地）

| 组件 | 路径 | 行为 |
|------|------|------|
| `notFound` | `app.ts` 内联 | 404 · `NOT_FOUND` · 标准信封 |
| `onError` | `middleware/on-error.ts` | throw 兜底：HTTPException 有 body 不双包 → PG 映射 → `INTERNAL` |
| PG 映射 | `lib/pg-error.ts` | 仅兜底；业务仍显式 `fail()` |

### PG SQLSTATE → BizCode

| PG `code` | HTTP | BizCode |
|-----------|------|---------|
| `23505` / `23503` / `40001` / `40P01` | 409 | `CONFLICT` |
| `23502` / `23514` | 400 | `VALIDATION_ERROR` |
| 其他 / 无 code | 500 | `INTERNAL` |

**禁止**：`23503` → `VALIDATION_ERROR`。  
**禁止**：stack / SQL 参数进响应体。

### 运行时中间件相关错误

| 触发 | HTTP | code |
|------|------|------|
| JSON body > `API_JSON_BODY_LIMIT_BYTES` | 413 | `PAYLOAD_TOO_LARGE` |
| 全局 timeout（非 ask） | 500 | `UPSTREAM_TIMEOUT` |

---

## HTTP 映射（摘要）

| 情况 | HTTP | `error.code` |
|------|------|--------------|
| 成功 / 部分业务结果 | 200 | 信封 ok |
| 未登录 | 401 | `UNAUTHORIZED` |
| 无权限 / 非成员 | 403 | `FORBIDDEN` |
| 资源不存在 | 404 | `NOT_FOUND` |
| 参数非法 | 400 | `VALIDATION_ERROR` |
| 状态冲突 / KB 未就绪 | 409 | `CONFLICT` / `KB_NOT_READY` |
| 上传/体超限 | 413 | `PAYLOAD_TOO_LARGE` |
| 限流 | 429 | `RATE_LIMITED` |
| 未捕获异常 | 500 | `INTERNAL` |
| 请求超时 | 500 | `UPSTREAM_TIMEOUT` |
| ready 失败 | 503 | `SERVICE_UNAVAILABLE` |

未知错误：日志完整堆栈 + 对外 `INTERNAL`（勿泄内部细节）。

---

## 实现要点

1. Zod 失败 → `VALIDATION_ERROR`  
2. ready=false 关键路径 → `SERVICE_UNAVAILABLE`  
3. 未登录 → `UNAUTHORIZED`；已登录无码/无成员 → `FORBIDDEN`  
4. **不要**在 apps 内新建平行错误码表  
5. 业务 handler 继续 `return fail()` / `return ok()`；`onError` 只处理 throw  
6. 测试：`tests/env/error-envelope.test.ts` · `tests/env/pg-error.test.ts`（导航 `apps/api/tests/index.md`）

## 现状

**已有** `app.onError` / `app.notFound` + PG 兜底 + secure/timeout/bodyLimit（ARCH-P0，task `08-06-arch-p0-runtime-hardening`）。

HOW 历史指引：`.trellis/tasks/08-06-project-backlog/research/arch-p0-runtime-hardening.md`
