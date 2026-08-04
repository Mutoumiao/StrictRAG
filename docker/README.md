# Docker 依赖

本地基础设施 compose。业务进程 `api` / `worker` **不在** compose 内启动。

## 默认（Phase 0）

```bash
docker compose -f docker/docker-compose.yml up -d
```

| 服务 | 端口 | 说明 |
|------|------|------|
| PostgreSQL 16 + pgvector | 5432 | 用户/库/密：`strict_rag` |
| Redis 7 | 6379 | BullMQ |

## 扩展 profile

```bash
# ES（P1 前 green；IK 镜像需按运维手册替换）
docker compose -f docker/docker-compose.yml --profile es up -d

# Mongo 正文
docker compose -f docker/docker-compose.yml --profile mongo up -d

# S3 兼容（本地 MinIO 占位；生产 RustFS）
docker compose -f docker/docker-compose.yml --profile rustfs up -d

# 一次拉齐扩展依赖
docker compose -f docker/docker-compose.yml --profile es --profile mongo --profile rustfs up -d
```

| Profile | 端口 | 备注 |
|---------|------|------|
| `es` | 9200 | 官方 ES 镜像占位；**IK 需替换** |
| `mongo` | 27017 | P1 body |
| `rustfs` | 9000 / 9001 | MinIO 兼容 dogfood |

## 连接串示例

见仓库根 `.env.example`。
