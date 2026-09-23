# 落 L2 零容忍四项的处置

Type: task
Status: resolved
Blocked by: 02

## Question

按裁定票 02，把 PRD §6.2 的**四项零容忍**（主题粘连胡答 · 历史文本进 evidence/`min_support` · 冲突场景跟错数字 · 合法路径跳过 verify）从「只有一项、且比 PRD 窄」补到**每一项都有可核对的处置**。

范围（以裁定票为准，此处为默认预期）：

1. **历史文本进 evidence**：按裁定决定是否把 `priorUserTexts` 扩到「历史用户文本 + 历史 assistant 文本」；若裁定为「结构上不可能、保持现状」，则把该不变式写成**测例钉住**（不是加注释），并在 spec 里写明依据。
2. **`min_support`**：按裁定决定比 / 不比；不比则如实记债（写清 PRD 那句话今天无法机械化，及缺什么）。
3. **主题粘连胡答 / 冲突跟错数字 / 合法路径跳过 verify**：逐项按裁定落到「机械进判定 / 机械记报告 / 如实记债」三档之一。落进判定的必须是**加严**；记债的必须在 `docs/module-status/<包>.md` 与 `.trellis/spec/` 里写明「PRD 写了、代码判不了、缺什么」。
4. `computeL2SignoffEligible` 若加严，需给出**新公式**与「旧为真集合 ⊇ 新为真集合」的论证（写进 Answer）；若未加严，需说明为什么补了判据却不进判定。
5. 测例：新增落 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」简体中文，登记该包 `tests/index.md`；含反证（把新判据拆掉 / 反向改一个值 → 红）。
6. 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ 相关三包测试（**串行**跑）。

**不许**：改 PRD；给零容忍项加宽松豁免；用「近似 / 形似」判据冒充机械判据；改 `fixtures/l2/gold.yaml`（除裁定票明确要求）。

## Answer

按裁定 02 的「二、零容忍四项」与「五、给落地票的三句硬话」逐条落地。**没有新增判据进闸、没有改夹具、没有动默认开关**；本票的产出是「**把四项的处置档位写成机器可读的事实声明 + 把图上不变式钉成测例 + 把四条债逐条写明**」。

### 一、报告新增 `zeroToleranceCoverage` 区块（裁定 6）

形状（contracts `packages/contracts/src/eval/l2-matrix.ts`，纯函数 `l2ZeroToleranceCoverage(zeroToleranceHits)`，两侧同源调用、**禁单边另写**）：

- **4 项**（`L2_ZERO_TOLERANCE_ITEM_KEYS`，按 PRD 原句顺序）× **5 处去**（`L2_ZERO_TOLERANCE_PLACE_KEYS`）—— PRD 把「历史文本进 evidence/`min_support`」写在**同一项**里点了两个去处，故区块里 `historyText` 一项摊成**两处**，**不许**含糊成一行。
- 每处 = `{ key, judged: 'mechanical' | 'debt', hits: number | null, note }`；`mechanical` 必带命中数，`debt` 必为 `null`（不许拿 `0` 冒充「已判且满足」）。非法命中数（NaN / 负 / 非有限）**抛错**，不静默当 0。
- 整项 `judged` = **全部去处** `mechanical` 才 `mechanical`；任一处 `debt` → 整项 `debt`。

**今天逐条取值**（由测例逐字钉死）：

| item | judged | place | judged | hits |
|---|---|---|---|---|
| `topicStickiness` | `debt` | `topicStickiness` | `debt` | `null` |
| `historyText` | `debt` | `historyInEvidence` | **`mechanical`** | **= `zeroToleranceHits`（同源，`hits: zeroToleranceHits` 直传）** |
| `historyText` | `debt` | `historyInMinSupport` | `debt` | `null` |
| `kbConflictNumber` | `debt` | `kbConflictNumber` | `debt` | `null` |
| `skipVerify` | `debt` | `skipVerify` | `debt` | `null` |

**与裁定 6 的对照（有意做的一处更严）**：裁定 6 写「`historyInEvidence = mechanical`」——落在**那一处去的** `judged` 上；**整项**（`historyText`）我按 `debt` 记，因为 PRD 同一项里的 `min_support` 那半句今天不可判，整项写 `mechanical` 会把那一半债藏起来（正是「不许含糊成一行了事」）。这与任务措辞「其余四项/去处一律 `debt`」（5 处去 = 1 mechanical + 4 debt）一致，也是**不会过报**的方向。区块里 `mechanical` 处的 note 明确写它判的是「**语料撞词**」这一种。

### 二、两侧同构 + 白名单

