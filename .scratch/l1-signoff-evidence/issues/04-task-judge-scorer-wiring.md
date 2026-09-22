# 落校准打分器的接线与来源三态

Type: task
Status: resolved
Blocked by: 02

## Question

按裁定票 02 的决定，给 Judge AUROC 硬门一条**可达但不作假**的路径：

- 实现「打分器来源」的判别（live / mock / 缺测三态，以裁定为准的声明方式），并让 **mock 与缺测都不放行** AUROC 门。
- 按裁定的决定处理「mock 的 AUROC 值是否打印」；无论哪种，都必须有测例钉住「mock 来源不能使 `businessPass` 为真」（PRD §6.1：mock 数字禁进签字包）。
- 若裁定在判定处加校准集规模门（PRD §4 ≥100），按裁定落地：规模不足 → 不放行，且 reason code 与「缺测」可分辨。
- 两条入口（api CLI 与 worker batch）**必须同构**：任何只落一侧的改动都算未完成（前图教训：两侧同义实现分叉过一次）。
- 新增测例覆盖：三态各自 · 边界 · 缺测 · reason code · 「live 打分器注入后该门可真」（可达性证明）。
- 每处改动配**反证**：改回旧口径（不注入即放行 / mock 也算数）→ 测例必红；贴出红。

## 交付

- 源码 + 测例（登记 `tests/index.md`，文件头中文四段）。
- Answer 里给：改动文件清单 · 新增用例数 · 反证轮次与红条数 · 两条入口同构的证明（指出各自对应行）· **未做**清单（尤其：真 judge live 跑数）。
- **不要**提交（commit 由主控做）。

---

## Answer

按裁定票 02 第二节执行完毕：**来源三态（`off` 默认 / `mock` / `http`）+ 报告 `judgeAurocSource` + 判定只认 `live` + PRD §4 规模门 ≥100**。工单 03 的人工抽检行为未动（`--human-spot` / `humanSpotOk` / 三个 `human_spot_*` reason code 逐位保留），只做了「新门与它共存」的必然调整（助手补喂来源与规模）。

### 一、改动文件清单

**源码（10）**

| # | 文件 | 改了什么 |
|---|------|----------|
| 1 | `packages/contracts/src/eval/l1-matrix.ts` | 新增并导出：`JUDGE_CALIB_MIN_CASES = 100`（PRD §4）、`JUDGE_CALIB_SCORER_MODES = ['off','mock','http']`、`JUDGE_AUROC_SOURCES = ['live','mock','none']`、`judgeAurocSourceFor()`（唯一一套三态映射）、`mockJudgeScorer()`（确定性伪打分器）。**规模常量单一来源在 contracts，api 引用，判定处无裸数字** |
| 2 | `apps/api/src/eval/l1-matrix.ts` | 追加 re-export 新符号（api 侧旧 import 形状不变） |
| 3 | `apps/api/src/eval/adr046-snapshot.ts` | 判定处加严（`:218-229`）：`judgeAurocOk = 值非 null ∧ ≥ judgeAurocMin ∧ 来源 === 'live' ∧ 有效对数 ≥ JUDGE_CALIB_MIN_CASES`；新增入参 `judgeAurocSource` / `judgeCalibPairs`（`BindSnapshotInput` 与 `evaluateAdr046Bind` 两处）；新增 `judge_auroc_source_not_live`、`judge_auroc_calib_too_small`（保留 `judge_auroc_missing_or_below_min`）；三条 red 用 else-if 互斥（第一处不过的门报出，与人工抽检「缺测只报 missing」同风格）；头注改写为「默认配置下 businessPass 仍不可达」 |
| 4 | `apps/api/src/eval/judge-scorer.ts`（新） | `createGatewayJudgeScorer(chat)`（注入式可测；复用 `graph/prompts` 的 `judgeSystemPrompt`/`judgeUserPrompt` + `graph/parse` 的 `parseJudgeScores`）、`judgeScorerGoNoGo()`（声明 http 而 Gateway 非 http → 拒）、`liveJudgeScorerFromEnv()`（进程 env 构造；不齐即抛 `GatewayConfigError`） |
| 5 | `apps/api/src/scripts/run-l1-golden.ts` | `scoreJudgeAuroc()` 返回 `(值, 有效对数, 来源)`：**:316** `const mode = opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER`；`off`→不跑（注入也不跑）；`mock`→内置伪打分器；`http`→注入的真打分器。报告加 `judgeAurocSource`（`:115`/`:581`）；md 加 `judgeAurocSource` 行（非 live 标「（不入判定）」）；判定传参 `:630`；`main()` `:665-674` 声明 http 时接真 Gateway 并 go/no-go，不齐 exit 2；stdout 摘要加来源 |
| 6 | `apps/api/src/env.ts` | 新增 `JUDGE_CALIB_SCORER: z.enum(['off','mock','http']).default('off')`。**未动任何既有 env 的默认值** |
| 7 | `apps/worker/src/eval/run-l1-batch.ts` | 同构落一侧：**:185** `const judgeScorerMode = opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER`；**:186** 同用 `judgeAurocSourceFor`；**:189** mock 用内置伪打分器；报告加 `judgeAurocSource`（`:95`/`:225`）。**未硬造 worker 判定点** |
| 8 | `apps/worker/src/eval/consumer.ts` | `:103` 把 `env.JUDGE_CALIB_SCORER` 传给批跑（与 api CLI 同名声明） |
| 9 | `apps/worker/src/eval/persist.ts` | `:135` `reportJson` 逐键白名单补 `judgeAurocSource`（否则 worker 侧静默丢键） |
| 10 | `apps/worker/src/env.ts` | 同名键同默认值（off）；注释写明 worker 无 Gateway 打分客户端 |

