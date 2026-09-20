# 覆盖分册 · acl

> 入口：[../coverage.md](../coverage.md)  
> 期望原文：[`prds/10-delivery/03-acceptance-scenarios.md`](../../../prds/10-delivery/03-acceptance-scenarios.md)  
> 本册：B · S · Y · W · Z · AE · X。判定以测例断言为准，不以 index 叙事抬覆盖。

口径（本册共用，不单独占行）：

- `AUTH_ENFORCE` **默认关**。`apps/api/tests/auth/enforce-401.test.ts` 只证明开 enforce 且无 Bearer → 401，以及默认关时 WhenEnforced 放行。B1 默认路径**不**当作生产 enforce 已测。
- `DEPT_ACL_ENFORCE` **默认关**。AE3 为兼容行为；AE4 起强制开属 P3 / 开强制后。
- 文档级 `aclPrincipals` 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should 收窄；不跟 `DEPT_ACL_ENFORCE`；**≠** 角色 principal / 默认开强制）。B2-2 / B2-3 已转**部分测**（收紧外显 `reindexRequired` + 「索引滞后不构成泄漏」夹具）；仍欠：角色码 principal、自动 reindex、dense 反向构造。
- 成员闸 / 分片 / 面板 / 设置 / 部门走 `requirePermission`（与 enforce 开关无关）；上传 / 审批 / lifecycle 多走 `requirePermissionWhenEnforced`。
- 路径只有 `:docId`（无 `:kbId`）的**文档写入口**另加 handler 级 KB 成员闸（`docWriteMemberDenied`，10 个入口，闸姿态随该入口权限码；2026-09-20 补）。

## 剧本 B · 权限（Phase 2 底线 / Phase 3 细粒度）

### B1 · Phase 2 底线 + 角色/码越权

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| B1-1 | 非成员且非超管 ask → 403 FORBIDDEN | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`non-member ask → 403 FORBIDDEN`，角色 `web_consumer`）；apps/api/tests/ask/http-validation.test.ts（`non-member → 403`） | — |
| B1-2 | read / 无 `doc.upload` 上传 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/auth/enforce-permission-matrix.test.ts（AUTH_ENFORCE=true：`web_consumer` 打 upload-url / complete → 403 `FORBIDDEN` 且 `error.message` 含 `doc.upload`；成员资格 mock 成全 true，403 只能来自缺码）；apps/admin/tests/ops/documents-workspace.test.tsx（无 `doc.upload` 不渲染上传）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（`web_consumer` 空码） | —（补测：两条上传入口逐条 403 并指名缺失码；默认 `AUTH_ENFORCE` 关时仍走 WhenEnforced 放行，非本行 Then） |
| B1-3 | doc_operator 邀请/改成员 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/members-http.test.ts（`剧本 B1-3`：doc_operator POST 邀请 → 403 `FORBIDDEN` + message 含 `member.manage`；DELETE 成员 → 403 且无副作用（成员仍在、角色未改）；同文件 PUT 无码亦 403）；apps/api/tests/acl/kb-member-gate.test.ts（缺 `member.manage` 403）；packages/admin-catalog/tests/acl/catalog-clip.test.ts | —（补测：POST 邀请 / PUT / DELETE 三条写入口已直打，并断言零副作用） |
| B1-4 | KB-A 的 kb_admin 对无码 KB-B 操作 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（kb_admin 非成员 manage → 403 membership）；apps/api/tests/kb/settings-http.test.ts（kb_admin 有码非成员 → 403） | — |
| B1-5 | super_admin 非该 KB 成员 ask / 管文档 → 200（须审计） | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`super_admin ask without membership → 200`；`B1-5`：超管非成员 PATCH KB 设置 → 200、POST 成员 → 201，对照 kb_admin 有码非成员 → 403「not a knowledge base member」）；apps/api/tests/obs/admin-write-audit.test.ts（`剧本 B1-5`：超管非成员的管理写仍落 `admin_write`，`childLogger` 上下文带 `kbId` / `userId` / `requestId`）；apps/api/tests/acl/permission-resolve.test.ts（超管 bypass 成员）；apps/api/tests/ask/retrieve-run.test.ts（`super_admin same path as member`） | —（补测：管文档 / 管库 HTTP 与审计均已补；审计仍为中间件 Pino，不落表） |
| B1-6 | 成员（含 read）ask → 200 业务路径可达 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`member ask → 200`，`web_consumer` 成员）；apps/api/tests/ask/retrieve-run.test.ts（member 返回 evidence）；apps/api/tests/ask/http-validation.test.ts（成员 + 顶层 scope 200） | — |
| B1-7 | 敏感语料未入池声明 · 检查表勾选 | UAT | UAT | UAT | — | prds/10-delivery/03-acceptance-scenarios.md（B1-7）；发布签字页「敏感语料未入池」 | 人签检查表，无自动化 |
| B1-8 | doc_operator `approval.decide` → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/auth/enforce-permission-matrix.test.ts（`B1-8 · Y3`：AUTH_ENFORCE=true 下 doc_operator POST approve / reject → 403 `FORBIDDEN` + message 含 `approval.decide`，对照同一令牌 GET 文档列表 200 证明不是整体无权限）；apps/api/tests/ingest/complete-pending-role.test.ts（对照：approve 403 后不落审批、不入队）；apps/api/tests/acl/permission-resolve.test.ts；packages/admin-catalog/tests/acl/catalog-clip.test.ts | —（补测：审批 HTTP 403 已直打；默认 `AUTH_ENFORCE` 关时仍走 WhenEnforced 放行） |

