# 落人工抽检的登记面与判据

Type: task
Status: resolved
Blocked by: 02

## Question

按裁定票 02 的决定，把「人工抽检 ≥20 条、错 ≤1」从**两个没人读的常量**变成**可登记 + 可判定**：

- 按裁定建承载面（表 / 报告字段 / 命令，以裁定为准），并给出**至少一个合法的登记路径**（不是只建字段）。
- 把抽检结果接进 `evaluateAdr046Bind` 的业务 PASS 判定：**缺测不放行**；判据一律读常量、不在判定处写裸数字。
- 报告能区分「**没人登记**」与「**登记了但超标**」两种红（reason code 要能分辨）。
- 新增测例覆盖：边界（19 / 20 / 21 条；错 0 / 1 / 2）· 缺测 · 两种红的 reason code 各自正确 · 合法登记路径真的能让该门变绿（**证明不是空转闸**）。
- 每处改动配**反证**：改回旧口径（不看该值 / 缺测即放行）→ 测例必红；贴出红。
- 若新增 PG 表：迁移文件按既有 hand-written SQL 写法新增，并在 Answer 里写明「**未**在真 PG 上 apply 过」。

## 交付

- 源码 + 测例（登记该包 `tests/index.md`，文件头中文四段）。
- Answer 里给：改动文件清单 · 新增用例数 · 反证轮次与红条数 · 「旧为真 ⊇ 新为真」的自证 · **未做**清单。
- **不要**改 `tests/index.md` 之外的既有索引；**不要**提交（commit 由主控做）。

## Answer

**结论**：PRD §6 硬门「≥20 条，错 ≤1」从「两个没人读的常量」变成**可登记（文件账本 + CLI 入参 + 两侧报告字段）+ 可判定（fail-closed 进业务 PASS，三个 reason code 各可分辨）**，且**可达**（一份合法账本确实能把该门变绿，已在注入路径上证到 `businessPass=true`）。未新增 PG 表 / 迁移 / HTTP 端点（照裁定）。

### 1. 改动文件清单（10 项）

| # | 路径 | 作用 |
|---|------|------|
| 1 | `packages/contracts/src/eval/human-spot.contract.ts`（新）· `packages/contracts/src/index.ts` | 账本 Zod 契约 `HumanSpotLedgerSchema`（三不变式）+ 报告落点 `HumanSpotReport`/`toHumanSpotReport`；入口导出 |
| 2 | `apps/api/src/eval/human-spot.ts`（新） | api 侧账本加载器：缺文件 / 非 JSON / 违约一律抛 `HumanSpotLoadError`（不静默变缺测） |
| 3 | `apps/api/src/eval/adr046-snapshot.ts` | `evaluateAdr046Bind` 新增 fail-closed 门 `humanSpotOk` + 三个 reason code；`BindSnapshotInput` 透传 |
| 4 | `apps/api/src/scripts/run-l1-golden.ts` | `parseL1CliArgs`（`--human-spot <path>` / `=<path>`）、账本先读、`L1Report.humanSpot`、md 打印、CLI 摘要、坏账本 exit 2 |
| 5 | `apps/worker/src/eval/human-spot.ts`（新） | worker 侧同构加载器（同一契约、同一错误语义） |
| 6 | `apps/worker/src/eval/run-l1-batch.ts` | `humanSpotPath` 入参 + `L1BatchReport.humanSpot`（与 api 同形状） |
| 7 | `apps/worker/src/eval/persist.ts` | `reportJson` 白名单加 `humanSpot`（不加 = 静默丢弃，已用测例钉住） |
| 8 | `fixtures/l1/human-spot.example.json`（新）· `fixtures/l1/README.md` | 恰好达标的样例账本（20 条 / 错 1）+ 登记路径与不变式说明 |
| 9 | 测例：`packages/contracts/tests/eval/human-spot-ledger.test.ts`（新）· `apps/api/tests/eval/human-spot-gate.test.ts`（新）· `apps/api/tests/eval/l1-human-spot-cli.test.ts`（新）· `apps/worker/tests/eval/run-l1-batch-human-spot.test.ts`（新）· `apps/api/tests/eval/adr046-hard-gates.test.ts`（改助手 + 1 新用例）· `apps/api/tests/eval/l1-cli.test.ts`（3 处字面量补必填字段） | 见第 2 节 |
| 10 | `apps/api/tests/index.md` · `apps/worker/tests/index.md` · `packages/contracts/tests/index.md` | 登记新测例（存货闸 `check-test-inventory.mjs` 通过） |

