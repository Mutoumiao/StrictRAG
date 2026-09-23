# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: resolved
Blocked by: 03, 04, 05

## Question

工单 03 / 04 / 05 落地后，把现状写回镜像与规范，并跑收口门禁。

1. **回写 `docs/module-status/`**（api · worker · contracts · README 的能力矩阵，按实际改到哪些包）：如实写「已具备 / 未做 / 债」，每条能指到证据路径；**不写 `路径:行号`**；不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）。
2. **回写 `docs/testing/coverage*.md`**：新增能力落进覆盖表，标明「全 / 部分 / 缺」与理由。
3. **回写 `.trellis/spec/`**：把新增的判据、同构要求、缺测不放行语义写进对应包 spec（api / worker / contracts 侧各按实际）。
4. **对抗性反向复核**：逐条核「这话在源码里真能指到吗」；把口径写成可核对的形式（例如「四项零容忍里 N 项进判定、M 项记债」必须数得清）。
5. **收口门禁（必须在最后一次提交之后复跑）**：
   - `pnpm check-types` 全绿 · `pnpm lint` 零 warning；
   - `pnpm test` 全仓（**不得与他人并发**），记录各包文件数 / 通过数；
   - `pnpm check:module-status` → 须回到基线 **39 条 = 2 env + 13 符号 + 24 表**，且 `1-路径` / `6-联动` / `7-时效` **全空**；
   - `git status --short` 干净。
6. **收口补记**：把本图 `Not yet specified` 里已被消掉 / 新长出来的雾更新掉；若发现本图有「裁定但未落地」「实现缺口但超出本图」的项，明确写清挂在哪个工单 / 转给下一张图，**不许**含糊带过。

---

## Answer

回写完成，门禁全绿。**只改文档**：`docs/module-status/` 四份 · `docs/testing/` 两份 · `fixtures/l2/` 两份 · 本工单。**未改任何源码 / 测例 / 夹具 yaml / `prds/00–11` / `.trellis/spec/`（前三票已各自回写，本轮不重复动）/ `map.md`**；**未** `git add` / `commit` / `push`。

### 1. 回写表（文件 → 改了什么）

