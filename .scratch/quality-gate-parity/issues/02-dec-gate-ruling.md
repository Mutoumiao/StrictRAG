# 裁定：PRD 硬门与代码判定的差额怎么落（哪落 / 哪记债 / 哪不动）

Type: grilling
Status: resolved
Blocked by: 01

## 问题

按 `01-research-gate-diff.md` 的事实面裁定四件事，每件都要能被下一次核查直接引用：

1. 哪些差额**进闸**（只加严），哪些进闸前**要先补数据源**，哪些**只记债**，哪些**不动**。
2. 进闸的量在**缺测**（`null`）时算放行还是不放行。
3. 哪些「代码比 PRD 松」其实是 **PRD 措辞只是建议**（改了反而偏离 PRD）。
4. 本次裁定是否触碰 `prds/00–11`。

## Answer

### 裁定 0（总）· 四档处理 + 缺测语义

判据是两问：**PRD 是不是写死**（硬门 / 建议）+ **今天有没有数据源**（字段 / 运行时 / 都没有）。

| 档 | 条件 | 动作 |
|---|---|---|
| **落** | PRD 写死 + 有字段 | 进 `evaluateAdr046Bind` 的 `&&` |
| **补源后落** | PRD 写死 + 无字段但**运行时有** | 先采集进报告，再进闸 |
| **记债** | PRD 写死 + 字段与运行时**都没有** | 记债 + 写清谁补；**不**做成恒 `false` 的空转闸 |
| **不动** | PRD 只是**建议** | 不改常量（改了反而偏离 PRD 措辞） |

**缺测语义**：进闸的量若为 `null` → 一律**不放行**（fail-closed），唯一例外是 PRD 自己写了条件语的门（`hitAt20`「有标注时」——无标注即该门不适用）。

**依据**：本仓纪律「缺项不得静默标绿」（OPS-2 剧本 N）+「门禁只加严不放宽」（ADR-046）。**不触碰 `prds/00–11`**：本裁定的全部动作都是「把 PRD 已写死的数字接进判定」，方向只加严。

### 裁定 1 · L1 四项进闸（落）

| 量（报告字段） | 判定 | 缺测 `null` |
|---|---|---|
| `coverage`（覆盖率 A/(A+B)） | `>= coverageMin`（0.40） | 不放行 |
| `cRate`（C/(C+D)） | `<= cRateMax`（0.05） | 不放行 |
| `hitAtK` | `>= hitAt20Min`（0.70） | **该门不适用**（PRD「有标注时」） |
| `judgeAuroc` | `>= judgeAurocMin`（0.65） | 不放行 |

两条必须写进回写的硬事实：

1. `coverage > 0` → `>= 0.40` 这两个口径**不翻任何既有断言**（01 第四节已逐条核）。
2. `judgeAuroc` 在**生产入口今天恒为 `null`**（CLI `main()` 不传 `scoreJudge`、worker consumer 同），故落地后 `businessPass` 在**生产路径上不可达**。这是**有意**的：把「未测」显形为红，而不是留一条「覆盖率 0.001 也能变真」的假绿。`judgeAuroc` **有**生产者路径（可注入校准打分器）、**缺的是接线**，故属「落 + 记接线债」，而不属裁定 0 的「记债不成闸」。

### 裁定 2 · 引用完整率：补数据源后落

- **口径**（PRD §2:81 + 愿景 §:93 + 术语表 `引用完整率` 行）：分子 = `answerKind='knowledge' ∧ outcome='answered' ∧ citations.length > 0`；分母 = `answerKind='knowledge' ∧ outcome='answered'`；**不含 chitchat**；分母 0 → `null` → 不适用。
- **数据源在图上**：`AskGraphResult` 带 `answerKind?` 与 `citations`，两个 L1 runner 都握有 `result.graph`，无需新依赖、无需真模型。
- **如实写明**：图在 `answered ∧ knowledge` 时**结构上必带合法 citation**（`graph/run.ts` 的合法 id 闸：`validIds` 为空则改拒答），故该率落地后只可能是 `1` 或 `null`。这条门的真实作用是**钉住该不变式**（谁把 `finalize` 改成「answered 可无引用」就会红），**不是**筛掉不合格跑次。**禁止**在镜像里把它写成「已有 99% 实测数据」。

### 裁定 3 · 人工抽检：记债，不成闸

全仓 0 命中（只有 `humanSpotMin` / `humanSpotErrorMax` 两个常量与它们在 `MAX_KEYS` 里的门对门比较）。**无人、无处登记**。记债：销账 = 先定登记面（表 / 报告字段 / 命令）再进闸。**禁止**把它做成恒 `false` 的闸——恒 false 的闸与恒 true 的假绿一样没有信息量。

### 裁定 4 · L2 近指代 ≥80%：落，但按**近似口径**并写明残余