### B1-ACL · Phase 2 检索 ACL

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| B1-A1 | 大库（≥2k docs）成员 ask：不因 terms 失败；主路径无全库 docId 列表 | 大库环境 | UAT | UAT | api | apps/api/src/services/retrieve/corpus.ts（按 `kbId` 装载，源码无 `allowedDocIds`） | 无 ≥2k 文档夹具/压测；大库环境人签 |
| B1-A2 | 非成员绕过 API 直调检索层（同 kbId）→ `not_member`，不进召回 | 检索ACL | 注入 | 已测 | api | apps/api/tests/ask/retrieve-run.test.ts（`rejects non-member` → `{ ok: false, reason: 'not_member' }`）；apps/api/src/services/retrieve/retrieve.ts（`membership === 'none'` 先 fail） | — |
| B1-A3 | `allowedDocIds=null` 不得跨 KB 召回（null≠无 ACL） | 试点必签 | 单测 | 已测 | api | apps/api/tests/ask/retrieve-run.test.ts（`B1-A3 跨 KB 召回负向`：共享索引 sparse 返回他库 chunkId → 语料求交丢弃，evidence 及其序列化都不含该 id；`loadCorpus` 与 `sparseSearch` 收到的均为本次 `kbId`）；apps/api/src/services/retrieve/corpus.ts（`eq(documents.kbId, kbId)`） | —（补测：他库 chunk 混入的负向 + 两个查询口只带本库 kbId 已断言；`allowedDocIds` 字段本身仓内仍无，本行只主张「null ≠ 放开跨库」） |
| B1-A4 | 显式 `allowedDocIds` 且 len>5000 → `acl_filter_too_large`；不截断、无假 answered | 检索ACL | 契约 | 缺实现 | api | packages/contracts/src/ask/reason.ts（枚举有码）；apps/api/src/graph/reasons.ts（有文案映射）；apps/api/src/services/retrieve/retrieve.ts（从不返回该 reason） | 无 allowedDocIds 入参/过大闸；不得把枚举存在标成已测 |

### B2 · Phase 3 文档 ACL + 对称

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| B2-1 | 成员无文档 D 权限，问仅 D 能答的题：不得 verified 泄漏 D；evidence 无 D | P3 文档ACL | 注入 | 部分测 | api | apps/api/tests/acl/doc-acl-principals.test.ts；apps/api/tests/acl/documents-acl-principals.test.ts（`filterDocsForAclPrincipals` 未授权文档不进结果）；`loadCorpusFromDb` 部门滤后再 principals | 无 E2E 问句泄漏 / 无 ask HTTP evidence 断言 |
| B2-2 | principal 变更（移出 role）+ reindex 后该文档对该用户不可检索 | P3 文档ACL | 单测 | 部分测 | api | apps/api/tests/acl/documents-acl-endpoint.test.ts（PUT 收紧回 `reindexRequired`）；apps/api/tests/acl/acl-tighten-index-lag.test.ts（PG 闸即时：ES 旧命中不进 evidence） | 角色码 principal 未做；**无自动 reindex**（收紧只外显 `reindexRequired` + 日志，须人工 Reindex；前置：缺「激活 version」表示） |
| B2-3 | dense 单路亦过文档 ACL（构造「dense 不过滤会召回」） | P3 文档ACL | 单测 | 部分测 | api | apps/api/tests/acl/acl-tighten-index-lag.test.ts（dense 输入即闸后语料，稀疏旧命中被丢弃、语料空则 `kb_not_ready`）；apps/api/tests/acl/doc-acl-principals.test.ts（`filterDocsForAclPrincipals`） | 无「绕过 loader 让 dense 召回不可读块」的显式反向构造（现构造里 loader 就是闸） |
| B2-4 | 缺省无 `aclPrincipals` → KB 内成员可读；显式 `[]` → 不可读 | P3 文档ACL | 单测 | 已测 | api | apps/api/tests/acl/doc-acl-principals.test.ts（null 可见 / `[]` 不可见）；apps/api/tests/acl/documents-acl-principals.test.ts（PATCH 三态；列表 `[]` 不含、null 含）；packages/contracts/tests/ingest/document-contract.test.ts | — |