| 文件 | 改了什么 |
|------|----------|
| `docs/module-status/contracts.md` | ①「最近更新」前置新 `2026-09-23` 条（L2 报告键名单 + 采集面判据 + 零容忍处置档位 + §8 `L2Repro` + 子路径 `./eval-repro-l2` + 「公式一字未动」）；②「已具备」加一条 **L2 报告判据面**；③「技术债」把子路径行扩到 `./eval-repro-l2`（附「子路径必要性未做破坏性实证」+ 三份手抄形状「加键三处齐改」新行）；④「证据」加 **L2 报告判据面** 一行 |
| `docs/module-status/api.md` | ①「最近更新」前置新 `2026-09-23` 条（采集面 5 键 / 零容忍 5 处去处 / §8 三键 / 图上不变式测例，逐条写口径与「未做」）；②L2 评测节：改写 runner bullet 的「残余」（**写全口径**）、新增 **报告可判定面** 与 **`zeroToleranceCoverage` 逐条取值** 两条 bullet；③「语料草案」bullet 补**逻辑 id → `documents.id` 映射缺**；④「边界」bullet 补「三者都不进判定」；⑤「明确未做」表 `L2 准出 / 多轮 runner` 行改写；⑥「评测硬门的数据源债」行的 L2 两句改写成 **1 处机械判 + 4 处记债** 口径 + 其余缺口；⑦「技术债」`L2 准出 / runner` 行补现状；⑧「证据」加 **L2 报告可判定面** 一行 |
| `docs/module-status/worker.md` | ①「默认依赖模式」不动（无新 env）；②「最近更新」前置新 `2026-09-23` 条（行键 6 + 报告键 7 + `saveL2Report` 白名单 7 键 + 三键不进判定）；③「评测消费者」：sr-eval bullet 补 L2 报告面、新增 **L2 报告面（与 api CLI 同构）** 一条 bullet；④「明确未做 / 边界」加 **L2 报告面（worker 侧）** 一行；⑤「技术债」加 **`saveL2Report` 逐键白名单** 一行；⑥「证据」加 **L2 报告面** 一行 |
| `docs/module-status/README.md` | 能力矩阵「观测 / 评测」行**增量**改：「L2 归档底线」补「公式与取值域未动」，新增「**L2 报告可判定面已落**」并写全两个数（**四项零容忍 → 五处去处 = 1 处机械判 + 4 处记债**、四项整项全记债）与「未映射时 `docHitRate` 恒 0，不得当成绩、且不进判定」 |
| `docs/testing/coverage/03-ops.md` | ① 剧本 C 导语补一段说明**派生行 `L2`** 的来历（PRD 剧本 J 的 P2.5 通过条件「L2 报告归档」+ 角色范围「P2.5：J-P2.5 + **L2**」）且**不是**「L2 已通过」；② 剧本 C 表**新增 1 行 `L2`**（覆盖值 `部分测`，证据 = 10 文件 / 65 条 it + 夹具现状，缺口 = 七条）；③ 计数段补「**第六轮**」叙述；④ 计数表 C 行 5→**6**、合计 93→**94**、部分测 18→**19**，并补「行数须与上表合计一致」的逐项算式；⑤ ID 闭集 93→**94**（含 `L2`） |
| `docs/testing/coverage.md` | ① 汇总表 ops 行 93→**94** / 18→**19**、合计 279→**280** / 65→**66**；② 新增「**第八轮（2026-09-23，wayfinder 图 `l2-report-determinability`）**」叙述（明写**唯一行级变化 = ops 新增派生行 `L2`**、其余四册一个字未改、PRD 门限未动）；③「当前保持 `部分测` 的行」末尾补 **`L2`** |
| `fixtures/l2/README.md` | ① 新增「**报告字段（2026-09-23 起新增的可判定面）**」表（7 个报告字段 + 5 个行级字段 + 「四者都不进判定」）；②「逻辑 id 映射」补**今天无映射入口**（`documents` 无 `external_id`、`corpus/*` 从未入库 → 恒 0 是「没得量」）；③「零容忍」整节改写为**逐处处置档位**（1 mechanical + 4 debt、四项整项全 debt）；④「本窗不做」补两条（不许把新字段当成绩 / 判定项；不许为凑非 0 改 id 体系） |
| `fixtures/l2/sample-report.md` | ① 字段表补 `nearCorefPassRate` / `docHitRate`（旁写「**未映射时恒 0，不得当成绩**」）/ `docHitHits` / `docHitScored` / `citationComplete` / `citationCompleteDen`；② 末轮机械判定表补 `docHit` / `citationOk`；③ 新增「**零容忍处置档位（`zeroToleranceCoverage`）**」与「**可复现（PRD §8）**」两节；④「复现」补一条新测例命令。**数字处一律保持 `n/a（模板）`，未编任何数字** |
| `.scratch/l2-report-determinability/issues/06-task-writeback.md` | `Status: open` → `resolved` + 追加本 `## Answer`（原正文未删改） |

**关于工作单第 3 条（回写 `.trellis/spec/`）**：本轮**未动**——`spec/api/backend/l2-eval.md`（采集面 / 零容忍处置档位 / `repro` 三节 + 签名表 + 测例表 + 四条债表）与 `spec/worker/backend/index.md` 已由工单 03 / 04 / 05 各自写全，本轮**只核未改**（逐节读过，与源码一致）。派单口径亦明确「禁止改 `.trellis/spec/`（前三票已各自回写）」。

### 2. 回写依据（每条指到文件 / 测试）

