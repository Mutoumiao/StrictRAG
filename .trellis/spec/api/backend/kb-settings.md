# api · 知识库设置（ADR-054 / B2）

> 路径：`apps/api/src/routes/kb-settings.ts` · `services/kb-settings.ts`  
> 契约：`packages/contracts/src/kb/kb-settings.contract.ts`  
> PRD：`prds/05-api/01-http-api-hono.md` §2.1.1 · ADR-054 · 剧本 AB（settings 面）

---

## Scenario: 白名单 PATCH + 质量只读 + rewrite 锁

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 新增/改 KB 设置 GET/PATCH | 跨层 DTO + `kb.config.write` |
| 禁写质量键 / rewrite 开 | 客户端改 τ 或误开 rewrite → 400 |
| admin 设置页联调 | 始终验码；无 AUTH_ENFORCE 旁路 |

**B2-W 已接线**（task `08-11-b2-w-kb-settings-wire`）：

| 能力 | 落点 |
|------|------|
| ask `mode∈allowedModes` / 缺省 `defaultMode` / 非法 mode → **400** | `services/kb-settings` · `resolveAskMode`（ask 入口，非仅 settings 页） |
| `config_json.docTypes` 读写对称；ask `scope.docTypes` ⊆ KB 列表（空=不限） | `assertScopeDocTypesAllowed` |
| Gateway KB 绑定叠 platform | `loadPlatformBindingSnapshot(tenant, repo, kbId)` → `getGatewayForTenant(tenant, kbId)` |

**仍不在**：admin **KB 级 model_bindings 写 UI**（schema/resolve 已支持）、τ 发布流（046）。分片策略见 [chunk-strategies](./chunk-strategies.md)（B12 **已归档**，非本页 UI）。

### 2. Signatures

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| `GET` | `/api/v1/knowledge-bases/:kbId/settings` | `requirePermission('kb.config.write')` | 含 quality + rewrite 锁 |
| `PATCH` | `/api/v1/knowledge-bases/:kbId/settings` | 同上 | body 白名单；写 Pino diff |

```typescript
// apps/api/src/routes/kb-settings.ts
export function createKbSettingsRoutes(deps?: {
  repo?: KbSettingsRepo;
  qualitySnapshot?: () => QualitySnapshot;
  resolveKbMember?: ResolveKbMember;
})
// app.ts: app.route('/api/v1', kbSettingsRoutes)
```

**鉴权纪律**：与 members/chunks 同族——**始终** `requirePermission`，**不**挂 `WhenEnforced`。  
`kb.config.write` 为 **kb scope**：非超管须 `kb_members`；测例注入 `resolveKbMember`。

### GET 与写码同码（X-34 · DEC-X4 默认）

| 决策 | **有意**：`GET` 与 `PATCH` settings **均**要求 `kb.config.write` |
|------|---------------------------------------------------------------------|
| 理由 | 设置页含 quality 快照与运营语义；避免「只读成员」看见 τ/内部锁细节后误当可调 |
| 非目标 | 未提供单独 `kb.config.read`；若产品要只读设置面 → **另开 ADR + catalog 码** 再拆 |
| **禁止** | 静默把 GET 降为 `doc.view` 却不改 PRD/IA |

### 3. Contracts

**PATCH body**（`PatchKbSettingsBodySchema` · **strict**）：

| 字段 | 约束 |
|------|------|
| `name?` | 1–200 |
| `description?` | max 2000 · 可 null |
| `allowedModes?` | `AskMode[]` 非空 · **唯一** |
| `defaultMode?` | ∈ 合并后 `allowedModes` |
| `docTypes?` | `string[]` · max 32 · 唯一；空 = 不限制；ask `scope.docTypes` 须为其子集 |
| `dataClass?` | `internal` \| `sensitive`；缺省 / 旧行 = `internal` |
| `deptInheritDown?` | 布尔；GET 未写 / 旧行 default **true**；运行时未写跟 env；admin 设置页可勾选，**未改不得带该键**（禁止把 GET 缺省 true 写回盖 env） |

**禁止** body 键：`tauClaim` · `crag*` · `allowDegradedGenerate` · `sessionRewrite*` · `retrieveK` · `route` · 密钥等 → Zod 失败 → 400。  
**仍不放开** τ / rewrite 写键。`dataClass=sensitive` **≠** 敏感已解禁。

**GET/PATCH data**（`KbSettings`）：

