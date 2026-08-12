# admin-catalog · 目录结构

## 当前（已落地 · 对齐源码）

```text
packages/admin-catalog/
  package.json     # exports "." → src/index.ts；无 Next/Hono runtime deps
  src/
    index.ts                 # 聚合导出
    permissions.ts           # PERMISSION_DEFINITIONS · PermissionCode · isPermissionCode
    role-templates.ts        # ROLE_TEMPLATES（默认角色绑码）
    menu-tree.ts             # MENU_TREE（admin L1/L2 · 节点挂码）
    catalog.test.ts
```

```typescript
// 形状示意（以源码为准，非空桩）
export { PERMISSION_DEFINITIONS, type PermissionCode, isPermissionCode } from './permissions.js';
export { ROLE_TEMPLATES } from './role-templates.js';
export { MENU_TREE } from './menu-tree.js';
```

## 导出用途

| 导出 | 用途 |
|------|------|
| `PERMISSION_DEFINITIONS` / `PermissionCode` | api 验码 · 角色绑码合法性 |
| `ROLE_TEMPLATES` | 默认角色种子 / 模板（运行时绑码以 DB hydrate 为准，见 auth HOW） |
| `MENU_TREE` | admin 渲染 L1/L2；节点挂 permission code |
| 可选 `catalog.json` | ADR-056 双读产物；**未做则不算债清零**（纯 TS import 已同源） |

SSOT 纪律全文 → [catalog-ssot](./catalog-ssot.md)。

## 消费者

| 包 | 用法 |
|----|------|
| `apps/api` | `requirePermission` / hydrate 校验码 ∈ catalog |
| `apps/admin` | import 菜单与码；壳裁剪 |
| `apps/web` | **不**依赖本包（package.json 亦未声明） |

> **禁止**在 apps 内维护第二份权限码白名单或平行菜单树。