**配置（2）**：`.env.example`（`JUDGE_CALIB_SCORER=off` + 三态与禁令注释）、`turbo.json`（lint / test 的 env 列表登记该键，遵仓库既有「`L1_*` 须登记」纪律）。

**测试（9）**：新增 `apps/api/tests/eval/judge-auroc-source-gate.test.ts` · `apps/worker/tests/eval/run-l1-batch-judge-source.test.ts` · `packages/contracts/tests/eval/l1-judge-calib-source.test.ts`；改写 `apps/api/tests/eval/adr046-hard-gates.test.ts` · `human-spot-gate.test.ts` · `l1-cli.test.ts` · `l1-human-spot-cli.test.ts` · `apps/api/tests/env/defaults.test.ts` · `apps/worker/tests/eval/run-l1-batch.test.ts`；三个包的 `tests/index.md` 各登记新行。

**未触碰**：`docs/module-status/`、`.trellis/`、`prds/`、`fixtures/l1/judge-calibration.json`（仍 8 条）；无新 HTTP 端点、无新迁移/新表；未 `git commit` / `push`。

### 二、新增 / 改写用例数

- **新增用例 30 条**：`judge-auroc-source-gate.test.ts` **17** · `run-l1-batch-judge-source.test.ts` **4** · `l1-judge-calib-source.test.ts` **5** · `env/defaults.test.ts` **+3** · `l1-cli.test.ts` **+1**（「声明 off 时注入的打分器不跑」）。
- **改写既有用例 6 条（只补入参 / 补断言，无一条改期望值、无一条放宽）**：
  1. `adr046-hard-gates.test.ts` 的 `bind()` 助手补 `judgeAurocSource: 'live'` + `judgeCalibPairs: JUDGE_CALIB_MIN_CASES`（**新门的必然结果**：不补则 8 处 `businessPass === true` 全红）；8 处期望值一字未改。
  2. `human-spot-gate.test.ts` 的 `OTHER_GATES_PASS` 同上补齐（否则测不出抽检门本身）；条数/错数与三个 reason code 断言未改。
  3. `l1-cli.test.ts` 三处注入用例补 `judgeScorerMode: 'http'`（期望值 `judgeAuroc===1` 等保留，只多断言来源）+ 三处 `L1Report` 字面量补必填字段。
  4. `l1-human-spot-cli.test.ts` 的 `allGreenRun` 补「声明 http + 100 条校准集 + 假打分器」（该可达性用例原只喂 2 条校准）并加 2 条来源断言；`businessPass === true` 期望保留。
  5. `run-l1-batch.test.ts` 两处注入用例补声明 + 来源断言。
  6. `env/defaults.test.ts` 加默认值护栏（default/omitted → off；`mock`/`http` 只能显式 opt-in；`.env.example` 写死 `off`）。

### 三、反证（3 轮 · 共 7 条红 · 全部已还原）

