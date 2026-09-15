# Research: 反馈回流黄金集之后源码证据核对（IS 面）

- **Query**: 工单 84（反馈回流黄金集最小闭环）完成后，对 wayfinder 地图下一批候选缺口逐条在源码里核实，判定「已齐 / 半接线 / 缺失」
- **Scope**: 源码为准（IS）；`docs/module-status/` 只作镜像、不作契约；WHAT 以 `prds/00–11` 与 `prds/12-delivery-guides/14-模块需求功能表.md`（派生）为准
- **Date**: 2026-09-16
- **方法**: 只读 + ripgrep/read；未跑测试；未改任何产品代码、测例、PRD、工单

判定口径（本次统一）：

- **已齐** = 有生产者 + 有消费者 + 无「未做」注释，语义能跑通
- **半接线** = 契约 / schema / 后端有，UI 或运行时未接；或反向
- **缺失** = 无实现

---

## 0. 结论摘要

| 项 | 判定 | 最关键证据（路径:行） |
|----|------|------------------------|
| 1 角色与权限树状勾选 | **半接线**（角色页扁平；树只被壳消费） | `apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx:211-233` · `packages/admin-catalog/src/menu-tree.ts:16` · `apps/admin/src/components/admin-shell.tsx:76` |
| 2 分片参数快照只读展示 | **半接线**（写齐、API 无回读、admin 无展示） | 写：`apps/api/src/services/ingest-complete-pending.ts:298-301` · 读：`apps/worker/src/ingest/pipeline.ts:525` · 无展示：`apps/admin/.../documents-workspace.tsx:700,758,1134`（仅选策略） |
| 3 断线按 requestId 重拉终态 | **缺失**（终态重拉；审计回溯已齐） | `apps/api/src/routes/ask.ts:74,354` · `packages/contracts/src/ask/ask.contract.ts:134-146` · `apps/web/src/api/ask.ts:78-81` · `apps/web/src/components/ask-panel.tsx:669` |
| 4 质量只读「签字包链」 | **半接线**（字段在，恒 null，无生产者） | `packages/contracts/src/kb/kb-settings.contract.ts:68-74` · `apps/api/src/routes/kb-settings.ts:61-67` · `apps/admin/.../settings-workspace.tsx:478-493` |
| 5 入场 `aclPrincipals` | **半接线**（契约/后端/闸齐；创建面表单未接，编辑面已接） | `packages/contracts/src/ingest/document.contract.ts:86-88,110` · 闸：`apps/api/src/services/kb-settings.ts:214-231` · 创建面不发：`apps/admin/.../upload.services.ts:16-20,88-95` |
| 6 原生 `<select>` 站规余量 | **半接线（站规债）**：admin 20 处原生 + 4 处旧 ui `Select`；web 0 处 | `apps/admin/src/app/(ops)/models/_components/models-workspace.tsx:320,406,475` 等 20 处 · `apps/admin/src/app/login/page.tsx:56` 等 4 处 · `packages/ui/src/components/ui/closed-select.tsx:23` |
| 7 真 L1 `contextualize` | **缺失**（L1 路径）；**快照服从已齐** | `apps/worker/src/ingest/pipeline.ts:525-527` · `packages/contracts/src/ingest/chunk-strategy.ts:43-73` · `apps/api/src/services/gateway/resolve.ts:7-13`（无 `contextualize`） |
| 8 其它缺口 | 见 §8：分片策略 PATCH 无审计、入库报告无 L0/L1 Hit@k、`pending_review` 无、`GET /jobs/:id` 无、Langfuse 仅 mock、P3b 专用 ACL 端点无 | 详 §8 |

---

## 1. 角色与权限树状勾选

**判定：半接线**。后端码表、菜单树、超管全码锁都在；角色页**仍是扁平勾选**，未按菜单树分组。

### 证据

角色页渲染（扁平）：

```211:233:apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx
          <div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
            {catalog.map((p) => (
              <label key={p.code} ...>
                <input type="checkbox" ... checked={editCodes.includes(p.code)} />
                <span>
                  <span className="font-medium">{p.code}</span>
                  <span className="block text-muted-foreground">
                    {p.scope} · {p.kind} · {p.description}
```

- 页面头部文案已写「树状授码」，但实现是 `catalog.map` 单层网格：`roles-workspace.tsx:120-122`。
- catalog 数据源是 API 扁平行：`apps/admin/src/app/(ops)/roles/services.ts:31-40`（`listPlatformRoles` + `getPermissionCatalog`）；契约 `packages/contracts/src/system/platform-users-roles.contract.ts:94-100` 只有 `{code,kind,scope,description}`，**无 parent / children**；DB 表 `packages/db/src/schema/system/permission-definitions.ts:8-14` 同样只有 code/kind/scope/description/source，**无层级列**。

`MENU_TREE` 存在，且**已被消费——但只被壳消费**：

- 定义：`packages/admin-catalog/src/menu-tree.ts:16-93`（`overview` / `kb` / `system` 三级，二级项绑 page 码）。
- 导出：`packages/admin-catalog/src/index.ts:32-34`。
- 唯一消费点：`apps/admin/src/components/admin-shell.tsx:11,76`（`clipMenuForShell(new Set(me.permissions))`）。
- 角色页**不 import** `@strict-rag/admin-catalog`（`roles-workspace.tsx:1-21` 的 import 块里没有）。

超管全码锁（工单 31）体现为「前端禁用 + 后端 400」双闸：

- 前端：`roles/services.ts:23-30`（`isLockedSuperAdminRole` / `SUPER_ADMIN_CODES_LOCKED_HINT`）；`roles-workspace.tsx:88-91`（保存前拦）、`:114`（`codesLocked`）、`:208-210`（提示条）、`:223`（勾选框 `disabled`）、`:238-239`（按钮 disabled + title）。
- 后端：`apps/api/src/routes/platform-users-roles.ts:158-165`（PATCH 角色降码 → 400 `cannot reduce super_admin permission codes`）、`:198-205`（PUT permissions 同闸）；`:145-157` 另禁禁用系统超管。

