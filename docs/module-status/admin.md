# @strict-rag/admin · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/admin` |
| 端口 | 3006 |
| 成熟度 | **可演示**（S2c 运营薄壳：文档 / 审批 / 成员 / 分片 / 设置 / 模型 + 用户 / 角色 / 部门 + **数据面板** + **反馈队列**） |
| 默认依赖模式 | 鉴权 = 临时双 JWT + admin **dev-login**（经 api）· 知识库 = 手工填写 uuid · 菜单 = `clipMenuForShell` 裁剪（catalog 为 SSOT）· API 默认 `http://127.0.0.1:4000` |
| 关联模块 | API 依赖：`api` 的文档 / 审批 / 成员 / 分片 / 设置 / 模型 / 用户角色 / 部门 / dashboard / **feedback-queue**；菜单与权限码：`admin-catalog`；类型：`contracts`；样式：`ui` |
| 最近更新 | 2026-08-13（反向审计补漏：models 删除 / 部门标记 / 分片分页 / admin.shell / 工程分层 / 模型编辑） |
| Spec | `.trellis/spec/admin/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · 审批 / 成员相关 API |

## 一句话状态

Next.js 管理端：**登录 + 文档只读列表 + 审批中心 + 成员管理 + 分片只读 + 知识库设置 + 模型网关最小集 + 用户 / 角色 / 部门最小集 + 数据面板薄壳 + 反馈队列薄壳** 均已接通；知识库靠手填 id，外壳 **`clipMenuForShell`** 只显示已落地路由（**11** 条 ops href），**不是**完整运营台（无 APM 时序 / 部门强制隔离 UI）。Vitest / RTL 覆盖外壳 / Guard / 审批 / dashboard 403 + **P0 R5/R6**；**无** feedback 工作区测、**无** E2E。

---

## 已具备能力

### 鉴权外壳
- 登录页、客户端 session、`AdminAuthGuard`（在 ops layout 层拦截未登录访问 + 校验 `admin.shell` 权限码，无码清会话并回登录页）
- 开发登录 `admin/dev-login`（可选角色模板）；登出仅清除本地 session
- 顶栏按当前用户权限裁剪后展示菜单

### 运营外壳（S2c · B7 菜单裁剪）
- `AdminShell`：消费 `clipMenuForShell`（**没有**本地 href 白名单）；已落地 href SSOT = `admin-catalog` 的 `ADMIN_IMPLEMENTED_HREFS`
- 当前落地 **十一条** ops 路由：`/dashboard` · `/documents` · `/approvals` · `/members` · `/chunks` · `/kb/settings` · `/models` · `/users` · `/roles` · `/departments` · **`/feedback`**
- 知识库手填 id，localStorage `strict-rag:admin:last-kb-id`

### 数据面板（B6 薄壳）
- `/dashboard`：只读 3–5 指标（kb / 文档 / 待审 / processReady / 近 24h 问答）；`page → services → api` 分层
- 需要 `dashboard.view`；无码菜单隐藏、直链 **403 态**；**不是** APM / Grafana

### 文档
- `/documents`：按知识库拉取文档列表；表格展示 status / approval / lifecycle 列（**只读刷新**；审批操作在审批页进行）
- `DocumentListItem` 类型包含 embedReady / esReady 字段，但 **UI 尚未渲染"双就绪"列**

### 分片只读（B1）
- `/chunks`：选择文档 → 查看 preview 列表（**limit=50 游标分页 + 底部「加载更多」**）→ **点击后**才拉取该分片的完整正文；无 `chunk.view` 权限时显示 403 状态
- 文档列表的数据路径复用 `documents/api`（禁止复制路径另起一套）
- **禁止**在页面挂载时批量预拉所有分片全文

### 知识库设置（B2）
- `/kb/settings`：基本信息、问答档位、**质量只读展示**、**rewrite 锁定开关**（无开启控件）
- 需要 `kb.config.write` 权限；无权限时显示 403 状态；数据路径仅 `kb/settings/api.ts` 一处
- **没有** τ 滑块、**没有**供应商 Key 配置、**没有** docTypes / 分片策略弹窗 / 知识库模型绑定分区

### 模型网关（B3 最小集）
- `/models`：供应商列表 / 新建 / 编辑 / 删除（预设、baseUrl、Key 密码框、模型表可逐行编辑**类型 / 启用 / dims**）+ **平台级 purpose 绑定**（catalog 下拉选择）
- 需要 `model.gateway.manage` 权限（默认仅 super_admin 持有）；无权限时显示 403 状态；数据路径仅 `models/api.ts` 一处
- Key **只写不回显**；**没有**真实的 fetch-models 代理 UI；**没有**知识库级绑定

### 平台用户 / 角色（B4 最小集）
- `/users`：用户列表、新建（email / displayName / 角色）、启用禁用、修改角色；需要 `user.manage` 权限；数据路径仅 `users/api.ts` 一处
- `/roles`：角色列表、新建自定义角色、勾选权限码并保存；需要 `role.perm.manage` 权限；数据路径仅 `roles/api.ts` 一处
- **没有**密码相关 UI；登录仍走 dev-login；**B4-W** 运行时角色以 api DB hydrate 为准（本包只 CRUD）
- 用户部门归属的编辑入口在 **`/departments`** 页（通过粘贴 userId 操作）

### 部门（B5 最小集）
- `/departments`：组织树列表、新建根 / 子部门、启用停用、删除（要求无子部门且无成员）、用户归属管理（查询归属 + **主部门 / 负责人**标记，需要 `user.manage` 权限）
- 需要 `dept.manage` 权限；无权限时显示 403 状态；数据路径仅 `departments/api.ts` 一处
- **没有**跨部门授权 UI、**没有**文档密级字段、**没有** DEPT_ACL 开关的运营页

### 审批中心
- `/approvals`：待审批 / 已通过 两个分栏
- 持有 `approval.decide` 权限时显示通过 / 驳回按钮；持有 `doc.upload` 权限时，已通过的文档可以触发 `scan` 入队
- 按钮可见 ≠ 已授权；无权限调用 API 仍会返回 403

### 成员管理
- `/members`：成员列表、邀请（email + 角色）、移除
- 需要 `member.manage` 权限；无权限时显示错误状态

### 反馈队列（B13）
- `/feedback`：运营队列列表；可 **dismiss / linked_doc** 改状态（**非只读**）
- 始终需要 `feedback.queue`；无码菜单隐藏、直链依赖 API 403
- 分层：`page → services → api.ts` → `GET …/feedback-queue` · `PATCH /api/v1/feedback/:id`
- **无** 专用 RTL 工作区测试

### 工程
- 传输层：`lib/http.ts`（Bearer + 单飞 refresh）；错误映射：`lib/map-biz-error.ts`；知识库偏好：`lib/kb-context.ts`
- 身份：`auth/api.ts` · `auth/client-session.ts`（会话存取 + 变更事件）· `auth/services.ts`（loginWithDev / logoutLocal）
- 模块私有 API：`app/(ops)/{dashboard,documents,approvals,members,chunks,kb/settings,models,users,roles,departments,feedback}/api.ts`（**没有** 集中 `lib/admin-api.ts`）
- 类型 `@strict-rag/contracts`；菜单 / 权限码 `@strict-rag/admin-catalog`
- 样式：Tailwind v4 + ui 主题；构建 `next build --webpack`
- **单元 / 组件测试**：外壳 / Guard / 审批 / dashboard + **P0 R5/R6** + `lib/kb-context.test.ts`（admin KB key 不与 web 混写）+ `auth/client-session.test.ts`（admin session 与 web 隔离）
  - **没有** documents / members / chunks / settings / models / users / roles / departments / **feedback** 工作区测；**没有** E2E；**没有** http 全路径 refresh 集成测

---

## 明确未做 / 边界

### 本包 UI 未交付

| 项 | 说明 |
|----|------|
| 知识库设置全量项（docTypes / 分片策略 / KB 级模型绑定） | B2 最小已落地；全量项仍挂账 |
| APM / 时序大盘 / 告警 | B6 仅为只读计数摘要，**不是**观测生产向 |
| 按历史 indexVersion 浏览分片的 UI | ADR-052 明确不做 |
| 文档上传 UI | 列表只读；上传走 API 或其他入口 |
| 部分 API 封装符号未接线 | `patchPlatformRole` / `getDocument` / `listFeedbackQueue(status)` 等封装已写但当前 UI 未调用 |
| 完整运营 IA / 多知识库选择器 | 目前手填 uuid；不是产品级的库管体验 |
| 生产视觉 / product.pen **像素级**定稿 | 已使用 Soft Bento token + ui 组件；**并非**对 product.pen 的全屏像素还原 |

### 其他包 / 后端挂账

| 项 | 说明 |
|----|------|
| 生产 IdP、部门强制隔离 | 见 `api.md` 的鉴权边界 |
| 真 ES / 入库质量 | 依赖 worker mock 栈；本包只负责展示字段 |

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
| 运营页 | `apps/admin/src/app/(ops)/documents|approvals|members|chunks|kb/settings|models|dashboard|departments|users|roles|feedback/` |
| 反馈 | `app/(ops)/feedback/page.tsx` · `_components/feedback-workspace.tsx` · `api.ts` · `services.ts` |
| API 封装 | 各 ops 目录 `api.ts` · `lib/http.ts` · `auth/api.ts` |
| 登录 / 守卫 | `apps/admin/src/app/login/page.tsx` · `components/auth-guard.tsx` |
| 前端测试 | `vitest.config.ts` · `src/test/` · `components/admin-shell.test.tsx` · `app/(ops)/dashboard/_components/dashboard-workspace.test.tsx` · `approvals-workspace.test.tsx` · R5/R6 等 |
| P0 清单 | `docs/testing/p0-redlines.md`（本包 R5–R6） |
| 命令 | `pnpm --filter @strict-rag/admin test`（`package.json` → `vitest run`） |
| 样式入口 | `apps/admin/src/app/globals.css` · `postcss.config.mjs` · `package.json`（tailwind devDeps · `build --webpack`） |
| 端口 | `apps/admin/package.json` → `next dev --port 3006` |
| Task（辅证 · 归档） | `08-09-b6-dashboard-shell` · `08-11-b13-feedback-ui` · B1–B5 · B7 等 |
