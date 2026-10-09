# 落：一致性闸与拒绝路径

Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定落地（形状以裁定为准，本节只记纪律）：

- 只改**裁定点名的文件**；判定逻辑优先落成**纯函数**（可单测、无 IO），IO 部分保持薄。
- 新增测例：只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 简介」简体中文，并登记该包 `tests/index.md`。
- **反证必须做**：把新闸去掉 → 至少一条用例变红（否则该闸是空转）；把反证结果与红条数写进 Answer。
- 若裁定要求出 ADR：ADR 写进 `prds/11-decisions/00-adr-index.md`（磁盘文件，不在版本库），并在 Answer 里贴出新增条目的标题与状态；若 ADR 要求改 PRD / 升版本，按「ADR → 改 PRD → 升 `prds/README.md` 版本」执行并在 Answer 里写明改了哪几行。
- **不得**放宽任何硬门、不得改默认开关、不得改 `prds/00–11` 的其它条款。
- 若既有测例因新闸变红：先如实记录「断言期望 vs 实测」，判明**断言过严**还是**实现缺口**；不得为变绿而放宽实现。
- 收尾跑：相关包测试 · `pnpm check-types` · `pnpm lint`（零 warning）。

## Answer

**已落**（提交 `9b961a1`）。按工单 02 的 R1–R8 执行，行为变化方向只有一条：`gatePackageId` 从「有值」变「无值」（加严），只在包与运行 τ 不一致或 τ 未记录时发生。

### 改了什么

| # | 文件 | 改动 |
|---|------|------|
| 1 | `packages/contracts/src/kb/kb-settings.contract.ts` | `QualitySnapshotSchema` 增可选 `gatePackageRejectedReason`（`z.enum(['tau_mismatch','tau_unrecorded'])`，`.nullable().optional()`）；导出同名类型 |
| 2 | `apps/api/src/services/eval-runs.ts` | 新增纯函数 `signoffPackageTauFromReport`（只有有限数算「已记录」，其余一律 `null`，**不做** `Number()` 强转）；`latestSignoffPackage` 的返回形状与 SQL 增 `reportJson` 取数，回 `tauClaim` |
| 3 | `apps/api/src/eval/gate-package-load.ts`（新） | 纯函数 `judgeGatePackageLoad`：`null`/非有限 → `tau_unrecorded`；不等 → `tau_mismatch`；相等 → 可加载。**严格相等、无容差** |
| 4 | `apps/api/src/routes/kb-settings.ts` | `defaultQuality` 四态；拒绝时置 null + reason + `gate_package_rejected` warn（**不静默**）；注释里的旧待办（「改由签字包加载须先 ADR」）改写为 ADR-062 归属说明 |
| 5 | `apps/api/src/routes/eval.ts` | 内口 `POST /internal/eval/execute-ask` 响应增 `tauClaim: env.TAU_CLAIM`（同进程同值，即图实际用于 min 否决的那个） |
| 6 | `apps/worker/src/eval/execute-ask-http.ts` | 只在下发有限数时带上 `tauClaim`，未下发保持缺省 |
| 7 | `apps/worker/src/eval/run-l1-batch.ts` | 逐题收集 `reportedTaus`；`repro.tauClaim` = **恰好一个同值**才记，全缺 / 分歧记 `null`（不取 worker 自己的 env） |
| 8 | `apps/admin/.../settings-workspace.tsx` | 导出 `rejectedReasonText`；质量（只读）区在 reason 出现时多一行中文说明。**不加控件、不给动作** |
| 9 | `prds/11-decisions/00-adr-index.md`（磁盘文件，不在版本库） | 追加 **ADR-062**（权威在包 / env 须一致 / 无包放行 / 三终态 / 生产者补齐；明写「未改任何条款文本 → 不触发 `prds/README.md` 版本变更」） |

### 新增测例

| 文件 | 条数 | 钉什么 |
|------|------|--------|
| `apps/api/tests/eval/gate-package-load.test.ts` | 7 | 取数（`0` / `1` 合法、缺键 / `null` / `NaN` / 字符串 → 未记录）+ 判定四态 + **无容差**（`0.5` vs `0.5000001` 也算不一致） |
| `apps/api/tests/kb/settings-gate-package-load.test.ts` | 4 | **走真 `defaultQuality`**（不注入 `qualitySnapshot`）的四态：一致 / 不一致 / 未记录 / 无包 |
| `packages/contracts/tests/kb/settings-contract.test.ts` | +1 | 新键可选、非法值拒、旧响应仍可解析 |
| `apps/worker/tests/eval/run-l1-batch-repro.test.ts` | +4 | 整批同值 → 记；部分下发 → 按那一个同值记；分歧 / 全缺 → `null`；`NaN`/`Infinity` 按未下发 |
| `apps/worker/tests/eval/execute-ask-http.test.ts` | +1 | 内口下发 → 原样带回；未下发 / `null` → **不带该键** |
| `apps/api/tests/eval/http-eval-runs.test.ts` | 改 1 处断言内 | 内口响应带 `tauClaim === env.TAU_CLAIM` |
| `apps/admin/tests/ops/kb-settings-workspace.test.tsx` | +1 | reason 出现时出中文说明，且质量区**仍无** button / textbox |

索引已登记：`apps/api/tests/index.md`（2 行）· `apps/worker/tests/index.md`（2 行改写）。

### 反证（必做项，已做）

