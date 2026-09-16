# 文档 ACL 端点最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 99

## Question

补 PRD 冻结、仓库缺失的文档 ACL 专用入口。

权威：

- `prds/05-api/01-http-api-hono.md` §2.4（231–236）：端点 `GET/PUT /api/v1/documents/:docId/acl`，「Phase 3；**P2 可无端点但不可导入敏感库**」。
- 功能表 §5.2（第 382 行）：「文档 ACL | `GET/PUT …/documents/:id/acl` | principals；缺省字段语义见安全 PRD | **P3b**」；§11（第 592 行）：「`aclPrincipals` 进索引；dense 与 ES 对称 filter；`[]` = 不可读；收紧须 reindex | **P3b**」。
- `prds/09-security/01-auth-acl-compliance.md` §3.6.1（213–221）：「**字段缺失 = 成员可读；`[]` = 成员不可读**」；§3.6（207–210）：dense ∥ ES 共用 `buildAclFilter`。

现状（源码 IS）：

- 判定与闸已落：`apps/api/src/services/retrieve/doc-acl.ts`（`null` 可读 / `[]` 不可读 / 否则按 `userId` 命中）；详情 403 在 `routes/documents/index.ts:739-741`；分片同滤 `services/chunks.ts:30,60-66`；语料 `services/retrieve/corpus.ts:86-95`（部门滤之后）；ES 侧 `services/retrieve/es-sparse.ts:31-52`（keyword + `[]` 写哨兵 `__acl_none__`）与 worker bulk 同构；ES 结果与 PG 现值求交 `services/retrieve/retrieve.ts:196-197`。
- 写面已落但走**多用途入口**：`PATCH /documents/:docId` 支持 `aclPrincipals` 三态（`routes/documents/index.ts:679-685` → `services/documents.ts:276`）；complete / write 也可带（`services/ingest-complete-pending.ts:238-255`、`routes/documents/index.ts:305-345`）。
- **缺**：`/documents/:docId/acl` 两个端点（全仓无该路由）。PRD §2.4 冻结的形状无人实现。

口径（本票钉）：

- `GET` → `{ docId, aclPrincipals: string[] | null }`，权限与详情同口径（`doc.view` WhenEnforced + 成员闸）；非成员 403、缺文 404。
- `PUT` body `{ aclPrincipals: string[] | null }`（**三态**：`null` = 回到「字段缺失/成员可读」；`[]` = 成员不可读；非空数组 = 仅命中者可读）。**权限码沿用 `PATCH /documents/:docId` 既有那一个**（实现时读源码确认，**禁止新造码**）。
- PUT 成功后 **GET 必须回读同一三态**（不得把 `null` 读成 `[]`）。
- 端点只是「专用入口」，**不改**检索语义：判定函数、PG 闸、ES filter、语料求交全部复用，不新增第二套。

### 做

- contracts：请求/响应 schema（`.strict()`；`aclPrincipals` 是 `string[] | null`，元素 uuid）。
- api：`routes/documents/` 下新增两个路由（组内既有分域风格），写路径经 `services/documents.ts`，**禁止 route 内散落 SQL**。
- 测例：新增 `apps/api/tests/acl/documents-acl-endpoint.test.ts`（GET 三态回读 · PUT `null`/`[]`/命中 · 非成员 403 · 缺文 404 · 未登录 401 · PUT 后 GET 一致）；沿用 `tests/acl/documents-acl-principals.test.ts` 的 memory repo 风格；无需真集群。

### 不做

- **不做** admin 编辑面（选择器/页面）—— 另批；现状 Textarea 手填仍可用。
- **不做** reindex-on-tighten：PG 闸即时生效且 ES 结果与 PG 求交，**这不是安全洞**，只是索引与现值不一致；要做须另票并写清语义。
- **不做** 成员 `allowedDocIds` / `ACL_DOC_IDS_MAX` / `acl_filter_too_large`。
- **不**默认开 `DEPT_ACL_ENFORCE`、**不**加角色 principal、**不**改 §14「ACL 就绪前禁敏感语料」口径。
- 不改 `prds/00–11`；不 `task.py create`；禁止 push。

