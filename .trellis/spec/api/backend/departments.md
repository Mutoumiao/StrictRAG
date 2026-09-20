# api · 部门组织壳（code-spec · B5）

> 路径：`apps/api/src/routes/departments.ts` · `services/departments.ts`  
> PRD：`prds/05-api` §2.12 · ADR-057  
> 切片：**最小**（树 CRUD + 用户归属）；grant 表可存；`DEPT_ACL_ENFORCE` **默认关**；开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树（无树/缺节点只精确；grant 子树不读 inheritDown）；超管可绕过；列表同滤且列表项带部门列；`DEPT_INHERIT_DOWN` 默认 true；KB `deptInheritDown` 可覆盖 env（设置页可勾选，未改不写回）；KB `deptAclEnforce` 可覆盖 env（设置页可勾选，未改不写回）；complete 可写部门字段与 `aclPrincipals`；ES 查询期 enforce 开且非超管可 `ownerDeptId` terms 收窄（缺字段不得当全员可见；PG 可见级闸仍保留）并追加**可见级级别组**（上界语义；形态与口径见本文件末节）；sensitive complete 须 ACL 就绪（部门路径或显式名单）；**≠** 默认开 / **≠** 角色 principal / 文档级用户 uuid 名单已落（PG 闸 + ES 查询期非超管 should）

---

## Scenario: 部门树与用户归属

### 1. Scope / Trigger

- 新增/改部门组织树 API
- 用户主部门 / 兼任 / 负责人归属
- 禁环、禁用部门不可新挂用户

### 2. Signatures

| 方法 | 路径 | 中间件 |
|------|------|--------|
| GET/POST | `/api/v1/admin/departments` | `requirePermission('dept.manage')` |
| GET | `/api/v1/admin/departments/tree` | 同上（**须先于** `:deptId`） |
| GET/PATCH/DELETE | `/api/v1/admin/departments/:deptId` | 同上 |
| GET/PUT | `/api/v1/admin/users/:userId/departments` | `requirePermission('user.manage')` |

```typescript
// services/departments.ts
createMemoryDepartmentsRepoWithUsers(): MemoryDepartmentsRepo // + registerUser
wouldCreateCycle(deptId, newParentId, byId): boolean
buildDepartmentTree(rows): DepartmentTreeNode[]
validateAssignmentList(assignments): { ok: true } | { ok: false; message }
pathFor(parentPath, id): string // `/uuid/` 或 `/uuid/uuid/`
recomputeSubtreePaths(rootId, newRootPath, byId)
```

DB：`departments` · `user_departments`（`packages/db` · migration `0005_b5_departments`）

### 3. Contracts

