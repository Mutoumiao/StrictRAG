# 文档读入口的 KB 成员闸（与写入口同口径）

Label: wayfinder:map
Status: resolved（前沿：空；15 个文档入口全在成员闸内）

## Destination

让「路径只有 `:docId`（没有 `:kbId`）的文档**读**入口」与写入口**同口径**落在 KB 成员闸内：持权限码但**不是该文档所属 KB 成员**的用户，不得经这些入口读到文档内容或元数据；`super_admin` 仍旁路；**不翻转仓库默认**（`AUTH_ENFORCE` 默认仍关）。到达时同时满足：

- **洞口闭合**：`GET /documents/:docId` · `GET …/acl` · `GET …/ingest-jobs` · `GET …/chunks` · `GET …/chunks/:chunkId` 五处，非成员一律 403 且**不返回任何正文 / 名单 / 账本**；成员与超管不受影响。
- **姿态可解释**：闸的宽严**只**由该入口权限码的姿态决定（与工单 14 同规则），不引入第二种口径；写在 spec 里能被下次核查直接引用。
- **不误伤**：既有跨库隔离、部门 ACL、aclPrincipals 三道闸的行为不退化；`AUTH_ENFORCE` 关时的 dev / demo 读路径照旧。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是它的镜像。
- **前图**：[`p2-exit-evidence`](../p2-exit-evidence/map.md)（已收口）。其工单 [14](../p2-exit-evidence/issues/14-dec-doc-write-kb-membership.md) 裁定「路径只有 `:docId` 的文档**写**入口不查 KB 成员资格」是**缺口**并落地 10 个写入口；读面当时**明确未动**，转雾到本图。本图就是那张雾。
- **依据（与工单 14 同源，不新增口径）**：
  - ADR-035 §决策 4（`prds/11-decisions/00-adr-index.md:500`）：「无 kb_members 行 → 该 KB 一切内容路径 403（ask、**读文档内容/列表**、上传、删文档、成员、KB config、feedback 队列、eval）」——读面被**点名**。
  - ADR-057 决策 2（`:1810`）：「可见文档 = **KB 成员**（或超管全权） ∧ ready ∧ active ∧ indexVersion ∧ 部门可见规则…」。
  - 这 5 个入口的权限码（`doc.view` / `chunk.view`）在 `packages/admin-catalog/src/permissions.ts` 里 scope 均为 **`kb`**，而 `canAccessKbScoped`（`apps/api/src/auth/permissions/resolve.ts:43-54`）对 kb-scope 码要求成员资格。
  - 中间件只在 path 有 `:kbId` 时取成员（`auth/middleware.ts:187-191`），故这些入口须由 handler 补闸 —— 与写面同一个机制。
