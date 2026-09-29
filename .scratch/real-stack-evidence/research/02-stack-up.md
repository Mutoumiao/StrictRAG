# 工单 02 · 起真栈：compose 五服务 healthy + `/ready`（真跑证据）

> 图：[`real-stack-evidence`](../map.md) · 工单：[`issues/02-task-stack-up.md`](../issues/02-task-stack-up.md)
> 本机：Windows · Docker Desktop 25.0.2（守护进程由本图拉起）· 无浏览器

## 1. 起栈

```bash
docker compose -f docker/docker-compose.yml up -d
```

原始输出（节选）：五个容器 `Created` → `Started`，无拉取（镜像 5 周前已在本机）。

```text
 Container strict-rag-elasticsearch  Created / Started
 Container strict-rag-redis          Created / Started
 Container strict-rag-rustfs         Created / Started
 Container strict-rag-postgres       Created / Started
 Container strict-rag-mongo          Created / Started
```

## 2. healthy 与逐服务探活

`docker compose ps`（等待 13 秒后全绿）：

| 容器 | State | Health |
|------|:-----:|:------:|
| strict-rag-postgres | running | **healthy** |
| strict-rag-redis | running | **healthy** |
| strict-rag-elasticsearch | running | **healthy** |
| strict-rag-mongo | running | **healthy** |
| strict-rag-rustfs | running | **healthy** |

最小探活（原始输出）：

| 服务 | 命令 | 输出 |
|------|------|------|
| postgres | `docker exec strict-rag-postgres pg_isready -U strict_rag -d strict_rag` | `/var/run/postgresql:5432 - accepting connections` |
| redis | `docker exec strict-rag-redis redis-cli ping` | `PONG` |
| elasticsearch | `curl :9200/_cluster/health` | `{"cluster_name":"docker-cluster","status":"green","number_of_nodes":1,"active_shards_percent_as_number":100.0,…}` |
| mongo | `docker exec strict-rag-mongo mongosh --quiet --eval "db.adminCommand('ping').ok"` | `1` |
| rustfs | `curl :9000/health` | `{"status":"ok","ready":true,"service":"rustfs-endpoint","version":"1.0.0-rc.2"}` |

**结论**：五个服务在本机真起、真 healthy、真探活通过。雾簇「真栈起不来」在本机**不成立**。

## 3. `GET /ready`（api 叠加 `.env.operable.example` 后）

叠加方式：**不改仓库 `.env`**，只在启动 api / worker 的进程环境里注入 operable 键（`dotenv` 不覆盖已存在的 `process.env`，故进程环境优先）。

```json
{"service":"api","ready":true,"checks":{
  "postgres":"up","redis":"up","elasticsearch":"up","gateway":"skipped","s3":"down","mongo":"up"}}
```

- `postgres` / `redis` / `elasticsearch` / `mongo` = **up**；
- `s3` = **down** —— `apps/api/src/ready/checks.ts` 用 `HeadBucketCommand` 探活，而桶由**首次 `putObject`** 时 `S3ObjectStorage.ensureReady()` 创建（`services/storage.ts:165-180`），**新栈上第一次上传之前它是 down**；
- `gateway` = `skipped`（未配 `GATEWAY_BASE_URL`）；
- 顶层 `ready:true`（s3 不是硬依赖）。

**与文档不符的一处（已记，收口时订正）**：`docs/ops/operable-stack.md:59-61` 写 `/ready` 期望「`elasticsearch` / `s3` / `mongo` = up」——真栈上 s3 在首次上传前恒为 `down`。该句需要补上「首建桶后才是 up」。

## 4. 真跑暴露的配方缺口（**本工单最重要的发现**）

按 `docs/ops/operable-stack.md` §2 的配方（复制 `.env.example` → 追加 `.env.operable.example`）在**全新库**上启动 api，进程**直接以非零码退出**：

```text
ERROR: superadmin bootstrap failed
  SuperAdminBootstrapError: 无 active 超管：须同时配置 SUPER_ADMIN_EMAIL 与 SUPER_ADMIN_PASSWORD
      at bootstrapSuperAdmin (apps/api/src/services/superadmin-bootstrap.ts:155)
      at runSuperAdminBootstrap (apps/api/src/services/superadmin-bootstrap.ts:186)
      at async start (apps/api/src/index.ts:20)
Exit status 1
```

事实链（全部可指到行）：

1. `apps/api/src/index.ts:20` —— `await runSuperAdminBootstrap()` 在 `serve()` **之前**，无开关、无 `APP_ENV` 分支；失败即 `process.exit(1)`（`:21-24`）。
2. `apps/api/src/services/superadmin-bootstrap.ts:147-157` —— 库里没有 active 超管时，`SUPER_ADMIN_EMAIL` 与 `SUPER_ADMIN_PASSWORD` 任一为空即抛 `SuperAdminBootstrapError`。
3. `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 全仓只出现在：`.env.example:73-74`（**被注释掉**）· `apps/api/src/env.ts:88-89`（`optional()`）· 上面那个 bootstrap 文件。
4. `docs/ops/operable-stack.md` · `docs/ops/half-smoke.md` · `docs/ops/auth-enforce-pilot.md` · `docker/README.md` **四处运维文档全都没提这个前置**。

即：**「第三人把栈拉起来 → 起 api」这条路，在全新库上必然失败**，而失败原因在配方里没有写。这不是代码缺陷（启动引导超管是 ADR 级的有意 fail-closed 闸），是**配方缺一步**。本机补上 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 后 api 正常启动。

## 5. 本机结论

| 项 | 结果 |
|----|------|
| 五服务真起 | ✅ |
| 五服务 healthy + 探活 | ✅ |
| `GET /ready` 硬依赖 | ✅ postgres / redis 全 up |
| `GET /ready` 软项 | elasticsearch / mongo up；s3 首启前 down（文档口径待订正） |
| 全新库起 api | ⚠️ 需 `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD`（配方未写 → 记债并订正文档） |
