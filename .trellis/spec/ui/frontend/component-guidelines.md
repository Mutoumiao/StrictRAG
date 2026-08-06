# ui · 组件与样式约定

## cn()

**文件**：`packages/ui/src/lib/utils.ts`

```typescript
import { cn } from '@strict-rag/ui/lib/utils';
// 或：import { cn } from '@strict-rag/ui'
```

`cn` = `twMerge(clsx(...))`。**禁止**在 admin/web 再复制一份。

---

## Design Decision: 主题与 Tailwind 落点

**Context**：两 app 曾大面积内联 style；catalog 已预留 Tailwind v4，但未接通。

**Options**：
1. 各 app 各自 `tailwind.config` + 各写 globals  
2. **主题与 `@import tailwindcss` 放 `packages/ui/theme.css`**（对齐 partner-agent）

**Decision**：选 2。色板 SSOT 暂用 Soft Bento（`product.pen` 屏幕 + `prds/12-delivery-guides/05-设计定稿`）；shadcn 语义变量名，业务扩展 `abstain` / `success` / `rail` / `sidebar`。

---

## 主题与 CSS 管道（可执行契约）

### 职责边界

| 路径 | 负责 | 不负责 |
|------|------|--------|
| `packages/ui/src/theme.css` | `@import 'tailwindcss'` · `@source` 扫 ui 组件 · `@theme inline` · `:root` / `.dark` · `@layer base` | 业务布局 |
| `apps/{admin,web}/src/app/globals.css` | `@import '@strict-rag/ui/theme.css'` · `@source` 扫**本 app** `src` | 再 `@import 'tailwindcss'`（会双份） |
| `apps/*/postcss.config.mjs` | 仅 `@tailwindcss/postcss` | 手写 tailwind v3 config |
| `apps/*/package.json` | `tailwindcss` · `@tailwindcss/postcss` 为 **devDependencies** `catalog:` | 版本写死 |
| `packages/ui` | 组件 class 字符串；**不**在 ui 包跑 PostCSS 生产构建 | 业务 fetch |

### app globals 模板

```css
/* apps/admin|web/src/app/globals.css */
@import '@strict-rag/ui/theme.css';
@source '../../../src/**/*.{ts,tsx}';
```

`layout.tsx` **只** `import './globals.css'`，不要再单独 `import '@strict-rag/ui/theme.css'`。

### Soft Bento 语义 token（Light 摘要）

| CSS 变量 | 典型值 | Tailwind |
|----------|--------|----------|
| `--background` | `#F3F5F8` | `bg-background` |
| `--foreground` | `#0F172A` | `text-foreground` |
| `--primary` / `--primary-hover` | `#2563EB` / `#1D4ED8` | `bg-primary` · `hover:bg-primary-hover` |
| `--muted-foreground` | `#64748B` | `text-muted-foreground` |
| `--card` | `#FFFFFF` | `bg-card` |
| `--border` / `--ring` | `#E2E8F0` / `#2563EB` | `border-border` · `ring-ring` |
| `--rail` | `#FAFBFC` | Web 会话侧栏 `bg-rail` |
| `--sidebar` | `#0F172A` | Admin 深色侧栏 |
| `--abstain` / `--abstain-muted` | `#7C3AED` / `#EDE9FE` | **拒答业务态**（≠ destructive） |
| `--success` / `--destructive` 及 `*-muted` | 定稿表 | 通过 / 错误 |

旧名 `--sr-*` 在 theme 中 **alias** 到新变量；新代码优先语义名。

### 样式规则

| 规则 | 说明 |
|------|------|
| 布局/色板 | `className` + token utility；**禁止**大面积 `style={{}}` |
| 动态值 | 仅计算属性可内联，并注释理由 |
| 任意 hex | 禁止 `bg-[#…]` 做主题色；先加 token 再映射 `@theme` |
| 拒答 | `Alert variant="abstain"` / `text-abstain`；禁止当系统错误红处理 |