**安全签字（原文）**：B1 + B1-A3 试点必签；大库加签 B1-A1；B2 上敏感库前必签。

## 剧本 S · pure read 与 admin 壳

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| S1 | 仅 KB-A `read` 打开 admin → 403 或 302→web（壳不可用） | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无 `admin.shell` 清会话并 `/login`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（`web_consumer` 无 `admin.shell`、空码） | 源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/admin/src/components/auth-guard.tsx`（挂 `app/(ops)/layout.tsx`）实现清会话跳 `/login`，与 Then「403 或 302→web」不一致（`apps/admin/tests/shell/auth-guard.test.tsx`）。禁止写成「待补测」 |
| S2 | 同上 U 直调上传 / 成员 / config / lifecycle / 评测 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/auth/enforce-permission-matrix.test.ts（`B1-2 · S2`：AUTH_ENFORCE=true 下 read 令牌打六类写入口（上传 / complete / 成员 / config / lifecycle / 评测）逐条 403 `FORBIDDEN` 且 message 指名缺失码）；apps/api/tests/acl/members-http.test.ts；apps/api/tests/kb/settings-http.test.ts | —（补测：六条写入口已逐条断言；默认 `AUTH_ENFORCE` 关时仍走 WhenEnforced 放行） |
| S3 | 同上 U：web ask + 文档元数据列表 + 提交 feedback 可达 | P2必签 | 单测 | 部分测 | api | apps/api/tests/auth/enforce-permission-matrix.test.ts（`S3`：默认关时 ask 200、文档列表 200；enforce 开时文档列表 403）；apps/api/tests/feedback/http.test.ts（`S3`：read（`web_consumer`）提交反馈 201 且运营队列可读）；apps/api/tests/acl/kb-member-gate.test.ts（成员 ask 200）；apps/api/tests/ask/http-validation.test.ts | 补测后仍缺一截（读面冲突，待裁口径）：文档元数据列表走 `doc.view`（`apps/api/src/routes/documents/index.ts:141`），而 `web_consumer` 模板码为空（`packages/admin-catalog/src/role-templates.ts:60`）→ enforce 开时 GET 文档列表 403，与 Then「read 列文档可达」冲突；`enforce-permission-matrix.test.ts` 已按现状记录（默认关 200 / 开 enforce 403），先裁清哪一侧错再定。 |
| S4 | KB-A `read` + KB-B `write` → 可进 admin | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（有 `admin.shell` 渲染子树）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（`doc_operator` 有壳码） | 源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/admin/src/components/auth-guard.tsx` 进壳只认平台码（`admin.shell`），「KB-A read + KB-B write → 可进壳」在现码模型下不成立（`packages/admin-catalog/tests/acl/catalog-clip.test.ts`）。禁止写成「待补测」 |
| S5 | 同上 V：对 KB-A 写 403；对 KB-B 写可达 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/kb-scope-write-isolation.test.ts（同一 kb_admin 令牌：KB-B（成员）PATCH 设置 200 / POST 成员 201；KB-A（非成员）两条 403 `FORBIDDEN` + message 含 `not a knowledge base member`；对照：对 KB-A 是成员时同写入 200；无 `kb.config.write` 的 web_consumer 打成员库亦 403 且点名 `kb.config.write`）；apps/api/tests/acl/kb-member-gate.test.ts；apps/api/tests/kb/settings-http.test.ts | 补测后仍缺一截：成员角色粒度——`apps/api/src/auth/permissions/resolve.ts:41-54` 只看成员资格，`kb_members.role` 不参与写闸，故只能按「库成员资格 + 码」断言（同测例）。 |
| S6 | admin 从 KB-B 切到 KB-A → 写菜单隐藏或写路由 403 | 建议 | 单测 | 缺实现 | admin | apps/admin/src/lib/kb-context.ts（手填 uuid）；菜单按全局码裁剪，不按当前 KB 角色 | **源码未做**：菜单 = `clipMenuForShell(me.permissions)`（`apps/admin/src/components/admin-shell.tsx:76-83`），`/auth/me` 无 `byKb`（`packages/contracts/src/auth/session.contract.ts:53-66` 注释「本批不返回 byKb」），切库只写 localStorage（`lib/kb-context.ts`）→ admin 层**不存在**按当前 KB 角色裁菜单。403 真值在 api（见 S5）。要让它有落点：先给 `/auth/me` 加 `byKb`，或把断言移回 api。**禁止**写假测 |
| S7 | admin 根 loader/中间件无「仅 read 放行」分支 | P2必签 | 单测 | 已测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无 `admin.shell` 不渲染子树；有码才放行） | — |
| S8 | mock 绕过壳中间件 → handler 仍按矩阵 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/auth/enforce-permission-matrix.test.ts（`S8`：夹具不挂 admin 壳中间件（等价绕过壳），read 令牌直打上传路由 → 403 且 message 含 `doc.upload`，同一令牌 ask 仍 200 → 403 来自 handler 侧验码而非身份整体失效）；apps/api/tests/acl/members-http.test.ts；apps/api/tests/kb/settings-http.test.ts；apps/api/tests/ops/dashboard-http.test.ts | —（补测：绕过壳的写入口 403 已直断言；默认 `AUTH_ENFORCE` 关时的放行属 WhenEnforced 语义） |
| S9 | web 误对 read 露出上传按钮 → 调上传 API 仍 403 | P2必签 | 单测 | 已测 | admin · web | apps/web/tests/ask/no-upload-surface.test.tsx（先证页面渲染成立——知识库选择 + 提问钮在——再断言无上传 / 导入 / 新建文档按钮、无上传链接、无 `input[type="file"]`）；apps/api/tests/auth/enforce-permission-matrix.test.ts（上传 API 403 + 指名 `doc.upload`）；apps/admin/tests/ops/documents-workspace.test.tsx（无 `doc.upload` 藏文件选择） | —（补测：UI 不误露与 API 403 两侧均已断言；默认 `AUTH_ENFORCE` 关时 API 侧按 WhenEnforced 放行） |
| S10 | 产品/UI 不将 read 标为「运营」「管理员」 | 建议 | UAT | UAT | admin | packages/admin-catalog/src/role-templates.ts（`web_consumer` 名「问答消费者」） | 文案抽检；无自动化 |

