# 落 B2 / AE 剧本的自动化断言

Type: task
Status: resolved
Blocked by: 03, 08, 09

## 做什么

按 `03-research-p3b-test-map.md` 的缺口清单，为 B2-1…B2-4 与 AE4–AE8、AE10–AE12 补自动化断言。全部在**显式开启强制**（KB 覆盖或测例内 env 注入）的配置下跑，且不改仓库默认开关。

## 完成判据

- 每条补的断言都要有反证方式并在 Answer 里记录（破坏哪一处会让它变红）。
- 测例落在 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头目标/需求/被测/简介用简体中文，并登记 `tests/index.md`。
- 明确标出哪些缺口**必须真 ES 集群**（不写成可做）。
- `pnpm check-types` + `pnpm lint` + 相关包测试全绿。

## Answer

### 缺口与落点（研究票 03 的 12 行，逐行现状）

研究票指出**整片**缺口：`apps/api/tests/ask/*.test.ts` 里无一处出现 `deptAcl`/`ownerDeptId` → ask 侧部门强制从未端到端断言。本票正面补这一片，并顺手补掉 AE7 的审计缺口（研究票标注为「删掉代码也无测例变红」）。

| 行 | 原来 | 本票后 |
|---|---|---|
| B2-1 | 列表/详情/谓词/稀疏旧命中已断言，**缺 ask 端到端** | 新增 ask 端到端 2 例：模型硬引用被挡文档 → `abstained` 且答文 / 引用 / evidence 都不含它；同一夹具下可见文档仍 `answered·verified`（证明不是全拦） |
| B2-2 | 只到「收紧 → `reindexRequired`」 | **本图的 [10](./10-task-acl-tighten.md)** 补「零入队」；本票不重复 |
| B2-3 | **无反向构造** | 新增「绕过可见性闸喂全量语料 → 被挡文档确实被召回」的正向对照（证明前面的缺席不是空转） |
| B2-4 | 已断言 | 未动 |
| AE4 | 列表/详情已断言，ask 无 | 语料集合 + `runRetrieve` 两面断言（祖先继承下 `{空部门, 本部门 20, 子部门 20}`，不含本部门 30） |
| AE5 | 仅谓词层，HTTP 无 `isLeader:true` | 负责人语料含 30 级文档；AE11 同案 |
| AE6 | 谓词 + 列表已断言，ask 无 | 无归属 → 语料只剩空部门文档 |
| AE7 | grant 可见（谓词）与 grant 写入（HTTP）**分测未串联**；审计**无断言** | 谓词串联 2 例（未过期 grant 授被授部门及其子孙、换 grant 部门即换可见集、过期不算）+ **审计 2 例**（路由级 `dept_cross_grant_create` / `_delete` 含 `grantId`；中间件级 `/api/v1/admin/` 前缀落 `admin_write`） |
| AE8 | 两路各自有断言，**无单例同时断言 dense 语料与 ES terms 对称** | 新增单例：开强制时 `sparseSearch` 收到的 `ownerDeptIds` 与 `maxVisibleLevel`，与「ES 陈旧命中（全量 chunkId）经语料求交后只剩 PG 可见块」同断言 |
| AE10 | 谓词 + KB 覆盖已断言，**缺端到端** | KB 覆盖 `deptInheritDown=false` → 语料只剩本部门与空部门 |
| AE11 | 仅谓词层 | 由 AE5 案覆盖（负责人可见子孙 30） |
| AE12 | 谓词层已断言，**「兼任」无专例**、缺端到端 | 下级负责人：语料只见本子树与空部门，不见上级与兄弟 |

另补两条边框：**关强制回退**（`configJson={}` → 全量进语料，证明强制的开关可回退）与 **tenantId 缺失 fail-closed**（文档行 tenant 为空 → 归属/授权查不到 → 只剩空部门文档）。

### 落点与实现手法

- 新增 `apps/api/tests/acl/dept-acl-ask-e2e.test.ts`（14 例，已登记 `apps/api/tests/index.md`）。手法：`vi.mock('services/db.js')` 提供内存里的 `documents` / `chunks` / `chunk_embeddings`，`loadCorpus = loadCorpusFromDb`（**真实装载链**：`visibility.ts` + 真实 `dept-acl` 谓词），IO 端口换成 `departments.js` / `dept-grants.js` 的内存实现（故 `loadDeptGrants` 的租户校验与过期剔除也是真的）；强制由 **KB 覆盖 `configJson.deptAclEnforce = true`** 打开 —— **不改任何仓库默认开关**，也不 stub env。
- `apps/api/tests/acl/dept-grants-http.test.ts` 补 2 例审计（沿用 `obs/admin-write-audit.test.ts` 的 `vi.spyOn(loggerMod,'childLogger')` 手法），文件头「目标/被测/简介」同 PR 更新。

### 反证（实测）

| 反证 | 破坏 | 结果 |
|---|---|---|
| **FA** | `visibility.ts` 的 `isDocVisible` 把 `enforce` 写成 `false`（部门闸整体失效） | `dept-acl-ask-e2e.test.ts` **10 / 14 红**（AE4/AE6/AE10/AE12/AE7 谓词与 grant 串联/B2-1 两例/tenantId/B2-3 对照/AE8）；还原后全绿 |
| **FB** | 删 `routes/dept-grants.ts` 的 `dept_cross_grant_create` 日志调用 | `dept-grants-http.test.ts` **1 例红**（AE7 路由级审计）；还原后全绿 |
| 继承开关（同类，未单跑） | 把 `isAncestorPath` 忽略 `inheritDown` | AE10 与 AE5/AE12 会红（AE10 断言祖先不再下探） |

### 明确必须真 ES / 真 PG（**不**写成可做项）

1. `terms` / `must_not exists` / `range` 在**真索引**上对缺字段与哨兵的实际命中语义（现测只抓请求体形状）。
2. **B2-2 的后半截**：`收紧 → reindex → 该用户不可检索` 里「reindex 覆盖 ES 旧 principals」这一半（前半截「PG 闸即时成立」已在 `acl/acl-tighten-index-lag.test.ts` 断言）。
3. **AE8 的「缺字段不得当全员可见」**在真集群上的判定。
4. **B2-3 的真 PG 单路泄漏**：本仓 dense 是进程内 cosine over PG 装载的 embeddings；泄漏只可能来自真 `loadCorpusFromDb`，本票只能以「绕过闸喂全量语料会被召回」作正向对照，不能断言真 PG。
5. 角色 principal（ADR-057 `:1861-1864` 的 `user:` / `dept:{id}:lv:{n}` 形态）未落 → B2-2 的「移出 role」仍只能以「移出 uuid 名单」作**更弱的等价替换**（裁定 06 §5，见 map 雾中）。

### 门禁

`apps/api`：`tsc --noEmit` 0 · `eslint --max-warnings 0` 0 · `vitest run` 见收口批次。

### 未做

- 真 ES 集群 / 真 PG 验证（划出，属 B8）。
- 覆盖表 `docs/testing/coverage/02-acl.md` 的 B2 / AE 行改写（归工单 [12](./12-task-writeback.md)）。
- 未动 `prds/00–11`，未改任何仓库默认开关。
