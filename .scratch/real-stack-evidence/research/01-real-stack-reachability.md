# 真栈可达性与「不可离线验证」阻塞行的口径核实（研究正文）

> 图：[`real-stack-evidence`](../map.md) · 工单：[`issues/01-research-real-stack-reachability.md`](../issues/01-research-real-stack-reachability.md)
> 性质：**只读研究**。未起任何服务、未跑 compose/migrate/smoke、未改任何源码。
> 记号：带 **【推断】** 的段落是分析结论，非仓内直接事实；其余均为可指到 `<相对路径>:<行号>` 的源码/文档事实。

---

## A. 依赖面

### A1. compose 五服务清单

来源：`docker/docker-compose.yml:18-103`（服务定义）、`:105-115`（网络与卷）、`:1-10`（`name: strict-rag`）。

| 服务 | image | 容器名 | 端口（宿主:容器） | healthcheck 命令 | 数据卷名 |
|------|-------|--------|------------------|------------------|----------|
| postgres | `pgvector/pgvector:pg16` | `strict-rag-postgres` | 5432:5432 | `pg_isready -U strict_rag -d strict_rag` | `strict-rag-pg-data` |
| redis | `redis:7-alpine` | `strict-rag-redis` | 6379:6379 | `redis-cli ping` | 无（内存，未挂卷） |
| elasticsearch | `docker.elastic.co/elasticsearch/elasticsearch:8.15.3` | `strict-rag-elasticsearch` | 9200:9200 | `curl -sf http://localhost:9200/_cluster/health` | `strict-rag-es-data` |
| mongo | `mongo:7` | `strict-rag-mongo` | 27017:27017 | `mongosh --quiet --eval "db.adminCommand('ping').ok"` | `strict-rag-mongo-data` |
| rustfs | `rustfs/rustfs:1.0.0-rc.2` | `strict-rag-rustfs` | 9000:9000 · 9001:9001 | `curl -sf http://127.0.0.1:9000/health` | `strict-rag-rustfs-data` |

补充事实：
- 网络名固定 `strict-rag`（`docker-compose.yml:105-107`）；compose 项目名固定 `strict-rag`（`:8` `name:`），不随 `docker/` 目录名推断。
- ES 环境：`discovery.type=single-node` · `xpack.security.enabled=false` · `ES_JAVA_OPTS=-Xms512m -Xmx512m`（`docker-compose.yml:52-55`）。
- rustfs 环境：`RUSTFS_ACCESS_KEY=strict_rag` · `RUSTFS_SECRET_KEY=strict_rag_secret` · 控制台开 · 地址 `:9000/:9001`（`docker-compose.yml:86-92`）；与 `.env.operable.example:13-15` 的 `S3_ACCESS_KEY/S3_SECRET_KEY` 对齐。
- ES healthcheck 有 `retries: 20` / `interval: 10s`（`:60-64`），rustfs 有 `start_period: 20s`（`:102`）——冷启动最慢的两个。
- 业务进程 `api` / `worker` **不在** compose 内（`docker/README.md:3`、`docker-compose.yml:15`）。

**必须拉取的镜像**：五个 `image:` 全为远端引用，仓库不自建镜像，故五个都要拉取。

| image | 大小量级【推断】（仓库无记录，未 pull） |
|-------|----------------------------------------|
| `elasticsearch:8.15.3` | 约 1.2–1.5 GB（最大，整栈瓶颈） |
| `mongo:7` | 约 700–800 MB |
| `pgvector/pgvector:pg16` | 约 400–500 MB |
| `rustfs/rustfs:1.0.0-rc.2` | 数十–数百 MB 量级（仓库无记录，未核实） |
| `redis:7-alpine` | 约 40 MB（最小） |

**【推断】** 五个镜像是否已在本机 Docker 缓存中，仓库无从判断，只有 `docker images` 能核；本机未跑，故「需拉取」按「远端引用、需拉取」写。上述体积为公开镜像的常识量级，**不是**仓内记录，也未实测。

### A2. 有没有「真跑原始输出」记录 —— 全仓无真跑原始输出

检索范围：`docs/`、`.scratch/`、`.trellis/`（含 `workspace/`）；关键词 `PASS kbId` · `SEED_KB_ID` · `citations=` · `docker ps` · `healthy` · `Applying migration` · `__drizzle_migrations` · `docker compose ps` 等。

