# admin · 目录结构

## 当前

```text
apps/admin/
  src/
    env.client.ts
    lib/
      http.ts                 # 传输层（Bearer / refresh / 重试）
      kb-context.ts           # 当前 KB 选择（localStorage）
      map-biz-error.ts        # services 共用错误映射（无 path）
    auth/
      client-session.ts       # token 本地存储
      api.ts                  # 登录 / me HTTP（仅 path；不写 session）
      services.ts             # 登录/登出：写清 session + 错误映射
    components/
      admin-shell.tsx
      auth-guard.tsx
    app/
      login/page.tsx          # 薄：表单 UI → auth/services
      (ops)/
        layout.tsx
        documents/
          page.tsx            # 薄：组合 DocumentsWorkspace
          api.ts
          list.services.ts
          _components/documents-workspace.tsx
        approvals/
          page.tsx
          api.ts              # 跨模块 re-export listDocuments
          services.ts
          _components/approvals-workspace.tsx
        members/
          page.tsx
          api.ts
          services.ts
          _components/members-workspace.tsx
        chunks/
          page.tsx            # B1 分片只读
          api.ts              # list/detail path；listDocuments re-export from documents
          services.ts
          _components/chunks-workspace.tsx
```

> **再扩展**（按需长出，禁止空建）：`hooks/` · 可选 `store.ts` · 按用例拆更多 `*.services.ts`。  
> **分层纪律全文** → [module-layering.md](./module-layering.md)

## 目标模块树（路由 colocation）

```text
app/(ops)/<module>/
  page.tsx                 # 薄：组合
  api.ts                   # 唯一写后端 path
  services.ts              # 业务编排；可拆 list.services.ts 等
  store.ts                 # 可选
  hooks/                   # 可选；禁止内含 page.tsx
  _components/             # 偏 UI（_ = 非路由）
```

## 职责分层（摘要）

| 层 | 路径 | 放什么 | 不放什么 |
|----|------|--------|----------|
| 传输 | `lib/http.ts` | get/post/patch/delete、鉴权头、refresh | 业务 path、DTO 拼装 |
| 身份 | `auth/api.ts` | dev-login、me、本地登出 | 业务域接口 |
| 模块 API | `app/(ops)/<module>/api.ts` | **仅该模块** HTTP 函数 + contracts | toast、store、业务编排 |
| 模块 services | 同目录 `*.services.ts` | 用例：调 api、toast、store、校验 | **后端 URL/path**、JSX |
| 模块 hooks | 同目录 `hooks/` | 必须绑 React 的逻辑 | 与 services 双份编排；path |
| 页面 | `page.tsx` | 组合入口组件 | 直接 `fetch`、手写 wire type、堆业务 |

## 规则

1. **类型**：请求/响应只用 `@strict-rag/contracts`；默认不建模块 `types.ts`。  
2. **模块私有 api.ts**：与页面同目录；**独占**该模块后端 path。  
3. **services 禁止写请求 URL**；只调用 `api` 导出函数。体量大时按 **业务用例** 拆多个 `*.services.ts`。  
3b. **services 不做权限引擎**：不重算 grants/denies、不用 `role ===` 放行；UI 裁剪码 + **API 硬验码**；services 只映射 403 文案（见 module-layering §6.5）。  
4. **hooks vs services**：无 React → services；须订阅/生命周期 → hooks（内部再调 services/api）。禁止双轨复制同一用例。  
5. **跨模块**：优先 import 对方 **`api`**；禁止复制 path；慎 import 对方 services。  
6. **禁止**再建全站大杂烩 `src/api/`。  
7. **store / hooks 目录 / types**：不需要不建。  
8. 新运营域：在 `app/(ops)/<module>/` 落树，不要塞进无关模块。  
9. 域被 ≥2 无关路由依赖时 → 上提 `src/features/<domain>/`（见 module-layering §11）。  
10. **抽公共时机**（欠抽 / 过抽）：见 [module-layering §12.1](./module-layering.md)；check 必查。

## 职责（产品）

| 职责 | 说明 |
|------|------|
| 运营壳 | `admin.shell`；菜单 catalog 按码裁剪 |
| 薄业务页 | 文档 / 审批 / 成员 |
| 非目标（本阶段） | KB 设置全量 · 供应商 · 部门 · 数据面板 · 全量角色（B2–B6） |

## 端口

**3006**。