---

## 组件导出与导入

### package.json exports（须同步登记）

| 子路径 | 导出 |
|--------|------|
| `./theme.css` | 主题入口 |
| `./lib/utils` | `cn` |
| `./components/ui/button` | Button · buttonVariants |
| `./components/ui/input` · `label` · `textarea` · `select` | 表单 |
| `./components/ui/table` | Table 系列 |
| `./components/ui/card` | Card 系列 |
| `./components/ui/badge` · `alert` | 状态展示 |
| `.` | 根 re-export（可选） |

```typescript
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@strict-rag/ui/components/ui/alert';
```

### 组件规则

| 规则 | 说明 |
|------|------|
| 无业务 fetch / 无密钥 / 无 env | 库只做展示原子 |
| variant | 优先 `cva`；依赖 `catalog:` |
| ref | 可聚焦控件 **forwardRef** |
| Select | 首版 **native** + 统一 class（非必须 Radix） |
| Button default | **primary**（品牌蓝），非 zinc 前景色块 |
| 增组件 | 改 `package.json#exports` + 本表；按需，勿一次铺全集 |

---

## Next app 构建契约（admin / web 共用）

| 项 | 约定 |
|----|------|
| 脚本 | `"build": "next build --webpack"`（默认 turbopack 对 NodeNext `.js` 子路径解析易挂） |
| `next.config` | `transpilePackages` 含 `@strict-rag/ui`（及 contracts / admin-catalog） |
| `webpack.resolve.extensionAlias` | `'.js' → ['.ts','.tsx','.js']`（包内 `from './x.js'` 实为 `.ts`） |

---

## Good / Base / Bad

| | 例子 |
|--|------|
| **Good** | `className="bg-background text-muted-foreground"`；`<Button>` 默认主 CTA |
| **Base** | 拒答：`Alert variant="abstain"` + `Badge variant="abstain"` |
| **Bad** | 页面内联 `style={{ color: '#64748b' }}`；`bg-[#f5f3ff]`；admin 自写 `function cn` |

## Wrong vs Correct

#### Wrong

```tsx
// 双引 theme + 无 PostCSS；或 app 再 @import tailwindcss
import '@strict-rag/ui/theme.css';
import './globals.css';
<div style={{ background: 'var(--sr-background)' }} />
```

#### Correct

```tsx
// layout.tsx
import './globals.css';
// globals.css → 只 import theme + @source app
<main className="min-h-screen bg-background text-foreground">
  <Button type="submit">提问</Button>
</main>
```

---

## Common Mistakes / Gotchas

### CSS 注释里的 `*/`

**Symptom**：PostCSS `Unknown word`，定位在注释行。

**Cause**：注释写 `apps/*/globals` 时 `*/` 提前结束块注释。

**Fix**：注释避免 `*/` 序列（写 `apps admin|web globals`）。

### ui 组件 class 未生成

**Symptom**：Button 有 DOM 无样式。

**Cause**：theme 未 `@source` ui，或 app 未 `@source` 自身 src。

**Fix**：theme 内 `@source './**/*.{ts,tsx}'`；app globals `@source '../../../src/**/*.{ts,tsx}'`。

### turbopack / NodeNext `.js`

**Symptom**：`Can't resolve './menu-tree.js'` 或 `./lib/utils.js`。

**Cause**：包用 NodeNext 的 `.js` 扩展指源 `.ts`。

**Fix**：`extensionAlias` + `next build --webpack`（见上表）。

---

## 反模式

- **Bad**：在 ui 包写 `fetch('/api/...')`  
- **Bad**：npm 安装 `shadcn-ui` 包（本项目是 copy 风格 + catalog Radix/cva，按需手写）  
- **Bad**：把拒答当 `destructive` 系统错误红  
- **Good**：视觉原子在 ui；容器与数据在 app；token 随 pen/定稿更新 theme 一处
