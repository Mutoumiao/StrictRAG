# @strict-rag/worker · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/worker` |
| 端口 | 无 HTTP |
| 成熟度 | **可联调**（P1 入库状态机；mock 栈下可随垂直切片演示） |
| 默认依赖模式 | scan=`mock_clean` · embed=`mock` · ES 索引=`mock`（仅 `mock\|fail`，**无 live**）· storage=本地目录 |
| 关联模块 | 由 `api` 入队；写 `@strict-rag/db`；队列名 `@strict-rag/contracts`；需 Redis + PG |
| 最近更新 | 2026-08-06 |
| Spec | `.trellis/spec/worker/backend/` |
| PRD | `prds/06-async` · `prds/04-pipelines/01-offline-ingest.md` |

## 一句话

BullMQ 消费者：probe 探针 + 入库五阶段状态机已通；**scan / embed / ES 默认均为 mock**，本地读对象存储，**不是**生产入库链路。

---

## 已具备能力

### 进程与队列
- Worker 进程可起；共享队列名来自 `@strict-rag/contracts`
- `probe`（noop）联调探针
- `ingest` 分阶段 job：`scan → parse → chunk → embed → es_index`

### 入库流水线
- 审批未通过则阻断并 `failed`（ADR-048 口径）
- 段落级分块（structure_paragraph 最低实现）
- 写 PG：`documents` / chunks / embeddings / manifest（经 `@strict-rag/db`）
- scan：默认 `mock_clean`；`mock_infected` 可失败删对象；枚举含 `on` 但**当前与 mock_clean 同路径，非实扫**
- embed mock（`INGEST_EMBED_MODE=mock|fail`，默认 mock；伪向量 dims=8）
- mock ES 写入适配（进程内 Map `es-store`；`INGEST_ES_MODE=mock|fail`，**无 http/live**）

### 基础设施
- env 校验 · Pino · 与 api 共用 DB 包
- DB：`statementTimeoutMs=0`（长入库；ARCH-P0-4）
- shutdown：Worker/Queue/Redis/DB 分阶段关闭 · 重复信号幂等

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 真杀毒 / 生产 scan | 默认 mock；非实扫 |
| 真 embedding 服务 | 默认 `INGEST_EMBED_MODE=mock`；向量 **非** 生产模型产出 |
| 真 ES+IK 索引 | 仅 `mock\|fail`，**尚无 live 开关**（比 api 侧 `RETRIEVE_ES_MODE=http` 更「假」）；backlog B8 |
| 真 RustFS / Mongo body | 本地目录读对象；B9 |
| OCR / 复杂版式解析 | 未做；文本向最低 parse |
| HTTP API | **禁止**在 worker 暴露业务 HTTP |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| mock scan + mock embed + mock ES | 入库「闭环可演示 ≠ 生产可信」；向量与稀疏侧均可假 | 与 api 检索 mock 同源问题族 |
| 入库 ES 无 live 枚举 | 切真索引需改 env/代码并专项验收 | 勿与 api `RETRIEVE_ES_MODE=http` 混谈 |
| 分块策略极简 | 质量上限低 | 后续可换策略，勿静默放宽门禁 |
| 失败重试/死信 | 仅 BullMQ 失败保留与日志；无业务级 attempts/DLQ 面板 | 对照 PRD 异步章 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 / 队列 | `apps/worker/src/index.ts` · `apps/worker/src/queues.ts` |
| 流水线 | `apps/worker/src/ingest/pipeline.ts` · `apps/worker/src/ingest/es-store.ts` |
| env 默认 | `apps/worker/src/env.ts`（`INGEST_SCAN_MODE` · `INGEST_EMBED_MODE` · `INGEST_ES_MODE`） |
| 单测 | `pipeline.test.ts`（分块/mock ES/双就绪闸）· `queues.test.ts`（队列名）— **非**入库 E2E |
| Task | archive `08-04-p1-*` · `08-04-phase-1-ingest` |
| 队列契约 | `packages/contracts` async queues |
