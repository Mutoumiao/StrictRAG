# 研究：可见性组装到底有几份、每份差在哪

Type: research
Status: resolved
Blocked by: —

## 问题

P3b 出口第 1 条（ADR-057 `prds/11-decisions/00-adr-index.md:1867`「列表预览、chunk 查看、ask evidence **同一可见性函数**」）要落到可执行的收敛方案，先得把**今天到底有几份组装、逐字差在哪**查清。已知至少五处：

| # | 入口 | 落点 |
|---|------|------|
| 1 | 文档列表 | `apps/api/src/routes/documents/index.ts:157-190` |
| 2 | 文档详情 / ACL 入口 | 同文件 `docReadDenied` `:818-860`（被 `:789-808` 与 `:879-886` 调用） |
| 3 | 分片预览 list/detail | `apps/api/src/routes/chunks.ts:61-105`（被 `:128-140`、`:164-180` 调用） |
| 4 | ask 语料装载 | `apps/api/src/services/retrieve/corpus.ts:76-98` |
| 5 | 是否有可检索文档 | 同文件 `hasRetrievableDocs:150-182` |

## Answer

### 1. 逐字对照表

| 项 | ①列表 `documents/index.ts:157-190` | ②详情/ACL `:818-860` | ③分片 `chunks.ts:61-105` | ④语料 `corpus.ts:76-98` | ⑤`hasRetrievableDocs:150-182` | 判定 |
|---|---|---|---|---|---|---|
| 部门 IO | `Promise.all(loadDeptAssignments, loadDeptNodes, loadDeptGrants)` `:172-174`（`if(enforce)` 内） | 同三连 `:835-837` | 同三连 `:78-80` | 同三连 `:80-85`，`skipDeptIo` 时 `[[],[],[]]` | 同三连 `:162-167` | **相同**（④⑤以常量短路替代 `if`） |
| 成员资格 IO | 无（中间件 `middleware.ts:186-192` 按 path `:kbId`） | `createDocMemberGate` 外层 `:793`/`:871` | `chunks.ts:134`/`:172` | 无（ask 中间件 + `retrieve.ts:107-109`） | 无 | **相同**：五处函数体内均无成员断言，断言都在调用方 |
| 谓词 | `filterDocsForDeptAcl` → `filterDocsForAclPrincipals` `:176`/`:187` | `isDocVisibleForDeptAcl` `:843` → `isDocVisibleForAclPrincipals` `:858` | 同② `:86`/`:101` | `filterDocsForDeptAcl` 嵌 `filterDocsForAclPrincipals` `:86-98` | 同④ `:169-179` | **同族**，仅集合/布尔包装不同 |
| 顺序 | 部门 → principals `:168-190` | 部门 → principals `:826-859` | 同② | 同（内层部门、外层 principals） | 同④ | **全相同**，无一处反序 |
| 超管 bypass 判定点 | `roleBypassesKbMembership(auth?.roles)` `:161` | `:825`（`input.roles`） | `:69`（`auth?.roles`） | 入参 `bypassDeptAcl`，来源 `routes/ask.ts:313` 同函数 | 同④ | 规则同源，**通道不同**（直判 vs 槽位） |
| enforce 关短路 | `if (enforce)` 不加载不判 `:162-185` | 同 `:826-856` | 同 `:70-100` | `skipDeptIo = !enforce \|\| bypass` `:78` + 谓词内 `:180-181` | 同④ `:160` | 输出相同，短路位置不同 |
| KB 覆盖 | `resolveDeptAclEnforce(parseDeptAclEnforceFromConfig(kb?.configJson))` `:158-159` | 同 `:826` | 同 `:67-68` | 同（`kbSettingsRepo.get`）`corpus.ts:74-77` | 同④ `:156-159` | 相同（同表同列 `documents.ts:107-114` ≈ `kb-settings.ts:425-441`） |
| tenantId 来源 | `rows[0]?.tenantId` `:170` | `doc.tenantId` `:835` | `doc.tenantId` `:78` | `dual[0]?.tenantId` `:72` | `dual[0]?.tenantId` `:154` | **不同**（三选） |
| `now` | 均未传 → 谓词内 `formatLocalDateTime()`（`dept-acl.ts:118`/`:183`） | 同 | 同 | 同 | 同 | 相同 |
| 输出形态 | 集合 | bool + 403 文案 `:854`/`:859` | bool + 403 文案 `:97`/`:102` | 集合（chunk） | bool | **必须保留的差异** |

### 2. 语义不等价：无（唯一"近似拷贝"是死代码）

五处**行为等价**，没有被放宽的拷贝。逐条反证：

- **`hasRetrievableDocs` 不是放宽版**：与 `loadCorpusFromDb` 的过滤链逐行同构（`corpus.ts:70-98` vs `:152-182`：同 `filterDocsForRetrieve`、同 tenantId 推导、同 `enforce`、同 `skipDeptIo`、同两层 filter、同 `{userId, bypass}`），且**全仓无调用方** —— `grep hasRetrievableDocs` 全仓仅 3 命中：定义 `corpus.ts:146`、再导出 `retrieve/index.ts:3`、注释 `corpus.ts:28`；`apps/` 与 `tests/` 均无引用。**它是死代码**（已由本轮复核确认）。
- **无漏 grant 展开**：grant 展开在谓词内部 `dept-acl.ts:72-91`，五处都经该谓词。
- **无漏 `deptInheritDown`**：①②③显式传 KB 解析值；④⑤只在 `skipDeptIo`（enforce 关或超管）时省略，此时谓词已短路，输出等价。
- **无顺序反转、无 bypass 判据分叉**（① 与 ④⑤ 的角色判据同函数 `packages/admin-catalog/src/role-templates.ts:81-83`）。