### 缺口具体是什么

1. 角色页无菜单树分组，运营看到的是「code · kind · scope · description」平铺长列表（当前 code 数量下需滚动查找）；
2. 页面文案（「树状授码」）与实现不一致，属误导性文案；
3. 无「按一级菜单折叠 / 全选一级」等树操作。

### 若要做最小闭环需要改哪些文件

- `apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx`：按 `MENU_TREE`（或新映射）分组渲染勾选；超管锁逻辑不动。
- 可选：`packages/admin-catalog/src/menu-tree.ts` 增加「page 码 → 菜单组」查询函数（如 `menuGroupForCode`），供角色页复用同一 SSOT；`packages/admin-catalog/src/index.ts` 补导出。
- 测例：`apps/admin/tests/ops/`（现有 roles 相关测例文件需先确认，见 Caveats）。
- 不需要改：contracts / db / api（勾选提交仍是 `codes: string[]`）。

---

## 2. 文档绑定分片策略参数快照只读展示

**判定：半接线**。列`documents.chunk_strategy_params` 有生产者（3 条写路径）；消费方只有 worker；**API 无回读通道，admin 无展示**。

### 写点（全量）

| # | 场景 | 路径:行 | 关键代码 |
|---|------|---------|----------|
| 1 | complete（上传完成登记） | `apps/api/src/services/ingest-complete-pending.ts:298-301` | `await documentRepo.markCompletePending(docId, head.byteSize, { chunkStrategy: strategyGate.code, chunkStrategyParams: strategyParams, checksumSha256 })` |
| 2 | write（在线编写） | `apps/api/src/routes/documents/index.ts:342-346` | `await documentRepo.markCompletePending(docId, buf.byteLength, { chunkStrategy: gated.strategyCode, chunkStrategyParams: gated.strategyParams, ... })` |
| 3 | reindex（显式换策略时） | `apps/api/src/routes/documents/index.ts:390-393` → `apps/api/src/services/documents.ts:233-245` | `if (strategyGate.changed) { const strategyParams = await paramsSnapshotFor(...); await documentRepo.setChunkStrategy(docId, strategyGate.code, strategyParams); }` |

落库实现与列定义：

```176:182:apps/api/src/services/documents.ts
        ...(opts?.chunkStrategy !== undefined
          ? { chunkStrategy: opts.chunkStrategy }
          : {}),
        ...(opts?.chunkStrategyParams !== undefined
          ? { chunkStrategyParams: opts.chunkStrategyParams }
          : {}),
```

- 列：`packages/db/src/schema/kb/documents.ts:44` — `chunkStrategyParams: jsonb('chunk_strategy_params').$type<Record<string, unknown>>()`；迁移 `packages/db/drizzle/0001_phase1_kb_docs.sql:43`。

### 读点（全量）

- worker 只读一个键：`apps/worker/src/ingest/pipeline.ts:525` — `const contextMode = parseContextMode(doc.chunkStrategyParams?.contextMode);`（`chunkTokens` / `chunkOverlap` 未被消费，切分仍按段落）。
- API / admin：**无**。契约 `DocumentListItemSchema` / `DocumentDetailSchema`（`packages/contracts/src/ingest/document.contract.ts:184-224`）不含 `chunkStrategy` 与快照；只有 complete/write 的**响应**回显 `chunkStrategy`（`:96-99`、`:113-115`）。admin 文档薄页 grep `strategy` 只命中三处「选策略」控件（`documents-workspace.tsx:700-701` 上传、`:758-760` 编写、`:1134-1135` reindex），**详情区块无任何策略/参数展示**（详情渲染见 `:922-1050`）。

### 缺口具体是什么

1. 功能表 §4.5「文档绑定：本 `indexVersion` 一套 `chunkStrategy` + 参数快照（写入 job/meta，**只读审计**）」（`prds/12-delivery-guides/14-模块需求功能表.md:323`）只完成「写入」，**没有可审计的只读面**；
2. 运营看不到某文档当前绑的是哪套策略、快照里 `contextMode` / `chunkTokens` 是什么 → 无法解释「同一库两篇文档行为不同」；
3. 重挂包后的快照差异也无处对比。

### 若要做最小闭环需要改哪些文件

- `packages/contracts/src/ingest/document.contract.ts`：`DocumentListItemSchema` / `DocumentDetailSchema` 增只读 `chunkStrategy: z.string().nullable().default(null)` 与 `chunkStrategyParams: z.record(z.string(), z.unknown()).nullable().default(null)`（走 `.default()` 兼容旧响应）。
- `apps/api/src/routes/documents/index.ts`：列表 / 详情映射补两个字段（现映射在 `:38-92` 与详情 handler）。
- `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`：详情区块加只读小节（策略码 + 快照 JSON）。
- 测例：`packages/contracts/tests/ingest/document-contract.test.ts`、`apps/api/tests/ingest/`（现有 docs 契约测例）。
- 不需要改 worker。

---

## 3. 断线按 requestId 重拉终态

**判定：缺失（终态重拉）**。`GET /ask/:requestId` 是**审计快照** DTO，契约显式拒绝 `answer`；且断线时客户端**连 requestId 都拿不到**；web 无重挂/重拉逻辑。

### 证据

路由与注释：

```70:77:apps/api/src/routes/ask.ts
 * GET  /api/v1/ask/:requestId — 权限回溯 evidence_snapshot + graph_trace（非断线重拉）。
```

```328:355:apps/api/src/routes/ask.ts
  /** GET /ask/:requestId — 登录 + 该 trace 的 KB 成员；快照不依赖现网分片 */
  routes.get('/ask/:requestId', requireAuth(), async (c) => {
    ...
    return ok(c, toAskAudit(trace));
```

返回结构 = 审计 DTO（`apps/api/src/services/ask/traces.ts:104-127` → `AskAuditResponseSchema`）：

