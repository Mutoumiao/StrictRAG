# Docker 依赖

本地基础设施 compose。业务进程 `api` / `worker` **不在** compose 内定义；用 `pnpm up:apps` 一键起中间件 + api + worker。

## 命名空间

Compose 项目名固定为 `strict-rag`（见 `docker-compose.yml` 顶层 `name:`），不随 `docker/` 目录名推断。`docker ps` / `docker volume ls` / `docker network ls` 里应看到：

| 类型 | 名称 |
|------|------|
| 容器 | `strict-rag-postgres` · `strict-rag-redis` · `strict-rag-elasticsearch` · `strict-rag-mongo` · `strict-rag-rustfs` |
| 网络 | `strict-rag` |
| 数据卷 | `strict-rag-pg-data` · `strict-rag-es-data` · `strict-rag-mongo-data` · `strict-rag-rustfs-data` |

本机若仍有旧项目名 `docker` 的容器（如 `docker-postgres-1`），先按旧名停栈，再起新栈，否则会和本项目抢宿主机端口：

```bash
docker compose -p docker -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml up -d
```

旧数据卷默认叫 `docker_strict_rag_pg` 等；新卷是 `strict-rag-*-data`。需要保留数据时自行 `docker volume` 复制，不要两边同时 `up`。

`strict-rag-rustfs-data` 若曾被 MinIO 写入，格式与官方 RustFS 不兼容，须停服务后删卷再起：

```bash
docker compose -f docker/docker-compose.yml stop rustfs
docker volume rm strict-rag-rustfs-data
docker compose -f docker/docker-compose.yml up -d rustfs
```

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
| rustfs | 9000 / 9001 | 官方 RustFS（ADR-012）；首次 api put 建桶 `strict-rag` |

打开 worker/api 的 http/s3 开关见 [`docs/ops/operable-stack.md`](../docs/ops/operable-stack.md)。  
CI / Zod **默认仍 mock + local**，避免无容器时单测失败。

## 连接串示例

见仓库根 `.env.example`。
