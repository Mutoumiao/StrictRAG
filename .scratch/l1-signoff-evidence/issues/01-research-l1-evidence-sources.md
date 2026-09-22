# 研究：L1 签字证据面今天到底缺什么、有哪些可复用形状

Type: research
Status: open
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