- **判据面**：`type='near_coref'` 的 `verdict === 'pass'` 比例；**分母 = 全部 `near_coref` 行（含 `error`，error 不算 pass）**。理由：把 error 排除出分母会让「全批 error」退化成 `null → 不适用 → 放行`，那是 fail-open；本仓纪律是「无有效数据不外推」（`sweepTau` 同款）。
- **缺 near_coref 题**：分母 0 → 不放行（fail-closed）。实践中它与既有「九类必齐」重叠，不会单独发火。
- **残余（必须写进代码注释与镜像，不许省）**：① 不含「主题是否正确」（无 judge，且 L2 runner 今天**丢掉** `evidence_snapshot.docId`，连按 `expectedDocIds` 判命中都做不到）；② 不含「合法 citation」；③ 仓库夹具只有 **3** 条 `near_coref`，80% 只能取 0 / 33.3 / 66.7 / 100% → 该门今天等价于「3/3 全过」而非比例门。**同时记夹具债**（补到让 80% 有意义）。

### 裁定 5 · L2 规模 15 → 30：**不动**

PRD §6.2:169 的措辞是**建议**（「建议 30～50 条」），不是硬门；代码下限 15 不构成「比 PRD 松的硬门」。改它会翻 4 条既有测例并让代码**严于** PRD 建议（那属「代码自加严」，须 ADR）。记为口径差（PRD 建议 vs 代码下限）→ 留雾；若产品把 30 升为硬门，走 ADR。

### 裁定 6 · L2 其余三项零容忍 + 泄漏检查宽度：记债，不落

- 主题粘连胡答 / 冲突场景跟错数字 / 合法路径跳过 verify 今天**无判据**（只落在题面 `expected.accept` 白名单，粘连答也是 `answered` → 机械判 pass；rubric 零消费者）。落地须先补**采集**（`evidence_snapshot.docId`）再定**判据**。记两项债。
- 另记一条**既有实现比 PRD 窄**：`historyLeaked` 只比对先前**用户**轮原文，上轮 **assistant** 文本进 evidence **不会**被抓，而 PRD §6.2:186 写的是「历史文本进 evidence」。**本图不收紧**（收紧会翻 `run-l2-batch.test.ts` 的泄漏用例组，须单独一轮带反证）。记债。

### 裁定 7 · 双写常量：加一致性断言，**不合一**

`TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX`（`packages/contracts`）与 `PILOT_HARD_GATES`（`apps/api`）数值一致、依赖方向只有 api → contracts。合一须把常量下沉到 contracts，而 `PILOT_HARD_GATES` 承担 ADR-046 的「门禁包身份」（7 键 + `MAX_KEYS` 方向），下沉会动契约形状。裁定：**不合一**，在 `apps/api` 侧测试加一条**同时读两处**的断言，防未来单边漂移。

### 裁定 8 · `l1RerunBound` 的 `|| kbId && ranAt` 回退：**不动**

已被 `docs/testing/coverage/03-ops.md` 记为「部分测」缺口；改它会翻 `apps/api/tests/eval/adr046-snapshot.test.ts` 的「无 evalRunId 时用 `report:kb:ranAt` 绑定」用例，且 PRD §6.0:150 的 ②「重跑 L1 **适用**」缺机械判据（「绑定身份」≠「重跑适用」）。留债。

### 裁定 9 · 本图不做的（与「PRD 无机械判据」相邻但须先裁口径）

- §1「不可答 ≥ 可答 50%」下限无机械判据（`goldTypeCounts` 只服务 ≥30 规模门）→ 雾。
- §8 可复现字段（seed / models / fallbackChains / promptVersions / 题面哈希 / 校准集哈希）在 L1 报告里基本不存在 → 雾。
- §6.0:151「运行时质量参数仅来自已签字包，不一致拒绝加载」今天无运行时读点（`tauClaim` 仍取 env）→ 雾。
- `sessionEnabledDefault`（§6.2:171）字段名与出口未冻结，`PATCH` 恒 400 → 雾。

### 回写清单（交 05）

| 处 | 改什么 |
|---|---|
| `docs/module-status/api.md` | ADR-046 那段：写清「哪几条门今天真的进判定、缺测语义是什么、`businessPass` 在生产路径上不可达（有意）、`judgeAuroc` 缺的是接线」 |
| `docs/module-status/contracts.md` | L1/L2 纯函数那段：`computeSignoffEligible` 与 `computeL2SignoffEligible` 的门清单，点明「只加严」 |
| `docs/module-status/worker.md` | 若 L1/L2 报告字段变了（引用完整率 / near_coref 率） |
| `docs/testing/coverage/03-ops.md` · `00-ask.md` | 按脚本机械重数更新计数；T3 行（`l1RerunBound`）保持「部分测」并补本图结论 |
| `.trellis/spec/api/` 对应包 | 「硬门判定落点」条目：门限常量在哪 / 判定在哪 / `null` 语义 / 新增门限时的硬约束 |
