# 签字包「加载」闸：运行时质量参数不一致即拒绝加载

Label: wayfinder:map
Status: resolved（前沿：空；工单 01–04 全收口；**ADR-062** 已写入 `prds/11-decisions/00-adr-index.md`）

## Destination

消掉质量门禁链上**最后一个结构空洞**：`prds/08-quality/02-evaluation-and-gates.md` §6.0（ADR-046 加严包）「加载」一行逐字写着 —— **「运行时质量参数**仅**来自已签字包；不一致 → **拒绝加载**」**，反例列写的是「运行时 τ 与签字包脱节」。今天源码里**这条没有实现**：`TAU_CLAIM` 的唯一源仍是 env（ADR-007），签字包只被用来**回填** `gatePackageId` / `effectiveAt`，**没有任何一处把「包内冻结的 τ」与「运行时 env 的 τ」比过** —— 即一个已签字的包可以被后来的 env 改动**静默推翻**，而呈现面照旧说「该 KB 的签字包是它」。

到达时满足：

1. **τ 的权威源有裁定**：env / 包 / 「二者必须一致」三选一，并写清它与 ADR-007（`TAU_CLAIM` 唯一源）与 §6.0（`仅`来自已签字包）的关系；若裁定要求动冻结语义 → **先出 ADR，再谈代码**。
2. **「拒绝加载」的形状已定**：判据（比哪个字段、取自哪里）· 作用域（哪些读面 / 运行路径参与）· 不一致时的终态（哪一处拒、回什么 reason code、是否降级为「不呈现该包」）· 无包时的姿态（试点前必须能跑）。**方向只能是加严**。
3. **实现落地且被测例钉住**：一致 → 既有行为逐位不变；不一致 → 有**可核对**的拒绝信号（不得静默、不得回落成「没测」）。
4. **镜像与雾清单一致**：`docs/module-status/api.md` 与 `.trellis/spec/api/backend/l1-eval.md` 按结论改写；雾清单簇 **3** 按结论改写；顺带纠正 `fill-must-haves` 图 `Not yet specified` 里**已被源码超越**的前置陈述（见工单 04）。
5. **未验证的如实写**：真「人签后的包」不存在（RACI 人签是文件产物）→ 端到端只能用**工程可签字**的 run 造包；不一致路径在真 PG 上的行为是否验过，按本机 Docker 实况写清。

**不含**：放宽任何硬门 · 真 judge live 跑 / ≥100 标注 / 真人抽检 / 人签 · 把签字包做成 admin 写面 · 无 ADR 时改 `prds/00–11`。（**工单 02 的 R5 / R7 把范围收进来了两处**：worker 侧**生产者补记 τ**（否则闸在队列路径上恒拒、功能半死）与 admin 侧**只读一行原因**（否则拒绝加载对运营静默）—— 两者都只加严，见下 `Out of scope` 的说明。）

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

