# 落 §8 可复现字段进 L1/L2 报告

Type: task
Status: resolved
Blocked by: 02

## Question

按裁定票 02 的决定，把 PRD §8 的可复现字段（seed、models、fallbackChains 版本、retrieveK、rerankTopN、tauClaim、crag\*、contextMode、mode、promptVersions、题面 ID 哈希、校准集哈希、lifecycle 过滤规则版本、session 策略版本 / rewrite prompt 版本、L2 剧本集哈希）落到**能取到的都进报告**、**取不到的记债**：

- 报告里新增一个可复现区块（形状以裁定为准），字段值一律从既有来源取，**不编造**：取不到的一律 `null` + 记债行，不许填占位串。
- 三个哈希（题面 ID / 校准集 / L2 剧本集）按裁定实现为**稳定**纯函数：同一输入跨机器同值；同输入两次 run 同值；输入变一个字节值就变。
- 若裁定 L2 侧同批：两条 L2 入口（api CLI 与 worker batch）同样同构落地。
- 新增测例覆盖：哈希稳定性（同值 / 变值）· 取不到的字段为 `null` 而非伪值 · 报告 md 渲染不炸 · 两条入口同构。
- 每处改动配**反证**：改回旧口径（不写字段 / 伪值）→ 测例必红；贴出红。

## 交付

- 源码 + 测例（登记 `tests/index.md`，文件头中文四段）。
- Answer 里给：§8 十四类字段的**逐条去向表**（进报告 / 记债 + 为什么取不到）· 改动文件清单 · 新增用例数 · 反证轮次与红条数 · **未做**清单。
- **不要**提交（commit 由主控做）。

---

## Answer

**总判据**（承裁定二·三）：PRD 写死的 → 落；PRD 没写但有数据源 → 落并写清是选择；无载体 / 需读库读不到 → 进报告但值 `null` + 记债（禁止编造、禁止拿源码文本哈希顶替）。区块形状 = `packages/contracts/src/eval/l1-repro.ts` 的 `L1Repro`，api CLI 与 worker 批跑**同 14 键**、同一套 `emptyL1Repro()` 铺底。

### 一、PRD §8 逐条去向表

PRD §8 列 **15 条目**，其中「session 策略版本 / rewrite prompt 版本」算一类 → **14 类**；本票区块正好 14 键（`mode` 见第 9 行：**不进区块**）。

