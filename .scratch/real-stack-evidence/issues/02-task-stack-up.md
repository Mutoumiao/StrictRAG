# 起真栈：compose 五服务 healthy + `/ready` 全绿

Label: wayfinder:task
Type: task
Status: open
Blocked by: 01

## Question

在本机把 `docker/docker-compose.yml` 的五个服务真起起来（postgres / redis / elasticsearch / mongo / rustfs），并把证据留下来：

- `docker compose -f docker/docker-compose.yml up -d` 的退出码与 `docker compose ps` 的 healthy 状态；
- 各服务最小探活：`pg_isready` · `redis-cli ping` · `curl :9200/_cluster/health` · `mongosh ping` · `curl :9000/health`；
- API 侧：`GET http://127.0.0.1:4000/ready` 在叠加 `.env.operable.example` 后各项是否 `up`（PG/Redis 为硬依赖）。

拿不到绿就**如实**记录卡在哪一步、什么错、缺什么（网络拉镜像 / 端口占用 / WSL 资源 / 镜像架构），并把它写进本票 Answer 当作阻塞方；**不许**把 mock 绿记成真栈绿。

产物：`research/02-stack-up.md`（命令 + 原始输出摘要）。

## Answer

（待填）
