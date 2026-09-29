# 真栈可达性与「不可离线验证」阻塞行的口径核实

Label: wayfinder:research
Type: research
Status: claimed

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

正文：`research/01-real-stack-reachability.md`（A/B/C 三节 + 表格）。只读研究，未起任何服务。

**A. 依赖面**
- 五服务（`docker/docker-compose.yml:18-103`）：postgres=`pgvector/pgvector:pg16`·redis=`redis:7-alpine`·elasticsearch=`elasticsearch:8.15.3`·mongo=`mongo:7`·rustfs=`rustfs/rustfs:1.0.0-rc.2`；容器名 `strict-rag-*`、卷名 `strict-rag-*-data`、网络 `strict-rag`。五个 image 均为远端引用 → 都需拉取（本机缓存未知，未 pull）。体积量级【推断】：ES 最大（约 1.2–1.5 GB），redis 最小（约 40 MB）。
- **全仓无真跑原始输出**：`docs/`·`.scratch/`·`.trellis/` 内无任何「compose/migrate/smoke:half」的原始输出；唯一 generate 硬验收在**仓外副本**达成（`database-guidelines.md:193`）；`.scratch/p2-exit-evidence/research/writeback-countercheck.md:28` 明写「仓内无真跑记录」；本图工单 02–06 Answer 全「（待填）」。
- `pnpm smoke:half` 前置链 = health/ready → dev-login(201) → 建 KB(201) → upload-url(201)/PUT(200)/complete(200) → approve(200)/scan(200) → 轮询 ready∧双就绪 → PATCH active(200) → ask(200,须 `status=answered` 且 citations 含本次 docId)。**缺 `GATEWAY_BASE_URL` 的行为已核死**：`resolve.ts:87-92` 空 URL → mode=mock → `mock-client.ts:57-60` chat 返回 `[mock:generate] …` 纯文本（非 JSON）→ `run.ts:381-386` 解析失败 → `internal_guard`/abstained → `parse.ts:2-11` 抛 `no json object`。**结论：本机无真模型 key → `pnpm smoke:half` 不能绿**（仓库无 mock-but-JSON 分支）。
- Windows 已知坑：**仓库无记录**（全仓 `Windows/WSL/Docker Desktop` 仅命中测试夹具注释）；唯一跨平台适配是 `up-stack.mjs:53` 的 `shell:true`。

**B. 口径（要什么才能判）**
- X5（`02-acl.md:133`）：`es-sparse.ts` 查询期**零 `doc_type`** → 「对称」源码侧根本不存在 filter；真 ES 只能验「无 filter 时混合类型是否误召回」。阻塞方 = 源码缺 + 真 ES。
- E1 `01-ingest.md:14` / E2 `:15`：**本机可判**（PG+真 ES + `*_ES_MODE=http`），是本图工单靶子。
- H5b `00-ask.md:56`：本机判不了（须**真双节点** + 人签）。
- H5d `00-ask.md:58` / P1 `03-ops.md:72` / AC4 `:144`：本机判不了（须**真进程启动** `index.ts` + staging/prod env）；纯函数侧已测。
- T4 `03-ops.md:112` / C1 `:15` / C2 `:16` / C3 `:17`：本机判不了（**人签 + live 真模型真跑**）。
- 簇 23（真 PG apply）：本机可判，靶子 = 空库 `pnpm db:migrate` + journal 对账 + 回读断言。
- 簇 24（B8 真 ES+IK）：本机可判半截（建索引/bulk/中文命中/哨兵）；IK 是否必达由此裁定；多租户独立索引另裁。
- 簇 36（周期调度）：本机判不了「周期触发」，因**本仓无调度基建**（源码零 cron/Repeat）；业务逻辑已对只差 cron 已钉死。
- 簇 37：本机只剩「真 PG / 真 ES」两半截（自动 reindex 已裁定人工触发，不再是欠债）。

**C. 源码形状（关键）**
- `es-http.ts:59-69`：8 字段（7 keyword + `sparseText:text`）；**无显式 analyzer**（→ standard）。ensureSparseIndex `HEAD /<index>`→`PUT /<index>` 或 `PUT /<index>/_mapping`（只补 ownerDeptId/aclPrincipals/visibilityLevel）；bulk `POST /_bulk`（_id=chunkId）；`listIndexedChunkIds` `POST /<index>/_search`。
- `es-sparse.ts:309-319`：查询体 `{size, query:{bool:{filter:buildAclFilter, must:[{match:{sparseText}}]}}, _source:['chunkId']}`；filter 固定 `term tenantId`+`term kbId`；`requireTenantId:52-58` 缺租户即抛；**无 `doc_type`/`docType`**。
- `corpus.ts` 过滤顺序：双闸(ready∧active)→生效窗口→docTypes→部门/可见级(`visibility.ts` 先 dept 后 principals)→chunk→indexVersion 闸。
- `STORAGE_MODE=s3`：桶由 `storage.ts:165-173` `CreateBucketCommand` 首次 put 建；**无真 presign**，`uploadSlot:46-55` 返回 api 代理 `PUT /api/v1/internal/objects?key=`；worker `object-store.ts` 不建桶。
- Mongo `document_bodies` upsert = `apps/worker/src/ingest/mongo-body.ts:36-59`（`updateOne({docId},{$set:{…}},{upsert:true})`），URL 空回退 `local:<docId>`。