## 剧本 Y · 权限码与三模板

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| Y1 | `GET /me/permissions`（超管）含全量或 `*`；含 `admin.shell`、`dashboard.view`、`role.perm.manage` | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/me-permissions.test.ts（超管含 `admin.shell` / `dashboard.view` / `role.perm.manage`，且与 `/auth/me` 同源） | — |
| Y2 | doc_operator 上传 complete → 200 进 pending；不自动 scan | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/complete-pending-role.test.ts（enforce 开 + doc_operator 令牌：complete → 200、`approvalStatus=pending`、`status=uploaded`、`markCompletePending` 恰 1 次、`enqueueIngest` 零调用）；apps/api/tests/ingest/approval-scan.test.ts（pending 不可入队 scan）；apps/api/tests/ingest/gates-live.test.ts（未批 scan → FORBIDDEN）；packages/admin-catalog/src/role-templates.ts（doc_operator 有 `doc.upload` 无 `approval.decide`） | —（补测：角色 HTTP 路径已直打；mock 队列，无真 Redis） |
| Y3 | 同上用户调审批通过 → 403（无 `approval.decide`） | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/complete-pending-role.test.ts（同一 doc_operator 令牌 POST approve → 403 + message 含 `approval.decide`，且不落审批、不入队）；apps/api/tests/auth/enforce-permission-matrix.test.ts（approve / reject 皆 403）；同 B1-8 的 permission-resolve + catalog-clip | —（补测：同角色 approve HTTP 403 已补；默认 `AUTH_ENFORCE` 关时仍走 WhenEnforced 放行） |
| Y4 | kb_admin 审批通过 → 200；随后可 scan | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/approve-then-scan.test.ts | kb_admin approve 200 后 scan 200 且 enqueue stage=scan。不测禁自审（V3） |
| Y5 | super_admin 非 kb_members 对某 KB ask / 列文档 → 200 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`Y5`：AUTH_ENFORCE=true + 成员资格 mock 为 false，超管 GET 该库文档列表 → 200 `ok=true`；同文件超管非成员 ask 200）；apps/api/tests/kb/visible-list.test.ts（bypass 见全部库）；apps/api/tests/acl/documents-dept-filter.test.ts（超管跨部门预览 200，enforce 开） | —（补测：列文档「超管非成员」HTTP 已专测；与部门绕过仍是不同 Then，AE 行另计） |
| Y6 | 无 `admin.shell` 打开 admin → 403/302→web | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无码 → `/login`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts | 源码侧待定（同 S1）：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/admin/src/components/auth-guard.tsx` 无码清会话跳 `/login`，非 403、非 302→web（`apps/admin/tests/shell/auth-guard.test.tsx`）。禁止写成「待补测」 |
| Y7 | 菜单：doc_operator 无「角色与权限 / 模型」等平台二级 | P2必签 | 单测 | 已测 | admin-catalog | packages/admin-catalog/tests/acl/catalog-clip.test.ts（doc_operator clip 仅 `/documents`；kb_admin 无 `/models` `/dashboard`）；apps/admin/tests/shell/menu-clip.test.tsx（按码裁剪，无码无审批/面板） | — |
| Y8 | 仅藏菜单、直调 `member.manage` API → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/members-http.test.ts（doc_operator GET members 403）；apps/api/tests/acl/kb-member-gate.test.ts（缺码 403） | — |

## 剧本 W · 数据面板与 `dashboard.view`

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| W1 | pure read / 无 `admin.shell` 访问面板 → 403（不进壳） | P2必签 | 单测 | 已测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无壳码不进）；apps/api/tests/ops/dashboard-http.test.ts（无 `dashboard.view` 403）；apps/admin/tests/ops/dashboard-workspace.test.tsx（无码 403 态且不请求 summary） | — |
| W2 | doc_operator（默认无 `dashboard.view`）打开面板/API → 403；菜单不可见或点仍 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/ops/dashboard-http.test.ts（kb_admin 默认无码 → 403，注释写明仅超管全码；与 doc_operator 同缺该码）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（doc_operator clip 无 `/dashboard`）；apps/admin/tests/shell/menu-clip.test.tsx | — |
| W3 | kb_admin 未授 `dashboard.view` → 403（默认） | P2必签 | 单测 | 已测 | api | apps/api/tests/ops/dashboard-http.test.ts（`kb_admin` → 403，`message` 含 `dashboard.view`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（kb_admin clip 无 `/dashboard`） | — |
| W4 | super_admin 打开面板 → 200；健康/指标聚合（可薄） | P2必签 | 单测 | 已测 | api | apps/api/tests/ops/dashboard-http.test.ts（超管 200 + kbCount/documentCount/pendingApprovalCount/processReady/askCount24h）；apps/admin/tests/ops/dashboard-workspace.test.tsx（有码展示指标） | — |
| W5 | 面板响应体无 evidence / 问句 / chunk 正文 | P2必签 | 契约 | 已测 | contracts | packages/contracts/tests/system/dashboard-contract.test.ts（strict，拒未知字段）；apps/api/tests/ops/dashboard-http.test.ts（summary 仅计数） | — |
| W6 | 面板改 τ / 门禁：无入口或拒绝；走 config + ADR-046 | P2必签 | 单测 | 已测 | api | apps/api/tests/ops/dashboard-http.test.ts（`剧本 W6`：PATCH / PUT / POST summary 与 tracks 一律 404（体带 `tauClaim`）；GET summary 无 `tauClaim` / `gates` 属性、序列化不含 `tau`）；apps/api/src/routes/dashboard.ts（仅 GET summary）；packages/contracts/src/system/dashboard.contract.ts（无 τ 字段） | —（补测：写路由 404 负向 + 响应体无 τ 字段已断言） |
| W7 | 无码直调面板 API → 403（UI≠API） | P2必签 | 单测 | 已测 | api | apps/api/tests/ops/dashboard-http.test.ts（无码 403；无 Bearer 401）；路由始终 `requirePermission('dashboard.view')` | — |
| W8 | 超管给某 kb_admin 授予 `dashboard.view` 后再访问 → 200 | 授码能力必签 | 单测 | 已测 | api | apps/api/tests/acl/grant-dashboard-view.test.ts（role-hydrate 以 DB 角色并集为真值：kb_admin 未授码打 summary → 403 且 message 含 `dashboard.view`；超管 PUT 该角色 permissions 追加本码 → 200；同一令牌再打 summary → 200 且 `kbCount=1`；对照：doc_operator 未授码仍 403）；apps/api/tests/acl/platform-users-roles.test.ts（PUT 角色 permissions 合法码 200）；apps/api/tests/acl/permission-resolve.test.ts（`extraGrants` 可并入码） | —（补测：授码前后同一令牌对照已断言，本码可授、非写死超管） |

## 剧本 Z · 文档分片查看

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| Z1 | 无 `chunk.view`（默认 doc_operator）打开分片菜单/list API → 菜单无或 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/chunks-http.test.ts（`doc_operator 默认无 chunk.view → 403`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（doc_operator clip 无 `/chunks`） | — |
| Z2 | kb_admin 或超管 `GET …/documents/:id/chunks` → 200；有 preview；无 body（或恒空） | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/chunks-http.test.ts（kb_admin list 200、有 preview、无 body、仅当前 indexVersion）；packages/contracts/tests/ingest/chunk-contract.test.ts（list item schema 无 `body`） | — |
| Z3 | 未点详情时前端不得预拉全部 chunk body | 建议 | 单测 | 已测 | admin | apps/admin/tests/ops/chunks-workspace.test.tsx | 选文档只调 `loadChunkList(docId,{limit:50})`，3 条 preview 全渲染后 `loadChunkBody` 零调用；点某块后恰一次且为该 chunkId，另两块不拉 |
| Z4 | 点击某块 → `GET …/chunks/:chunkId` → 200 + body（可 truncated） | P2必签 | 单测 | 已测 | api · admin | apps/admin/tests/ops/chunks-workspace.test.tsx（`Z4`：选中文档后点某块 → `loadChunkBody` 恰一次且为该 chunkId，body 渲染；`bodyTruncated=true` 显「已截断」）；apps/api/tests/ingest/chunks-http.test.ts（detail 200 + body；超 64KiB `bodyTruncated`）；apps/api/tests/ingest/chunks-query.test.ts（`buildBody`）；packages/contracts/tests/ingest/chunk-contract.test.ts | —（补测：HTTP 与「点击才拉」UI 两侧均已断言） |
| Z5 | 给 doc_operator 授 `chunk.view` 后重复 Z2/Z4 → 200 | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/chunks-http.test.ts（`剧本 Z5`：doc_operator 默认 403；角色并集注入含 `chunk.view` 后 list 200（`indexVersion=2`、2 条）+ detail 200 带 body）；apps/api/tests/acl/platform-users-roles.test.ts（PUT 角色码 200） | —（补测：授码后 list / detail 均 200 已直打） |
| Z6 | 请求历史 indexVersion（若实现参数）→ 忽略或 400；P2 不提供历史浏览 | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/chunks-http.test.ts（`剧本 Z6`：list 显式带 `?version=1` → 被忽略，仍回 `indexVersion=2` 且 items 全为 2；旧版块 `detail?version=1` → 404）；packages/contracts/tests/ingest/chunk-contract.test.ts（query 无 version 字段） | —（补测：显式历史 version 参数被忽略的负向已断言） |
| Z7 | 尝试 PATCH chunk body → 404/405/403；不改 Mongo | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/chunk-body-patch-denied.test.ts | PATCH/PUT → 404/405；无写仓。≠ Mongo 正文未变（权威未接） |
| Z8 | 独立二级「分片」页可选文档并列块（薄 UI 即可） | P2必签 | 单测 | 已测 | admin | apps/admin/tests/ops/chunks-workspace.test.tsx（`Z8`：文档下拉含两库内文档可选中；选中后出现 `#` / `preview` / `tokens` 列头并列出块行与 `indexVersion / status / lifecycle` 摘要）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（kb_admin clip 含 `/chunks`）；apps/admin/src/app/(ops)/chunks/page.tsx | —（补测：薄页 RTL 已断言） |

