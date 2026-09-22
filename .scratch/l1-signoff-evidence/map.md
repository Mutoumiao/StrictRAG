# L1 签字证据面的补齐（人工抽检 · 校准打分器 · 可复现字段）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 · 04 · 05 · 06 全收口）

## Destination

把「一次 L1 run 凭什么能被签成业务 PASS」的**证据面**补到可核对 —— 今天这张桌上还缺三样东西：

1. **人工抽检（PRD §6 硬门「≥20 条，错 ≤1」）拿到真实登记面与判据**：今天全仓只有两个常量（`humanSpotMin` / `humanSpotErrorMax`），**无入口、无表、无报告字段**；即「没有任何人能把抽检结果登记进来，判定也无从读它」。
2. **Judge AUROC（PRD §4 校准 + §6 硬门「≥0.65」）拿到一条只认真实打分器的接线口径**：今天 `scoreJudge` 可注入但生产入口不注入 → `judgeAuroc` 恒 `null` → `businessPass` 在生产路径上**不可达**（这是上一张图有意的 fail-closed）。本图要给它一条**可达但不作假**的路径：mock / 缺测永远变不了绿。
3. **PRD §8 的 14 类可复现字段落进 L1/L2 报告**：今天 L1 报告里基本没有 seed / models / promptVersions / 题面哈希 / 校准集哈希，于是 §7 再认证触发表的 18 行里有 12 行只是**文档纪律**，不能核对。

**判据线（承上一张图）**：PRD **已经写死**的东西（§4 校准规模与指标、§6 硬门表、§7 触发表、§8 字段表）在代码里缺，属**实现缺口**，落地属「实现 PRD」；PRD **没写**的东西代码自己加，属改冻结语义，须 ADR。**本图只做前者。**

