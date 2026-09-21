# 研究：主体形态今天在契约 / PG / ES / 测例各处分别是什么，ADR-057 §5 的「或等价结构化字段」是否已被满足

Type: research
Status: resolved
Blocked by: —

## 问题

P3b 出口最后一条争议：ADR-057 §5（`prds/11-decisions/00-adr-index.md` `:1861-1865`）要求「用户主体集合 `principals` **至少含** `user:{id}` 与 `dept:{deptId}:lv:{effectiveLevel}`」，同节又写「文档/chunk 反范式 `aclPrincipals`（**或等价结构化字段**：`owner_dept_id` + `visibility_level` 由检索层展开为可匹配条件）」。本仓今天走的是后一条。要把这件事裁干净，先得把**事实面**查清：

1. **ADR / PRD 侧**：`user:` / `role:` / `dept:…:lv:…` 三个形态各自由哪条冻结文本要求？哪些是**必达**、哪些只是「等」的举例？PRD 05 §2.4 到底有没有规定名单字段的语法（有 → 动语法就是改冻结语义；没有 → 属契约层决定）？ES PRD 的字段表与查询期描述各写了什么？
2. **源码侧现状**：`aclPrincipals` 的写入面（PUT /acl、complete、PATCH 元数据）与读取面（PG 谓词、list/详情/chunks/ask 语料、ES 查询期、worker bulk）**逐处**今天怎么处理这个字段；有没有任何一处已经支持前缀形态。
3. **两条路径的落点与代价**：
   - **路径 A「等价成立」**：不改数据形态，只补口径与回写（镜像 / 覆盖表 / spec 的欠债句改准）。要点：现有结构化形态与 `user:` 形态在**可读集合**上是否逐位一致（含 `null` / `[]` / 多主体 / 部门轴的交互）？差别只在前缀语法本身吗？
   - **路径 B「补身份展开器」**：若裁定仍欠，最小落点是什么（DB 是否要迁移 / 契约校验放宽的边界 / PG 谓词怎么展开 / ES 入参与查询期怎么改 / worker bulk 同名拷贝 / 测例影响面）。给出**回归面清单**（会被改红或必须改签名的既有测例文件）。
4. **回归面测算**：两条路径各会动哪些既有测例文件、哪些夹具（尤其 `loadCorpus` 系列夹具与 `es-principals-query-filter.test.ts`）；路径 B 是否会强迫改 `CorpusLoader` 签名（与前图雾中的 tenantId 缺口叠加）。
5. **只加严核对**：路径 B 若落地，哪些输入会从「400 拒」变成「200 接受」（那是**放宽**写入口）；逐一列出并给出「为什么可接受 / 为什么不可接受」的判据指向。

## 要求

- 结论必须**指到源码路径**或 PRD/ADR 行号；不得只给叙述。
- 明确区分「已核实（读过源码/原文）」与「只读推断未实跑」。
- 若发现本票前提有误（例如 PRD 05 其实规定了语法），**直接写明并指出对本图目的地的影响**。
- 输出写到本工单的 `## Answer`，并把三处镜像里所有「**≠** 角色 principal」欠债句的**准确边界**一并列出（每句 → 它今天真正缺什么）。

## Answer

> 阅读约定：以下所有行号均为**本次实际读过**的当前工作树内容（2026-09-21）。标「已核实」= 我逐字读了原文/源码；标「只读推断」= 由已核实的代码结构与类型推出、**未实跑**。

---

### 0. 结论摘要（先给可裁的三句）

1. **冻结文本侧**：`user:{id}` 与 `dept:{deptId}:lv:{effectiveLevel}` 是 ADR-057 §5 `:1862-1864` 的**必达**（「至少含」）；`role:…` **不是** ADR-057 的必达项，只出现在 ES PRD `:75`（`（…等）`）与 `:114` 示例、安全 PRD `:210`（`等`）——是**举例/开放集**。**PRD 05 §2.4 `:231-235` 逐字只列两个端点，未规定 body、未规定元素语法、未规定三态**（该文件全文不含 `aclPrincipals` 一词）。故「改前缀语法」= **契约层决定**，不构成改 `prds/05-api` 的冻结语义；但若采纳前缀，它会**与 ADR-057 §5 `:1862` 的字面拼写对齐**，而不是与之冲突。
2. **源码现状**：全仓**没有任何一处**支持带前缀形态。用户轴今天 = 「裸 uuid 名单」+ 「查询期单个裸 `userId` term 相等匹配」；部门轴今天 = `ownerDeptId` + `visibilityLevel` 结构化字段在检索层展开（即 ADR-057 §5 `:1865` 明确授权的另一支）。ES PRD `:145-158` 声明的 `userPrincipals?: string[]` 入参在仓内**不存在**；仓内是 `aclPrincipalUserId?: string`（单数）。
3. **等价边界**：在**用户轴**上，今天的形态与 `user:{id}` 形态在可读集合上**逐位一致，差别只在前缀符号本身**（都是精确身份匹配，无 `≥`、无树）。在**部门轴**上，§5 `:1865` 的「或等价结构化字段」这一支**已经被走**且语义完整；而 §5 的 `dept:…:lv:…` **枚举形态本身无法**表达「有效级别 ≥ 文档级别」「上级看下级」「跨部门 grant 沿子树」「文档无 ownerDeptId = 库级」四件事（除非在索引/查询期做同样的树与级别展开）——**所以「等价」不是由前缀决定的，而是由「检索层是否重建了同一份树/级别逻辑」决定的，而这恰好就是今天代码在做的事**（`dept-acl.ts` + `es-sparse.ts`）。**真正的空缺只剩「用户轴的拼写」与「`role:` 主体完全不存在」两项**，且前者是否算违约取决于对 `:1862` 取字面读还是实质读；`prds/00–11` 属冻结层，**镜像文无法替代这一读法裁定**（见 §7.4）。

---

### 1. 冻结文本侧（已核实，逐条引原文）

#### 1.1 三个形态各自的出处、必达性

| 形态 | 出处（行号） | 原文关键片段 | 必达 / 举例 |
|---|---|---|---|
| `user:{id}` | `prds/11-decisions/00-adr-index.md:1861-1862` | 「用户主体集合 `principals` 至少含：/ - `user:{id}`」 | **必达**（「至少含」措辞，`principals` 为查询侧集合） |
| `dept:{deptId}:lv:{effectiveLevel}` | 同文件 `:1863-1864` | 「对每个所属部门：`dept:{deptId}:lv:{effectiveLevel}`」；「跨部门 grant 未过期：同样写入对应 `dept:…:lv:…`」 | **必达**（同属「至少含」列表） |
| `role:…` | `prds/03-data/03-elasticsearch-bm25.md:75` | 「**aclPrincipals** \| keyword[] \| **P3b**；可见主体（`user:…` / `role:…` / `dept:…:lv:…` **等**）；缺省行为见 §4.3」 | **举例**（外层有「等」= 开放集） |
| `role:…` | 同文件 `:114` | `{ "terms": { "aclPrincipals": ["user:u1", "role:finance"] } }` | **示例**（filter 示例体，非规范句） |
| `role` 主体 | `prds/09-security/01-auth-acl-compliance.md:210` | 「其他 doc_acl \| user 显式 principals **等** \| P3b 可叠加」 | **举例**（未点名 role） |
| `user:{id}` 的等价骨架 | `prds/11-decisions/00-adr-index.md:1798` | 「**ADR-009 P3b** 的 `dept` principal 与 `aclPrincipals` 形态本 ADR **焊死业务语义**」 | 焊死的是 `dept` principal + `aclPrincipals` **形态**；**未**提到 role |

**已核实**：ADR-057 §5 的「至少含」列表里**只有** `user:{id}` 与 `dept:…:lv:…`；`role:` 只活在 ES PRD 的字段表与示例里（且带「等」）。

#### 1.2 PRD 05 §2.4 —— **未规定**

`prds/05-api/01-http-api-hono.md:231-235` 逐字为：

