# @strict-rag/ui · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/ui` |
| 成熟度 | **可联调**（S2 首批 shadcn 风格原子组件 + Soft Bento 设计 token；不是完整设计系统） |
| 默认依赖模式 | 纯库；**不**在本包内跑 PostCSS 生产构建（CSS 类由 admin / web 应用侧扫描生成） |
| 关联模块 | 被 `admin` · `web` 以子路径方式引用；`theme.css` 由各应用的 `globals.css` 引入 |
| 最近更新 | 2026-08-13（cva 变体表述澄清：Button 仅 destructive；反向审计补根 re-export 与复合子部件） |

## 一句话状态

共享 UI 库：提供 `cn` 工具、Tailwind v4 主题入口（Soft Bento 语义 token）、首批原子组件（Button / Input / Label / Textarea / Select / Table / Card / Badge / Alert）；**不含**业务请求逻辑，**不含**任何密钥。

## 已具备能力

- `cn` 类名合并工具：`packages/ui/src/lib/utils.ts`，导出路径 `@strict-rag/ui/lib/utils`（根部也有 re-export）
- `theme.css`：包内 `@import 'tailwindcss'` · `@source` 扫描组件 · `@theme inline` · `:root` / `.dark` 的 Soft Bento 色值；包含 `primary` / `primary-hover`、`abstain`、`success`、`sidebar` / `rail` 等语义 token；旧名 `--sr-*` 保留为别名
- 子路径组件（`package.json#exports`）：`button` · `input` · `label` · `textarea` · `select` · `table` · `card` · `badge` · `alert`
- 根 `index.ts` 除 `cn` 外也 re-export 全部组件 + variants（`buttonVariants` / `badgeVariants` / `alertVariants`）与 Props 类型；复合组件拆子部件：Table（Header / Body / Row / Head / Cell）· Card（Header / Title / Content）· Alert（Title / Description）
- `class-variance-authority` 变体：Button 含 `destructive`；Badge / Alert 含 `abstain` 与 `destructive` 分离变体
- 可聚焦控件使用 `forwardRef`：Button · Input · Label · Textarea · Select · Table 系列 · Card 系列（Badge / Alert 是无 ref 的纯展示块）
- Select：基于**原生** `<select>` 封装，不依赖 Radix

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| shadcn 全集 / Radix Dialog · Dropdown 等 | 尚未铺设；按需再添加 |
| product.pen **像素级**对齐 | 色值采用 Soft Bento 方向；不是全屏像素还原 |
| ui 包内独立的 Tailwind 构建产物 | 没有；依赖应用侧的 PostCSS 构建 |
| 暗色主题的产品级切换 UI | 目前只有 `.dark` token 基线 |
| 组件单测 / Storybook | 没有 |

## 证据

| 类型 | 指针 |
|------|------|
| 入口 / exports | `packages/ui/src/index.ts` · `packages/ui/package.json#exports` |
| 组件 | `packages/ui/src/components/ui/*` |
| 主题 | `packages/ui/src/theme.css` |
| 工具 | `packages/ui/src/lib/utils.ts` |
| 消费方 | `apps/admin` · `apps/web`（`@strict-rag/ui/components/ui/*`） |
| Task（已归档） | `.trellis/tasks/archive/2026-08/08-06-frontend-tailwind-shadcn/` |