## 剧本 AE · 部门与文档可见级别

前置（原文）：部门「人事」；E 员工、M 负责人；D_staff level=20、D_mgr level=30；均 ready+active；E/M 均为 KB 成员。`DEPT_ACL_ENFORCE` 默认关。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AE1 | 超管建部门树、指定 M 为负责人、E 主部门=人事 → 200 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/departments-http.test.ts（`剧本 AE1`：超管 POST「公司」→ POST「人事」挂父 id（`path` 含父 id）→ PUT M 归属 `{isLeader:true,isPrimary:true}` 200 → PUT E 归属 `{isPrimary:true,isLeader:false}` 200 → GET 回读三字段）；apps/admin/tests/ops/departments-workspace.test.tsx（薄页按码显隐） | —（补测：同一剧本已串成一条测例） |
| AE2 | 文档设置 owner=人事 + level；元数据可查 | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/document-meta.test.ts（PATCH ownerDeptId+visibilityLevel 200 可回读）；apps/api/tests/acl/documents-dept-filter.test.ts（列表项带两字段）；packages/contracts/tests/ingest/document-contract.test.ts | — |
| AE3 | `DEPT_ACL_ENFORCE=false` 时 E ask 命中 D_mgr → 可（兼容 P2 成员全库） | 兼容说明 | 单测 | 已测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（`enforce off → 原样`）；apps/api/tests/acl/documents-dept-filter.test.ts（关强制跨部门仍 200 / 列表含他部门）；apps/api/tests/env/defaults.test.ts（默认 false） | — |
| AE4 | enforce=true 时 E ask/列表：不可见 D_mgr，可见 D_staff | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（同部门成员可见 20 不可见 30）；apps/api/tests/acl/documents-dept-filter.test.ts（开强制列表/预览同滤）；apps/api/tests/kb/dept-acl-enforce-resolve.test.ts | 默认关；无 E ask 端到端命中/拒命中 |
| AE5 | 同上 M：可见 D_staff 与 D_mgr | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（同部门负责人可见 30） | 默认关；无 M ask HTTP |
| AE6 | 用户 X 无人事归属、无 grant → 不可见人事部门密级文档 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（无归属只见空部门；开+无归属列表省略他部门） | 默认关 |
| AE7 | 给 X 跨部门 grant level≥30 → X 可见 D_mgr；审计有记录 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（未过期 grant≥级别可见）；apps/api/tests/acl/dept-grants-http.test.ts（POST/GET/DELETE 可回读，无 `dept.manage` 403） | 默认关；grant 写审计未专断言 |
| AE8 | dense 与 ES filter 均含部门条件；禁止单路泄漏 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/src/services/retrieve/corpus.ts（PG 语料先 `filterDocsForDeptAcl` 再 principals）；`es-sparse.ts` `buildAclFilter` 可追加 `ownerDeptId` terms；非超管可追加 aclPrincipals should；apps/api/tests/ask/es-dept-query-filter.test.ts；apps/api/tests/ask/es-principals-query-filter.test.ts；apps/api/tests/acl/retrieve-dept-acl.test.ts | 默认关；可见级/过期 grant 仍以 PG 为准；无 E ask 端到端泄漏；改名单不自动 reindex |
| AE9 | 无 `dept.manage` 改树 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/departments-http.test.ts（kb_admin 无 `dept.manage` → 403）；apps/api/tests/acl/dept-grants-http.test.ts（无码 403） | — |
| AE10 | 上级「公司」成员 U（非人事）；子部门人事 D_staff=20；enforce=true → U 可见（上级看下级） | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（祖先成员可见子孙 20）；apps/api/tests/kb/dept-inherit-down.test.ts | 默认关；inheritDown=false 时此 Then 不成立（另有关继承测） |
| AE11 | 同上 U 非负责人；人事 D_mgr=30 → U 不可见（级别仍约束） | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（祖先成员不可见子孙 30；祖先负责人可见 30） | 默认关 |
| AE12 | 仅人事员工 E；文档挂上级「公司」且 level=20 → E 不可见（下级不看上级），除非 grant/兼任 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（`下级不可见仅挂在上级的文档`；grant 在子孙、文档在祖先 → 不可见） | 默认关 |

