# api · 分片只读（ADR-052 / B1）

> 路径：`apps/api/src/routes/chunks.ts` · `services/chunks.ts`  
> 契约：`packages/contracts/src/ingest/chunk.contract.ts`  
> PRD：`prds/05-api/01-http-api-hono.md` §2.3.1 · ADR-052 · 剧本 Z

---

## Scenario: 列表 preview + 点击全文

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 新增/改 chunk list/detail | 跨层 DTO + 权限码 |
| 改 body 截断策略 | UTF-8 **字节**软上限 64KiB |
| admin 分片页联调 | 始终 `chunk.view`；禁止列表灌 body |

**不在范围**：历史 indexVersion、分片写接口、Mongo 真 body（P1 读 PG `body_text`）。

### 2. Signatures

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| `GET` | `/api/v1/documents/:docId/chunks` | `requirePermission('chunk.view')` | 当前 `documents.indexVersion`；分页 |
| `GET` | `/api/v1/documents/:docId/chunks/:chunkId` | 同上 | 全文 body；可 truncated |

```typescript
// apps/api/src/routes/chunks.ts
export function createChunkRoutes(deps?: { chunks?: ChunksRepo })
// app.ts: app.route('/api/v1', chunkRoutes)
```

**鉴权纪律**：与 members 同族——**始终** `requirePermission`，**不**挂 `WhenEnforced`（demo-ingest 不走本路由）。

### 3. Contracts

**Query**（`ChunkListQuerySchema`）：

| 字段 | 约束 |
|------|------|
| `limit` | 1–100，默认 20 |
| `cursor` | 可选；上一页末 **ordinal**（coerce number ≥0） |

**List item**（**禁止** `body`）：

`chunkId, ordinal, preview, previewTruncated, indexVersion, tokenCount?, searchable?`

**List data**：`docId, indexVersion, status?, lifecycle?, items[], nextCursor`

**Detail**：list item + `body` + `bodyTruncated`

**Body 源**：PG `chunks.body_text`（Mongo 权威未上时的演示字段）。

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无/无效 Bearer | 401 | `UNAUTHORIZED` |
| 无 `chunk.view`（如默认 doc_operator） | 403 | `FORBIDDEN` |
| 非法 query | 400 | `VALIDATION_ERROR` |
| doc 不存在 | 404 | `NOT_FOUND` |
| chunk 不存在或非当前 indexVersion | 404 | `NOT_FOUND` |

### 5. Good / Base / Bad

- **Good**：kb_admin list → items 有 preview、无 body；detail → body  
- **Base**：indexVersion=0 无块 → items=[]  
- **Bad**：list 返回 body；用 char 数截 64KiB；历史 version 可查

### 6. Tests Required

| 测 | 断言 |
|----|------|
| `routes/chunks.test.ts` | doc_operator 403；kb_admin list 无 body；detail body；旧 version 404；分页 cursor；limit 非法 400；>64KiB truncated（字节） |
| `services/chunks.test.ts` | preview 截断；UTF-8 字节截断（中文） |
| `chunk.contract.test.ts` | Query 默认 limit；list shape 无 body |

### 7. Wrong vs Correct

#### Wrong
```typescript
// 列表夹带全文 / char 截断
items.map((c) => ({ ...c, body: c.bodyText }))
raw.slice(0, 64 * 1024) // 中文可能远超 64KiB UTF-8
requirePermissionWhenEnforced('chunk.view') // demo 旁路读全文
```

#### Correct
```typescript
toListItem(row) // 仅 preview；无 body 键
truncateUtf8ByBytes(raw, CHUNK_BODY_MAX_BYTES)
requirePermission('chunk.view')
// WHERE doc_id + index_version = documents.indexVersion
```

---

## 常量

| 名 | 值 | 位置 |
|----|-----|------|
| `CHUNK_PREVIEW_MAX` | 200 | `services/chunks.ts` |
| `CHUNK_BODY_MAX_BYTES` | 65536 | 同上 |
