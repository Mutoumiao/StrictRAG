# 研究：L1 签字证据面今天到底缺什么、有哪些可复用形状

Type: research
Status: resolved
Blocked by: —

## Question

把「一次 L1 run 凭什么能被签成业务 PASS」这条链上的三样缺失（人工抽检登记面 · 校准打分器接线 · §8 可复现字段）**逐条落到源码事实**，好让裁定票能拍板。要回答：

1. **人工抽检**
   - `prds/08-quality/02-evaluation-and-gates.md` §6 那一行「≥20 条，错 ≤1」的**原文上下文**是什么？§5 风险-覆盖扫描、§9 验收标准、`prds/10-delivery/03-acceptance-scenarios.md` 的相关剧本里有没有对「人工抽检」的进一步约束（谁做、什么时候做、做多少、结论写哪）？
   - 全仓（`apps/` `packages/` `fixtures/` `docs/` `prds/`）搜「抽检 / 复核 / spot / manual / review」这类词，**有没有任何既有的可复用形状**（例如 `pending_review` 审阅端点、feedback 队列、gold 审核 RACI、admin 的某页）？逐个给出路径与它今天实际承载什么。
   - `humanSpotMin` / `humanSpotErrorMax` 两个常量**被谁读**？（`compareHardGates`？`gatesComplete`？还是只被测试读？）给出全部读点。

2. **校准打分器**
   - `scoreJudge` / `judgeCalibCases` / `judgeAurocFromScored` 的**完整调用链**：谁定义输入形状、谁决定「有没有打分器」、结果如何进报告。
   - 两条生产入口（`apps/api/src/scripts/run-l1-golden.ts` · `apps/worker/src/eval/run-l1-batch.ts`）今天分别**在什么条件下**才不会注入打分器？有没有任何 env / 参数能注入？
   - 报告里除了 `judgeAuroc` 还有 `judgeAurocScored` 之类的计数吗？`fixtures/l1/judge-calibration.json` 的**确切形状**与题数、标签分布。
   - 「live vs mock」这件事在仓库里**已有**的统一判别形状是什么（`retrieveMode`？`STORAGE_MODE`？`SCAN_MODE`？）——列出现有的判别落点与它们的取值，供裁定票挑一个同构做法。

3. **§8 可复现字段**
   - 把 §8 的 14 类字段（seed、models、fallbackChains 版本、retrieveK、rerankTopN、tauClaim、crag\*、contextMode、mode、promptVersions、题面 ID 哈希、校准集哈希、lifecycle 过滤规则版本、session 策略版本 / rewrite prompt 版本、L2 剧本集哈希）逐条映射到**今天能从哪取到**：env（哪个变量）· KB config（哪个键）· eval_runs 行 · 计算（对什么算哈希）· 或「取不到」。
   - L1 报告类型（api 侧与 worker 侧两处）今天**已有**哪些字段？`persist.ts` 的 `reportJson` 白名单收了哪些键？
   - 有没有**现成的哈希工具**在仓库里（例如幂等键、指纹、`node:crypto` 的既有用法）？给出落点与用法。

4. **落点与回归面**
   - 要为这三样新增/改动，最少要动哪些文件（分 api / worker / contracts / db / admin 五侧列出）。
   - 落地会**翻哪些既有断言**？逐条点名文件与用例名（尤其：`adr046-snapshot.test.ts` · `adr046-hard-gates.test.ts` · `l1-cli.test.ts` · `run-l1-batch.test.ts` · `pilot-gates-parity.test.ts` · `docs-guard/*`）。
   - 若新增 PG 表，迁移文件的**编号现状**与 hand-written SQL 的既有写法（给一个最近迁移的样例路径与结构）。

5. **诚实面**
   - 三样里哪几样**离线做不出真值**？分别缺什么（真语料？真 judge？人？）？各自「能做的最大部分」到哪一步为止。

## 纪律

