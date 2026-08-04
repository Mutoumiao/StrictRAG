# contracts · 目录结构

## 当前树

```text
packages/contracts/
  package.json          # exports: "." → ./src/index.ts
  tsconfig.json         # extends typescript-config/base.json
  eslint.config.js      # @strict-rag/eslint-config/base
  src/
    index.ts            # 聚合导出
    common/
      biz-code.ts       # BizCode 常量 + 类型
      response.ts       # ApiMeta / ApiResponse / buildSuccess|Failure
    system/
      health.contract.ts # Health / Ready Zod schemas
```

## 组织约定（已写在源码注释）

对齐参考仓：`common/*` + **按域目录**。

| 域目录 | 放什么 |
|--------|--------|
| `common/` | 横切：业务码、响应信封、分页等 |
| `system/` | 健康检查、就绪、运维探针 |
| 未来 `kb/` · `ask/` · `auth/` … | 按 PRD 资源域增加，**不要**全塞进 common |

## 导出规则

- 包入口仅 `"."` → `src/index.ts`（见 `package.json`）  
- 内部 re-export 使用 ESM 后缀：

```typescript
// packages/contracts/src/index.ts
export * from './common/biz-code.js';
export * from './common/response.js';
export * from './system/health.contract.js';
```

- 消费方：`import { BizCode, buildSuccess, HealthResponseSchema } from '@strict-rag/contracts'`

## 依赖

- 运行时：仅 `zod`（catalog）  
- **禁止**依赖 apps 或 `db` / `ui`（保持契约层纯净）
