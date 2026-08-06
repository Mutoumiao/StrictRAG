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
| 成功 | `buildSuccess(data, meta)` |
| 业务/可映射失败 | `buildFailure({ code, message, details? }, meta)` |
| meta | `{ requestId, timestamp }` |

信封与 `BizCode` 定义见 [contracts-patterns](../../contracts/library/contracts-patterns.md)。

---

## 错误码策略（唯一）

| 层 | 约定 |
|----|------|
| **对外 HTTP `error.code`** | 以 **`prds/05-api/01-http-api-hono.md` §4 短名** 为准（如 `UNAUTHORIZED`、`VALIDATION_ERROR`） |
| **实现引用** | 只通过 `@strict-rag/contracts` 的 `BizCode`（或后续同包映射辅助），**禁止** apps 内第三套字符串 |
| **对齐方向** | 实现错误中间件前，把 `BizCode` **字符串值改为等于 PRD 短名**，或提供 `BizCode → PRD code` 单一映射函数并 **只输出 PRD 短名** |

### 对齐状态（Phase 0/1 后）

`packages/contracts/src/common/biz-code.ts` 的 **字符串值已 = PRD 短名**。  
`apps/api` 的 `fail()` 直接输出 `BizCode` 值，**禁止**再点分。

| PRD `error.code`（对外） | HTTP | `BizCode` 常量 |
|--------------------------|------|----------------|
| `UNAUTHORIZED` | 401 | `BizCode.UNAUTHORIZED` |
| `FORBIDDEN` | 403 | `BizCode.FORBIDDEN`（含未批 scan） |
| `NOT_FOUND` | 404 | `BizCode.NOT_FOUND` |
| `VALIDATION_ERROR` | 400 | `BizCode.VALIDATION_ERROR` |
| `CONFLICT` | 409 | `BizCode.CONFLICT` |
| `PAYLOAD_TOO_LARGE` | 413 | `BizCode.PAYLOAD_TOO_LARGE` |
| `INTERNAL` | 500 | `BizCode.INTERNAL` |
| `SERVICE_UNAVAILABLE` | 503 | `BizCode.SERVICE_UNAVAILABLE` |

PRD 已有、骨架尚未占位的码（实现时 **补进 contracts，值=短名**）：

| PRD code | HTTP | 说明 |
|----------|------|------|
| `KB_NOT_READY` | 409 | 无 active+ready 文档 |
| `SESSION_REWRITE_DISABLED` | 400 | rewrite 未准出 |
| `SESSION_DISABLED` | 400 | 兼容别名；禁用于拒绝多会话壳 |
| `PAYLOAD_TOO_LARGE` | 413 | 上传超限 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | MIME/扩展（或统一 400，全仓一致） |
| `RATE_LIMITED` | 429 | 限流；建议 `Retry-After` |

ask 业务拒答 reason（`model_abstained` 等）走 **业务响应**，不要与系统 `error.code` 表混用。

---

## HTTP 映射（摘要）

| 情况 | HTTP | `error.code`（PRD） |
|------|------|---------------------|
| 成功 / 部分业务结果 | 200 | 信封 ok；ask 业务 status 见 API PRD |
| 未登录 | 401 | `UNAUTHORIZED` |
| 无权限 / 非成员 | 403 | `FORBIDDEN` |
| 资源不存在 | 404 | `NOT_FOUND` |
| 参数 / 非法 options | 400 | `VALIDATION_ERROR` |
| 状态冲突 / KB 未就绪 | 409 | `CONFLICT` / `KB_NOT_READY` |
| 上传超限 | 413 | `PAYLOAD_TOO_LARGE` |
| 限流 | 429 | `RATE_LIMITED` |
| 未捕获异常 | 500 | `INTERNAL` |
| ready 失败 | 503 | `SERVICE_UNAVAILABLE` |

未知错误：日志完整堆栈 + 对外 `INTERNAL`（勿泄内部细节）。

---

## 实现要点

1. Zod 失败 → `VALIDATION_ERROR`  
2. ready=false 关键路径 → `SERVICE_UNAVAILABLE`  
3. 未登录 → `UNAUTHORIZED`；已登录无码/无成员 → `FORBIDDEN`  
4. **不要**在 apps 内新建平行错误码表  
5. **不要**对外返回当前骨架的 `AUTH.UNAUTHORIZED` 点分串（对齐完成前用映射）  

## 现状

尚无错误中间件（代码未落）。**实现时**以本文件 + contracts + API PRD §4 为准，只保留 **一种** 对外 code 命名。

**ARCH-P0 逐步规格（文件落点 / PG 映射 / 测试）**见**总 backlog** HOW（实现前必读）：

`.trellis/tasks/08-06-project-backlog/research/arch-p0-runtime-hardening.md`

落地后须把「尚无错误中间件」改回「已有 onError/notFound + PG 兜底」，并删掉仅指向 research 的临时句。
