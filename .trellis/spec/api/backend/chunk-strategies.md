# api · 分片策略注册表（ADR-053 / B12）

> 路径：`apps/api/src/services/chunk-strategies.ts` · 挂载 `routes/documents.ts` complete / reindex  
> 契约：`packages/contracts` document complete/reindex body 的 `chunkStrategy?`  
> PRD：ADR-053 · 剧本 AA · task `08-11-b12-chunk-strategies`

---

## Scenario: 注册表 + complete/reindex 策略闸

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 上传 complete / reindex 写策略 | 跨层字段 + 400 矩阵 |
| 增删注册策略码 | 进程内 `REGISTRY` SSOT；未知码拒写 |
| 旧文档策略 | **禁止**因注册表变更自动切换既有 `documents.chunkStrategy` |

**不在范围**：admin 分片策略运营 UI 大盘；worker 内自建第二套策略表；按文档类型自动选策略。

### 2. Signatures

```typescript
// apps/api/src/services/chunk-strategies.ts
listChunkStrategies(): ChunkStrategyDef[]
isRegisteredChunkStrategy(code: string): boolean
resolveRequiredChunkStrategy(requested?: string | null)
  // → { ok:true, code } | { ok:false, message }
shouldRetainExistingStrategy({ existing, next, explicitChange }): boolean
resolveDocumentChunkStrategy({
  existing?: string | null,
  requested?: string | null,
  requireExplicit?: boolean,  // reindex 多策略 / complete 无既有时
}): { ok:true; code; retained; changed } | { ok:false; message }
```

| 符号 | 默认 / 种子 |
|------|-------------|
| `DEFAULT_CHUNK_STRATEGY` | `structure_paragraph` |
| 注册种子（system） | `structure_paragraph` · `fixed_window` · `heading_sections` |

**HTTP 挂载**（`routes/documents.ts`）：

| 路径 | 策略行为 |
|------|----------|
| complete（多策略且文档**无**既有 strategy） | `requireExplicit=true` → body 必带 `chunkStrategy` |
| complete（已有 strategy） | 可省略 → **保留**旧值；显式传且不同 → 覆盖 |
| reindex（注册表 length > 1） | `requireExplicit=true` → body **必带**；未带 → **400**（禁静默 default） |
| reindex 显式新策略 | `changed=true`；审计日志含 code |

### 3. Contracts

| 字段 | 位置 | 约束 |
|------|------|------|
| `chunkStrategy` | complete / reindex body 可选 string | 必须 ∈ 注册表；reindex 多策略时必填 |
| 持久化 | `documents.chunkStrategy`（或等价列） | worker chunk 阶段读 `doc.chunkStrategy ?? structure_paragraph` |

**环境**：无独立 env；策略 SSOT 为进程内 Map（后续可扩 DB，须保持 `resolveDocumentChunkStrategy` 入口）。

### 4. Validation & Error Matrix

| 条件 | HTTP | code / message |
|------|------|----------------|
| 未知 `chunkStrategy` | 400 | `VALIDATION_ERROR` / `unknown chunkStrategy: …` |
| reindex 多策略未传 | 400 | `chunkStrategy is required (registered: …)` |
| complete 多策略且无既有且未传 | 400 | 同上 |
| 既有策略已不在注册表 | 400 | `existing chunkStrategy not registered` |
| 合法省略 + 有既有 | 200 | 保留旧 code；`strategyChanged=false`（reindex 响应） |

### 5. Good / Base / Bad

- **Good**：reindex body `{ chunkStrategy: 'fixed_window' }` → 写入并 enqueue  
- **Good**：旧文档 `heading_sections`，reindex 显式同码 → `retained`/`changed=false`  
- **Base**：单策略时代未传 → default `structure_paragraph`（兼容）  
- **Bad**：多策略 reindex **静默** default 而不 400（AA3 禁止）  
- **Bad**：注册表新增策略后批量改写历史文档 strategy  

### 6. Tests Required

| 文件 | 断言点 |
|------|--------|
| `services/chunk-strategies.test.ts` | 未知码失败；`requireExplicit` 未传失败；有既有可 omit 保留；显式覆盖 |
| `routes/documents.reindex.test.ts` | 多策略 reindex 未带 → 400；带同码 retain；带新码 change；complete 无既有未带 → 400 |

### 7. Wrong vs Correct

#### Wrong

```typescript
// reindex 多策略时静默 default —— 运营不知道用了哪套
const code = body.chunkStrategy ?? DEFAULT_CHUNK_STRATEGY;
await setDoc(id, { chunkStrategy: code });
```

#### Correct

```typescript
const multi = listChunkStrategies().length > 1;
const gate = resolveDocumentChunkStrategy({
  existing: doc.chunkStrategy,
  requested: body.chunkStrategy,
  requireExplicit: multi,
});
if (!gate.ok) return fail(c, BizCode.VALIDATION_ERROR, gate.message, 400);
```

---

## Design Decision: 进程内注册表 vs DB

**Context**：B12 最小闭环；策略种类少。

**Decision**：进程内 `Map` + system 种子；`listChunkStrategies` 可被未来 admin 只读 API 复用。

**Extensibility**：迁 DB 时只换 list/isRegistered 实现；**保留** `resolveDocumentChunkStrategy` 语义（显式 / 保留 / 多策略必选）。

---

## 交叉引用

- 分片只读（B1）：[chunk-readonly](./chunk-readonly.md)  
- 入库路由：`routes/documents.ts` · worker `ingest/pipeline` chunk 阶段  
- IS：`docs/module-status/api.md` · worker 读 strategy 字段  
