# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: resolved
Blocked by: 03, 04

## 做什么

1. **按 02 的「回写清单」逐处写回**：
   - `docs/module-status/api.md`：ADR-046 那段改写——哪几条门今天真的进判定、缺测语义、`businessPass` 在生产路径上不可达（**写明是有意**）、`judgeAuroc` 缺的是接线而非无生产者。
   - `docs/module-status/contracts.md`：两份 `compute*SignoffEligible` 的门清单 + 「只加严」。
   - `docs/module-status/worker.md`：若 L1 / L2 报告字段变了。
   - `docs/testing/coverage/03-ops.md` · `00-ask.md`：按脚本机械重数更新计数；T3 行保持「部分测」并补本图结论；引用完整率那条若从「缺实现」变成可断言，要改。
   - `.trellis/spec/api/` 对应包：新增「硬门判定落点」条目（门限常量在哪 / 判定在哪 / `null` 语义 / 新增门限时的硬约束 / 双写常量的处置）。
   - **`docs/module-status/*.md` 里禁止写 `路径:行号`**，不给裸枚举加反引号。
2. **登记测例**：把 03 / 04 新增的测例文件登记进对应包的 `tests/index.md`。
3. **对抗性反向复核**：每处回写逐条核「这话在源码里真能指到吗」。
4. **收口门禁（必须在最后一次提交之后跑）**：`pnpm check-types` · `pnpm lint` · `pnpm test`（全仓）全绿；`pnpm check:module-status` 的 `1-路径` / `6-联动` / `7-时效` 三类为空；`git status --short` 干净。
5. 在 `map.md` 写「目的地达成」段，未闭合项写进 Not yet specified。

## Answer

**结论一句话**：03 / 04 的落地已按裁定回写到三处镜像 · 覆盖表 · 两份 spec，测例全部登记，全仓门禁在**最后一次提交之后**复跑全绿。

### 回写了哪些处

| 处 | 改了什么 |
|---|---|
| `docs/module-status/api.md` | ① 加 2026-09-23 条（判定接实测硬门 · 缺测语义 · 生产入口 `judgeAuroc` 恒 null → `businessPass` 不可达且**有意** · 引用完整率钉不变式 · 人工抽检未做）。② L1 CLI 报告字段清单补 C 率与引用完整率。③ **边界**段由「禁止写 mock / coverage=0」扩成**完整判据式**（四要素 ∧ 不放宽 ∧ signoffEligible ∧ 五门 ∧ 非全 internal_guard；缺测不放行；唯二例外）。④ L2 runner 一行的公式补「近指代 ≥80%」并写明分母含 error、三条残余。⑤ 技术债表：L1 行补「七项硬门五项已进判定 / 生产路径不可达」；**新增一行「评测硬门的数据源债」**（人工抽检 · 校准规模 · L2 三项零容忍 · 泄漏检查宽度 · §8 可复现字段）。 |
| `docs/module-status/contracts.md` | 加 2026-09-23 条（新增 `citationCompleteRate` / `l2NearCorefPassRate` / `L2_NEAR_COREF_PASS_MIN`，两个纯函数放本包使口径不可能分叉；τ* 与试点常量是两份独立常量、只加断言不合并）；「黄金集 / run DTO」行补两个新函数与下限常量。 |
| `docs/module-status/worker.md` | 加 2026-09-23 条（L1 采 `answerKind` / 引用数、L2 落近指代率；`reportJson` 白名单同步）；评测消费者两行补新采集面；**改掉一句已失真的话**——原写「Hit@k / tau* / AUROC **不**进签字公式」，现改为「引用完整率与近指代率进工程公式；Hit@k / tau* / AUROC 只进 api 侧 ADR-046 放行判定」。 |
| `docs/testing/coverage/03-ops.md` | T4 证据换成「五项实测全达标 → 业务 PASS」+「缺测不得 PASS」反例；T1 补双写一致性断言；T3 / T6 的源码行号随改动同步（`:129 → :146`、`:175,218 → :174,268`）；计数叙事加**第四轮**：本分册**无行级覆盖值变化**（T 行仍 3 / 5 / 0 / 0 / 2 / 0）。 |
| `docs/testing/coverage.md` | 加**第六轮**叙事（同款「无值变化、只改证据」，并列出同轮新增的三条债）。 |
| `.trellis/spec/api/backend/l1-eval.md` | 新增 `## 硬门判定落点（实测值 → 业务 PASS）`：五门来源 / 判据 / 缺测语义表 · 门限一律读常量 · 两条诚实面 · 双写常量处置 · 禁止项 · 未做的债。 |
| `.trellis/spec/api/backend/l2-eval.md` | 新增 `### 近指代通过率（2026-09-23 起进工程公式）`：口径 · 为什么 error 进分母 · 缺测不放行 · 残余 · 未动项 · 禁止项。 |
| `apps/api/tests/index.md` · `apps/worker/tests/index.md` · `packages/contracts/tests/index.md` | 登记 7 个新测例文件（api 4 · worker 2 · contracts 1），存货闸由红转绿。 |

**写回纪律遵守**：`docs/module-status/*.md` 正文**未写**任何 `路径:行号`；未给裸枚举加反引号（`5-表` 告警数与改前一致）。行号只出现在 `.scratch/` 与本分册 / spec。

### 对抗性反向复核（逐条核「这话在源码里真能指到吗」）

| 回写里的话 | 核到哪 |
|---|---|
| 「判定处只读试点常量、无裸数字」 | `adr046-snapshot.ts` 的 `gates = PILOT_HARD_GATES` 与五处 `gates.*` 比较 |
| 「缺测 null 一律不放行，唯二例外」 | `hitAtKOk` 与 `citationCompleteOk` 是仅有的两个带 `== null ||` 的判据 |
| 「`judgeAuroc` 生产入口恒 null」 | `run-l1-golden.ts` 的 `main()` 不传 `scoreJudge`；worker `consumer.ts` 同 |
| 「引用完整率只能是 1 或 null」 | `graph/run.ts` 的 `validIds` 为空即改拒答；回答只走 `verified` 或 `chitchat` |
| 「近指代率分母含 error」 | `l2NearCorefPassRate` 的 `if (r.type !== 'near_coref') continue; den += 1;` 在 verdict 判断之前 |
| 「夹具只有 3 条 `near_coref`」 | `fixtures/l2/gold.yaml` 实读；worker / api 两组既有 runner 测例实测率均为 1 |
| 「`L2_SIGNOFF_MIN_CASES` 仍 15」 | 常量未动；裁定 5 写明理由（PRD 是「建议」） |
| 「人工抽检全仓无入口」 | `humanSpotMin` / `humanSpotErrorMax` 只命中常量与 `MAX_KEYS` |

### 收口门禁（最后一次提交之后复跑）

（见 map.md「目的地达成」段的实跑数字）

### 未闭合项

全部转入 `map.md` 的 Not yet specified：人工抽检登记面 · 校准规模 ≥100 与打分器接线 · L2 其余三项零容忍与 `historyLeaked` 宽度 · `l1RerunBound` 回退 · L2 规模口径差 · §1 不可答下限 · §8 可复现字段 · 运行时加载口 · `sessionEnabledDefault` 字段名。
