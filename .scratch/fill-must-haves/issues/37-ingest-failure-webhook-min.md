# 失败 Webhook 最小闭环

Type: task
Label: wayfinder:task
Status: claimed
Assignee: grok
Triage: ready-for-agent
Blocked by: 36

## Question

补入库失败 Webhook 最小闭环。这是剩余 P2 半接线里本批唯一一张执行工单。全仓无业务 webhook。

权威：[裁定三平面配额最小闭环后下一步](./36-after-quota-planes-order.md)；功能表 §10.3 失败 Webhook。管道失败已写 `ingest_jobs` 账本与文档 `status=failed`，只缺对外告警契约。

### 做

- env `INGEST_FAILURE_WEBHOOK_URL` 可选字符串，默认空。空 = 不发。Zod 在 worker。`.env.example` 写空注释，不要填真实 URL。
- 抽可单测函数（建议 `apps/worker/src/ingest/failure-webhook.ts`）：URL 空则 return；否则 `POST` JSON，`Content-Type: application/json`，超时短（如 3s），只试一次。HTTP 非 2xx 或网络错：warn 日志，**不抛**。
- 载荷字段：`event: 'ingest.failed'`、`tenantId`、`kbId`、`docId`、`stage`、`errorCode`、`at`（本地时间串）。可选 `jobId`。禁止 body 全文、禁止密钥、禁止对象存储路径。
- **触发**：入库阶段账本结束为 failed 时发一次（`recordStageEnd` 在 `errorCode` 存在时）。同一阶段不要在 pipeline 里再发一遍。
- 注入 fetch / 时钟，便于单测。
- 测例（worker）：
  - URL 空：不 fetch
  - 失败阶段：fetch 一次，断言 method/url/JSON 字段
  - fetch 抛错 / 非 2xx：不抛给调用方
  - 载荷无密钥键、无正文

### 不做

- HMAC 签名 / 重试队列 / 死信
- admin 配置页 / KB 级 webhook URL
- ask 拒答 / 限流 / 评测失败 webhook
- 阻断入库状态机
- 三平面配额返工 / 在线编写
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构
- 浏览器 E2E

收工：更新 `.trellis/spec/worker/` 与 `docs/module-status/worker.md`；coverage 若有对应行则回写。`.trellis/tasks/` 若无则跳过。禁止 `task.py create`。禁止 push。

写代码前读 `.trellis/spec/worker/backend/` 与 HOW `.trellis/spec/guides/testing.md`。测例落 `apps/worker/tests/ingest/`，文件头目标/简介简体中文，登记 index。

## Comments

- 2026-09-07 认领并执行。权威切边见 [裁定三平面配额最小闭环后下一步](./36-after-quota-planes-order.md)。