- DTO：`@strict-rag/contracts` · `departments.contract.ts`
- 权限：`dept.manage`（树）· `user.manage`（归属）
- 文档 `ownerDeptId` / `visibilityLevel` **字段已落**（GET 详情回读 · **列表项同带** · `PATCH /documents/:docId` 可写部门两列 / 类型 / `aclPrincipals` · `doc.editor` 始终验码；**complete body 可选同写**部门字段与 `aclPrincipals` 后再过 SENS）
- **文档 ACL 专用入口**（PRD 05-api §2.4）：`GET/PUT /api/v1/documents/:docId/acl`。三态 `null`（字段缺失=KB 成员可读）/ `[]`（成员不可读）/ 非空名单。GET 与**详情共用同一可见性判定**（`docReadDenied`：部门强制开时部门闸 → 名单闸），名单外 403、超管旁路；PUT 权限与 PATCH **同一码** `doc.editor`，**刻意不叠可见性闸** —— `[]` 的文档对非超管本就不可读，写路径若也过闸就谁都无法把它修回来。**不**改检索语义、**不**默认开强制。
- **收紧须 reindex（功能表 §5.5 · ADR-009 决策 4 · ES PRD §4.3）**：`aclPrincipals` 是**索引字段**，收紧后 ES 侧仍是旧值。PUT 响应带 `reindexRequired`（`aclTightens(prev, next)`：新集合不再是旧集合的超集 = 有人失去可读性；`null`=全员可读、`[]`=无人），收紧时另写 `event: 'doc_acl_tightened'` 的 info 日志。**不自动入队 reindex**（`index_version` 在 chunk 段即 `+1`，失败会指向失败版本；缺「当前激活 version」表示，与孤儿清理同一前置）。**这不是安全洞**：`retrieve.ts` 稀疏命中后只保留 PG 语料内 id（`byId`），语料一律过 `filterDocsForAclPrincipals`，滞后命中被丢弃——影响只是召回被稀释。测：`tests/acl/acl-tighten-index-lag.test.ts`。
- `dept_cross_grants` 表 + `GET/POST/DELETE /admin/dept-cross-grants`（`dept.manage`）；enforce 开时 retrieve/预览/列表读**未过期** grant（精确 ∪ 有树且双方节点齐全时祖先部门子树；无树/缺节点只精确；**不**读 inheritDown）
- `DEPT_ACL_ENFORCE` 默认 false；开时 `filterDocsForDeptAcl`：精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树（预览、列表、retrieve 同函数；`inheritDown=false` 只关归属祖先）；`roleBypassesKbMembership` 绕过部门滤（Pino `dept_acl_bypass`）；`DEPT_INHERIT_DOWN` 默认 true（仅 `'false'` 关祖先）；KB `config_json.deptInheritDown` 可覆盖 env（未写跟 env；设置页可勾选，未改不写回）；KB `config_json.deptAclEnforce` 可覆盖 enforce（未写跟 env；GET 未写回读 false；设置页可勾选，未改不写回）；admin 授权行有树时显示部门名、可见级默认中文标签、过期空显示「长期」；归属可选用户（复用平台列表）；ES http 检索 enforce 开且非超管时 `buildAclFilter` 追加 `ownerDeptId` terms（`collectVisibleOwnerDeptIds`）；缺字段不得当全员可见；**无** 默认开 / 文档级用户 uuid 名单已落（列表/详情/chunks/retrieve 同滤；不跟 DEPT_ACL_ENFORCE；ES 查询期非超管 should 收窄）；sensitive complete 须 ACL 就绪（部门路径或显式名单）；**≠** 角色 principal

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无 manage 码 | 403 | FORBIDDEN |
| body Zod 失败 | 400 | VALIDATION_ERROR |
| parent 不存在 | 400 | VALIDATION_ERROR |
| PATCH 成环 | 400 | RULE_VIOLATION |
| 禁用部门新挂用户 | 400 | RULE_VIOLATION |
| 双 primary / 无 primary（非空） | 400 | VALIDATION_ERROR |
| DELETE 有子/有用户 | 400 | RULE_VIOLATION |
| 部门/用户不存在 | 404 | NOT_FOUND |

### 5. Good / Base / Bad

- **Good**：根+子 POST → 201；一主多兼任 PUT → 200  
- **Base**：GET tree 排序与嵌套  
- **Bad**：kb_admin 列部门 → 403；父挂到子 → 400；禁用部挂人 → 400

### 6. Tests Required

`apps/api/tests/acl/departments-http.test.ts`（真实 Hono + memory repo）：

- 无码 403（dept / user 归属）
- 树 CRUD + tree
- 成环 400
- 禁用部门归属 / active 归属
- 双 primary / 合法归属 + GET
- DELETE 有子、有用户、空叶

### 7. Wrong vs Correct

#### Wrong
```typescript
// 宣称 ADR-057 全文已上，或默认 DEPT_ACL_ENFORCE=true
if (env.DEPT_ACL_ENFORCE) { /* 精确∪祖先 + grant 精确∪祖先子树；默认仍 false；ES 只收窄 */ }
```

#### Correct
```typescript
routes.get('/admin/departments', requirePermission('dept.manage'), ...)
// 组织可配；检索仍成员全库（默认）
```

---

## Scenario: 检索期部门 / 名单收窄与 ES 索引一致性

### 1. Scope / Trigger

- 动 `services/retrieve/dept-acl.ts`（可见性谓词 / 收窄候选 / 级别上界）
- 动 `services/retrieve/es-sparse.ts` 的 `buildAclFilter` / `sparseBulkSource` / 索引 mapping
- 动 worker `ingest/es-http.ts` 的同名近似拷贝 —— **改一处必须同改另一处**
- 动 `PUT /documents/:docId/acl`（收紧路径）或文档 `visibilityLevel` 的写路径

