# 落 ES 部门组重塑（库级分支 + 关掉 ids 为空的 fail-open）

Type: task
Status: open
Blocked by: 09

## 做什么

按 `06-dec-es-dept-field.md` 第 2、3 节，把 `buildAclFilter` 的**部门组**从裸 `terms` 重塑为 `bool.should[terms, must_not exists]`，并把"ids 为空"从 ES 侧 fail-open 改为"只见库级文档"。

## 为何拆票

`09` 已把"是否收窄"的显式信号（`maxVisibleLevel`）与级别组落好，但**重塑部门组会改既有断言**（今天是 `{ terms: { ownerDeptId: [...] } }` 的独立元素，改后是 `bool.should` 元素），影响面与语义风险都比级别组大：

- 库级分支是**召回侧修复**（开强制时无部门文档在 ES 侧不命中，PG 却允许 → 稀疏召回丢文档）；
- `ids 为空 → 只见库级` 是**收紧**（今天 ES 对部门文档 fail-open，靠 `retrieve.ts` 的语料求交兜住）；
- 两者都会改 `apps/api/tests/ask/es-dept-query-filter.test.ts`、`es-sparse.test.ts` 里既有的 `terms` 精确断言。

拆开后，`09` 的改动保持纯增量、可单独回滚；本条独立承担断言改写与更细的反证。

## 完成判据

- `buildAclFilter` 部门组在**收窄生效**（`maxVisibleLevel` 传入）时为 `bool.should[terms(ids 非空时), must_not exists ownerDeptId]` + `minimum_should_match: 1`；`ids` 为空时**只有** `must_not exists` 一支。
- 严格保持："部门组与级别组是 filter 数组的两个独立元素"（并进同一 `should` 即放松）。
- 既有断言按新形状更新；新增断言覆盖两种情形（ids 非空 / ids 为空）。
- **反证**：把库级分支删掉 → 库级文档相关断言变红；把 ids 为空时的 `must_not exists` 换成"不加条件" → fail-open 断言变红。
- **只加严证明**写入注释：PG 对无 `ownerDeptId` 文档给独立级别规则（`dept-acl.ts` 的 `effectiveLevel`：任一处负责人 30，否则 20），已被级别组的 `lte` 上界覆盖。
- `pnpm check-types` + `pnpm lint` + `apps/api` 测试全绿。
- 保存 `apps/api/tests/ask/es-dept-query-filter.test.ts` 的 `toEqual` 断言改写说明（为何旧形状不再成立）。

## Answer

（待填）
