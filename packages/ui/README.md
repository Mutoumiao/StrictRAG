# @strict-rag/ui

共享 UI：**子路径 exports**，避免单 barrel 全量拖拽。

| 路径 | 内容 |
|------|------|
| `@strict-rag/ui/lib/utils` | `cn()` |
| `@strict-rag/ui/theme.css` | CSS 变量占位 |
| `@strict-rag/ui` | 根 re-export（可选） |

组件（button 等）待接 Next 时再按需注册到 `package.json#exports`。
