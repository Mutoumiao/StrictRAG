# typescript-config · 用法

## 导出

| 子路径 | 用途 |
|--------|------|
| `@strict-rag/typescript-config/base.json` | 严格基线 |
| `@strict-rag/typescript-config/node.json` | Node app（api/worker） |
| `@strict-rag/typescript-config/nextjs.json` | Next app |
| `@strict-rag/typescript-config/react-library.json` | React 库（ui） |

## base.json 关键项

| 选项 | 值 |
|------|-----|
| `strict` | true |
| `noUncheckedIndexedAccess` | true |
| `target` / `lib` | ES2022 |
| `module` / `moduleResolution` | NodeNext |
| `isolatedModules` | true |
| `declaration` | true |

## 继承

```text
base.json
  ├── node.json          (+ types: node)
  ├── nextjs.json        (DOM · Bundler · jsx preserve · next plugin)
  └── react-library.json (jsx react-jsx · DOM)
```

## 仓库实态

| 包 | extends |
|----|---------|
| api · worker | `node.json` |
| contracts · db · admin-catalog | `base.json` |
| ui | `react-library.json` |
| admin · web | `base.json` + 本地覆盖 DOM/jsx/Bundler（尚未切 nextjs.json） |

admin/web 在真正接入 Next 后，建议与 `nextjs.json` 对齐并更新本表。

## 消费方模式

```json
{
  "extends": "@strict-rag/typescript-config/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
```

contracts 当前 **未** 强制 `noEmit: true`（有 declaration 输出意图时保持与 base 一致）；以各包 `tsconfig.json` 为准。

## 反模式

- **Bad**：关闭 `strict` 消错  
- **Bad**：业务包自写完整 compilerOptions 脱离 base  
- **Good**：差异用本地 `compilerOptions` 覆盖最小集合
