# admin · 目录结构

## 当前（S2c 薄页）

```text
apps/admin/
  package.json · tsconfig.json · eslint.config.js
  src/
    env.client.ts
    app/
      layout.tsx · globals.css · page.tsx
      login/page.tsx
      (ops)/
        layout.tsx              # AdminShell + 菜单
        documents/page.tsx      # 文档薄页
        approvals/page.tsx      # 审批薄页
        members/page.tsx        # 成员薄页
    components/
      admin-shell.tsx
      auth-guard.tsx            # 须 admin.shell
    lib/
      http.ts                   # Bearer + 单飞 refresh
      admin-api.ts
    auth/
      client-session.ts         # key: strict-rag:admin:client-session
      api.ts
```

## 职责

| 职责 | 说明 |
|------|------|
| 运营壳 | `admin.shell` 准入；菜单来自 catalog 按码裁剪 |
| 薄业务页 | 文档 / 审批 / 成员 — **不挡** ask 主路径 |
| 非目标（本阶段） | KB 设置全量 · 供应商绑定 UI · 部门壳 · 数据面板 · 全量角色（backlog B2–B6） |

## 端口

**3006**。