- 键名 `zeroToleranceCoverage` 进 contracts `L2_EVIDENCE_REPORT_KEYS`（两侧手抄形状的同一锚点）—— 这是本票唯一改到的既有名单，连带改了 `packages/contracts/tests/eval/l2-evidence-fields.test.ts` 里那条逐字键集断言（5 键 → 6 键）。
- api `L2Report` 与 worker `L2BatchReport` 都加**必填**键；worker `persist.ts` 的 `saveL2Report` 逐键白名单**同步加键**（否则静默丢弃、零测试红）。
- api 侧 `formatL2ReportMd` 逐条渲染（item / place / judged / hits / note），报告读者不必再靠文档纪律去猜哪几处真判了。
- 因 `L2Report` 加必填键，报告字面量唯一爆点 `apps/api/tests/eval/l2-cli.test.ts` 的 `sampleReport()` 补了一键（＋顺手断言 `reportJson` 整对象直落带上该键）；worker 侧零处。

### 三、裁定 4：图上不变式钉成测例（**行为型已可行，未退而求其次**）

新增 `apps/api/tests/ask/evidence-from-retrieve-only.test.ts`（4 个 `it`）：

1. **行为型（主）**：注入 retrieve 与 chat stub，会话窗放独特串 `WINDOW_SECRET_9f2c` → 先断言该串**确实进了 rewrite 提示词**（防测例空转），再断言 `evidence_snapshot` **逐字段等于 retrieve 输出**、窗文本不出现在任何 `evidence_snapshot[].text` / citations 里。
2. **拒答路径**：retrieve 返 0 证据 → `evidence_snapshot === []`，绝不回填窗文本。
3. **未走 retrieve 的轮（chitchat）**：同样带 session 窗，`evidence_snapshot === []` —— 这条专门守 `finalize` 的 `s.evidence_snapshot ?? s.evidence` 兜底分支（实测：把窗文本塞进 `state.evidence` 时**只有这条**会红）。
4. **源码形状守卫**：`graph/run.ts` 里 `evidence_snapshot:` 只两处（retrieve 分支的写 + `finalize` 的回读），写点来源 = `r.evidence`。行为型拦不住「写点搬走但内容恰好相同」，故补这半。

**先例说明**：本仓既有 `apps/api/tests/ask/history-not-evidence.test.ts` 覆盖了「历史/加深窗文本不进 snapshot」的**一半**；本票新增的是「**逐字段等于 retrieve 输出**」与「源码写点唯一」这两条更硬的钉法，与它不重复（它不钉 uniquely-sourced，也不守写点数量）。

**没有动 `historyLeaked`**：按裁定 4 明确**否掉**「扩到上轮 assistant 观测文本」（assistant 合法答案本就逐字引库 → 会假红）。我核了 `packages/contracts/src/eval/l2-matrix.ts` 的 `historyLeaked` 与两处调用点：**现有代码里没有**任何与 assistant 文本的比对，无需「先报告后改」。`min_support` 那半句按裁定 4 记债（见下）。

### 四、为什么补了判据却不进 `computeL2SignoffEligible`（工单第 4 问）

本票**没有加严**，公式与取值域**一字未动**，`zeroToleranceHits` 仍是它唯一的零容忍合取项。理由：

1. 本票补的是**事实声明**（区块）而不是新判据 —— 四项里唯一真判据（`historyLeaked`）今天**已经在** `zeroToleranceHits` 里，区块只是把它「是哪一处的判据、判的是哪一层」写清楚；再加合取项等于把同一件事数两遍。
2. 另外四项/去处**判不了**，记债项**不得**当门：把「记债」接进闸就是恒 false 空转闸（前图明令禁止的形状），把「记债」写成豁免则是放宽。
3. 新区块**不进任何判定**由测例反向钉住：真 gold + live stub 全绿时 `signoffEligible === true`，而区块里仍有 4 处 `debt` —— 「如实记债」既不放行也不拉红。

### 五、四条债（已写进 `.trellis/spec/api/backend/l2-eval.md`，逐条「PRD 写了什么 / 代码为什么判不了 / 缺什么才能销账」＋「禁止造形似代理」）

| 去处 | 缺什么才能销账（摘要） |
|---|---|
| `topicStickiness` | 图上先有**实测主题标识**（`expected.themePersist` 只有期望值、无实测值可比）。禁止用「答里出现别文档关键词」顶替 |
| `historyInEvidence` | 不是判不了、是**路径不存在**（evidence 唯一写点 = retrieve）；今天 `historyLeaked` 抓的是「语料撞词」，比 PRD 窄。禁止纳入 assistant 观测文本（假红） |
| `historyInMinSupport` | `AskGraphResult` **不含 claims**，`min_support` 只是数值 → 销账要先透出 claims 或 claim 来源标记。禁止拿「`minSupport` 为 0 即泄漏」充数 |
| `kbConflictNumber` | 数字只在 `rubric` 自由文本里（800/200 vs 库内 600/120），夹具无结构化字段 → 先裁比对规则再给夹具加字段（「先裁再动」）。禁止先写近似匹配当判据 |
| `skipVerify` | `debug` 无 purpose 维度 → 销账要给 `debug` 加 purpose/verify 标记（属改 `AskGraphResult`，本票禁止）。禁止用 `llmCalls` 计数反推调用序列当判据 |

