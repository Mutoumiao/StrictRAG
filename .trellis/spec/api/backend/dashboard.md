# api · 数据面板薄壳（code-spec · B6）

> 路径：`apps/api/src/routes/dashboard.ts` · `services/dashboard.ts`  
> 契约：`@strict-rag/contracts` · `DashboardSummarySchema` · `DashboardTracksSchema`  
> 切片：**薄壳只读** 3–5 指标 + I4 质量/延迟双轨；**≠** APM / 时序 / 改 schema / ask 图 / 准出

---

## Scenario: dashboard summary

### 1. Scope / Trigger

- 管理端只读运营摘要
- 权限码 `dashboard.view`（默认仅 super_admin 模板全码）

### 2. Signatures

| 方法 | 路径 | 中间件 |
|------|------|--------|
| GET | `/api/v1/admin/dashboard/summary` | `requirePermission('dashboard.view')`（**始终**；不走 `AUTH_ENFORCE` 旁路） |
| GET | `/api/v1/admin/dashboard/tracks` | 同上；**不**改 summary 信封 |

```typescript
// services/dashboard.ts
getDashboardSummary(repo?: DashboardRepo): Promise<DashboardSummary>
getDashboardTracks(repo?: DashboardRepo): Promise<DashboardTracks>
createMemoryDashboardRepo(seed?): DashboardRepo
since24hLocal(now?): string
summarizeLatencies(samples): { scoredCount; avgMs; p95Ms }
```

`tracks.quality`：最近一笔 `succeeded` + `golden_2x2`（`ranAt` 降序）；无则字段 null。**不**含 `signoffEligible` / `businessPass`。  
`tracks.latency`：近 24h（与 `since24hLocal` 同窗）`askCount` / 有 `latency_ms` 的 `scoredCount` / `avgMs` / `p95Ms`（无样本 → null）。

指标（≤5）：

| 字段 | 来源 |
|------|------|
| `kbCount` | `knowledge_bases` count |
| `documentCount` | `documents` count |
| `pendingApprovalCount` | `documents` where `approval_status=pending` |
| `processReady` | `runReadyChecks().ready` |
| `askCount24h` | `ask_traces` count since 24h（本地时间串） |

### 3. Contracts

- DTO：`DashboardSummarySchema`（strict；`askCount24h` optional）；`DashboardTracksSchema`（独立信封，禁止塞进 summary）
- 无写路径

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无 Bearer | 401 | UNAUTHORIZED |
| 无 `dashboard.view` | 403 | FORBIDDEN |
| 有码 | 200 | summary 信封或 tracks 信封（各自 GET） |

### 5. Good / Base / Bad

- **Good**：super_admin → 200 + 五字段（含 boolean `processReady`）  
- **Base**：memory repo 注入测形状  
- **Bad**：kb_admin（无 dashboard.view）→ 403

### 6. Tests Required

| 测 | 断言点 |
|----|--------|
| `tests/ops/dashboard-http.test.ts` | 无 `dashboard.view` → 403 + `FORBIDDEN` + message 含码 |
| 同上 | super_admin → 200；`processReady` 为 boolean；计数来自注入 repo |
| 同上 | 无 Bearer → 401 |
| 同上 | tracks：空账本质量 null；注入 L1 + p95 回读；summary 无 quality 键 |
| `packages/contracts/tests/system/dashboard-contract.test.ts` | strict 拒未知字段；`processReady` 非 boolean 失败；tracks 拒 extra；summary 拒 quality |

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
- 往 `DashboardSummary` 塞质量/延迟字段  
- 宣称观测生产向 · mock 数字进业务签字页 · 把 tracks 当准出 PASS  