`kbId, name, description?, allowedModes, defaultMode, docTypes?, dataClass, deptInheritDown, qualitySnapshot, sessionRewrite`

| 只读区 | 形状 |
|--------|------|
| `qualitySnapshot` | `{ tauClaim, gatePackageId?, effectiveAt? }`；τ ← `env.TAU_CLAIM` |
| `sessionRewrite` | **固定** `{ enabledDefault: false, locked: true }` |

**持久化**：`name`/`description` → 列；modes / `docTypes` / `dataClass` / `deptInheritDown` → `knowledge_bases.config_json`。无 migration。  
运行时：`parseDeptInheritDownFromConfig` 仅认字面 true/false；未写 → `isDeptInheritDown()`。GET 回读未写仍展示 true。admin 设置页可勾选；**未改不得带该键**。

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无/无效 Bearer | 401 | `UNAUTHORIZED` |
| 无 `kb.config.write` | 403 | `FORBIDDEN` |
| 有码非 KB 成员（非超管） | 403 | `FORBIDDEN` |
| body 空 / 禁字段 / modes 重复 / 非法 `dataClass` | 400 | `VALIDATION_ERROR` |
| `defaultMode` ∉ `allowedModes` | 400 | `VALIDATION_ERROR` |
| KB 不存在 | 404 | `NOT_FOUND` |

### 5. Good / Base / Bad

- **Good**：kb_admin 成员 PATCH name/modes → 200 回读一致；GET 见 τ 与 rewrite 锁  
- **Base**：config_json 空 → 默认全 modes + `balanced` + `dataClass=internal`  
- **Bad**：PATCH `tauClaim`；列表/设置 UI 提供 rewrite 开关；`requirePermissionWhenEnforced`；宣称敏感已解禁

### 6. Tests Required

| 测 | 断言 |
|----|------|
| `routes/kb-settings.test.ts` | doc_operator 403；非成员 403；GET quality+锁+`dataClass=internal`；PATCH 回读；PATCH `dataClass`；非法 `dataClass` 400；τ/sessionRewrite 400；defaultMode 越界 400；未知 KB 404 |
| `kb-settings.contract.test.ts` | strict 拒禁字段；modes 去重；sessionRewrite 形状；`dataClass` 缺省 internal |

### 7. Wrong vs Correct

#### Wrong
```typescript
requirePermissionWhenEnforced('kb.config.write')
// PATCH 吞掉未知键继续写
body.tauClaim = 0.1
// GET 允许客户端改 sessionRewrite.enabledDefault
```

#### Correct
```typescript
requirePermission('kb.config.write', { resolveKbMember })
PatchKbSettingsBodySchema.safeParse(raw) // .strict()
sessionRewrite: { enabledDefault: false, locked: true }
// 变更：childLogger.info({ event: 'kb_settings_patch', diff })
```

---

## Scenario: ask 入口 mode / docTypes 闸（B2-W）

### Signatures

```typescript
// services/kb-settings（或同域 helper）
resolveAskMode({ requested?, allowedModes, defaultMode })
  // → { ok:true, mode } | { ok:false, message }  // 非法 → route 400
assertScopeDocTypesAllowed({ scopeDocTypes?, kbDocTypes })
  // 空 kbDocTypes = 不限制；否则 scope 须为子集
```

### Validation

| 条件 | HTTP | code |
|------|------|------|
| `options.mode` ∉ `allowedModes` | 400 | `VALIDATION_ERROR` |
| 省略 mode | 200 | 使用 `defaultMode`（须 ∈ allowed） |
| `scope.docTypes` 超出 KB 白名单 | 400 | `VALIDATION_ERROR` |

### Tests

`services/kb-settings-mode.test.ts` · ask 路由 mode-gate 用例。

---

## 挂账（勿在本切片宣称闭环）

| 项 | 说明 |
|----|------|
| gatePackageId / effectiveAt 真值 | 现恒 null；签字包流属 ADR-046 |
| admin 写 KB 级 model_bindings UI | 运行时 resolve 已接（B2-W）；运营写 UI 可后置 |
| 敏感入池解禁 | **闸有、解禁无**。`dataClass` 可写；complete 对 `sensitive` fail-closed（`DEPT_ACL_ENFORCE===true` ∧ `ownerDeptId` 非空才放行本闸）。complete body **可先写** `ownerDeptId` 再过本闸（P3b-UPL）。**禁止**宣称敏感语料已可入池 |