- [01 · 现状核实：签字包从哪来、τ 有几处取值、今天有没有一致性判定](./issues/01-research-is-verify.md) — 研究子代理产出（350 行 / 42 KB 在 [research/01-gate-package-load.md](./research/01-gate-package-load.md)）。要点：① 「已签字包」= `eval_runs` 四列条件的最近一条（`run_type='golden_2x2' ∧ status='succeeded' ∧ retrieve_mode='live' ∧ signoff_eligible∈{'1','true'}`，`apps/api/src/services/eval-runs.ts:46-47,53-62,337-349`），对外**只回 `{id, effectiveAt}`** → 包内 τ 经此口读不到；人签是 `fixtures/l1/RACI.md` 文件产物、**不在库**。② 运行时 τ 唯一源 = env（`services/ask/execute.ts:204` · `:271` · `routes/kb-settings.ts:69`），唯一判定消费点 = `graph/run.ts:542` 的 min 否决；CLI 的报告与快照**共用同一局部变量**（`run-l1-golden.ts:757/806/847`）→「不出现两个 τ」成立但靠共用变量、**不是校验**。③ **全仓零一致性判定**：`kb-settings.ts:67-71` 把 env τ 与包 id 并排返回却从不核对，无人察觉；启动不加载包；`TAU_CLAIM_LEGACY`（`env.ts:207-213`）是同型先例但纯 env 侧。④ **关键反转**：§6.0 加载行就是 **ADR-046 决策 #4** 的下沉（`00-adr-index.md:1024-1026` 逐字「运行时加载校验配置↔包一致；不匹配 → 拒绝加载」），而 **ADR-007 原文并未写「唯一源 = env」**（那是 `env.ts:16` / `.env.example` / `README` 三处下游固化）→ 立项时「须 ADR」的半个前提被推翻。⑤ 包内 τ 唯一载体 = `report_json.repro.tauClaim`；**worker 产包 τ 恒 `null`**（批跑经 api 内口、「τ 在 api 侧，不回传」）；`defaultQuality` **无任何 200-路径专测** → 新闸无既有回归保护。⑥ 若挂 `defaultQuality` 加闸，**0 条既有断言必翻**；真正风险是「无测试可翻」。
- [02 · 裁定：τ 的权威源与「拒绝加载」的形状](./issues/02-dec-load-gate-ruling.md) — 主控裁定（**不动 `prds/00–11` 条款文本**；**出 ADR-062** 记归属澄清、明写不触发版本变更）。**R1** 选「包为权威 · env 为承载 · 两者必须一致」（读法 2+3），理由是这件事本就是冻结要求（ADR-046 #4 / §6.0 / 剧本 T6），且读法 1（τ 改取自包）在无包兜底、队列路径包无 τ、ask 改判定输入三点上不划算。**R2** 判据 = `report_json.repro.tauClaim`，**严格相等**、只比 τ；非数字 / 缺键 / `null` 一律归「未记录」（不 `Number()` 强转）。**R3** 不一致 → 拒加载（`gatePackageId`/`effectiveAt` → null + `tau_mismatch`）；**未记录 → 同侧拒加载**（`tau_unrecorded`）；无包 → null 且不带 reason（试点前逐位不变）；三者都配 warn 日志、**不得静默**。**R4** 只挂 `defaultQuality`；**不挂** api 启动（`parseEnv()` 期无 DB）· **不挂** ask 路径（改判定输入＝读法 1）· worker 只当生产者。**R5** 生产者补记 τ 必做（内口响应加 `tauClaim` → worker 逐题同值才写 `repro.tauClaim`；分歧保持 null），否则队列路径的包恒拒、闸半死。**R6** 契约加可选 `gatePackageRejectedReason`（两值）。**R7** admin 只加一行原因文案 + RTL。**R8** 三态专测 + 纯函数直测 + 契约 + worker 生产者 + **反证**。**R9** 逐条记债（§6.0 另三行 · §7 时效 · 其余质量参数 · ask 侧加载闸 · `tauStar` 接线 · 真 judge / 人签）。
- [03 · 落：一致性闸与拒绝路径](./issues/03-task-implement.md) — 提交 `9b961a1`。九处改动：契约加可选 `gatePackageRejectedReason` · `signoffPackageTauFromReport`（非有限数一律未记录，**不强转**）· `latestSignoffPackage` 回 `tauClaim` · 新纯函数 `judgeGatePackageLoad`（严格相等、无容差、只比 τ）· `defaultQuality` 四态 + `gate_package_rejected` warn · 内口回传 `tauClaim` · worker 批跑记进 `repro.tauClaim` · admin 只读回显一行原因 · **ADR-062**（磁盘文件）。**反证**：短路加载闸 → 不一致与未记录两条必红（零空转）。**既有断言变红 1 处**（`signoff-package-derive.test.ts` 的两条形状 `toEqual` 因新增 `tauClaim` 键）→ 判定为「新增字段的必然结果」，补键并**新增**一条 τ 取数用例，**未放宽实现**。门禁：`pnpm test` 11/11 · `check-types` 8/8 · `lint` 零 warning。
- [04 · 回写](./issues/04-task-writeback.md) — 提交 `28820d2`。镜像四处（api 签字包一节重写 + T6 技术债行重写 · contracts 新键 · worker 内口/批跑 · admin 只读回显）· spec 两处（`l1-eval.md` 新增「签字包『加载』校验」一节 · `index.md` 的 ADR-ready 八条补「T6 已收掉一半」）· 覆盖表两处（ops T6 行重写 / `coverage.md` 第十五轮）· 雾清单（簇 3 改写含**依据更正** · 顺手纠偏簇 10 · 新增 2026-10-09 追加段）· 总 backlog（B10-followup 补记）· **导航层五条陈旧「前置未解」纠偏**（孤儿清理激活版表示 · 签字包链生产者 · 自动 reindex-on-tighten · `pending_review` 三处未冻 · `drizzle/meta` 基线），并在 `fill-must-haves` 的 Notes 写明教训。`check:module-status` 44 条，`1-路径`/`6-联动`/`7-时效` 为空。
- **复核后收紧**（提交 `6c3ae18` · 独立反向复核子代理）— 抓到**1 处真问题**：批跑原按「去重集合恰好一个元素」记 τ，20 题里只 1 题成功下发时也会记 → 证据面比裁定所许更弱；改为「**全部非 error 的题都下发且同值**」才记，只部分下发判 `null`（测例同步 + 裁定票 R5 加注）。另修六处陈旧陈述/措辞（归档研究加「T6 已被部分超越」注 · 覆盖表 T1 行收窄 · 内口一行补 `tauClaim` · 镜像补**数据影响**（既有包会从有值变无值）· 四处「env 唯一源」改为「唯一 env 承载」）并补三个边界测例。复核**明查无问题**：加严方向（六个 env 默认开关零改）· 测例非空转 · 生产者逐跳无丢值 · 五条纠偏无一条过头 · ADR-062 与实现一致。

