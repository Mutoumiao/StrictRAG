# 覆盖分册 · acl

> 入口：[../coverage.md](../coverage.md)  
> 期望原文：[`prds/10-delivery/03-acceptance-scenarios.md`](../../../prds/10-delivery/03-acceptance-scenarios.md)  
> 本册：B · S · Y · W · Z · AE · X。判定以测例断言为准，不以 index 叙事抬覆盖。

口径（本册共用，不单独占行）：

- `AUTH_ENFORCE` **默认关**。`apps/api/tests/auth/enforce-401.test.ts` 只证明开 enforce 且无 Bearer → 401，以及默认关时 WhenEnforced 放行。B1 默认路径**不**当作生产 enforce 已测。
- `DEPT_ACL_ENFORCE` **默认关**。AE3 为兼容行为；AE4 起强制开属 P3 / 开强制后。
- 文档级 `aclPrincipals` **源码不存在**（`docs/module-status/api.md`：≠ 全文隔离）。B2 **不标缺测**。
- 成员闸 / 分片 / 面板 / 设置 / 部门走 `requirePermission`（与 enforce 开关无关）；上传 / 审批 / lifecycle 多走 `requirePermissionWhenEnforced`。

## 剧本 B · 权限（Phase 2 底线 / Phase 3 细粒度）

### B1 · Phase 2 底线 + 角色/码越权

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| B1-1 | 非成员且非超管 ask → 403 FORBIDDEN | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`non-member ask → 403 FORBIDDEN`，角色 `web_consumer`）；apps/api/tests/ask/http-validation.test.ts（`non-member → 403`） | — |
| B1-2 | read / 无 `doc.upload` 上传 → 403 | P2必签 | 单测 | 部分测 | api | apps/admin/tests/ops/documents-workspace.test.tsx（无 `doc.upload` 不渲染上传）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（`web_consumer` 空码）；apps/api/tests/auth/enforce-401.test.ts（默认 WhenEnforced 无 Bearer 仍 201） | 上传路由 `requirePermissionWhenEnforced('doc.upload')`；默认 AUTH_ENFORCE 关，无「read 角色上传 403」HTTP |
| B1-3 | doc_operator 邀请/改成员 → 403 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/members-http.test.ts（`doc_operator 无 member.manage → 403`，打的是 GET list）；apps/api/tests/acl/kb-member-gate.test.ts（缺 `member.manage` 403）；packages/admin-catalog/tests/acl/catalog-clip.test.ts | 未直打 POST 邀请 / DELETE 成员 |
| B1-4 | KB-A 的 kb_admin 对无码 KB-B 操作 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（kb_admin 非成员 manage → 403 membership）；apps/api/tests/kb/settings-http.test.ts（kb_admin 有码非成员 → 403） | — |
| B1-5 | super_admin 非该 KB 成员 ask / 管文档 → 200（须审计） | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`super_admin ask without membership → 200`）；apps/api/tests/acl/permission-resolve.test.ts（超管 bypass 成员）；apps/api/tests/ask/retrieve-run.test.ts（`super_admin same path as member`） | 管文档 HTTP（列/改文档、非成员）未专测；审计未断言 |
| B1-6 | 成员（含 read）ask → 200 业务路径可达 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/kb-member-gate.test.ts（`member ask → 200`，`web_consumer` 成员）；apps/api/tests/ask/retrieve-run.test.ts（member 返回 evidence）；apps/api/tests/ask/http-validation.test.ts（成员 + 顶层 scope 200） | — |
| B1-7 | 敏感语料未入池声明 · 检查表勾选 | UAT | UAT | UAT | — | prds/10-delivery/03-acceptance-scenarios.md（B1-7）；发布签字页「敏感语料未入池」 | 人签检查表，无自动化 |
| B1-8 | doc_operator `approval.decide` → 403 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/permission-resolve.test.ts（`doc_operator cannot decide approval`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（默认无 `approval.decide`）；apps/admin/tests/ops/approvals-workspace.test.tsx（无 decide 不露通过/驳回） | 审批 HTTP `requirePermissionWhenEnforced`；默认 AUTH_ENFORCE 关，无 doc_operator POST approve 403 |

