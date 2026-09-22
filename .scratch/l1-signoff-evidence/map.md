# L1 签字证据面的补齐（人工抽检 · 校准打分器 · 可复现字段）

Label: wayfinder:map
Status: open（前沿：工单 03 · 04 · 05 三张落地票）

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

## Not yet specified

> 前沿之外、仍在本图方向上的雾。随前沿推进逐块变清，够锐利了才升成工单。

- **「错」怎么算**：人工抽检的「错 ≤1」是「answerable 被拒」算错、「unanswerable 被答」算错、还是「引用不指向期望文档」也算错？须先定口径，否则登记面没法建。→ 预计在裁定票里定。
- **抽检样本怎么选**：随机抽 / 按类型分层抽 / 从 `eval_runs` 的 2×2 格子里抽？PRD 没写，属实现选择。→ 裁定票。
- **新表还是报告字段**：抽检结果进 `eval_runs.report_json`（复用既有白名单）还是新表（可多轮次累积）？两条路的可审计性不同。→ 裁定票。
- **校准集扩到 ≥100 的数据从哪来**：`fixtures/l1/judge-calibration.json` 是 `claim` + `evidence` + `supported|unsupported` 的手写 seed，扩集需要真实语料与标注。没真语料前能做的只有「解析器与规模门如实拒绝小集」。→ 须先看清「没有真数据时有几件事是能做的」。
- **打分器的来源判别怎么做**：live / mock / 缺测三态该由 env 声明、由 Gateway 回包声明，还是由调用方显式传入？与「不改仓库默认开关」的边界在哪。→ 裁定票。
- **§8 字段里有哪些今天根本取不到**：`fallbackChains 版本` / `promptVersions` / `session 策略版本` 依赖配置侧有没有稳定的版本载体；取不到的必须**记债**而不是编一个假哈希。→ 研究票先看清。
- **L2 侧要不要同一套**：§8 也覆盖「session 策略版本 / L2 剧本集哈希」，L2 报告今天同样没有。是否与本图同批落地、还是留给下一张图。→ 研究票后定。

## Out of scope

- **真模型 live 跑数与真 judge 打分**：不能离线核对，只做到「纯函数级可断言 + 路径可走通」。
- **人签**（业务 R + 产品 A）：本图只保证「人签前该有的证据在」，不代签。
- **改 `prds/00–11` 已冻语义**：包括给 §6 硬门表加行、改任何门限数字、改 §4 的 ≥100 规模。
- **`§6.0` 运行时从签字包加载 τ**：与 ADR-007「`TAU_CLAIM` 唯一源」冲突，属改冻结语义（须 ADR → 改 PRD → 升版）；本图**不碰**，留给专门的图。
- **改仓库默认开关**；**admin / web 的视觉与交互改动**（本机无浏览器验证手段）。
- **QUAL-2 真杀毒 / B8 真 ES+IK / B9 真 RustFS**：本机无基础设施，且已被 DEC-SCAN 等裁定为延期债。
- **P2.5 准出 / 永久关二元出口 / P3a**：须 L2 归档 + 人签；本图不进入。
