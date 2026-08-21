# worker · 入库能力矩阵与写面职责（X-05 · X-14）

> **WHAT**：`prds/04-pipelines/01-offline-ingest.md` · `prds/03-data` · `prds/06-async`  
> **HOW**：本文对照 **源码 IS**，标明 done / stub / deferred，避免 HOW 假画生产链路。  
> **实现入口**：`apps/worker/src/ingest/pipeline.ts` · `es-store.ts` · `env.ts`

---

## 1. 阶段能力矩阵（X-05）

| 逻辑 stage | 状态 | 源码锚点 | 行为摘要 | 明确未做 |
|------------|:----:|----------|----------|----------|
| **scan** | **stub** | `pipeline` `case 'scan'` · `scan-mode-policy` | mock_clean / mock_infected / off；`on` 拒 | 真 ClamAV（QUAL-2） |
| **parse** | **stub** | `loadObjectText` + 字数闸 | 本地目录读 UTF-8 文本；不足 → `needs_ocr`；有 `MONGODB_URL` 写 `document_bodies`（`upsertDocumentBody`） | OCR · 复杂版式 |
| **chunk** | **done\*** | `splitByChunkStrategy` · manifests | 仅 `structure_paragraph`；幂等 resume（X-04-impl） | 多策略切分器；结构感知进阶 |
| **embed** | **stub** | `INGEST_EMBED_MODE` mock\|fail | 伪向量 dims=8；同 version skip 已有行 | 真 embedding 网关 |
| **es_index** | **stub** | `mockEsStore` · `INGEST_ES_MODE` | 进程内 Map 对账；无 live 枚举 | 真 ES+IK bulk（B8） |
| **activate / lifecycle** | **partial** | dual-ready → `status=ready` · `lifecycle=draft` | **不**自动 active；检索第二闸在 api | 运营 activate API 全流程（产品侧） |
| **ingest_jobs 账本** | **partial** | schema + `job-ledger.ts` | stage 边界写 running→succeeded/failed；无 api 写 / 无查询面 | 运维查询 · 入队侧 queued |
| **同 doc 并发锁** | **partial** | `doc-lock.ts` · `index.ts` | Redis SET NX EX + token 释放；`DOC_LOCK_BUSY` 可重试 | Redlock / 多 master / 锁运维面 |
| **物理多队列** | **deferred** | 单 `sr-ingest` + `stage` | 逻辑 stage 折叠 | 见 §1.1 · ADR-060 |

\* **done\*** = 当前策略范围内可跑通 + 测覆盖；**≠** 生产分片质量上限。

### 1.1 物理队列 vs 逻辑 stage（X-20 · ADR-060 · DEC-X3）

| 层 | 名称 / 字段 | 今日 IS | 目标（未做） |
|----|-------------|---------|--------------|
| **物理队列** | BullMQ `sr-ingest`（`QUEUE_NAMES.ingest`） | **唯一**入库队列 | 可选拆 `ingest.scan` 等独立队列 |
| **逻辑 stage** | job payload `stage`：`scan`→`parse`→`chunk`→`embed`→`es_index` | 单队列内状态机折叠 | 与物理队列 1:1 时再 ADR |
| **探针** | `sr-probe` | 与入库隔离 | — |

| 规则 | 说明 |
|------|------|
| **Interim 焊死** | PRD 文案若写 `ingest.scan` 等逻辑名，映射到 **`sr-ingest` + `stage=scan`**，**不是**第二物理队列已上线 |
| **禁止** | 文档写「已接多队列」而代码只有 `sr-ingest` |
| **演进** | 拆物理队列须 **ADR-060 修订** + contracts `QUEUE_NAMES` + 迁移 runbook；P2 产品签字前若仍 interim，验收以本表为准 |

```text
api.enqueue({ docId, stage: 'scan', indexVersion? })
  → Redis queue "sr-ingest"
  → worker pipeline switch(stage) …
```

### 文档状态码 → 用户可见 `documents.status`（摘）

| 阶段成功推进 | 典型 status | 失败 errorCode 例 |
|--------------|-------------|-------------------|
| 入队后 scan | `scanning` | `NOT_APPROVED` · `MALWARE` · `SCAN_ENGINE_UNAVAILABLE` |
| parse | `parsing` → 有文本 | `NO_TEXT_LAYER`（`needs_ocr`） |
| chunk | `chunking` | `UNSUPPORTED_CHUNK_STRATEGY` · `EMPTY_CHUNKS` · `NO_MANIFEST` |
| embed | `embedding` | `EMBED_FAILED` · `NO_MANIFEST` |
| es | `indexing_es` | `ES_INDEX_FAILED` · `ES_RECONCILE_FAILED` · `EMBED_NOT_READY` |
| 双就绪 | **`ready`** · lifecycle 仍 **draft** | — |