## 剧本 X · 咨询文档类型 scope

前置（原文）：KB 内至少 D_hr（`doc_type=hr`）、D_fin（`doc_type=finance`）；可选未分类。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| X1 | ask 不带 `scope`（或 `docTypes:[]`）→ 200；可命中 hr 与 finance（及未分类） | P2契约必签 | 单测 | 已测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（空 `docTypes` 不按类型滤，双闸后 hr 与另一类型均在）；apps/web/tests/ask/scope-top-level.test.ts（空/[] 不塞 scope）；packages/contracts/tests/ask/contract.test.ts | — |
| X2 | `scope.docTypes:["hr"]` 且问句能被 D_hr 支撑 → answered 时 citation 仅来自 hr | P2契约必签 | 单测 | 已测 | api | apps/api/tests/ask/scope-hr-excludes-finance.test.ts（`X2`：hr scope 下 answered + `reason=verified`，generate 同时给 hr / finance 引用 → citations 只剩 HR chunk，evidence 快照与序列化都不含 finance 正文）；apps/api/tests/ask/ready-active-corpus.test.ts（`scope.docTypes` 双闸后再滤，只留 hr）；apps/api/tests/ask/http-validation.test.ts / apps/api/tests/ask/mode-doc-types-gate.test.ts（顶层 scope 入口） | —（补测：answered 轮 citation 无 finance 的图路径已断言） |
| X3 | 同上，知识只在 D_fin → 拒答或无 finance 证据（不得用 finance 作答却声称 hr scope） | P2契约必签 | 单测 | 已测 | api | apps/api/tests/ask/scope-hr-excludes-finance.test.ts | hr scope 滤掉 finance；只 fin 有知识则拒答，evidence 无 fin |
| X4 | `docTypes:["no_such_type"]` → 400 | P2契约必签 | 单测 | 部分测 | api | apps/api/tests/ask/mode-doc-types-gate.test.ts（scope.docTypes 不在 KB 允许列表 → 400）；apps/api/tests/kb/ask-mode-doc-types.test.ts（子集闸） | 源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/routes/ask.ts`（`assertScopeDocTypesAllowed`：KB 未配 `docTypes` 时放行任意类型）与 Then「未知类型一律 400」不一致（`tests/ask/mode-doc-types-gate.test.ts` · `tests/kb/ask-mode-doc-types.test.ts`）。禁止写成「待补测」 |
| X5 | 单测：dense 与 ES filter 均含 `doc_type∈hr`；禁止一路全库一路过滤 | P2契约必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（装载层滤类型）；apps/api/src/services/retrieve/corpus.ts（先滤再 dense∥sparse） | 源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/services/retrieve/es-sparse.ts` 查询期仅 `kbId` + match，未下 `doc_type` filter，与 `apps/api/src/services/retrieve/corpus.ts`（装载层先滤再 dense∥sparse）不对称（属 B8 ES 切片）。禁止写成「待补测」 |
| X6 | 未选类型时 UI 仍可提问；不强制选类型；不 400 | P2.x UI | 单测 | 部分测 | web | apps/web/tests/ask/scope-top-level.test.ts（空输入不收窄、body 无 scope）；apps/web/src/components/ask-panel.tsx（标签「可选」，placeholder 空=不收窄） | 无 RTL「不选类型仍可提交」；P2.x |
| X7 | 伪造「只滤前端 citation」实现 → 验收不通过（须检索层） | P2契约必签 | 单测 | 已测 | api | apps/api/tests/ask/citations.test.ts（`剧本 X7`：hr scope 下 generate 引用场外 chunkId → 该引用被丢弃，citations 与 evidence 都不含它，answer 文本也不含）；apps/api/tests/ask/ready-active-corpus.test.ts（语料装载已滤）；packages/contracts/tests/ask/contract.test.ts（scope 顶层，禁嵌 options） | —（补测：场外 chunk 负向护栏已断言） |

