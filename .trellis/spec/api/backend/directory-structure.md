# api · 目录结构

## 当前

```text
apps/api/
  package.json     # type:module · dev/start = scaffold echo
  tsconfig.json    # extends @strict-rag/typescript-config/node.json
  eslint.config.js # @strict-rag/eslint-config/base
  src/
    index.ts       # APP_API_SCAFFOLD = true + 阶段注释
```

```typescript
// apps/api/src/index.ts（现状）
export const APP_API_SCAFFOLD = true as const;
```

## 目标职责

| 职责 | 说明 |
|------|------|
| HTTP / SSE | Hono + Node（**非**默认 CF Workers） |
| 鉴权中间件 | JWT · 权限码 · admin 壳（ADR-035/045/051） |
| 入队 | 写 Redis/BullMQ；**不**在 api 进程跑重入库 |
| 契约 | OpenAPI/Zod 与 contracts 同源 |

## 建议落点（实现时 · 对齐工程 PRD）

```text
src/
  index.ts          # 启动入口
  app.ts            # Hono app 工厂
  env.ts            # Zod env
  routes/           # 薄路由
  middleware/       # auth · requestId · 错误映射
  services/         # 业务编排
  # repository 可在此或依赖 packages 内模块；SQL 不进 route
```

前缀约定：`/api/v1`（PRD）。

## 脚本

| 脚本 | 现状 |
|------|------|
| `dev` / `start` | echo 占位提示 |
| `build` / `check-types` | `tsc --noEmit` |
| `lint` | eslint max-warnings 0 |