### 六、反证（都是「改坏即红」，改完已还原；`git status` 里没有任何 run.ts 改动）

| 反证 | 改法 | 结果 |
|---|---|---|
| **A · 伪造 mechanical** | 把 `topicStickiness` 处的 `judged` 从 `debt` 改成 `mechanical` | contracts 测例 **4 红 / 9**；worker 测例 **2 红 / 3** ✅ |
| **B · 命中数不同源** | 把区块里 `hits: zeroToleranceHits` 改成 `zeroToleranceHits + 1` | api 测例 **3 红 / 3**；worker **2 红 / 3** ✅ |
| **C · 开第二个写点** | 在 `run.ts` retrieve 分支后追加 `state = { ...state, evidence_snapshot: [...evidence, {…'sneak'}] }` | api 不变式测例 **3 红 / 3**（逐字段 `toEqual` + 拒答路径 + 源码写点计数 3）✅ |
| **D · 会话窗文本塞进 evidence** | 在 `run.ts` 的 `loadAndMaybeRewrite` 里把 `window` 文本写进 `state.evidence` | chitchat 路径那条 **红**（1 红 / 4）—— 另 3 条绿，因为 single 路由下 retrieve 会覆盖 `state.evidence`；这正是要靠「chitchat 路径 + 源码守卫」补的原因 ✅ |

### 七、门禁（自己跑、串行）

- `pnpm check-types`：**8 successful / 8**（全绿）
- `pnpm lint`：**8 successful / 8**，零 warning
- `pnpm --filter @strict-rag/contracts test`：**33 files / 273 tests passed**
- `pnpm --filter @strict-rag/worker test`：**54 files / 244 tests passed**
- `pnpm --filter @strict-rag/api test`：**176 files / 1091 passed | 3 skipped**
- 未跑全仓 `pnpm test`（门禁只要求三包串行；全仓留给工单 06 收口）
- 顺手实测 `pnpm check:module-status`（exit 0）：**42 条 = 基线 39（2 env + 13 符号 + 24 表）+ 3 条 `6-联动`**（`apps/api/*` / `apps/worker/*` / `packages/contracts/*` 已改但同名 module-status 未改）。这 3 条正是**工单 06 的回写职责**，本次不动；`1-路径` / `7-时效` 为空。

### 八、未做 / 做不了的（如实）

1. **四项里只落实了 1 处机械判**（= `historyLeaked`，即 `historyInEvidence`）—— 这是 PRD 现状能钉住的全部；另 4 处是债，**没有**造代理。
2. **`historyLeaked` 的比对宽度未收紧**（只比先前用户轮 + 子串 + 不做归一化/数字级）。PRD 那句的另一半（`min_support`）**不可判**；assistant 文本按裁定**不做**比对。
3. **`computeL2SignoffEligible` 一字未动**（不加严、不放宽）；`docHit*` / `citationComplete*` / `citationOk` 语义与上一票一致，未改。
4. **未动**：`AskGraphResult` / `ExecuteAskResult` / `fixtures/l2/gold.yaml` / `prds/00–11` / 任何默认开关；无迁移、无新表、无新 HTTP 端点。
5. **未做** `docs/module-status/` 与 `docs/testing/coverage*` 回写（工单 06 的职责）；`.trellis/spec/worker` 侧的同构表述也只写在 api spec 里（两侧共一条口径），worker 包 spec 若需单列由 06 一并处理。
6. 区块**不透** `…/eval/runs` 的 DTO（`EvalRunSchema` 是 `.strict()`，同前图 L1 侧裁决）→ 仍记债。

### 九、给工单 06 的回写提示

1. **能力矩阵 / 包文**建议逐字落：`zeroToleranceCoverage` 已具备（区块 + 两侧同构 + 白名单 + md 渲染）；**零容忍四项 = 1 处机械判（`historyInEvidence`，判「语料撞词」）＋ 4 处记债**（这条要**数得清**：5 处去 = 1 mechanical + 4 debt）；`computeL2SignoffEligible` 公式未动。
2. **新债清单**（可直接抄 spec 那张表）：主题粘连 / `min_support` / 冲突数字 / 跳过 verify 各自的「缺什么才能销账」；另加「`historyLeaked` 比 PRD 窄（只判语料撞词）」与「区块不透 DTO」。
3. **新增测例**（登记三包 `tests/index.md` 已做，回写覆盖表时对号）：contracts `eval/l2-zero-tolerance-coverage.test.ts`（9）· api `eval/l2-zero-tolerance-coverage.test.ts`（3）· api `ask/evidence-from-retrieve-only.test.ts`（4）· worker `eval/l2-zero-tolerance-coverage.test.ts`（3）。
4. **踩坑提醒**：`L2_EVIDENCE_REPORT_KEYS` 是两侧同构的**唯一锚点**，后续任何一侧加 L2 报告键都要同步名单 + worker `saveL2Report` 白名单 + 三条同构测例；`fixtures/l2/gold.yaml` 仍**一字未动**（18 条 / 25 个逻辑 id）。