收工：`.trellis/spec/api/backend/`（ACL / documents 相关节，含端点表与三态语义）+ `docs/module-status/api.md`（文档 ACL 行 + 证据指针）+ `apps/api/tests/index.md` 与 `packages/contracts/tests/index.md`。Answer 里写明「端点已落，admin 面与 reindex-on-tighten 未做」。

## Answer

**做了什么**

- contracts：`DocumentAclSchema`（`{ docId, aclPrincipals: uuid[] | null }`，`.strict()`）+ `PutDocumentAclBodySchema`（`{ aclPrincipals: uuid[] | null }`，`.strict()`，最多 256）。
- api：`GET/PUT /api/v1/documents/:docId/acl`（`routes/documents/index.ts`）。GET 三态回读（`null`/`[]`/名单）；PUT 走既有 `documentRepo.patchMeta({ aclPrincipals })` 同一写路径，回读用同一 DTO。
- **可见性闸抽成一处**：把详情路由里内联的「部门强制（开时）→ aclPrincipals 名单」判定提为同文件内的 `docReadDenied(...)`，**详情与 ACL 两个 GET 共用**。这是刻意的小重构：ACL 名单本身也是 ACL 元数据，若只在详情加严、ACL 口另写一遍，两处迟早分叉。详情路由改动只是把内联块换成一次调用，语义逐字保留（既有 acl 测例全绿）。
- 权限口径：GET = `requirePermissionWhenEnforced('doc.view')` + `docReadDenied`（**与详情同口径**）；PUT = `requirePermission('doc.editor')`（**与 PATCH 同一码，未新造码**），**刻意不叠可见性闸** —— `[]` 的文档对非超管本就不可读，写路径若也过闸，谁都修不回来（会把自己锁死）。PUT 响应回名单，与 PATCH 返回 `toDetail` 的暴露面一致，无新增泄漏。
- 测例：新增 `apps/api/tests/acl/documents-acl-endpoint.test.ts`（9 例：null 可读 / `[]` 403 / 名单内 200 与名单外 403 / 超管旁路 / 缺文 404 / 无令牌按 AUTH_ENFORCE 关放行而名单闸仍生效、开启则 401 / PUT 三态 + 写 `[]` 后非名单者读不到但超管能回读 / 非法 body 400 且不写仓 / 缺文 404 且不写仓 / enforce 开且无 `doc.editor` 403）；contracts `tests/ingest/document-contract.test.ts` 增 3 例（GET 三态与拒形 / 缺字段 / 超 256）。

**没做什么 / 边界（如实说）**

- **未做 admin 编辑面**（选择器/页面）：现状仍可用既有 Textarea 手填 uuid。要做须先定「选人来源」（KB 成员列表 vs 平台用户列表，涉权限面）→ 留雾。
- **未做 reindex-on-tighten**：**这不是安全洞** —— PG 闸即时生效，且 ES 结果与 PG 现值求交（`retrieve.ts`），索引滞后不构成泄漏；它只是索引与现值不一致。
- 未做成员 `allowedDocIds` / `ACL_DOC_IDS_MAX` / `acl_filter_too_large`；未默认开 `DEPT_ACL_ENFORCE`；未加角色 principal；未改 `prds/00–11`。
- **未验证 admin 侧**（本票没改 admin）。

**验证**：全仓 `pnpm test` 11/11 全绿（api **134 files / 856 passed** + 3 skipped；contracts 26 / **213**）· `pnpm check-types` 8/8 · `pnpm lint` **8/8 零 warning**（本轮已把 lint 债清零）。

**回写**：`.trellis/spec/api/backend/departments.md`（文档 ACL 专用入口一节）；`docs/module-status/api.md`（`aclPrincipals` 行 + 最近更新）；`apps/api/tests/index.md` 与 `packages/contracts/tests/index.md`。

## Comments

- 2026-09-16 由 [裁定 98](./98-after-96-order.md) 排为本批第二张：PRD 冻结端点，依赖已全落，只缺口子。
- 2026-09-16 完成。切边：不做 admin 面与 reindex-on-tighten；写路径不叠可见性闸（防 `[]` 文档无人能修），已写进 spec 与 Answer。
