# ui · 目录结构

## 当前

```text
packages/ui/
  package.json
    exports:
      "."           → src/index.ts
      "./lib/utils" → src/lib/utils.ts
      "./theme.css" → src/theme.css
  src/
    index.ts        # export { cn }
    lib/utils.ts    # cn = twMerge(clsx(...))
    theme.css       # --sr-* tokens
  tsconfig.json     # react-library.json
  eslint.config.js  # react-internal
```

## 依赖

- `clsx` · `tailwind-merge`（catalog）  
- `react` / `react-dom`：**peer optional**（库可在无组件时类型检查）  

## 扩展组件时

按注释：`button` / `card` 等 **按需** 增加 `package.json#exports` 子路径，对齐参考仓，避免深层随意相对路径穿透。