**未碰**：`prds/` · `.trellis/` · `docs/module-status/` · 任何迁移 / 表 / HTTP 路由 / 仓库默认开关 / 其它包索引。

### 2. 新增 / 改写用例

- **新增 4 个测例文件、31 条用例**：contracts 账本契约 8 条 · api 判定边界 8 条 · api CLI/可达性 10 条 · worker 同构 4 条 · `adr046-hard-gates.test.ts` 新增 1 条（「抽检缺测 → 其他指标全过也不得业务 PASS」）。
- **改写既有**：① `adr046-hard-gates.test.ts` 的 `bind()` 助手补一份合法抽检入参 `LEGAL_HUMAN_SPOT`（`checked = humanSpotMin`、`errors = humanSpotErrorMax`）。**8 处 `businessPass === true` 的期望值一字未改** —— 它们是「其他都合法时业务 PASS 为真」的表达，新门落地后助手喂满即可继续表达同一件事；② `l1-cli.test.ts` 三处 `L1Report` 字面量补 `humanSpot: null`（新增必填字段的类型补齐，期望**值**未动）。
- 覆盖点：条数 19/20/21 × 错数 0/1/2 · 缺测不放行 · 条数不足 / 错超限各自 reason · `errors > checked` 拒绝 · `items` 与两个整数不一致拒绝 · 合法账本使该门**确实变绿**（`businessPass` 真为 `true`）· 样例账本可加载且恰好达标 · 判定处无裸数字（源码守卫：`gates.humanSpotMin` / `gates.humanSpotErrorMax` 必须出现，`20` / `1` 字面量不得出现在判定分支）· worker 落库白名单逐键不丢。

### 3. 反证（3 轮，均已贴红并还原复跑至全绿）

| 轮 | 改法 | 结果 | 红条数 |
|----|------|------|-------|
| 1 | `adr046-snapshot.ts` 的 `businessPass` 改回「不看该值」（`humanSpotOk === humanSpotOk`） | 红：`human-spot-gate` 6 条（缺测 / 条数边界 / 错数边界 / 双 reason / 0 条 0 错 / 常量边界）+ `l1-human-spot-cli` 2 条（只抽掉账本即翻红 / 错超限）+ `adr046-hard-gates` 1 条 = **9 条红**（`Test Files 3 failed，Tests 9 failed \| 17 passed`） | 9 |
| 2 | `human-spot.contract.ts` 去掉 `errors <= checked` 校验 | 红：contracts 1 条（不变式）+ api `l1-human-spot-cli` 2 条（坏账本抛错 / 坏账本一题不跑）+ worker 1 条（违约抛错）= **4 条红** | 4 |
| 3 | 删 worker `persist.ts` 白名单里 `humanSpot: report.humanSpot` | 红：worker 1 条（`expected undefined to deeply equal { checked: 21, errors: 2, … }`）—— 即「静默丢弃」陷阱被钉住 | 1 |

三轮均**已还原**，还原后三包测试 + `check-types` + `lint` 全绿（见第 5 节）。

### 4. 「旧为真集合 ⊇ 新为真集合」逐项自证

1. **`evaluateAdr046Bind`**：旧 `businessPass` = `signedPackage ∧ signoffEligible ∧ coverageOk ∧ cRateOk ∧ hitAtKOk ∧ judgeAurocOk ∧ citationCompleteOk ∧ !allInternalGuard`；新 = 旧 ∧ `humanSpotOk`。⇒ 新真集合 ⊆ 旧真集合（**只加严**）。`signedPackage` / `bindable` **不含**新门 → 逐位不变。新 reason code 只在「旧为真、新为假」的那一刻出现，不会把任何旧假变旧真。
2. **`humanSpotOk` 的口径**：`checked ≥ humanSpotMin ∧ errors ≤ humanSpotErrorMax`，两者都读 `PILOT_HARD_GATES`；「没登记账本」是 `humanSpot == null`（不是 0 条）→ 不放行。合法登记（≥20 ∧ ≤1）时，判定结果与旧代码**逐位相同**。
3. **contracts**：只新增 schema / 类型 / 纯函数；`EvalRunSchema` 等既有契约未改（`report_json` 不在 DTO 内，故无 `.strict()` 连带风险，已由既有 `http-eval-runs` / `gold-contract` 测试复跑确认）。
4. **api 报告与落库**：`L1Report` 增必填 `humanSpot`（缺测为 `null`，**不写 0 条占位**）；`buildEvalRunInsert` 仍整对象直落 → `report_json` 多一个键，列 / 判定 / DTO 均不变。
5. **worker 报告与落库**：`L1BatchReport` 增 `humanSpot`，白名单同步加键 → 报告键集合与库内 JSON 键集合的差集仍只含 `retrieveMode`（历史别名映射为 `mode`），由同构测例钉住。
6. **CLI**：`--human-spot` 之外的 argv 一律忽略（既有 env 驱动行为不变）；新增的失败模式只有「给了 `--human-spot` 却缺值」→ exit 2，属新增面的收紧。
7. **未放宽任何既有判定**：无一处 `reason` 被删除或改写、无一处门限数字被改、无一处 `null→合格`。