结论：**全仓无真跑原始输出**。具体：

- smoke 相关：唯一带 `citations=` 的串是 `docs/ops/half-smoke.md:22`，写的是**期望**（「期望 stdout 含 `PASS` 且 `citations=` ≥ 1」），不是实跑输出。
- compose 相关：`docker/README.md`、`docs/ops/operable-stack.md` 给的是**命令与预期**（如 `:52-67` 的 `/ready` 期望），无 `docker compose ps` / healthy 实跑快照。
- migrate 相关：唯一「真跑过 generate」的记录在**仓外副本**，且明写未在仓库工作区跑（`.scratch/fill-must-haves/research-drizzle-meta-baseline.md`、`.solve`-级结论见 `.trellis/spec/db/backend/database-guidelines.md:193`：「该验收在仓外副本达成、未在仓库工作区跑过」）。真 PG `apply` 的原始输出**没有任何记录**。
- 反向佐证：`.scratch/p2-exit-evidence/research/writeback-countercheck.md:28` 明确写「**仓内无真跑记录**」——任务 `08-21-half-mongo` 的 `task.json` `notes` 空、`commit`/`pr_url` 空，`prd.md` 三条 AC 全未勾。
- 本图所有工单（`issues/02`–`06`）的 `## Answer` 均为「（待填）」，即真跑证据**尚未产生**。

**【推断】** 因此 A2 的答案是：截至本次研究，仓库里**没有任何一处**能以「命令 + 原始输出」证明「本机已跑过 compose / 已跑过 migrate / 已跑过 smoke:half」。P-HALF「可运行」目前只有脚本与文档口径，没有本机复现证据。

### A3. `scripts/smoke-half.mjs` 前置链 + 缺 `GATEWAY_BASE_URL` 的 mock 分支行为

前置链（脚本头部注释 `scripts/smoke-half.mjs:7`，链路由 `main()` 串起）：

| 步 | 方法 + 路径 | 期望 HTTP | 源码行 |
|----|-------------|-----------|--------|
| 1 | `GET /health` | 200 | `smoke-half.mjs:58-61` |
| 1 | `GET /ready`（须 `ready===true`） | 200 | `:62-66` |
| 2 | `POST /api/v1/auth/admin/dev-login` | 201（`data.accessToken`、`data.session.userId`） | `:68-80` |
| 3 | `POST /api/v1/knowledge-bases` | 201（`data.id`） | `:82-87` |
| 4 | `POST .../documents/upload-url` | 201（`docId`、`uploadUrl`） | `:90-95` |
| 4 | `PUT uploadUrl` | 200 | `:96-100` |
| 4 | `POST .../documents/:docId/complete` | 200 | `:101-104` |
| 5 | `POST /api/v1/documents/:docId/approve` | 200 | `:105-106` |
| 5 | `POST /api/v1/documents/:docId/scan` | 200 | `:107-108` |
| 6 | 轮询 `GET /api/v1/documents/:docId` 至 `status=ready ∧ embedReady ∧ esReady` | 200 | `:110-130`（超时 `TIMEOUT_MS`，默认 120000） |
| 7 | `PATCH .../lifecycle` `{lifecycle:'active'}` | 200 且回读 `lifecycle==='active'` | `:132-139` |
| 8 | `POST /api/v1/knowledge-bases/:kbId/ask`（`options.stream:false`） | 200 且 `okHasCitations` 为真、`citations` 含本次 `docId` | `:141-152` |

失败即抛错 → 非零退出（`:158-162`）。`askHasCitations` 判定：`json.ok===true ∧ data.status==='answered' ∧ citations 有合法 docId`（`scripts/smoke-ask.mjs:16-20`）。

**核清：缺 `GATEWAY_BASE_URL` 时 api 的 mock 分支到底返回什么**

链路与具体行为（全部指到行）：

