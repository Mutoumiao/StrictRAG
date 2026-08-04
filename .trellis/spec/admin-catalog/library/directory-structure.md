# admin-catalog · 目录结构

## 当前

```text
packages/admin-catalog/
  package.json     # exports "." → src/index.ts；无 runtime deps
  src/
    index.ts
```

```typescript
// packages/admin-catalog/src/index.ts
export const PERMISSIONS: readonly string[] = [];
export const MENU_TREE: readonly unknown[] = [];
```

## 目标（ADR-056 语义）

| 导出 | 用途 |
|------|------|
| 权限码注册表 | api 中间件验码 · 角色模板 |
| 菜单树 | admin 渲染 L1/L2；节点挂 permission code |
| 可选 catalog.json | 构建或启动同步产物（实现时定） |

目录可拆 `permissions.ts` · `menu-tree.ts` · `templates.ts`，由 `index.ts` 聚合。

## 消费者

| 包 | 用法 |
|----|------|
| `apps/api` | 启动加载 / 验码 |
| `apps/admin` | import 菜单与码 |
| `apps/web` | **不**依赖本包（当前 package.json 亦未声明） |