```
### 2.4 文档 ACL（Phase 3；P2 可无端点但不可导入敏感库）

```http
GET    /api/v1/documents/:docId/acl
PUT    /api/v1/documents/:docId/acl
```
```

紧接着 `:237` 就是 `### 2.5 问答`。**该节没有请求/响应示例、没有 body 字段名、没有元素语法、没有三态说明。** 且对 `prds/05-api/01-http-api-hono.md` 全文做 `aclPrincipals|documents/:docId/acl|文档 ACL|2\.4` 检索，命中仅 `:231` `:234` `:235` 三行 —— **PRD 05 全文不含 `aclPrincipals` 一词**（已核实）。

→ **结论**：名单字段的元素语法**未规定**。改前缀 = 契约层（`packages/contracts` + route）决定，**不是**改 PRD 05 的冻结语义。（但见 §7.4：它仍可能撞 ADR-057 §5 的字面拼写，那是另一条文本。）

#### 1.3 ES PRD 对 `aclPrincipals` 的三处描述（已核实，逐字）

**（a）字段类型 / mappings** — `prds/03-data/03-elasticsearch-bm25.md:75`

> `| **aclPrincipals** | keyword[] | **P3b**；可见主体（`user:…` / `role:…` / `dept:…:lv:…` 等）；缺省行为见 §4.3 |`

（同表 `:76-77` 另有 `ownerDeptId` keyword「部门归属（可空=库级；ADR-057）」与 `visibilityLevel` integer —— 即**结构化那一支也被写进同一张表**。）

**（b）查询期** — 同文件 `:109-119`（§4.2）：

> `:110` 「在 P2 filter 之上：」
> `:114` `{ "terms": { "aclPrincipals": ["user:u1", "role:finance"] } }`
> `:117` 「`userPrincipals` 由身份服务展开（用户 id + 角色/部门等），通常 **几到几十**，禁止展开为「可读 docId 万级列表」作主路径。」
> `:119` 「**部门可见性（ADR-057 · `DEPT_ACL_ENFORCE=true` 时）**：在 filter 上追加 `ownerDeptId` 与 `visibilityLevel` 比较（**或预展开 `aclPrincipals` 的 `dept:{id}:lv:{level}` 主体**），**与 dense 对称**；`ownerDeptId IS NULL` = 库级文档。**禁止**仅 dense 侧滤部门而 ES 裸召回。」

**（c）缺省** — 同文件 `:121-127`（§4.3）：`字段缺失` = 该 KB 全体成员可读；`显式 []` = 全体成员不可读。

**（d）接口声明** — 同文件 `:145-158`（§4.5）声明 `SparseRetriever.search` 入参含 `/** P3b：当前用户主体；P2 可空 */ userPrincipals?: string[]`。

**（e）写入** — 同文件 `:172`：「P3b：写入/更新 `aclPrincipals`；ACL 变更触发受影响 doc 的 reindex」。

→ **关键事实**：`:114` 的示例把 **wire 上的 terms 元素写成带前缀**；`:117` 明确「由**身份服务展开**」；`:119` 把「结构化比较」与「预展开 `dept:{id}:lv:{level}` 主体」并列为**两条可互换实现**。今天仓内**既没有「身份服务展开」，wire 上也没有前缀，入参名字也不是 `userPrincipals`**（见 §2）。

#### 1.4 其余相关冻结文本（已核实，供交叉核对）

| 文本 | 行号 | 要点 |
|---|---|---|
| ADR-009 决策 1 | `prds/11-decisions/00-adr-index.md:147` | 「**P3b** → 文档/chunk 反范式 `aclPrincipals`；查询滤 **用户主体集合**（小），**禁止**把「用户可读全部 docId」作主路径 terms」 |
| ADR-009 决策 4 | 同文件 `:155` | 「**P3b 缺省**：字段缺失 = 该 KB 全体成员可读（兼容 P2）；显式 `[]` = 全体成员不可读。ACL 收紧须 reindex 后确认」 |
| ADR-057 §5 全文 | 同文件 `:1859-1868` | 「5. **检索 / 预览落地（细化 ADR-009 P3b）**」+ 三形态 + `:1865`「（或等价结构化字段：`owner_dept_id` + `visibility_level` 由检索层展开为可匹配条件）」+ `:1866` dense∥ES 对称 + `:1867` 「列表预览、chunk 查看、ask evidence **同一可见性函数**」+ `:1868` 超管绕过 |
| ADR-057 §7 分期 | 同文件 `:1885` | P3 必达含「`aclPrincipals` 同步」 |
| 在线 PRD | `prds/04-pipelines/02-online-ask-langgraph.md:180` | 「P3b：- + `userPrincipals ∩ aclPrincipals`（字段缺失=成员可读；[]=不可读）」 |
| PG PRD | `prds/03-data/01-postgresql-schema.md:147` | 「**chunks / ES**（P3）：反范式 `aclPrincipals` **或** `owner_dept_id`+`visibility_level` 供对称 filter。」（**注意：PG PRD 未给 `documents.acl_principals` 的列类型**；全文检索 `acl_principals` 在 `prds/` 下 **0 命中**） |
| 术语表 | `prds/00-product/03-glossary.md:115` | 「**aclPrincipals** \| P3b 索引主体列表；缺失=成员可读，`[]`=不可读」 |
| 安全 PRD | `prds/09-security/01-auth-acl-compliance.md:203-211`（§3.6）、`:213-222`（§3.6.1）、`:224-236`（§3.6.2） | §3.6.1 `:222` 「P3b 缺省 \| 字段缺失 = 成员可读；`[]` = 成员不可读」；§3.6.2 部门规则（有效级别 ≥、上级看下级默认开、下级不看上级、超管绕过、同一可见性函数） |
| 路线图 / 验收 / 功能表 | `prds/10-delivery/01-phased-roadmap.md:203-207`；`prds/10-delivery/03-acceptance-scenarios.md:56`（B2-4）；`prds/12-delivery-guides/14-模块需求功能表.md:591` | 均只要求「`aclPrincipals` 进索引 / 缺省 / `[]`」，**未规定元素拼写** |

---

### 2. 源码现状（逐处：写入面 / 读取面）

#### 2.1 写入面（`aclPrincipals` 元素在被接受与落库时怎么被处理）

