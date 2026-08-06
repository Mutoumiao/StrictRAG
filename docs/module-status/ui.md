# @strict-rag/ui · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/ui` |
| 成熟度 | **S2 原子集**（cn + theme + 首批 shadcn 风格组件） |
| 默认依赖模式 | 纯库 |
| 关联模块 | web/admin 子路径引用；Tailwind 在 app 构建 |
| 最近更新 | 2026-08-06 |

## 一句话

共享 UI：`cn`、语义 token/`@theme`、首批 Button/Input/Label/Textarea/Select/Table/Card/Badge/Alert。

## 已具备能力

- `cn`：`@strict-rag/ui/lib/utils`
- `theme.css`：partner 式结构（包内 tailwind + `@theme` + Soft Bento 色板）；含 abstain/success/warning/info/sidebar
- 子路径组件：button · input · label · textarea · select · table · card · badge · alert
- `class-variance-authority`（Button/Badge/Alert variants）
- 交互组件 `forwardRef`

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| shadcn 全集 / Radix Dialog 等 | 未铺；Select 为 native 封装 |
| product.pen Soft Bento 像素对齐 | 观感未定稿 |
| ui 包内 Tailwind 构建 | class 由 admin/web PostCSS 扫描生成 |

## 证据

| 类型 | 指针 |
|------|------|
| 入口 | `packages/ui/src/index.ts` · `package.json#exports` |
| 组件 | `packages/ui/src/components/ui/*` |
| 主题 | `packages/ui/src/theme.css` |
| Task | `.trellis/tasks/08-06-frontend-tailwind-shadcn/` |
