# 落 ACL 收紧的索引一致性

Type: task
Status: resolved
Blocked by: 07

## 做什么

按 `07-dec-acl-tighten-reindex.md` 的裁定落地（自动入队或明确人工口径 + 文档化），并把镜像陈旧项（`docs/module-status/api.md`、`docs/testing/coverage/02-acl.md` 里关于「缺激活 version 表示」的旧叙述）按源码核实回写。

## 完成判据

- 裁定所选路径有可核对证据（入队则 mock 队列断言恰好一次；人工则口径写进 spec 与镜像）。
- B2-2 的 Then 有明确的成立口径与对应测例。
- `pnpm check-types` + `pnpm lint` + 相关包测试全绿。

## Answer

### 落了什么

裁定（工单 07）取**人工触发**，故本票的「可核对证据」= 一条断言「PUT 收紧**不**入队」的测例，而不是断言入队恰一次：

- **新增** `apps/api/tests/acl/acl-tighten-no-auto-reindex.test.ts`（3 例，已登记 `apps/api/tests/index.md`）：mock `services/queue.js` 记录 `enqueueIngest` 调用面 —— **收紧**（`null → 名单`）外显 `reindexRequired=true` 而 `enqueueIngest` **零调用**；**放宽**（名单扩容）`reindexRequired=false` 同样零调用；**反复收紧**同一文档三次仍零调用（因根本不入队，故「重复入队无幂等」这一风险面不存在），且 api 侧始终未改 `indexVersion` / `activeIndexVersion`。
- 第 1 例同时钉住「PUT **只写** `aclPrincipals` 一列」：`patchMeta` 的载荷逐字等于 `{ aclPrincipals: [...] }`。
- **spec 口径**：已由工单 09 写入 `.trellis/spec/api/backend/departments.md`「检索期部门 / 名单收窄与 ES 索引一致性」一节（含「ACL 收紧 = 人工 reindex」的口径与未覆盖项）。
- **镜像陈旧项回写**：`docs/module-status/api.md` / `worker.md` 的「缺激活 version 表示」旧叙述已由工单 09 按源码改正（`active_index_version` 已存在，`es_index` 成功时原子写）；`docs/testing/coverage/02-acl.md` 的 B2 / AE 行改写归工单 [12](./12-task-writeback.md)，本票未动。

### B2-2 的成立口径与对应测例（裁定 07 §3 的落地版）

| 剧本片段 | 本仓口径 | 测例 |
|---|---|---|
| 「principal 变更」 | `PUT /documents/:docId/acl` 改 uuid 名单（角色 principal 未落，属等价替换） | `acl/documents-acl-endpoint.test.ts` · `acl/documents-acl-principals.test.ts` |
| 「reindex 后」 | 运营按 `reindexRequired` **人工**触发 Reindex；**不自动入队** | 本票 `acl/acl-tighten-no-auto-reindex.test.ts`（零入队）+ `ingest/reindex-version.test.ts`（入队载荷 `stage=chunk`，由被通知方显式调用） |
| 「该文档对该用户不可检索」 | **PG 闸即时成立**，不依赖 reindex；索引滞后不构成泄漏 | `acl/acl-tighten-index-lag.test.ts`（2 例） |

**未断言的一截**（须真 ES，划出）：「reindex 后 ES 索引侧旧 principals 被覆盖」的集群侧行为。

### 连带发现 → 已立票并收口

写「放宽」用例时挖出 `aclTightens` 的一处**自相矛盾**：`next = null` 被当成空集合，于是 `[a] → null` 判 `true`（收紧），而函数自带契约写的是「`null` = 全体成员可读」、`[] → null` 又判 `false`。已开票 [14](./14-dec-acl-tightens-null.md) 并裁定为**误报**、落地修正（`packages/contracts` 加 `if (upcoming === null) return false;` + 真值表补 `[a] → null` / `[a,b] → null` 两行）。**本票的「放宽」例因此改用具名扩容**（`[a] → [a, b]`），避免与 14 的修正交叉依赖。

### 门禁

- `packages/contracts`：`tsc --noEmit` 0 · `document-contract.test.ts` **48/48**（含新增的两行真值表）。
- `apps/api`：`tests/acl/acl-tighten-no-auto-reindex.test.ts` **3/3**；全量回归见收口批次。

### 未做

- 覆盖表 `docs/testing/coverage/02-acl.md` 的 B2-2 / B2-3 行改写（归工单 12）。
- 真 ES 集群侧验证（划出，属 B8）。
- 未动 `prds/00–11`，未改任何仓库默认开关。
