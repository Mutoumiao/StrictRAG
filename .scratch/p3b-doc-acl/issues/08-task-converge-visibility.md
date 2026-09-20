# 落「同一可见性函数」收敛

Type: task
Status: open
Blocked by: 04

## 做什么

按 `04-dec-visibility-function.md` 的裁定，把今天五份可见性组装（文档列表 · 详情/ACL · 分片预览 · ask 语料装载 · `hasRetrievableDocs`）收敛到一处，行为**逐位等价**。

## 完成判据

- 收敛后不存在第二份「部门 + principals」组合逻辑（除被收敛后的薄包装）。
- 既有测例全绿；新测例证明「同一函数」确实被复用（例如断言两入口在同一夹具下产出同一可见集合），并给反证（把该函数改宽 → 至少两条测例变红）。
- `pnpm check-types` + `pnpm lint` + `apps/api` 测试全绿。

## Answer

（待填）