| # | §8 条目 | 报告键 | 去向 | 值 / 来源（源码口径） | 取不到的理由 · 销账路径 |
|---|---------|--------|------|----------------------|------------------------|
| 1 | seed | `seed` | 进报告 | 恒 `null` | 全仓无随机种子载体（批跑唯一随机源是 `uuidv7()` requestId，不进判定；τ 网格是常量 `TAU_SWEEP_GRID`）。PRD §5 的 `seed=fixed` 只是文档纪律。销账 = 引入 seed 常量载体，或 PRD 写明 L1 无需 seed |
| 2 | models | `models.env.{chat,embed,rerank}` + `models.kbBindings` | **api 取真值**；worker 全 `null` | api：env `GATEWAY_CHAT_MODEL` / `GATEWAY_EMBED_MODEL` / `GATEWAY_RERANK_MODEL`（空白 → `null`）+ KB 级 `model_bindings`（`modelGatewayRepo.listKbBindings`，CLI `main()` 注入读取器） | worker 不持有本次 run 的模型配置（批跑经 api 内口执行）；worker 自己的 `GATEWAY_*` 是**入库侧** env，标成 run 模型就是错标。KB 读库失败 → `null` + stderr 告警（不编造绑定） |
| 3 | fallbackChains 版本 | `fallbackChainsVersion` | 进报告 | 恒 `null` | 链**内容**可取（`model_bindings.fallback_refs`），但**「版本」无载体**（无版本号/序号/时间戳）；裁定明令禁止拿链内容或源码文本哈希顶替。销账 = 引入版本常量载体 |
| 4 | retrieveK | `retrieveK` | **api 取真值**；worker `null` | api：图上回包档位（`graph.mode`）→ `retrieveBudgetForMode`（fast 60 / balanced·strict 150） | worker 不跑图，api 内口 `execute-ask` 不回传档位（`routes/eval.ts` 的返回体无 `mode`）→ 取不到。销账 = 内口回传档位 |
| 5 | rerankTopN | `rerankTopN` | 同 #4 | fast 10 / balanced·strict 20 | 同 #4 |
| 6 | tauClaim | `tauClaim` | **api 取真值**；worker `null` | api：`snapshot.tauClaim ?? env.TAU_CLAIM`（与 ADR-046 快照**同一个值**，报告里不出现两个 τ） | worker 进程的 `TAU_CLAIM` 不是本 run 的 τ 源（ADR-007 唯一源在 api env）→ 不冒充 |
| 7 | crag* | `crag` | 进报告 | 恒 `null` | **功能未实现**（`graph/run.ts` 注释：无 CRAG / grade / refine / multi_hop）。销账 = 实现 CRAG |
| 8 | contextMode | `contextMode` | 进报告 | 恒 `null` | contextMode 属**语料制备**参数：KB 分片策略**逐策略** `paramOverrides.contextMode`、文档级 `chunkStrategyParams.contextMode`；L1 ask-run 没有单一值可取（不发明「取第一条策略」这类规则）。销账 = PRD 澄清 contextMode 指哪一层，或明确「L1 run 不适用」 |
| 9 | mode | **无键** | 不进区块 | 既有顶层 `mode` / `retrieve_mode` = `resolveEvalMode(RETRIEVE_ES_MODE)`（mock/live/unknown） | 既有 `mode` 是 `retrieve_mode` 的**历史别名**，不是 ask 档位；改名或在区块里再造 `mode` 就是改语义 → 裁定禁止。§8 的 `mode` / `contextMode` 语义歧义**记债**（须 PRD 澄清「运行档」还是「运行模式」） |
| 10 | promptVersions | `promptVersions` | 进报告 | 恒 `null` | `graph/prompts.ts` 只有函数、无版本常量；禁止对 prompt 文本算哈希顶替。销账 = prompt 版本常量 |
| 11 | 题面 ID 哈希 | `questionIdsHash` | **两侧取真值** | api：`l1QuestionIdsHash(gold 文件全量 id)`；worker：`l1QuestionIdsHash(DB gold_questions.case_key 全量)` | 已落。规范化 = trim → 去空 → **升序** → JSON → sha256（题面集是集合，换序不算换集）。**残留**：两侧 id 载体不同（文件 id vs `case_key`），集合一致时同值，但顺序口径差异与「文件 id ≠ DB case_key」记债（销账 = 统一题面 id 载体） |
| 12 | 校准集哈希 | `calibrationHash` | **api 取真值**；worker `null` | api：`l1CalibSetHash(fixtures/l1/judge-calibration.json 内容)`（逐字节）；注入校准题（单测）或无文件 → `null` | worker 只收**解析后的** `judgeCalibCases`，无路径/无内容 → 取不到（拿 `JSON.stringify(cases)` 哈希会是另一个指纹，形似而非同一物）。销账 = worker 侧加校准集路径 |
| 13 | lifecycle 过滤规则版本 | `lifecycleFilterVersion` | 进报告 | 恒 `null` | 规则是代码谓词（`packages/db/src/query/retrieval-gate.ts` 的 `isDefaultRetrievable` + `effective-window.ts`），无版本常量。销账 = 规则版本常量 |
| 14 | session 策略版本 / rewrite prompt 版本 | `sessionStrategyVersion` | 进报告 | 恒 `null` | session 策略 = env 布尔 + KB 锁定 + 窗口函数；rewrite prompt 同 #10 → 皆无版本载体。L2 报告已有的 `l2RewriteFingerprint` 是「prompt+model 内容指纹」，**不是「版本」**，本票不拿它顶替。销账 = 版本常量 |
| 15 | L2 剧本集哈希 | `l2GoldSetHash` | 进报告 | 恒 `null` | 裁定：**L2 侧归下一张图**（L2 采集面是那张图主体）；本票不碰 `fixtures/l2/gold.yaml` 侧入口 |

`null` 纪律：取不到的一律 `null`（区块里**没有** `''` / `'unknown'` / `'-'` / `'n/a'`），md 渲染成「—」；`seed` / `fallbackChainsVersion` / `crag` / `contextMode` / `promptVersions` / `lifecycleFilterVersion` / `sessionStrategyVersion` / `l2GoldSetHash` 的类型是 **`null` 字面量** —— 编一个假版本号过不了 `tsc`。

### 二、改动文件清单

新增：

