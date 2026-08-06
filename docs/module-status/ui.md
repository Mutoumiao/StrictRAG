# @strict-rag/ui · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/ui` |
| 成熟度 | **可联调**（S2 首批 shadcn 风格原子 + Soft Bento token；非完整设计系统） |
| 默认依赖模式 | 纯库；**不**在本包跑 PostCSS 生产构建（class 由 admin/web 扫描生成） |
| 关联模块 | `admin` · `web`（子路径 import）；`theme.css` 由 app `globals.css` 引入 |
| 最近更新 | 2026-08-07 |

## 一句话

共享 UI 库：`cn`、Tailwind v4 主题入口（Soft Bento 语义 token）、首批原子组件（Button/Input/Label/Textarea/Select/Table/Card/Badge/Alert）；**无**业务 fetch / 无密钥。

## 已具备能力

- `cn`：`packages/ui/src/lib/utils.ts` · 导出 `@strict-rag/ui/lib/utils`（及根 re-export）
- `theme.css`：包内 `@import 'tailwindcss'` · `@source` 扫组件 · `@theme inline` · `:root`/`.dark` Soft Bento 色值；含 `primary`/`primary-hover`、`abstain`、`success`、`sidebar`/`rail` 等；旧名 `--sr-*` 作 alias
- 子路径组件（`package.json#exports`）：`button` · `input` · `label` · `textarea` · `select` · `table` · `card` · `badge` · `alert`
- `class-variance-authority`：Button / Badge / Alert variants（含 `abstain` / `destructive` 分离）
- 可聚焦控件 `forwardRef`：Button · Input · Label · Textarea · Select · Table 系列 · Card 系列（Badge/Alert 为无 ref 展示块）
- Select：**native** `<select>` 封装，非 Radix

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| shadcn 全集 / Radix Dialog·Dropdown 等 | 未铺；按需再加 |
| product.pen **像素**对齐 | 色值取 Soft Bento 方向；非全屏像素还原 |
| ui 包内 Tailwind 独立构建产物 | 无；依赖 app PostCSS |
| 暗色主题产品切换 UI | 仅有 `.dark` token 基线 |
| 组件单测 / Storybook | 无 |

## 证据

| 类型 | 指针 |
|------|------|
| 入口 / exports | `packages/ui/src/index.ts` · `packages/ui/package.json#exports` |
| 组件 | `packages/ui/src/components/ui/*` |
| 主题 | `packages/ui/src/theme.css` |
| 工具 | `packages/ui/src/lib/utils.ts` |
| 消费方 | `apps/admin` · `apps/web`（`@strict-rag/ui/components/ui/*`） |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-06-frontend-tailwind-shadcn/` |
