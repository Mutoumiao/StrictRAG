# 裁定：ACL 收紧是否自动入队 reindex

Type: grilling
Status: resolved
Blocked by: 02, 03

## 问题

今天 `PUT /documents/:docId/acl` 收紧时只外显 `reindexRequired` + 打 `doc_acl_tightened` 日志（`apps/api/src/routes/documents/index.ts:911-928`），**不入队**；B2-2 的 Then（`prds/10-delivery/03-acceptance-scenarios.md:54`）要求「principal 变更 + **reindex 后**该文档对该用户不可检索」，ADR-009 `prds/11-decisions/00-adr-index.md:156` 写「ACL 收紧须 reindex 后确认（最终一致）」。

## Answer

**裁定：保持"人工触发"（不自动入队），并把口径写清：B2-2 的"不可检索"由 PG 闸**即时**成立；reindex 只负责让索引跟上，`reindexRequired` 是给运营的显式信号。**

### 1. 依据

1. **ADR-009 `:156` 的字面是"确认义务"，不是"自动触发"**：「ACL 收紧须 reindex 后确认（最终一致；敏感变更细节可另 P3b 补）」—— 它要求的是"最终一致"与"确认动作"，没有要求 API 在 PUT 内自动触发重入库。
2. **泄漏侧今天已经闭合，且不依赖 reindex**：PG 闸即时生效，ES 的旧命中经语料求交被丢弃（`apps/api/tests/acl/acl-tighten-index-lag.test.ts` 两例：`语料只剩可读块时，稀疏路返回的不可读 chunkId 被丢弃`；`滞后命中清空后语料为空 → 空库拒答 kb_not_ready，不得凭空 answered`）。也就是说"索引滞后"**不构成泄漏**，只构成"索引多存了些已不可读的块"。
3. **自动入队会引入本仓没有预算口径的新压力面**：一份大文档重复 PUT 收紧会反复入队（无幂等去重、无平面配额记账；`apps/api/src/obs/plane-quota.ts` 只覆盖 ask/ingest 每分钟请求）。加一条无预算、无幂等设计的自动写路径，属于"以完成度为名引入不可验证的负载"，与本仓"只加严、可核对"的纪律相悖。
4. **不选"自动"不放松任何闸**：收紧路径的外部契约（`reindexRequired` + 审计日志）逐字不变。

### 2. 若将来要自动（留给未来 ADR 的条件）

需同时满足：① `reindexRequired` 与自动入队的关系定义（是否仍外显）；② 同文档重复收紧的幂等（去重键 = docId + 收紧后的 principals 摘要）；③ 入队失败语义（是否 5xx，还是降级为"仅外显"）；④ 与 `plane-quota` 的 ingest 平面配额如何记账；⑤ 兼容既有人工 Reindex 按钮。四条缺一不可，本图不落。

### 3. B2-2 的成立口径（写进任务票 11 与回写）

| 剧本原文片段 | 本仓口径 | 证据 |
|---|---|---|
| 「principal 变更」 | `PUT /documents/:docId/acl` 改 uuid 名单（**角色 principal 未落**，见 `06` 第 5 节，属等价替换） | `apps/api/tests/acl/documents-acl-endpoint.test.ts`、`documents-acl-principals.test.ts` |
| 「reindex 后」 | 运营按 `reindexRequired` 触发 Reindex（**不自动**）；reindex 载荷与新 principals 一致由 worker 侧 `sparseBulkSource` 断言 | `apps/api/tests/ingest/reindex-version.test.ts`（入队载荷 `stage=chunk`）；`apps/worker/tests/ingest/es-http.test.ts` |
| 「该文档对该用户不可检索」 | **PG 闸即时成立**（不依赖 reindex）；索引滞后不构成泄漏 | `apps/api/tests/acl/acl-tighten-index-lag.test.ts` |

**未断言的一截**（必须真 ES，划出）：第 2 节表里"reindex 后 ES 索引侧旧 principals 被覆盖"这半截，本仓无法离线断言。

### 4. 连带：镜像陈旧项核实结论

`docs/module-status/api.md:93` 与 `docs/testing/coverage/02-acl.md:49` 把「缺『激活 version』表示」记为 B2-2 的前置。核实：`active_index_version` **已存在**（`packages/db/src/schema/kb/documents.ts:39`），由 worker 在 `es_index` 成功时与 `status=ready` 同一条 UPDATE 原子写（`apps/worker/src/ingest/pipeline.ts:983-986`，前图 L7 落地）。故该前置**已消除**，两处旧叙述须由任务票 `12` 按源码回写（**不带行号**写入 `docs/module-status`）。

### 5. 未验证

`apps/api/tests/acl/acl-tighten-index-lag.test.ts` 与 `reindex-version.test.ts` 的用例名由研究票 03 只读摘录，**未实跑**；任务票 11/12 收口时须实跑并以实跑为准。
