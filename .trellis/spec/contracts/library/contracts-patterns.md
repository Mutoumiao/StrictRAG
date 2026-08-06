# contracts · 编码模式

## 0. 强制纪律（前后端共用）

| 规则 | 说明 |
|------|------|
| **所有 HTTP API 线型在本包** | 请求 body / 查询参数 / 成功 `data` / SSE 事件载荷 / `BizCode` **必须**定义在 `packages/contracts` |
| **前后端同一类型** | api route `ok(c, data)` 的 `data` 与 admin/web 客户端泛型 **同一 export**；禁止 apps 内平行 `type XxxResponse` |
| **Zod + `z.infer`** | Schema 与 Type 同文件；api 入口 `safeParse` **body 与 query**；出口用类型标注（或 Schema.parse） |
| **Query 必接线** | 定义了 `*QuerySchema` 的 GET **必须**在 route `safeParse`；禁止 Schema 只导出、route 手写 `Number(query)` / 白名单 if 链（契约死代码） |
| **禁止** | apps 内手写 wire shape；route 直接吐 DB 行当公开 DTO（须映射到 contracts 类型） |

新增接口流程：

1. 在 `packages/contracts/src/<domain>/*.contract.ts` 写 Schema + type（含 Query）  
2. `src/index.ts` 导出  
3. `apps/api` 路由：body **与** query `safeParse`；成功 `data` 用 contracts 类型  
4. 前端：admin 在对应 `app/.../api.ts`（或 `auth/api`）封装；web 在 `src/api/<domain>.ts` 封装；传输层仅 `lib/http`。业务编排在 `services` / hooks，**禁止**在 services 写 path（见 admin/web [module-layering](../../admin/frontend/module-layering.md)）

---

## 1. BizCode

**文件**：`packages/contracts/src/common/biz-code.ts`

```typescript
export const BizCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  // 字符串值 = PRD §4 短名
} as const;

export type BizCode = (typeof BizCode)[keyof typeof BizCode];
```

### 对外 code 与 PRD 对齐（冻结 HOW）

| 规则 | 说明 |
|------|------|
| **HTTP `error.code` 权威** | `prds/05-api/01-http-api-hono.md` **§4 短名** |
| **实现只引用本包** | 前后端禁止魔法字符串；apps 不自建第三套码表 |
| **当前形状** | `BizCode` **字符串值 = PRD 短名** |
| 类型 | 用 `typeof` 推导，勿手写平行 union |
| 扩展 | 新码先写 PRD（或 ADR）→ 再进本包 → 值用 PRD 短名 |

**反模式**：

- 写 `code: 'AUTH.UNAUTHORIZED'` 点分串（已废弃）  
- 不经 `BizCode` 的魔法字符串  
- 对外混用点分名与 PRD 短名

---

## 2. 响应信封

**文件**：`packages/contracts/src/common/response.ts`

| 类型 | 形状 |
|------|------|
| `ApiSuccess<T>` | `{ ok: true, data: T, meta: ApiMeta }` |
| `ApiFailure` | `{ ok: false, error: ApiError, meta: ApiMeta }` |
| `ApiMeta` | `{ requestId, timestamp }` |
| `ApiError` | `{ code: BizCode, message, details? }` |

工厂函数：`buildSuccess` · `buildFailure`  

**反模式**：各路由手写 `{ success: true, result }` 旁路信封。

---

## 3. Zod 契约

**模式**（各域同形）：

```typescript
export const HealthResponseSchema = z.object({ /* ... */ });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

| 规则 | 说明 |
|------|------|
| Schema + infer 类型同文件 | 单一来源 |
| 校验位置 | api 入口 **body + query**；出口类型标注（优先 Schema.parse）；流式 `data-ask-final` 前端 **`AskResponseSchema.safeParse`** |
| query | 例：`SessionListQuerySchema`、`FeedbackQueueQuerySchema`（`z.coerce.number`）；非法 → 400 `VALIDATION_ERROR` |
| ask options/scope | **`.strict()`**；未知键 400（ADR-050） |

### 3.1 域覆盖（须完整）

| 域 | 路径 | 须含 |
|----|------|------|
| common | `common/*` | BizCode、ApiResponse |
| system | `system/health.contract.ts` | Health / Ready |
| auth | `auth/session.contract.ts` | DevLogin、TokenPair、Refresh、AuthMe |
| ingest | `ingest/document.contract.ts` | KB/文档 body + **全部**成功 data |
| ask | `ask/*` | Ask、Session、Feedback、Member、SSE 事件 |

### 3.2 Ask 要点

| Schema | 约束 |
|--------|------|
| `AskOptionsSchema` | 仅 stream / debug / mode / locale |
| `AskScopeSchema` | 顶层 docTypes；**不**进 options |
| `AskRequestSchema` | question；sessionId?；strict |
| `AskResponseSchema` | 同步 JSON ≡ 流式 `data-ask-final` |
| `AskSseStatusSchema` | AI SDK `data-status` 载荷（命名历史遗留 Sse 前缀） |
| `SessionListQuerySchema` | GET sessions：`limit`/`offset`；**须** list route 绑定 |
| `FeedbackQueueQuerySchema` | GET feedback-queue：`status`/`limit`/`offset`；**须** queue route 绑定 |

业务拒答 → 常 HTTP **200** + `status: abstained`；协议错误才 `ApiFailure`。

### 3.3 Query 接线（强制）

```typescript
// Correct：contracts Query + 默认值在 route
const q = SessionListQuerySchema.safeParse({
  limit: c.req.query('limit'),
  offset: c.req.query('offset'),
});
if (!q.success) return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, q.error.flatten());
const items = await repo.list({ limit: q.data.limit ?? 50, offset: q.data.offset ?? 0, ... });

// Wrong：Schema 已定义却手写 Number / if 白名单 → 契约死代码，校验分裂
const limit = Number(c.req.query('limit') ?? '50');
```

---

## 4. Auth / TokenPair

| 导出 | 用途 |
|------|------|
| `AuthAppSchema` | `'admin' \| 'web'` |
| `AuthSessionSchema` | 登录后会话视图 |
| `TokenPairResponseSchema` | access + refresh + session |
| `AuthMeResponseSchema` | `GET /auth/me` |
| `DevLoginRequestSchema` | 开发登录 body |

`permissions` 是快照，**不能**替代服务端再验。

---

## 5. 质量门槛

- TypeScript **strict**  
- Prettier：singleQuote · trailingComma all · printWidth 100  
- 无业务副作用、无 I/O、无 env  

---

## 6. 扩展清单

1. 建 `src/<domain>/*.contract.ts`  
2. 从 `index.ts` 导出  
3. 更新本 spec（若新域）  
4. api route + 前端封装共用类型：admin → 模块 `app/.../api.ts`（或 `auth/api`）；web → `src/api/<domain>.ts`；**services 不写 path**  
5. **禁止**在页面组件内定义 wire DTO