非等价的只有三条装配差异，且**都不是语义放宽**：

1. **tenantId 取值三选**：tenantId 真参与判定（`loadDeptAssignments` 按 tenant 过滤 `dept-acl.ts:208-214`；`loadDeptGrants` 用 tenant 校验部门 `:235-237`）。取错方向是 **fail-closed**（归属/授权为空 → 带部门文档一律不可见），是误拒而非泄漏。真值侧应取**请求权威 tenant**：`RetrieveInput` 已有 `tenantId`（`retrieve/types.ts:40`）但 `CorpusLoader` 签名未传（`types.ts:76-82`、`retrieve.ts:126-130`），④⑤只能从文档行反推 —— 接口缺口。
2. **超管 bypass 通道不同**：①②③直判角色；④⑤读 `membership` 槽，槽位可被调用方压低（`routes/eval.ts:321`、`scripts/run-l1-golden.ts:413`、`run-l2-golden.ts:260` 硬编码 `'member'` → 跑批不 bypass）。ADR-057 `:1868`「超管默认绕过部门可见性」是产品真值，①②③与 `ask.ts:313` 现网路径与之相符；④⑤的"槽位可压低"是**刻意的跑批口径，必须保留**（把角色判定塞回函数内部会放宽跑批）。
3. **成员断言位置不同**：①在中间件、②③在 handler 级 `createDocMemberGate`、④⑤在 ask 中间件 + `retrieve.ts:107-109`。ADR-009 `:151`「检索层二次成员断言」目前由调用链承担，收敛时**不得**让语料函数自带成员闸。

### 3. 收敛的候选接缝

建议落点 `apps/api/src/services/retrieve/visibility.ts`（纯函数）＋ Hono 级一次装载：

```ts
type Subject = { tenantId: string; userId?: string; bypass: boolean };   // tenantId 必传，禁从文档行推导
type VisCtx  = { enforce: boolean; inheritDown: boolean; now?: string;
                 assignments: DeptAssignment[]; depts: DeptAclNode[]; grants: DeptAclGrant[] };
loadVisCtx(subject, kbConfigJson): Promise<VisCtx>                       // 内部按 !enforce||bypass 短路为空
isDocVisible(doc, subject, ctx): { ok: true } | { ok: false; reason: 'dept' | 'principals' }
filterVisibleDocs<T>(docs, subject, ctx): T[]
```

- **IO 归属**：`loadVisCtx` 是唯一三连加载处；**是否调用**仍由入口按 `enforce/bypass` 决定（保持①②③的"关则不查"与④⑤的零 IO）。成员闸保持在接缝之外、仍是外层。
- **请求级缓存**：可复用 `apps/api/src/auth/doc-scope.ts` 的 `createDocMemberGate` 先例（请求级 `Map`），key 用 `\0` 分隔（参照 `apps/api/src/auth/kb-scope.ts:9-11`），key = `tenantId|userId|enforce|inheritDown|bypass`；使同请求内"详情 + ACL 名单"两入口只 load 一次（现 `:789`/`:871` 各 load 一遍）。跨请求不得共享。
- **必须保留的差异**：①④要集合而②③只要 bool；②③的 403 文案 `department acl denied` / `document acl denied` 由调用方按 `reason` 映射（`documents-acl-principals.test.ts:168` 断言该串）；⑤只要 bool；④的 `filterDocsForRetrieve`（ready∧active∧窗口∧docTypes）**不并入**可见性函数；ES 侧 `collectVisibleOwnerDeptIds` + `buildAclFilter` 保留为查询期投影，不得反向放宽 PG 闸。

### 4. 回归面（既有测例）

- ①列表：`apps/api/tests/acl/documents-dept-filter.test.ts`（`P3b-LIST` 段）、`acl/kb-member-gate.test.ts`、`acl/retrieve-dept-acl.test.ts`、`kb/dept-acl-enforce-resolve.test.ts`、`kb/dept-inherit-down.test.ts`、`kb/visible-list.test.ts`
- ②详情/ACL：`acl/documents-dept-filter.test.ts`（`GET /documents/:docId` 段）、`acl/documents-acl-endpoint.test.ts`、`acl/documents-acl-principals.test.ts`、`acl/doc-read-kb-member-gate.test.ts`、`acl/acl-tighten-index-lag.test.ts`
- ③分片：`acl/chunks-dept-filter.test.ts`、`ingest/chunks-http.test.ts`、`acl/doc-read-kb-member-gate.test.ts:230-245`、`acl/chunk-body-patch-denied.test.ts`、`ingest/chunks-query.test.ts`
- ④ask 语料：`acl/retrieve-dept-acl.test.ts`、`acl/acl-tighten-index-lag.test.ts`、`acl/documents-acl-principals.test.ts`、`ask/retrieve-run.test.ts:214-249`、`ask/ready-active-corpus.test.ts`、`ask/effective-window-corpus.test.ts`、`ask/scope-hr-excludes-finance.test.ts`、`ask/needs-ocr-not-retrievable.test.ts`、`ask/pending-not-retrievable.test.ts`、`ingest/upload-to-active-retrievable.test.ts`、`ask/es-dept-query-filter.test.ts`、`ask/es-principals-query-filter.test.ts`
- ⑤`hasRetrievableDocs`：**无任何测例**（关键词 `hasRetrievableDocs` / `kb_not_ready` / `loadCorpus` 查过 `apps/api/src`、`apps/api/tests`、`apps/api/tests/index.md`）

**未验证**：本票只读源码与测例，未实跑；"死代码"结论基于全仓 `grep`（3 命中，均非调用点），未做 AST 级引用分析。