### 5. 门禁数字（还原后复跑）

- `pnpm check-types`：**8/8** task 成功（0 error）。
- `pnpm lint`：**8/8** task 成功，`--max-warnings 0` 零 warning。
- `pnpm --filter @strict-rag/contracts test`：**29** 文件 / **240** 用例全绿（本票前 28 / 232）。
- `pnpm --filter @strict-rag/api test`：**171** 文件 / **1048 passed + 3 skipped**（本票前 169 文件 / 1029 passed + 3 skipped）；含 `check-test-inventory` 存货闸通过。
- `pnpm --filter @strict-rag/worker test`：**50** 文件 / **225** 用例全绿（本票前 49 / 221）。
- 未跑全仓 `pnpm test`（按硬约束）。

### 6. 未做（如实列出）

1. **worker 生产路径未接账本来源**：`handleEvalJob`（BullMQ 消费者）没有传 `humanSpotPath`，也没有新的 env / payload 键 → worker 生产跑批的 `humanSpot` 恒为 `null`（**缺测，方向安全**，但意味着 worker 侧要真登记必须由调用方注入）。登记入口今天只有：api CLI `--human-spot <path>`、`runL1Batch({ humanSpotPath })`、`runL1Golden({ humanSpotPath })`。
2. **账本 `evalRunId` 只承载、不校验**：裁定只要求两条机械不变式（`errors ≤ checked`、给了 `items` 时与整数一致），故未加「账本 `evalRunId` 必须等于本次 run」的比对（那会引入 PRD 之外的约束）。报告只落条数 / 错数 / 来源，**不落** `sampledBy`/`sampledAt`/`items` 明细（明细留在账本文件里）。
3. **worker 侧没有 md 报告面**：md 打印只在 api CLI（`formatReportMd`）；worker 的报告面就是 `report_json`。
4. **spec 与镜像仍是旧文**：`.trellis/spec/api/backend/l1-eval.md`（含「未做（债）：人工抽检…无入口、无登记表、无报告字段」一节）与 `docs/module-status/api.md` / `worker.md` / `contracts.md` **未改**（本票硬约束禁止）→ **工单 06 必须回写**，否则 IS 镜像落后于源码。
5. **真人抽检动作本身**：仍是人做；`fixtures/l1/human-spot.example.json` 是**样例**（恰好达标 20 条 / 错 1），不是真实抽检数字，**禁止**当签字证据。

### 7. 与裁定/任务书不完全一致之处（如实报）

1. **worker 侧没有 argv 面**，故「同构地支持 `--human-spot <path>`」在实现上是「同一账本契约 + 同一路径入参」：api 走 `main()` 的 argv，worker 走 `runL1Batch` 的 `humanSpotPath` 编程式入参（即任务书说的「按其既有注入形态传入」）。两侧加载器各一份（两 app 不能互引），语义逐字相同。
2. **8 处 `businessPass === true` 未被改写期望值**：裁定预判「必须同步改该助手及其 8 处断言」，实际只需给助手补合法入参即可让 8 处原始期望继续成立（更小的改动面）。
3. **两条同时不过时同时报两个 reason**：裁定只要求「三个 reason code 各自可分辨」；`19 条 + 错 2` 这种双违规我实现为**同时**报 `human_spot_below_min` 与 `human_spot_errors_above_max`（单报哪个都会丢信息）。属实现选择，已在测例里钉住。
4. **`l1-cli.test.ts` 被连带改 3 行**（补必填字段 `humanSpot: null`）：裁定未预料到这一条，因为 `L1Report.humanSpot` 定为**必填可空**（缺测显式为 `null`，比可选字段更难被误读成「没这回事」）。**期望值未改**，只补字段。
5. **concurrency 纪律**：三包测试串行跑（未并发），符合 map 的前图教训。

