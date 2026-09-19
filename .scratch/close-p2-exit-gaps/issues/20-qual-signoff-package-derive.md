# 派生签字包 gatePackageId / effectiveAt（只读）

Type: task
Status: open
Blocked by: 16

## Question

按 [16 的裁定](./16-dec-signoff-package-source.md) 实现：`qualitySnapshot.gatePackageId` / `effectiveAt` 从**恒 `null`** 改为**按 KB 从 `eval_runs` 读时派生**。

要做：

1. 在 `GET /api/v1/knowledge-bases/:kbId/settings` 的 `qualitySnapshot` 里派生：
   - `gatePackageId` = 该 KB 范围内**最近一条满足签字条件**的 `eval_runs.id`；
   - 「满足签字条件」按 ADR-061 四项：`signoffEligible` ∧ live 数据（`retrieve_mode=live`）∧ RACI 人签 ∧ 携带 ADR-046 配置快照；
   - `effectiveAt` = 该 run 行**已记录的创建时间**（不新增「签字时刻」字段）。
2. **无满足者 → 保持 `null`**：不臆造 id、不回落 env、不代签。
3. **只读**：不得加写路径（PRD 05 §2.1 明写「无通用写路径」）；**不加 migration**、不写新列。
4. 复用既有 repo 读取路径（线索 `apps/api/src/routes/eval-runs.ts` · `apps/api/src/eval/adr046-snapshot.ts` · eval_runs 表），**不要在 route 内散落 SQL**。

补测（负例优先）：① 无任何签字 run → `gatePackageId: null`（不得编造）；② 有不合格 run（非 live / 非 `signoffEligible` / 缺快照）→ 仍 `null`；③ 有合格 run → 取最近一条的 id 与创建时间；④ `GET` 行为在无合格 run 时与今天**逐位一致**（不回归）。

**不做**：运行时质量参数改从签字包加载（与 ADR-007 `tauClaim` 唯一源冲突，须 ADR）；签字动作落库（人签流程）；admin 展示增强。

## Answer

<!-- 解析时写 -->