### 2. 形态（当前实现）

- **PG 是 ACL 真值源**：`loadCorpusFromDb` 装载期已过 `filterDocsForDeptAcl` + `filterDocsForAclPrincipals`；dense 打分输入即该语料，故 dense 侧不另设 filter。
- **ES 只做粗收窄**：`buildAclFilter` 返回 **filter 数组**，元素之间 AND。已用元素 = `term tenantId` · `term kbId` · 可选 `terms ownerDeptId` · 可选**级别组** · 可选名单 `should`。
- **禁跨元素拉平**：把部门支与级别支塞进同一个 `should` 会变成「部门 OR 库级 OR 级别达标 OR 缺失」= 放松。新条件一律加**独立元素**。
- **级别组是上界不是逐文档规则**：`maxVisibleLevelUpperBound` = `max(任一处负责人 ? 30 : 20, 未过期 grant 的 maxVisibilityLevel)`；由 `PG 可见 ⇒ vis <= 上界` 保证只缩小 ES 命中集。
- **「是否收窄」的三态信号 = `maxVisibleLevel` 是否传入**：enforce 关或超管 bypass → 两者都不传（filter 与历史逐位一致）；enforce 开且非超管 → 传上界（**即便部门 id 为空也传**）。
- **兜底仍在**：ES 命中必须落在 PG 语料内（`sparseRanked.filter((id) => byId.has(id))`），ES 命中只影响排序。**一旦把 ES 命中用于计数 / 渲染 / 直接取正文，该兜底失效，必须回来加真 filter。**
- **tenantId 来源**：`requireTenantId` 运行时即抛，缺 / 空 / 纯空白一律失败；禁止补默认租户。

### 3. 索引一致性口径（ACL 收紧）

- **不自动入队 reindex**（裁定：ADR-009 决策 4 是「确认义务」而非「自动触发」；泄漏侧已由 PG 闸即时闭合）。
- `PUT /documents/:docId/acl` 收紧 → 回 `reindexRequired=true` + Pino `doc_acl_tightened`，由运营触发 Reindex。
- **索引滞后不构成泄漏**：稀疏旧命中经语料求交丢弃（`tests/acl/acl-tighten-index-lag.test.ts`）。
- 「激活 version」表示**已落**（`documents.active_index_version`，es_index 成功时与 `status=ready` 同一条 UPDATE 原子写）——旧文里把它记为 reindex 前置属**陈旧**。

### 4. Tests Required

| 层次 | 文件 |
|------|------|
| 纯函数（谓词 + 级别上界） | `apps/api/tests/acl/retrieve-dept-acl.test.ts` |
| builder 形状 | `apps/api/tests/ask/es-sparse.test.ts` · `es-dept-query-filter.test.ts` · `es-principals-query-filter.test.ts` |
| worker 同名拷贝 | `apps/worker/tests/ingest/es-http.test.ts` |

**未覆盖（不得写成已测）**：真 ES 集群行为 —— `range` / `exists` 对缺字段与哨兵的实际判定、`integer` 与既有 dynamic mapping 是否冲突、`minimum_should_match` 在 `filter` 上下文的语义。现测只断言到请求体形状。

### 5. Wrong vs Correct

#### Wrong
```typescript
// 把部门支与级别支并进同一个 should（等于放松），或去掉 maxVisibleLevel 后仍下级别条件
filter.push({ bool: { should: [
  { terms: { ownerDeptId: ids } },
  { range: { visibilityLevel: { lte: max } } },
  { bool: { must_not: { exists: { field: 'aclPrincipals' } } } },
], minimum_should_match: 1 } });
```

#### Correct
```typescript
if (ownerDeptIds.length > 0) filter.push({ terms: { ownerDeptId: ownerDeptIds } });
if (maxVisibleLevel != null) filter.push(visibilityLevelFilterClause(maxVisibleLevel));
if (applyAclPrincipals) filter.push(aclPrincipalsFilterClause(userId));
```
