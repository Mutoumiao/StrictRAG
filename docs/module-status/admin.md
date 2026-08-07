# @strict-rag/admin · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/admin` |
| 端口 | 3006 |
| 成熟度 | **可演示**（S2c 运营薄壳：文档/审批/成员/分片/设置/模型 + **用户/角色最小**） |
| 默认依赖模式 | 鉴权=临时双 JWT + admin **dev-login**（经 api）· KB=手填 uuid · 菜单=`clipMenuForShell`（catalog SSOT） |
| 关联模块 | API：`api` 文档/审批/成员/分片/设置/模型/用户角色；菜单+权限码：`admin-catalog`；契约：`contracts`；样式：`ui` |
| 最近更新 | 2026-08-07 |
| Spec | `.trellis/spec/admin/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · 审批/成员相关 API |

## 一句话

Next.js 管理端：**登录 + 文档只读列表 + 审批中心 + 成员 + 分片只读 + 知识库设置 + 模型网关最小 + 用户/角色最小** 已接；KB 手填 id，壳经 catalog **`clipMenuForShell`** 链已实现路由，**不是**完整运营台。

---

## 已具备能力

### 鉴权壳
- 登录页 · 客户端 session · `AdminAuthGuard`（ops layout 拦未登录）
- 开发登录 `admin/dev-login`（角色模板可选）；登出仅本地清 session
- 顶栏展示当前用户权限裁剪后的菜单

### 运营壳（S2c · B7 菜单裁剪）
- `AdminShell`：消费 `clipMenuForShell`（**无**本地 href 白名单）；落地 href SSOT 在 `admin-catalog`：`ADMIN_IMPLEMENTED_HREFS`
- 当前八条：`/documents` · `/approvals` · `/members` · `/chunks` · `/kb/settings` · `/models` · **`/users`** · **`/roles`**
- KB 手填 + localStorage 记忆 `strict-rag:admin:last-kb-id`

### 文档
- `/documents`：按 KB 拉文档列表；表列 status / approval / lifecycle（**只读刷新**；审批在审批页）
- `DocRow` 类型含 embedReady/esReady，**UI 未渲染双就绪列**

### 分片只读（B1）
- `/chunks`：选文档 → preview 列表 → **点击后**拉 detail body；无 `chunk.view` 显示 403 态
- 文档列表 path 复用 `documents/api`（禁止复制 path）
- **禁止**挂载时批量预拉全文

### 知识库设置（B2）
- `/kb/settings`：基本信息 · 问答档位 · **质量只读** · **rewrite 锁**（无开控件）
- 需 `kb.config.write`；无码 403 态；path 仅 `kb/settings/api.ts`
- **无** τ 滑块 · **无** 供应商 Key · **无** docTypes/分片弹窗/KB 模型绑定分区

### 模型网关（B3 最小）
- `/models`：供应商列表/新建编辑（预设 · baseUrl · Key 密码框 · 模型表）+ **平台 purpose 绑定**（catalog 下拉）
- 需 `model.gateway.manage`（默认仅 super_admin）；无码 403 态；path 仅 `models/api.ts`
- Key **只写不回显**；**无**真 fetch-models 代理 UI · **无** KB 级绑定

### 平台用户 / 角色（B4 最小）
- `/users`：列表 · 新建（email/displayName/角色）· 启用禁用 · 改角色；需 `user.manage`；path 仅 `users/api.ts`
- `/roles`：列表 · 新建自定义角色 · 权限码勾选保存；需 `role.perm.manage`；path 仅 `roles/api.ts`
- **无**密码 UI · **无**部门归属 · 登录仍 dev-login 模板（DB 角色未接 JWT）

### 审批中心
- `/approvals`：待审 / 已通过分栏
- 有 `approval.decide` 时显示通过/驳回；有 `doc.upload` 时已通过可 `scan` 入队
- 按钮可见 ≠ 授权；API 仍 403

### 成员管理
- `/members`：列表 · 邀请（email + role）· 移除
- 需 `member.manage`；无权限则报错态

### 工程
- 传输：`lib/http.ts`（Bearer + 单飞 refresh）；KB 偏好：`lib/kb-context.ts`（**非** HTTP 业务大杂烩）
- 身份：`auth/api.ts`
- 模块私有 API：`app/(ops)/{documents,approvals,members,chunks,kb/settings,models,users,roles}/api.ts`（**无** `lib/admin-api.ts` / **无** `src/api/` 集中仓）
- `lib/http` 含 `put`（平台绑定 PUT）
- 类型来自 `@strict-rag/contracts`；菜单/码来自 `@strict-rag/admin-catalog`
- 样式：Tailwind v4（`postcss.config.mjs` · `src/app/globals.css` 引 `@strict-rag/ui/theme.css` + `@source`）；页面以 `className` + ui 原子为主，**无**大面积布局/色板 `style={{}}`
- 构建：`next build --webpack`；`next.config` 含 `transpilePackages` + webpack `extensionAlias`（解析 ui 包内 `.js`→`.ts`）

---

## 明确未做 / 边界

### 本包 UI 未交付

| 项 | 说明 |
|----|------|
| 数据面板 · 部门 · KB 设置全文（docTypes/分片/KB 模型绑定） | catalog 有菜单；用户/角色已 B4 最小；其余 **无 page**（clip 过滤；归 B5–B6 / 后续） |
| 历史 indexVersion 分片 UI | ADR-052 不做 |
| 文档上传 UI | 列表只读；上传走 API/其它入口 |
| 完整运营 IA / 多 KB 选择器 | 手填 uuid；非产品级库管体验 |
| 生产视觉 / pen **像素**定稿 | 已用 Soft Bento token + ui 组件；**非** product.pen 全屏像素还原 |

### 他包 / 后端挂账

| 项 | 说明 |
|----|------|
| 生产 IdP · 部门隔离 | 见 `api.md` 鉴权边界 |
| 反馈队列运营 UI | API 有 feedback；本包**无**反馈页 |
| 真 ES / 入库质量 | 依赖 worker mock 栈；本包只展示字段 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| KB 手填 id | 演示门槛高 | 与 web 同类债 |
| Soft Bento / pen 未像素对齐 | 观感非定稿 | 色板与原子在 `packages/ui`；本包只组合 |
| 无 E2E | 手测 + api/catalog 单测 | 归档 task `08-05-p2c-approval-members-ui` · `08-07-b7-menu-clip-complete` |

---

## 证据

| 类型 | 指针 |
|------|------|
| 壳 / 菜单 clip | `apps/admin/src/components/admin-shell.tsx` → `clipMenuForShell`；href SSOT：`packages/admin-catalog/src/menu-tree.ts` |
| 文档 / 审批 / 成员 / 分片 / 设置 / 模型页 | `apps/admin/src/app/(ops)/documents|approvals|members|chunks|kb/settings|models/` |
| API 封装 | `apps/admin/src/app/(ops)/{documents,approvals,members,chunks,kb/settings,models}/api.ts` · `lib/http.ts` · `auth/api.ts` |
| 登录 / 守卫 | `apps/admin/src/app/login/page.tsx` · `components/auth-guard.tsx` |
| 样式入口 | `apps/admin/src/app/globals.css` · `postcss.config.mjs` · `package.json`（tailwind devDeps · `build --webpack`） |
| 端口 | `apps/admin/package.json` → `next dev --port 3006` |
| Task | `08-07-b3-model-providers`（完成后 archive）· 归档 `08-07-b7-menu-clip-complete` · `08-07-b2-kb-settings` · `08-06-b1-chunk-readonly` |
