# 现状核实：签字包从哪来、τ 有几处取值、今天有没有一致性判定

Type: research
Status: claimed
Blocked by: —

## Question

把「签字包 → 运行时质量参数」这条链**逐条落到源码事实**，好让裁定票能拍板（不发明语义、不写建议）。要求每条结论**指到路径 + 行号**，并区分「源码事实」与「推断」。

1. **签字包是什么、谁生产**
   - `eval_runs` 表里被当作「已签字包」的行是哪些条件筛出来的？（`apps/api/src/services/eval-runs.ts` 的 `latestSignoffPackage` 与 `isSignoffPackageRow` / `SIGNOFF_PACKAGE_RUN_TYPE` / `SIGNOFF_ELIGIBLE_TRUE` 的**字面值**）
   - 生产者有哪几条路径？（api CLI `run-l1-golden.ts` / HTTP 入队 + worker 批跑 / 其它）各自写哪些列、`report_json` 里到底存了什么（列出顶层键）。
   - 「人签」在库里有没有表示？（RACI 是否只是文件产物）—— 给出证据。

2. **τ 的取值链（本图的核心）**
   - 全仓 `tauClaim` / `TAU_CLAIM` 的**每一处取值点**：谁读 env、谁读快照覆盖、谁读 KB 设置、谁读报告。
   - 运行时（ask 图）实际用的 τ 从哪来？给出从 `apps/api/src/index.ts` → `graph/state.ts` → `graph/run.ts` 的完整链。
   - `run-l1-golden.ts:757` 的 `snapIn?.tauClaim ?? env.TAU_CLAIM` 与「报告与快照读同一个值，不出现两个 τ」这句注释**是否成立**：同一条 run 上，报告里的 τ 与 ADR-046 快照里的 τ 分别是哪些字段、是否可能不等？
   - `packages/contracts` 的 `QualitySnapshot` / `KbSettings` 形状：今天对外**能看到的 τ** 是哪个值（env 的？包的？）。

3. **今天有没有任何一致性判定**
   - 全仓是否存在「包内 τ vs 运行时 τ」「包内其它参数 vs 运行时参数」的比较？（含测试、脚本、启动校验）
   - `apps/api/src/routes/kb-settings.ts` 的 `defaultQuality` 返回 `tauClaim: env.TAU_CLAIM` + `gatePackageId: pkg?.id`，这个组合在**包内 τ ≠ env τ** 时意味着什么？有没有任何地方会察觉？
   - 启动路径（`apps/api/src/index.ts` / `env.ts`）有没有加载包 / 校验包的动作？`TAU_CLAIM_LEGACY` 那条一致性校验今天挡的是什么、能不能类比成同型先例？

4. **PRD 与 ADR 的原文**
   - `prds/08-quality/02-evaluation-and-gates.md` §6.0 加严包表**逐行原文**（尤其「加载」「放宽」「标记」三行）与 §7 再认证触发表中与本图相关的行。
   - `prds/11-decisions/00-adr-index.md` 里 **ADR-007** 与 **ADR-046**、**ADR-061** 的原文：τ 的唯一源是怎么写的？§6.0 的「不一致 → 拒绝加载」是 ADR-046 的一部分还是另一处？
   - §6.0「加载」行的**反例列**「运行时 τ 与签字包脱节」在 PRD 里有没有更细的解释？有没有别处（10-delivery 剧本 T / 签字页必含行 / 09-security）提到「加严包必须真实生效」。

5. **可核对性与作用域（为裁定票准备事实，不下结论）**
   - 若要比对，包内 τ 从**哪个字段**取最可靠？（`report_json` 的哪个键路径；`gateSnapshot` 有没有落库；`l1-gate-snapshot.json` 是否只在文件里、是否 gitignore）
   - 一致性判定的**可能挂点**各有几个、各自的影响面：`defaultQuality`（设置读取面）· api 启动 · ask 运行路径 · worker 批跑。逐个给出「挂了会影响什么、今天的测例哪些会翻」。
   - 今天**无包**（新 KB / 未跑过 L1）时 `qualitySnapshot` 的形状与用例是哪些？任何新闸都不得让试点前的正常流程变红 —— 列出这些用例。
   - 列出**会翻的既有断言**（若裁定要求不一致即拒 / 或要求 τ 取自包），逐条给路径行号与「为什么必翻」。

6. **镜像与 spec 的现状**
   - `docs/module-status/api.md` 里关于 `qualitySnapshot` / 签字包 / τ 的**原文句**（含技术债表相关行）。
   - `.trellis/spec/api/backend/l1-eval.md` 里关于 §6.0 加载 / τ 唯一源的原文句。
   - `.trellis/spec/db/backend/database-guidelines.md` 与 `apps/api/README.md` 里关于签字包 / `signedPackage` 的原文句。

7. **反过来问（防高估）**
   - 有没有可能 §6.0「加载」行**已经**被某处实现了（只是不在这几个文件）？逐处找过再回答。若已实现，指出实现点与它的口径。
   - 有没有既有的**ADR-ready 裁定书 / 债行**已经声明本项不做或延后？（例如 `quality-gate-parity` / `close-p2-exit-gaps` / `l2-report-determinability` 的工单里关于「运行时加载口」的原文）—— 给出出处，避免本图与既有裁定打架。
   - `prds/00–11` 改冻结语义的正路是「ADR → 改 PRD → 升版本」；本节请确认：**不动 PRD** 的前提下能否满足 §6.0 的字面要求？（只回答「有几种读法、各读法下要不要改 PRD」，不下裁定。）

## Answer

待填（研究子代理产出 → [research/01-gate-package-load.md](../research/01-gate-package-load.md)）