- 只读 + 只写本工单 Answer。不改源码。
- 每条结论要能指到**具体路径**（文件名 + 函数名；行号可给，但只写在 `.scratch/` 里）。
- 拿不准写「未核实」，禁止猜了当结论。
- 全部简体中文。

---

## Answer

**一句话总结**：三样缺失都能在离线环境下**把「证据面」补成可核对且不可作假**（登记面 / 接线三态 / 可复现字段），但**没有一样能离线产出可签字的真值** —— 抽检缺人、AUROC 缺真 judge 与 ≥100 标注、§8 的 5 类字段连「版本载体」都不存在。详见 [research/01-evidence-sources.md](../research/01-evidence-sources.md)。

### ① 人工抽检（工单第 1 组）

- **PRD 原文**：`prds/08-quality/02-evaluation-and-gates.md` §6（试点默认门禁包，可签字附件）硬门行「人工抽检 | ≥20 条，错 ≤1 | 硬」。
- **§5 / §9 / 剧本 有没有进一步约束**：**都没有**。§5（风险-覆盖扫描）只写 τ 网格伪码与「禁止只钉 0.3」；§9 的 11 条 checkbox 无一条提抽检；`prds/10-delivery/03-acceptance-scenarios.md` 剧本 C（可复现评测与签字）、剧本 T（加严/放宽）、「签字页必含行」5 行均**无抽检**。唯一实质约束来自 `prds/00-product/01-vision-and-success.md`：§4.1「证据支持 / **发布前必做**」、§4.1.1「**业务方参与**」、§4.1.2「抽检更严算加严、抽检变松须 ADR + 合规会签」；「结论写哪」只有白话稿 `prds/12-delivery-guides/01-业务一页纸.md`「门禁报告可归档」。→ **形状纯属实现选择**（与 map 判断一致，非改语义）。
- **既有可复用形状**：只有两个同构候选 —— ① **feedback 队列**（`apps/api/src/routes/feedback.ts`：`POST /ask/:requestId/feedback` · `GET …/feedback-queue` · `PATCH /feedback/:feedbackId`，权限 `feedback.queue`，`promoted_to_gold` 另需 `eval.run`；admin `/feedback` 页存在）；② **`fixtures/l1/RACI.md`**（人签文件账本，`services/eval-runs.ts` 注释明写 RACI 人签**不在库里**）。`pending_review` 是**入库去重**域（`packages/contracts/src/ingest/dedupe-conflict.contract.ts` + `apps/api/src/services/dedupe-conflict.ts`），与评测无关；admin `/eval` 薄页无登记控件。
- **两个常量的全部读点**：只在 `apps/api/src/eval/adr046-snapshot.ts` 内 —— `MAX_KEYS`（`humanSpotErrorMax` 的方向比较）、`compareHardGates`、`gatesComplete`（`Object.keys(PILOT_HARD_GATES)` 的**存在性/有限数检查**）、`fourElementsOf`、`bindQualitySnapshotToEval`（落 `snapshot.gates`）。**`evaluateAdr046Bind` 从不读它们** → 准确表述：**没有任何判定点把抽检条数/错误数与常量比较过**。测试侧只有 `adr046-snapshot.test.ts`（T1 / P6）与 `pilot-gates-parity.test.ts`（只比 coverage/cRate）。

### ② 校准打分器（工单第 2 组）

