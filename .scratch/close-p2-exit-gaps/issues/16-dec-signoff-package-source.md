# 裁定签字包 gatePackageId / effectiveAt 的数据来源

Type: grilling
Status: resolved
Blocked by: 02

## Question

前图把「签字包链」（功能表 §4.2）列为前置未解；核查确认**仍然如此**：`defaultQuality()`（`apps/api/src/routes/kb-settings.ts:61-66`）恒写 `gatePackageId: null, effectiveAt: null`，是全仓唯一生产者；真实快照由 `writeBoundSnapshot` 落 `artifacts/l1-gate-snapshot.json`（`apps/api/src/eval/adr046-snapshot.ts:217-227`），并作为 `reportJson` 进 `eval_runs`（`apps/api/src/routes/eval-runs.ts:33-34`），**无任何回填 KB 设置的路径**。

请先钉事实再裁定：

1. **权威 PRD 行**：`gatePackageId` / `effectiveAt` 的字段定义与取值语义（ADR-046 快照、05-api KB 设置、08-quality 门禁包），逐条给行号。
2. **候选来源**：① 由 `eval_runs` 派生（哪一行的哪个字段、怎么选中「当前签字包」）；② 快照落库后回填 KB 设置；③ 继续只落文件、字段保持 null 并在合同上写明「未接」。逐个给代价与风险。
3. **裁定**：选哪条；`effectiveAt` 的取值口径（签字时刻 / 快照生成时刻 / 生效时刻）；回填时机与幂等要求。
4. **范围**：本图只做**数据来源的表示与回填**（工程侧），**不做**业务人签。请明确写出「做到哪一步」与「人签仍缺什么」。

答案须落到可编码精度；若结论是「本图不实现、只钉表示」，也须明确写出并说明它是否仍算本图缺口。

## Answer

### 一、事实基线（PRD 原文）

| 出处 | 原文要点 |
|------|----------|
| `prds/08-quality/02-evaluation-and-gates.md:150` | ADR-046 四要素之四：④ **KB 配置快照绑定 `eval_runs`** |
| `prds/08-quality/02-evaluation-and-gates.md:151` | 加载：「运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载**」 |
| `prds/08-quality/02-evaluation-and-gates.md:33` | L1 双轨（ADR-061）：签字 PASS = `signoffEligible` + live 数据 + RACI 人签 + **ADR-046 配置快照** |
| `prds/05-api/01-http-api-hono.md:106` | 质量：`GET` 可返回**只读** `qualitySnapshot: { tauClaim, gatePackageId, … }`；**无通用写路径** |
| `prds/README.md:204` | 0.4.20：门禁治理「**配置↔签字包绑定**」（ADR-046） |

**结论**：PRD 已经点名权威来源是 **`eval_runs`**（不是新表、不是文件），且 `qualitySnapshot` 是**只读**、**无写路径**。

### 二、现状（IS）

- `defaultQuality()`（`apps/api/src/routes/kb-settings.ts:61-66`）恒写 `gatePackageId: null, effectiveAt: null`，是全仓唯一生产者。
- 真实 ADR-046 快照由 `writeBoundSnapshot` 落 `artifacts/l1-gate-snapshot.json`（`apps/api/src/eval/adr046-snapshot.ts:217-227`），并作为 `reportJson` 进 `eval_runs`（`apps/api/src/routes/eval-runs.ts:33-34`）—— **数据已经在库里，只是没人回读**。

### 三、裁定

**1. 权威来源 = `eval_runs`，不新开表、不把文件当权威。** 与 PRD 逐字一致。

**2. 取值规则（可编码）**
- `gatePackageId` = 该 KB 范围内**最近一条满足签字条件**的 `eval_runs.id`。
- 「满足签字条件」按 ADR-061 的四项：`signoffEligible` ∧ live 数据（`retrieve_mode=live`）∧ RACI 人签 ∧ 该 run 携带 ADR-046 配置快照。
- **无满足者 → 保持 `null`**（= 未绑定签字包，如实为 null，**不臆造 id、不回落 env、不代签**）。

**3. `effectiveAt` 取已记录的既有时间戳**（该 `eval_runs` 行的创建时间），**不引入新的「签字时刻」字段** —— 那需要人工签字动作落库，属人签流程，不在本图。理由：不发明 PRD 未给的时钟语义。

**4. 回填方式 = 读时派生（read-through），不写库。**
PRD 明写 `qualitySnapshot` 只读、「无通用写路径」→ 正确做法是 `defaultQuality()` 从恒 `null` 改为**按 KB 查 `eval_runs` 派生**，而不是加回填任务或写列。**不需要 migration**。

**5. 本图明确不做（各有一条硬理由）**

| 不做 | 理由 |
|------|------|
| 「运行时质量参数仅来自已签字包」（§6.0 加载规则） | 与 ADR-007 / `env.ts:27`「**tauClaim 唯一源：`TAU_CLAIM`**」冲突，属改冻结语义 → 须 ADR + 改 PRD，不在本图 |
| 签字动作落库（业务 R + 产品 A 的签字记录） | 人签流程，**人不在环内不代签**（地图 Out of scope 已写） |
| KB 设置写路径写 `gatePackageId` | 与 PRD「无通用写路径」直接冲突 |
| admin 侧展示增强 | 非工程缺口 |

**6. 判定：这一块是本图范围内、`映射表 #1` 的最后一处工程侧缺口。**
做完它之后，#1 行**只剩业务人签**（`businessPass`），那部分不在本图。

**7. 派生实现**
→ 新开 [20 派生签字包 ID / 生效时刻](./20-qual-signoff-package-derive.md)（本票只裁定来源与规则）。