### 目的地达成（2026-10-09/10）

**「消掉质量门禁链上最后一个结构空洞：§6.0 加载行」已达成（收掉一半，另一半按裁定留为带条件的债）。**

1. **τ 的权威源有裁定**：**包为权威、env 为承载且必须一致**；写清与 ADR-007（原文未规定来源；「env 唯一源」是下游固化）与 §6.0（= ADR-046 决策 #4）的关系；**不动 `prds/00–11` 条款文本**，出 **ADR-062** 记录归属澄清并明写不触发版本变更。
2. **「拒绝加载」的形状已定**：判据 = `report_json.repro.tauClaim`（严格相等、无容差、只比 τ）· 作用域 = KB 设置读面· 终态 = `gatePackageId`/`effectiveAt` 置 null + `tau_mismatch` / `tau_unrecorded` + warn · 无包放行。方向**只加严**（唯一行为变化是「有值 → 无值」，且只在两种可核对情形下发生）。
3. **实现落地且被测例钉住**：一致逐位不变（既有 200 用例全绿）· 不一致有可核对信号 · **反证成立**（短路闸 → 2 条必红）。
4. **镜像与雾清单一致**：api / contracts / worker / admin 四处 + spec 两处 + 覆盖表两处 + 雾清单 + backlog；顺带纠正**五条**被源码超越的陈旧前置。
5. **未验证的如实写**：无浏览器（admin 只 RTL）· SQL 未在真 PG 跑过 · 无真「人签后的包」· worker 侧未起真进程跑 HTTP 往返。

**该被记住的四句话**：① **立项前提也要核**——本图出发时写「§6.0 ↔ ADR-007 冲突、须 ADR 改 PRD」，核实后发现 ADR-007 **原文根本没写**「唯一源 = env」，冲突是与**下游固化**的冲突；② **闸不能是「有值就行」**——复核抓到的正是「证据面比裁定所许更弱」，说明「同值」这种判据必须把**覆盖面**一起说清（谁必须上报）；③ **加严会改变可见面**——「拒绝加载」必然让既有包从有值变无值，这类数据影响必须写进镜像，否则运营只会看到 `—` 而不知为何；④ **生产者与判定要同批**——只加判定不补生产者，队列路径的包会全部恒拒，闸等于半死。