- `packages/contracts/src/eval/l1-repro.ts` —— `L1Repro` / `L1ReproModels` / `L1ReproKbBinding` / `emptyL1Repro()` + 两条哈希纯函数（`l1QuestionIdsHash` / `l1CalibSetHash`，`createHash('sha256')`）
- `packages/contracts/tests/eval/l1-repro.test.ts`
- `apps/api/tests/eval/l1-repro-fields.test.ts`
- `apps/worker/tests/eval/run-l1-batch-repro.test.ts`

修改：

- `apps/api/src/scripts/run-l1-golden.ts` —— `L1Report.repro`（必填）· 区块构建（`envModelOrNull` / `reproBudgetForAskMode` / `readJudgeCalibContentIfPresent` / `buildL1Repro`）· md 渲染 `reproMdLines`（取不到 → 「—」）· 循环里采集图上档位 · τ 提升为单变量（快照与报告同源）· `RunL1Options.readKbBindings` · `main()` 注入 `modelGatewayRepo.listKbBindings` 并把 `repro` 打进 stdout 摘要
- `apps/worker/src/eval/run-l1-batch.ts` —— `L1BatchReport.repro`（同形状；只填 `questionIdsHash`，其余 `null`）
- `apps/worker/src/eval/persist.ts` —— `reportJson` **逐键白名单**加 `repro`（否则静默丢弃）
- `packages/contracts/package.json` —— ①`exports` 增子路径 `./eval-repro`；②devDependencies 加 `@types/node: catalog:`（见「与裁定不符处」1）
- `pnpm-lock.yaml` —— 上述 devDep 的锁定结果（`pnpm install`）
- `apps/api/tests/eval/l1-cli.test.ts` —— 三处 `L1Report` 字面量补 `repro: emptyL1Repro()`（**期望值未改**，只因字段必填）
- `apps/api/tests/index.md` · `apps/worker/tests/index.md` · `packages/contracts/tests/index.md` —— 登记新测例

**未动**（本票边界）：`EvalRunSchema` / `toEvalRunDto` / `extraStatsFromReport`（DTO 不透出）· `evaluateAdr046Bind` 与任何判定 · `adr046-snapshot.ts` · `l1-matrix.ts` 现有符号 · L2 侧（`run-l2-batch.ts` / `saveL2Report` / `l2-fingerprint.ts`）· env 默认值 · 迁移 · HTTP 端点。

### 三、新增 / 改写用例数

- 新增 **20 条 it**：contracts 9（两条哈希稳定性 + 空输入 + 区块形状）· api 7（取真值 / 档位随回包 / KB 绑定读取器 / 逐字段 null / 不进判定 / md 渲染 / 既有 mode 语义）· worker 4（同形状 / 题面哈希 / 逐字段 null / 白名单同构）
- 改写 **1 个文件**（`l1-cli.test.ts` 三处字面量补必填字段，断言未改）

### 四、反证（4 轮变体 · 共 7 条红）

| 轮 | 反转做法 | 红的用例 | 原始输出摘要 |
|----|----------|----------|--------------|
| ① | `emptyL1Repro().contextMode` 改伪串 `'unknown'` | contracts 1 红 + api 2 红 | `AssertionError: expected 'unknown' to be null`（contracts「取不到的分项一律 null」）；api 同错误 + `expected '# L1 last run…' to contain '\| contextMode \| — \|'` |
| ②a | `l1QuestionIdsHash` 改「带时间戳」：`sha256Hex(JSON.stringify(list) + '@' + Date.now())` | api 1 红 + contracts 1 红 | `expected '068fef30407db3594a21681cb99f72e432b5a…' to be '5260d830c5e2e2a0e077202ab5d20d8fbf071…'`；contracts `FAIL … 同输入同值，且是 64 位十六进制（跨进程由硬编码摘要钉住）` |
| ②b | 去掉升序规范化（`new Set(list)` 不排序） | contracts 1 红 | `FAIL … 题面集是集合：换序 / 前后空白不改值` → `expected '02d8bc3008a9bb0dcc4b86d7fd3428ced7923…' to be '0473ef2dc0d324ab659d3580c1134e9d81203…'` |
| ③ | 删 `persist.ts` 白名单里的 `repro: report.repro` | worker 1 红 | `AssertionError: expected undefined to deeply equal { seed: null, models: {…}… }`（同构用例） |

每轮均**已还原**并复跑至全绿（见下节数字）。

### 五、门禁数字（最后一次还原之后）