1. `apps/api/src/env.ts:33` —— `GATEWAY_BASE_URL` 默认空串 `''`；`:36` `GATEWAY_MODE` 默认空串；`:38` `GATEWAY_API_KEY` 默认空串。
2. `apps/api/src/services/gateway/resolve.ts:87-92` `defaultMode()`：`GATEWAY_MODE` 为空时，`GATEWAY_BASE_URL.trim()` 为空 → 返回 `'mock'`。即**未设 URL → mode=mock**。
3. `apps/api/src/services/gateway/client.ts:34-39` `createGateway()`：`cfg.mode==='mock'` → `createMockGateway(cfg)`。
4. `apps/api/src/services/gateway/mock-client.ts:57-60` mock chat 返回体：
   ```
   const text = lastUser?.content?.trim()
     ? `[mock:${req.purpose}] ${lastUser.content.slice(0, 200)}`
     : `[mock:${req.purpose}] empty`;
   ```
   即形如 `[mock:generate] …` 的**纯文本**，**不是 JSON**。
5. ask 图的 generate 步：`apps/api/src/graph/run.ts:362-386` 调 `chargeAndChat(...,'generate', ...)`，拿到文本后 `parseGenerateOutput(chat.text)`；解析失败 → `finalize(state,'internal_guard')`（`:381-386`）。
6. `apps/api/src/graph/parse.ts:2-11` `extractJsonObject()`：文本里找不到 `{…}` 配对 → `throw new Error('no json object')`；`parseGenerateOutput`（`:20-28`）因此抛。
7. 结果：`finalize(state,'internal_guard')` → ask 信封 `ok:true`、`data.status` 为 `abstained`（非 `answered`），`citations` 为空。

判定：`askHasCitations`（`scripts/smoke-ask.mjs:16-20`）要求 `status==='answered'` → 空引用 → 脚本在 `smoke-half.mjs:148-150` 抛 `ask has no citations`。

**结论（事实级）**：`docs/ops/half-smoke.md:13` 那句「缺 `GATEWAY_BASE_URL` 时默认 mock chat 不是 JSON，ask 会拒答、本脚本因空引用失败」**与源码逐位一致**（`resolve.ts:87-92` + `mock-client.ts:57-60` + `run.ts:381-386` + `parse.ts:2-11`）。

**判断：在没有任何真模型 key 的机器上 `pnpm smoke:half` 能否绿？**
**不能**（除非额外配 `GATEWAY_MODE=http` + 可达的 `GATEWAY_BASE_URL` 且上游产出合法 generate/claim_split/judge JSON）。
- 【推断】原因链：本机无 key → `GATEWAY_BASE_URL` 空 → mode 恒 mock → generate 文本非 JSON → `internal_guard` → `abstained` → 空引用 → 脚本非零退出。
- 仓库里**不存在**「mock-but-JSON」的 chat 分支：`mock-client.ts` 的 chat 只有 `[mock:…]` 纯文本一种返回（`mock-client.ts:57-60`）；`createGateway` 也只在 mock / http 二选一（`client.ts:34-39`）。
- 故工单 04 的问题（「半产品可运行」在无 Gateway 机器上是否可复现）**源码侧答案 = 不可复现 live ask**；此时只能证明到「上传→入库→双就绪→active」的前置段，最后一步 ask 有引用恒失败。

### A4. Windows 上跑这套栈的已知坑

**仓库无记录。** 全仓检索 `Windows` / `WSL` / `Docker Desktop` / `winpty`（`.md` 及其它文件）在 `docs/`、`docker/`、`.scratch/`、`.trellis/` 内**零命中**；唯一含「Windows」的是测试夹具注释 `scripts/check-test-inventory.fixture.mjs:90`（「Windows 反斜杠 ≡ posix」），与栈无关。
**【推断】** 因此不能凭仓内文字写任何 Windows 坑。唯一与跨平台相关、且**有源码依据**的一点：`scripts/up-stack.mjs:53` 在 `process.platform === 'win32'` 时对子进程加 `shell: true`（`spawnInherit` 的 `shell` 选项）——这是仓库为 Windows 显式写的一行适配，但未记录任何已知故障。其余（镜像架构、WSL 资源、端口占用）仓库无口径，本机也未实测。

---

## B. 口径：逐行核出「要什么才能判」

列含义：**要起什么服务** / **要跑什么命令** / **看到什么输出才算判得了** / **结论写回哪一节**。判不了的写「本机判不了，因为 ___」。

### B-a `docs/testing/coverage/02-acl.md` 的 X5（第 133 行）

