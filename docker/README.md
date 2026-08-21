# Docker 依赖

本地基础设施 compose。业务进程 `api` / `worker` **不在** compose 内定义；用 `pnpm up:apps` 一键起中间件 + api + worker。

## 默认可运行栈

```bash
docker compose -f docker/docker-compose.yml up -d
```

| 服务 | 端口 | 说明 |
|------|------|------|
| PostgreSQL 16 + pgvector | 5432 | 用户/库/密：`strict_rag` |
| Redis 7 | 6379 | BullMQ |
| Elasticsearch 8.15.3 | 9200 | BM25；**未装 IK** |
| Mongo 7 | 27017 | parse 正文 |
| rustfs（MinIO 占位） | 9000 / 9001 | S3 兼容；首次 api put 建桶 `strict-rag` |

打开 worker/api 的 http/s3 开关见 [`docs/ops/operable-stack.md`](../docs/ops/operable-stack.md)。  
CI / Zod **默认仍 mock + local**，避免无容器时单测失败。

## 连接串示例

见仓库根 `.env.example`。
