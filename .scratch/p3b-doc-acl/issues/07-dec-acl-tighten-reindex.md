# 裁定：ACL 收紧是否自动入队 reindex

Type: grilling
Status: open
Blocked by: 02, 03

## 问题

今天 `PUT /documents/:docId/acl` 收紧时只外显 `reindexRequired` + 打 `doc_acl_tightened` 日志（`apps/api/src/routes/documents/index.ts:911-928`），**不入队**；B2-2 的 Then（`prds/10-delivery/03-acceptance-scenarios.md:54`）要求「principal 变更 + **reindex 后**该文档对该用户不可检索」，ADR-009 `:156` 写「ACL 收紧须 reindex 后确认（最终一致）」。

要裁定：

1. **自动还是人工**：收紧后自动 `enqueueIngest(reindex)`，还是保持「只外显 + 人工触发」。判据要引 PRD 原文（含 ADR-009 `:156`「最终一致」、ADR-046 加严语义）；若取人工，写清 B2-2 的 Then 如何在**不自动 reindex** 的前提下仍然成立（例如「PG 闸即时生效 + ES 旧命中不构成泄漏」已由 `apps/api/tests/acl/acl-tighten-index-lag.test.ts` 覆盖 → 该 Then 的口径是「不可检索」而非「索引已删」）。
2. **若自动**：幂等（同一文档重复收紧）、与 `reindexRequired` 外显的关系、预算 / 队列压力（是否受平面配额 `apps/api/src/obs/plane-quota.ts` 约束）、失败语义（入队失败是否 5xx）。
3. **落点**：入队函数（沿用既有 `enqueueIngest` 调用点先例，如 `apps/api/tests/ingest/approval-scan.test.ts` 形态的 mock 队列断言）。
4. **连带**：镜像陈旧项核实 —— `docs/module-status/api.md:93` 与 `docs/testing/coverage/02-acl.md:49` 把「缺『激活 version』表示」记为前置，而 `active_index_version` 已落地（`packages/db/src/schema/kb/documents.ts:39`、`apps/worker/src/ingest/pipeline.ts:983-986`）。核实后回写。

## 约束

- 只加严不放宽；不改仓库默认开关；不改 `prds/00–11`。

## Answer

（待填）
