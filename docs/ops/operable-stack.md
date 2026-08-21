# 可运行中间件栈（非生产级）

目标：Docker 里把 **PostgreSQL、Redis、Elasticsearch、Mongo、S3 兼容存储** 拉起来，入库和检索能互相打到这些服务。  
**不是** 真杀毒、**不是** IK 生产集群、**不是** 改仓库默认 mock（CI 仍走 mock）。

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
| rustfs（MinIO 占位） | 9000 / 9001 | 对象存储；首次 `STORAGE_MODE=s3` put 会建桶 `strict-rag` |

## 2. 打开可运行开关

复制 `.env.example` 为 `.env` 后，再把 **`.env.operable.example`** 整份追加进 `.env`（覆盖 mock 默认）。  
不要改 `apps/*/src/env.ts` 的 Zod 默认；CI 仍走 mock。

```bash
cp .env.example .env
cat .env.operable.example >> .env
```

追加后同一文件内后出现的键覆盖先前 mock 默认。样例含 http ES、S3、Mongo URL。扫描仍 `INGEST_SCAN_MODE=mock_clean`（development only）。**禁止** `on`。向量默认仍 `INGEST_EMBED_MODE=mock`（dims=8）；要真向量另配 Gateway。`AUTH_ENFORCE` 仍 false。

## 3. 业务进程

```bash
pnpm --filter @strict-rag/db exec drizzle-kit migrate   # 按仓库既有迁移命令
pnpm --filter @strict-rag/api dev
pnpm --filter @strict-rag/worker dev
```

`GET http://127.0.0.1:4000/ready` 期望：

- `postgres` / `redis` = `up`（硬依赖）
- `elasticsearch` / `s3` / `mongo` = `up`（配了 URL/s3 才会探测）

## 4. 链路

1. admin/api 上传 → api 代理 PUT 写入 MinIO  
2. worker parse 读 S3 → 正文 upsert Mongo → `mongoDocId` = 真 docId  
3. worker es_index bulk 到 ES（字段与检索 `es-sparse` 对齐）  
4. 运营把文档 `lifecycle` 升到 `active`（双就绪后仍是 **draft**，检索闸 `ready∧active`）  
5. ask 在 `RETRIEVE_ES_MODE=http` 下走 ES BM25，语料闸仍以 PG 为准  

## 5. 明确不是

- QUAL-2 真杀毒  
- ES IK / 多租户独立索引 / 部门 ACL 查询期对称  
- 仓库默认 `AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite  
- 生产 IdP、盘上加密五面全绿  
