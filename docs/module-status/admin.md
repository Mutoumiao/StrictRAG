# @strict-rag/admin · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/admin` |
| 端口 | 3006 |
| 成熟度 | **可演示**（S2c 运营薄壳：文档列表 / 审批 / 成员 / **分片只读**） |
| 默认依赖模式 | 鉴权=临时双 JWT + admin **dev-login**（经 api）· KB=手填 uuid · 菜单仅展示已实现路由 |
| 关联模块 | API：`api` 文档/审批/成员/分片；菜单+权限码：`admin-catalog`；契约：`contracts` |
| 最近更新 | 2026-08-06 |
| Spec | `.trellis/spec/admin/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · 审批/成员相关 API |

## 一句话

Next.js 管理端：**登录 + 文档只读列表 + 审批中心 + 成员 + 分片只读** 已接；KB 手填 id，catalog 全量菜单中**仅**落地四条路由，**不是**完整运营台。

---

## 已具备能力

### 鉴权壳
- 登录页 · 客户端 session · `AdminAuthGuard`（ops layout 拦未登录）
- 开发登录 `admin/dev-login`（角色模板可选）；登出仅本地清 session
- 顶栏展示当前用户权限裁剪后的菜单

### 运营壳（S2c）
- `AdminShell`：`MENU_TREE` + `filterMenuByCodes`；**白名单** `/documents` · `/approvals` · `/members` · `/chunks`
- KB 手填 + localStorage 记忆 `strict-rag:admin:last-kb-id`

### 文档
- `/documents`：按 KB 拉文档列表；表列 status / approval / lifecycle（**只读刷新**；审批在审批页）
- `DocRow` 类型含 embedReady/esReady，**UI 未渲染双就绪列**

### 分片只读（B1）
- `/chunks`：选文档 → preview 列表 → **点击后**拉 detail body；无 `chunk.view` 显示 403 态
- 文档列表 path 复用 `documents/api`（禁止复制 path）
- **禁止**挂载时批量预拉全文

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
- 模块私有 API：`app/(ops)/{documents,approvals,members,chunks}/api.ts`（**无** `lib/admin-api.ts` / **无** `src/api/` 集中仓）
- 类型来自 `@strict-rag/contracts`；菜单/码来自 `@strict-rag/admin-catalog`

---

## 明确未做 / 边界

### 本包 UI 未交付

| 项 | 说明 |
|----|------|
| 数据面板 · KB 设置 · 用户/角色 · 模型网关 | catalog 有菜单项；**无对应 page**（shell 已过滤） |
| 历史 indexVersion 分片 UI | ADR-052 不做 |
| 文档上传 UI | 列表只读；上传走 API/其它入口 |
| 完整运营 IA / 多 KB 选择器 | 手填 uuid；非产品级库管体验 |
| 生产视觉定稿 | 功能薄壳；线稿在 pen |

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
| 菜单 SSOT 与已实现路由双轨 | catalog 超前；shell 硬编码白名单 | 新页落地须同步 `implemented` |
| Soft Bento / pen 未像素对齐 | 观感非定稿 | Tailwind v4 + Button/Input 已接（task `08-06-frontend-tailwind-shadcn`） |
| 无 E2E | 手测 + api 单测 | task `08-05-p2c-approval-members-ui` |

---

## 证据

| 类型 | 指针 |
|------|------|
| 壳 / 菜单白名单 | `apps/admin/src/components/admin-shell.tsx` |
| 文档 / 审批 / 成员 / 分片页 | `apps/admin/src/app/(ops)/documents|approvals|members|chunks/` |
| API 封装 | `apps/admin/src/app/(ops)/{documents,approvals,members,chunks}/api.ts` · `lib/http.ts` · `auth/api.ts` |
| 登录 / 守卫 | `apps/admin/src/app/login/page.tsx` · `components/auth-guard.tsx` |
| 端口 | `apps/admin/package.json` → `next dev --port 3006` |
| Task（B1） | `.trellis/tasks/08-06-b1-chunk-readonly/` |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-p2c-approval-members-ui/` · epic `08-05-phase-2-ask/` |
