# @strict-rag/worker · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：入库状态机与扫描闸。入队 HTTP 在 api。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与验收剧本。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ingest/` | 扫描→解析→分片→向量→稀疏索引 | `prds/04-pipelines/01-offline-ingest.md` |
| `env/` | 启动闸、可运行环境 | X-01/X-02 · DEC-SCAN |

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 待处理

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/env.test.ts` | worker env 校验 | env 契约 | 非法组合失败 | 待处理 |
| `../src/operable-env.test.ts` | 可运行依赖组合 | OPS-STACK | 与 docker 骨架对齐 | 待处理 |
| `../src/queues.test.ts` | 队列名常量 | `prds/06-async` | 含 probe 队列 | 待处理 |
| `../src/scan-mode-policy.test.ts` | 扫描模式启动矩阵 | X-01/X-02 | `on` 未接引擎须启动失败 | 待处理 |
| `../src/ingest/pipeline.test.ts` | 分片策略执行与未实现 loud fail | X-03 · B12 | 未实现策略不得静默段落切 | 待处理 |
| `../src/ingest/pdf-text.test.ts` | PDF 抽文本 | parse 阶段 | 本地 fixture | 待处理 |
| `../src/ingest/extract-text.test.ts` | 通用抽文本 | parse 阶段 | | 待处理 |
| `../src/ingest/object-store.test.ts` | 对象存储适配 | STORAGE | 默认 mock | 待处理 |
| `../src/ingest/mongo-body.test.ts` | body 落 Mongo | `prds/03-data` | 默认 mock | 待处理 |
| `../src/ingest/job-ledger.test.ts` | ingest_jobs 阶段账本 | X-04 | 最小账本 | 待处理 |
| `../src/ingest/idempotency.test.ts` | 重试不重分块 | X-04 | payload indexVersion | 待处理 |
| `../src/ingest/doc-lock.test.ts` | 同文档互斥锁 | X-04 | Redis SET NX，非 Redlock | 待处理 |
| `../src/ingest/embed-http.test.ts` | 向量 HTTP 客户端 | Gateway embed | mock/http 切片 | 待处理 |
| `../src/ingest/es-http.test.ts` | 稀疏索引 HTTP | OPS-1 | 默认 mock | 待处理 |
| `../src/ingest/bull-outcome.test.ts` | Bull 任务结果映射 | 队列失败可观测 | | 待处理 |