- 行要点：dense 与 ES 查询期 filter **均含** `doc_type∈hr`、两路对称。
- 现状：`es-sparse.ts` 查询期 **零 `doc_type`/`docType`**（`apps/api/src/services/retrieve/es-sparse.ts` 全文无该字段，`buildAclFilter:195-216` 只造 tenantId/kbId/ownerDept/visibility/aclPrincipals）；类型过滤净效果由装载层 `corpus.ts:44-47` + sparse 事后求交保证。

| 要起什么 | 要跑什么命令 | 看到什么才算判得了 | 写回哪一节 |
|----------|--------------|--------------------|-----------|
| 真 ES 8.15.3（compose `elasticsearch`） + PG；须 `RETRIEVE_ES_MODE=http` | 建索引后 bulk 含 `hr`/`finance` 两型文档；`POST /<index>/_search` 打真实 ask 查询体；`GET /<index>/_mapping` 看 `docType` 是否存在 | 若要判「对称」需源码先给 ES 索引加 `docType` 字段与查询 filter；**当前源码下 ES 侧没有该 filter 可验** | `docs/testing/coverage/02-acl.md` X5 行「缺口」列 |

**本机判不了「对称」本身，因为【推断】阻塞方在源码而非环境**：X5 记的「丁（源码缺 + 撞 B8）」指出查询期 `doc_type` filter 源码侧根本不存在（`es-sparse.ts` 零命中），故真 ES 也验不出一条不存在的 filter。真 ES 能验的是「若不落 filter，混合类型的 KB 上 BM25 是否会误召回 finance 片段」，据此判断「B8 不到位」还是「可离线落地」。判定结论写回 X5「缺口」列与 `.scratch/fog-inventory-2026-09-23.md` 簇 24 行。

### B-b `docs/testing/coverage.md` 末段「不可离线补的阻塞行」

出处：`docs/testing/coverage.md:106`。逐行落到分册：

| 行 | 行级要求 | 要起什么服务 | 要跑什么命令 | 看到什么才算判得了 | 写回哪一节 |
|----|----------|--------------|--------------|--------------------|-----------|
| E1 | ready+active 可查（ES 可查文号） | PG + 真 ES + worker/api；`RETRIEVE_ES_MODE=http`、`INGEST_ES_MODE=http` | 入库一篇 → `POST /<index>/_search`（含文号术语） | ES 命中数 ≥1 且 chunkId 与 PG 一致；`refresh`/`preference` 语义清楚 | `docs/testing/coverage/01-ingest.md:14` E1「缺口」列 |
| E2 | supersede 旧版：ask 不得引用旧版 | 同上 | 入库 v1→supersede→入库 v2；再查 ES 与 ask | ES 侧旧 version chunk 不命中（或命中但被 PG 语料求交丢弃）；evidence 无旧版 | `docs/testing/coverage/01-ingest.md:15` E2「缺口」列 |
| H5b | staging/prod **真双节点**：断 primary rerank，备用可达 | **两个 rerank 端点**（真第二节点）+ `RERANK_MIN_NODES=2`、`APP_ENV=staging\|production` | 断 primary → 打 ask | ask 走完、非全员 `rerank_unavailable`（`resolve-mock.test.ts` 只 mock 了双节点） | `docs/testing/coverage/00-ask.md:56` H5b「缺口」列 |
| H5d | 配置链长 `< RERANK_MIN_NODES` → **进程启动失败** / 拒绝加载 | api 真进程（`apps/api/src/index.ts`）+ 真 env | 设链长 < min 起 api | 进程以非零退出 / 启动即拒；纯函数侧已具（`buildGatewayConfig:119-122` 抛 `GatewayConfigError`） | `docs/testing/coverage/00-ask.md:58` H5d「缺口」列 |
| P1 | staging/prod `judge≡judge_aux` 同 provider+model → **启动失败** | api 真进程 + 真 env（`APP_ENV=staging\|production`） | 配同模 → 起 api | 启动即拒；纯函数无 env 分档（`apps/api/src/services/model-gateway.ts:176-214`） | `docs/testing/coverage/03-ops.md:72` P1「缺口」列 |
| AC4 | prod/staging 绑 `judge≡judge_aux` 同模 → 拒绝保存/加载 | 同 P1 | 同 P1（保存侧已测同模 400） | 同 P1（加载侧） | `docs/testing/coverage/03-ops.md:144` AC4「缺口」列 |
| T4 | 提案 + L1 重跑 + 业务/产品签字 + 快照绑定 → 加严包生效 | 无服务要求（流程） | 跑 L1 重跑脚本 + 走签字流程 | **真人签字**落文件账本；本机无签字主体 | `docs/testing/coverage/03-ops.md:112` T4「缺口」列 |
| C1 | 黄金集 1:1、seed 固定，2×2 live 数字 | 真 Gateway（live）+ PG/Redis | live 跑 L1 2×2 | 产出 live 2×2 数字 + 业务题面人审 | `docs/testing/coverage/03-ops.md:15` C1「缺口」列 |
| C2 | τ 扫描得 tau* | 真 Gateway（live） | live 跑 τ 网格 | live τ 扫描数字 + tau* 接运行时 | `docs/testing/coverage/03-ops.md:16` C2「缺口」列 |
| C3 | Judge 校准产出 AUROC | 真 Gateway `purpose=judge`（live）+ ≥100 真标注校准集 | live 跑校准 | `judgeAurocSource=live` 且有效对数 ≥100 | `docs/testing/coverage/03-ops.md:17` C3「缺口」列 |