| 轮 | 反证动作 | 红条（原始输出摘要） | 还原后 |
|---|---|---|---|
| A | 判定改回「不看来源」：`judgeAurocOk = judgeAurocValueOk && judgeCalibSizeOk` 并删掉 `judge_auroc_source_not_live` | `Tests 4 failed \| 13 passed (17)`；红：`来源 mock：数字再漂亮也不放行`、`来源 none 但值非 null`、`mock 伪打分器的产出代入判定`、入口级 `声明 mock（值 1 与对数 100 都不变）→ 业务 PASS 立刻变红`；四条均为 `AssertionError: expected true to be false` | api 全包 **1069 passed**，该文件 17 passed |
| B | 去掉规模门：`judgeAurocOk = judgeAurocValueOk && judgeAurocSource === 'live'` 并删掉 `judge_auroc_calib_too_small` | `Tests 1 failed \| 16 passed (17)`；红：`规模边界：99 不过（calib_too_small）；100 / 101 过` → `expected true to be false` | 同上复绿 |
| C | 删掉 worker `persist.ts` 的 `judgeAurocSource` 白名单键 | 2 个文件 `Tests 2 failed \| 6 passed`；红：`run-l1-batch-judge-source > 报告上的每个键都在白名单里…`（`expected undefined to be 'live'`）与工单 03 既有 `run-l1-batch-human-spot > 落库 JSON 保留 humanSpot，且报告上的每个键都在白名单里`（`expected [ 'judgeAurocSource' ] to deeply equal []`） | worker 全包 **229 passed** |

还原动作已核对 `git diff`（无残留反证改动）。

### 四、「旧为真集合 ⊇ 新为真集合」自证