把 `defaultQuality` 里的闸短路（`if (!verdict.loadable)` → `if (false && !verdict.loadable)`）→ `tests/kb/settings-gate-package-load.test.ts` **2 条红**（不一致、未记录），一致与无包两条仍绿（正是应有的形状：闸只管那两条）；还原后 4/4 绿。**这不是空转闸**。

### 既有断言变红：1 处（如实记账）

`apps/api/tests/eval/signoff-package-derive.test.ts` 有两条 `toEqual` 钉 `latestSignoffPackage` 的**返回形状**：

- 断言期望 `{ id, effectiveAt }`；实测 `{ id, effectiveAt, tauClaim: null }` —— 夹具行不带 `reportJson`，故 `tauClaim` 为 `null`。
- 判定：这是**新增字段**的必然结果，**不是**「断言过严」也不是「实现缺口」。按纪律补上 `tauClaim: null` 并**新增**一条「包内 τ 从 `report_json.repro.tauClaim` 取出、脏值判未记录」的用例（该文件 5 → 6 条）。**未放宽任何实现**。

### 门禁

`pnpm test` **11/11 成功**（api **185 files / 1153 passed + 3 skipped** · worker 61/288 · admin 39/199 · contracts 37/322 · web 19/56 · db 11/31 · admin-catalog 1/13，**零超时**）· `pnpm check-types` **8/8** · 四个受影响包 `lint` 零 warning · `pnpm check:module-status` 44 条，`1-路径` / `6-联动` / `7-时效` **为空**。

### 诚实面（未验证）

1. **无浏览器**：admin 那一行原因只有 RTL 覆盖，视觉与交互**未验**（人眼没看过）。
2. **SQL 未在真 PG 上跑过**：`latestSignoffPackage` 新增了 `reportJson` 取数列，谓词与选列的组合只在 mock 桩里验过；容器里没有真库验证（本机 Docker 实况未探测）。
3. **没有真「人签后的包」**：RACI 人签是文件产物，故端到端只能造「工程可签字」的行；「真 live 跑 + 人签 → 一致 → 照旧呈现」这条链**没有真数据走过**。
4. **worker 侧真实 HTTP 往返未验**：`tauClaim` 的传递在两侧各自单测（api 出参 / worker 解析），**没有**起真进程跑一次队列 job。

### 与裁定的偏差

无。R1–R8 逐条落地；R9 的不做清单原样保留（回写票记债）。

### 复核后收紧（2026-10-10 · 独立反向复核子代理）

复核（只读、尽力证伪）出 **1 处需收紧 + 5 处陈旧陈述**，逐条处理：

| # | 复核发现 | 处理 |
|---|---------|------|
| 1 | **R5 字面被放宽**：原实现「去重集合恰好一个元素」就记 τ —— 20 题里只有 1 题成功下发、其余 error 时也会记，**证据面比裁定所许更弱** | **收紧**：改为「**全部非 error 的题都下发了同一个 τ**」才记（`completedCases` / `tauReportedCases` / `reportedTaus.size` 三者同时满足）；「只部分题下发」现判 `null`。测例同步：原「部分下发 → 照记」一条改为「部分下发 → `null`」，并新增「error 题不下发不阻塞」一条 |
| 2 | `.scratch/acceptance-divergence/research/{02-adr-ready-findings,01-then-source-evidence}.md` 仍写「T6 = 丁 / 无运行时加载口 / 撞 ADR-007 唯一源」，而 spec 的 index 又指着它们当权威 | 两份**归档研究**顶部各加「2026-10-09 已被 ADR-062 部分超越」状态注（保留原取证，便于复现当时的判断依据） |
| 3 | `docs/testing/coverage/03-ops.md` 的 **T1 行**仍写「`adr046-snapshot.ts` 全仓无运行时读取 / 加载入口」，与同一册 T6 行自相矛盾 | 收窄为「**门禁快照 `gates` 本身**仍无运行时加载口；2026-10-09 起 τ 的一致性闸已落，但只覆盖 τ 一项」 |
| 4 | `docs/module-status/api.md` 的内口一行仍只写「回 `evidenceDocIds` 与 `minSupport`」 | 补 `tauClaim` 并写明谁消费它 |
| 5 | 「env 唯一源」措辞与 ADR-062 冲突（`.env.example` · `apps/api/src/env.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `.trellis/spec/api/backend/ask-pipeline.md`） | 四处改为「唯一 **env 承载**；有已签字包时须与包内 τ 一致」 |
| 6 | 镜像未明写**数据影响**（既有包会从「有值」变「无值」） | `docs/module-status/api.md` 签字包一节补「上线前产出的合格 run 若 τ 未记录 → 读面从有值变无值，须用新版 worker 重跑 L1 才恢复呈现」 |

复核同时要求补的边界测例（已补）：`repro` 非普通对象（数组 / 字符串）→ 未记录且不抛错 · `packageTau` 越过类型（字符串）→ 判「未记录」而非「不一致」 · `runtimeTau` 非有限（env 侧 zod 已挡，不可达）→ 判「不一致」不放行。admin 侧补「`tau_unrecorded` 文案可分辨」一条。

复核**明查无问题**的类别：加严方向（六个 env 默认开关零改动、判定严格相等无容差）· 测例非空转（kb 测例确实走真 `defaultQuality`，只用 `importOriginal` 替换仓储方法）· 生产者逐跳无丢值（内口 → worker 解析 → 批跑 → `persist` 白名单 → 取回）· 工单 04 的五条纠偏**无一条过头**（逐条核过源码）· ADR-062 与实现一致。复核**未能**核实的：真 PG 上的 SQL 组合 · 真进程端到端往返 · 未跑门禁（由主控跑）。
