# 落：api 侧待审冲突发现面（按裁定）

Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定实现 api 侧所需部分（**若裁定为「复用报告区、不新端点」则本票只做测例补钉，并如实记录**）：

- 若裁定要新读端点：落 `GET`（路径 / 权限码 / 成员闸 / 分页与筛选维度按 02），DTO 进 `packages/contracts`（按域 Zod），错误码取 PRD 短名；不写 route 内 SQL（进 `services/`）。
- 不论是否新端点：补 api 测例钉住 —— 处置端点**既有**语义不得被改写（非法 `winner` / 非 `pending_review` / 不存在 / 非成员 / 缺码各一条）；若新端点则另加正/负例（成员、KB 边界、未知 docId）。
- 测例落 `apps/api/tests/<能力>/<意图>.test.ts`，文件头目标/简介简体中文，登记 `apps/api/tests/index.md`。

**不做**：改默认开关；改既有 `kbId`/`tenantId` 闸；代跑 reindex。

## Answer

**api 源码零改动** —— 工单 02 裁定「复用文档页已读的入库报告」，故**不新开读端点**：

- 既有 `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve` 的语义由 `apps/api/tests/ingest/dedupe-conflict-resolve.test.ts`（5 条：`winner=other` 保留 `duplicate_of` / `winner=this` 清并回 `reindexRequired` / 非待审 400 且不改数据 / 不存在 404 / 坏 body 400）与 `apps/api/tests/acl/doc-write-kb-member-gate.test.ts`（非成员 403 且不落决定）覆盖，**已满足**裁定语义，不改写。
- 补 01 号研究点名的缺口：新增 `packages/contracts/tests/ingest/dedupe-conflict-contract.test.ts`（**4 条**）—— body 只收 `winner` 两取值且拒未知字段；响应须回显 `docId`/`chunkId`/`winner` + `reindexRequired`，缺字段或 uuid 不合形即拒。登记 `packages/contracts/tests/index.md`。
- **不做**：新读端点（无生产者的半接线 + 新暴露面）、改 `kbId`/`tenantId` 闸、代跑 reindex、改任何默认开关。

**门禁**：`contracts` check-types · lint 绿；`contracts` test **37 文件 / 321 通过**（含新 4 条）。