| # | 位置（路径 : 行） | 符号 | 今天对元素形态的处理（已核实） |
|---|---|---|---|
| W1 | `packages/contracts/src/ingest/document.contract.ts:86` | `CompleteUploadBodySchema.aclPrincipals` | `z.array(z.string().uuid()).max(256).nullable().optional()` —— **逐元素硬校验 uuid** |
| W2 | 同文件 `:110` | `WriteDocumentBodySchema.aclPrincipals` | 同上（`max(256)` + uuid） |
| W3 | 同文件 `:244` | `PatchDocumentMetaBodySchema.aclPrincipals` | 同上；`:248` 闭合 `.object` 后接 `.refine`（`:249-259`，只要求「至少一个字段」），**该 schema 无 `.strict()`** |
| W4 | 同文件 `:270` | `DocumentAclSchema.aclPrincipals` | `z.array(z.string().uuid()).nullable()`（**响应形状**，但由 `parse` 在写入回读与 GET 上把关，见 R4/R5）；`:271` 带 `.strict()` |
| W5 | 同文件 `:278` | `PutDocumentAclBodySchema.aclPrincipals` | `z.array(z.string().uuid()).max(256).nullable()`；`:280` 带 `.strict()` |
| W6 | 同文件 `:299-310` | `aclTightens(prev, next)` | 纯**字符串集合**比较：`previous.some((p) => !nextSet.has(p))`（`:309`）。对拼写变体无归一化 |
| W7 | `packages/db/src/schema/kb/documents.ts:60` | `aclPrincipals: uuid('acl_principals').array()` | **PG 列类型 = `uuid[]`**（非 `text[]`） |
| W8 | `packages/db/drizzle/0014_p3b_acl_principals.sql:1` | migration | `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "acl_principals" uuid[];` |
| W9 | `apps/api/src/routes/documents/index.ts:261-265` | complete | `CompleteUploadBodySchema.safeParse` → 失败回 400 `VALIDATION_ERROR` |
| W10 | 同文件 `:268-274` → `apps/api/src/services/ingest-complete-pending.ts:111-117`、`:243-278` | `finalizePendingIngest` | 只做 `fields.aclPrincipals === undefined ? null : fields.aclPrincipals` 的**透传**（`:111`）；`:252` 与 `:278` 直接 `patchMeta({ aclPrincipals })`；无二次形态校验 |
| W11 | `apps/api/src/routes/documents/index.ts:289-292`、`:307-309`、`:341-346` | `POST .../documents/write` | 契约校验 → `evaluateWriteIngestGates`（`ingest-complete-pending.ts:48`，其中只把 `aclPrincipals` 当「是否就绪」判据：`:111-118` + `kb-settings.ts:223-230`）→ `patchMeta` 透传 |
| W12 | `apps/api/src/routes/documents/index.ts:718-723`、`:749-759` | `PATCH /documents/:docId` | `PatchDocumentMetaBodySchema.safeParse` → 400；写入时 `...(parsed.data.aclPrincipals !== undefined ? { aclPrincipals } : {})` 透传 |
| W13 | 同文件 `:859-897` | `PUT /documents/:docId/acl` | `:861-864` 契约 parse → 400；`:873` `aclTightens(doc.aclPrincipals ?? null, parsed.data.aclPrincipals)`；`:874` `patchMeta`；`:891-899` 回 `PutDocumentAclResponseSchema.parse({...})` —— **回读也过 uuid 校验** |
| W14 | `apps/api/src/services/documents.ts:260-276` | `patchMeta` | `if (patch.aclPrincipals !== undefined) set.aclPrincipals = patch.aclPrincipals;` —— **无形态校验，直写列** |
| W15 | `apps/worker/src/ingest/es-http.ts:39`、`:85-88` | `SparseBulkDoc.aclPrincipals` / `sparseBulkSource` | 类型是 `string[] \| null`（**不含 uuid 语义**）；`filter((id) => typeof id === 'string' && id.length > 0)` —— **非空字符串即写**（前缀不会被拦） |
| W16 | `apps/api/src/services/retrieve/es-sparse.ts:132-150` | `sparseBulkSource`（api 侧同名近似拷贝） | 与 W15 逐字同形（`:147-148`） |
| W17 | `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx:99-120`、`:990-994` | 薄页表单 | `parsePrincipalsText` 只按 `[,\n\r]+` 切分去空；**客户端不校验 uuid**；label 为「可见用户 uuid」 |

#### 2.2 读取面

| # | 位置（路径 : 行） | 符号 | 今天元素形态处理（已核实） |
|---|---|---|---|
| R1 | `apps/api/src/services/retrieve/doc-acl.ts:8-19` | `isDocVisibleForAclPrincipals` | `principals == null → true`；`length === 0 → false`；否则 `principals.includes(userId)`（`:18`）—— **裸 uuid 相等匹配**（`userId` 也是裸 uuid） |
| R2 | 同文件 `:21-26` | `filterDocsForAclPrincipals` | 逐文档套 R1 |
| R3 | `apps/api/src/services/retrieve/visibility.ts:69-88` | `isDocVisible` | 先部门（`:71-81`，`isDocVisibleForDeptAcl`），后名单（`:83-88`）。**求交顺序 = 部门 → 名单**，两侧都是 AND；顺序只影响 `reason`（`'dept' \| 'principals'`，`:38`）与 403 文案，不影响可见集合 |
| R4 | `apps/api/src/routes/documents/index.ts:826-851` | `GET /documents/:docId/acl` | 与详情共用 `docReadDenied`（`:793-823`）→ `DocumentAclSchema.parse({ docId, aclPrincipals: doc.aclPrincipals ?? null })`（`:850`）——**若列里出现非 uuid 字符串，此处 `parse` 会抛**（推断，未实跑） |
| R5 | 同文件 `:768-790` + `apps/api/src/routes/documents/mappers.ts:35`、`:60` | `GET /documents/:docId` / 列表项 | `toListItem` 把列值 `?? null` 原样透出（`:60`），响应形状同样过 `DocumentListItemSchema`（`document.contract.ts:208`，uuid 校验） |
| R6 | `apps/api/src/routes/chunks.ts:54-79`、`:110-113` | 分片列表/详情 | 同一 `isDocVisible`；不单独读 `aclPrincipals` |
| R7 | `apps/api/src/services/chunks.ts:30`、`:63` | 分片行 | 把 `documents.aclPrincipals` 带出（`?: string[] \| null`），供 R6 判 |
| R8 | `apps/api/src/services/retrieve/corpus.ts:70-79` | `loadCorpusFromDb` | 走 `loadVisibilityContext` + `filterVisibleDocs` —— **同一函数**（ADR-057 `:1867` 已落） |
| R9 | `apps/api/src/services/retrieve/es-sparse.ts:154-162` | `aclPrincipalsFilterClause(userId?)` | `should = [ { must_not: { exists: { field: 'aclPrincipals' } } } ]`，有 `uid` 才 push `{ term: { aclPrincipals: uid } }` —— **单个裸 uuid 的 term** |
| R10 | 同文件 `:192-215` | `buildAclFilter` | `:213-214` `if (input.applyAclPrincipals) filter.push(aclPrincipalsFilterClause(input.aclPrincipalUserId))` |
| R11 | 同文件 `:19-29`、`:37-41` | `EsSparseSearchInput` / `SparseBulkDoc` | 入参是 `applyAclPrincipals?: boolean` + `aclPrincipalUserId?: string`（**单数**，`:26-28`） |
| R12 | `apps/api/src/services/retrieve/retrieve.ts:193-212` | `runRetrieve` sparse 调用 | `:207-210`：`!bypassDeptAcl` 时 `applyAclPrincipals: true`，`...(input.userId ? { aclPrincipalUserId: input.userId } : {})` —— **直接塞裸 userId，无展开** |
| R13 | 同文件 `:76-108` | `sparseNarrowingForSearch` | 部门轴在此展开（`collectVisibleOwnerDeptIds` + `maxVisibleLevelUpperBound`），**用户轴不经过此函数**（`:78` 注释明说「名单闸不走此函数」） |
| R14 | `apps/api/src/services/retrieve/types.ts:85-98` | `SparseSearcher` | 类型上就是 `aclPrincipalUserId?: string` |
| R15 | `apps/worker/src/ingest/es-http.ts:71-90` | worker `sparseBulkSource` | 同 W15；worker **不做查询期过滤**，只 bulk |
| R16 | `apps/worker/src/ingest/pipeline.ts:926-938` | `es_index` 阶段 | `aclPrincipals: doc.aclPrincipals` 直传 bulk（`:936`） |

#### 2.3 有没有**任何一处**已支持带前缀形态？

