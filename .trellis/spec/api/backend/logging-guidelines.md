# api · 日志指南

## 选型

- 库：**Pino**（栈冻结）  
- **现状：已接入** — 入口 `apps/api/src/logger.ts`；请求/审计路径应走本 logger，**禁止**再引入第二套日志库  

## 上下文字段（工程 PRD）

请求日志尽量带：

```text
requestId, tenantId, userId, kbId?, sessionId?
```

| 字段 | 说明 |
|------|------|
| requestId | 与 `ApiMeta.requestId` 一致，便于前后关联 |
| tenantId / userId | 鉴权后注入；未登录路径可省略 user |
| kbId / sessionId | 进入对应资源时附加 |

## 级别建议

| Level | 用途 |
|-------|------|
| error | 未处理异常、依赖 down、鉴权基础设施失败 |
| warn | 可恢复降级、限流触发、配置接近阈值 |
| info | 请求完成、入队成功、启动/ready 状态 |
| debug | 仅开发；生产默认关 |

## 管理写路径操作日志（ARCH-P1b-2）

**口径 = 默认全审 + 显式例外**（2026-10-10 · 图 `.scratch/admin-write-audit-scope/` 工单 02 裁定 R1–R3）。
判定式：`MUTATING ∧ ¬基础设施路径 ∧ ¬例外表 ⇒ 审计`。判定在**路由匹配之前**（`app.ts` 里挂在 auth 之后、域路由之前），手上只有 `method` + `c.req.path`（带 `/api/v1` 前缀、不含 query），**拿不到**权限码 —— 故口径只能落在路径上。
语义口径：管理写 = **改变 KB 治理状态或平台治理状态**的写（访问 / 内容去向 / 配置）。

| 项 | 约定 |
|----|------|
| 入口 | `apps/api/src/middleware/admin-write-audit.ts`（挂在 **auth 之后**） |
| 例外表 | 源码 `AUDIT_EXCLUSIONS`（7 条 = 11 条路由，逐条带 `reason` + 声明的 `routes`，用 `isAuditExcluded` 判定）：`/api/v1/auth/*` · `POST …/ask` · `POST /api/v1/ask/:requestId/feedback` · `POST …/sessions` · `POST …/documents/upload-url` · `POST …/documents/:docId/complete` · `/api/v1/internal/*` |
| 事件 | `event: 'admin_write'` + `method` / `path` / `status` / `durationMs` |
| 上下文 | `requestId` · `userId?` · `tenantId?` · `kbId?`（路径可解析时） |
| 存储 | **仅 Pino**（stdout）；**不**落审计表、**不**记 body / 字段值 / Authorization；**无**读面 / 无留存配置 |
| 防漂移 | `apps/api/tests/obs/admin-write-coverage.test.ts`：从真实 app 路由表（`createApp().routes`，按 `(method,path)` 去重）断言 **全覆盖 + 例外表紧致 + 计数 39+11=50** —— **新增写路由不显式决定即红**；例外 pattern **在 mutating 路由集上多命中一条已注册路由**即红（写成更宽但不多吞已注册路由不会红） |

**三档「痕」（勿混）**：① **L1** `admin_write` 通用 Pino 行 —— 全部管理写，**不可查账**；② **L2** 持久化 diff 账本 `kb_settings_audits` + `GET …/settings-audit` —— **只**给 PRD 明写「修改日志 / diff / 旧→新」的两条（KB settings PATCH · chunk-strategies PATCH）；③ **L3** 领域事件（写路径内的 `event:` 结构化 Pino 行，带业务语义）。

判定与 payload 纯函数可单测：`shouldAuditAdminWrite` · `isAuditExcluded` · `buildAdminWritePayload` · `assertNoSensitiveLogKeys`。

## 禁止

- 日志打印 JWT、密码、Provider API Key、文档全文敏感体  
- 业务路径继续用 `console.log` / `console.error` 当主日志（统一 Pino）
- 为操作日志新建审计表或第二套日志库
- 把请求体 / 字段值塞进 `admin_write` 载荷（要「改了什么」只能走 L2 账本）

## 与观测

- 基建日志：Pino  
- LLM/质量链路：Langfuse（`prds/08-quality/03-langfuse-observability.md`）  
- 二者职责勿混：Pino 不等替 trace 里的 generation 细节