- **调用链**：纯函数在 `packages/contracts/src/eval/l1-matrix.ts`（`parseJudgeLabel` / `parseJudgeCalibration` / `auroc` / `judgeAurocFromScored` / `parseMinSupport`）；「有没有打分器」两处判定且**形态不同**：api `run-l1-golden.ts` 的 `scoreJudgeAuroc()`（缺 `scoreJudge` 即 null，校准集**有默认仓根路径**）；worker `run-l1-batch.ts`（要求 `scoreJudge` **与** `judgeCalibCases` 同时给，**无默认路径**）。结果进报告两侧各有 `judgeAuroc` + `judgeAurocScored`；但**只有 api CLI 一侧进判定**（worker 只落库，`evaluateAdr046Bind` 无 worker 调用点）。
- **两条入口的不注入条件**：**都是「调用方没传函数入参」**，且**都没有任何 env / 参数 / payload 注入路径** —— CLI `main()` 只读 `L1_KB_ID/L1_MAX_CASES/L1_GOLD_PATH/L1_OUT_DIR`；`EvalConsumerDeps` 无打分器字段；`EvalJobDataSchema` 是 `.strict()` 且无相关键；api/worker 两侧 env 均无 judge/calib 变量。注入只存在于单测。
- **夹具**：`fixtures/l1/judge-calibration.json` = `{cases:[…]}`，**8 条（4 正 4 负）**，字段 `id`/`claim`/`evidence`/`label`（`supported|unsupported`），手写 seed，远低于 PRD §4 的 ≥100。报告**已有** `judgeAurocScored`（有效对数），**没有** `judgeAurocTotal` / 来源标记 / 规模门；DTO 侧 `extraStatsFromReport` **只透出 `judgeAuroc`**。
- **live/mock 既有判别形状**：范式 = `*_MODE` env 枚举（默认 mock 态）+ 报告三态字符串 + 判定只认最高态。落点：`RETRIEVE_ES_MODE`（→ `resolveEvalMode` / `resolveRetrieveMode` 映射 `mock→mock` / `http→live` / 其它→`unknown`）· `GATEWAY_MODE` · `INGEST_ES_MODE` · `INGEST_EMBED_MODE` · `STORAGE_MODE` · `INGEST_SCAN_MODE` · `INGEST_CONTEXTUALIZE_MODE`。**全仓无「由 Gateway 回包声明来源」的先例**；唯一「声明 + 实测回退标记」两层形状是 `INGEST_CONTEXTUALIZE_MODE` + `contextSource`（`l0`/`l0_fallback`/`l1_llm`）。

### ③ §8 可复现字段（工单第 3 组）

- **逐条去向**（详见研究票 §3.1 全表）：**可算/可派生** → `retrieveK`(150) · `rerankTopN`(20) · `tauClaim`(env) · `题面 ID 哈希` · `校准集哈希` · `L2 剧本集哈希`；**可取但今天没取** → `models`（env + `model_bindings`）· `contextMode`（KB/文档分片参数，**属入库语义**）；**取不到** → `seed` · `fallbackChains 版本` · `crag*`（**功能未实现**）· `promptVersions` · `lifecycle 过滤规则版本`（规则在 `packages/db/src/query/retrieval-gate.ts`，**无版本常量**）· `session 策略版本`（只有 `SESSION_REWRITE_ENABLED` 布尔与 L2 的 `rewriteEnabled`）；**歧义待裁** → `mode`（今天 = `retrieve_mode` 历史别名，**不是** ask 档位 strict/balanced/fast）。
- **报告类型已有字段**：api `L1Report` 24 项（含 `gateSnapshot`/`gateVerdict`，**无任何指纹字段**）；worker `L1BatchReport` 20 项（**无 gateSnapshot/tauClaim/指纹**）。worker `persist.ts` 的 `reportJson` 白名单**逐键 21 个**（`mode`…`kbId`）。
- **哈希工具**：唯一「语义指纹」是 `apps/api/src/eval/l2-fingerprint.ts` 的 `l2RewriteFingerprint(prompt, modelId)`（sha256，已进 L2 报告 + 专测）；另有 `createHash('sha256')` 算 `checksumSha256`（`services/storage.ts` / `services/ingest-complete-pending.ts`）。**无**通用内容哈希工具。

### ④ 会翻的既有断言清单（工单第 4 组）

