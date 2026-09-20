# 抽共享闸模块 + 给 5 个读入口挂成员闸

Type: task
Status: resolved
Blocked by: 02

## 目标

1. **抽模块**：把前图写在 `apps/api/src/routes/documents/index.ts` 里的私有闸 `docWriteMemberDenied` 迁到 `apps/api/src/auth/` 下的共享模块（与 `kb-scope.ts` 同域），改名 `docMemberDenied(c, kbId, posture)`，导出 + 导出 `resolveKbMember` 注入类型。理由见 [02](./02-dec-read-gate-posture.md) §4：`kb-scope.ts` 明写「禁止 route 私写」，且 chunks 路由需要复用。
2. **给 5 个读入口挂闸**（顺序：成员闸 → 既有第二层闸）：

| 入口 | 位置 | posture |
|------|------|---------|
| `GET /documents/:docId` | `routes/documents/index.ts:815` | `'whenEnforced'` |
| `GET /documents/:docId/acl` | `:889` | `'whenEnforced'` |
| `GET /documents/:docId/ingest-jobs` | `:961` | `'whenEnforced'` |
| `GET /documents/:docId/chunks` | `routes/chunks.ts:110` | `'always'` |
| `GET /documents/:docId/chunks/:chunkId` | `routes/chunks.ts:153` | `'always'` |

3. `ChunkRouteDeps` 增 `resolveKbMember?`（`DocumentRouteDeps` 已有）。
4. 闸必须在取到 `doc`（或 `chunk.docId` → `doc.kbId`）之后、读数据之前；**拒绝时不得返回任何正文 / 名单 / 账本**。

## 测例

新增 `apps/api/tests/acl/doc-read-kb-member-gate.test.ts`（登记 `apps/api/tests/index.md`）：

- 非成员打 5 个入口 → 403 非成员文案，且**断言未触碰数据仓**（chunks 仓 `listByDocVersion` / `getChunk` 零调用；`ingestJobsRepo.listByDocId` 零调用）
- 成员 → 200（`chunks` 两条用硬姿态，无需开 enforce）
- `super_admin` 非成员 → 200（含 `GET …/acl` 与 `GET …/chunks`）
- `whenEnforced` 三个：`AUTH_ENFORCE` 关 → 不因成员闸被拦；开 → 非成员 403；成员 200
- 反证：临时让闸直放 → 新测例必须全红；还原后全绿、无残留

## 既有测例

先**实跑**取真实红名单（不用静态推断代替），再按前图同一手法处理：只改装载方式 + 注入宽松 `resolveKbMember` 桩，**断言一字不改**。预判（须实跑确认）：`acl/chunks-dept-filter.test.ts` · `acl/chunk-body-patch-denied.test.ts` · `ingest/chunks-http.test.ts`，以及显式开 `AUTH_ENFORCE` 的 documents 读用例。

## 硬门

- 前图 `tests/acl/doc-write-kb-member-gate.test.ts` 搬迁后**仍全绿**（搬迁回归证明）
- `pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · 全仓 `pnpm test` 11/11
- 未改任何默认开关；未动 `prds/00-11`
