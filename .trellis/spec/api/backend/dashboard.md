# api · 数据面板薄壳（code-spec · B6）

> 路径：`apps/api/src/routes/dashboard.ts` · `services/dashboard.ts`  
> 契约：`@strict-rag/contracts` · `DashboardSummarySchema`  
> 切片：**薄壳只读** 3–5 指标；**≠** APM / 时序 / 改 schema / ask 图

---

## Scenario: dashboard summary

### 1. Scope / Trigger

- 管理端只读运营摘要
- 权限码 `dashboard.view`（默认仅 super_admin 模板全码）

### 2. Signatures

| 方法 | 路径 | 中间件 |
|------|------|--------|
| GET | `/api/v1/admin/dashboard/summary` | `requirePermission('dashboard.view')`（**始终**；不走 `AUTH_ENFORCE` 旁路） |

```typescript
// services/dashboard.ts
getDashboardSummary(repo?: DashboardRepo): Promise<DashboardSummary>
createMemoryDashboardRepo(seed?): DashboardRepo
since24hLocal(now?): string
```

指标（≤5）：

| 字段 | 来源 |
|------|------|
| `kbCount` | `knowledge_bases` count |
| `documentCount` | `documents` count |
| `pendingApprovalCount` | `documents` where `approval_status=pending` |
| `processReady` | `runReadyChecks().ready` |
| `askCount24h` | `ask_traces` count since 24h（本地时间串） |

### 3. Contracts

- DTO：`DashboardSummarySchema`（strict；`askCount24h` optional）
- 无写路径

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无 Bearer | 401 | UNAUTHORIZED |
| 无 `dashboard.view` | 403 | FORBIDDEN |
| 有码 | 200 | 信封 `data` = summary |

### 5. Good / Base / Bad

- **Good**：super_admin → 200 + 五字段（含 boolean `processReady`）  
- **Base**：memory repo 注入测形状  
- **Bad**：kb_admin（无 dashboard.view）→ 403

### 6. Tests Required

| 测 | 断言点 |
|----|--------|
| `routes/dashboard.test.ts` | 无 `dashboard.view` → 403 + `FORBIDDEN` + message 含码 |
| 同上 | super_admin → 200；`processReady` 为 boolean；计数来自注入 repo |
| 同上 | 无 Bearer → 401 |
| `dashboard.contract.test.ts` | strict 拒未知字段；`processReady` 非 boolean 失败 |

### 7. Wrong vs Correct

#### Wrong
```typescript
// route 内 SQL / 跳过 requirePermission
routes.get('/admin/dashboard/summary', async (c) => {
  const n = await db.select().from(documents); // 禁止
  return c.json(n);
});
// ADMIN_IMPLEMENTED_HREFS 未加 /dashboard 却宣称菜单可见
```

#### Correct
```typescript
routes.get('/admin/dashboard/summary', requirePermission('dashboard.view'), async (c) => {
  const data = DashboardSummarySchema.parse(await getDashboardSummary(repo));
  return ok(c, data);
});
// menu-tree: ADMIN_IMPLEMENTED_HREFS 含 '/dashboard'
```

### Do Not

- route 内 SQL  
- 新依赖 / APM / 改 ask / worker / schema  
- 宣称观测生产向 · mock 数字进业务签字页  
