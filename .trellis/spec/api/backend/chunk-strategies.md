# api · 分片策略注册表（ADR-053 / B12 · X-03 真 SSOT）

> 路径：`apps/api/src/services/chunk-strategy-catalog.ts`（表）· `chunk-strategies.ts`（写入闸）· `routes/chunk-strategies.ts`  
> **实现集合 SSOT**：`@strict-rag/contracts` → `IMPLEMENTED_CHUNK_STRATEGIES`（可写 ⊆ 此集）  
> **表权威**：`chunk_strategy_definitions` + `kb_chunk_strategies`（种子来自 `CHUNK_STRATEGY_PLATFORM_SEED`）  
> 契约：complete/reindex `chunkStrategy?`；catalog / schema / for-upload / PATCH 见 `chunk-strategy.contract.ts`  
> PRD：ADR-053 · 功能表 §4.5 · 剧本 AA

---

## Scenario: 注册表 + 可写入闸 + complete/reindex

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 上传 complete / reindex 写策略 | 跨层字段 + 400 矩阵 |
| 增删 catalog / 扩实现 | contracts `IMPLEMENTED_*` 与 api REGISTRY 对齐 |
| 旧文档策略 | **禁止**因注册表变更自动切换既有 `documents.chunkStrategy` |

**不在范围**：平台注册表运营 CRUD 页；paramSchema 动态表单引擎；worker 新算法；OCR；自动全库 reindex。

### 2. 两层集合（防假 SSOT）

```text
KNOWN (catalog)     = structure_paragraph · fixed_window · heading_sections
IMPLEMENTED (可写)  = structure_paragraph     ← 唯一 worker 可执行
```

| 规则 | 含义 |
|------|------|
| **可写入 ⊆ IMPLEMENTED** | complete/reindex 最终 code 必须 implemented（含「保留旧值」路径） |
| **worker 执行 ⊆ IMPLEMENTED** | 见 worker quality；未实现 → `UNSUPPORTED_CHUNK_STRATEGY` |
| **扩策略顺序** | ① worker 实现 + 测 ② 扩 contracts `IMPLEMENTED_*` ③ api 写入自动放开 |
| **禁止** | 仅扩 catalog 名字、worker 静默当段落切 |

### 3. Signatures

```typescript
// packages/contracts/src/ingest/chunk-strategy.ts
IMPLEMENTED_CHUNK_STRATEGIES  // string[]
isImplementedChunkStrategy(code): boolean
DEFAULT_CHUNK_STRATEGY        // structure_paragraph

// apps/api/src/services/chunk-strategies.ts
listChunkStrategies(): ChunkStrategyDef[]           // catalog（含 implemented 标志）
listWritableChunkStrategies(): ChunkStrategyDef[]   // 仅 implemented
isMultiStrategyCatalog(): boolean                   // catalog.length > 1
resolveDocumentChunkStrategy({ existing, requested, requireExplicit? })
```

| 符号 | 值 |
|------|-----|
| `DEFAULT_CHUNK_STRATEGY` | `structure_paragraph` |
| catalog 种子 | 三码（其中仅 default 的 `implemented=true`） |

**HTTP 挂载**：

| 路径 | 策略行为 |
|------|----------|
| `GET …/chunk-strategies` · `/schema` · `PATCH` | `kb.config.write`；PATCH 写 `kb_chunk_strategies` |
| `GET …/chunk-strategies/for-upload?contentType=` | 库启用 ∩ 文档族 ∩ **implemented**；仅 1 个 → `autoCode`；≥2 → `requireExplicit` |
| complete | 走 for-upload available：仅 1 个可省略自动；≥2 未选 → 400；写入 `chunk_strategy` + `chunk_strategy_params` 快照 |
| reindex | 同上 available 计数；既有已实现且仍 available 可省略保留；脏未实现省略 → 400 |

### Wire 字段名（X-12 · ADR-059）

| 层 | 字段 |
|----|------|
| **HTTP JSON（contracts）** | **`chunkStrategy`**（complete / reindex body） |
| **DB 列** | `chunk_strategy`（snake） |
| **PRD 历史写法** | 部分段落写 `strategy` → **语义同 `chunkStrategy`**；实现与验收 **只认** `chunkStrategy` |
| **错误文案** | `unknown chunkStrategy` / `chunkStrategy is required…`（非 `STRATEGY_REQUIRED` 魔法平行码，除非 contracts 另增） |

**禁止**：route 同时接受未文档化的第二键名却不在 contracts；或 PRD/前端只写 `strategy` 导致联调 400。

### 4. Validation & Error Matrix

| 条件 | HTTP | message 要点 |
|------|------|----------------|
| 未知 `chunkStrategy` | 400 | `unknown chunkStrategy` |
| 已注册但未实现 | 400 | `chunkStrategy not implemented by worker` |
| 保留旧未实现码 | 400 | 同上（禁假策略再入队） |
| reindex 多 catalog 未传 | 400 | `chunkStrategy is required (implemented: …)` |
| complete 多 catalog 无既有未传 | 400 | 同上 |

### 5. Good / Bad

- **Good**：reindex `{ chunkStrategy: 'structure_paragraph' }` → 写入/保留并 enqueue  
- **Good**：脏 `fixed_window` 文档 reindex 显式改 `structure_paragraph` → setChunkStrategy + chunk  
- **Bad**：多策略 reindex **静默** default  
- **Bad**：写入 `fixed_window` 却 worker 段落切且 manifest 标 `fixed_window`  
- **Bad**：只在 worker 实现新策略却不扩 contracts `IMPLEMENTED_*`（或反序只扩 catalog）

### 6. Tests Required

| 文件 | 断言点 |
|------|--------|
| `tests/ingest/chunk-strategies.test.ts` | writable 仅 default；未实现 400；保留脏码失败 |
| `tests/ingest/reindex-strategy.test.ts` | 未带 400；同已实现 retain；未实现 400；脏→已实现 change |
| worker `tests/ingest/chunk-strategy-loud-fail.test.ts` | `splitByChunkStrategy` 未实现 → UNSUPPORTED |

### 7. Wrong vs Correct

```typescript
// Wrong — 注册表有名即可写
const code = body.chunkStrategy ?? DEFAULT;
await setDoc(id, { chunkStrategy: code });

// Correct — resolve 含 implemented 闸
const gate = resolveDocumentChunkStrategy({ ... });
if (!gate.ok) return fail(c, BizCode.VALIDATION_ERROR, gate.message, 400);
```

---

## Design Decision: catalog 保留 roadmap 名

**Context**：B12 已播三策略产品名；worker 仅段落实现。

**Decision**：catalog 仍列 roadmap 码（`implemented:false`），**写入与执行**只放行 IMPLEMENTED。多 catalog 时 reindex 仍要求显式传，避免运营误以为可静默 default。

**Extensibility**：新策略上线 = 扩 `IMPLEMENTED_CHUNK_STRATEGIES` + worker `splitByChunkStrategy` 分支 + 测。

---

## 交叉引用

- worker 执行契约：[worker quality](../../worker/backend/quality-guidelines.md)  
- 分片只读（B1）：[chunk-readonly](./chunk-readonly.md)  
- IS：`docs/module-status/api.md` · `worker.md`
