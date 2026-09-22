# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: resolved
Blocked by: 03, 04, 05

## Question

把本图三张落地票的成果回写成**可核对的镜像**，并收口：

- **镜像**：`docs/module-status/api.md` · `worker.md` · `contracts.md`（+ 若新增表则 `db.md`）——按源码写「已具备 / 未做 / 技术债」，新增的债写**销账路径**，并更新「最近更新」日期。**不写 `路径:行号`**，不给裸枚举字面量加反引号。
- **能力矩阵**：`docs/module-status/README.md` 的「观测 / 评测」行若成熟度措辞变化则增量回写（矩阵只写一句话，不展开）。
- **覆盖表**：`docs/testing/coverage/03-ops.md` 与 `docs/testing/coverage.md` 里 C3（Judge AUROC）等相关行按新事实改写；**行号若失效要同步**；若某行 coverage 值变化要如实改，没变要写明「只改证据不改值」。
- **spec**：`.trellis/spec/api/backend/l1-eval.md`（+ l2 若涉及）补「人工抽检登记面」「打分器来源三态」「§8 可复现区块」三节，写清禁则。
- **backlog 指针**：`.trellis/tasks/08-06-project-backlog/status.md` 里相关行（B10-followup 的签字余量、§2.5 QUAL 若涉及）如实更新；**不**改交付控制台以外的对外话术。
- **对抗性反向复核**：逐条检查「写进镜像的每句话在源码里真能指到吗」，把复核表写进 Answer。
- **收口门禁**（**在最后一次提交之后**复跑）：`pnpm check-types` · `pnpm lint`（零 warning）· 全仓 `pnpm test`（**无并发**）· `pnpm check:module-status` 的 `1-路径` / `6-联动` / `7-时效` 三类为空。数字写进 Answer。

## 交付

- Answer 里给：回写表（文件 → 改了什么）· 对抗性复核表 · 未解决项 · 门禁数字。
- 若发现**镜像里已被本图改假**的旧句子，一并纠正并在 Answer 里点名。

---

## Answer

回写完成，门禁全绿。只改文档（`docs/module-status/*` · `docs/testing/*` · `.trellis/spec/*` · `.trellis/tasks/*`），未改任何源码 / 测试 / 夹具，未 commit / push。

### 1. 回写表（文件 → 改了什么）

