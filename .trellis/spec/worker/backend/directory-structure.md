# worker · 目录结构

## 当前

```text
apps/worker/
  package.json     # dev/start = scaffold echo（无端口）
  tsconfig.json    # node.json
  eslint.config.js # base
  src/
    index.ts       # APP_WORKER_SCAFFOLD = true
```

## 目标职责

| 职责 | 说明 |
|------|------|
| BullMQ consumers | 入库 / 对账 / 评测抽样等 |
| 与 api 分工 | api 入队；worker 消费重活 |
| 多副本 | 部署单元可水平扩展 |

## 建议落点（实现时）

```text
src/
  index.ts           # 进程入口、优雅退出
  env.ts             # Zod
  queues/            # 队列名与连接
  processors/        # 按 job 类型
  # 复用 packages/db · 未来 gateway/es/mongo 客户端
```

Phase 0：进程可起 + 探针队列 noop（路线图）。
