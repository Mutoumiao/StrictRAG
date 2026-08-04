# eslint-config · 用法

## 导出（package.json）

| 子路径 | 文件 | 用途 |
|--------|------|------|
| `@strict-rag/eslint-config/base` | `base.js` | Node/库基线 |
| `@strict-rag/eslint-config/next-js` | `next.js` | Next app（admin/web） |
| `@strict-rag/eslint-config/react-internal` | `react-internal.js` | React 库（ui） |

## 仓库映射（实态）

| 包 | 配置 |
|----|------|
| api · worker · contracts · db · admin-catalog | `base` |
| admin · web | `nextJsConfig` from `next-js` |
| ui | `react-internal` |

示例（api）：

```javascript
import { config } from '@strict-rag/eslint-config/base';
/** @type {import("eslint").Linter.Config[]} */
export default config;
```

示例（admin/web）：

```javascript
import { nextJsConfig } from '@strict-rag/eslint-config/next-js';
export default nextJsConfig;
```

## base.js 要点

- `js` recommended + `typescript-eslint` recommended  
- `eslint-config-prettier`（与 Prettier 分工）  
- `turbo/no-undeclared-env-vars`: warn  
- ignores：`dist/**` · `.next/**` · `node_modules/**`  

## next.js 要点

- 扩展 base  
- React + React Hooks + `@next/next` core-web-vitals  
- ignore `.next/**` · `out/**` · `build/**` · `next-env.d.ts`  
- `react/react-in-jsx-scope`: off  

## react-internal 要点

- React 库 globals（browser/serviceworker）  
- 无 Next 插件  

## 修改规则时

1. 优先改本包共享配置  
2. 跑全仓 `pnpm lint`  
3. 不要在某个 app 静默 `max-warnings` 放宽除非有任务说明