| 命令 | 结果 |
|------|------|
| `pnpm check-types` | 8 tasks successful（15.4s） |
| `pnpm lint` | 8 tasks successful，**零 warning**（16.7s） |
| `pnpm --filter @strict-rag/api test` | **173 files / 1076 passed、3 skipped**（96s；含 `tests/docs-guard/` 三条护栏） |
| `pnpm --filter @strict-rag/worker test` | **52 files / 233 passed**（21s） |
| `pnpm --filter @strict-rag/contracts test` | **31 files / 254 passed**（4.7s） |
| `pnpm --filter @strict-rag/web build`（额外自查，非门禁） | **通过**（Next 16 编译成功）—— 证明子路径导出未把 `node:crypto` 带进客户端图 |

### 六、与裁定 / 任务书不符处（如实报）

1. **哈希函数的导出路径**：任务书写「哈希写成稳定纯函数放 contracts」，实现里它们**在 contracts 但走子路径** `@strict-rag/contracts/eval-repro`，**不进主入口 `src/index.ts`**。理由：contracts 主入口被 web/admin **客户端**打包（`apps/web/next.config.ts` 的 `transpilePackages` 含 `@strict-rag/contracts`，且 `ask-panel.tsx` / `ask.ts` 是 `'use client'` 下**值导入** zod schema），`node:crypto` 进客户端图会让 Next 构建失败。连带给 contracts 加了 `@types/node` devDependency（`packages/contracts/src` 此前不碰 node 内置模块，无该类型）。**不是**改语义，只是打包边界；web 构建已实测通过。
2. **contextMode 落在「进报告但值恒 null + 记债」**，不是取真值：它是逐策略/逐文档的语料制备参数，L1 run 无单一口径（不发明规则）。若主控要求真取，须先由 PRD 澄清口径。
3. **worker 侧 `tauClaim` 记 `null`**：不写 worker 进程的 `TAU_CLAIM`（那不是本 run 的 τ 源，写进去就是错标）。
4. **`retrieveK` / `rerankTopN` 由图上回包档位派生**（不硬编码 `balanced`）：整批 error / 无回包 → `null`；api 测试钉住 fast→60/10、balanced→150/20、无回包→null。副作用是**报告值随图上实际档位变**，这正是它要语义。
5. **题面 ID 哈希内部升序**（集合语义）：换序不改值（钉了测例）。这是「同一份题面两次 run 可对比」的必要条件，也避开 worker 侧 `loadGold` 查询无 ORDER BY 的顺序不确定性。
6. **校准集哈希逐字节、不做行尾归一**：严守「输入变一个字节值就变」，代价是 Windows CRLF 检出会得到不同值（记债，见第七节）。

### 七、未做（债 / 下一张图）

- **DTO 未透出**：`repro` 只进 `eval_runs.report_json`（api 走 `reportJson: report` 整对象）与 `artifacts/l1-last-run.{json,md}`；`EvalRunSchema` / `toEvalRunDto` / `extraStatsFromReport` **未动** → `GET /eval/runs` 看不到该区块（`EvalRunSchema` 是 `.strict()`，透出必须同步 schema，按任务书第 5 条留给后续票）。
- **L2 侧未做**：`l2GoldSetHash` / session 策略版本（L2 报告同缺）→ **下一张图**；`run-l2-batch.ts`、`saveL2Report` 白名单、`fixtures/l2/gold.yaml` 侧未碰。
- **worker 侧 `retrieveK`/`rerankTopN`/模型/τ/校准集哈希** 全 `null`（销账路径见去向表），未扩 api 内口响应体。
- **版本载体类字段**（seed / fallbackChains 版本 / promptVersions / lifecycle 规则版本 / session 策略版本）仍是 `null`：仓内**没有**版本载体，本票拒绝「拿源码文本或配置内容哈希冒充版本」。
- **跨平台行尾**：未加 `.gitattributes`，故 CRLF 检出会让「校准集哈希」变值（记债：归一化会破坏「变一字节即变」口径，本票不选）。
- **真值验证**：未跑真模型 live、未在真 PG 上跑 worker 落库（本机无 Docker/PG）、未做人签 —— 本票只保证「证据面存在且取不到时不作假」。
- **未跑全仓 `pnpm test`**（按任务书：不与其它测试命令并发）；未改 `docs/module-status/`、`.trellis/`、`prds/`（回写与镜像属工单 06）；未新增 HTTP 端点 / PG 迁移 / 改任何 env 默认值；未提交（commit 由主控做）。
