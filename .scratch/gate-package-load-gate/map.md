# 签字包「加载」闸：运行时质量参数不一致即拒绝加载

Label: wayfinder:map
Status: open（前沿：工单 01–04；01 研究 → 02 裁定 → 03 落地 → 04 回写，串行）

## Destination

消掉质量门禁链上**最后一个结构空洞**：`prds/08-quality/02-evaluation-and-gates.md` §6.0（ADR-046 加严包）「加载」一行逐字写着 —— **「运行时质量参数**仅**来自已签字包；不一致 → **拒绝加载**」**，反例列写的是「运行时 τ 与签字包脱节」。今天源码里**这条没有实现**：`TAU_CLAIM` 的唯一源仍是 env（ADR-007），签字包只被用来**回填** `gatePackageId` / `effectiveAt`，**没有任何一处把「包内冻结的 τ」与「运行时 env 的 τ」比过** —— 即一个已签字的包可以被后来的 env 改动**静默推翻**，而呈现面照旧说「该 KB 的签字包是它」。

到达时满足：

1. **τ 的权威源有裁定**：env / 包 / 「二者必须一致」三选一，并写清它与 ADR-007（`TAU_CLAIM` 唯一源）与 §6.0（`仅`来自已签字包）的关系；若裁定要求动冻结语义 → **先出 ADR，再谈代码**。
2. **「拒绝加载」的形状已定**：判据（比哪个字段、取自哪里）· 作用域（哪些读面 / 运行路径参与）· 不一致时的终态（哪一处拒、回什么 reason code、是否降级为「不呈现该包」）· 无包时的姿态（试点前必须能跑）。**方向只能是加严**。
3. **实现落地且被测例钉住**：一致 → 既有行为逐位不变；不一致 → 有**可核对**的拒绝信号（不得静默、不得回落成「没测」）。
4. **镜像与雾清单一致**：`docs/module-status/api.md` 与 `.trellis/spec/api/backend/l1-eval.md` 按结论改写；雾清单簇 **3** 按结论改写；顺带纠正 `fill-must-haves` 图 `Not yet specified` 里**已被源码超越**的前置陈述（见工单 04）。
5. **未验证的如实写**：真「人签后的包」不存在（RACI 人签是文件产物）→ 端到端只能用**工程可签字**的 run 造包；不一致路径在真 PG 上的行为是否验过，按本机 Docker 实况写清。

**不含**：放宽任何硬门 · 真 judge live 跑 / ≥100 标注 / 真人抽检 / 人签 · 把签字包做成 admin 写面 · 无 ADR 时改 `prds/00–11`。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像。
- **来源（雾清单定位）**：`.scratch/fog-inventory-2026-09-23.md` 簇 **3** —— 「§6.0 运行时读取签字包（τ 仍取 env，无「不一致即拒加载」入口）｜挡「加严包真实生效」；**须 ADR**」。离线可做。
- **代码自己写下的待办**：`apps/api/src/routes/kb-settings.ts:64` —— 「`tauClaim` 仍取 `TAU_CLAIM`（ADR-007 唯一源；**改由签字包加载须先 ADR**）」；`apps/api/src/env.ts:16` —— 「tauClaim 唯一源：`TAU_CLAIM`」。两处与本图直接相关，工单 02 必须回答「这句待办本图是销掉、还是记成带条件的债」。
- **本图直接相关的既有面**（工单 01 逐条落源码行）：`apps/api/src/routes/kb-settings.ts`（`defaultQuality` / `qualitySnapshot` 注入点）· `apps/api/src/services/eval-runs.ts`（`latestSignoffPackage` 只回 `{id, effectiveAt}`）· `apps/api/src/scripts/run-l1-golden.ts`（τ 唯一源 = `snapIn?.tauClaim ?? env.TAU_CLAIM`，报告与快照同值）· `apps/api/src/eval/adr046-snapshot.ts`（`tauClaim` 进快照与判定）· `apps/api/src/graph/state.ts` / `graph/run.ts`（运行时消费 τ）· `packages/db/src/schema/ask/eval-runs.ts`（`report_json` 整份存 L1 报告）。
- 每轮先读：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` §6.0/§7 · `prds/11-decisions/00-adr-index.md` 的 ADR-007 / ADR-046 / ADR-061 · `docs/module-status/api.md` 的 L1 与「评测硬门的数据源债」行。写代码前读 `.trellis/spec/api/backend/l1-eval.md` 与 `.trellis/spec/api/backend/index.md`。
- **本图携带执行**：工单可以动手改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口批次跑 `pnpm test`，并跑 `pnpm check:module-status`（`1-路径` / `6-联动` / `7-时效` 必须空）。测例只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；**门禁只加严不放宽**；双就绪∧active 检索闸。
- **改既有测例的红线**：本图**只允许新增**测例；若真有既有测例因本图变红，先如实记录「断言期望 vs 实测」，判明是**断言过严**还是**实现缺口**，不得为了让测试变绿而放宽实现。
- **本机限制**：无浏览器（本图不涉 UI，故不受影响）；Docker 可用性按实际探测结果写，不得凭前图口径推断。

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 现状核实：签字包从哪来、τ 有几处取值、今天有没有一致性判定](./issues/01-research-is-verify.md) — 待填
- [02 · 裁定：τ 的权威源与「拒绝加载」的形状](./issues/02-dec-load-gate-ruling.md) — 待填
- [03 · 落：一致性闸与拒绝路径](./issues/03-task-implement.md) — 待填
- [04 · 回写](./issues/04-task-writeback.md) — 待填

## Not yet specified

- **§6.0 的「运行时质量参数」是否**只**指 τ**：除 τ 之外还有哪些质量参数今天取自 env / KB 设置而**没有**与包内快照比对（档位、`contextMode`、门限常量、`sessionEnabledDefault`…）？本图先收**可核对的那一个**（τ），其余按工单 01 的清单留雾，逐个带销账口径。
- **§6.0「加严方向」与「放宽」两行的实现度**：`stricter_than_pilot` 标记、加严 diff 表校验、「配置门禁无 ADR → 失败」今天各自落在哪里？未核。
- **包内 τ 的载体唯一性**：`report_json` 里 §8 复现块的 `tauClaim` 与 ADR-046 快照的 `tauClaim` 若在同一条 run 上不一致（两个 τ），一致性判据该以哪个为准？未核 —— 若真有两个，本图须先钉一个。
- **过期包的姿态**：§7 再认证触发表要求「否则门禁报告视为过期」。包过期（相对 `effectiveAt`）后是否仍呈现为「该 KB 的签字包」？本图可能只做一致性、不做时效，须在工单 02 明确划出或纳入。
- **一致但包内 τ 与「现行试点门禁包」不同**（加严包生效中）：呈现面是否需要区分 `gate_bundle=pilot|stricter`（§6.0「标记」行）？未核。

## Out of scope

- 放宽任何硬门；把 τ 的一次性改动包装成「加严」
- 无 ADR 就改 `prds/00–11` 已冻语义（改冻结语义的正路：ADR → 改 PRD → 升 `prds/README.md` 版本）
- 真 judge live 跑 · ≥100 条真标注校准集 · 真人抽检 · RACI 人签（环境与人，不在本机）
- 把签字包 / 门禁包做成 admin 写面或 CRUD
- worker 侧、web 侧、admin 视觉面（本图只碰 api 读取面与既有 CLI 造包路径）
- 顺带清扫与簇 3 无关的其它雾（各自另图）
