# 文档 ACL 端点最小闭环

Type: task
Label: wayfinder:task
Status: pending
Assignee: —
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

## Comments

- 2026-09-16 由 [裁定 98](./98-after-96-order.md) 排为本批第二张：PRD 冻结端点，依赖已全落，只缺口子。
