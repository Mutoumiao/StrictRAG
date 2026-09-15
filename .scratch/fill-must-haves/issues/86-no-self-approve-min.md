# 提交者不可自审四眼最小闭环

Type: task
Label: wayfinder:task
Status: claimed
Assignee: grok
Triage: ready-for-agent
Blocked by: 85

## Question

补 P2 信任环真空：提交者默认不可批自己的单（四眼原则）从未落地。`documents.uploaded_by` / `approved_by` / `approved_at` 三列在 schema 里，**全仓无写入方**；approve / reject 只判 `approvalStatus`，不比对提交人；admin 审批面无「提交人」列。这是本批第一张。

权威：`prds/09-security/01-auth-acl-compliance.md`「禁自审默认｜提交者默认不可批自己的单（P2）」；`prds/05-api/01-http-api-hono.md` §approve（ADR-048）「鉴权 KB admin；校验 ticket pending；**默认拒绝自审**」；ADR-048 #4「**禁止**提交人审批**自己的** ticket（四眼；单 admin 租户可配置 `allowSelfApprove` 显式打开并审计，默认 **关**）」；`prds/03-data/01-postgresql-schema.md` 审批表「`decided_by` / `decided_at`；**默认 ≠ submitted_by**」；`prds/00-product/02-scope-and-non-goals.md`「普通文档人员默认自审通过入库｜禁止」；功能表 §4.3「审批通过 / 驳回｜提交者默认不可自审；驳回后仍禁止跑流水线」P2 / §4.4 三角色默认；`prds/10-delivery/03-acceptance-scenarios.md` 剧本 V3。

现状（源码）：

- `packages/db/src/schema/kb/documents.ts:38-40` — `uploadedBy` / `approvedBy` / `approvedAt` 列已定义，无写入方
- `apps/api/src/routes/documents/index.ts:433-459`（approve）与 `:461-486`（reject）— 只校验存在性与 `approvalStatus`，不取 actor
- `apps/api/src/services/documents.ts` — `approve()` / `reject()` 只写 `approvalStatus`（+ 既有 `approvedAt` 口径以源码为准）
- admin 审批面（`apps/admin/src/app/(ops)/approvals/`）无「提交人」列
- `prds/12-delivery-guides/03-功能地图.md` §审批中心线框**有**「提交人」列
- `docs/testing/coverage/01-ingest.md` 剧本 V3 = 缺实现；`prds/12-delivery-guides/04-交付控制台.md` #18 标「部分→缺口 QUAL-V3」

口径：

- `complete`（upload 源）与 `write`（editor 源 / Markdown 提交）**必须**写 `uploaded_by` = 当次 actor userId
- `approve` **必须**写 `approved_by` = 当次 actor userId（以及 `approved_at` 本地格式串）
- approve / reject 时 `actor.userId === doc.uploadedBy` → **403** + 明确业务码；`reject` 同样禁自决（四眼对「驳回」同口径，避免自审者自行驳回后重提规避）
- **无 actor 不误伤**：`AUTH_ENFORCE` 关 / 无令牌时 `actor.userId` 缺失 —— **不比对、不编造提交人**，行为与既有 `requirePermissionWhenEnforced` 一致（该关就关）
- `doc.uploadedBy` 为 null（历史文 / 未写）时**不拦**（不得因缺列把运营台锁死）；此时 approve 仍写 `approved_by`
- 已 `approved` 的幂等 approve 保持 200 语义，**不**因自审改判
- admin 审批面加「提交人」列；无提交人显「—」
- 禁止新增原生 `<select>`
- 测例禁止依赖墙钟、禁止真集群、禁止真 Gateway

### 做

- api：complete / write 写 `uploaded_by`；approve 写 `approved_by` + `approved_at`；approve / reject 自审闸 403；无 actor 不误伤；缺 `uploadedBy` 不拦
- contracts：若需要，补提交人字段与业务码（错误码短名进 `packages/contracts`；`error.code` = PRD 短名）
- admin：审批面「提交人」列
- 测例：
  - api：提交人自审 403；他人 approve 200 且写 `approved_by`；`uploaded_by` 落库；`AUTH_ENFORCE` 关时不自审拦截；缺提交人不拦
  - admin：审批面渲染提交人；无提交人显「—」

### 不做

- `allowSelfApprove` 显式开关（ADR-048 允许，方向是放宽，不进本批）
- 独立 `approval_tickets` 资源 / 表
- `approve` 自动入队 `ingest.scan`（V4 现状是两步）/ 改 `canEnqueueScan`
- 审计管理台 / Langfuse SDK
- 孤儿清理 / 角色树 / 分片策略审计 / 参数快照审计 / 签字包链 / 断线重拉 / 入场 `aclPrincipals` / citation 去重
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 默认开 rewrite / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api auth-authorization + quality-guidelines、admin quality-guidelines；`docs/module-status/` api · admin · worker（若涉及）。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/auth-authorization.md`、`.trellis/spec/api/backend/quality-guidelines.md`、`.trellis/spec/admin/frontend/quality-guidelines.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。
