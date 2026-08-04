# ui · 组件与样式约定

## cn()

**文件**：`packages/ui/src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**正确导入**（CLAUDE.md / 源码注释一致）：

```typescript
import { cn } from '@strict-rag/ui/lib/utils';
```

也可从包根：`import { cn } from '@strict-rag/ui'`（`index.ts` 已 re-export）。

## 主题 token

**文件**：`packages/ui/src/theme.css`

| 变量 | 用途 |
|------|------|
| `--sr-background` / `--sr-foreground` | 底与字 |
| `--sr-primary` | 主色 |
| `--sr-muted` / `--sr-border` | 弱化与边框 |
| `--sr-abstain` | 拒答/弃权态强调色 |
| `--sr-radius` | 圆角 |

正式色板以设计定稿 / `product.pen` 为准；接 Tailwind 时再映射到 `@theme`。

```typescript
import '@strict-rag/ui/theme.css';
```

## 组件规则（实现时）

| 规则 | 说明 |
|------|------|
| 无业务 API 调用 | 库只负责展示与交互原子 |
| 无密钥 / 无 env 业务配置 | |
| 可访问性 | 交互组件保持可键盘操作、语义标签 |
| shadcn 风格 | 项目注释写明对齐参考仓；新增依赖走 catalog |

## 反模式

- **Bad**：在 ui 包写 `fetch('/api/...')`  
- **Bad**：admin/web 各复制一份 `function cn`  
- **Good**：视觉原子在 ui；容器与数据在 app
