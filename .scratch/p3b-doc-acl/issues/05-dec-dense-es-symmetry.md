# 裁定：dense ∥ ES 对称的实现路径

Type: grilling
Status: open
Blocked by: 02

## 问题

ADR-009 `prds/11-decisions/00-adr-index.md:152` 逐字是「**dense 与 ES 对称**：共用 `buildAclFilter(ctx)`；**禁止**仅 ES 滤、dense 裸召回（含「dense top-k 再交 ES」）」。现状：`buildAclFilter` 只在 ES 稀疏路被调用（`apps/api/src/services/retrieve/es-sparse.ts:234`），dense 走 PG 语料余弦。

要在这两条里选一：

- **(A) 补落点**：让 dense 侧也真有一条 filter（需 pgvector 查询期条件或等价物）。要写清改动面、代价、是否被 B8 真 ES / pgvector 阻塞。
- **(B) 承认等价形态**：裁定「PG 语料（`loadCorpusFromDb` 先过部门 + principals 谓词）= ACL 真值源，ES 查询期 filter 只是粗收窄，且窄于真值」为可核对等价形态；代价是 ADR-009 `:152` 字面未满足 → **记 ADR 债**（须 ADR → 改 PRD → 升版才能销账，本图不改 `prds/00–11`）。

裁定必须包含：所选路径、**为什么不选另一条**、以及「只加严」的验证方式（怎么证明没有放宽）。

## 约束

- 只加严不放宽（ADR-046）。
- 不得以「补一个字面」为名引入不可验证的代码（例如没有真 pgvector 就无法断言的 filter）。

## Answer

（待填）