**本机判不了的行（逐条给阻塞方，非「跑法不明」）**：

- **H5b**：本机判不了，因为没有**第二台 rerank 节点**（真双节点属运维部署），且需人签。
- **H5d / P1 / AC4**：本机判不了，因为要的是**真进程启动加载路径**（`apps/api/src/index.ts` + `APP_ENV=staging/production` 真 env）；纯函数侧已测，剩「进程启动失败」这一截。
- **T4 / C1 / C2 / C3**：本机判不了，因为阻塞方是**人签 + live 真模型真跑**（本机无 Gateway key；本图 Out of scope 已声明「真模型 / 人签不在本机可代」）。
- **E1 / E2**：**本机可判**（起 PG + 真 ES + api/worker、开 `INGEST_ES_MODE=http`/`RETRIEVE_ES_MODE=http`），是本图工单 04/05 的靶子。

### B-c 雾簇 23 / 24 / 36 / 37

出处：`.scratch/fog-inventory-2026-09-23.md` 汇总表（簇 23 `| 23 | 迁移未经真 PG apply 验证 |`；簇 24 `| 24 | B8 真 ES+IK / 多租户独立索引 |`；簇 36 `| 36 | 孤儿清理周期调度 |`；簇 37 `| 37 | 自动 reindex-on-tighten / dense 反向构造 |`）。

| 簇 | 要起什么服务 | 要跑什么命令 | 看到什么才算判得了 | 写回哪一节 |
|----|--------------|--------------|--------------------|-----------|
| 23 迁移未经真 PG apply | compose `postgres`（真 PG 16 + pgvector） | 空库 `pnpm db:migrate` | 零错误；`__drizzle_migrations` 条数与 `drizzle/meta/_journal.json` 一一对应；≥3 条能力回读断言通过；`db:generate` 是否空 diff | 工单 03 Answer + `docs/module-status/db.md` + 本图 map Decisions |
| 24 B8 真 ES+IK / 多租户独立索引 | compose `elasticsearch`（vanilla 8.15.3，**无 IK**） | 建索引 → bulk（含中文 `sparseText`）→ `_search` 中文术语 | 索引/mapping 落地（含 keyword 字段）；bulk `_count` 与 PG 一致；`__acl_none__` 真写入；中文命中与否及切词形态（据此裁 IK 是否 B8 必达）；独立索引另裁 | 工单 05 Answer + `docs/testing/coverage/02-acl.md` X5 + fog 簇 24 行 |
| 36 孤儿清理周期调度 | 无（调度基建缺失） | 无（本仓无 cron/Repeat；`orphan-clean.ts:9`「未落地：周期触发」；worker 源码零 `cron/Repeat/setInterval`） | 判据 = 「差的是调度基建」已由源码钉死；真 ES 侧清理另属 B8（`orphanCleanEsSideAvailable()` 仅在 `INGEST_ES_MODE==='mock'` 返回真，`orphan-clean.ts:167-169`） | `docs/testing/coverage/01-ingest.md:33` L7「缺口」列 + fog 簇 36 行 |
| 37 自动 reindex / dense 反向构造 | PG（真）+ ES（B2-3 的集群侧） | B2-3：真 PG 上构造「绕过可见性闸喂全量语料」；B2-2：真 ES 上验 reindex 覆盖旧 principals | B2-3 dense 单路泄漏反向构造在真 PG `loadCorpusFromDb` 上成立；B2-2 的「reindex 后 ES 旧 principals 被覆盖」在真 ES 成立 | `docs/testing/coverage/02-acl.md:47` B2-3、`:46` B2-2「缺口」列 + fog 簇 37 行 |

