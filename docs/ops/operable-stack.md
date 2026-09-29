# 可运行中间件栈（非生产级）

目标：Docker 里把 **PostgreSQL、Redis、Elasticsearch、Mongo、S3 兼容存储** 拉起来，入库和检索能互相打到这些服务。  
**不是** 真杀毒、**不是** IK 生产集群、**不是** 改仓库默认 mock（CI 仍走 mock）。

> **本机真跑记录**（2026-09-29）：[real-stack-evidence.md](./real-stack-evidence.md) —— 五服务 healthy、真 PG 迁移 23/23 零漂移、端到端入库真跑通、真 ES 中文检索与 `aclPrincipals` 三态实测，以及 ask 段要一台真 Gateway 的边界。

## 1. 起中间件

```bash
docker compose -f docker/docker-compose.yml up -d
```

| 服务 | 端口 | 作用 |
|------|------|------|
| postgres | 5432 | 主库 + pgvector |
| redis | 6379 | 队列 |
| elasticsearch | 9200 | BM25 sparse（标准分词，未装 IK） |
| mongo | 27017 | parse 正文 |
| rustfs | 9000 / 9001 | 对象存储（官方 RustFS）；首次 `STORAGE_MODE=s3` put 会建桶 `strict-rag` |

## 2. 打开可运行开关

复制 `.env.example` 为 `.env` 后，再把 **`.env.operable.example`** 整份追加进 `.env`（覆盖 mock 默认）。  
不要改 `apps/*/src/env.ts` 的 Zod 默认；CI 仍走 mock。

```bash
cp .env.example .env
cat .env.operable.example >> .env
```

**全新库必须再配一个超管引导（否则 api 起不来）**：`apps/api/src/index.ts:20` 在 `serve()` **之前**无条件跑超管引导，库里没有 active 超管时缺 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 会直接 `process.exit(1)`（`services/superadmin-bootstrap.ts`）。`.env.example` 里这两行是**注释掉的**，追加以下内容进同一个 `.env`：

```bash
# 仅在库里还没有 active 超管时需要；已有超管后这段可留可删
SUPER_ADMIN_EMAIL=admin@local.dev
SUPER_ADMIN_PASSWORD=<自定，勿用示例值>
```

已有超管的环境**不需要**这两行。`development` 下另可用 `POST /api/v1/auth/admin/dev-login` 造主体，但那要求 api **已经在跑**，绕不过首次引导。

追加后同一文件内后出现的键覆盖先前 mock 默认。样例含 http ES、S3、Mongo URL。扫描仍 `INGEST_SCAN_MODE=mock_clean`（development only）。**禁止** `on`。向量默认仍 `INGEST_EMBED_MODE=mock`（dims=8）；要真向量另配 Gateway。`AUTH_ENFORCE` 仍 false。

## 3. 业务进程

```bash
pnpm db:migrate
pnpm up:apps
```

### 评测语料入库 + 映射账本（工单 03 / 04）

把两份评测语料（`fixtures/ingest-samples/*.txt` 与 `fixtures/l2/corpus/*.txt`）送入某个 KB，并产出
「逻辑 id → documents.id」映射账本（`artifacts/eval-corpus-ledger-<kbId>.json`，运行产物不入库）：

```bash
# 新建 KB（或 INGEST_KB_ID=<kb-uuid> 复用既有）；打印 kbId 与账本路径
INGEST_KB_NAME=eval-corpus-kb pnpm --filter @strict-rag/api exec tsx src/scripts/ingest-eval-corpus.ts

# 跑 L1 / L2 时按账本把逻辑 id 解析为 uuid（不传 = 与今天逐位一致）
L1_KB_ID=<kbId> L1_DOC_MAP=artifacts/eval-corpus-ledger-<kbId>.json \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
L2_KB_ID=<kbId> L2_DOC_MAP=artifacts/eval-corpus-ledger-<kbId>.json \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
```

账本 `kbId` / `corpusFingerprint` 与本次 KB / 当前夹具不符即拒跑（exit 2）。缺映射**继续算 miss**，绝不变成「该门不适用」。`retrieve_mode` 仍以 env 为准；mock 数字禁止写入签字页。

`pnpm up:apps` = compose 中间件（若未起）+ api + worker，不必手拼四进程。仅中间件：`node scripts/up-stack.mjs --compose-only`。

Mongo 冒烟（须 `MONGODB_URL`）：

```bash
MONGODB_URL=mongodb://127.0.0.1:27017/strict_rag pnpm --filter @strict-rag/worker smoke:mongo
```

端到端烟测（txt→ask 有引用，闸仍 ready∧active；扫描/ES 可 mock）：

```bash
pnpm smoke:half
```

清单：[half-smoke.md](./half-smoke.md)。引用判定单测：`node --test scripts/smoke-ask.test.mjs`。

试点打开 `AUTH_ENFORCE`（**不**改仓库默认）：[auth-enforce-pilot.md](./auth-enforce-pilot.md)。

`GET http://127.0.0.1:4000/ready` 期望：

- `postgres` / `redis` = `up`（硬依赖）
- `elasticsearch` / `mongo` = `up`（配了 URL 才会探测）
- `s3` = `up` **仅在桶已存在之后**：桶由**首次 `putObject`** 时创建（`apps/api/src/services/storage.ts` 的 `ensureReady`），故新起的 RustFS 上、第一次上传之前它恒为 `down`；这不是故障
- `gateway` = `skipped`（未配 `GATEWAY_BASE_URL`）

## 4. 链路

1. admin/api 上传 → api 代理 PUT 写入 RustFS  
2. worker parse 读 S3 → 正文 upsert Mongo → `mongoDocId` = 真 docId  
3. worker es_index bulk 到 ES（字段与检索 `es-sparse` 对齐）  
4. 运营把文档 `lifecycle` 升到 `active`（双就绪后仍是 **draft**，检索闸 `ready∧active`）  
5. ask 在 `RETRIEVE_ES_MODE=http` 下走 ES BM25，语料闸仍以 PG 为准  

## 5. 明确不是

- QUAL-2 真杀毒  
- ES IK / 多租户独立索引 / aclPrincipals 全文 / 仓库默认开 `DEPT_ACL_ENFORCE`  
- 仓库默认 `AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite  
- 生产 IdP、盘上加密五面全绿  