1. **AUROC 门**：旧 = `值≠null ∧ 值 ≥ judgeAurocMin`；新 = 旧 **∧ 来源==='live' ∧ 有效对数 ≥ JUDGE_CALIB_MIN_CASES`。新为真 ⇒ 旧为真，反之不成立 → 情形集合**收窄**（只加严，无放宽）。
2. **其余门逐位未动**：`coverage` / `cRate` / `hitAtK` / `citationComplete` / `humanSpot` / 四要素 / `internal_guard` 的判断表达式与 `businessPass` 的 `&&` 结构均未改；`judge_auroc_missing_or_below_min` 的触发条件（值缺或低于门限）与旧口径完全一致。
3. **非宽松的副作用（如实报）**：判定之外，报告取值语义变了 —— `off`（默认）与 `mock` 下 `judgeAuroc` 为 `null` / 伪打分器值，只有声明 `http` 才可能是真值。这不扩任何门的真集合（该门本就要求非 null，新门又要求 live），但改了报告数字与既有注入用例的入参，故在上表逐条列出。
4. **无误伤证据**：反证 A 的 4 条红全部是 mock / none / 入口级用例，没有一条「本来合法的 live 跑次」变红；反证 B 只红规模边界一条。

### 五、两条入口同构的证明

| 同构面 | api CLI | worker batch |
|---|---|---|
| 声明入参同名同义 | `RunL1Options.judgeScorerMode`（`run-l1-golden.ts`） | `runL1Batch` opts `judgeScorerMode`（`run-l1-batch.ts`） |
| 默认来源 | **`:316`** `opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER` | **`:185`** `opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER`（同名 env 键） |
| 三态映射 | **`:317`** `judgeAurocSourceFor(mode)` | **`:186`** `judgeAurocSourceFor(mode)` —— **同一函数**（contracts 单一来源，两侧不各写一份） |
| mock 注入 | **`:320`** 内置 `mockJudgeScorer` | **`:189`** 内置 `mockJudgeScorer` |
| 报告字段 | `L1Report.judgeAurocSource`（`:115`，`judgeAuroc` / `judgeAurocScored` 旁） | `L1BatchReport.judgeAurocSource`（`:95`，同位置同形状） |
| 落库 | `reportJson: report` 整对象直落 | `persist.ts` 白名单 `:135` 已同步（同构测例钉住） |
| 判定 | `evaluateAdr046Bind`（唯一判定点） | **无判定点**（只落库；不硬造） |

### 六、`http` 真打分器第二段的查证结论 → **能做，已做**；缺的是「真跑数」

逐项核实（全在源码里指得到）：

| 环节 | 结论 | 证据 |
|---|---|---|
| 客户端能发 `purpose: judge` | **能** | `services/gateway/types.ts` 的 `ChatRequest.purpose: ChatPurpose`；`resolve.ts` 的 `ChatPurpose` 含 `'judge'`；`client.ts` 的 `getGateway()` / `getGatewayForTenant()` |
| 绑定解析 | **能（平台级）** | `applyBindingsToGatewayConfig` 把绑定写进 `purposeModels.judge`；`resolveChatModel(cfg, 'judge')` 可解析。注：KB PUT 拒 judge（`model-gateway-contract.test.ts`）→ judge 绑定只平台级 |
| prompt / 解析可复用 | **能** | `graph/prompts.judgeSystemPrompt/judgeUserPrompt` + `graph/parse.parseJudgeScores`（校准题 = 单 claim + 单 evidence 块） |
| go/no-go | 仓库**原本没有**，本票新增 | `judgeScorerGoNoGo()`：声明 `http` 而 Gateway `mode !== 'http'` → 拒绝；`main()` 里 exit 2，`liveJudgeScorerFromEnv()` 里抛 `GatewayConfigError`。**这是「禁止 mock 冒充 live」的落点** |
| 实现方式 | 注入式可测，**不打真网络** | `createGatewayJudgeScorer(chat)`：测例注入假 gateway 客户端（钉住「每条校准题一次 judge 调用 + 复用 ask prompt 口径」+「坏 JSON 抛错不静默降级成缺测」） |

**缺的一环（见未做清单）**：真 Gateway 的 live 跑数验收（本机无 Gateway / 密钥）+ ≥100 条真实标注校准集（夹具仍 8 条）。即：**路径已通、可注入可测；「真值」仍缺**。

### 七、门禁数字（收尾复跑）

| 命令 | 结果 |
|---|---|
| `pnpm check-types` | **8 tasks successful / 8**（0 失败，0 error TS） |
| `pnpm lint` | **8 tasks successful / 8，零 warning**（`eslint . --max-warnings 0` 全绿） |
| `pnpm --filter @strict-rag/api test` | **172 files passed · 1069 passed \| 3 skipped** |
| `pnpm --filter @strict-rag/worker test` | **51 files passed · 229 passed** |
| `pnpm --filter @strict-rag/contracts test` | **30 files passed · 245 passed** |

未跑全仓 `pnpm test`（按本票门禁清单执行）；三次测试命令串行，无并发。

### 八、未做（债）

1. **真 judge live 跑数 / 真 Gateway 打分验收**：本机无 Gateway 与密钥；`http` 分支只到「可构造 + go/no-go + 可注入测」。
2. **≥100 条真实标注校准集**：`fixtures/l1/judge-calibration.json` 仍 **8 条** → 今天真实入口（无论声明什么）都过不了规模门 —— 这是 PRD §4 的**如实拒绝**，不是缺陷。
3. **worker 侧无 Gateway 打分客户端**：worker 声明 `http` 只能得「来源 live + 无值」；真打分器只在 api 侧（worker 只落库）。
4. **按 KB / 租户的 judge 绑定解析未接**：本票用 env 级 `getGateway()`；`getGatewayForTenant()` 的 KB 覆盖与平台绑定快照未接进 CLI。
5. **报告 DTO 未透出 `judgeAurocSource`**：`EvalRunSchema` / `extraStatsFromReport` 未改（admin / 签字页今天读不到来源；属 §8 字段那票）。
6. **回写未做**：`docs/module-status/` · `.trellis/spec/api/backend/l1-eval.md` · 覆盖表 → 工单 06。
7. **mock 值的「逼真度」未做**（有意）：`mockJudgeScorer` 与 label 同源 → AUROC 恒 1，宁可数字刺眼也不做伪装。

### 九、与裁定不符处（如实报）

无与裁定冲突处；以下 5 处是裁定留白下的实现选择，请主控复核：

1. 三条 reason code 用 **else-if 互斥**（第一处不过的门报出），而非同时报多条 —— 依「三种红可分辨」且与工单 03「缺测只报 missing」同风格。
2. `off` 下**注入的 `scoreJudge` 不生效**（声明是来源的唯一决定者）—— 这是裁定「`off` → 不注入打分器」的必然后果，也是既有注入用例必须补声明的直接原因。
3. **worker 也读同名 env**：为让「两条入口同构」的声明面一致；worker 无打分客户端 → `http` 只声明不产值（已记债）。
4. `turbo.json` lint / test 的 env 列表登记 `JUDGE_CALIB_SCORER`（仓库既有 `L1_*` 登记纪律）。
5. 额外加了两处护栏：`env/defaults.test.ts` 的默认值断言 + `.env.example` 的 `JUDGE_CALIB_SCORER=off` 文本断言（防默认开关被改成 mock/http）。