**判不了/部分判不了的**：
- **簇 37 的「自动 reindex」**：已裁定为**人工触发**（`02-acl.md:46` B2-2：「自动 reindex 已裁定为『人工触发』（不再是欠债）」），故本机**无需**判「自动」；只剩真 ES 侧「reindex 覆盖旧 principals」这半截可判。**【推断】** 即簇 37 在本机只剩「须真 ES / 真 PG」的两半截，没有第三件事。
- **簇 36**：本机判不了「周期触发本身」，因为**本仓无调度基建**（源码事实，非环境问题）；能判的是「业务逻辑已对、只差 cron」——这一点源码已钉死（`orphan-clean.ts` 纯函数 `planOrphanClean` + `cleanOrphans` 编排齐备）。

---

## C. 代码侧真实依赖形状（只读源码）

### C1. `apps/worker/src/ingest/es-http.ts`

`SPARSE_INDEX_PROPERTIES`（`es-http.ts:59-69`）逐字段类型：

| 字段 | 类型 | 行 |
|------|------|----|
| `chunkId` | `keyword` | `:60` |
| `tenantId` | `keyword` | `:61` |
| `kbId` | `keyword` | `:62` |
| `docId` | `keyword` | `:63` |
| `ownerDeptId` | `keyword` | `:64` |
| `aclPrincipals` | `keyword` | `:65` |
| `visibilityLevel` | `integer` | `:67` |
| `sparseText` | `text` | `:68` |

**有无显式 `analyzer`：无。** `sparseText` 只有 `{ type: 'text' }`（`:68`），整个 `SPARSE_INDEX_PROPERTIES` 无 `analyzer`/`search_analyzer`/`normalizer` 键。【推断】故落库时按 ES 默认 `standard` 分词（与 `docs/ops/operable-stack.md:16`「标准分词，未装 IK」一致）。

HTTP 路径与请求体：

- `ensureSparseIndex(cfg)`（`:130-158`）：
  - `HEAD /<index>`（`:133-137`）判存在。
  - 存在（`head.ok`）→ `putSparseAclMapping`（`:139`）。
  - `404` → `PUT /<index>`，体 `{mappings:{properties:SPARSE_INDEX_PROPERTIES}}`（`:146-153`）。
  - 非 404 head（`:141-143`）→ 抛错。
- `putSparseAclMapping`（`:106-128`）：`PUT /<index>/_mapping`，体 `{properties:{ownerDeptId:keyword, aclPrincipals:keyword, visibilityLevel:integer}}`（`:115-122`）——**只补这三个字段的类型**，不改已有字段。
- `bulkIndexSparse(cfg, docs)`（`:160-187`）：`POST /_bulk`，`Content-Type: application/x-ndjson`，体为每 doc 两行 `{index:{_index, _id: chunkId}}\n{source}\n`（`:168-176`）；`_id = chunkId`。
- `listIndexedChunkIds(cfg, docId, tenantId)`（`:194-232`）：`POST /<index>/_search`，体 `{size:10000, query:{bool:{filter:[{term:{tenantId}},{term:{docId}}]}}, _source:['chunkId']}`（`:206-210`）。

其他：`sparseBulkSource`（`:72-90`）的 `aclPrincipals` 语义 = `null` 不写字段、`[]` 写哨兵 `__acl_none__`（`:43-46` `ACL_PRINCIPALS_NONE_SENTINEL`）、非空写 uuid 列表；`requireTenantId`（`:49-57`）缺/空 `tenantId` 即抛。

### C2. `apps/api/src/services/retrieve/es-sparse.ts`

`SPARSE_INDEX_PROPERTIES`（`:60-70`）与 C1 完全相同（同样**无显式 analyzer**）。

**查询期 DSL 完整形状** —— `searchSparseEs(cfg, input)`（`:292-353`）请求体：

