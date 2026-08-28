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

- 共享样式 / 组件：`@strict-rag/ui/lib/utils` · `@strict-rag/ui/components/ui/*`  
- 主题管道：**完整契约**见 [ui · component-guidelines](../../ui/frontend/component-guidelines.md)  
  - `src/app/globals.css` → `@import '@strict-rag/ui/theme.css'` + `@source` 本 app  
  - `layout.tsx` 只 `import './globals.css'`  
  - Soft Bento：`bg-background` `#F3F5F8` · `bg-primary` `#2563EB` · Admin 侧栏可用 `bg-sidebar`  
- 构建：`next build --webpack` + `extensionAlias`（NodeNext `.js`→`.ts`）  
- 错误码展示：HTTP `error.code` 为 PRD 短名；见 [contracts-patterns](../../contracts/library/contracts-patterns.md)  
- 仅 `NEXT_PUBLIC_*` 可进浏览器包  

### Don't: 内联 style 做运营页布局

```tsx
// Bad
<div style={{ padding: 16, color: 'var(--sr-muted)' }} />

// Good
<div className="p-4 text-muted-foreground" />
```


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

## 阶段口径（S2c + 08-11）

- 已具备：登录 · 壳 · 文档/审批/成员 · **B1–B6 薄页** · **B13 反馈队列**（`/feedback` · 码 `feedback.queue`）· 顶栏建库入口（`kb.create`）  
- 运营 SLA：`docs/ops/feedback-sla.md`（1 工作日处理约定；**非**代码硬闸）  
- 未做：完整 APM · DEPT_ACL 强制 UI · KB 级模型绑定写 UI 等  
- 线稿参考 `product.pen`；交付白话见 `prds/12-delivery-guides`（**非**接口 SSOT）  
- **禁止**把 ask SSE 做成 admin 默认首页（用户端在 web）  
- **禁止**无 `feedback.queue` 时前端假装可关单（按钮可见 ≠ API 授权）

### Convention: 分片策略设置与上传人选

**What**：知识库设置「分片策略」分区用弹窗启用码 + 各 MIME 族 recommended；上传走 `for-upload` 人选，禁止写死 `structure_paragraph`。改库启用不自动 reindex。

**Why**：ADR-053 三层最小闭环。

**Related**：api `routes/chunk-strategies.ts`；设置 HTTP 在 `kb/settings/api.ts`，上传 `for-upload` 在 `documents/api.ts`。

### Convention: 文档运营余量

**What**：列表有类型列与双轴运营标签（待审 / 处理中 / 需 OCR / 失败 / 就绪未发布 / 现行可问 / 已替代 / 已归档；原串次要）。Reindex 行展开按钮须 `doc.reindex`，≥2 未选不可提交。PATCH `docType` 须属于该库枚举。lifecycle 含归档/废止；上架仍须 `status=ready`。检索闸不自动升。

**Why**：功能表 §4.3 最小运营面。不做生效区间、DELETE、替代联动、类型分区 CRUD。

**Related**：`documents/api.ts` · `list.services.ts` · `lifecycle.services.ts` · `reindex.services.ts`。

### Convention: 建库入口

**What**：有 `kb.create` 才在顶栏 KB 选择器旁显示「创建知识库」；表单 = 名称 + 首位库管（预填当前用户、可改）。成功后写入 `last-kb-id`。

**Why**：PRD §2.1 要闭环；禁止独立空壳二级菜单，也禁止在向导里配策略/类型/绑定。

**Related**：api `POST /knowledge-bases`；HTTP 在 `lib/kb-api.ts`，用例在 `lib/kb-create.services.ts`。

### Convention: 反馈队列（B13）

**What**：admin 列表/处理走 contracts + `feedback.queue`；web 提交走 ask 成员路径。

**Why**：闭环分端；运营处理与用户提交权限分离。

**Related**：api [ask-pipeline](../../api/backend/ask-pipeline.md) feedback 表；web [quality-guidelines](../../web/frontend/quality-guidelines.md)。

## 前端测试（Vitest + RTL）· 可执行约定

| 项 | 约定 |
|----|------|
| 运行 | `pnpm --filter @strict-rag/admin test` |
| 环境 | `vitest.config.ts`：jsdom · `tests/**` · `@` → `src` |
| 基建 | **仅** `src/test/`（setup · re-export）；用例现行 `tests/<能力>/`，HOW：[testing](../../guides/testing.md) |
| 查询 | role/label；菜单/按钮按 **permissions** 断言显隐 |
| 必测红线 | `admin.shell` Guard · `clipMenuForShell` 菜单 · 审批 decide/scan 显隐 · session/KB key 隔离 · **P0 R5/R6** |
| P0 清单 | `docs/testing/p0-redlines.md`；关键 `it` 标题 `R#:` |
| 勿堆 | 每个运营页全 CRUD 冒烟；无行为变化的纯展示页；完整登录浏览器旅程 |

### Guard mock（Strict Mode）