| 写入的话 | 核对点 |
|---|---|
| `L2_EVIDENCE_REPORT_KEYS` = **7** 键、`L2_EVIDENCE_ROW_KEYS` = **6** 键 | `packages/contracts/src/eval/l2-matrix.ts`（两处 `export const`，逐键读过） |
| 零容忍 = `L2_ZERO_TOLERANCE_ITEM_KEYS` **4** 项 × `L2_ZERO_TOLERANCE_PLACE_KEYS` **5** 处去处；`historyText` 整项 `debt`、`historyInEvidence` 为唯一 `mechanical` 且 `hits` 与 `zeroToleranceHits` **同源** | 同文件 `l2ZeroToleranceCoverage`（`hits: zeroToleranceHits` 直传 + 「整项 = 全部去处 mechanical 才 mechanical」的 `every` 归并 + 非法命中数 `throw`） |
| `l2CitationOk` 只有 `knowledge` 判词、其余 → 空值；`l2CitationComplete` 复用 L1 `citationCompleteRate` | 同文件 `l2CitationOk` / `l2CitationComplete`（后者 `import { citationCompleteRate }`） |
| `l2GoldSetHash` 取真值、逐字复用 `l1QuestionIdsHash`；两个版本键类型钉成 `null` 字面量 | `packages/contracts/src/eval/l2-repro.ts`（`return l1QuestionIdsHash(ids)` · `sessionStrategyVersion: null` / `rewritePromptVersion: null`） |
| 子路径导出 `./eval-repro-l2` | `packages/contracts/package.json` `exports`（`"./eval-repro-l2": "./src/eval/l2-repro.ts"`） |
| api：行级 5 键 + 报告 7 键；`docId` 来自 `graph.evidence_snapshot[].docId`；`citationCount = Array.isArray(graph.citations) ? length : 0`；`docHit` 用 `hitAtKCase`；error 题按未命中计；**不采集 `minSupport`** | `apps/api/src/scripts/run-l2-golden.ts`（`L2CaseRow` / `L2Report` 类型块 · 采集与累加 · `formatL2ReportMd` 的 `docHitRate` / `citationComplete` / `zeroToleranceCoverage` / `reproMdLines`） |
| worker：`L2TurnExecuteResult` 读三键、**不读 `minSupport`**；`L2BatchCaseRow` 6 行键 / `L2BatchReport` 7 报告键 | `apps/worker/src/eval/execute-ask-http.ts`（`createEvalHttpL2Execute`，注释明写「不读 minSupport」）· `apps/worker/src/eval/run-l2-batch.ts`（类型块与 `l2ZeroToleranceCoverage(...)` / `l2GoldSetHash(...)` 调用点） |
| worker `saveL2Report` 白名单加**报告键那 7 个**（含 `zeroToleranceCoverage` / `repro`） | `apps/worker/src/eval/persist.ts` `saveL2Report`（逐键读过：`zeroToleranceCoverage` · `docHitRate` · `docHitHits` · `docHitScored` · `citationComplete` · `citationCompleteDen` · `repro`） |
| `computeL2SignoffEligible` 公式与取值域**一字未动** | `l2-matrix.ts`（判据仍是 live ∧ 题量 ∧ `zeroToleranceHits !== 0` ∧ 近指代率 ∧ 九类齐；采集面 / 区块 / `repro` 均不在入参） |
| 新增 10 文件 / **65** 条 it（contracts **29** · api **20** · worker **16**） | 逐文件机械数 `it(`：10 / 9 / 10 · 8 / 3 / 5 / 4 · 8 / 3 / 5 → 合计 65（**与三票 Answer 的清单逐条一致**） |
| 夹具 **18** 条 · **全部**带 `expectedDocIds` · 合计 **25 处引用 / 去重 6 个逻辑 id** · `near_coref` **仅 3 条** · 9 类齐 | `fixtures/l2/gold.yaml` 机械统计（`cases.length=18`；`near_coref=3`；`expectedDocIds` 出现 25 次、去重 `ingest-samples/01..03-doc` + `l2-corpus/{travel-stay,meal-allowance,leave-policy}`） |
| 「`L2 报告归档` 是 PRD 剧本 J 的 P2.5 通过条件」「测试角色范围写 P2.5：J-P2.5 + L2」 | `prds/10-delivery/03-acceptance-scenarios.md` 剧本 J-P2.5 段与「发布签字 · 角色范围」表 |
| `evidence-from-retrieve-only.test.ts` 钉的图上不变式 | `apps/api/tests/ask/evidence-from-retrieve-only.test.ts`（行为型 + `run.ts` 写点计数半） |

### 3. 对抗性反向复核（逐条核「这话在源码 / 测试里真能指到吗」）