```
{
  size: <clamp(input.size,1,500)>,
  query: {
    bool: {
      filter: buildAclFilter(input),
      must: [{ match: { sparseText: input.question } }]
    }
  },
  _source: ['chunkId']
}
```
（`:309-319`）。打在哪些字段上，由 `buildAclFilter`（`:195-216`）决定：

1. 固定两个 `filter` 元素：`{term:{tenantId}}`（`:203`，值过 `requireTenantId`）、`{term:{kbId}}`（`:204`）。
2. 若 `input.maxVisibleLevel != null`（部门收窄生效三态信号）：追加
   - `ownerDeptFilterClause(ownerDeptIds)`（`:207`）——`bool.should = [{terms:{ownerDeptId:[...ids]}}(ids 非空时) , {bool:{must_not:{exists:{field:'ownerDeptId'}}}}]`，`minimum_should_match:1`（`:113-122`）。
   - `visibilityLevelFilterClause(maxVisibleLevel)`（`:208`）——`bool.should = [{range:{visibilityLevel:{lte:maxVisibleLevel}}} , {bool:{must_not:{exists:{field:'visibilityLevel'}}}}]`，`minimum_should_match:1`（`:170-180`）。
3. 否则若 `ownerDeptIds.length > 0`：追加裸 `{terms:{ownerDeptId: ownerDeptIds}}`（`:210`）。
4. 若 `input.applyAclPrincipals`：追加 `aclPrincipalsFilterClause(aclPrincipalUserId)`（`:212-214`，`:154-163`）——`bool.should = [{bool:{must_not:{exists:{field:'aclPrincipals'}}}} , (uid 非空时){term:{aclPrincipals: uid}}]`，`minimum_should_match:1`。

**`must` 只有一条**：`{match:{sparseText: question}}`（`:313`）——全文无其它 `term`/`match`/`should` 打在 `sparseText` 之外的字段上。

**`requireTenantId` 行为**（`:52-58`）：`tenantId` 为 `undefined`/`null`/`''`/纯空白 → 抛 `EsSparseError('missing tenantId in <where>; …', 'config')`；**不补默认租户、不静默少过滤**。`buildAclFilter:203` 与 `searchSparseEs` 经其过滤。

**有没有 `doc_type` / `docType`：没有。** `es-sparse.ts` 全文零命中该字段（`SPARSE_INDEX_PROPERTIES` 无、DSL 无、bulk source 无）。类型过滤不在此文件，而在装载层 `corpus.ts:44-47`。

### C3. `apps/api/src/services/retrieve/corpus.ts`（`loadCorpusFromDb`）过滤顺序

`loadCorpusFromDb`（`corpus.ts:56-123`）顺序：

1. `select * from documents where kbId = :kbId`（`:63`）。
2. `filterDocsForRetrieve(docs, scope)`（`:65`）——纯函数（`:38-50`）：`isDefaultRetrievable`（ready∧active 双闸）→ `isWithinEffectiveWindow`（生效窗口）→ `scope.docTypes` 命中（`:44-47`，即**类型滤**）。
3. 解析 KB 级 enforce：`parseDeptAclEnforceFromConfig` / `resolveDeptAclEnforce`（`:67-70`）+ `resolveDeptInheritDown`（`:73-76`）。
4. `loadVisibilityContext(...)`（`:72-77`）→ `filterVisibleDocs(dual, subject, ctx)`（`:79`）得到 `allowed`。
   - `filterVisibleDocs`（`visibility.ts:91-97`）逐文档走 `isDocVisible`（`visibility.ts:68-89`）：**先** `isDocVisibleForDeptAcl`（部门/级别/grant，顺序**部门在名单前**），不过 → `{ok:false, reason:'dept'}`；**再** `isDocVisibleForAclPrincipals`（名单），不过 → `reason:'principals'`。
   - 注意：`dept-acl.ts:189` 的 `filterDocsForDeptAcl` 与 `doc-acl.ts:21` 的 `filterDocsForAclPrincipals` 是**两个独立纯函数**；`loadCorpusFromDb` 本身**不直接调它们**，而是调 `filterVisibleDocs` 这个 wrapper（内部再调）。
   - `!enforce || subject.bypass` 时 `loadVisibilityContext` 短路为空 ctx、部门判定退化为放行，只剩名单闸（`visibility.ts:54-57`）。