| 文件 | 改了什么 |
|------|----------|
| `docs/module-status/contracts.md` | ①「最近更新」前置新 `2026-09-23` 条（人工抽检账本契约 / 打分器来源三态 + 规模门常量 / §8 可复现区块与子路径导出）；②「已具备」新增两条（人工抽检账本 + 校准来源；§8 区块·子路径 `./eval-repro`）；③「技术债」加一行（子路径不进主入口 + `@types/node` devDep，附原因）；④「证据」加一行 |
| `docs/module-status/api.md` | ①「默认依赖模式」加 `JUDGE_CALIB_SCORER=off`；②「最近更新」前置新 `2026-09-23` 条（三样证据面 + 诚实面）；③ L1 工程 seed 节：CLI 报告字段补 `judgeAurocSource` / `humanSpot` / `repro`，新增 `--human-spot` bullet，跑法补该参数，**并点名纠正上一图遗留的假句**（纯函数 bullet「Judge AUROC 不计签字公式」→「**已**进 api 侧放行判定（来源 live + 规模 ≥100）」），「边界」bullet 改写（**六项**硬门全进判定 + 默认不可达的原因改成「来源非 live / 校准规模不足」）；④「明确未做 / 边界」两行改写（L1 业务签字门禁行 · 评测硬门的数据源债行）；⑤「技术债」签字包行补余量；⑥「证据」加一行 |
| `docs/module-status/worker.md` | ①「默认依赖模式」加 `JUDGE_CALIB_SCORER=off`（含 worker 无打分客户端）；②「最近更新」前置新 `2026-09-23` 条；③「评测消费者」节补三项证据面（含生产消费者不传账本 → `humanSpot` 恒 `null`）；④「明确未做 / 边界」加一行；⑤「技术债」加两行（抽检来源未接生产路径 · `repro` 分项不足）；⑥「证据」加一行 |
| `docs/module-status/README.md` | 能力矩阵「观测 / 评测」行**增量**改：Judge AUROC 补「判定只认来源 live 且校准集有效对数 ≥100」、业务 PASS 不可达原因改写；**点名纠错**——「人工抽检（≥20 条 / 错 ≤1）无登记面 —— 七项硬门里唯一没有数据源的一项」改为「已有文件账本登记面并进判定（`--human-spot`；缺测不放行）」；补「表内六项硬门现全部有数据源 + 进判定」与「L1 报告新增 §8 可复现区块」 |
| `docs/testing/coverage/03-ops.md` | ① 剧本 C 导语把 C4 从「部分测」改「已测」（与行级一致）；② **C3 行**按新事实改写（来源三态进判定 + PRD §4 规模门进判定 + 缺口）；③ **C4** 行号同步（`run-l1-golden.ts:437→669`、`run-l1-batch.ts:115→176`、`fixtures/l1/README.md:23→20-24`）；④ **T3** 行号同步（`adr046-snapshot.ts:146→165`）；⑤ **T6** 行号同步（`:174,268→:265,315`）；⑥ **T4** 「五项实测」→「**七项**实测」+ 缺口改写；⑦「本分册计数」补「**第五轮**」段（明写**只改证据不改值**） |
| `docs/testing/coverage.md` | ① 汇总后加「**第七轮（2026-09-23 · l1-signoff-evidence）**」段（照既有轮次写法，明写**无行级覆盖值变化**）；② 给第六轮三条债的第一条补「（其中第一条已由第七轮清掉）」 |
| `.trellis/spec/api/backend/l1-eval.md` | ① 硬门表加「人工抽检」行 + Judge AUROC 行补「来源 = live 且校准集有效对数 ≥100」；②「两条必读的诚实面」第 1 条改写（off 默认 + 夹具 8 → 不可达）；③ **新增三节**：「人工抽检账本登记面」「校准打分器来源三态与规模门」「§8 可复现区块」，各带**禁则**；④ 纠正三处已被改假的旧句：非目标段「Judge AUROC 不进签字公式」、Contracts `Judge AUROC` bullet「不拿实测值比 `judgeAurocMin` 翻签字」、交叉引用「不写签字公式」；⑤「未做（债）」行改写 |
| `.trellis/tasks/08-06-project-backlog/status.md` | B10-followup **两行**（摘要行 + §1.1 权威行）与「签字关键路径 · 余量」一行如实更新现状（表内六项硬门已全部有数据源 + 进判定；余量 = 真人抽检 + ≥100 真标注 + live judge 真跑 + 人签）。**未**动对外话术段（§0 那张表）、**未**新增 ID |
| `.scratch/l1-signoff-evidence/issues/06-task-writeback.md` | `Status: open` → `resolved` + 追加本 `## Answer`（原正文未删改） |

### 2. 对抗性反向复核表（写入的话 → 源码核对点，逐条核过）

