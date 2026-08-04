# @strict-rag/ui · 共享 UI 库

> 路径：`packages/ui`  
> 现状：`cn()` + `theme.css` token 占位；无业务组件。

---

## Pre-Development Checklist

- [ ] 组件是否真正被 admin/web 复用（避免过早抽象）？  
- [ ] 是否用 **子路径 exports**（非全量 barrel 塞样式）？  
- [ ] React 是否保持 peerDependency？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/ui check-types` · `lint`  
- [ ] eslint 使用 `react-internal`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 导出与目录 |
| [component-guidelines](./component-guidelines.md) | 组件与 cn 约定 |

## PRD / 设计

- 色板与线稿：`product.pen` · 交付设计材料  
- CSS 变量已预留 `--sr-abstain` 等（拒答态）