`AdminAuthGuard` mount 可能 **多次** `load`。`fetchAuthMe` / `readClientSession` 用 **`mockResolvedValue` / `mockReturnValue`**，**禁止**成功路径 `mockResolvedValueOnce` 耗尽后误跳 `/login`。

### `ApiHttpError`（admin 专用签名）

```ts
// apps/admin/src/lib/http.ts — 三参；web 仍是两参
new ApiHttpError(code, message, shouldRefresh: boolean)
```

测 `mapBizError` / services 时必须传第三参（通常 `false`），否则 `tsc` 红。

### Convention: R5 断言 `ApiHttpError` 字段（非 mapBizError）

**What**：P0 **R5** = 构造后直接 assert `.code` / `.shouldRefresh`（见 `apps/admin/tests/auth/http-error-fields.test.ts`）。  
**R6** = `mapBizError` 只保证展示字符串含 code（`mapBizError` **故意不**透出 `shouldRefresh`）。

**Why**：经 `mapBizError` 测 shouldRefresh 永远失败或逼改生产 API 返回结构化对象（本期非目标）。

```ts
// Good — R5
const err = new ApiHttpError('UNAUTHORIZED', 'please refresh', true);
expect(err.shouldRefresh).toBe(true);

// Bad — 用 mapBizError 字符串断言 shouldRefresh
expect(mapBizError(err)).toContain('shouldRefresh');
```

### P0 红线标题

关闭 R5/R6 的关键 `it` 标题含 `R5:` / `R6:`。清单：`docs/testing/p0-redlines.md`。
### Session / KB key

| Key | 用途 |
|-----|------|
| `strict-rag:admin:client-session` | 双 token + session（**禁止**写 web key） |
| `strict-rag:admin:last-kb-id` | 顶栏 KB；**禁止**写 `strict-rag:web:last-kb-id` |

`session` fixture 同 web：须 `app:'admin'` · `permissions` · `expiresAtMs`（见 web quality-guidelines Session fixture）。

### 必测断言点（admin）

| 场景 | 断言 |
|------|------|
| 无本地会话 / 无 `admin.shell` | `router.replace('/login')`；不渲染子树 |
| 仅 `doc.view` | 有「文档」链；无「审批中心」；**无**「数据面板」（缺 `dashboard.view`，非「面板未实现」） |
| 审批有 view 无 decide | 列表可出；**无**「通过」「驳回」 |
| 有 decide | 可点「通过」且 `applyApprovalAction(kb, id, 'approve')` |
| 有 `doc.upload` + approved | 有「入队 scan」 |

## 反模式

- **Bad**：准入写成 `platform_admin` ∨ 任一 KB `write`/`admin`（旧 ADR-045）  
- **Bad**：admin 内再定义 `PERMISSIONS` 数组  
- **Bad**：把 ask SSE 主体验做成 admin 默认首页（用户端在 web）  
- **Bad**：Guard 成功路径 `mockResolvedValueOnce` → Strict Mode 二次 load 误登出  
- **Good**：catalog 注册 `admin.shell` 与业务码 → api 验码 → admin 按码渲染  

## 模块分层反模式（摘要）

> 全文：[module-layering.md](./module-layering.md)

- **Bad**：`services` / 组件内写 `'/api/v1/...'` 或复制 path（path **只**在 `api.ts`）  
- **Bad**：页面 / 组件直接 `fetch` 业务接口并堆 toast  
- **Bad**：hooks 与 services 双份同一套 list+toast 编排  
- **Bad**：上帝 `services.ts` 不按业务拆分；导出 `handleClick` / `doStuff`  
- **Bad**：空建 `store.ts` / `hooks/` / 平行 wire `types.ts`  
- **Bad**：跨模块复制 path，或滥用对方 `services`（应优先对方 `api`）  
- **Bad**：`services` 内维护权限码决策树 / `if (role === …)` 放行（权限引擎在 **API**；UI 只裁剪；services 只映射 403）  
- **Bad**：**欠抽** — ≥3 文件同形 `mapErr`/纯逻辑仍复制；path 多处复制（应 A1/A4）  
- **Bad**：**过抽** — 仅 loading 四态像就 `useOpsWorkspace(config)`；options 丛林；为第 4 页预建空 hook（应 B1～B4）  
- **Good**：`page` 薄 → `_components` 调用例名 → `*.services.ts` 调 `api` → `lib/http`  
- **Good**：无 React 用 services；须 `useChat`/订阅用 hooks；体量按用例拆 `list.services.ts` 等  
- **Good**：按钮按有效码显隐 + API 硬验码；services 假定「能点到就请求」，失败用 `mapBizError`  
- **Good**：抽公共优先 **纯函数**（`mapBizError`），UI 状态机未达触发前允许样板重复；详见 [module-layering §12.1](./module-layering.md)

### Common Mistake: Guard 测用 once mock

**Symptom**：有 `admin.shell` 的测偶发 `replace('/login')`，子树闪一下消失。

**Cause**：React Strict Mode / 会话事件二次 `load`，`mockResolvedValueOnce` 第二次返回 undefined 进 catch。

**Fix**：持续 `mockResolvedValue`；`readClientSession` 同步 `mockReturnValue`。
