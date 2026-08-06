# ui · 目录结构

## 当前

```text
packages/ui/
  package.json
    exports:
      "."                        → src/index.ts
      "./lib/utils"              → src/lib/utils.ts
      "./theme.css"              → src/theme.css
      "./components/ui/button"   → button.tsx
      "./components/ui/input"    → input.tsx
      "./components/ui/label"    → label.tsx
      "./components/ui/textarea" → textarea.tsx
      "./components/ui/select"   → select.tsx
      "./components/ui/table"    → table.tsx
      "./components/ui/card"     → card.tsx
      "./components/ui/badge"    → badge.tsx
      "./components/ui/alert"    → alert.tsx
  src/
    index.ts
    lib/utils.ts              # cn
    theme.css                 # Tailwind v4 入口 + Soft Bento tokens
    components/ui/*.tsx
  tsconfig.json               # react-library · NodeNext
  eslint.config.js            # react-internal
```

## 依赖

| 类型 | 包 |
|------|-----|
| dependencies | `clsx` · `tailwind-merge` · `class-variance-authority`（**catalog:**） |
| peer | `react` · `react-dom`（**非 optional**，有组件后） |
| 不在 ui 包 | `tailwindcss` / PostCSS（装在 **admin/web**，构建时处理 theme） |

## 扩展组件时

1. 在 `src/components/ui/<name>.tsx` 实现（`cn` + 可选 `cva` · `forwardRef`）  
2. **必须**在 `package.json#exports` 增加子路径  
3. 可选：根 `index.ts` re-export  
4. 更新 [component-guidelines](./component-guidelines.md) 导入表  
5. 勿深层相对路径穿透包外源码

## 与 app 的关系

```text
apps/admin|web
  postcss.config.mjs          → @tailwindcss/postcss
  next.config.ts              → transpilePackages + extensionAlias
  src/app/globals.css         → import theme + @source app
  src/app/layout.tsx          → import './globals.css' only
```