```134:146:packages/contracts/src/ask/ask.contract.ts
export const AskAuditResponseSchema = z
  .object({
    requestId: z.string().min(1),
    kbId: z.string().uuid(),
    status: AskStatusSchema,
    reason: AskReasonSchema,
    mode: z.enum(['fast', 'balanced', 'strict']).optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    sessionId: z.string().uuid().nullable().optional(),
    evidenceSnapshot: z.array(EvidenceSnapshotItemSchema),
    graphTrace: AskGraphTraceSchema.nullable(),
  })
  .strict();
```

契约测例把「不是重拉」钉死：`packages/contracts/tests/ask/audit-contract.test.ts:76-89`（`answer` / `rawQuestion` 必须 parse 失败）。

SSE 侧：断线时拿不到 id——running 状态 part 不带 requestId 且 `transient: true`：

```261:264:apps/api/src/routes/ask.ts
          writer.write({
            type: 'data-status',
            data: { phase: 'running' },
            transient: true,
          });
```

（`requestId` 只在服务端变量 `c.get('requestId')` 与终态 `data-ask-final` 的 `AskResponse` 里；`:288-293`。）

服务端**已经存了 answer**，但没开回读口：

```29:38:packages/db/src/schema/ask/ask-traces.ts
  mode: text('mode'),
  rawQuestion: text('raw_question').notNull(),
  standaloneQuestion: text('standalone_question'),
  rewriteUsed: integer('rewrite_used').notNull().default(0),
  sessionDeepened: integer('session_deepened').notNull().default(0),
  answer: text('answer'),
  configSnap: jsonb('config_snap').$type<Record<string, unknown>>(),
  graphTrace: jsonb('graph_trace').$type<Record<string, unknown>>(),
  evidenceSnapshot: jsonb('evidence_snapshot').$type<EvidenceSnapshotItem[]>().default([]),
```

→ 缺的不是数据，是 DTO / 路由 / 成员闸的组合；`citations`（含分片文本）**无对应列**，需由 `evidenceSnapshot` 重建或另查 chunk（`AskResponseSchema.citations` 期望完整引用项）。

web 侧：

- `apps/web/src/api/ask.ts:78-81` — `getAskAudit`，注释写明「非断线重拉」。
- 唯一消费者是引用卡片点开分片详情：`apps/web/src/components/ask-panel.tsx:35`（import）、`:669`（`setAudit(await getAskAudit(requestId))`），在 `CitationBlock` 内。
- web 全仓无 `断线|重连|reconnect|resume|重新拉取|reload` 命中（唯一命中就是上面那句注释）；`localStorage` 只存 `kbId`（`ask-panel.tsx:106,249,421`）与登录态（`apps/web/src/auth/client-session.ts:29-64`），**不存 requestId / 会话消息**。

对比功能表 §3：「流式回答 | 默认 SSE；边生成边显示；**断线可按 `requestId` 重拉终态** | P2」（`prds/12-delivery-guides/14-模块需求功能表.md:234`）。

### 缺口具体是什么

1. 服务端没有「按 requestId 取终态 `AskResponse`」的口子（现有 GET 是审计形，不含 answer / citations / suggestedActions）；
2. SSE running 阶段不下发 requestId（且 transient 会被 AI SDK 丢弃），客户端断线后没有任何 id 可用于重拉；
3. web 无「上次未完成问答」的本地持久化与重挂恢复 UI。

### 若要做最小闭环需要改哪些文件

- `packages/contracts/src/ask/ask.contract.ts`：新增终态重拉 DTO（例如 `AskTerminalResponseSchema`，含 `AskResponseSchema` 子集 + `status`），**不得**把 answer 塞进 `AskAuditResponseSchema`（会把审计口变成正文泄漏面，与 `prds/05-api` §2.9 冲突）。
- `apps/api/src/routes/ask.ts`：新增 `?view=terminal` 分支或新路由；沿用 trace 成员闸（`:341-352` 的 `evaluateKbMember`）。
- `apps/api/src/services/ask/traces.ts`：需要新增「按 requestId 取终态」的读取（`ask_traces.answer` 已存在，`packages/db/src/schema/ask/ask-traces.ts:35`；`citations` 无列，需由 `evidenceSnapshot` 重建或另查 chunk）。
- 无需改 `packages/db`（answer 列已在）；若要连 citations 一起回读，再加 `citations` 列或走 chunk 查询（体积升到中）。
- `apps/web/src/api/ask.ts` + `apps/web/src/components/ask-panel.tsx`：running 阶段持久化 requestId（需服务端先下发）、重挂时拉终态并渲染。

---

## 4. 质量只读「签字包链」

**判定：半接线**。契约与只读区在；`gatePackageId` / `effectiveAt` **恒为 null**，无生产者，无「链」。

### 证据

契约只有三个字段（无链、无 evalRunId）：

```68:74:packages/contracts/src/kb/kb-settings.contract.ts
/** GET 只读：质量 snapshot（禁止经 settings 写 τ） */
export const QualitySnapshotSchema = z.object({
  tauClaim: z.number().min(0).max(1),
  gatePackageId: z.string().nullable().optional(),
  effectiveAt: z.string().nullable().optional(),
});
```

唯一默认生产者把两字段写死 null：

```61:67:apps/api/src/routes/kb-settings.ts
function defaultQuality(): QualitySnapshot {
  return {
    tauClaim: env.TAU_CLAIM,
    gatePackageId: null,
    effectiveAt: null,
  };
}
```

（注入点 `apps/api/src/routes/kb-settings.ts:46-48, 79`；测例同样钉死 null：`apps/api/tests/kb/settings-http.test.ts:53-57`。）

admin 设置页只展示两个字段，`effectiveAt` 不展示：

```478:493:apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx
          <section ...>
            <h2 className="text-sm font-semibold">质量（只读）</h2>
            <p className="text-xs text-muted-foreground">本页禁止改 τ / 门禁门槛（ADR-054）</p>
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">tauClaim</dt>
                <dd className="font-mono">{settings.qualitySnapshot.tauClaim}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">gatePackageId</dt>
                <dd className="font-mono">{settings.qualitySnapshot.gatePackageId ?? '—'}</dd>
              </div>
```

