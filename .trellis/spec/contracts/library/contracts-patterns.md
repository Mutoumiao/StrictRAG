# contracts · 编码模式

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
| **HTTP `error.code` 权威** | `prds/05-api/01-http-api-hono.md` **§4 短名**（`UNAUTHORIZED`、`VALIDATION_ERROR`、…） |
| **实现只引用本包** | 前后端禁止魔法字符串；apps 不自建第三套码表 |
| **当前形状** | `BizCode` **字符串值 = PRD 短名**（Phase 0/1 已对齐） |
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

工厂函数：

- `buildSuccess(data, meta)`  
- `buildFailure(error, meta)`  

**语义分工**（与 PRD 对齐）：

- 系统/协议错误 → HTTP 4xx/5xx + failure 信封（实现阶段）  
- ask 业务拒答等 → 见 API PRD（可能 HTTP 200 + 业务 status）；**不要**与 `ApiFailure` 混用语义时不写文档  

**反模式**：各路由手写 `{ success: true, result }` 旁路信封。

---

## 3. Zod 契约

**文件**：`packages/contracts/src/system/health.contract.ts`

模式：

```typescript
export const HealthResponseSchema = z.object({ /* ... */ });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

| 规则 | 说明 |
|------|------|
| Schema + infer 类型同文件 | 单一来源 |
| Phase 0 | `service: 'api' \| 'worker'`；`ReadyResponse.checks` 可选 |
| 校验位置 | api 出口或测试断言；实现阶段入口 body 也用同包 schema |

当前 Health：

- `status: z.literal('ok')`  
- `env: development \| test \| staging \| production`  

---

## 4. Auth / TokenPair（身份契约）

**文件**：`packages/contracts/src/auth/session.contract.ts`  
**权威实现说明**：[api auth-authorization](../../api/backend/auth-authorization.md)

| 导出 | 用途 |
|------|------|
| `AuthAppSchema` | `'admin' \| 'web'` 子站隔离 |
| `AuthSessionSchema` | 会话视图（含 `permissions` 快照） |
| `TokenPairResponseSchema` | access + refresh + session |
| `TokenRefreshRequestSchema` | `{ refreshToken }` |
| `DevLoginRequestSchema` | 仅开发登录 body |

### 规则

| 规则 | 说明 |
|------|------|
| 前后端共用形状 | admin/web `client-session` 存 `TokenPair` 字段子集 |
| `permissions` 是快照 | **不能**替代 api `resolveEffectiveCodes` |
| `roles` 是锚点 | **禁止**作为唯一放行条件 |
| 扩展登录方式 | 可换 Better Auth 签发；**尽量保持 TokenPair 字段** 或写适配层 |

### 错误码（鉴权）

使用已有短名：`UNAUTHORIZED` · `FORBIDDEN` · `VALIDATION_ERROR` · `INVALID_CREDENTIALS` · `NOT_FOUND`。  
**禁止**再引入 `AUTH.UNAUTHORIZED` 点分串。

### 反模式

- apps 内自建平行 `type LoginResponse`  
- refresh 响应缺 `session.permissions` 导致菜单不更新  


Ready：

- `ready: boolean`  
- `checks?: Record<string, 'up' \| 'down' \| 'skipped'>`  

---

## 4. 质量门槛

- TypeScript **strict**（继承 base tsconfig）  
- Prettier：singleQuote · trailingComma all · printWidth 100  
- 无业务副作用、无 I/O、无 env 读取  

---

## 5. 扩展清单（实现时）

新增域契约时：

1. 建 `src/<domain>/*.contract.ts`  
2. 从 `index.ts` 导出  
3. 更新本 spec 与相关 PRD 版本（若冻接口）  
4. web/admin/api 改为从本包 import