| 写入的话 | 源码核对点 |
|---|---|
| 登记面 = 文件 JSON 账本；契约 `HumanSpotLedgerSchema` 进主入口 | `packages/contracts/src/eval/human-spot.contract.ts` · `packages/contracts/src/index.ts`（`export * from './eval/human-spot.contract.js'`） |
| 三条机械不变式（`errors <= checked`；给了 `items` 时 `items.length === checked` 且 `wrong` 条数 `=== errors`） | 同文件 `superRefine` |
| 报告落点 `HumanSpotReport` / `toHumanSpotReport`；缺测 `null` 不写 0 条 | 同文件 `toHumanSpotReport` + 头注 |
| 报告字段 `humanSpot`（条数 / 错数 / 来源） | `apps/api/src/scripts/run-l1-golden.ts` `L1Report.humanSpot` · `apps/worker/src/eval/run-l1-batch.ts` `L1BatchReport.humanSpot` |
| CLI `--human-spot <path>`（`=` 亦可），不传 = 缺测 | `run-l1-golden.ts` `parseL1CliArgs` |
| 坏账本抛 `HumanSpotLoadError` → exit 2（不静默降级成缺测） | `apps/api/src/eval/human-spot.ts` · `run-l1-golden.ts` `main()` `args.ok===false → exit 2` |
| 进闸 `humanSpotOk` = `checked >= humanSpotMin` ∧ `errors <= humanSpotErrorMax`，缺测不放行 | `apps/api/src/eval/adr046-snapshot.ts` `evaluateAdr046Bind` + `PILOT_HARD_GATES.humanSpotMin/ErrorMax` |
| 三个 reason code 各可分辨 | 同文件 `human_spot_missing` / `human_spot_below_min` / `human_spot_errors_above_max` |
| 一条合法账本确能让该门变绿（非空转闸） | `apps/api/tests/eval/l1-human-spot-cli.test.ts`（`allGreenRun` → `businessPass===true`）· `adr046-hard-gates.test.ts` 助手喂 `LEGAL_HUMAN_SPOT` |
| 样例 20 条 / 错 1「恰好达标」 | `fixtures/l1/human-spot.example.json`（`checked:20` / `errors:1`） |
| 新 env `JUDGE_CALIB_SCORER`（off 默认 / mock / http），api 与 worker 同构 | `apps/api/src/env.ts` · `apps/worker/src/env.ts` · `.env.example` · `turbo.json` |
| 报告 `judgeAurocSource`（live / mock / none）；判定只认 live | contracts `JUDGE_AUROC_SOURCES` / `judgeAurocSourceFor` · `adr046-snapshot.ts` `judgeAurocSource === 'live'` |
| 规模门 `JUDGE_CALIB_MIN_CASES = 100`；reason `judge_auroc_calib_too_small` 与缺测可分辨 | contracts `l1-matrix.ts` · `adr046-snapshot.ts` `judgeCalibPairs >= JUDGE_CALIB_MIN_CASES` |
| 声明 http 而 Gateway 非 http → 入口 exit 2 | `apps/api/src/eval/judge-scorer.ts` `judgeScorerGoNoGo` · `run-l1-golden.ts` `main()` |
| 真打分器走 `purpose: judge`，复用 ask 的 judge prompt / 解析 | `judge-scorer.ts` `createGatewayJudgeScorer`（`judgeSystemPrompt` / `judgeUserPrompt` / `parseJudgeScores`） |
| mock 伪打分器值可打印、不进判定（label 同源 → AUROC 恒 1） | contracts `mockJudgeScorer` |
| worker **无** Gateway 打分客户端（`http` 只声明不产值） | `apps/worker/src/env.ts` 注释 · `run-l1-batch.ts`（`http` 分支取 `opts.scoreJudge`，`consumer.ts` 未注入） |
| worker 生产消费者不传 `humanSpotPath` → 生产 `humanSpot` 恒 `null` | `apps/worker/src/eval/consumer.ts` `runL1Batch({ ... })` 无 `humanSpotPath` |
| `reportJson` 白名单加 `humanSpot` / `judgeAurocSource` / `repro` | `apps/worker/src/eval/persist.ts` `saveReport` |
| `L1Repro` 14 键、能取到取真值、取不到一律 `null`、区块内**无** `mode` | `packages/contracts/src/eval/l1-repro.ts` `L1Repro` / `emptyL1Repro` |
| 两条哈希：题面 id 集合升序 sha256 / 校准集内容逐字节 sha256 | 同文件 `l1QuestionIdsHash` / `l1CalibSetHash` |
| 走子路径 `@strict-rag/contracts/eval-repro` + devDep `@types/node` | `packages/contracts/package.json`（exports `./eval-repro` · devDeps `@types/node`） |
| api `repro` 取真值（env 三模型 / KB 绑定 / 档位派生 / τ） | `run-l1-golden.ts` `buildL1Repro` / `envModelOrNull` / `reproBudgetForAskMode` / `readKbBindings` |
| worker `repro` 只填 `questionIdsHash`，其余 `null` | `apps/worker/src/eval/run-l1-batch.ts` 返回处 |
| 校准夹具仍 **8** 条 | `fixtures/l1/judge-calibration.json`（`cases.length === 8`） |
| **六项**硬门全进判定（常量 `PILOT_HARD_GATES` 共 7 键，人工抽检占两键） | `adr046-snapshot.ts` `businessPass` 的 `&&` 链（coverage / cRate / hitAtK / judgeAuroc / citationComplete / humanSpot + signoffEligible + 非 `internal_guard`） |
| 默认配置（off + 8 条）下 `businessPass` 在生产路径不可达 | `judgeAurocOk` 要求来源 live ∧ 规模 ≥100 → 默认不达 |
| `adr046-hard-gates.test.ts` 助手喂满六项硬门（常量 7 键）（8 处 `businessPass===true` 期望未改值） | 同测试文件 `bind()`：`LEGAL_HUMAN_SPOT` / `LEGAL_JUDGE_SOURCE` / `LEGAL_JUDGE_PAIRS=JUDGE_CALIB_MIN_CASES` |
| 覆盖表同步的行号：`run-l1-golden.ts:669` · `run-l1-batch.ts:176`（`hitAtKCase` 调用）· `adr046-snapshot.ts:165`（`l1RerunBound`）· `:265`（`bindQualitySnapshotToEval`）· `:315`（`writeBoundSnapshot`） | 逐条 grep 当前源码确认 |
| 各包测试文件 / 用例数 | 本轮全仓 `pnpm test` 输出（见第 4 节） |

