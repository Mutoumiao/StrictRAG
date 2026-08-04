# admin · 质量指南

## 身份与壳（冻结语义）

> **权威**：`prds/09-security/01-auth-acl-compliance.md` §3.5 · `prds/05-api/01-http-api-hono.md` §1.2  
> **ADR-045 经 ADR-051 修订**：勿再使用「`platform_admin` ∨ KB write/admin」旧公式。  
> 工程 PRD `01-clhoria-template-alignment.md` §4 若仍写旧伪代码，**以安全/API PRD 为准**。

| 规则 | 说明 |
|------|------|
| 准入 | 有效权限含 **`admin.shell`**；根中间件 / 路由硬拦 |
| 无码 | 无 `admin.shell` → API **403** 或 **302 → web** |
| 进壳 ≠ 全权 | 允许进 admin **不**等于对所有 KB/动作有写权；具体 action 再验权限码 |
| pure read | **仅** `apps/web`（无 `admin.shell`）；不能只靠前端藏菜单 |
| 菜单裁剪 | `GET /me/permissions` + `@strict-rag/admin-catalog`；**菜单有无 ≠ API 授权** |
| 双罪禁止 | UI 误露 + API 漏检；前端有按钮 API 仍须验码 |

## 以码为准（ADR-051）

| 检查 | 说明 |
|------|------|
| 有效权限 | 角色模板默认 ∪ grants − denies |
| `super_admin` | 模板显式全权（审计）；**不要**用「是不是 platform_admin」单独代替全部码检查逻辑 |
| 非超管 | 按 **platform 码** / **kb scope 码** 放行；内容路径仍受成员与 ACL 约束 |
| 前端 | 用码裁剪 L1/L2；**禁止** `if (role === 'admin')` 本地写死放行业务按钮 |

## 技术约定

- 共享样式：`import { cn } from '@strict-rag/ui/lib/utils'`  
- 主题：`import '@strict-rag/ui/theme.css'`（接 Tailwind 后扩展）  
- 错误码展示：HTTP `error.code` 为 PRD 短名；见 [contracts-patterns](../../contracts/library/contracts-patterns.md)  
- 仅 `NEXT_PUBLIC_*` 可进浏览器包  

## 会话与 HTTP（已落地 · 参考 partner）

| 项 | 约定 |
|----|------|
| 存储 key | **仅** `strict-rag:admin:client-session`（禁止与 web 共用） |
| 内容 | `{ accessToken, refreshToken, session }` · 形状对齐 `TokenPairResponse` |
| http | `apps/admin/src/lib/http.ts`：自动 Bearer；`UNAUTHORIZED` **单飞** refresh → 重试；失败清会话 |
| refresh URL | `POST /api/v1/auth/admin/token/refresh` |
| Guard | `AdminAuthGuard`：有本地会话 → `/auth/me` → 须含 **`admin.shell`** |
| 登录 | 开发：`/login` + `adminDevLogin`；生产改 Better Auth 后仍写同一 `saveClientSession` |

**反模式**：页面各自 `fetch` 不经 http 层导致无 refresh；用 `session.roles` 判断按钮权限而不看 `permissions` / 不调 API。

## 骨架阶段

- 保持占位或 Phase 0+ 最小壳  
- 未授权不做完整业务页充数  
- 线稿参考 `product.pen`，交付说明见 `prds/12-delivery-guides`（非接口 SSOT）  

## 反模式

- **Bad**：准入写成 `platform_admin` ∨ 任一 KB `write`/`admin`（旧 ADR-045）  
- **Bad**：admin 内再定义 `PERMISSIONS` 数组  
- **Bad**：把 ask SSE 主体验做成 admin 默认首页（用户端在 web）  
- **Good**：catalog 注册 `admin.shell` 与业务码 → api 验码 → admin 按码渲染