### B1-ACL · Phase 2 检索 ACL

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| B1-A1 | 大库（≥2k docs）成员 ask：不因 terms 失败；主路径无全库 docId 列表 | 大库环境 | UAT | UAT | api | apps/api/src/services/retrieve/corpus.ts（按 `kbId` 装载，源码无 `allowedDocIds`） | 无 ≥2k 文档夹具/压测；大库环境人签 |
| B1-A2 | 非成员绕过 API 直调检索层（同 kbId）→ `not_member`，不进召回 | 检索ACL | 注入 | 已测 | api | apps/api/tests/ask/retrieve-run.test.ts（`rejects non-member` → `{ ok: false, reason: 'not_member' }`）；apps/api/src/services/retrieve/retrieve.ts（`membership === 'none'` 先 fail） | — |
| B1-A3 | `allowedDocIds=null` 不得跨 KB 召回（null≠无 ACL） | 试点必签 | 单测 | 部分测 | api | apps/api/src/services/retrieve/corpus.ts（`eq(documents.kbId, kbId)`）；apps/api/tests/ask/retrieve-run.test.ts（语料由 caller 注入，按本次 kb 走） | 源码无 `allowedDocIds` 字段；无「他库 chunk 混入」负向断言 |
| B1-A4 | 显式 `allowedDocIds` 且 len>5000 → `acl_filter_too_large`；不截断、无假 answered | 检索ACL | 契约 | 缺实现 | api | packages/contracts/src/ask/reason.ts（枚举有码）；apps/api/src/graph/reasons.ts（有文案映射）；apps/api/src/services/retrieve/retrieve.ts（从不返回该 reason） | 无 allowedDocIds 入参/过大闸；不得把枚举存在标成已测 |

### B2 · Phase 3 文档 ACL + 对称

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| B2-1 | 成员无文档 D 权限，问仅 D 能答的题：不得 verified 泄漏 D；evidence 无 D | P3 文档ACL | — | 延后 | api | docs/module-status/api.md（完整 ACL / ≠ 全文隔离）；全仓无 `aclPrincipals` | P3；源码未做文档级 principal |
| B2-2 | principal 变更（移出 role）+ reindex 后该文档对该用户不可检索 | P3 文档ACL | — | 延后 | api | 同上 | P3；无文档 ACL 索引字段 |
| B2-3 | dense 单路亦过文档 ACL（构造「dense 不过滤会召回」） | P3 文档ACL | — | 延后 | api | 同上 | P3；禁止把部门滤或 docTypes 当成文档 ACL |
| B2-4 | 缺省无 `aclPrincipals` → KB 内成员可读；显式 `[]` → 不可读 | P3 文档ACL | — | 延后 | api | 同上 | P3；字段不存在，勿标缺测 |

**安全签字（原文）**：B1 + B1-A3 试点必签；大库加签 B1-A1；B2 上敏感库前必签。