门禁包快照的真实生产者是 **CLI 落盘文件**，不是 settings 读取源：`apps/api/src/scripts/run-l1-golden.ts:497-518`（`bindQualitySnapshotToEval` → `writeBoundSnapshot(opts.outDir, ...)`）；纯函数层 `apps/api/src/eval/adr046-snapshot.ts:160-171`（`signedPackage`）。

功能表原文：「质量 | **只读** | `tauClaim` + 签字包 id/**链**；无写控件」（`14-模块需求功能表.md:281`）。

### 缺口具体是什么

1. 页面上「签字包 id」永远是「—」；运营无法确认当前 τ 出自哪个已签字包；
2. 无「链」：既无 `evalRunId` / `evalBindId`（`apps/api/src/eval/adr046-snapshot.ts:175+` 已算出 `evalBindId`，但只写进文件报告），也无「加严/放宽方向」展示；
3. `effectiveAt` 契约有、UI 无。

### 若要做最小闭环需要改哪些文件

- `apps/api/src/routes/kb-settings.ts:61-67`：`defaultQuality()` 改为从真实来源读（`eval_runs` 表最近一笔 L1 账本 → 需确认 `apps/api/src/services/eval-runs.ts` 是否已有 `gateBundle` / `evalBindId` 落列；无则需 db 加列）。
- `packages/contracts/src/kb/kb-settings.contract.ts:68-74`：`gatePackageId` 换成/补上 `gateBundleId` + `evalRunId` + `signedPackage` + `effectiveAt`（只读）。
- `apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx:478-493`：展示链（包 id → evalRunId → 生效时间）与「— / 未绑定」态。
- 明确**不做**：写 τ、人签、放宽路径（图外）。

---

## 5. 入场 `aclPrincipals`

**判定：半接线**。契约、落库、PG/ES 查询期对称、敏感闸都已就绪；**创建面表单（上传 / 在线编写）不发该字段**，只有「编辑详情 PATCH」能改。

### 证据

契约已收字段（三态：omit 不改 / null 清回未设 / `[]` 显式空）：

```78:90:packages/contracts/src/ingest/document.contract.ts
export const CompleteUploadBodySchema = z.object({
  ...
  ownerDeptId: z.string().uuid().nullable().optional(),
  visibilityLevel: VisibilityLevelSchema.optional(),
  /** omit 不改；null 清回未设；[] 显式空 */
  aclPrincipals: z.array(z.string().uuid()).max(256).nullable().optional(),