1. **三份工单 Answer 的每条「已具备」都能指到文件**：第 2 节表逐条核对通过（contracts 纯函数 / 两个 app 的报告与内口 / `persist.ts` 白名单 / 子路径导出 / 夹具数字），无一条只靠 task 叙事。
2. **每个数目都能数清且已实测**：65 条 it（逐文件机械数）· 7 / 6 / 4 / 5 键（源码逐键数）· 18 / 3 / 25 / 6（夹具机械统计）· 5 处去处 = 1 mechanical + 4 debt（区块源码 + 三包测例逐条断言）。**未使用任何不可复核的数目**。
3. **没有任何一句把「记债」写成「已具备」**：全文口径处一律成对出现（「1 处机械判 + 4 处记债」「四项**整项**层面全部记为债」「记债 ≠ 放行」「`mechanical` 才带 `hits`」）；`zeroToleranceCoverage` / `repro` / `docHit*` 三处均显式写「**不进** `computeL2SignoffEligible`」。
4. **没有写成「L2 准出已具备 / L2 通过 / 可默认开 session」**：镜像里 `signoffEligible` 一律称「工程公式」；覆盖表新行覆盖值是 **`部分测`** 并写「工程绿 ≠ L2 准出」；`SESSION_REWRITE_ENABLED` 默认值一个字未动（本轮未碰任何 env）。
5. **`docHitRate` 未映射恒 0 的口径** 在 4 份文档各写一次（api / worker / README / `fixtures/l2/README.md` + `sample-report.md`），且都点明根因（逻辑 id vs KB uuid、`documents` 无 `external_id`、`corpus/*` 从未入库）与处置（**不许**为凑非 0 改 id 体系 / 做模糊匹配）。
6. **`repro` 三键各自去向** 写清：`l2GoldSetHash` 真值（本跑实际题面集，口径同 L1）· 两个版本键**无载体**恒空值（禁拿源码文本哈希顶替）。
7. **口径写全**（本图最重要的纪律）在四份镜像 + 覆盖表新行均逐字写出「**四项 → 五处去处 = 1 处机械判 + 4 处记债**」与「`historyText` 半判半债、**四项整项全记债**」——**不靠读的人自己推断**。`historyInEvidence` 的 note 也照实写「判的是**语料撞词**这一种」。
8. **镜像里「已被本图改假」的旧句已一并纠正**（点名）：api.md 原「其余三项零容忍…仍无机械判据」「L2 泄漏检查偏窄」（现改写为 5 处去处口径 + 泄漏判据宽度如实）；README 矩阵「L2 归档底线」补「公式未动」与报告可判定面；worker.md 原「近指代率不含合法 citation」在 2026-09-23 条已由三票补记，本轮只把 L2 侧新面补齐。

### 4. 门禁（本轮改动之后复跑；本轮只改文档）

| 门 | 结果 |
|----|------|
| `pnpm check:module-status` | **39 条 = 2 env + 13 符号 + 24 表**（与基线同数同分类）；**`1-路径` / `6-联动` / `7-时效` 全空**（三票已提交，源码不再领先文档） |
| `pnpm check-types` | **8 successful / 8 total**（全绿） |
| `pnpm lint` | **8 successful / 8 total**（零 warning，`--max-warnings 0`） |
| `git status --short` | 仅 **9 个文档 / 夹具文档** 改动（本表第 1 节 9 个文件），**无源码 / 测例 / yaml / prds / spec 改动** |

**未跑（按本轮派单口径移交主控收口）**：全仓 `pnpm test`（派单明确「文档改动不该影响，跑一遍 check-types + lint 即可」；全仓测试留给主控最后一次提交后收口）· `git add` / `commit` / `push`（主控统一提交）· `git status` **干净**（本轮必须留改动待主控提交，故「干净」是提交后状态）。

### 5. 工具误报的判定与处置

| 条目 | 判定 | 处置 |
|---|---|---|
| api.md 新增 6 处 **反引号 `null`** 被 `5-表` 判为「疑似表名」 | **工具误报**（不是文档错）：`null` 在这里是「空值」语义，字段名 / 状态词；误报机理 = `api.md` 里另有 `null` 落在「表」字 ±10 字符内，于是**任何**被反引号包起来的 `null` 都命中（文档本身没有错话） | 按上一图先例**去掉会误报的反引号、改写成描述性文字**（「恒为空值」「率取空值」「必为空值」「不渲染空值字面量」）。**未改口径、未加黑名单、未动工具** |
| `STORAGE_MODE=s3`（2 env）· 13 条 `3-符号`（`FORBIDDEN` / `NULL` / `RATE_LIMITED` 等概念名）· 24 条 `5-表`（`null` / `node_used` / `conflict_pairs` 等字段状态词） | 均为**基线既有误报**（与本轮改动无关，数目与分类逐条一致） | **不动**（保持基线 39；加黑名单属工具债，本图不碰） |
| 其余 | 无新增误报 | — |

### 6. 未做 / 做不了的（如实）

