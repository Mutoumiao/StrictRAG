# @strict-rag/worker · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/worker` |
| 端口 | 无 HTTP 端口 |
| 成熟度 | **可联调**（P1 入库状态机；在 mock 依赖栈下可随垂直切片演示） |
| 默认依赖模式 | 扫描 = `mock_clean` · 向量 = `mock` · ES 索引 = `mock`（枚举仅 `mock\|fail`，**没有 live 模式**）· 对象存储 = 本地目录 |
| 关联模块 | 由 `api` 入队触发；写库走 `@strict-rag/db`；队列名来自 `@strict-rag/contracts`；运行需要 Redis + PostgreSQL |
| 最近更新 | 2026-08-06 |
| Spec | `.trellis/spec/worker/backend/` |
| PRD | `prds/06-async` · `prds/04-pipelines/01-offline-ingest.md` |

## 一句话状态

BullMQ 消费者：probe 探针 + 入库五阶段状态机已跑通；但**扫描 / 向量 / ES 默认均为 mock**，对象读取自本地目录，**不是**生产级入库链路。

---

## 已具备能力

### 进程与队列
- Worker 进程可以正常启动；队列名统一来自 `@strict-rag/contracts`
- `probe`（noop 空操作）联调探针
- `ingest` 入库任务按阶段拆分：`scan → parse → chunk → embed → es_index`

### 入库流水线
- 审批未通过则阻断入库并将任务标记为 `failed`（ADR-048 口径）
- 段落级分块（structure_paragraph 的最低实现）
- 写 PostgreSQL：`documents` / chunks / embeddings / manifest（经 `@strict-rag/db`）
- 扫描：默认 `mock_clean`；`mock_infected` 可模拟失败并删除对象；枚举中虽含 `on`，但**当前与 mock_clean 走同一路径，并非真实扫描**
- 向量 mock（`INGEST_EMBED_MODE=mock|fail`，默认 mock；伪向量维度 dims=8）
- mock ES 写入适配（进程内 Map 实现的 `es-store`；`INGEST_ES_MODE=mock|fail`，**没有 http / live 模式**）

### 基础设施
- 环境变量校验、Pino 日志、与 api 共用 DB 包
- DB：`statementTimeoutMs=0`（入库耗时长，不设语句超时；ARCH-P0-4）
- 优雅停机：Worker / Queue / Redis / DB 分阶段关闭；重复信号幂等处理

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 真实杀毒 / 生产级扫描 | 默认 mock；不是真实扫描 |
| 真实 embedding 服务 | 默认 `INGEST_EMBED_MODE=mock`；向量**不是**生产模型产出 |
| 真实 ES + IK 分词索引 | 枚举仅 `mock\|fail`，**尚无 live 开关**（比 api 侧 `RETRIEVE_ES_MODE=http` 更"假"）；backlog B8 |
| 真实 RustFS / Mongo 正文存储 | 目前从本地目录读对象；见 B9 |
| OCR / 复杂版式解析 | 未做；只实现了面向纯文本的最低限度 parse |
| HTTP API | **禁止**在 worker 暴露业务 HTTP 接口 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| mock 扫描 + mock 向量 + mock ES | 入库"闭环可演示 ≠ 生产可信"；向量侧与稀疏检索侧都可能是假数据 | 与 api 检索 mock 同源的问题族 |
| 入库 ES 无 live 枚举 | 切真实索引需要改环境变量 / 代码并做专项验收 | 不要与 api 的 `RETRIEVE_ES_MODE=http` 混为一谈 |
| 分块策略极简 | 检索质量上限低 | 后续可替换策略，但不要静默放宽门禁 |
| 失败重试 / 死信 | 只有 BullMQ 的失败保留与日志；没有业务级的 attempts / 死信队列面板 | 对照 PRD 异步章节 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 / 队列 | `apps/worker/src/index.ts` · `apps/worker/src/queues.ts` |
| 流水线 | `apps/worker/src/ingest/pipeline.ts` · `apps/worker/src/ingest/es-store.ts` |
| 环境变量默认值 | `apps/worker/src/env.ts`（`INGEST_SCAN_MODE` · `INGEST_EMBED_MODE` · `INGEST_ES_MODE`） |
| 单测 | `pipeline.test.ts`（分块 / mock ES / 双就绪闸门）· `queues.test.ts`（队列名）—— **不是**入库 E2E |
| Task | 已归档 `08-04-p1-*` · `08-04-phase-1-ingest` |
| 队列契约 | `packages/contracts` 的 async queues |