**提交（本地，未 push）**：`b9e7dc9` 立图 · `6dd4fad` 工单 01 · `71361ce` 工单 02 · `9b961a1` 工单 03 实现 · `28820d2` 工单 04 回写 · `6c3ae18` 复核收紧。**只在本分支 `main`，未建 worktree。**

## Not yet specified

（以下各条**都带销账条件**；已同步进 `docs/module-status/api.md` 的技术债行与 `.trellis/spec/api/backend/l1-eval.md` 的「未做」节。）

- **τ 的「来源」切换（读法 1 的完整形态）**：本图取「包为权威、env 须一致」，未把 τ 改成**由包推导**。做它要回答：`graph/run.ts:542` 的 min 否决每轮从哪取 τ（逐请求读库？进程内缓存 + KB 粒度？启动期加载？）；无包 KB 的兜底；与 §7「改 τ 须重跑」的闭环。**准入 = 先出 ADR → 改 PRD（§6.0 / ADR-007 的措辞）→ 升 `prds/README.md` 版本**（本图刻意不走这条路，只落了加严一致性闸）。
- **其余运行时质量参数与包的一致性**：档位（`retrieveK` / `rerankTopN` 派生自 mode）· `contextMode` · `sessionEnabledDefault` · 门限常量。本图只做 τ；做其余需要**先把 ADR-046 快照的快照落库**（工单 01 的推断：`gateSnapshot` 未落库 —— `run-l1-golden.ts` 的 persist 早于 bind）。**未核**：这条推断未在真 PG 上取行验证。
- **§6.0「加严方向 / 放宽 / 标记」三行的实现度**：`stricter_than_pilot` 与加严 diff 表校验已有纯函数与落盘裁决（覆盖表 T3 / T5 已测），但「**配置门禁无 ADR → 失败**」与「报告/看板 `gate_bundle=pilot|stricter`」的落点**未核**；`gate_bundle` 目前只在快照对象里。
- **§7 过期包时效（超 90 天 / 再认证触发）**：`effectiveAt` 只是该 run 的创建时间，读面**不做时效判定** —— 一个半年前跑出来的包今天照样呈现为「该 KB 的签字包」。要不要加时效闸、加在哪（读面 / 启动 / 跑批前）**未裁**。
- **api 启动期校验**：`parseEnv()` 是模块加载期、无 DB 句柄（`env.ts`），故「启动即校验全部 KB 的包」需要新的启动阶段（DB 就绪之后）。**未裁**是否需要。
- **worker 侧**：本图只让 worker 当生产者。若将来 worker 也参与判定（例如批跑前先校验本 KB 现行包与本次 τ 一致），须另裁 —— 注意 worker 的 τ 与 api 的 τ 是两个进程的 env。
- **`latestSignoffPackage` 的 SQL 组合未在真 PG 验证**：新增了 `report_json` 取数列，谓词 + 排序 + limit 的组合只在 mock 桩里验过（历史债，本图未引入）。
- **一致但包内 τ 与「现行试点门禁包」不同**（加严包生效中）：呈现面是否需要区分 `gate_bundle=pilot|stricter`（§6.0「标记」行）？未核 —— 归上条「§6.0 三行的实现度」。

## Out of scope（真正的划出项）

- 放宽任何硬门；把 τ 的一次性改动包装成「加严」
- 无 ADR 就改 `prds/00–11` 已冻语义（改冻结语义的正路：ADR → 改 PRD → 升 `prds/README.md` 版本）
- 真 judge live 跑 · ≥100 条真标注校准集 · 真人抽检 · RACI 人签（环境与人，不在本机）
- 把签字包 / 门禁包做成 admin 写面或 CRUD
- **web 侧**；admin 侧只做**只读一行文案**（工单 02 的 R7 把 admin 从「完全不碰」收了进来 —— 否则拒绝加载对运营是静默的）；worker 侧只做**生产者补记 τ**（R5），不做判定
- 顺带清扫与簇 3 无关的其它雾（各自另图）
