# 裁定：「同一可见性函数」的形态与落点

Type: grilling
Status: open
Blocked by: 01

## 问题

按 ADR-057 `prds/11-decisions/00-adr-index.md:1867`「列表预览、chunk 查看、ask evidence **同一可见性函数**」，把今天五份组装（见 `01-research-visibility-seams.md` 的对照表）收敛成一处，需要先定形态，否则实现会各写各的：

1. **入口形状**：一个函数还是两个（`isDocVisible(ctx)` 返回 bool / `filterVisibleDocs(ctx, docs)` 返回集合）？ctx 里放什么（userId / tenantId / kbId / docId / 已加载的部门与 grant 数据）？谁负责 IO（调用方预加载，还是函数内部 load）？
2. **缓存**：是否复用请求级缓存（先例 `apps/api/src/auth/doc-scope.ts` 的 `createDocMemberGate`，请求级 `Map<string, boolean>`）？缓存的键与失效边界是什么？
3. **必须保留的差异**：分片预览的 403 文案、列表需要集合、详情只要 bool、`hasRetrievableDocs` 的语义（是否允许保留为薄包装）。
4. **不改什么**：收敛必须**逐位等价**（含 enforce 关时的短路、超管 bypass、grant 过期判定、`deptInheritDown` 参与点）。若研究发现存在真语义差异，先裁定哪一侧是 PRD 真值，再决定「改小的一侧」还是「记 ADR 债」。

## 约束

- 不得放宽：收敛后任一入口的可见集合不得大于今天的可见集合。
- 不改仓库默认开关；不改 `prds/00–11`。

## Answer

（待填）