## 剧本 S · pure read 与 admin 壳

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| S1 | 仅 KB-A `read` 打开 admin → 403 或 302→web（壳不可用） | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无 `admin.shell` 清会话并 `/login`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（`web_consumer` 无 `admin.shell`、空码） | 实现跳 `/login`，非 403、非 302→web |
| S2 | 同上 U 直调上传 / 成员 / config / lifecycle / 评测 → 403 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/members-http.test.ts（无 `member.manage` 403）；apps/api/tests/kb/settings-http.test.ts（无 `kb.config.write` 403）；apps/api/tests/auth/enforce-401.test.ts | 上传 / 审批 / lifecycle / 评测走 WhenEnforced，默认关未打 403 |
| S3 | 同上 U：web ask + 文档元数据列表 + 提交 feedback 可达 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/kb-member-gate.test.ts（成员 ask 200）；apps/api/tests/ask/http-validation.test.ts | web 无 pure read 三入口测；文档列表 `doc.view` WhenEnforced 默认关；feedback 提交未按 read 角色测 |
| S4 | KB-A `read` + KB-B `write` → 可进 admin | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（有 `admin.shell` 渲染子树）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（`doc_operator` 有壳码） | 进壳只看平台码，无「多 KB 角色并集」用例 |
| S5 | 同上 V：对 KB-A 写 403；对 KB-B 写可达 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/kb-member-gate.test.ts（非本库成员 manage 403）；apps/api/tests/kb/settings-http.test.ts（kb_admin 非成员 403） | 无同一用户跨两库写隔离 HTTP |
| S6 | admin 从 KB-B 切到 KB-A → 写菜单隐藏或写路由 403 | 建议 | 单测 | 缺测 | admin | apps/admin/src/lib/kb-context.ts（手填 uuid）；菜单按全局码裁剪，不按当前 KB 角色 | 源码可换 KB id；无「切换后写菜单隐藏 / 写路由 403」测 |
| S7 | admin 根 loader/中间件无「仅 read 放行」分支 | P2必签 | 单测 | 已测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无 `admin.shell` 不渲染子树；有码才放行） | — |
| S8 | mock 绕过壳中间件 → handler 仍按矩阵 403 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/members-http.test.ts；apps/api/tests/kb/settings-http.test.ts；apps/api/tests/ops/dashboard-http.test.ts（直打 API 无码 403） | 上传 / 审批 WhenEnforced 默认关，绕过壳仍可能 200 |
| S9 | web 误对 read 露出上传按钮 → 调上传 API 仍 403 | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/ops/documents-workspace.test.tsx（无 `doc.upload` 藏文件选择） | web 无上传钮误露测；上传 API 默认不 enforce |
| S10 | 产品/UI 不将 read 标为「运营」「管理员」 | 建议 | UAT | UAT | admin | packages/admin-catalog/src/role-templates.ts（`web_consumer` 名「问答消费者」） | 文案抽检；无自动化 |

## 剧本 Y · 权限码与三模板

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| Y1 | `GET /me/permissions`（超管）含全量或 `*`；含 `admin.shell`、`dashboard.view`、`role.perm.manage` | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/permission-resolve.test.ts（超管含 `admin.shell` / `role.perm.manage`）；apps/api/tests/acl/platform-users-roles.test.ts（permission-catalog 含 `admin.shell` / `role.perm.manage`）；apps/api/src/routes/auth.ts（`GET /auth/me` 回 `permissions`） | 无 `GET /me/permissions`；无 `/auth/me` 超管全码 HTTP（含 `dashboard.view`） |
| Y2 | doc_operator 上传 complete → 200 进 pending；不自动 scan | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/approval-scan.test.ts（pending 不可入队 scan）；apps/api/tests/ingest/gates-live.test.ts（未批 scan → FORBIDDEN）；packages/admin-catalog/src/role-templates.ts（doc_operator 有 `doc.upload` 无 `approval.decide`） | 无 doc_operator complete 200 + `approval_status=pending` 的角色 HTTP |
| Y3 | 同上用户调审批通过 → 403（无 `approval.decide`） | P2必签 | 单测 | 部分测 | api | 同 B1-8：permission-resolve + catalog-clip + approvals-workspace | 同 B1-8：approve HTTP 默认不 enforce |
| Y4 | kb_admin 审批通过 → 200；随后可 scan | P2必签 | 单测 | 缺测 | api | apps/api/src/routes/documents/index.ts（POST approve / scan）；apps/api/tests/ingest/approval-scan.test.ts（approved 才允许 scan） | 无 kb_admin POST approve 200 HTTP；scan 闸是纯函数/live 夹具，非本角色路径 |
| Y5 | super_admin 非 kb_members 对某 KB ask / 列文档 → 200 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/kb-member-gate.test.ts（超管非成员 ask 200）；apps/api/tests/kb/visible-list.test.ts（bypass 见全部库）；apps/api/tests/acl/documents-dept-filter.test.ts（超管跨部门预览 200，enforce 开） | 列文档「超管非成员」HTTP 未专测；与部门绕过不是同一 Then |
| Y6 | 无 `admin.shell` 打开 admin → 403/302→web | P2必签 | 单测 | 部分测 | admin | apps/admin/tests/shell/auth-guard.test.tsx（无码 → `/login`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts | 跳 `/login`，非 403、非 302→web |
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
| W6 | 面板改 τ / 门禁：无入口或拒绝；走 config + ADR-046 | P2必签 | 单测 | 部分测 | api | apps/api/src/routes/dashboard.ts（仅 GET summary）；packages/contracts/src/system/dashboard.contract.ts（无 τ 字段） | 无「PATCH 面板改 τ」负向断言 |
| W7 | 无码直调面板 API → 403（UI≠API） | P2必签 | 单测 | 已测 | api | apps/api/tests/ops/dashboard-http.test.ts（无码 403；无 Bearer 401）；路由始终 `requirePermission('dashboard.view')` | — |
| W8 | 超管给某 kb_admin 授予 `dashboard.view` 后再访问 → 200 | 授码能力必签 | 单测 | 部分测 | api | apps/api/tests/acl/platform-users-roles.test.ts（PUT 角色 permissions 合法码 200）；apps/api/tests/acl/permission-resolve.test.ts（`extraGrants` 可并入码） | 未授 `dashboard.view` 后再打 summary 200；未证明非写死不可授本码 |

