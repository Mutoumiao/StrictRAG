# 起真栈：compose 五服务 healthy + `/ready` 全绿

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 01

## Question

在本机把 `docker/docker-compose.yml` 的五个服务真起起来（postgres / redis / elasticsearch / mongo / rustfs），并把证据留下来：

- `docker compose -f docker/docker-compose.yml up -d` 的退出码与 `docker compose ps` 的 healthy 状态；
- 各服务最小探活：`pg_isready` · `redis-cli ping` · `curl :9200/_cluster/health` · `mongosh ping` · `curl :9000/health`；
- API 侧：`GET http://127.0.0.1:4000/ready` 在叠加 `.env.operable.example` 后各项是否 `up`（PG/Redis 为硬依赖）。

拿不到绿就**如实**记录卡在哪一步、什么错、缺什么（网络拉镜像 / 端口占用 / WSL 资源 / 镜像架构），并把它写进本票 Answer 当作阻塞方；**不许**把 mock 绿记成真栈绿。

产物：`research/02-stack-up.md`（命令 + 原始输出摘要）。

## Answer

**已解**。取证全文：[`../research/02-stack-up.md`](../research/02-stack-up.md)。

1. **五服务真起真绿**：`docker compose -f docker/docker-compose.yml up -d` → 五个容器全 `running|healthy`（postgres / redis / elasticsearch / mongo / rustfs）；逐服务探活：`pg_isready` → `accepting connections` · `redis-cli ping` → `PONG` · `:9200/_cluster/health` → `status: green` · `mongosh ping` → `1` · `:9000/health` → `{"status":"ok","ready":true}`。**无镜像拉取**（5 周前已在本机）。
2. **`GET /ready`**：`{"ready":true,"checks":{"postgres":"up","redis":"up","elasticsearch":"up","gateway":"skipped","s3":"down","mongo":"up"}}`。硬依赖全 up。
3. **两处与文档不符 / 缺口（已记入收口）**：
   - `docs/ops/operable-stack.md:59-61` 写 `/ready` 期望 s3 = up；真栈上桶由**首次 put** 才创建（`apps/api/src/services/storage.ts:165-180`），故首启前恒 `down`。文档口径待订正。
   - **配方缺一步（新发现）**：按 `operable-stack.md` §2 的配方在**全新库**上起 api，进程**必然非零退出**（`SuperAdminBootstrapError`），因为 `apps/api/src/index.ts:20` 在 `serve()` 前无条件跑超管引导，而 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 在 `.env.example:73-74` 里是**注释掉的**，四份运维文档**全都没写这个前置**。这是配方缺口（不是代码缺陷：引导超管是有意的 fail-closed 闸）。
4. 本机补上 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 后 api 正常起、`/ready` 正常回。

**未做（如实）**：不改仓库 `.env` / `.env.example` 的默认值；叠加只在进程环境里注入。