```

同文件 `:107-110`（`WriteDocumentBodySchema`，无注释但同形状）、`:195-199`（列表 `aclPrincipals: z.array(...).nullable().default(null)`）、`:232-235`（`PatchDocumentMetaBodySchema`）。

后端确实吃这个字段：

- complete：`apps/api/src/services/ingest-complete-pending.ts:236-252`（`finalizePendingIngest` 里 `patchMeta({ ownerDeptId, visibilityLevel, aclPrincipals })` 后再读回）。
- write：`apps/api/src/routes/documents/index.ts:335-340`（`evaluateWriteIngestGates` 之后 `patchMeta`）。
- PATCH 详情：`apps/api/src/routes/documents/index.ts:621-655`。
- 落库列：`packages/db/src/schema/kb/documents.ts`（`acl_principals`，见 module-status db 行「P3b-META … `acl_principals` 可空 `uuid[]`」）。
- 检索侧：PG `filterDocsForAclPrincipals`（`apps/api/src/services/retrieve/corpus.ts`）+ ES `sparseBulkSource` 写 keyword/哨兵（`apps/worker/src/ingest/es-http.ts:55-70`）、查询期 should 收窄。

admin 创建面**不发**：ACL 字段类型只有部门与可见级：

```16:31:apps/admin/src/app/(ops)/documents/upload.services.ts
export type CreateDocAclFields = {
  ownerDeptId: string | null;
  visibilityLevel: VisibilityLevel;
};
...
export function toCreateDocAclFields(ownerDeptId: string, visibilityLevel: VisibilityLevel) {
  ...
  return { ownerDeptId: trimmed === '' ? null : trimmed, visibilityLevel };
```

```88:95:apps/admin/src/app/(ops)/documents/upload.services.ts
    await completeUpload(kbId, slot.docId, {
      chunkStrategy,
      checksumSha256: put.checksumSha256,
      ...(acl
        ? { ownerDeptId: acl.ownerDeptId, visibilityLevel: acl.visibilityLevel }
        : {}),
    });
```

同形状：`apps/admin/src/app/(ops)/documents/write.services.ts:35-42`。创建面对话框只有「新文档归属部门 / 新文档可见级」两个 `ClosedSelect`（`documents-workspace.tsx:663-690`）。

编辑面**已接**：`documents-workspace.tsx:105-120`（`aclPrincipalsFromForm` / `principalsFormFromDetail` 三态）、`:976-996`（「仅名单可见」勾选 + uuid `Textarea`）、`:580-589`（PATCH body 带 `aclPrincipals`）。

敏感闸判定逻辑与口径：

```214:231:apps/api/src/services/kb-settings.ts
/**
 * P3b-SENS：sensitive 且 ACL 未就绪则挡 complete。
 * 就绪 = 部门路径（enforce ∧ 非空 ownerDeptId）或名单路径（aclPrincipals 为数组，含 []）。
 * null / 缺字段不算名单就绪。吃解析后的 boolean。
 */
export function isSensitiveCompleteBlocked(params: {
  dataClass: DataClass;
  ownerDeptId: string | null | undefined;
  deptAclEnforce: boolean;
  aclPrincipals?: string[] | null;
}): boolean {
  if (params.dataClass !== 'sensitive') return false;
  const hasOwner =
    typeof params.ownerDeptId === 'string' && params.ownerDeptId.trim().length > 0;
  const deptReady = params.deptAclEnforce && hasOwner;
  const principalsReady = Array.isArray(params.aclPrincipals);
  return !deptReady && !principalsReady;
}
```

调用点两处：`apps/api/src/services/ingest-complete-pending.ts:109-123`（`evaluateWriteIngestGates`，write 路径，**落对象前**拦）、`:266-280`（`finalizePendingIngest`，complete 路径）；`dataClass` 解析 `apps/api/src/services/kb-settings.ts:179-184`，`deptAclEnforce` 解析 `:186-212`。

### 缺口具体是什么

只有「创建面不能标名单」这一条：敏感库 + 本库未开强制（`deptAclEnforce=false`）时，创建者若想「仅名单可见」，必须先在别的界面（详情 PATCH）补名单——而 complete 会在**落对象前**因 ACL 未就绪直接 400，形成死循环式操作顺序（先传 → 400 → 没有文档可供 PATCH）。这是功能表 §4.3 / 工单 45 名单路径的入口缺口。

### 若要做最小闭环需要改哪些文件

- `apps/admin/src/app/(ops)/documents/upload.services.ts`：`CreateDocAclFields` 增 `aclPrincipals?: string[] | null`，并在 `completeUpload` /（经 `write.services.ts`）`writeDocument` body 透传。
- `apps/admin/src/app/(ops)/documents/write.services.ts`：同上（复用 `CreateDocAclFields`）。
- `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`：创建面对话框加「仅名单可见 + 用户 uuid」控件（站规要求下拉用 `ClosedSelect`；用户选择需 `user.manage` 才能拉 `GET /admin/users`，无码时按现有 uuid 粘贴形态，参考详情区块 `:976-996`）。
- 后端 / 契约：**无需改**（已齐）。
- 测例：`apps/admin/tests/ops/`（创建面 body 断言）。

---

## 6. 原生 `<select>` 站规余量

**判定：站规债（半接线性质）**。web 端已清零；admin 仍有 **20 处原生 `<select>` + 4 处旧 `@strict-rag/ui` `Select`**。

站规原文（地图 Notes）：「web / admin 新下拉必须基于 `@strict-rag/ui` 关闭列表，**禁止浏览器原生 `<select>` 外壳（含现有 ui `Select`）**」（`.scratch/fill-must-haves/map.md:17`）。

### admin 原生 `<select>` 全量（`apps/admin/src`，20 处）

| # | 路径:行 | 用途 |
|---|---------|------|
| 1 | `models/_components/models-workspace.tsx:320` | 新增 Provider 的「预设」选择 |
| 2 | `models/_components/models-workspace.tsx:406` | 模型条目的「类型」（chat/embed/rerank…） |
| 3 | `models/_components/models-workspace.tsx:475` | 平台绑定 `bind-${purpose}` 的模型选择 |
| 4 | `departments/_components/departments-workspace.tsx:345` | 部门「上级部门（可选）」 |
| 5 | `departments/_components/departments-workspace.tsx:433` | 用户归属指派的「用户 ID」（无码时退化为 Input） |
| 6 | `departments/_components/departments-workspace.tsx:467` | 「设为所属部门（单条主归属，覆盖）」 |
| 7 | `departments/_components/departments-workspace.tsx:519` | 跨部门授权「授权用户」 |
| 8 | `departments/_components/departments-workspace.tsx:549` | 跨部门授权「授权部门」 |
| 9 | `departments/_components/departments-workspace.tsx:567` | 跨部门授权「可见级」 |
| 10 | `eval/_components/eval-workspace.tsx:215` | 黄金集「类型」（answerable / unanswerable / false_premise） |
| 11 | `documents/_components/documents-workspace.tsx:701` | 上传「分片策略」 |
| 12 | `documents/_components/documents-workspace.tsx:804` | 列表筛选「部门」 |
| 13 | `documents/_components/documents-workspace.tsx:841` | 列表筛选「可见级」 |
| 14 | `documents/_components/documents-workspace.tsx:930` | 详情「归属部门」 |
| 15 | `documents/_components/documents-workspace.tsx:962` | 详情「可见级」 |
| 16 | `documents/_components/documents-workspace.tsx:1001` | 详情「类型」（docType） |
| 17 | `documents/_components/documents-workspace.tsx:1135` | Reindex「分片策略」 |
| 18 | `kb/settings/_components/chunk-strategy-panel.tsx:148` | 各 MIME 族「recommended」策略 |
| 19 | `kb/settings/_components/settings-workspace.tsx:254` | 「语料分级」（internal / sensitive） |
| 20 | `kb/settings/_components/settings-workspace.tsx:320` | 「默认档位」（fast / balanced / strict） |

（同文件内已改用 `ClosedSelect` 的对照点：`documents-workspace.tsx:664,684,760`。）

### admin 旧 ui `Select`（站规同样禁，4 处）

| 路径:行 | 用途 |
|---------|------|
| `app/login/page.tsx:56` | 开发登录「角色模板」（super_admin / kb_admin / doc_operator） |
| `chunks/_components/chunks-workspace.tsx:169` | 分片页「文档」选择 |
| `members/_components/members-workspace.tsx:158` | 成员「角色」（新增成员） |
| `members/_components/members-workspace.tsx:197` | 成员行「角色」（改角色） |

导入自 `@strict-rag/ui/components/ui/select`（如 `app/login/page.tsx:8`）。

### web 端

`apps/web/src` 中**无**原生 `<select`（ripgrep 命中 0），也无 ui `Select`；web 已用 `ClosedSelect`：`apps/web/src/components/ask-panel.tsx:29`。

### `ClosedSelect` 定义与导出方式

```1:30:packages/ui/src/components/ui/closed-select.tsx
import * as React from 'react';
import { cn } from '../../lib/utils.js';

/** 关闭列表下拉：展示文案、值为 id；不能输入、不能搜。不是 combobox，不是原生 select。 */
export type ClosedSelectOption = { value: string; label: string };

export type ClosedSelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ClosedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export const ClosedSelect = React.forwardRef<HTMLButtonElement, ClosedSelectProps>(
```

- 实现：`packages/ui/src/components/ui/closed-select.tsx:23`（`button[aria-haspopup=listbox]` + `ul[role=listbox]`，支持 ↑/↓/Enter/Esc）。
- 子路径导出：`packages/ui/package.json:14` — `"./components/ui/closed-select": "./src/components/ui/closed-select.tsx"`。
- 桶导出：`packages/ui/src/index.ts:12-14`（`ClosedSelect` / `ClosedSelectOption` / `ClosedSelectProps`）。
- 实际用法：`import { ClosedSelect } from '@strict-rag/ui/components/ui/closed-select';`（`apps/admin/src/components/admin-shell.tsx:18`、`apps/admin/src/app/(ops)/feedback/_components/feedback-workspace.tsx:13`、`apps/web/src/components/ask-panel.tsx:29`）。

### 若要做最小闭环需要改哪些文件

- 上述 20 个（原生）+ 4 个（ui `Select`）调用点所在文件；
- `packages/ui`：`ClosedSelect` 现已够用（`disabled` / 空态 placeholder 已有）；若要支持「筛选型长列表」需加 `options` 虚拟滚动 → 属增强，非本闭环必需。

---

## 7. 真 L1 `contextualize`

**判定：缺失（L1 路径）**；其中「**快照服从** + L0 模板真用」**已齐**（工单 82）。

### 已齐的部分

```525:527:apps/worker/src/ingest/pipeline.ts
      const contextMode = parseContextMode(doc.chunkStrategyParams?.contextMode);
      const contextSource = resolveContextSource(contextMode);
      const prefix = l0ContextPrefix(doc.title ?? '');
```

- 快照读取：`pipeline.ts:525`（来自 `documents.chunk_strategy_params`）。
- L0 模板：`packages/contracts/src/ingest/chunk-strategy.ts:64-69`（`l0ContextPrefix(title, sectionPath?)`，无 path 只用标题，禁字面量 `section`）。
- 来源判定：`chunk-strategy.ts:71-73` — `resolveContextSource('l0_template') === 'l0'`，`'l1_llm'` → `'l0_fallback'`；枚举 `:46-48` `CONTEXT_SOURCES = ['l0','l0_fallback']`（**注释明说**：`l1_llm 成功要等 Gateway contextualize，禁止先写`）。
- 报告落库：`pipeline.ts:587,621`（`contextSource` 进 manifest 快照）；类型 `apps/worker/src/ingest/ingest-report.ts:38-45`。
- 默认值仍是 `l1_llm`：`chunk-strategy.ts:50-54`（`DEFAULT_CHUNK_STRATEGY_PARAMS.contextMode = 'l1_llm'`）。

### 缺失的部分（真 L1）

1. worker **不调网关做 contextualize**：`pipeline.ts` 内无任何网关 import；网关相关只出现在 embed 路径（`apps/worker/src/ingest/embed-http.ts:15-18`、`pipeline.ts:700-705`）。
2. worker env 只有占位：`apps/worker/src/env.ts:32-33`（`GATEWAY_BASE_URL` / `GATEWAY_API_KEY`）、`:47`（`GATEWAY_EMBED_MODEL`）——**没有 contextualize 模型 / 超时 / 回退相关键**。
3. 网关侧**无 `purpose=contextualize`**：
   - `apps/api/src/services/gateway/resolve.ts:7-13` — `ChatPurpose = 'generate' | 'claim_split' | 'judge' | 'route' | 'rewrite' | 'other'`；
   - `packages/contracts/src/system/model-gateway.contract.ts:33-44` — `BindingPurposeSchema` = generate / claim_split / judge / judge_aux / embed / … / rewrite，**无 contextualize**；
   - 全仓 `contextualize` 只出现在注释、`docs/`、测例标题（`apps/worker/tests/ingest/context-mode-obey.test.ts:5` 明确写「无 Gateway contextualize」）。
4. 契约也不接受 L1 成功：`CONTEXT_SOURCES` 无 `l1_llm`，且测例明确拒绝 `contextSource: 'l1_llm'`（`packages/contracts/tests/ingest/ingest-report-contract.test.ts:62-64`）。
5. 侧证：`docs/testing/coverage/03-ops.md:93` R7「contextualize 429 耗尽 → L0 索引路径」标「延后 / 无 contextualize 实现」；`docs/module-status/worker.md:66,82` 同口径。

### 若要做最小闭环需要改哪些文件（体积大，建议单独一张）

- `packages/contracts/src/system/model-gateway.contract.ts:34-44`：`BindingPurposeSchema` 加 `'contextualize'`。
- `packages/contracts/src/ingest/chunk-strategy.ts:46-48`：`CONTEXT_SOURCES` 加 `'l1_llm'`；同步改 `packages/contracts/tests/ingest/ingest-report-contract.test.ts:62-64`（放开断言要谨慎，属契约变更）。
- `apps/api/src/services/gateway/`：新增 contextualize 调用（`resolve.ts` purpose 枚举 + 调用封装；`types.ts:8-13` `ChatRequest.purpose`）。
- `apps/worker/src/ingest/`：新增 `contextualize-http.ts`（或复用 embed-http 形态）+ `pipeline.ts:525-527` 分支：`l1_llm` → 逐块调网关；失败/429 → 回退 `l0ContextPrefix` 且记 `l0_fallback`（这正是 R7 剧本要求）。
- `apps/worker/src/env.ts`：加 contextualize 模型/超时 env（与 `GATEWAY_*` 占位对齐）。
- admin：看板/设置页「召回增强关闭」已存在（`chunk-strategy-panel.tsx:113`），无需新增。

---

## 8. 其它缺口（自行发现，均有源码证据）

排除：已关工单覆盖范围（1–84）、地图已锁（人签 / 真 OCR / 默认开强制 / 角色 principal / 默认开 rewrite / BlockNote / editor-draft / LangGraph 重构）。

### 8.1 分片策略 PATCH **无审计**（功能表 §5.2「写须审计」，P2）

- 要求：`prds/12-delivery-guides/14-模块需求功能表.md:368` —「分片策略 | chunk-strategies 列表/schema/PATCH；`for-upload` | **写须审计**」。
- 现状：
  - 路由 `apps/api/src/routes/chunk-strategies.ts:85-102` 只调 `applyKbChunkStrategyPatch` 后返回 items；
  - service `apps/api/src/services/chunk-strategy-catalog.ts:248-286` 只 `replaceKbStrategies`，**无任何 audit 写入**；
  - 中间件审计白名单不含该路径：`apps/api/src/middleware/admin-write-audit.ts:26-37`（只覆盖 members / approve|reject / lifecycle / `/api/v1/admin/*` / `PATCH …/settings` / `POST …/documents/write`）；
  - `kb_settings_audits` 只由 settings PATCH 写（`apps/api/src/routes/kb-settings.ts:23-25,77` 注入的 `kbSettingsAuditRepo`）。
- 影响：运营改了「库启用策略 / recommended / contextMode」在修改日志里查不到；与工单 33 建立的「设置改动可查」口径不一致。
- 最小闭环：在 `apps/api/src/services/chunk-strategy-catalog.ts:248` 的 PATCH 落库处（或路由层）写一条记录——复用 `kb_settings_audits`（diff 形状需容纳 `items`）或走 `admin_write` 中间件（把该路径加进 `shouldAuditAdminWrite`），二选一并测例钉死。

### 8.2 入库报告**无 L0 vs L1 Hit@k 抽样对照**（功能表 §5.2 入库报告行，P1–P2）

- 要求：`14-模块需求功能表.md:370` —「入库报告 | `GET …/ingest-report` | 去重冲突对、L0/L1、跨 doc skip；**可抽样对照 L0 vs L1 的 Hit@k**」。
- 现状：契约显式拒绝该字段——`packages/contracts/src/ingest/ingest-report.contract.ts:5`（注释「pending_review / downrank 不在本形状」）+ `packages/contracts/tests/ingest/ingest-report-contract.test.ts:53-55`（`hitAtK` / `pendingReview` 必须 parse 失败）；DB 表注解 `packages/db/src/schema/kb/ingest-reports.ts:13`（「不含 pending_review / Hit@k / l1_llm」）。
- 说明：Hit@k 已在**评测平面**落地（`apps/worker/src/eval/run-l1-batch.ts:113-160`、`packages/contracts/src/eval/l1-matrix.ts:111-138`），缺的是**入库报告维度**的对照；而 L1 未实现（§7）使该对照当前也无法真跑，属「依赖 §7」的缺口。
- 最小闭环：**应与 §7 同一批或之后**；仅加契约列会写成假数据，不建议先做。

### 8.3 `pending_review` 人工二选一**缺失**（功能表 §4.3，P1）

- 要求：`14-模块需求功能表.md:299` —「入库报告 | 文档页抽屉或同页：去重冲突对、L0/L1、跨 doc skip；**`pending_review` 须人工二选一**」。
- 现状：跨文档去重（工单 80）只做默认 `skip_index`；测例文件头明写「**无 pending_review**」：`apps/worker/tests/ingest/cross-doc-skip-index.test.ts:5`、`apps/worker/tests/ingest/cross-doc-dedupe.test.ts:5`；契约 `packages/contracts/src/ingest/ingest-report.contract.ts:5-6`（冲突对 `action` 只允许 `skip_index`）。
- 说明：这是**已知未做且被显式切边**的项，不是新发现，但属「必须具备」真空；体积中（worker 状态 + 报告 action + admin 二选一 UI）。

### 8.4 `GET /jobs/:id` **不存在**（功能表 §5.2 黄金集/评测行，P2）

- 要求：`14-模块需求功能表.md:377` —「黄金集 / 评测 | gold-questions CRUD；`eval/runs`；**`GET /jobs/:id`** | API 只入队，worker 跑批」。
- 现状：api 路由全表（`apps/api/src/routes/*.ts` 中 67 条 `routes.*(` 注册）**无 `/jobs/:jobId`**；最接近的是 `apps/api/src/routes/documents/index.ts:720-732`（`GET /documents/:docId/ingest-jobs` 只读账本）与 `apps/api/src/routes/eval.ts:225`（`GET …/eval/runs/:runId`）。
- 说明：语义上「入队后按 id 轮询」已被上面两个口覆盖大半；此项更像 wire 名差异，**建议在裁定工单里明确「以 ingest-jobs / eval runs 回读为准」或补一个薄别名**，不要为名字新开实现。

### 8.5 Langfuse 仍是 mock（功能表 §11「Langfuse 全链路」/ §5.1 请求日志可关联，P2）

- 要求：`14-模块需求功能表.md:575`（Langfuse 全链路 ask 节点 / 模型调用 / 评测 dataset，P2）；`:354`（请求日志上下文 tenant/kb/user/requestId 可关联 Langfuse，P2）。
- 现状：只有进程内 mock exporter——`apps/api/src/obs/ask-tracer.ts:19,68-74`（「langfuse mock export (SDK 未接入；主链 span 已记)」）、`apps/api/src/obs/memory-tracer.ts:20`；开关 `apps/api/src/env.ts:140-142`（「true 时打 mock export 日志；真 SDK 接线不阻塞本切片」）；`apps/api/README.md:16` 同口径。
- 说明：工单 10 已把「Langfuse SDK」划出；属**已知留雾**，列出以免被当成已齐。

### 8.6 P3b 专用 ACL 端点 `GET/PUT …/documents/:id/acl` 不存在（功能表 §5.2，P3b）

- 要求：`14-模块需求功能表.md:381` —「文档 ACL | `GET/PUT …/documents/:id/acl` | principals；缺省字段语义见安全 PRD | **P3b**（P2 可无端点，但禁止导入敏感语料）」。
- 现状：无该路由；语义由 `PATCH /api/v1/documents/:docId`（`apps/api/src/routes/documents/index.ts:621-655`）承担，字段 `aclPrincipals` 三态；列表/详情只读回显（`:195-199`）。
- 说明：功能表自己写明「P2 可无端点」，且工单 41 的验收落在这个 PATCH 上，**不建议**为此新开端点；仅记录为「契约形状与功能表 wire 名不一致」。

### 8.7 顺带核实为**已齐**（避免下一轮误当缺口）

| 项 | 证据 |
|----|------|
| 「召回增强关闭」看板标注 | `apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx:24,113`（`l0_template` 时出文案「召回增强关闭」）+ 测例 `apps/admin/tests/ops/chunk-strategy-panel.test.tsx:81-101` |
| 入库 job 账本 HTTP 回读 | `apps/api/src/routes/documents/index.ts:720-732` + `apps/api/src/services/ingest-jobs.ts:6-43` + admin 消费 `apps/admin/src/app/(ops)/documents/jobs.services.ts:9-16` |
| 跨文档去重默认 skip_index + 冲突对 | `apps/worker/src/ingest/pipeline.ts:501-527`（`crossDocDropped` / `conflictPairs`）+ 报告契约 |
| 分片策略 PATCH 拒未实现码 / `contextMode` 非法值 | `apps/api/src/services/chunk-strategy-catalog.ts:248-266`（`invalidContextModeOverride`） |

---

## 9. 关键文件清单（后续执行时会读）

### contracts

- `packages/contracts/src/ingest/document.contract.ts`（§2、§5）
- `packages/contracts/src/ingest/chunk-strategy.ts`（§7）
- `packages/contracts/src/ingest/ingest-report.contract.ts`（§8.2、§8.3）
- `packages/contracts/src/kb/kb-settings.contract.ts`（§4）
- `packages/contracts/src/ask/ask.contract.ts`（§3）
- `packages/contracts/src/system/model-gateway.contract.ts`（§7）
- `packages/contracts/src/system/platform-users-roles.contract.ts`（§1）
- 测例：`packages/contracts/tests/ingest/*`、`tests/ask/audit-contract.test.ts`、`tests/kb/settings-contract.test.ts`

### db

- `packages/db/src/schema/kb/documents.ts`（§2）
- `packages/db/src/schema/kb/ingest-reports.ts`（§8.2）
- `packages/db/src/schema/system/permission-definitions.ts`（§1）
- `packages/db/src/schema/kb/kb-settings-audits.ts`（§8.1）

### api

- `apps/api/src/routes/ask.ts`（§3）
- `apps/api/src/services/ask/traces.ts`（§3）
- `apps/api/src/routes/documents/index.ts`（§2、§5、§8.6）
- `apps/api/src/services/documents.ts`（§2）
- `apps/api/src/services/ingest-complete-pending.ts`（§2、§5）
- `apps/api/src/services/kb-settings.ts`（§5 敏感闸）
- `apps/api/src/routes/kb-settings.ts`（§4）
- `apps/api/src/routes/chunk-strategies.ts` · `apps/api/src/services/chunk-strategy-catalog.ts`（§8.1）
- `apps/api/src/middleware/admin-write-audit.ts`（§8.1）
- `apps/api/src/services/gateway/resolve.ts` · `types.ts`（§7）
- `apps/api/src/obs/ask-tracer.ts` · `env.ts`（§8.5）
- `apps/api/src/scripts/run-l1-golden.ts` · `apps/api/src/eval/adr046-snapshot.ts`（§4）

### worker

- `apps/worker/src/ingest/pipeline.ts`（§2、§7）
- `apps/worker/src/ingest/es-http.ts`（§5 检索侧）
- `apps/worker/src/ingest/embed-http.ts`（§7 参照形态）
- `apps/worker/src/env.ts`（§7）

### admin

- `apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx` · `roles/services.ts`（§1）
- `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · `upload.services.ts` · `write.services.ts`（§2、§5、§6）
- `apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx` · `chunk-strategy-panel.tsx`（§4、§6）
- `apps/admin/src/app/(ops)/models/_components/models-workspace.tsx` · `departments/.../departments-workspace.tsx` · `eval/.../eval-workspace.tsx` · `chunks/.../chunks-workspace.tsx` · `members/.../members-workspace.tsx` · `app/login/page.tsx`（§6）
- `apps/admin/src/components/admin-shell.tsx`（§1）

### admin-catalog / ui

- `packages/admin-catalog/src/menu-tree.ts` · `packages/admin-catalog/src/index.ts`（§1）
- `packages/ui/src/components/ui/closed-select.tsx` · `packages/ui/src/index.ts` · `packages/ui/package.json`（§6）

### web

- `apps/web/src/api/ask.ts` · `apps/web/src/components/ask-panel.tsx`（§3、§6）

---

## Caveats / Not Found

1. **未跑测试、未起服务**：所有判定基于静态读源码；「能跑通语义」按代码路径推断，未实测。
2. **`ask_traces` 列已核**：`answer` / `rawQuestion` / `standaloneQuestion` 均落库（`packages/db/src/schema/ask/ask-traces.ts:29-39`），但**无 citations 列**，故 §3 的终态重拉若要做到与 SSE 终态完全等价，仍需重建引用（或加列）。
3. **§4 的「链」真实数据源未定位**：`eval_runs` 是否已存 `gateBundle` / `evalBindId` 未核（只核到 ADR-046 快照写文件：`apps/api/src/scripts/run-l1-golden.ts:516`）。若表无列，§4 最小闭环要加列，体积升到中。
4. **admin 测例文件存在性未全核**：§1 / §2 / §5 建议的测例路径写为目录（`apps/admin/tests/ops/`），未逐一确认同名文件是否已存在。
5. **`docs/module-status/` 未逐包复核**：本报告只把镜像当交叉参考（引用了 `worker.md` / `db.md` / `api.md` 的少数行），可能滞后于源码；结论一律以源码为准。
6. **§6 计数口径**：`<select` 为大小写敏感匹配（20 处）；`<Select`（ui 组件）单独统计（4 处，均为 import 自 `@strict-rag/ui/components/ui/select`）。若仓库还有 JSX 动态组件包装（如 `React.createElement('select')`），未在本次扫描内（未见迹象）。
7. **未读 `.pen` 文件**（按任务约束）。
8. **未找到的项**：`GET /jobs/:id`（§8.4）、`GET/PUT …/documents/:id/acl`（§8.6）、`purpose=contextualize`（§7）、`pending_review`（§8.3）、`hitAtK` 于入库报告（§8.2）——均为「源码中确实不存在」，非扫描遗漏（已用全仓 ripgrep 覆盖 `*.ts` / `*.tsx`）。
