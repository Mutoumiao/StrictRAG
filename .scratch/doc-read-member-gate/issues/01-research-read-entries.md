# 读入口枚举与各自姿态

Type: research
Status: resolved
Blocked by: —

## Question

「路径只有 `:docId`」的文档**读**入口一共有几个？各自用什么权限码、该码是什么姿态（始终验 / 随 `AUTH_ENFORCE`）、现在有没有第二层闸？

## Answer

**5 个**（不是 2 个）：

| 入口 | 位置 | 权限码 | 码的姿态 | 第二层闸 |
|------|------|--------|----------|----------|
| `GET /api/v1/documents/:docId` | `apps/api/src/routes/documents/index.ts:815` | `doc.view` | WhenEnforced | `docReadDenied`（部门 + aclPrincipals） |
| `GET /api/v1/documents/:docId/acl` | 同上 `:889` | `doc.view` | WhenEnforced | `docReadDenied`（**同一份判定**） |
| `GET /api/v1/documents/:docId/ingest-jobs` | 同上 `:961` | `doc.view` | WhenEnforced | **无** |
| `GET /api/v1/documents/:docId/chunks` | `apps/api/src/routes/chunks.ts:110` | `chunk.view` | **硬 `requirePermission`** | `deniedDocReadMessage` |
| `GET /api/v1/documents/:docId/chunks/:chunkId` | 同上 `:153` | `chunk.view` | **硬** | `deniedDocReadMessage` |

枚举方法：`grep -rn "'/documents/:docId" apps/api/src`，再按动词过滤出读入口（写入口 10 个已由前图工单 14 补闸）。

要点：

1. **`chunk.view` 是硬姿态**（`chunks.ts:105` `const view = requirePermission('chunk.view')`，注释明写「不走 AUTH_ENFORCE 旁路」）→ 这两个入口挂闸后**任何**测例都会去查成员，影响面与 `AUTH_ENFORCE` 无关。
2. **`doc.view` 三个是 WhenEnforced** → 只有显式开 `AUTH_ENFORCE` 的用例会受影响。
3. **`ingest-jobs` 是唯一连第二层闸都没有的读入口**：只 `requirePermissionWhenEnforced('doc.view')` 就返回 `ingestJobsRepo.listByDocId(docId)` —— 既无部门闸、也无 aclPrincipals 闸、更无成员闸。跨库读账本现成可达。
4. **两个 `chunks` 入口返回的是正文**（`toListItem` 做 preview 截断），严重度最高；`documents` 三个只回元数据 / 名单 / 账本。
5. 三个 `documents` 读入口的第二层判定是**共用同一份** `docReadDenied`（`index.ts` 注释：可见性闸「详情与 ACL 入口共用同一份判定」），故成员闸应加在这份判定**之外/之前**，不重复实现。

**影响面（静态枚举，未实跑）**：命中 chunks 读的测例文件 3 个 —— `apps/api/tests/acl/chunks-dept-filter.test.ts` · `apps/api/tests/acl/chunk-body-patch-denied.test.ts` · `apps/api/tests/ingest/chunks-http.test.ts`；documents 读侧则看谁显式开 `AUTH_ENFORCE`（如 `apps/api/tests/acl/documents-acl-endpoint.test.ts` · `apps/api/tests/acl/documents-dept-filter.test.ts`）。**收口前必须实跑取真实红名单。**
