# @strict-rag/ui · 共享 UI 库

> 路径：`packages/ui`  
> 现状：**Tailwind v4 主题入口** + Soft Bento 语义 token + 首批 shadcn 风格原子（Button/Input/Label/Textarea/Select/Table/Card/Badge/Alert）。admin/web 消费。

---

## Pre-Development Checklist

- [ ] 组件是否真正被 admin/web 复用（避免过早抽象）？  
- [ ] 是否用 **子路径 exports**（新组件须登记 `package.json#exports`）？  
- [ ] React 是否 peerDependency？  
- [ ] 样式是否走 theme token（禁止业务页大面积内联 style / 任意 hex）？  
- [ ] 色值是否对齐 Soft Bento / `product.pen`（改色只改 `theme.css`）？  
- [ ] app 是否只 `import './globals.css'`（theme 由 globals 引入）？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/ui check-types` · `lint`  
- [ ] eslint 使用 `react-internal`  
- [ ] admin/web：`check-types` · `lint` · `build`（`next build --webpack`）  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 导出、目录、与 app 接线 |
| [component-guidelines](./component-guidelines.md) | **cn · theme 管道 · 组件 · Next 构建 gotcha** |

## PRD / 设计

- 视觉：`product.pen` · `prds/12-delivery-guides/05-设计定稿.md`（Soft Bento · **非**接口 SSOT）  
- 拒答态色：`--abstain`（业务结果，≠ HTTP 5xx 红）  
- Task 参考：`.trellis/tasks/08-06-frontend-tailwind-shadcn/`