## 剧本 Z · 文档分片查看

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| Z1 | 无 `chunk.view`（默认 doc_operator）打开分片菜单/list API → 菜单无或 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/chunks-http.test.ts（`doc_operator 默认无 chunk.view → 403`）；packages/admin-catalog/tests/acl/catalog-clip.test.ts（doc_operator clip 无 `/chunks`） | — |
| Z2 | kb_admin 或超管 `GET …/documents/:id/chunks` → 200；有 preview；无 body（或恒空） | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/chunks-http.test.ts（kb_admin list 200、有 preview、无 body、仅当前 indexVersion）；packages/contracts/tests/ingest/chunk-contract.test.ts（list item schema 无 `body`） | — |
| Z3 | 未点详情时前端不得预拉全部 chunk body | 建议 | 单测 | 缺测 | admin | apps/admin/src/app/(ops)/chunks/_components/chunks-workspace.tsx（选文档只 `loadChunkList`；`loadChunkBody` 仅 `onOpenChunk`） | 无 chunks 工作区 RTL / 网络抽检 |
| Z4 | 点击某块 → `GET …/chunks/:chunkId` → 200 + body（可 truncated） | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/chunks-http.test.ts（detail 200 + body；超 64KiB `bodyTruncated`）；apps/api/tests/ingest/chunks-query.test.ts（`buildBody`）；packages/contracts/tests/ingest/chunk-contract.test.ts | HTTP 已测；无「点击才拉」UI |
| Z5 | 给 doc_operator 授 `chunk.view` 后重复 Z2/Z4 → 200 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/platform-users-roles.test.ts（PUT 角色码 200）；apps/api/tests/ingest/chunks-http.test.ts（kb_admin 有默认码 200） | 无「授码给 doc_operator 再 list/detail 200」 |
| Z6 | 请求历史 indexVersion（若实现参数）→ 忽略或 400；P2 不提供历史浏览 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/chunks-http.test.ts（list 仅当前 version；旧 version chunk detail 404）；packages/contracts/tests/ingest/chunk-contract.test.ts（query 无 version 字段） | 无「显式传历史 version 参数 → 忽略/400」 |
| Z7 | 尝试 PATCH chunk body → 404/405/403；不改 Mongo | P2必签 | 单测 | 缺测 | api | apps/api/src/routes/chunks.ts（仅 GET list/detail） | 无 PATCH 负向断言；Mongo 权威正文未接 |
| Z8 | 独立二级「分片」页可选文档并列块（薄 UI 即可） | P2必签 | 单测 | 部分测 | admin | packages/admin-catalog/tests/acl/catalog-clip.test.ts（kb_admin clip 含 `/chunks`）；apps/admin/src/app/(ops)/chunks/page.tsx | 菜单落地已测；无薄页 RTL |

## 剧本 AE · 部门与文档可见级别

