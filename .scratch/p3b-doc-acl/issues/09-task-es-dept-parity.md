# 落 ES 查询期与 PG 谓词的对称

Type: task
Status: open
Blocked by: 06

## 做什么

按 `06-dec-es-dept-field.md` 的裁定，补齐 ES 侧与 PG 谓词的对称：级别字段（若裁定补）、库级文档（缺 `ownerDeptId`）的查询期语义。涉及 `apps/worker/src/ingest/es-http.ts`（mapping / bulk）与 `apps/api/src/services/retrieve/es-sparse.ts`（mapping / bulk source / `buildAclFilter`）。

## 完成判据

- 新增/修改的 builder 纯函数有单测（含 fetch stub 断言 query 形状），注册进对应包 `tests/index.md`。
- 库级文档在**开强制**的查询期不再被 `terms ownerDeptId` 误丢（有断言）；同时**不放松**：缺失仍是「库内成员可读」，显式空仍是不可读。
- 反证：把新条件删掉 → 目标测例变红。
- `pnpm check-types` + `pnpm lint` + `apps/api` / `apps/worker` 测试全绿。

## Answer

（待填）
