# admin · 目录结构

## 当前

```text
apps/admin/
  src/
    env.client.ts
    lib/
      http.ts                 # 传输层（Bearer / refresh / 重试）
      kb-context.ts           # 当前 KB 选择（localStorage）
    auth/
      client-session.ts       # token 本地存储
      api.ts                  # 登录 / me / 本地登出
    components/
      admin-shell.tsx
      auth-guard.tsx
    app/
      login/page.tsx
      (ops)/
        layout.tsx
        documents/
          page.tsx
          api.ts              # 本模块私有 HTTP
        approvals/
          page.tsx
          api.ts
        members/
          page.tsx
          api.ts
```

## 职责分层

| 层 | 路径 | 放什么 | 不放什么 |
|----|------|--------|----------|
| 传输 | `lib/http.ts` | get/post/patch/delete、鉴权头、refresh | 具体业务路径与 DTO 拼装 |
| 身份 | `auth/api.ts` | dev-login、me、本地登出 | 业务域接口 |
| 模块 API | `app/(ops)/<module>/api.ts` | **仅该模块**需要的后端调用 | http 实现、测试、跨域大杂烩 |
| 页面 | `page.tsx` | UI 状态与交互 | 直接 `fetch`、手写 wire type |

## 规则

1. **类型**：请求/响应只用 `@strict-rag/contracts`；禁止模块内平行 wire DTO。  
2. **模块私有 api.ts**：与页面同目录；该模块独有接口写在这里。  
3. **跨模块调用**：优先 import 对方模块已导出的函数（如审批列表复用 `documents/api` 的 `listDocuments`），禁止复制路径字符串。  
4. **禁止**再建「大杂烩」`src/api/` 把 http + 全站接口 + 测试堆在一起。  
5. 新运营页有独立域时：在对应 `app/.../<module>/` 下加 `api.ts`，不要塞进无关模块。

## 职责（产品）

| 职责 | 说明 |
|------|------|
| 运营壳 | `admin.shell`；菜单 catalog 按码裁剪 |
| 薄业务页 | 文档 / 审批 / 成员 |
| 非目标（本阶段） | KB 设置全量 · 供应商 · 部门 · 数据面板 · 全量角色（B2–B6） |

## 端口

**3006**。