前置（原文）：部门「人事」；E 员工、M 负责人；D_staff level=20、D_mgr level=30；均 ready+active；E/M 均为 KB 成员。`DEPT_ACL_ENFORCE` 默认关。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AE1 | 超管建部门树、指定 M 为负责人、E 主部门=人事 → 200 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/departments-http.test.ts（超管 POST 根+子 201、GET tree；PUT 归属 `isPrimary`/`isLeader` 200）；apps/admin/tests/ops/departments-workspace.test.tsx（薄页按码显隐） | 未串成「E 主部门 + M 负责人」同一剧本 |
| AE2 | 文档设置 owner=人事 + level；元数据可查 | P2必签 | 单测 | 已测 | api | apps/api/tests/ingest/document-meta.test.ts（PATCH ownerDeptId+visibilityLevel 200 可回读）；apps/api/tests/acl/documents-dept-filter.test.ts（列表项带两字段）；packages/contracts/tests/ingest/document-contract.test.ts | — |
| AE3 | `DEPT_ACL_ENFORCE=false` 时 E ask 命中 D_mgr → 可（兼容 P2 成员全库） | 兼容说明 | 单测 | 已测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（`enforce off → 原样`）；apps/api/tests/acl/documents-dept-filter.test.ts（关强制跨部门仍 200 / 列表含他部门）；apps/api/tests/env/defaults.test.ts（默认 false） | — |
| AE4 | enforce=true 时 E ask/列表：不可见 D_mgr，可见 D_staff | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（同部门成员可见 20 不可见 30）；apps/api/tests/acl/documents-dept-filter.test.ts（开强制列表/预览同滤）；apps/api/tests/kb/dept-acl-enforce-resolve.test.ts | 默认关；无 E ask 端到端命中/拒命中 |
| AE5 | 同上 M：可见 D_staff 与 D_mgr | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（同部门负责人可见 30） | 默认关；无 M ask HTTP |
| AE6 | 用户 X 无人事归属、无 grant → 不可见人事部门密级文档 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（无归属只见空部门；开+无归属列表省略他部门） | 默认关 |
| AE7 | 给 X 跨部门 grant level≥30 → X 可见 D_mgr；审计有记录 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（未过期 grant≥级别可见）；apps/api/tests/acl/dept-grants-http.test.ts（POST/GET/DELETE 可回读，无 `dept.manage` 403） | 默认关；grant 写审计未专断言 |
| AE8 | dense 与 ES filter 均含部门条件；禁止单路泄漏 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/src/services/retrieve/corpus.ts（PG 语料先 `filterDocsForDeptAcl`，dense∥sparse 共用）；apps/api/tests/acl/retrieve-dept-acl.test.ts | 默认关；**无 ES 查询期对称**（module-status 已写）；稀疏 HTTP 仅 `kbId` |
| AE9 | 无 `dept.manage` 改树 → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/departments-http.test.ts（kb_admin 无 `dept.manage` → 403）；apps/api/tests/acl/dept-grants-http.test.ts（无码 403） | — |
| AE10 | 上级「公司」成员 U（非人事）；子部门人事 D_staff=20；enforce=true → U 可见（上级看下级） | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（祖先成员可见子孙 20）；apps/api/tests/kb/dept-inherit-down.test.ts | 默认关；inheritDown=false 时此 Then 不成立（另有关继承测） |
| AE11 | 同上 U 非负责人；人事 D_mgr=30 → U 不可见（级别仍约束） | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（祖先成员不可见子孙 30；祖先负责人可见 30） | 默认关 |
| AE12 | 仅人事员工 E；文档挂上级「公司」且 level=20 → E 不可见（下级不看上级），除非 grant/兼任 | P3 / 开强制后 | 单测 | 部分测 | api | apps/api/tests/acl/retrieve-dept-acl.test.ts（`下级不可见仅挂在上级的文档`；grant 在子孙、文档在祖先 → 不可见） | 默认关 |

## 剧本 X · 咨询文档类型 scope