**结论：无一条指不到源码。** 唯一非源码断言是「默认配置下不可达」——由 `judgeAurocOk` 的三个合取条件 + 默认 env `off` + 夹具 8 条直接推出，属可核对推论。

### 3. 未解决项（如实列出，均已在镜像写成带销账路径的债）

1. **覆盖表 ops `C3` 仍 `部分测`**：live judge 真跑（本机无 Gateway / 密钥）、≥100 条真标注校准集、人签 —— 非离线可补；本轮只把「来源三态 + 规模门」的证据补上，未抬覆盖值。
2. **`repro` 未透出 DTO**（`…/eval/runs` 看不到）；**版本载体类字段仍 `null`**（seed / fallbackChains 版本 / promptVersions / lifecycle 规则版本 / session 策略版本）；**worker 生产路径不传抽检账本**（`humanSpot` 恒 `null`，方向安全）；**校准集哈希逐字节不做行尾归一**（CRLF 检出会变值）—— 均已记债，未在本文修复。
3. **`pnpm check:module-status` 仍有 39 条**（2 env + 13 符号 + 24 表），全部为概念名 / 字段误报（与基线同口径，未新增黑名单）；`1-路径` / `6-联动` / `7-时效` 为空。
4. 真 PG / 真 Gateway / 真 ES / Docker 均未跑（本机无基础设施）。

### 4. 门禁数字（在**最后一次改动之后**复跑）

| 命令 | 结果 |
|------|------|
| `pnpm check-types` | **8/8** task 成功（0 error TS） |
| `pnpm lint` | **8/8** task 成功，零 warning（`eslint . --max-warnings 0`） |
| `pnpm test`（全仓 · 串行无并发） | 首次**真跑**：**11/11** task 成功，exit 0；各包：`admin-catalog` 1 文件 / 13 用例 · `contracts` 31 / 254 · `db` 11 / 31 · `web` 19 / 56 · `worker` 52 / 233 · `admin` 38 / 185 · `api` 173 / **1076 passed + 3 skipped**（`ui` / `eslint-config` / `typescript-config` 无 test task）；合计 **1848 passed + 3 skipped**。最后一次改动（docs 内 markdown）后**复跑**为 turbo 缓存命中（`11 cached, 11 total` · FULL TURBO）—— 代码门禁的输入未变（markdown 不进 turbo 输入图），故结果等价 |
| `pnpm check:module-status` | **39 条 = 2 env + 13 符号 + 24 表**；`1-路径` / `6-联动` / `7-时效` **三类为空**（api / worker / contracts 的「最近更新」= 2026-09-23，无时效漂移） |

### 5. 与工单不符处