1. **不改源码 / 夹具 / PRD / spec**（派单硬约束）——因此本轮的「回写」只让镜像与覆盖表跟上现状，**不改变任何能力**：`computeL2SignoffEligible` 仍 fail-closed 的工程公式，L2 **未准出、无人签**。
2. **覆盖表 `L2` 行覆盖值只能给 `部分测`**：真值缺口是 live 真跑归档 + 逻辑 id → `documents.id` 映射（要真 PG + 给 `fixtures/l2/corpus/*` 一个入库入口）+ RACI 人签，**非离线可补**。
3. **`L2` 行的 ID 是本轮**新造的一个**派生行 ID**（取自 PRD 剧本 J 的 P2.5 通过条件「L2 报告归档」与角色范围「P2.5：J-P2.5 + **L2**」，**不是**剧本 C 的编号步骤）。因此 ops 分册计数从「93 步」改为「94 = PRD 93 步 + 1 派生行」，并在计数段与 ID 闭集行**逐字写明**这一区分——若下一图认为该行应改挂到 ask 分册剧本 J，属可回退的登记位置问题（内容不变）。
4. **本图 `Not yet specified` 的更新由主控统一写**（派单禁止改 `map.md`）。本轮镜像已如实承载的、可直接抄进该段的项：① 逻辑 id → `documents.id` 映射**仍缺**（数据工程，`docHitRate` 恒 0 的根因）；② 零容忍另 **4 处去处**仍无判据（主题粘连 / `min_support` / 冲突数字 / 跳过 verify），销账路径已逐条写进 `spec/api/backend/l2-eval.md`；③ 两个版本键需**先有载体**；④ §8 的 L2 侧通用字段（模型 / 档位 / τ）需 worker 侧拿到本次 run 的身份（内口不下发 `mode`）；⑤ 区块与 `repro` **何时透** `…/eval/runs` DTO 待裁（`EvalRunSchema` 是 `.strict()`）；⑥ 夹具 18 条 / `near_coref` 3 条仍是债（扩集须真语料与人）；⑦ 「合法 citation 是否进 L2 的闸」须 PRD 澄清。
5. **未验证**：真 PG / 真 ES / Docker / live 真跑 / 人签（本机无基础设施）；`check:module-status` 的 `2-env` 两条是「代码默认 `local` vs 文档写 `s3` 走 RustFS」的既有基线口径，本轮未动（属既有可解释项，不是本轮引入）。

---

### 主控复核补记（2026-09-23）

**一、复核抓出并修掉一处新引入的算术错。** `docs/testing/coverage/03-ops.md` 本轮新增的「行数须与上表合计一致」加式里，`已测` 那一条原写 `1+3+1+2+1+6+3+8+7+10+0 = 40` —— 逐项对应 C·G·N·O·P·R·T·AB·AC·AD·I 各行真实值应为 `1+1+1+2+1+6+3+8+7+10+0`，原文把 G 段的 `1` 写成了 `3`，加式实际等于 **42** 而合计写 40（合计值本身没错，错的是加式）。已改为 `1+1+1+2+1+6+3+8+7+10+0 = 40`。

**二、六条加式与两张表已逐项机核**（用脚本按行求和，不靠肉眼）：

| 加式 | 求和 | 声明 | 结论 |
|---|---|---|---|
| `1+1+1+2+1+6+3+8+7+10+0` | 40 | 40 已测 | OK |
| `4+2+0+1+2+1+5+0+2+0+2` | 19 | 19 部分测 | OK |
| `0+0+…+0` | 0 | 0 缺测 | OK |
| `0+0+0+0+1+2+0+0+0+0+0` | 3 | 3 缺实现 | OK |
| `0+0+0+8+7+3+2+0+0+0+3` | 23 | 23 延后 | OK |
| `1+0+8+0+0+0+0+0+0+0+0` | 9 | 9 UAT | OK |

分册行合计 **94 / 40 / 19 / 0 / 3 / 23 / 9**；`docs/testing/coverage.md` 汇总表 `ask 64 + ingest 53 + acl 69 + ops 94 = 280`、`26+34+56+40 = 156`、`25+14+8+19 = 66`、`0`、`0+1+2+3 = 6`、`11+4+0+23 = 38`、`2+0+3+9 = 14` —— 逐列自洽。

**三、轮次编号不是冲突。** `coverage.md` 记「第八轮」、`coverage/03-ops.md` 记「第六轮」：两者是**各自分册的轮次计数器**（`coverage.md` 历史含第三～第八轮；`03-ops.md` 的历史含「三轮」叙述 + 第四 / 五 / 六轮），并非同一件事的两个编号，无需统一。

**四、`check:module-status` 的口径提示（供下次复用）**：本轮的 3 条 `6-联动` 是**工作区未提交**造成的（`checkDrift` 读的是 `git status --porcelain`）—— 源码一提交即自动消失，不是"欠账"。真正需要文档侧修的是 `1-路径` / `3-符号` / `5-表` / `7-时效` 四类。