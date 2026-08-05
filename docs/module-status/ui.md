# @strict-rag/ui · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/ui` |
| 成熟度 | **骨架**（`cn` + theme token；几乎无业务组件） |
| 默认依赖模式 | 纯库 |
| 关联模块 | web/admin 可按子路径引用；**未**强制组件化全站 |
| 最近更新 | 2026-08-05 |

## 一句话

共享 UI 工具包：当前实质导出仅为 **`cn`（clsx + tailwind-merge）** 与 **theme.css**；button/card 等组件按需再扩，**不是**完整设计系统实现。

---

## 已具备能力

- `cn`：`import { cn } from '@strict-rag/ui/lib/utils'`（及根导出）
- `theme.css`：CSS 变量级 token（`--sr-*` 等，供薄壳使用）

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| shadcn 组件全集 | 未铺 button/card/dialog 等 exports |
| 与 product.pen Soft Bento 像素对齐 | 观感未定稿 |
| 无障碍组件规范落地 | 未作为本包交付项 |

（债并入未做：设计系统欠账会拖住 admin/web 观感，但不阻塞 S2 功能演示。）

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 | `packages/ui/src/index.ts` |
| utils | `packages/ui/src/lib/utils.ts` |
| 主题 | `packages/ui/src/theme.css` |
