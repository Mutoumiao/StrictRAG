# 真栈可达性与「不可离线验证」阻塞行的口径核实

Label: wayfinder:research
Type: research
Status: open

## Question

在**本机**（Windows + Docker Desktop）真起 compose 栈之前，先把两件事核清，避免开工后才发现要判的东西根本没口径：

1. **依赖面**：`docker/docker-compose.yml` 五个服务（postgres:pgvector:pg16 · redis:7-alpine · elasticsearch:8.15.3 · mongo:7 · rustfs）要真起并 healthcheck 通过，需要哪些前提（镜像是否需拉取、端口是否被占、`docker/README.md` 里有没有额外步骤、Windows 上有没有已知坑）？`scripts/up-stack.mjs`、`scripts/smoke-half.mjs`、`scripts/seed-demo.mjs`、`scripts/demo-ingest.mjs` 各自的前置与退出码语义是什么？
2. **口径**：覆盖表里那批写「不可离线补 / 阻塞方 = 真 ES / 真 PG / 真进程」的行——逐行核出**它到底要什么才能判**。至少覆盖：
   - `docs/testing/coverage/02-acl.md` 的 `X5`（dense 与 ES filter 均含 `doc_type∈hr`、对称）；
   - `docs/testing/coverage.md` 末段「不可离线补的阻塞行」里 **E1 E2 H5b H5d P1 AC4**（真 ES / 真双节点 / 真进程）与 **T4 C1 C2 C3**（人签 / live 真跑）；
   - 雾簇 **23**（迁移未经真 PG apply）· **24**（B8 真 ES）· **36**（孤儿清理周期调度）· **37**（自动 reindex / dense 反向构造）。
   每一行给出：**要跑什么命令 / 要起什么服务 / 看到什么输出才算判得了 / 判的结论写回哪个文件哪一行**。
3. **代码侧的真实依赖形状**（只读源码，不跑）：`apps/worker/src/ingest/es-http.ts` 建索引与 bulk 的字段/类型；`apps/api/src/services/retrieve/es-sparse.ts` 的查询 DSL；`SPARSE_INDEX_PROPERTIES` 用的是 `text` 无显式 analyzer（→ ES `standard`），核清「不装 IK 时中文命中会发生什么」；`STORAGE_MODE=s3` 的桶创建路径（`ensureBucket` / presign）；Mongo 正文 upsert 路径。

## Answer

（待研究票子代理回填：正文 + `research/01-*.md`）