**没有。**（已核实，检索方式：对 `**/src/**` 做 `principal|Principal` 全量检索，逐条读完；对全仓做 `'user:'|"user:"|`user:|user:${|role:|dept:${` 检索，命中全部是聊天消息 `role: 'user'` / KB 成员 `role: 'read'` 等无关语义。）

- 契约 5 处全部 `z.string().uuid()`（W1–W5）；
- PG 列是 `uuid[]`（W7/W8），**结构性拒绝非 uuid 字符串**；
- PG 谓词是 `includes(userId)`（R1）；ES 是 `term: uid`（R9）；入参是单数 `aclPrincipalUserId`（R11/R14）；
- worker 与 api 的 `sparseBulkSource` 只做「非空字符串」筛选（W15/W16）——**这是唯一「不会拦前缀」的一层**，但它在数据到达之前就被 W1–W5 与 W7 拦住了。

**唯一的非 uuid 例外**：哨兵 `ACL_PRINCIPALS_NONE_SENTINEL = '__acl_none__'`（`apps/api/src/services/retrieve/es-sparse.ts:43-45`，worker 同名常量 `apps/worker/src/ingest/es-http.ts:45`）。它**只进 ES 源、不进 PG**（`sparseBulkSource` 加进 source，`patchMeta` 只写 `[]`），因此 **PG 侧元素空间 = uuid 集合，ES 侧元素空间 = uuid 集合 ∪ {`__acl_none__`}**，两仓今天**已经不同形**（已核实）。

#### 2.4 「部门轴今天怎么展开」（供等价性核对引用）

- `apps/api/src/services/retrieve/dept-acl.ts:44-68` `effectiveLevel`：`ownerDeptId == null` → `assignments.some(isLeader) ? 30 : 20`（`:50-52`，**库级规则**）；否则对每个归属取「精确 ∪（`inheritDown` 时）祖先后代路径命中」的最大级别（`:53-68`）。
- 同文件 `:70-92` `grantEffectiveLevel`：grant 精确 ∪ grant 部门是 owner 的严格祖先；过期不取（`:88`）。
- 同文件 `:113-148` `isDocVisibleForDeptAcl`：`!enforce → true`、`bypass → true`；`vis = doc.visibilityLevel ?? 20`；`eff = max(assignEff, grantEff)`；`return eff != null && eff >= vis`（`:148`）。
- 同文件 `:150-186` `collectVisibleOwnerDeptIds`：归属精确 ∪ 子孙（inheritDown）、grant 精确 ∪ 子树，产出 ES `terms` 候选。
- 同文件 `:101-111` `maxVisibleLevelUpperBound`：`max(任一处负责人 ? 30 : 20, 未过期 grant.maxVisibilityLevel)`——**ES 侧的粗上界**，`lte` 比较，注释 `:98-99` 自证「取上界 ⇒ 只缩小命中集」。
- ES 侧：`es-sparse.ts:116-121`（部门组 `terms ∪ must_not exists`）、`:170-180`（级别组 `lte ∪ 缺字段放行`）、`:83-89` 注释明确「两组必须是 filter 数组的两个**独立元素**，并进同一 should 即放松」。
- 查询期装载：`visibility.ts:43-62` `loadVisibilityContext`，`!enforce || bypass` 时**短路为空 ctx 且不查库**（`:52-54`）。

---

### 3. 等价性核对（路径 A）

#### 3.1 用户轴：**等价，差别只在前缀**

| 维度 | 今天（裸 uuid） | §5 `:1862` 字面（`user:{id}`） | 是否一致 |
|---|---|---|---|
| 匹配方式 | 精确相等（`doc-acl.ts:18`；`es-sparse.ts:160`） | 精确相等（前缀 + id） | ✅ 一致 |
| 是否含 `≥` / 树 / grant 语义 | 无 | 无（§5 把树/级别语义交给 `dept:…:lv:…`） | ✅ 一致 |
| 元素来源 | 运营手填（admin 表单 W17） | 身份服务展开（ES PRD `:117` 要求「由身份服务展开」） | ⚠️ **不同**：今天**没有身份服务**，是人工/接口手填裸 uuid |
| wire 拼写 | `{ term: { aclPrincipals: "<uuid>" } }` | `terms: { aclPrincipals: ["user:u1", …] }`（ES PRD `:114`） | ❌ **不同**（仅符号层面） |
| 入参名字 | `aclPrincipalUserId?: string`（单数） | `userPrincipals?: string[]`（ES PRD `:154-155`） | ❌ **不同**（形状层面，非语义） |

→ **可读集合逐位一致**；不同点有三：**拼写**、**单值 vs 集合**、**无身份展开器**。前两者是纯符号/形状，第三者在用户轴上**不产生语义差**（单用户身份展开成集合后仍只有 `user:{id}` 一个元素）。

#### 3.2 部门轴：§5 `:1865` 已授权的「另一支」已被走，而且**枚举形态本身不可互换**

§5 `:1865` 逐字把 `owner_dept_id` + `visibility_level` 写成 `aclPrincipals` 的**等价替代**（「或等价结构化字段：…由检索层展开为可匹配条件」）。今天的分工正是这样：`aclPrincipals` 只承载用户轴，部门轴走结构化字段 + 检索层展开。

**关键：`dept:{deptId}:lv:{level}` 枚举形态不能表达下列四件事**（已核实，对照 `dept-acl.ts`）：

| ADS-057 §3/§5 的规则 | 今天怎么表达 | 纯枚举形态能否表达 |
|---|---|---|
| 有效级别 **≥** 文档级别（用户 40 可读 level=10 文档） | `eff >= vis` 数值比较（`dept-acl.ts:148`） | ❌ 不能：枚举需文档侧预写 `dept:D:lv:10/20/30/40` 全组合，否则 `dept:D:lv:40` 与 `dept:D:lv:10` 不等 |
| **上级看下级**（祖先命中，产品拍板 0.4.32） | `isAncestorPath` 在查询期按树展开（`dept-acl.ts:41-42`、`:56-66`、`:169-176`） | ❌ 不能：用户集合里只有自己的部门，文档侧无法预知所有祖先 |
| 跨部门 grant（精确 ∪ 祖先子树） | `grantEffectiveLevel` + `collectVisibleOwnerDeptIds`（`:70-92`、`:181-184`） | ❌ 不能（同「祖先」问题） |
| **文档无 ownerDeptId = 库级** | `ownerDeptId == null` 独立分支（`dept-acl.ts:50-52`；ES 侧 `must_not exists ownerDeptId`，`es-sparse.ts:119-120`） | ❌ 不能：枚举无「无部门」记号，除非把「租户内全部部门 × 全级别」都写进文档 |

→ **纯枚举形态与今天的结构化形态在部门轴上语义不等价**；两者只有在「检索层照样跑同一份树/级别逻辑」时才等价——而这正是 §5 `:1865` 说的「由检索层展开为可匹配条件」，也正是今天代码在做的事。**唯一的例外**是 §5 允许在 ES 侧改走「预展开 `dept:{id}:lv:{level}` 主体」（ES PRD `:119` 括号内），这条**未被采纳**，采纳它意味着放弃 ES 侧的粗收窄（上界）而改为与 PG 逐位一致的精确集合。

#### 3.3 `null` / `[]` / 非空 的语义边界（今天 vs §5，逐条）

| 文档侧取值 | 今天读法（已核实） | §5 / ADR-009 / ES PRD / 术语表 | 一致 |
|---|---|---|---|
| 字段缺失 / `null` | **成员可读**（不受名单闸约束）：`doc-acl.ts:14`；ES `must_not exists`（`es-sparse.ts:157`）；**§4.3 表首行** | 同（ADR-009 `:155`、ES PRD `:123-125`、术语表 `:115`、安全 PRD `:222`） | ✅ |
| `[]` | **非超管不可读**（`doc-acl.ts:15-16`；ES 写哨兵使字段存在且无 term 命中，`es-sparse.ts:146-148`） | 同（同上四处；ES PRD `:126`） | ✅ |
| 非空（仅用户轴） | **仅命中 `userId` 者可读** | §5：非空 = 命中 `user:{id}` 或 `dept:…:lv:…` 元素者可读 | ⚠️ **落在前缀拼写 + 是否有 dept 元素**上（若文档同时走结构化部门轴，则部门轴仍是 AND 条件，见下） |
| 无 `userId`（AUTH_ENFORCE 关时的无名请求） | 非空名单 → `false`（`doc-acl.ts:17-18`）；ES：只有 `must_not exists` 一支（`apps/api/tests/ask/es-principals-query-filter.test.ts:129-131` 断言） | 未直接规定；属 fail-closed 实现选择 | — |

#### 3.4 求交顺序 / 超管旁路 / 库级规则

- **求交顺序**：`isDocVisible` 先部门后名单（`visibility.ts:71-88`）；**AND 可交换，顺序只决定 `reason` 与 403 文案**（`:38`、`:823`、`chunks.ts:78`）。ES 侧对应「两个独立 filter 元素」（`es-sparse.ts:83-89`）。**已核实**。
- **超管旁路**：`bypass` 一把穿透两道闸（`doc-acl.ts:11`、`dept-acl.ts:125`、`visibility.ts:52-54`、`retrieve.ts:124-134` 与 `:206-210` 的「不 applyAclPrincipals」）。与 ADR-057 `:1868`「超管默认**绕过**部门可见性（与 051 全权一致）」一致；**名单闸同被绕过**——ADR-057 未明文要求超管绕过名单闸（只说部门），但 ADR-051 全权 + 仓内既有测例（`doc-acl-principals.test.ts:19-23`、`documents-acl-endpoint.test.ts:123-128`）把它钉成本行为。**已核实**。
- **文档无 `ownerDeptId` 的库级规则**：PG `effectiveLevel` 走 `assignments.some(isLeader) ? 30 : 20`（`dept-acl.ts:50-52`），即**无部门用户默认 20 也能看见库级文档**；ES 侧 `must_not exists ownerDeptId` 那一支 + 级别组 `lte` 承载（`es-sparse.ts:101-105` 注释自陈「该规则的级别正确性由级别组的 `lte` 承载」）。与 ADR-057 §4 表「文档无 `owner_dept_id` = **库内成员可见**」一致。**已核实**。

#### 3.5 「差别是否**只**在前缀语法本身？」—— 不是，共 4 项（3 项是符号/形状，1 项是实质空缺）

1. **拼写**：`{id}` vs `user:{id}`（符号层）；
2. **集合 vs 单值**：`aclPrincipalUserId: string` vs `userPrincipals: string[]`（形状层；ES PRD `:154` 已声明后者）；
3. **无身份展开器**：ES PRD `:117` 要求「由身份服务展开」，仓内**不存在**该服务；今天靠运营/接口直填（admin 表单 W17）；
4. **`role:` 主体完全不存在**（实质空缺）：不是「拼写不同」，而是**没有任何 role→principal 的展开面，也没有任何地方接受 `role:…`**。它与「门禁只加严不放宽」无关（`role:` 只会让人多看到东西，是**放宽**方向，所以它更像「未实现的能力」而不是「欠的拼写」）。

→ 用户轴的第 1、2 项 = **纯前缀/形状**；第 3 项在用户轴无语义后果；第 4 项不在 ADR-057 §5 的必达列表里（见 §1.1）。

#### 3.6 路径 A 能否只靠「补口径与回写」闭合？—— **取决于对 `:1862` 的读法，且这是 `prds/00–11` 的读法裁定**

- **实质读法（今天可支撑）**：§5 的 `principals` 描述的是**语义集合**（「当前用户的主体集合」），`:1865` 又明确文档侧可用「等价结构化字段由检索层展开」。用户轴的「等价」在语义上成立（精确身份匹配，一字不差地对应 `user:{id}` 的匹配能力）；前缀是 wire 记号。按此读法，**路径 A 成立**，只需把镜像文与 spec 的欠债句改准（见 §6），**不改 `prds/00–11`**。
- **字面读法（今天不满足）**：`:1862` 写的是集合元素 `user:{id}`；今天 ES 上的 term 是 `{id}`（`es-sparse.ts:160`），ES PRD `:114` 的示例也写成带前缀。按字面读法，**查询侧主体集合的拼写今天不达标**；而 `:1862` 在 `prds/00–11` 里，**镜像文（`docs/module-status/`、`docs/testing/coverage/`）无法覆盖它**。此时要么走 §5 `:1865` 未覆盖的用户轴补 ADR 读法，要么按 `Claude.md` 的改动序（ADR → 改 PRD → 升版本）落一次文本。
- **本节不下结论**：这是契约/文本层裁定，不属研究代理职权。**但可确定的事实是**：**两条读法的差别只在「前缀是否算语义」，而不在任何可读集合**——这一点由 §3.1–3.4 的四条核对支撑。

---

### 4. 路径 B（补身份展开器）的最小落点与回归面

> 目标形态假设：文档侧 `aclPrincipals` 承载 `user:{id}`（并可选 `role:…`），查询侧由身份服务展开 `user:{id}` + `dept:{deptId}:lv:{eff}`；部门轴**保持今天结构化那一支**（否则会出现双轴 AND 的意外加严，见 §4.3 注）。

#### 4.1 DB：**必须迁移**（已核实）

- 现状：`packages/db/src/schema/kb/documents.ts:60` = `uuid('acl_principals').array()`；`packages/db/drizzle/0014_p3b_acl_principals.sql:1` = `uuid[]`。
- 写 `user:…` / `dept:…:lv:…` 会**在 PG 层直接失败**（`invalid input syntax for type uuid`）→ 列须改为 `text[]`，需要一条新 migration（`ALTER TABLE documents ALTER COLUMN acl_principals TYPE text[] USING acl_principals::text[]`，或新列 + 回填）。**该错误类别为「只读推断、未实跑」。**
- `packages/db/tests/ingest/documents-schema.test.ts:20-22` 只断言列名 `acl_principals`、**未断言类型** → 改类型**不会改红**该测例（但其标题「nullable uuid array」会变成陈旧文案）。

#### 4.2 契约校验放宽的**边界**

需改的 5 处（W1–W5）：`document.contract.ts` `:86` `:110` `:244` `:270` `:278`。

**可接受的放宽（若采纳 §5 拼写）**：

```
裸 uuid  |  user:{uuid}  |  role:{code}  |  dept:{uuid}:lv:{10|20|30|40}
```

即把元素校验由 `z.string().uuid()` 换成**具名枚举 union**（前缀白名单 + 后缀形状校验），保留 `.max(256)` 与 `.nullable()`，`.strict()` 不动（`:271`、`:280`）。

**不可接受的放宽**：`z.string().min(1)`（任意非空串）。判据：那会让 `['foo bar']`、`['<script>']`、`['user:']` 全部静默落库。虽然**不直接放宽可读集合**（这些串谁也命中不了，反而等于把文档锁死），但它**拆掉了运营侧「防止误填造成自锁」的唯一静默门禁**，而本仓红线是「门禁只加严不放宽」（`Claude.md` Conventions「门禁只加严不放宽」）。→ 放宽必须**带上形状校验**，不能是「任意串」。

**必须同时兼容旧值**：读侧要接受**裸 uuid 与 `user:{uuid}` 并存**（存量行是裸 uuid，W8 的列里已有数据），否则存量文档会**整体变不可读**（那是意外的加严/静默丢可见性，比放宽更危险）。

#### 4.3 PG 谓词怎么展开

- `apps/api/src/services/retrieve/doc-acl.ts:8-19` 需从「单 `userId` 相等」改成「**主体集合 ∩ 文档名单 ≠ ∅**」：入参形如 `{ principals: readonly string[]; bypass?: boolean }`，匹配时对 `aclPrincipals` 每个元素做**归一化比较**（裸 uuid 与 `user:{uuid}` 视为同一身份）。
- 主体集合的产出点在 `apps/api/src/services/retrieve/visibility.ts:69-88`（那里已有 `ctx.assignments/depts/grants/now`）：`user:{id}` + 对每个归属 `dept:{deptId}:lv:{effectiveLevel}` + 未过期 grant 的 `dept:{deptId}:lv:{maxVisibilityLevel}`。
- **注（重要）**：若部门轴**继续**走结构化字段，则主体集合里的 `dept:…` 元素**不应**与部门轴做 OR——否则会把「部门轴 AND」降级为「OR」= **放松**。两种自洽做法：(i) 部门轴只留结构化支，主体集合只出 `user:`/`role:`（推荐，语义与今天一致）；(ii) 部门轴改走 `dept:` 元素（等价于 ES PRD `:119` 的「预展开」），此时必须删除/停用 `ownerDeptId`+`visibilityLevel` 的比较支，否则双支 AND。
- **求交顺序**保持 `visibility.ts` 现状即可（部门 → 名单；AND 可交换，只影响 `reason`）。

#### 4.4 ES 入参与查询期怎么改

| 项 | 现状（行号） | 路径 B 最小改法 |
|---|---|---|
| 查询期 clause | `es-sparse.ts:154-162` `aclPrincipalsFilterClause(userId?: string)` → `term` | 改为接受 `string[]`：`should` = `must_not exists` ∪ `terms: { aclPrincipals: [...principals] }`；空数组时只留 `must_not exists`（与今天 `es-principals-query-filter.test.ts:129-131` 的断言同形） |
| builder 入参 | `:192-215`（`aclPrincipalUserId?: string`） | 换成 `aclPrincipals?: string[]`（或按 ES PRD `:154` 命名 `userPrincipals`）；`applyAclPrincipals` 布尔可保留 |
| 检索层类型 | `types.ts:85-98` `SparseSearcher` | 同步改签名 |
| 调用点 | `retrieve.ts:193-212` | 由「传裸 `input.userId`」改为「先算主体集合再传」 |
| 新增 IO | `visibility.ts:52-54` 今天在 `!enforce` 时**短路不查库** | **用户轴 aujourd 不跟 `DEPT_ACL_ENFORCE`（`retrieve.ts:78`）**，所以若主体集合含 `dept:…`，就必须在 **enforce 关时也加载 assignments/grants** → **ask 路径新增每请求 DB IO**。这是路径 B 的真实代价（推断，未实跑）。若部门轴保持结构化支（4.3(i)），则不新增 IO |
| mapping | `es-sparse.ts:59-70`、`:277-279`（补映射） | **无需改**（`keyword` 已能存前缀串） |
| bulk | `es-sparse.ts:132-150`、worker `es-http.ts:71-90` | **无需改**（已按「非空字符串」写） |
| 哨兵 | `es-sparse.ts:43-45` | 无需改；但语义上「字段存在且无 term 命中」在 `terms` 数组为空时仍成立 |

#### 4.5 worker 同名拷贝

`apps/worker/src/ingest/es-http.ts` 的 `sparseBulkSource`（`:71-90`）与常量（`:45`）**不需要改**；调用点 `pipeline.ts:926-938`（`:936` 传 `doc.aclPrincipals`）也不需要改。**路径 B 的 worker 侧改动量为 0**（已核实：两侧 bulk 函数都只做非空字符串筛选）。

#### 4.6 回归面清单（会被改红或必须改签名）

| 文件 | 为什么会被动到（已核实的行号） | 类别 |
|---|---|---|
| `packages/contracts/tests/ingest/document-contract.test.ts` | `:143-152`「rejects invalid or overlong aclPrincipals」（`'not-a-uuid'` 断言 false）；`:264-273` PATCH 同款；`:289-292` `DocumentAclSchema` 拒 `['x']`；`:306-311` PUT 超 256 | **必改红**（若放宽元素形状） |
| `apps/api/tests/ask/es-principals-query-filter.test.ts` | `:12` 导入 `aclPrincipalsFilterClause`；`:96-133` `buildAclFilter` 精确断言；`:135-172` `searchSparseEs` 请求体断言；`:292-383` `runRetrieve` 捕获 `applyAclPrincipals/aclPrincipalUserId` | **必改签名 + 改断言**（本票点名的文件） |
| `apps/api/tests/ask/es-sparse.test.ts` | `:136-137` 传 `applyAclPrincipals: true, aclPrincipalUserId: 'u-1'`；`:186-201` mapping 精确断言（mapping 不变可保留） | **必改签名** |
| `apps/api/tests/acl/doc-acl-principals.test.ts` | `:19-51` 逐态断言（含 `[OTHER, USER]` 命中）；若谓词改成集合，入参形状变 | **必改签名**（语义断言可保留并扩前缀用例） |
| `apps/api/tests/acl/documents-acl-principals.test.ts` | `:134-146`「非法 uuid → 400」；`:149-158` 列表过滤期望；`:176-189` `filterDocsForAclPrincipals` | **必改红**（非法 uuid 用例） |
| `apps/api/tests/acl/documents-acl-endpoint.test.ts` | `:214-229`「非法 body（非 uuid / 多余字段 / 缺字段）→ 400」（`'not-a-uuid'`） | **必改红** |
| `apps/api/tests/ingest/sensitive-complete.test.ts` | `:302-306`「非法 aclPrincipals → 400 VALIDATION_ERROR」 | **必改红** |
| `apps/api/tests/ask/retrieve-run.test.ts` | `:151-170`（forwards userId）、`:213-231`（forwards bypassDeptAcl）、`:233-252`（member 不转发）—— 只读 `input.userId`/`input.bypassDeptAcl`，**新增可选字段不会破**；但若 `CorpusLoader` 入参改名/改必填则会破 | **视实现而定**（最小实现下不动） |
| 所有用 `loadCorpus` **注入夹具**的测例 | `acl-tighten-index-lag.test.ts:55`、`ask/embed-budget.test.ts:46`、`ask/es-principals-query-filter.test.ts:83`、`ask/es-dept-query-filter.test.ts:102`、`ask/mongo-body.test.ts:36`、`ask/retrieve-run.test.ts:55/104/450`、`ask/sparse-kb-filter.test.ts:55`、`ask/scope-hr-excludes-finance.test.ts:60/94`、`ask/needs-ocr-not-retrievable.test.ts:48`、`ask/pending-not-retrievable.test.ts:47`、`ingest/upload-to-active-retrievable.test.ts:164` —— 全是 `async () => corpus` / 只读少数字段 | **不受影响**（新增可选入参向后兼容） |
| 用**真** `loadCorpusFromDb` 的测例 | `acl/dept-acl-ask-e2e.test.ts:145/153/166/308`、`acl/visibility-single-function.test.ts:74/142/205` | **视 4.3(i)/(ii) 选择**：走 (i) 则不动；走 (ii) 则两文件期望全变 |
| `packages/db/tests/ingest/documents-schema.test.ts` | `:20-22` 只断言列名，改 `uuid[]→text[]` **不改红**（标题陈旧） | **不必改**（但应改文案） |
| `apps/api/tests/index.md` / `packages/contracts/tests/index.md` / `apps/worker/tests/index.md` | 三张登记表都有「uuid 名单」口径行（如 `apps/api/tests/index.md:38`/`:62`、`packages/contracts/tests/index.md:38`、`apps/worker/tests/index.md:36`） | **必须同步改**（规则：改测例必登记 index） |

#### 4.7 是否会强迫改 `CorpusLoader` 签名（与 tenantId 缺口叠加）

- `CorpusLoader` 今日入参：`{ kbId, scope?, userId?, bypassDeptAcl? }`（`apps/api/src/services/retrieve/types.ts:75-83`）—— **不含 `tenantId`**；`corpus.ts:70` 用 `dual[0]?.tenantId`（**第一份文档行的租户**）兜底填 `subject.tenantId`。这就是本票提到的已知缺口（**已核实**）。
- **最小实现下路径 B 不强迫改 `CorpusLoader` 签名**：展开发生在 `visibility.ts:69-88` 内，那里的 `ctx` 已含 `assignments/depts/grants`，不需要 `tenantId` 之外的新入参；`CorpusLoader` 只是 `loadCorpusFromDb` 的壳。给入参加**可选**字段（如 `principals?`）也不会破任何注入夹具（§4.6 表「不受影响」行）。
- **但**：如果图后续要把「部门轴也改成 `dept:…` 元素」（4.3(ii)），或要按 tenant 精确加载（而不是 `dual[0]` 兜底），`tenantId` 就从「可选兜底」变成「承重」——那时 `types.ts:75-83` + `corpus.ts:70` + `retrieve.ts:136-142`（`runRetrieve` **不传** `tenantId` 给 `loadCorpus`）三处必须一起动，且 `retrieve-run.test.ts` 的「forwards userId / forwards bypassDeptAcl」两条会被扩写。**这是路径 B 与 tenantId 缺口真正叠加的地方**（推断，未实跑）。

---

### 5. 只加严核对：路径 B 落地后「400 拒 → 200 接受」的输入清单

**共 4 个写入口**（已核实解析点；`DocumentAclSchema` 只用于响应，故不计入「写入口」）：

| # | 入口 | 400 判定点 | 今天 400 的输入 | 路径 B 后变 200 的**最小集** | 可接受？ / 判据 |
|---|---|---|---|---|---|
| 1 | `POST /knowledge-bases/:kbId/documents/:docId/complete` | `routes/documents/index.ts:261-265` | `aclPrincipals: ['not-a-uuid']`、`['user:…']`、`['dept:<uuid>:lv:20']`、`['role:finance']` | **仅**具名前缀合法形状（`user:{uuid}` / `role:{code}` / `dept:{uuid}:lv:{10\|20\|30\|40}`） | **可接受**：元素仍受白名单 + 形状校验（§4.2）；判据 = `prds/00–11` 未规定语法（§1.2），且这是与 §5 `:1862` 拼写对齐的方向 |
| 2 | `POST …/documents/write` | 同文件 `:289-292` | 同上 | 同上 | **可接受**（同上） |
| 3 | `PATCH /documents/:docId` | 同文件 `:718-723` | 同上 | 同上 | **可接受**（同上） |
| 4 | `PUT /documents/:docId/acl` | 同文件 `:861-864` | 同上 | 同上 | **可接受**（同上） |

**若放宽成「任意非空字符串」**（`z.string().min(1)`）**则不可接受**：`['x']`、`['User:abc']`、`['user:']`、`[' ']` 之类会静默落库。判据：

1. 本仓红线「门禁只加严不放宽」（`Claude.md` Conventions）；
2. 这类输入虽**不扩大可读集合**（无人命中 ⇒ 文档被锁死，属**自伤**而非泄漏），但会**删掉**唯一的静默校验，使运营误填不再被拦 —— 「只加严」的红线管的是**门禁强度**，不是「是否泄漏」；
3. ES 侧 `keyword` 会把 `'x'` 原样索引（`:146-148`），PG 侧改类型后也会原样存 → **没有任何一层会兜住**（已核实的结构性事实）。

**另外两项「400 → 200」不是放宽，但必须同时成立**（否则路径 B 会变成静默加严）：

- **回读侧**：`DocumentAclSchema`（`:270`）+ `DocumentListItemSchema`（`:208`）必须同步放宽，否则存量/新写的前缀值会让 `GET /documents/:docId/acl`（`:850`）与列表 `parse` **抛错**（推断，未实跑）→ 表现为 500，而不是 400。
- **兼容侧**：读侧必须**同时接受裸 uuid**（§4.2 末），否则存量文档会整体掉出可读集合（**静默加严**，比放宽更难被发现）。

**与 `aclTightens` 的交互**（`document.contract.ts:299-310`）：它按**字符串**比较。`['A'] → ['user:A']`、`['user:A'] → ['A']` 都会被判为「收紧」（false positive）→ 只是多提示一次 `reindexRequired`，**方向安全**。是否会出现「应判收紧却判放宽」的 false negative：在 4.2 的「带形状校验 + 读侧归一化」方案下，两边元素仍是字符串，`previous.some(p => !nextSet.has(p))` 的保守性不变 → **推断不会出现 false negative**（未实跑，建议落测例钉住）。`null → 任意非空` 仍是 `true`（`:308`），语义不变。

---

### 6. 镜像欠债句的准确边界（逐句）

#### 6.1 `docs/module-status/api.md`（5 处，8 个「≠ 角色 principal」字样）

| # | 行 | 原句（逐字，已核实） | 今天真正缺什么 |
|---|---|---|---|
| 1 | `:8`（默认依赖模式） | 「…aclPrincipals 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should 收窄；不跟 DEPT_ACL_ENFORCE；**≠** 角色 principal / 默认开）」 | 「默认开」准确（`DEPT_ACL_ENFORCE` 默认 false）。**真正缺的只有**：`role:…` 主体（仓内 0 支持）+ 用户轴的**前缀拼写/身份展开器**（§3.5）。**不该被读成**「名单闸未落」——PG + ES 两路闸都在（§2.2）。 |
| 2 | `:16`（一句话状态，第 1 处） | 「…aclPrincipals 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should 收窄；不跟 DEPT_ACL_ENFORCE；**≠** 角色 principal / 默认开）」 | 同 #1。 |
| 3 | `:16`（同句第 2 处） | 「敏感 KB complete 须 ACL 就绪（部门路径或显式名单；`null` 仍挡；**≠** 角色 principal / **≠** 仓库默认开）」 | 「`null` 仍挡」= `kb-settings.ts:223-230` 与 `ingest-complete-pending.ts:111-118` 的现状（已核实）。这里「≠ 角色 principal」的**真实边界**：sensitive 就绪判据只认「部门路径 ∧ 非空 ownerDeptId」或「名单路径 `aclPrincipals != null`」，**既不认 `role:` 也不认 `dept:` 元素**；即缺的是「第二种名单元素语法 + role」——**不是**就绪闸本身。 |
| 4 | `:94`（B5 部门小节） | 「…complete body 可同写 `aclPrincipals`；**≠** 仓库默认开 / **≠** 角色 principal」 | 同 #3；「可同写」= `CompleteUploadBodySchema:86` + `finalizePendingIngest:111-117` 已核实。 |
| 5 | `:162`（限制表「完整 ACL / 部门强制隔离」） | 「…aclPrincipals 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should；**≠** 角色 principal） / **无** 默认开」 | 同 #1；「**无** 默认开」准确。 |
| 6 | `:177`（限制表「跨部门授权、DEPT_ACL 强制」） | 「…ADR-057 全文未上（ES 部门 terms 已落、仍默认关；…aclPrincipals 用户 uuid 名单最小已落（PG + ES should）、**≠** 角色 principal）」 | **这一句的「ADR-057 全文未上」是欠债句里唯一需要收紧边界的**：ADR-057 **§5 的第二支**（`owner_dept_id`+`visibility_level` 由检索层展开）**已落**（§2.4 逐条）；§5 的「同一可见性函数」已落（`visibility.ts:16-18` 注释 + `tests/acl/visibility-single-function.test.ts`）；§4 的库级规则、上级看下级、grant 子树、超管旁路都已在谓词里。**真正「未上」的**：`dept:…:lv:…` 枚举支、`user:` 拼写、`role:` 主体、**强制默认开**。→ 该句今天把「等价支已落」和「枚举支未落」混成一句「全文未上」，**边界过宽**。 |

#### 6.2 `docs/module-status/contracts.md`（**0 处** —— 本票前提有误）

对 `docs/module-status/contracts.md` 做 `principal|角色码|uuid 名单|≠` 全文检索：**只命中 `:54`**「**`AskReasonSchema`** 含 `no_docs_in_scope`（类型收窄后空集；≠ `kb_not_ready`）」——与 principal 无关。该文件对 `aclPrincipals` 只有三处**纯形状**描述（`:34` 列表项含 `aclPrincipals`；`:74` `DocumentListItem` 含 `ownerDeptId`/`visibilityLevel`/`aclPrincipals`；`:76` 「`CompleteUploadBody` 可选 … `aclPrincipals`（omit 不改；`null` 清回未设；`[]` 显式空；**元素 uuid，最长 256**；旧 `{}` 仍合法）」）。

→ **contracts.md 里今天真正缺的是**：`:76` 那句「**元素 uuid**」在路径 B 下会变成不准确（要写成「元素为 `user:`/`role:`/`dept:…:lv:…` 或裸 uuid」）；以及**该文件没有任何一处记录「无 role principal / 无身份展开器」这条欠债**（它压根没写欠债句）。**不是**「欠债句边界不准」，而是「欠债句不存在」。

#### 6.3 `docs/testing/coverage/02-acl.md`（3 处）

| # | 行 | 原句（逐字，已核实） | 今天真正缺什么 |
|---|---|---|---|
| 1 | `:11`（本册口径） | 「文档级 `aclPrincipals` 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should 收窄；不跟 `DEPT_ACL_ENFORCE`；**≠** 角色 principal / 默认开强制）」 | 同 6.1 #1：缺 `role:` 主体 + 用户轴前缀拼写；**不缺**「名单闸」。 |
| 2 | `:44`（B2-1 缺口列） | 「—（补测：ask 问句泄漏的端到端已断言；**≠** 角色 principal）」 | B2-1 已判 `已测`，该列**没有欠测**。这里的「≠ 角色 principal」是**范围免责声明**（说明 B2-1 的 Then 不依赖 role principal）。→ **本行真正缺的是 0 项**；若要走路径 B 并要覆盖 role，应**新增行**（如 B2-5），不是在 B2-1 挂债。 |
| 3 | `:166`（非本阶段 / 明确的 ADR 债） | 「**明确的 ADR 债（本图不改 `prds/00–11`）**：`aclPrincipals` 的角色 principal 主体形态未落（**ADR-057 要求**，B2-2 因此只能作「移出 uuid 名单」的等价替换）；ES 查询期与 dense 对称的三条债（ADR-009 · ES PRD · 在线 PRD）。」 | **边界要收两处**：<br>(a)「ADR-057 要求」→ **不准确**：ADR-057 §5 `:1862-1864` 的必达只含 `user:{id}` 与 `dept:…:lv:…`；`role:` 只在 ES PRD `:75`（带「等」）、`:114` 示例、安全 PRD `:210`（带「等」）。**「角色 principal」是 ES PRD 的举例项，不是 ADR-057 的必达项**（§1.1 已核实）。<br>(b) 该句**漏了**真正的字面债：用户轴的拼写（`{id}` vs `user:{id}`）与 ES PRD `:117` 的「身份服务展开」、ES PRD `:154` 的 `userPrincipals?: string[]` 入参形状——这三条都在 `prds/03-data` 里，属**未被该句点名**的冻结文本偏离。 |
| 4 | `:10-11` 之间另有「**2026-09-21 本轮重判**：B2-1 / B2-3 补上末端到端与反向构造后转 **`已测`**；B2-2 保持 **`部分测`**（缺口只剩「角色码 principal」与须真 ES 的那半截）」 | 同 `:11` 行内 | 与 #3(a) 同款：把「角色码 principal」当成 B2-2 的缺口是**对 ES PRD 举例项的诚实挂账**，但**前提措辞「缺口只剩角色码 principal」过窄**——用户轴拼写/身份展开器这一项未被列出。 |

#### 6.4 同款句子在别处（超出本票点名的三文件，仅备查）

- `docs/module-status/README.md:73`（ACL 矩阵行）与 `:82`（未覆盖能力表：「**部门级检索强制默认开 / 角色 principal**」）；
- `docs/module-status/admin.md:38`（「**无**用户下拉 / **无**角色 principal」）与 `:55`（「勾选本库强制 **≠** 仓库默认开 / **≠** ES 已对称 / **≠** 角色 principal」）；
- `apps/api/src/env.ts:108`（源码注释：「仍无角色 principal」）。
- 均与 6.1/6.3 同款边界：**准确的部分是「无 role principal」；不足以覆盖「用户轴拼写 / 身份展开器 / 入参形状」三项**。`admin.md:38` 的「**无**用户下拉」是**已过期的现状描述**（`P3b-USRPICK` 之后应有用户下拉——本次未核实该 UI 是否已落，标为**未核实**）。

---

### 7. 前提纠错（逐条 + 对目的地的影响）

#### 7.1 ✅ 本票前提「PRD 05 §2.4 只列两个端点、未规定语法」——**核实成立**

`prds/05-api/01-http-api-hono.md:231-235` 逐字只有标题 + 两个 HTTP 行；全文不含 `aclPrincipals`。**影响**：改元素语法属**契约层**决定，不必改 `prds/05-api`。

#### 7.2 ❌ 前提纠错：「`role:` 是 ADR-057 的必达要求」——**不成立**

`prds/11-decisions/00-adr-index.md:1861-1864` 的「至少含」列表**只有** `user:{id}` 与 `dept:{deptId}:lv:{effectiveLevel}`；`role:` 只出现在 ES PRD `:75`（`（…等）`）、`:114`（示例）、安全 PRD `:210`（`等`）。
**影响（对目的地）**：镜像与覆盖表里「**ADR-057 要求**角色 principal 主体形态未落」（`docs/testing/coverage/02-acl.md:166`）**措辞须改**为「ES PRD 字段表/查询示例列出的 `role:…` 可见主体未落」。这**降低**了「必须补 role」的强制等级（是举例项而非必达项），但**不改变**「`user:{id}` 拼写是否达标」这一独立争点（§3.6）。

#### 7.3 ➕ 前提遗漏：「仓内的 ES sparse 检索入参形状与 ES PRD §4.5 声明不符」

`prds/03-data/03-elasticsearch-bm25.md:145-158` 声明 `SparseRetriever.search(… userPrincipals?: string[])`；仓内是 `EsSparseSearchInput.aclPrincipalUserId?: string`（`apps/api/src/services/retrieve/es-sparse.ts:26-28`）+ `SparseSearcher`（`types.ts:95-97`）。同理 `:117` 要求「由身份服务展开」而仓内无此服务。
**影响**：即便裁定「路径 A 成立」，**这一条对比 `prds/03-data` 的字面偏离仍需在欠债句里据实写出**（今天的 `coverage/02-acl.md:166` 只写了「ES 查询期与 dense 对称的三条债（ADR-009 · ES PRD · 在线 PRD）」，没点出 `userPrincipals` 入参名与「身份服务展开」）。

#### 7.4 ⚠️ 对「本图能否在不改 `prds/00–11` 的前提下闭合」的影响

- 若采**实质读法**（§3.6）：可以。用户轴可读集合与 `user:{id}` 形态逐位一致（§3.1），部门轴走的是 §5 `:1865` 明文授权的等价支（§3.2），`role:` 非必达（§7.2）→ **本图可闭合，改动只落在镜像文 / spec / index**。
- 若采**字面读法**：**不能只靠镜像**。`user:{id}` 的拼写要求写在 `prds/11-decisions/00-adr-index.md:1862`（属 `prds/00–11` 冻结层），而仓内镜像**不得**覆盖冻结文本（`Claude.md`「冲突：冻结语义以 `prds/00–11` 为准」「改冻结语义：ADR → 改 PRD → 升 `prds/README.md` 版本」）。此时本图出口要么(a) 出一个**读法裁定 ADR**（说明「裸 uuid ≡ `user:{id}`，前缀为 wire 记号」或相反），要么(b) 走路径 B 把拼写对齐到 `:1862` 字面。
- **不依赖读法的确定事实**（可直接写进本图结论）：前缀符号本身**不影响可读集合**（§3.1–3.4）；真正的能力空缺是 **`role:` 主体（0 支持）** 与 **无身份展开器**（ES PRD `:117`）；部门轴的等价性**已经由代码兑现**（§2.4 + §3.2）。

#### 7.5 其它两处小纠错

- `docs/module-status/contracts.md` **没有**「≠ 角色 principal」句（§6.2）——本票「三处文件里所有写…的句子」中，该文件命中 0。
- PG PRD **未规定** `acl_principals` 的列类型（`prds/03-data/01-postgresql-schema.md:147` 只写「反范式 `aclPrincipals` **或** `owner_dept_id`+`visibility_level`」，`prds/` 下 `acl_principals` 零命中）→ `uuid[]` 是**实现自选**，改 `text[]` **不构成改 `prds/00–11`**（已核实）。

---

### 附：本 Answer 中「未实跑 / 只读推断」的清单

1. 写前缀串到 `uuid[]` 列会以何种错误（`invalid input syntax for type uuid` → 500）失败 —— **推断**（未连 PG 实跑）。
2. 放宽元素校验后，`GET /documents/:docId/acl`（`routes/documents/index.ts:850`）与列表项 `parse` 对前缀值的抛错行为 —— **推断**（未实跑）。
3. `aclTightens` 在拼写变体下**不会**产生 false negative —— **推断**（未实跑；建议落测例钉住）。
4. 路径 B 若把 `dept:…` 元素纳入主体集合，ask 路径会新增每请求 DB IO（今天 `visibility.ts:52-54` 在 enforce 关时短路）—— **推断**（未实跑、未压测）。
5. `docs/module-status/admin.md:38` 的「**无**用户下拉」是否为已过期描述 —— **未核实**（本票未读 admin 源码该面）。
6. 本 Answer 未运行 `pnpm test` / 未连真 ES / 未连真 PG / 未改任何源码或文档（除本工单）。所有「已核实」标签仅指**逐字读过该文件该行**。
