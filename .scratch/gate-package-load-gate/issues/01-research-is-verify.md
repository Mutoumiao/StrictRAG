# 现状核实：签字包从哪来、τ 有几处取值、今天有没有一致性判定

Type: research
Status: resolved
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

**研究子代理产出（350 行 / 42 KB）：[research/01-gate-package-load.md](../research/01-gate-package-load.md)**（全文按本工单 1–7 组组织，行号实测、三类标注、全称否定附搜索范围）。要点：

**① 签字包 = `eval_runs` 四列条件的最近一条**：`run_type='golden_2x2' ∧ status='succeeded' ∧ retrieve_mode='live' ∧ signoff_eligible∈{'1','true'}`（`apps/api/src/services/eval-runs.ts:46-47,53-62,337-349`），排序键是 `createdAt`（`:340`）；对外**只回 `{id, effectiveAt}`**（`:79-85`）→ **包内 τ 经此口读不到**。生产者三条：api CLI 直写（`run-l1-golden.ts:268-305`，`reportJson: report` 整份落库 `:289`）· HTTP 入队 + worker 回写（`routes/eval.ts:237` → `worker/src/eval/persist.ts:102-150` 逐键白名单）· L2（不入选集）。**人签不在库里**（`fixtures/l1/RACI.md` 文件产物；`isSignoffPackageRow` 自陈「不代签」）；代码里的「签字」只是两个入参布尔（`eval/adr046-snapshot.ts:47-48,166`），真实 CLI 恒 `false`。

**② τ 的取值链**：运行时唯一源 = env。`services/ask/execute.ts:204`（跑图入参）· `:271`（trace 快照）· `routes/kb-settings.ts:69`（设置读面）全部直读 `env.TAU_CLAIM`；**唯一判定消费点** = `graph/run.ts:542` 的 min 否决。`run-l1-golden.ts:757` 的 `snapIn?.tauClaim ?? env.TAU_CLAIM` 使报告（`:806`）与快照（`:847`）**共用同一局部变量** → 「不出现两个 τ」成立，但**靠共用变量而非校验**。

**③ 一致性判定：全仓零**。把 env τ 与包 id 并列返回却从不核对（`kb-settings.ts:67-71`）→ 包内 τ ≠ env τ 时读面**照样**呈现 env 的 τ 与那个包的 id，**无任何地方会察觉**。启动路径（`index.ts:18-48`）不加载包；`env.ts:207-213` 的 `TAU_CLAIM_LEGACY`（双源不一致 → 启动拒）是**同型先例但在纯 env 侧**。

**④ 关键反转（推翻了本图立项时「须 ADR」的一半前提）**：§6.0 加载行 `prds/08-quality/02-evaluation-and-gates.md:151` 就是 **ADR-046 决策 #4** 的下沉（`prds/11-decisions/00-adr-index.md:1024-1026` 逐字「运行时加载校验配置↔包一致；不匹配 → 拒绝加载」）+ `#2.4`（`:1017`「运行时质量参数写入 KB 配置快照，与签字包绑定」）；而 **ADR-007 原文（`:71-76`）只说「唯一 tauClaim / 废弃双阈值」，并没有写「唯一源 = env」** —— 那是 `apps/api/src/env.ts:16` / `.env.example:17-19` / `README.md:81-83` 三处**下游固化**。另有加强句 `prds/00-product/01-vision-and-success.md:113` 与**验收剧本 T6**（`prds/10-delivery/03-acceptance-scenarios.md:344`）「篡改快照 → **加载拒绝或**不一致告警失败」。

**⑤ 可核对性与挂点**：包内 τ 的**唯一载体** = `report_json.repro.tauClaim`（`packages/contracts/src/eval/l1-repro.ts:86`）；`gateSnapshot` **[推断] 未落库**（`run-l1-golden.ts:826` persist 早于 `:863` bind）；`l1-gate-snapshot.json` 只在文件且被 gitignore。**worker 产出的「签字包」`repro.tauClaim` 恒 `null`**（`run-l1-batch.ts:300-309` 用 `emptyL1Repro()` 只填三键；`apps/worker/tests/eval/run-l1-batch-repro.test.ts:67` 正断言 null），因其批跑**经 api 内口执行**、注释自陈「τ 在 api 侧，不回传」。四个可能挂点各有影响面；**`defaultQuality` 没有任何 200-路径专测**（全部设置 200 用例都注入 `qualitySnapshot`）→ 新闸在既有测例里**无回归保护**。

**⑥ 会翻的既有断言：几乎没有**。「不一致即拒」并挂 `defaultQuality` → **0 条必翻**；「τ 取自包」→ `l1-repro-fields.test.ts:146` 不翻（同变量），`run-l1-batch-repro.test.ts:67` **仅在把 worker 纳入作用域时翻**。**真正的风险是「无测试可翻」**。

**⑦ 反向复核**：§6.0 加载行**确未实现**（找过的模式与范围见报告 §7.1）。既有裁定一致地把本项「留给专门的图」：`acceptance-divergence`（T6 = 丁 · 阻塞方 ADR-007 · 销账条件 = ADR → 改 PRD → 升版）· `quality-gate-parity` 工单 01 行 21 = C · `l1-signoff-evidence` / `l2-report-determinability` 的 Out of scope · `docs/module-status/api.md:207` · `docs/testing/coverage/03-ops.md:114`。**没有任何一处声明「永不做」**。

**⑧ 四种读法（报告 §7.3，非裁定）**：读法 1「源切换」（τ 改取自包）**必**改 PRD（撞 ADR-007 的下游固化）；读法 2「一致性闸」（env 仍是承载，有包时必须相等，不等即拒）· 读法 3「有包才适用」（无包放行）· 读法 4「量词收窄」（只指 τ）在**字面**上都可不动 PRD 落地。

**未核**（已在报告中标明）：是否有别的「跨源（非纯 env）一致性闸」先例 · 「加载行反例列」有无更细解释（`prds` / `docs` / `.trellis` 均只有引用）· `report_json` 缺 `gateSnapshot` 系代码次序推断，未在真 PG 取行验证。

**研究纪律**：只读，未改任何源码 / PRD / 文档；产出只有本报告一个文件。