## 本分册计数

行数须与上表一致（每 ID 一行，共 69）。2026-09-20 按行级「阶段 + 覆盖」机械重数三轮：第一轮修分册计数表原写的「已测 22 / 部分测 39 / 延后 2」（其中「延后 2」在行级无对应行）；第二轮随 S6 / Z3 复核结果再改 —— **Z3 已补测**（`apps/admin/tests/ops/chunks-workspace.test.tsx`，缺测 → 已测），**S6 改判 `缺实现`**（缺测 → 缺实现，源码侧确无按当前 KB 角色裁菜单，见该行「缺口」列）；**第三轮（补测批 3）：B1-2 B1-3 B1-5 B1-8 B1-A3 · S2 S8 S9 · Y2 Y3 Y5 · W6 W8 · Z4 Z5 Z6 Z8 · AE1 · X2 X7 共 20 行由 `部分测` → `已测`；S3 / S5 因仍有一截未断言保持 `部分测`**（见各行「缺口」列）。

| 覆盖 | 行数 |
|------|------|
| 已测 | 45 |
| 部分测 | 19 |
| 缺测 | 0 |
| 缺实现 | 2 |
| 延后 | 0 |
| UAT | 3 |
| **合计** | **69** |

自检 ID（69，无漏号）：B1-1 B1-2 B1-3 B1-4 B1-5 B1-6 B1-7 B1-8 · B1-A1 B1-A2 B1-A3 B1-A4 · B2-1 B2-2 B2-3 B2-4 · S1–S10 · Y1–Y8 · W1–W8 · Z1–Z8 · AE1–AE12 · X1–X7。

P2 必签且 `缺测` / `部分测` 才进补测清单。本册该子集：

- **缺测**：无（原 S6 / Z3 已按 2026-09-20 复核处理：Z3 已补测，S6 实为 `缺实现` 已改判）
- **部分测**（P2必签/契约/授码）：S1 S3 S4 S5 · Y6 · X4 X5
  - S1 / S4 / Y6 / X4 / X5 为**源码侧待定**（先裁清哪一侧错），禁止写成「待补测」
  - S3 / S5 为本批补测后仍缺一截（读面 `doc.view` 口径冲突 / 成员角色粒度），见各行「缺口」列

非本阶段：AE4–AE8、AE10–AE12（P3 / 开强制后）· B2-1 / B2-2 / B2-3（P3 文档 ACL，剩余：角色码 principal、自动 reindex、dense 反向构造）· X6（P2.x UI）；B1-A4 缺实现。均**不是**本阶段欠测债。
