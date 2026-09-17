# 文档 ACL 收紧的索引一致性最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 103

## 目标

功能表 §5.5 逐字：`| 文档 ACL | aclPrincipals 进索引；dense 与 ES 对称 filter；[] = 不可读；**收紧须 reindex** | P3b |`
同义冻结条款：ADR-009 决策 4「ACL 收紧须 reindex 后确认（最终一致；敏感变更细节可另 P3b 补）」· ES PRD §4.3「ACL 收紧变更：**最终一致**；须 reindex 受影响文档后才确认对新 principals 生效」。
`docs/testing/coverage/02-acl.md` 的 **B2-2 行标「延后」，理由逐字：「reindex-on-change 未做」**。

本工单要**先把事实钉死再动手**：`aclPrincipals` 是**索引字段**（worker `es_index` 写 ES），所以收紧后 ES 侧仍持旧值 → 稀疏路可能返回该用户已不可读的块；但 `apps/api/src/services/retrieve/retrieve.ts` 在稀疏命中后**只保留 PG 语料内 id**（`sparseRanked.filter((id) => byId.has(id))`，注释「仅保留语料内 id（status/lifecycle/indexVersion 闸门以 PG corpus 为准）」），而 PG 语料由 `loadCorpusFromDb` 叠 `filterDocsForAclPrincipals`。**故这是索引与现值不一致（召回被稀释），不是安全洞。**

## 实现

1. 契约：`packages/contracts/src/ingest/document.contract.ts` 加纯函数 `aclTightens(prev, next)`（「新集合不再是旧集合的超集」= 有人失去可读性；`null` 视作全员可读，`[]` 视作无人可读），加 PUT 专用 `PutDocumentAclResponseSchema = DocumentAclSchema + reindexRequired: boolean`。GET 形状不变（收紧信号只在写入那一刻有意义）。
2. api `PUT /documents/:docId/acl`：写入后回读时比较旧值 → 返回 `reindexRequired`；收紧时写一条 `event: 'doc_acl_tightened'` 的 info 日志。**不**自动入队 reindex（见「不做」）。
3. 测例：
   - contracts：`aclTightens` 真值表（null→[]、null→[a]、[a,b]→[b]、[a]→[] 收紧；[]→null、[a]→[a,b]、相同值不收紧；[a]→[b] 视为收紧）。
   - api `tests/acl/documents-acl-endpoint.test.ts`：PUT 三态的 `reindexRequired` 断言 + 收紧日志不该出现在放宽路径。
   - api 新 `tests/acl/acl-tighten-index-lag.test.ts`：**无泄漏夹具** —— 注入「ES 仍返回收紧前该块的 chunkId」（模拟索引滞后）+ PG 语料已不含该文档 → `runRetrieve` 不得把该块带进 evidence（B2-2 的「PG 闸即时」侧 + B2-3 的「单路也过 ACL」构造）。

## 不做

- **不自动入队 reindex**：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败会把它指向失败版本而上一个可检索版本数据仍在（与孤儿清理同一前置：缺「当前激活 version」表示）。在 ACL 元数据改动上自动触发会重跑 parse/chunk/embed 全链、并可能把健康文档带进半套状态。本工单只做**如实外显 + 证明不带泄漏**。
- 不开 `DEPT_ACL_ENFORCE`、不加角色 principal、不改 `filterDocsForAclPrincipals` / `filterDocsForDeptAcl` 判定、不改 ES filter 生成器语义、不做 ES `_update_by_query`、不做 admin 编辑面。

## Answer

**已齐（最小）**：只做「如实外显收紧 + 证明索引滞后不带泄漏」，**不**做自动 reindex。

- **契约**（`packages/contracts/src/ingest/document.contract.ts`）：纯函数 `aclTightens(prev, next)`（新集合不再是旧集合的超集 = 有人失去可读性；`null`=全员可读 / `[]`=无人；`[a]→[b]` 亦算收紧）+ `PutDocumentAclResponseSchema`（GET 形 + `reindexRequired`）。GET 形状**不变**（该信号只在写入那一刻有意义）。
- **路由**（`PUT /documents/:docId/acl`）：写入前比较旧值 → 返回 `reindexRequired`；收紧时写 `event: 'doc_acl_tightened'` info 日志（含 `indexVersion`）。
- **为什么不自动入队 reindex**：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败会把它指向失败版本而上一个可检索版本数据仍在（与孤儿清理同一前置：缺「当前激活 version」表示）；在 ACL 元数据改动上自动重跑 parse/chunk/embed 全链会把健康文档带进半套状态。故本票只外显 + 证明。
- **「不是安全洞」的证据**（可核对）：`retrieve.ts` 稀疏命中后**只保留 PG 语料内 id**（`sparseRanked.filter((id) => byId.has(id))`），而语料一律过 `filterDocsForAclPrincipals` —— 滞后命中被丢弃，影响只是召回被稀释。
- **测例**：contracts `tests/ingest/document-contract.test.ts`（`aclTightens` 真值表 + PUT 响应缺 `reindexRequired` 拒）· api `tests/acl/documents-acl-endpoint.test.ts`（收紧 true / 放宽 false 七种转移）· 新 `apps/api/tests/acl/acl-tighten-index-lag.test.ts`（ES 仍返回收紧前的 chunkId + 语料只剩可读块 → 旧命中不进 evidence；语料被清空 → `kb_not_ready`，不凭空 answered）。
- **台账**：`docs/testing/coverage/02-acl.md` 的 **B2-2 / B2-3 由「延后」转「部分测」**（覆盖表计数随之 37→39 / 4→2，总数仍 69），并把剩余项写清（角色码 principal、自动 reindex、dense 反向构造）。
- **门禁**：`pnpm test` **11/11** · `pnpm check-types` **8/8** · `pnpm lint` **8/8 零 warning**。
- **未做**：不开 `DEPT_ACL_ENFORCE`、不加角色 principal、不改 PG/ES 两侧判定函数、不做 ES `_update_by_query`、不做 admin 编辑面、不做自动 reindex。
