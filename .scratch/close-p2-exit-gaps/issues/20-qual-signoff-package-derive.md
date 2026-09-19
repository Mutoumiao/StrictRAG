# 派生签字包 gatePackageId / effectiveAt（只读）

Type: task
Status: resolved
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

按 [16 的裁定](./16-dec-signoff-package-source.md) 实现。

### 改了什么

- `apps/api/src/services/eval-runs.ts`：
  - 新增纯函数 `isSignoffPackageRow(row)`（`run_type=golden_2x2` ∧ `status=succeeded` ∧ `retrieve_mode=live` ∧ `signoff_eligible ∈ {'1','true'}`）—— 口径只写一处，测例与 SQL 两侧同义引用，防漂移。
  - `EvalRunRepo` 新增 `latestSignoffPackage(kbId)`：按 `createdAt` 倒序取**最近一条**合格 run，回 `{ id, effectiveAt: createdAt }`；无合格者回 `null`。
- `apps/api/src/routes/kb-settings.ts`：`defaultQuality()` 从**恒 `null`** 改为按 KB 查 `eval_runs` 派生；`qualitySnapshot` 依赖签名改 `(kbId) => QualitySnapshot | Promise<QualitySnapshot>`，GET 与 PATCH 两处调用点都改为 `await`。
- **`tauClaim` 未动**：仍取 `TAU_CLAIM`（ADR-007 唯一源）；「运行时参数改从签字包加载」与 ADR-007 冲突、须先 ADR，不在本图。
- **未加列、未加 migration、未加写路径**：PRD 05 §2.1 明写 `qualitySnapshot` 只读、「无通用写路径」。

### 测例（5 条）

`apps/api/tests/eval/signoff-package-derive.test.ts`：口径正例（含 `signoffEligible='true'` 兼容值）；五类不合格（`mock` / `unknown` / 未合格 / 非 `succeeded` / 非 L1 账本）逐条为假；无合格 run → `null`（不臆造 id）；多条取最近一条；**创建时间缺失 → `effectiveAt` 为 `null`（不补造时刻）**。已登记 `apps/api/tests/index.md`。

### 未验证 / 未做（如实）

- **SQL 谓词本身未经真 PG 验证**：本仓无 PG 连接的单测环境，测例钉的是**纯函数口径**与映射；`latestSignoffPackage` 的 where 子句写死同一条件并注明「与 `isSignoffPackageRow` 同义」，但未对真库跑过。
- **RACI 人签不构成过滤条件**：它是文件产物（`fixtures/l1/RACI.md`），库里没有痕迹 → 本派生只保证「指向一条工程合格包」，**不等于业务人签**（不代签）。
- 签字动作落库、admin 展示增强、运行时参数改从包加载 —— 均不做（理由见 16）。

### 对映射表的意义

`映射表 #1`（L1 黄金集 + 试点门禁数字）的**工程侧到此闭合**：真跑数字、ADR-046 快照绑定、签字包 ID/生效时刻可见性都已有；该行仍为「部分」的原因只剩**业务人签**（`businessPass`），人不在环内。