5. `allowed` 为空 → 返回 `[]`（`:81`）。
6. 取 `chunks`（`inArray(chunks.docId, docIds)`，`:86`），再按 `indexVersion === doc.indexVersion ∧ kbId` 闸（`:88-93`）。
7. 取 `chunk_embeddings`（`:96-101`），仅 `embedding.indexVersion === doc.indexVersion ∧ emb.docId === doc.id` 才用（`:107-111`）。

即：**双闸（ready∧active）→ 生效窗口 → docTypes → 部门/可见级（先）→ aclPrincipals 名单（后）→ chunk 装载 → indexVersion 闸**。

### C4. `STORAGE_MODE=s3` 路径：桶创建与 presign/put 落点

- 桶创建：`apps/api/src/services/storage.ts`，类 `S3ObjectStorage.ensureReady()`（`:165-173`）——`await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))`（`:167`）；吞掉 `BucketAlreadyOwnedByYou` / `BucketAlreadyExists`（`:169-171`）。
  调用点：`putObject()` 开头 `await this.ensureReady()`（`:179-180`）——**首次 put 建桶**，无独立初始化容器（与 `docker-compose.yml:80-81` 注释一致）。
  注意：worker 侧 `apps/worker/src/ingest/object-store.ts` **只有** `GetObjectCommand`/`DeleteObjectCommand`（`:1-5`），**没有** `CreateBucketCommand`——worker 不建桶。
- presign/put：
  - **没有真 S3 presign**。`createUploadSlot()` → `uploadSlot()`（`storage.ts:46-55`）返回的 `uploadUrl` 是 **api 代理** `PUT /api/v1/internal/objects?key=<key>`（`:51-52`），前端不改、走 api 落盘（`storage.ts:50` 注释「本地：api 代理 PUT；s3 同样走代理」）。
  - 实际写入：`S3ObjectStorage.putObject()`（`:179-197`）→ `PutObjectCommand`（`:181-189`）。
  - 读 / head / 删：`headObject`（`:199-208`，`HeadObjectCommand`）、`getObjectBuffer`（`:210-219`，`GetObjectCommand`）、`deleteObject`（`:221-227`，`DeleteObjectCommand`）。
  - `getStorage()`（`:230-245`）：`STORAGE_MODE==='s3'` → `S3ObjectStorage`，否则 `LocalObjectStorage`。
  - `/ready` 的 S3 探活：`apps/api/src/ready/checks.ts:59-79`，`HeadBucketCommand`（`:71`），仅 `STORAGE_MODE==='s3' ∧ S3_ENDPOINT 非空` 才探（`:60`），否则 `skipped`。

### C5. Mongo 正文：`document_bodies` 的 upsert 落点（worker 侧）

文件 `apps/worker/src/ingest/mongo-body.ts`：

- 常量 `DOCUMENT_BODIES = 'document_bodies'`、`CHUNK_BODIES = 'chunk_bodies'`（`:3-4`）。
- **`document_bodies` upsert = `upsertDocumentBody()`（`:36-59`）**：`col.updateOne({docId}, {$set:{kbId, docId, text, updatedAt}}, {upsert:true})`（`:44-56`）；URL 空 → 返回 `local:<docId>` 回退（`:39-40`、`:9-11`）。
- `chunk_bodies` upsert = `upsertChunkBodies()`（`:74-110`）：逐行 `updateOne({chunkId}, {$set:{…}}, {upsert:true})`（`:86-102`）。
- 读回：`findDocumentBody()`（`:128-141`）；删除：`deleteBodiesForDoc()`（`:112-125`）；连通探测：`pingMongo()`（`:20-30`）。每调用短连（`:10` 注释）。

---

## 事实 / 推断分界速查

- **事实**：A1 表、A2「全仓无真跑原始输出」、A3 的 mock chat 非 JSON 链路（`resolve.ts:87-92` · `mock-client.ts:57-60` · `run.ts:381-386` · `parse.ts:2-11`）、A4「仓库无 Windows 记录」、B 各行出处与阻塞方、C1–C5 全部源码形状。
- **【推断】**：镜像体积量级；「本机无 key → smoke:half 不可绿」的因果链；「缺 analyzer → standard 分词」；簇 24/37 的真 ES 可判性边界；A2 中「P-HALF 目前无本机复现证据」的收束。