1. **`apps/api/tests/eval/adr046-hard-gates.test.ts`：8 处 `businessPass===true` 必翻**（助手只喂五项；新 fail-closed 门会全打红）—— 最高风险。
2. `apps/api/tests/eval/adr046-snapshot.test.ts`：T1 `snapshot.gates ≡ PILOT_HARD_GATES`（同源不破）· P6 键名不得以 `aux` 开头 · `snapshotBindIdentity` 不得改。
3. `apps/api/tests/eval/pilot-gates-parity.test.ts`：`coverageMin`/`cRateMax` 与 `TAU_STAR_*` 双写断言 —— **不得下沉/改名**。
4. `apps/api/tests/eval/l1-cli.test.ts`：三处 `L1Report` 字面量（加**必填**字段即红）+ 三条「不注入即 null / 不回落夹具 / 单类即 null」回归钉。
5. `apps/worker/tests/eval/run-l1-batch.test.ts`：6 处 `runL1Batch({...})` 调用（新增必填 opt 即红）+ 三态/长度门两条。
6. `apps/api/tests/eval/http-eval-runs.test.ts` + `packages/contracts/tests/eval/gold-contract.test.ts`：`EvalRunSchema` 是 `.strict()` → 新字段必须同步 schema 与 `toEvalRunDto`。
7. `apps/api/tests/docs-guard/gold-review-guard.test.ts`：**凡源码含 `gold.yaml` 的文件，写文件 API 的 ±200 字符窗内不得再出现 `gold.yaml`**；`auth-enforce-pilot` / `delivery-s05` 守文档文本，不动则不染。
8. `packages/db/tests/migrations/sql-snapshot-default-parity.test.ts`：新迁移**任何 `DEFAULT`** 必须能对上**最高号快照 `meta/0021_snapshot.json`**（**今天没有 0022/0023 快照**）→ 新表**最省事是不写 DEFAULT**。
- **迁移现状**：最大编号 **0022**；`meta/_journal.json` 23 条 entry 且**手写**（`idx`/`version:"7"`/`when`/`tag`/`breakpoints`）；最近样例 `0022_ingest_report_default_parity.sql`（中文头注 + 两条 `DROP DEFAULT` + `--> statement-breakpoint`），建表样例 `0010_eval_floor.sql`（`IF NOT EXISTS` + 无默认列 + 唯一索引）。

### ⑤ 离线可做边界（工单第 5 组）

- **人工抽检**：能做「登记面 + 判据接闸（缺测不放行）+ 两种红可分辨 + 合法登记真能翻绿 + 边界测例」；**卡在**缺**人**与真语料结论（PRD 只写「业务方参与」）。
- **校准打分器**：能做「来源三态同构接线 + mock/缺测均不放行 + 「live 注入即该门可达」可达性证明」；**卡在**缺**真 judge** 与 **≥100 真标注校准集**（夹具 8 条手写）。
- **§8 字段**：能做「能取到的进报告 + 三个哈希写成稳定纯函数 + 取不到写 `null` 并记债」；**卡在** 5 类字段**没有「版本」载体**（只能改算配置内容哈希，形似而非 PRD 语义，**须裁定是否接受**）与缺真跑环境（真 PG/ES/Gateway）。
- **共同结论**：三样都**不能**离线产出可签字 PASS；本图产物是「证据面存在且不可作假」，**不是证据值**。

### 给主控的三条反直觉发现

1. **两侧持久化不同构**：api `buildEvalRunInsert` 是 `reportJson: report`（整对象直落）；worker `saveReport` 是**白名单逐键挑** → 只在 `L1BatchReport` 类型上加字段会被 worker **静默丢弃**（不报错）。
2. **加一个新 fail-closed 门会一次性打红 8 处既有 `businessPass===true` 断言**，必须同步改测试助手，否则新门落地即假红。
3. **`L1Report.mode` 不是 ask 档位**（而是 `retrieve_mode` 历史别名）——§8 的 `mode` 指哪个须裁定；且**各包 `tests/index.md` 的「待处理」段今天全为「（无）」**，map 里「若 index 仍有待处理行」的前置条件不成立。