1. 工单写「`docs/testing/coverage/03-ops.md` 里 C3 等相关行按新事实改写（含失效行号的同步）」—— 实际不只 C3：C4 / T3 / T6 的行号也因本图改动失效，T4 的「五项实测」也已随新门变成**六项**，一并同步。若主控认为 T4 不在授权范围，可单独回退该行。
2. 工单要求「能力矩阵只写一句话成熟度」—— 该行本就长（历史累积），本轮只做**等长增量**改写，未扩写成清单。
3. 工单写「跑 `pnpm check:module-status` 须回到 39 条」—— 首跑为 **40 条**（我在 api.md 多写了一个反引号 `null`，被 `5-表` 按「表」上下文误报）；改成裸写 `null` 后回到 39 条，故**未**新增黑名单、未删真实能力描述。

### 6. 点名更正「已被改假的旧句」

| 位置 | 旧句（已假） | 改成 |
|------|--------------|------|
| `docs/module-status/README.md` 能力矩阵「观测 / 评测」 | 「**人工抽检**（≥20 条 / 错 ≤1）**无登记面** —— 七项硬门里唯一没有数据源的一项」 | 「**人工抽检**（≥20 条 / 错 ≤1）**已有文件账本登记面并进判定**（`--human-spot`；缺测不放行）」（本图工单 03 已改假） |
| `docs/module-status/README.md` 同行 | 「生产入口不接打分器 → businessPass 不可达」 | 「判定只认来源 live 且校准集有效对数 ≥100；打分器默认 off → 不可达」（本图工单 04 已改假） |
| `docs/module-status/api.md` 纯函数 bullet | 「独立校准集 Judge AUROC … **不计签字公式**」 | 「**已**进 api 侧放行判定（来源 live + 校准规模 ≥100）」（上一图工单 03 已改假） |
| `.trellis/spec/api/backend/l1-eval.md` 三处 | 非目标段「Judge AUROC 不进签字公式」· Contracts bullet「不拿实测值比 `judgeAurocMin` 翻签字」· 交叉引用「不写签字公式」 | 均改为「**已**进 api 侧放行判定（判定只认 live + 规模门）」 |
| `.trellis/spec/api/backend/l1-eval.md` 三条债行 | 「人工抽检 ≥20 条 —— 全仓无入口、无登记表、无报告字段」 | 「登记面已落，数字须人给；样例是恰好达标样例、禁止当真实数字」（本图工单 03 已改假） |
| `.trellis/spec/api/backend/l1-eval.md` 诚实面 | 「生产入口不接校准打分器 → `judgeAuroc` 恒 null」 | 「来源由 env `JUDGE_CALIB_SCORER` 声明（默认 off）… 默认配置下不可达」（本图工单 04 已改假） |
| `docs/module-status/api.md` 评测硬门数据源债行 | 「人工抽检无入口/无表/无字段 → 无数据源」·「可复现字段在 L1 报告里基本不存在」 | 「登记面 + 判定已落，真人动作仍须人」·「`repro` 已进报告，版本载体类字段仍 null + 销账路径」 |

### 7. 主控复核补记（2026-09-23）

回写文案里一处**计数口径错**，主控复核时纠正，涉及 6 处文本（`docs/module-status/README.md` · `api.md` · `docs/testing/coverage/03-ops.md` 两处 · `docs/testing/coverage.md` · `.trellis/tasks/08-06-project-backlog/status.md` 三处 · 本工单 Answer）：

- **错**：「**七项**硬门现全部有数据源 + 进判定」。
- **对**：PRD `prds/08-quality/02-evaluation-and-gates.md` §6 硬门表共 **7 行**，其中 **6 行是「硬」**（C 率 / 覆盖率 / 引用完整率 / Judge AUROC / Hit@20 / 人工抽检），第 7 行「ask P95 strict ≤20s」标的是「**建议**→业务可升硬」，**不在**判定内。「七」的来源是 `PILOT_HARD_GATES` 的 **7 个键**（人工抽检占 `humanSpotMin` / `humanSpotErrorMax` 两键），不是 7 项门。
- **改法**：一律写作「**表内六项硬门**已全部有数据源并进判定」，并补一句「常量 `PILOT_HARD_GATES` 共 7 键，人工抽检占条数与错数两键；表内第七行是建议项、不在判定内」。
- **教训（供下一张图）**：「N 项硬门」这个说法在本仓有**两个可能的口径**（§6 表的硬行数 vs 常量键数），凡用到就必须把口径写出来，否则数字对了也可能读错。