前置（原文）：KB 内至少 D_hr（`doc_type=hr`）、D_fin（`doc_type=finance`）；可选未分类。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| X1 | ask 不带 `scope`（或 `docTypes:[]`）→ 200；可命中 hr 与 finance（及未分类） | P2契约必签 | 单测 | 已测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（空 `docTypes` 不按类型滤，双闸后 hr 与另一类型均在）；apps/web/tests/ask/scope-top-level.test.ts（空/[] 不塞 scope）；packages/contracts/tests/ask/contract.test.ts | — |
| X2 | `scope.docTypes:["hr"]` 且问句能被 D_hr 支撑 → answered 时 citation 仅来自 hr | P2契约必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（`scope.docTypes` 双闸后再滤，只留 hr）；apps/api/tests/ask/http-validation.test.ts / apps/api/tests/ask/mode-doc-types-gate.test.ts（顶层 scope 入口） | 无 answered citation 不含 finance chunk 的图路径断言；检索层 `runRetrieve` 未按 scope 对称测 |
| X3 | 同上，知识只在 D_fin → 拒答或无 finance 证据（不得用 finance 作答却声称 hr scope） | P2契约必签 | 单测 | 缺测 | api | apps/api/src/services/retrieve/corpus.ts（非空 scope 会滤掉非 hr） | 无「只 fin 有知识 + hr scope → 拒答且 evidence 无 fin」 |
| X4 | `docTypes:["no_such_type"]` → 400 | P2契约必签 | 单测 | 部分测 | api | apps/api/tests/ask/mode-doc-types-gate.test.ts（scope.docTypes 不在 KB 允许列表 → 400）；apps/api/tests/kb/ask-mode-doc-types.test.ts（子集闸） | KB 未配 `docTypes` 时任意类型放行（`kbDocTypes: []`）；非「未知类型一律 400」 |
| X5 | 单测：dense 与 ES filter 均含 `doc_type∈hr`；禁止一路全库一路过滤 | P2契约必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（装载层滤类型）；apps/api/src/services/retrieve/corpus.ts（先滤再 dense∥sparse） | 无 dense/ES **查询期** `doc_type` 对称断言；ES 切片仅 `kbId`+match |
| X6 | 未选类型时 UI 仍可提问；不强制选类型；不 400 | P2.x UI | 单测 | 部分测 | web | apps/web/tests/ask/scope-top-level.test.ts（空输入不收窄、body 无 scope）；apps/web/src/components/ask-panel.tsx（标签「可选」，placeholder 空=不收窄） | 无 RTL「不选类型仍可提交」；P2.x |
| X7 | 伪造「只滤前端 citation」实现 → 验收不通过（须检索层） | P2契约必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（语料装载已滤）；packages/contracts/tests/ask/contract.test.ts（scope 顶层，禁嵌 options） | 无「generate/citation 仍带场外 chunk」负向护栏 |

## 本分册计数

行数须与上表一致（每 ID 一行，共 69）。

| 覆盖 | 行数 |
|------|------|
| 已测 | 19 |
| 部分测 | 37 |
| 缺测 | 5 |
| 缺实现 | 1 |
| 延后 | 4 |
| UAT | 3 |
| **合计** | **69** |

自检 ID（69，无漏号）：B1-1 B1-2 B1-3 B1-4 B1-5 B1-6 B1-7 B1-8 · B1-A1 B1-A2 B1-A3 B1-A4 · B2-1 B2-2 B2-3 B2-4 · S1–S10 · Y1–Y8 · W1–W8 · Z1–Z8 · AE1–AE12 · X1–X7。

P2 必签且 `缺测` / `部分测` 才进补测清单。本册该子集：

- **缺测**：S6（建议，可不进下一批）、Y4、Z3（建议）、Z7、X3
- **部分测**（P2必签/契约/授码，不含 AE4+ 与 X6）：B1-2 B1-3 B1-5 B1-8 B1-A3 · S1–S5 S8 S9 · Y1 Y2 Y3 Y5 Y6 · W6 W8 · Z4 Z5 Z6 Z8 · AE1 · X2 X4 X5 X7

AE4–AE8、AE10–AE12 为 P3 / 开强制后；B2 为 P3 文档 ACL（延后）；B1-A4 缺实现。均**不是**本阶段欠测债。
