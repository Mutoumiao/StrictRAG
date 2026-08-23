# admin · 目录结构

## 当前（对齐源码 · S2c + B1–B6 薄页 + B13）

```text
apps/admin/
  vitest.config.ts            # jsdom · tests/** + 遗留 src/**
  tests/
    index.md                  # 本包测例导航
  src/
    test/                     # setup · re-export（非业务）
    env.client.ts             # 仅 NEXT_PUBLIC_*
    lib/
      http.ts                 # 传输层（Bearer / refresh / 重试）
      kb-context.ts           # 当前 KB 选择（localStorage）
      kb-api.ts               # GET /knowledge-bases（壳下拉；失败仍可粘贴 uuid）
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
        documents/            # 文档列表 / 上传入口
        approvals/            # 审批
        members/              # KB 成员
        chunks/               # B1 分片只读
        kb/settings/          # B2 知识库设置（薄）
        models/               # B3 模型供应商 + 平台绑定（薄）
        users/                # B4 平台用户
        roles/                # B4 角色
        departments/          # B5 部门组织壳
        dashboard/            # B6 数据面板薄壳
        feedback/             # B13 反馈队列
```

每个 `(ops)/<module>/` 典型文件（colocation）：

```text
page.tsx · api.ts · services.ts（或 list.services.ts）· _components/*-workspace.tsx
```

> **再扩展**（按需长出，禁止空建）：`hooks/` · 可选 `store.ts` · 按用例拆更多 `*.services.ts`。  
> **分层纪律全文** → [module-layering.md](./module-layering.md)  
> **完成度 / 未做** → `docs/module-status/admin.md`（本树是路径导航，**非** IS SSOT）

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
4. **services 不做权限引擎**：不重算 grants/denies、不用 `role ===` 放行；UI 裁剪码 + **API 硬验码**；services 只映射 403 文案（见 module-layering §6.5）。  
5. **hooks vs services**：无 React → services；须订阅/生命周期 → hooks（内部再调 services/api）。禁止双轨复制同一用例。  
6. **跨模块**：优先 import 对方 **`api`**；禁止复制 path；慎 import 对方 services。  
7. **禁止**再建全站大杂烩 `src/api/`。  
8. **store / hooks 目录 / types**：不需要不建。  
9. **测试**：现行 `tests/<能力>/`；`src/test/` 仅基建；E2E 不进 `src/`。HOW：[testing](../../guides/testing.md) · 导航 `tests/index.md`。  
10. **新运营域**：在 `app/(ops)/<module>/` 落树，不要塞进无关模块；落地 href 须与 catalog / `ADMIN_IMPLEMENTED_HREFS` 同步。  
11. 域被 ≥2 无关路由依赖时 → 上提 `src/features/<domain>/`（见 module-layering §11）。  
12. **抽公共时机**（欠抽 / 过抽）：见 [module-layering §12.1](./module-layering.md)；check 必查。

## 职责（产品 · S2c 薄实现）

| 职责 | 说明 |
|------|------|
| 运营壳 | `admin.shell`；菜单 catalog 按码裁剪 |
| **已具备薄页** | 文档 · 审批 · 成员 · 分片 · KB 设置 · 模型 · 用户 · 角色 · 部门壳 · 数据面板壳 · 反馈队列（与 module-status 对齐） |
| **非目标（勿当已做）** | 完整运营 IA / APM · DEPT_ACL 强制 UI · KB 级模型绑定写 UI · 像素级 pen 还原 · 生产级监控大盘 |

> **禁止**再用「B2–B6 整包非目标」表述——会否定已落地的薄页。  
> 全量愿景在 `prds/00-product` IA；**实现分期**以 module-status + 总 backlog 为准。

## 端口

**3006**。