**成功长什么样**：签字页上「人工抽检」「Judge AUROC」两行各有一条能被第三方跟着走到证据的路径；报告里任何一次 run 都能被另一台机器用同样的配置复跑对比；且**没有任何一处**因为「没测」或「mock」而变成绿。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（`prds/08-quality/02-evaluation-and-gates.md` 现为 0.4.34）为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：[`quality-gate-parity`](../quality-gate-parity/map.md)（已收口）把 L1 五项、L2 近指代的**实测值真接进了判定**，并把「人工抽检 · 校准规模与打分器 · §8 字段」三项显式划进它的 `Not yet specified` A/C 段。**本图即那三项的图。**
- **前前图**：[`close-p2-exit-gaps`](../close-p2-exit-gaps/map.md) 的工单 16 已裁「签字包来源」，工单 19 已裁 embed TPM 无口径；本图不重开那两题。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` 全文 · `apps/api/src/eval/adr046-snapshot.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `apps/worker/src/eval/run-l1-batch.ts` · 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包（`api/backend/l1-eval.md` 已有「硬门判定落点」一节）。
- **本图携带执行**：工单可直接改代码、补测例、回写镜像（同前图）。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`，且**不得与他人并发跑**（前图实测：并发抢 CPU 会让 web 包超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**。
- **质量红线不放宽**：门禁只加严（ADR-046）；**mock 数字禁进签字包**（PRD §6.1 / ADR-061）；本图所有改动必须是**收紧或逐位等价**。
- **两条本图特有的「不许」**：
  - **不许**把人工抽检做成第二个「恒 `false` 空转闸」——上一图已明令禁止；本图的顺序必须是**先有登记面、再进闸**。
  - **不许**为让 `businessPass` 变绿而接一个 mock 打分器：那正好是 PRD §6.1 禁的「mock 数字进签字包」。打分器接线必须带**来源判别**（live / mock / 缺测三态），且只有 live 能进签字公式。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**，也不给裸枚举字面量加反引号；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（两条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图（涉及 admin 页面时只做 RTL 可测的逻辑，不承诺视觉验证）；真模型 live 跑数 / 真 ES / 真 PG 迁移 / Docker / 人签也不在。
- **成果预期**：本图会新增**表 / 迁移 / 报告字段 / 新常量**；凡新增迁移必须在镜像里如实标注「**未**在真 PG 上 apply 过」（本机无 Docker 守护进程）。

### 开工基线（2026-09-23 · 逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| PRD §6 硬门表（7 行） | `cRateMax .05` · `coverageMin .40` · `citationCompleteMin .99` · `judgeAurocMin .65` · `hitAt20Min .70` · `humanSpotMin 20` · `humanSpotErrorMax 1`（`prds/08-quality/02-evaluation-and-gates.md` §6） |
| 前五项 | **已进判定**（`evaluateAdr046Bind`，2026-09-23 图 quality-gate-parity 工单 03）；缺测一律 fail-closed |
| 人工抽检 | 全仓**只**有 `humanSpotMin` / `humanSpotErrorMax` 两个常量（`apps/api/src/eval/adr046-snapshot.ts`），**无生产者、无承载字段、无表** |
| Judge AUROC | `scoreJudge` / `judgeCalibCases` 可注入（`apps/worker/src/eval/run-l1-batch.ts`）；夹具 `fixtures/l1/judge-calibration.json` **8 条**（4 正 4 负），PRD §4 要 ≥100；生产入口**不接**打分器 → `judgeAuroc` 恒 `null` |
| `businessPass` 可达性 | 生产路径上**不可达**（`judgeAurocOk` 要求非 null 且 ≥0.65）—— 上一图有意为之，本图要给它可达路径 |
| PRD §8 可复现字段 | L1 报告里 seed / models / fallbackChains 版本 / promptVersions / 题面哈希 / 校准集哈希等**基本不存在**（`run-l1-golden.ts` 的报告类型无指纹字段） |
| PRD §7 再认证触发表 | 18 行；其中 12 行依赖 §8 的字段才能核对，今天只能靠文档纪律 |
| 既有可复用形状 | `eval_runs` 表 + `run_type` 四值 + `reportJson` 白名单（`apps/worker/src/eval/persist.ts`）· admin `/eval` 薄页 · KB 设置页 `qualitySnapshot` 只读回填（`apps/api/src/routes/kb-settings.ts`）· `pending_review` 审阅端点（未见 admin 控件） |
| 冻结文本边界 | PRD §6 只写「≥20 条，错 ≤1」，**未**规定登记面形状、未定义「错」的口径 → 形状由本图**裁定**（属实现选择，不是改语义）；§8 只列字段名，未规定存放处 |

## Decisions so far

<!-- 索引：一条已收工单一行，够判断相关性即可，细节放大进链接 -->

- [研究：L1 签字证据面今天到底缺什么、有哪些可复用形状](./issues/01-research-l1-evidence-sources.md) — 研究子代理产出（明细 42 KB 在 [research/01-evidence-sources.md](./research/01-evidence-sources.md)）。要点：① 三样都能补成「不可作假」，但**没有一样能离线产出可签字的真值**（缺人 / 缺真 judge 与 ≥100 标注 / 5 类字段连版本载体都没有）。② 人工抽检：`humanSpotMin`/`humanSpotErrorMax` **没有任何判定点拿它比过被测值**（只在 `compareHardGates` 存在性与方向比较里出现），`evaluateAdr046Bind` 从不读；PRD §5/§9/剧本 C/T/签字页必含行**全都没写**「谁/何时/写哪」→ 形状纯属实现选择。③ 打分器：注入只存在于单测，两条入口**都没有任何 env / 参数注入路径**；夹具 8 条（4 正 4 负）；`live vs mock` 的既有范式是 `*_MODE` 枚举 + 报告三态串。④ §8 逐条去向已列：可算/可取 6 类、取不到 5 类；**`L1Report.mode` 是 `retrieve_mode` 的历史别名，不是 ask 档位**。⑤ 会翻的既有断言点名 8 组；迁移最大号 **0022**，快照只有 `0000`/`0021`。⑥ **三条反直觉**：api 报告整对象直落 vs worker `persist.ts` 逐键白名单 → 加字段会被 **worker 静默丢弃**；加一个新 fail-closed 门会一次性打红 `adr046-hard-gates.test.ts` 的 **8 处 `businessPass === true`**；各包 `tests/index.md` 的「待处理」段今天全为「（无）」。
- [裁定：三样证据面各落到什么形状](./issues/02-dec-l1-evidence-ruling.md) — 主控裁定。**人工抽检**：承载面 = **文件账本（Zod 进 contracts）+ 报告字段 + `--human-spot <path>` CLI 入参**，**不建表、不建 HTTP**（后者是无生产者的半接线，会重蹈 QUAL-ACL-CAP 被划出；前者撞迁移/快照风险，且本仓已有人证放文件不放库的先例 `fixtures/l1/RACI.md`）；**「错」不发明机械口径**（PRD 未定义）；进闸 = 条数 ≥`humanSpotMin` ∧ 错 ≤`humanSpotErrorMax`，缺测不放行，三个 reason code 各可分辨（`human_spot_missing` / `_below_min` / `_errors_above_max`）。**打分器**：新增 `JUDGE_CALIB_SCORER`（`off` 默认 / `mock` / `http`）+ 报告 `judgeAurocSource`，**判定只认 `live`**（mock 值可打印、不参与判定）；**落规模门**（PRD §4 写死 ≥100，reason `judge_auroc_calib_too_small`）；`http` 真打分器分两段评估，Gateway 侧 go/no-go 不齐就只留声明面并记债。**§8**：能取到的进报告（`models`/`retrieveK`/`rerankTopN`/`tauClaim`/`contextMode` + **三条哈希**对文件内容算 sha256），**既有 `mode` 不动**（改了就是改语义），`fallbackChains`/`promptVersions`/`lifecycle 规则`/`session 策略` 无版本载体 → **不拿源码文本哈希顶替**，一律 `null` + 记债；**L2 侧留给下一张图**。**统一纪律**：主动**不新增迁移**；唯一被改写期望值的既有断言是 `adr046-hard-gates.test.ts` 的助手及其 8 处断言；worker `reportJson` 白名单必须同步并加同构测例。
- [落人工抽检的登记面与判据](./issues/03-task-human-spot-surface.md) — 新增 `HumanSpotLedgerSchema`（三条机械不变式）+ `HumanSpotReport` · api `eval/human-spot.ts` 加载器（坏账本抛错、**不**退化成缺测）· `evaluateAdr046Bind` 加 `humanSpotOk` 与三个 reason code · api CLI `--human-spot <path>`（坏账本 exit 2 且一题不跑）· worker 同形状（`humanSpotPath` + `persist.ts` 白名单加键，逐键白名单会**静默丢弃**、已用测例钉住）· 夹具 `fixtures/l1/human-spot.example.json`（恰好达标样例，**非**签字证据）。新增 **31** 条用例；反证 3 轮 **14** 条红（判定不看该值 9 · 去掉 `errors<=checked` 4 · 删 worker 白名单 1）。**可达性已证**：同一份「其他全绿」的跑次 + 合法账本 → `businessPass === true`；抽掉账本 → 立刻 false 且 reason = `human_spot_missing`。**未做**：worker 生产路径不传账本（恒 null，方向安全）· 无库内可查账 · 无 admin 登记控件 · 真人动作须人。门禁：contracts **29/240** · api **171/1048+3 skipped** · worker **50/225**。
- [落校准打分器的接线与来源三态](./issues/04-task-judge-scorer-wiring.md) — 新增 env `JUDGE_CALIB_SCORER`（`off` 默认 / `mock` / `http`）+ 报告 `judgeAurocSource`；判定加严为「值非 null ∧ ≥0.65 ∧ **来源 live** ∧ 有效对数 ≥`JUDGE_CALIB_MIN_CASES`(=100)」，三个 reason code 可分辨（保留 `judge_auroc_missing_or_below_min`，新增 `judge_auroc_source_not_live` / `judge_auroc_calib_too_small`）；新增 `eval/judge-scorer.ts`（复用 ask 的 judge prompt 与解析造真 Gateway 打分器）+ **go/no-go**：声明 `http` 而 Gateway 非 `http` → 拒（否则 mock Gateway 的分数会被标成 live，正是 PRD §6.1 禁的「mock 数字进签字包」），入口 exit 2。两侧**来源判别同构**（`judgeAurocSourceFor` 一份），**不硬造** worker 判定点。新增 **30** 条用例、改写 6 条（**无一条改期望值**）；反证 3 轮 **7** 条红。**`http` 路段结论：能做、已做**；缺的是**真值**（本机无 Gateway/密钥 + 夹具仍 8 条）→ 真实入口今天过不了规模门，这是 PRD §4 的如实拒绝。门禁：contracts **30/245** · api **172/1069+3 skipped** · worker **51/229**。
- [落 §8 可复现字段进 L1/L2 报告](./issues/05-task-repro-fields.md) — contracts 新增 `L1Repro`（14 键）+ 两条**稳定**哈希 `l1QuestionIdsHash`（题面 id 集合，内部升序）/ `l1CalibSetHash`（文件内容逐字节）；因 contracts 主入口会被 web/admin 客户端打包（`node:crypto` 进客户端图会让 Next 构建失败），哈希走**子路径导出** `@strict-rag/contracts/eval-repro`（与 `@strict-rag/ui/lib/utils` 同例），连带 contracts 加 `@types/node` devDependency。api `buildL1Repro`（`models` 取 env + KB 绑定 · `retrieveK` / `rerankTopN` / `tauClaim` / `contextMode`）+ 报告 `repro` 区块 + md 渲染（取不到写「—」）；worker 同形状但**只填 `questionIdsHash`**；`persist.ts` 白名单加键。**记债的 `null`**：`seed` · `fallbackChainsVersion` · `crag` · `contextMode` · `promptVersions` · `lifecycleFilterVersion` · `sessionStrategyVersion` · `l2GoldSetHash`（**不**拿源码文本哈希顶替）；`mode` **不进**区块（既有顶层 `mode` 是 `retrieve_mode` 别名，语义歧义记债）。新增 **20** 条用例；反证 4 轮 **7** 条红。门禁：contracts **31/254** · api **173/1076+3 skipped** · worker **52/233** · `pnpm install --frozen-lockfile` 通过 · web build 通过（证子路径导出未把 `node:crypto` 带进客户端图）。
- [回写镜像 / 覆盖表 / spec + 收口门禁](./issues/06-task-writeback.md) — 见下方「目的地达成」。

### 目的地达成（2026-09-23）

「一次 L1 run 凭什么能被签成业务 PASS」的证据面三缺已补齐到**可核对**：

1. **人工抽检拿到真实登记面与判据**：PRD §6 硬门「≥20 条，错 ≤1」从「两个没人读的常量」变成「文件账本 + CLI 入参 + 进 `businessPass`」，三个 reason code 可分辨缺测 / 条数不足 / 错超限；并已证「一份合法账本确能让该门变绿」——**不是空转闸**。
2. **Judge AUROC 拿到可达但不作假的路径**：来源三态由 env 声明、报告落 `judgeAurocSource`、**判定只认 live**；`http` 走真 Gateway 且有 go/no-go 拦住「声明 http 而 Gateway 是 mock」；PRD §4 的 ≥100 规模门进判定。**mock 与缺测都变不了绿**。
3. **§8 可复现字段落进报告**：14 键区块 + 两条稳定哈希；取不到的一律 `null`（**不许**编造、**不许**拿源码文本哈希顶替「版本」）。
4. **本条最该被记住的两句话**：① **默认配置下 `businessPass` 在生产路径上仍不可达**（打分器默认 `off` + 校准夹具 8 条）——这是**有意**的：本图给的是**可达的路径**，不是伪造的绿灯；② **PRD 的门限数字一个字未改**，改的是「有没有数据源 + 有没有真按它判」。

**证据**：`packages/contracts/tests/eval/human-spot-ledger.test.ts` · `l1-judge-calib-source.test.ts` · `l1-repro.test.ts` · `apps/api/tests/eval/human-spot-gate.test.ts` · `l1-human-spot-cli.test.ts` · `judge-auroc-source-gate.test.ts` · `l1-repro-fields.test.ts` · `apps/worker/tests/eval/run-l1-batch-human-spot.test.ts` · `run-l1-batch-judge-source.test.ts` · `run-l1-batch-repro.test.ts` · `fixtures/l1/human-spot.example.json`。反证共 **28** 条红（03 十四 · 04 七 · 05 七），还原后全绿。

**收口门禁（在最后一次提交之后复跑）**：`pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · `pnpm test` **11/11**（api **173 文件 / 1076 通过 + 3 skipped** · worker **52 / 233** · contracts **31 / 254** · admin 38 / 185 · web 19 / 56 · db 11 / 31 · admin-catalog 1 / 13；合计 1848 通过 + 3 skipped）· `pnpm check:module-status` **39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` **全空**。

**一条口径教训（主控复核时抓到，已修 6 处文本）**：「N 项硬门」在本仓有**两个可能口径** —— PRD §6 表的**硬行数（6）**与 `PILOT_HARD_GATES` 的**键数（7，人工抽检占两键）**；表内第 7 行「ask P95」标的是「建议」。凡用到这个数就必须把口径写出来。

**一条过程事实（供下次参考）**：`pnpm test` 全仓可在无并发下稳定 11/11；但**三包测试单独跑 api 一次 90s、contracts 5s、worker 20s**，与另一条测试命令并发会抢 CPU 造成假超时 —— 落地票一律串行。

## Not yet specified

> 本图已收口。下列是**收口后剩下的雾**，按「谁挡谁」分组，供下一张图挑一个当目的地。带（另图）的原样转给后续图，不是本图的欠账。

### A · 下一张图的首选：**L2 报告的可判定面**（本图三腿只做了 L1 侧，L2 侧整块空着）

- **L2 采集面丢了 `evidence_snapshot.docId`**：`apps/worker/src/eval/run-l2-batch.ts` 只取 evidence 的**文本**、`apps/api/src/scripts/run-l2-golden.ts` 只 `.map(e => e.text)` —— 于是「主题命中期望文档」与「合法 citation」**连判据的原料都没有**。研究票 01 已核过三处落点（含 `packages/contracts/src/eval/l2-matrix.ts` 的 `historyLeaked`）。
- **L2 四项零容忍只落了一项、且比 PRD 窄**：`near_coref` 之外的「主题粘连胡答 / 冲突场景跟错数字 / 合法路径跳过 verify」无机械判据；`historyLeaked` 只比对先前**用户**轮原文，上轮 **assistant** 文本进 evidence 不被抓，而 PRD 写的是「历史文本进 evidence」。
- **L2 侧 §8**：`L2 剧本集哈希` 与 `session 策略版本 / rewrite prompt 版本` 在 L2 报告里同样没有（本图第三节裁定「留给下一张图」，`L1Repro.l2GoldSetHash` 恒 `null`）。可否复用本图的哈希写法与子路径导出。
- **L2 报告要不要来源标记**：本图给 L1 落了 `judgeAurocSource` 三态；L2 侧今天没有任何来源/规模标记，`computeL2SignoffEligible` 的 `retrieveMode === 'live'` 是唯一一处。

### B · 本图裁定但未落地的（须先补数据源 / 基础设施或补人）

- **≥100 条真标注校准集**：`fixtures/l1/judge-calibration.json` 仍 8 条手写 seed；规模门已进判定，真语料与标注缺 → 真入口被如实拒绝。
- **真 judge live 跑数**：`http` 打分器已实现且有 go/no-go，但本机无 Gateway / 密钥 → 「真值」仍缺。销账 = 一次真 live 校准跑 + 归档。
- **人工抽检的库内可查账与 admin 登记控件**：本图按「无生产者不建 HTTP」裁掉了端点，且本机无浏览器 → 现在只有文件账本 + CLI；销账 = 有 admin 控件时再补端点与查询面。
- **worker 生产路径不传抽检账本**：`handleEvalJob` 无账本路径 → worker 跑批 `humanSpot` 恒 `null`（方向安全但不可用）。销账 = 消费者按 run 提供路径并透传 `humanSpotPath`。
- **worker 侧 `repro` 分项不足**：`models` / 档位预算 / `tauClaim` / 校准集哈希在 worker 取不到（已记债）；销账 = 内口回传档位 + worker 侧校准集路径。
- **`repro` 未透出 DTO**：`…/eval/runs` 看不到该区块（本图刻意不扩契约面）。销账 = 同步 `EvalRunSchema` 与 `toEvalRunDto`（`.strict()`，漏一处就抛）。
- **§8 的「版本载体」类字段**：`seed` / `fallbackChainsVersion` / `promptVersions` / `lifecycleFilterVersion` / `sessionStrategyVersion` 在 L1 报告里恒 `null`。销账二选一：引入版本常量载体，或 PRD 明确「版本」的载体是什么。**禁止**拿源码文本哈希顶替（会随任意重构噪声跳变，形似而非语义）。
- **§8 的 `mode` / `contextMode` 语义歧义**：既有顶层 `mode` 是 `retrieve_mode` 的历史别名，不是 ask 档位；§8 同时列了 `mode` 与 `contextMode`，须 PRD 澄清指哪个。
- **校准集哈希逐字节、不做行尾归一**：CRLF 检出会让同内容不同值（本轮已知、已记债）；销账 = 裁一个规范化口径。

### C · 相邻未做（与本图同域但更远）

- **`§6.0`「运行时质量参数仅来自已签字包；不一致 → 拒绝加载」**：与 ADR-007「`TAU_CLAIM` 唯一源」直接冲突 → 属**改冻结语义**，须 ADR → 改 PRD → 升版。本图列进 Out of scope，留给专门的图。
- **`check:module-status` 的 `5-表` / `3-符号` 误报**：`docs/module-status/*.md` 里给裸标识符加反引号可能被误报 —— 本轮踩到两次：给 `null` 加反引号 → `5-表` 按「表」上下文报成表名；给「只导出自 `apps/api/src/eval/adr046-snapshot.ts`、未上任何包导出面」的常量名加反引号 → `3-符号` 报「关联包导出中不存在」。销账 = 加黑名单或改判据，属工具债。
- **`§6` 表内第 7 行「ask P95 strict ≤20s」**：标的是「建议→业务可升硬」，今天既无数据源也无判据；升硬须业务决定。

## Out of scope

- **真模型 live 跑数与真 judge 打分**：不能离线核对，只做到「纯函数级可断言 + 路径可走通」。
- **人签**（业务 R + 产品 A）：本图只保证「人签前该有的证据在」，不代签。
- **改 `prds/00–11` 已冻语义**：包括给 §6 硬门表加行、改任何门限数字、改 §4 的 ≥100 规模。
- **`§6.0` 运行时从签字包加载 τ**：与 ADR-007「`TAU_CLAIM` 唯一源」冲突，属改冻结语义（须 ADR → 改 PRD → 升版）；本图**不碰**，留给专门的图。
- **改仓库默认开关**；**admin / web 的视觉与交互改动**（本机无浏览器验证手段）。
- **QUAL-2 真杀毒 / B8 真 ES+IK / B9 真 RustFS**：本机无基础设施，且已被 DEC-SCAN 等裁定为延期债。
- **P2.5 准出 / 永久关二元出口 / P3a**：须 L2 归档 + 人签；本图不进入。