- **姿态规则（沿用，不重议）**：闸姿态随**该入口的权限码**——`requirePermission`（始终验码）→ 始终查；`requirePermissionWhenEnforced` → 随 `AUTH_ENFORCE`（关则不查，**不翻转仓库默认**）。
- **顺序**：成员闸是**外层**，先于既有的 `docReadDenied`（documents）与 `deniedDocReadMessage`（chunks）——ADR-035 把「成员行」列为内容路径的前置，部门 / 名单是其后的第二层。
- **本机限制**：无浏览器验证手段 → web / admin 视觉改动不在本图。外部依赖（真 ES / 人签 / 真模型网关）不在本图。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts`，头注释「目标 / 需求 / 被测 / 简介」简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite / OCR 等默认值不在本图放宽或收紧。
- **质量红线不放宽**：门禁只加严不放宽；历史≠evidence；双就绪∧active 检索闸。
- **收口复核纪律（前图教训）**：声明收口必须在**最后一次提交之后**复跑 `pnpm check:module-status` —— 前图就吃过「检查跑在收尾提交之前，结论被自己的提交推翻」。

### 入口清单（2026-09-20 枚举，源码为据）

| 入口 | 位置 | 权限码 | 码的姿态 | 既有第二层闸 |
|------|------|--------|----------|--------------|
| `GET /api/v1/documents/:docId` | `apps/api/src/routes/documents/index.ts:815` | `doc.view` | WhenEnforced | `docReadDenied`（部门 + aclPrincipals） |
| `GET /api/v1/documents/:docId/acl` | 同上 `:889` | `doc.view` | WhenEnforced | `docReadDenied`（同一份判定） |
| `GET /api/v1/documents/:docId/ingest-jobs` | 同上 `:961` | `doc.view` | WhenEnforced | **无**（只验码） |
| `GET /api/v1/documents/:docId/chunks` | `apps/api/src/routes/chunks.ts:110` | `chunk.view` | **硬 `requirePermission`** | `deniedDocReadMessage` |
| `GET /api/v1/documents/:docId/chunks/:chunkId` | 同上 `:153` | `chunk.view` | **硬** | `deniedDocReadMessage` |

**已知影响面（静态枚举，未实跑）**：`chunks` 两个入口是硬姿态 → 挂闸后凡打到它们的测例都要注入成员桩。命中文件：`apps/api/tests/acl/chunks-dept-filter.test.ts` · `apps/api/tests/acl/chunk-body-patch-denied.test.ts` · `apps/api/tests/ingest/chunks-http.test.ts`。documents 三个入口是 WhenEnforced → 只有**显式打开 `AUTH_ENFORCE`** 的读用例会受影响（如 `acl/documents-acl-endpoint.test.ts` 的 enforce 开用例、`acl/documents-dept-filter.test.ts`）。收口前必须**实跑**拿真实红名单，不用静态推断顶替。

## Decisions so far

- [读入口枚举与各自姿态](./issues/01-research-read-entries.md) — 5 个入口（不是 2 个）；`chunk.view` 两个是**硬**姿态、`doc.view` 三个是 WhenEnforced；`ingest-jobs` 是唯一**连第二层闸都没有**的读入口（只验码就回账本）。影响面静态枚举 3 个 chunks 测例文件 + 若干 enforce 开用例。
- [读面姿态与先后顺序的裁定](./issues/02-dec-read-gate-posture.md) — 姿态**随码**（不新增口径）；顺序 = 成员闸在前、部门/名单在后；`AUTH_ENFORCE` 关且无 `auth` 时 `WhenEnforced` 系**不查**（跳过），**不**把读路径打成 401 —— 这样既闭上跨库读，又不翻转 dev / demo 默认。
- [共享闸模块 + 5 个读入口挂闸](./issues/03-task-shared-gate-and-read-entries.md) — 闸从 `routes/documents/index.ts` 的私有 helper 迁到 **`apps/api/src/auth/doc-scope.ts`**（`createDocMemberGate`，与 `kb-scope.ts` 同域，落实「禁止 route 私写」），`documents` 与 `chunks` 两路由共用；写面 10 处调用点机械改名。读面挂 5 处：`documents` 三个 `'whenEnforced'`、`chunks` 两个 `'always'`；`ChunkRouteDeps` 增 `resolveKbMember`。**实测影响面**：api 全量跑出 **2 文件 / 9 例**红（`acl/chunks-dept-filter.test.ts` 4 · `ingest/chunks-http.test.ts` 5，全是硬姿态的 chunks 读），仅注入宽松成员桩 + 三处装载点改造，**断言一字未改**；`acl/chunk-body-patch-denied.test.ts` 预期不受影响且实测确为绿（404 在闸之前返回）。新测例 `tests/acl/doc-read-kb-member-gate.test.ts`（4 例）断言「非成员 403 且数据仓**零调用**」（分片仓 `listByDocVersion` / `getById` 零调用、账本零调用）。**反证**：闸临时直放 → 读 4 + 写 5 共 **9/9 红**，还原后全绿。前图写面测例搬迁后仍全绿（搬迁回归证明）。**未做**：`ingest-jobs` 是否该有更严的码或审计（见雾）；`kb_members.role` 是否参与读闸（独立口径）。
- [回写规范与镜像](./issues/04-task-writeback.md) — spec `auth-authorization.md` 那一节由「写入口强制」扩成**读写同口径**（落点改为共享模块 + 挂点 15 个 + 顺序 + 两条测例）；`docs/module-status/api.md` 边界句覆盖读面并点明「成员闸 ≠ 可见性闸」；覆盖表 `02-acl.md` 口径注写明 15 个入口**且提醒 `S3` 口径冲突未解、必须保持 `部分测`**。

## Not yet specified

- **`GET …/ingest-jobs` 的暴露面**：该入口原先只验码（`doc.view`）就返回入库账本，连部门 / 名单闸都没有。本图已按「与其余读入口同口径」补上成员闸；但「账本是否该另有更严的码、或是否该记审计」属未定 —— 现在**任何** `doc.view` 持有者只要是该 KB 成员就能读全量入库账本（含对账计数与错误码），这个粒度是否合适留待另裁。
- **成员的 `kb_members.role`（read / write / admin）是否该参与读闸**：`canAccessKbScoped` 只看成员资格，不看 role。ADR-045 焊死 #3 要求「对某 KB 的写仍按该行 role」，读侧无对应条款 → 与前图同一独立口径，**不在本图**（覆盖表 `S5` 行记着）。本图落地后该问题**更显眼**了：现在一个 `read` 成员的 `doc.view` 持有者能读该库全部分片正文（若其角色模板带 `chunk.view`）。
- **404 与 403 的存在性探测面**：与写面同源（须先取 `doc` 才知 `kbId`）。本图不改 404 语义，故探测面依旧存在。

## Out of scope

- 改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- `kb_members.role` 参与闸（独立口径，S5 行）
- 切换任何生产默认开关 · 真 ES / 人签 / 真模型网关
- web / admin 的视觉与交互改动（本机无浏览器验证手段）