### 与 PRD 能力对照（诚实）

| PRD 能力（摘要） | 本仓 | 说明 |
|------------------|:----:|------|
| 审批后扫描 | stub | mock；fail-closed 启动闸已焊 |
| 解析 + OCR | partial | 仅纯文本层；OCR deferred |
| 冻结 manifest | **done** | `chunk_manifests.frozen` |
| 稠密向量 | stub | mock 向量 |
| 稀疏 ES | stub | 进程内 mock；worker **无** `INGEST_ES_MODE=live` |
| 双就绪才 ready | **done** | embedReady ∧ esReady |
| 幂等重试 | **partial** | X-04-impl 最小 + 账本最小写 + 同 doc SET NX 锁最小；非 Redlock |

---

## 2. 写面职责表（X-14）

| 存储 | 谁写 | 谁读 | 今日实现 | mock / 真 |
|------|------|------|----------|-----------|
| **PG `documents`** | api（上传/审批/元数据）· **worker**（状态机字段） | api 检索闸 / 列表 | Drizzle `@strict-rag/db` | **真 PG**（联调依赖） |
| **PG `chunks` / `chunk_manifests` / `chunk_embeddings`** | **worker** 入库 | api retrieve / chunks 只读 | 同上 | **真 PG** |
| **PG `ingest_jobs`** | **worker** `job-ledger` | 运维（尚无 HTTP） | stage 边界最小写 | PG 真表；查询面仍欠 |
| **本地对象 / S3 位** | api 上传写文件 | worker `loadObjectText` | `STORAGE_LOCAL_DIR` + `S3_BUCKET` 路径拼接 | **本地目录**；非真 RustFS |
| **Mongo 正文** | （目标 parse） | （目标） | 仅写 `mongoDocId=local:{docId}` 标记 | **无**真 Mongo 客户端 |
| **ES 稀疏索引** | **worker** `es_index` | api `RETRIEVE_ES_MODE=http`（可选） | worker：`mockEsStore`；api 侧另有 ES 客户端切片 | worker **仅 mock\|fail** |
| **Redis 队列 + doc 锁** | api 入队 · worker 持锁 | worker BullMQ / `doc-lock` | `sr-ingest` · `sr:ingest:doc-lock:{docId}` | **真 Redis**；锁=最小 SET NX |
| **向量生产服务** | worker embed | retrieve dense | mock float[] | **stub** |

### 禁止串写

| 禁项 | 原因 |
|------|------|
| api route 内 insert chunks/embeddings | 入库写面在 worker |
| worker 暴露业务 HTTP 写库旁路 | 无对外业务 API |
| worker 与 api 各用不同 `STORAGE_LOCAL_DIR` 锚 | parse 0 字假 `needs_ocr` |
| 把 mock ES 对账成功写成「生产 ES 已上」 | IS 与 B8 边界 |

### 读写时序（单 doc 首跑）

```text
api: upload → object on local/S3-path
api: approve → enqueue stage=scan
worker: scan → parse(read object) → chunk(write PG chunks+manifest)
     → embed(write PG embeddings) → es_index(write mock ES)
     → documents.status=ready, lifecycle=draft
api: activate(lifecycle) → retrieve 双闸可见
```

---

## 3. Wrong vs Correct

```text
// Wrong — HOW 写「parse 已接 Mongo / es 已接生产 IK」
// Wrong — api 同步切块写 chunks 绕过 worker
// Correct — 矩阵标 stub；扩能力改本表 + module-status
// Correct — 真 ES：worker live 模式 + api RETRIEVE http 分 task（B8）
```

---

## 4. 交叉引用

- 幂等：[ingest-idempotency](./ingest-idempotency.md)  
- 扫描/策略：[quality-guidelines](./quality-guidelines.md)  
- 目录：[directory-structure](./directory-structure.md)  
- IS：`docs/module-status/worker.md` · `api.md`  
- 挂账：X-05 · X-14 · `08-12-spec-w2-ingest-matrix-ownership`
