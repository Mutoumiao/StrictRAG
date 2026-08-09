# @strict-rag/admin · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/admin` |
| 端口 | 3006 |
| 成熟度 | **可演示**（S2c 运营薄壳：文档 / 审批 / 成员 / 分片 / 设置 / 模型 + 用户 / 角色 / 部门 + **数据面板薄壳**） |
| 默认依赖模式 | 鉴权 = 临时双 JWT + admin **dev-login**（经 api）· 知识库 = 手工填写 uuid · 菜单 = `clipMenuForShell` 裁剪（catalog 为 SSOT） |
| 关联模块 | API 依赖：`api` 的文档 / 审批 / 成员 / 分片 / 设置 / 模型 / 用户角色 / 部门 / **dashboard summary**；菜单与权限码：`admin-catalog`；类型契约：`contracts`；样式：`ui` |
| 最近更新 | 2026-08-09 |
| Spec | `.trellis/spec/admin/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · 审批 / 成员相关 API |

## 一句话状态

Next.js 管理端：**登录 + 文档只读列表 + 审批中心 + 成员管理 + 分片只读 + 知识库设置 + 模型网关最小集 + 用户 / 角色 / 部门最小集 + 数据面板薄壳** 均已接通；知识库靠手填 id 指定，外壳通过 catalog 的 **`clipMenuForShell`** 只显示已落地的路由，**不是**完整的运营台（没有 APM 时序 / 部门强制隔离相关 UI）。包内配有 Vitest / RTL 红线测试（覆盖外壳 / Guard / 审批 / **dashboard 403** + **P0 R5/R6**；**不是** E2E 测试）。

---

## 已具备能力

### 鉴权外壳
- 登录页、客户端 session、`AdminAuthGuard`（在 ops layout 层拦截未登录访问）
- 开发登录 `admin/dev-login`（可选角色模板）；登出仅清除本地 session
- 顶栏按当前用户权限裁剪后展示菜单

### 运营外壳（S2c · B7 菜单裁剪）
- `AdminShell`：消费 `clipMenuForShell` 的裁剪结果（**没有**本地 href 白名单）；已落地 href 的 SSOT 在 `admin-catalog` 的 `ADMIN_IMPLEMENTED_HREFS`
- 当前落地十条路由：`/dashboard` · `/documents` · `/approvals` · `/members` · `/chunks` · `/kb/settings` · `/models` · `/users` · `/roles` · `/departments`
- 知识库手填 id，并通过 localStorage 记忆 `strict-rag:admin:last-kb-id`

### 数据面板（B6 薄壳）
- `/dashboard`：只读 3–5 指标（kb / 文档 / 待审 / processReady / 近 24h 问答）；`page → services → api` 分层
- 需要 `dashboard.view`；无码菜单隐藏、直链 **403 态**；**不是** APM / Grafana

### 文档
- `/documents`：按知识库拉取文档列表；表格展示 status / approval / lifecycle 列（**只读刷新**；审批操作在审批页进行）
- `DocRow` 类型包含 embedReady / esReady 字段，但 **UI 尚未渲染"双就绪"列**

### 分片只读（B1）
- `/chunks`：选择文档 → 查看 preview 列表 → **点击后**才拉取该分片的完整正文；无 `chunk.view` 权限时显示 403 状态
- 文档列表的数据路径复用 `documents/api`（禁止复制路径另起一套）
- **禁止**在页面挂载时批量预拉所有分片全文

### 知识库设置（B2）
- `/kb/settings`：基本信息、问答档位、**质量只读展示**、**rewrite 锁定开关**（无开启控件）
- 需要 `kb.config.write` 权限；无权限时显示 403 状态；数据路径仅 `kb/settings/api.ts` 一处
- **没有** τ 滑块、**没有**供应商 Key 配置、**没有** docTypes / 分片策略弹窗 / 知识库模型绑定分区

### 模型网关（B3 最小集）
- `/models`：供应商列表 / 新建 / 编辑（预设、baseUrl、Key 密码框、模型表）+ **平台级 purpose 绑定**（catalog 下拉选择）
- 需要 `model.gateway.manage` 权限（默认仅 super_admin 持有）；无权限时显示 403 状态；数据路径仅 `models/api.ts` 一处
- Key **只写不回显**；**没有**真实的 fetch-models 代理 UI；**没有**知识库级绑定

### 平台用户 / 角色（B4 最小集）
- `/users`：用户列表、新建（email / displayName / 角色）、启用禁用、修改角色；需要 `user.manage` 权限；数据路径仅 `users/api.ts` 一处
- `/roles`：角色列表、新建自定义角色、勾选权限码并保存；需要 `role.perm.manage` 权限；数据路径仅 `roles/api.ts` 一处
- **没有**密码相关 UI；登录仍走 dev-login 模板（DB 角色未接入 JWT）
- 用户部门归属的编辑入口在 **`/departments`** 页（通过粘贴 userId 操作）

### 部门（B5 最小集）
- `/departments`：组织树列表、新建根 / 子部门、启用停用、删除（要求无子部门且无成员）、用户归属管理（需要 `user.manage` 权限）
- 需要 `dept.manage` 权限；无权限时显示 403 状态；数据路径仅 `departments/api.ts` 一处
- **没有**跨部门授权 UI、**没有**文档密级字段、**没有** DEPT_ACL 开关的运营页

### 审批中心
- `/approvals`：待审批 / 已通过 两个分栏
- 持有 `approval.decide` 权限时显示通过 / 驳回按钮；持有 `doc.upload` 权限时，已通过的文档可以触发 `scan` 入队
- 按钮可见 ≠ 已授权；无权限调用 API 仍会返回 403

### 成员管理
- `/members`：成员列表、邀请（email + 角色）、移除
- 需要 `member.manage` 权限；无权限时显示错误状态

### 工程
- 传输层：`lib/http.ts`（Bearer 认证 + 单飞 refresh 机制）；知识库偏好：`lib/kb-context.ts`（**不是** HTTP 业务大杂烩）
- 身份：`auth/api.ts`
- 模块私有 API：`app/(ops)/{dashboard,documents,approvals,members,chunks,kb/settings,models,users,roles,departments}/api.ts`（**没有** `lib/admin-api.ts`，也**没有** `src/api/` 集中仓库）
- `lib/http` 包含 `put` 方法（用于平台绑定 PUT 请求）
- 类型来自 `@strict-rag/contracts`；菜单 / 权限码来自 `@strict-rag/admin-catalog`
- 样式：Tailwind v4（`postcss.config.mjs`；`src/app/globals.css` 引入 `@strict-rag/ui/theme.css` 并配置 `@source`）；页面以 `className` + ui 原子组件为主，**没有**大面积用 `style={{}}` 写布局 / 色板
- 构建：`next build --webpack`；`next.config` 配置 `transpilePackages` + webpack `extensionAlias`（用于把 ui 包内的 `.js` 引用解析到 `.ts` 源码）
- **单元 / 组件测试**（Vitest + jsdom + RTL）：`vitest.config.ts` · `src/test/{setup,test-utils}` · 各模块同域的 `*.test.ts(x)`
  - 现有覆盖：`admin-shell`（含 `dashboard.view` 菜单）· `dashboard-workspace`（403 / 指标）· `auth-guard` · `approvals-workspace` · R5/R6 等
  - P0 清单：`docs/testing/p0-redlines.md`（本包负责 R5–R6）
  - **没有**文档 / 成员 / 分片 / 设置 / 模型 / 用户 / 角色 / 部门各工作区测试；**没有** E2E；**没有** `lib/http` 全路径 refresh 集成测试

---

## 明确未做 / 边界

### 本包 UI 未交付

| 项 | 说明 |
|----|------|
| 知识库设置全量项（docTypes / 分片策略 / KB 级模型绑定） | B2 最小已落地；全量项仍挂账 |
| APM / 时序大盘 / 告警 | B6 仅为只读计数摘要，**不是**观测生产向 |
| 按历史 indexVersion 浏览分片的 UI | ADR-052 明确不做 |
| 文档上传 UI | 列表只读；上传走 API 或其他入口 |
| 完整运营 IA / 多知识库选择器 | 目前手填 uuid；不是产品级的库管体验 |
| 生产视觉 / product.pen **像素级**定稿 | 已使用 Soft Bento token + ui 组件；**并非**对 product.pen 的全屏像素还原 |

### 其他包 / 后端挂账

| 项 | 说明 |
|----|------|
| 生产 IdP、部门强制隔离 | 见 `api.md` 的鉴权边界 |
| 反馈队列运营 UI | API 已有 feedback 接口；本包**没有**反馈页 |
| 真 ES / 入库质量 | 依赖 worker 的 mock 栈；本包只负责展示字段 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 知识库手填 id | 演示门槛高 | 与 web 端同类债 |
| Soft Bento / product.pen 未做像素级对齐 | 观感不是最终定稿 | 色板与原子组件在 `packages/ui`；本包只做组合 |
| 无 E2E、多数运营页无 RTL 测试、无 http 全路径 refresh 测试 | 修改 members / chunks 等页面只能靠手测 | 已覆盖外壳 / Guard / 审批 + R5/R6；catalog 有单测；P0 清单见 `docs/testing/p0-redlines.md` |

---

## 证据

| 类型 | 指针 |
|------|------|
| 外壳 / 菜单裁剪 | `apps/admin/src/components/admin-shell.tsx` → `clipMenuForShell`；href SSOT：`packages/admin-catalog/src/menu-tree.ts` |
| 文档 / 审批 / 成员 / 分片 / 设置 / 模型 / 面板页 | `apps/admin/src/app/(ops)/documents|approvals|members|chunks|kb/settings|models|dashboard|departments|users|roles/` |
| API 封装 | `apps/admin/src/app/(ops)/{dashboard,documents,...}/api.ts` · `lib/http.ts` · `auth/api.ts` |
| 登录 / 守卫 | `apps/admin/src/app/login/page.tsx` · `components/auth-guard.tsx` |
| 前端测试 | `vitest.config.ts` · `src/test/` · `components/admin-shell.test.tsx` · `app/(ops)/dashboard/_components/dashboard-workspace.test.tsx` · `approvals-workspace.test.tsx` · R5/R6 等 |
| P0 清单 | `docs/testing/p0-redlines.md`（本包 R5–R6） |
| 命令 | `pnpm --filter @strict-rag/admin test`（`package.json` → `vitest run`） |
| 样式入口 | `apps/admin/src/app/globals.css` · `postcss.config.mjs` · `package.json`（tailwind devDeps · `build --webpack`） |
| 端口 | `apps/admin/package.json` → `next dev --port 3006` |
| Task | B6 归档 `archive/2026-08/08-09-b6-dashboard-shell`；B1–B5 · B7 同目录已归档 |
