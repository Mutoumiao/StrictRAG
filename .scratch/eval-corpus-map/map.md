# 让 L1 硬门 Hit@20 可实测（评测语料入库 + 逻辑 id 映射）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 · 04 · 05 · 06 全收口）

## Destination

把 **PRD 冻结的 L1 硬门「Hit@20 ≥ 70%（有标注时）」从「结构性必失败」变成「可真测」** —— 具体做到：

1. **评测语料有仓内可重复的入库入口**：`fixtures/ingest-samples/*.txt`（L1 的 10 个逻辑 id）与 `fixtures/l2/corpus/*.txt`（L2 的 3 个逻辑 id）能被一条有文档、可重复的命令真正送入某个 KB，并**产出可核对的「逻辑 id → `documents.id`」映射账本**（含 KB / 租户 / 生成时刻 / 语料指纹，供人核对与失效判断）。
2. **跑批侧按账本解析**：L1（必需）与 L2（同构）批跑在读 `expectedDocIds` 时按账本解析成当前 KB 的 uuid，`hitAtKCase` 比的是**真 uuid**，不再是「逻辑 id vs uuid 必然不中」；报告里如实标注**映射来源**（有账本 / 无账本）。
3. **未映射时仍然响亮**：没有账本或账本里缺某个逻辑 id 时，行为必须是**逐位保持今天的语义**（不中 = 记 miss，绝不变成 `null`）—— **不许**把「缺映射」偷换成「该门不适用」。
4. **一条真栈实测记录**：在本机 Docker 真栈上跑通「入库 → 带账本跑 L1 CLI」，把实测到的 `hitAtK`（`hits/scored`）与 `hit_at_k_below_min` 是否仍出现如实写进仓内证据文（**带 mock 模式的显式标注**，不当签字数字）。

**判据线**：PRD §3 / §6 把 Hit@20 写成硬门（**已冻**），代码侧也已把它接进 ADR-046 判定（`evaluateAdr046Bind` 的 `hitAtKOk` 进 `businessPass`）—— 缺的**不是门，是数据面**：语料没入库入口、逻辑 id 没映射面。故本图**不开新门、不改门限**，只把数据面补齐，让既有的门能算出一个真数字。

**成功长什么样**：拿一个真跑过的 KB，跑一次 L1 CLI 之后 —— ① `expectedDocIds` 能被解析为库内真实 uuid（可逐条核对）；② 报告里的 `hitAtK` 是 `hits/scored` 的真比值，且能解释每一条 miss（是「没映射」还是「检索没召回」）；③ 若把映射拿掉，行为与今天逐位一致（反证）；④ `prds/00–11`、`fixtures/` 的数据文件、任何门限数字**一个字未改**。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：本图是 [`l2-report-determinability`](../l2-report-determinability/map.md) `Not yet specified` **A 段**（「逻辑 id → `documents.id` 映射」）的执行图 —— 那段写着「销账需要：给 L2 语料一个入库入口 + 一张可核对的『逻辑 id → 当前 KB uuid』映射面（L1 侧一起）。属**数据工程**，要真 PG，非离线可补」。**本图的前提变化**：前图 [`real-stack-evidence`](../real-stack-evidence/map.md) 已证明本机 **Docker Desktop 可用**（该前提不成立时本图不成立）。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` §3 / §6 · `fixtures/l1/README.md` · `fixtures/l2/README.md` · `apps/api/src/eval/adr046-snapshot.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `apps/api/src/scripts/run-l2-golden.ts` · `scripts/demo-ingest.mjs` · `docs/ops/operable-stack.md` · `docs/ops/real-stack-evidence.md` · 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**：工单可直接改代码、补测例、回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`，且**不得与他人并发跑**（前图实测：并发抢 CPU 会让 web 包超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**。
- **质量红线不放宽**：门禁只加严（ADR-046）；**mock 数字禁进签字包**（PRD §6.1 / ADR-061）；本图所有改动必须是**收紧或逐位等价**。
- **本图特有的「不许」**：
  - **不许**把「缺映射 / 未映射」变成 `null`。`evaluateAdr046Bind` 里 `hitAtK == null` 的语义是 **PRD 的「有标注时」** —— 拿它当缺映射的出口，等于把一道硬门改成常开 = **放宽**。未映射只能**继续算 miss**。
  - **不许**改 `fixtures/` 的**数据文件**（`l1/gold.yaml` · `l2/gold.yaml` · `l2/corpus/*` · `judge-calibration.json` · `human-spot.example.json`）—— 逻辑 id 就是夹具的契约，映射要**在夹具之外**建立。两份 `README.md` 可改（前图先例）。
  - **不许**改任何门限数字（`PILOT_HARD_GATES` 六个键一字不动），**不许**动 `computeSignoffEligible`。
  - **不许**做模糊 / 子串 / 前缀匹配或「按标题猜」的启发式命中 —— 只认账本里的精确 uuid（trim 后全等）。
  - **不许**把 mock 模式的实测数字写成「Hit@20 达标」；报告与证据文必须写清 `retrieve_mode`。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**，也不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（三条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空（基线 **39 条 = 2 env + 13 符号 + 24 表**）；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）；③ 镜像/覆盖表里的加式必须**用脚本按行机械核**。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图；真模型 live 跑数 / 人签也不在。**Docker Desktop 在本机可用**（前图已验证），故真 PG / 真栈真跑**在本图范围内**。

### 开工基线（2026-09-29 · 逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| PRD 硬门原文 | `prds/08-quality/02-evaluation-and-gates.md` §3「Hit@k \| Top-k evidence 命中任一 expectedDocIds \| **有标注则硬门**（试点默认 k=20，≥70%）」；§6 门禁包表「Hit@20 \| ≥ 70%（有标注时） \| 硬」 |
| 门限常量 | `apps/api/src/eval/adr046-snapshot.ts:27` `hitAt20Min: 0.7`（`PILOT_HARD_GATES`） |
| 门怎么用的 | 同文件 `:216` `const hitAtKOk = input.hitAtK == null \|\| input.hitAtK >= gates.hitAt20Min;`（`:217` 不过则 `reasons.push('hit_at_k_below_min')`）；`:250-259` 的 `businessPass` 含 `hitAtKOk` |
| 数字怎么来的 | `apps/api/src/scripts/run-l1-golden.ts:669` `hitAtKCase(c.expectedDocIds, evidenceDocIds)` → `:723` `hitAtK: hitAtKRate(hitAcc)` → `:783` `hitAtK: report.hitAtK` 进 `bindQualitySnapshotToEval` |
| 比的两种 id | 期望侧 = 夹具**逻辑 id**（`packages/contracts/src/eval/l1-matrix.ts:111-127` 只做 trim 后**字符串全等**）；实测侧 = `result.graph.evidence_snapshot[].docId`（`run-l1-golden.ts:660-662`）= `documents.id`（uuid v7） |
| 夹具实况 | `fixtures/l1/gold.yaml` **60 条** case，其中 **30 条**（answerable 类）带 `expectedDocIds`（30 处引用、去重 **10 个逻辑 id**：`ingest-samples/01-doc` … `10-doc`）；`fixtures/l2/gold.yaml` **18 条**、**全部**带（25 处引用、去重 **6 个逻辑 id**：`ingest-samples/01..03-doc` + `l2-corpus/{travel-stay,meal-allowance,leave-policy}`）。**两侧有 3 个 id 交叉**（`01..03-doc`），但 L1 / L2 是两个独立 KB env → 账本按 **KB** 分辨 |
| 映射面 | **不存在**：全仓无 `external_id` / 映射文件 / env / 表（`external_id` 字样只在说明性文字里出现：`fixtures/l2/README.md` · `docs/module-status/{api,worker}.md` · `run-l2-golden.ts` 注释）；只有 `fixtures/l1/README.md`（「live 跑批前请按本表把 gold 中逻辑 id **替换/映射** 为当前 KB 内文档 uuid」）与 `fixtures/l2/README.md` 的**人工纪律** |
| 语料入库入口 | `scripts/demo-ingest.mjs` **只吃** `fixtures/ingest-samples`（`:34` `FIXTURES_DIR`）；它**已经**从 upload-url 回包拿到真 `docId`（`:131-132` 解构、`:152` `docIds.push(docId)`、`:153` 打印 `enqueued <title> → <docId>`），但**每跑新建一个 KB**（`demo-kb-${Date.now()}`，`:115`）且**不落任何映射文件** → 映射随跑次蒸发。`fixtures/l2/corpus/*` 三篇**从未入库且无入口** |
| 结构性后果 | `hitAcc.scored = 30`（60 题里 30 题带标注；另 30 题 `parseExpectedDocIds → null` 不计分）→ `hitAtK = 0/30 = 0`（**非 null**）→ `0 >= 0.7` 假 → `hit_at_k_below_min` → **`businessPass` 恒 false**。**这是数据工程缺口，不是检索质量差**，且**与是否 live 无关**（真模型也救不回没映射的 id）。`hitAtK == null`（该门不适用）在**默认夹具下不可达** |
| 前图已裁定、本图不动 | 「命中期望文档」**不进** `computeL2SignoffEligible`（L2 侧只落报告）；`docHitRate` 未映射恒 0 是 L2 侧今天的正确取值 —— 本图**只**补映射数据面，**不改**任何一处的判定公式 |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 研究：评测语料入库与逻辑 id 映射的现状面](./issues/01-research-corpus-map-surface.md) — 正文 [`research/01-corpus-map-surface.md`](./research/01-corpus-map-surface.md)。要点：**修正地图口径** —— L1 带标注题是 **30/60**（`hitAtKScored = 30`、`hitAtK = 0/30 = 0` 非 null），恒 0 链逐跳成立、结论不变；L1 去重 10 个逻辑 id / L2 去重 6 个（交叉 3 个）→ **账本按 KB 分辨**；`demo-ingest.mjs` 已能拿到真 `docId` 但每跑新建 KB、不落映射、不吃 `fixtures/l2/corpus`；**报告无现成槽位承载「映射来源」→ 必须新增键**（L1 落库 api 侧整对象直落、worker 侧逐键白名单，漏键静默丢）；`hitAtK == null` 今天默认**不可达**（缺映射必然是 scored>0 且 hits=0 = 记 miss）；回归面清单已列（L1 三处字面量报告 · `l1-repro` 精确键集 · worker 白名单 · turbo env · md 渲染断言）。**未核实**：真栈实测数字（留给工单 05）。
- [02 · 裁定：账本形状 / 解析落点 / 未映射行为 / 新鲜度](./issues/02-dec-map-shape-and-resolver.md) — 六组裁定：① **一份账本 = 一个 KB**，落 `artifacts/eval-corpus-ledger-<kbId>.json`（运行产物不入库），形状（`version` / `kbId` / `tenantId` / `generatedAt` / `corpusFingerprint` / `entries[{logicalId,docId,title,sourceFile,sourceSha256}]`）由 `packages/contracts/src/eval/corpus-ledger.ts` **子路径导出**唯一锚住；② 入库入口 = **新增 TS CLI** `apps/api/src/scripts/ingest-eval-corpus.ts`（不动 `demo-ingest.mjs`），解析落点 = **跑批 CLI 内、`hitAtKCase` 之前**，参数走 **env**（`L1_DOC_MAP`/`L2_DOC_MAP`）；③ 未映射**继续算 miss**（**绝不变成 `null`**），`kbId`/指纹不符或账本不可解析 → **拒跑 exit 2**，报告加顶层三键 `docMapSource`/`docMapResolved`/`docMapUnmappedIds` 且**都不进判定**；④ 新鲜度 = `kbId` 全等 ∧ `corpusFingerprint` 全等，「docId 还在不在库内」不做运行时校验（记雾）；⑤ L2 一起接但**不进判定**；⑥ 新增配置键若进 module-status 正文须同步加黑名单以守基线 39 条。
- [03 · 落「评测语料入库入口 + 可核对映射账本」](./issues/03-task-corpus-ingest-and-ledger.md) — 契约 `packages/contracts/src/eval/corpus-ledger.ts`（子路径 `@strict-rag/contracts/eval-corpus-ledger`，`node:crypto` 不进主入口）+ 入库 CLI `apps/api/src/scripts/ingest-eval-corpus.ts`（13 篇语料 → 账本，逻辑 id 由目录结构派生，缺 docId 点名抛错）。**只在真跑才现形的缺陷已当场修**：CLI 全步带 token → 同一身份上传并审批会撞 **ADR-048 #4 四眼闸**（403 `self_approve_forbidden`），改双身份 + 首篇自审探针（非 403 即失败）；`demo-ingest.mjs` 无此坑（approve 不带 token → 无 actor）。边界：`AUTH_ENFORCE=true` 时审批人须为 KB 成员。测例 contracts 15 + api 23（含四眼 3）；反证 4 轮。
- [04 · 落「跑批侧按账本解析 + 报告来源标记」](./issues/04-task-resolver-and-report-source.md) — `L1_DOC_MAP` / `L2_DOC_MAP`（已登记 `turbo.json`）：不设 → **与今天逐位一致**（有实证）；设了 → 校验 `kbId` + 语料指纹，不符 `exit 2`；解析落在 `hitAtKCase` 之前，缺映射原样保留。报告顶层三键（L1/L2 同形）不进任何判定；worker 两个落库白名单同步加键（常量 `none/0/[]`，因 run-batch 按裁定不改）。修好研究列出的全部回归面（三处字面量报告 / `sampleReport` / md 断言），**未**用 `as any` / `@ts-ignore`。
- [05 · 真栈真跑：入库 → 带账本跑 L1 → 实测 Hit@20](./issues/05-task-real-stack-hit20.md) — 取证 [`research/05-real-stack-hit20.md`](./research/05-real-stack-hit20.md)。真栈五服务 healthy；13 篇语料入库并激活；账本 13 条。**同夹具同 KB 对照：不带账本 `hitAtK = 0/30`；带账本 `30/30`（`docMapSource=ledger`、`docMapResolved=10`、`unmapped=[]`）**；ADR-046 裁决的 `hit_at_k_below_min` 在带账本那跑**消失**，其余阻塞方（`coverage_zero_or_null` · `judge_auroc_*` · `human_spot_missing` · 四要素 · `internal_guard`）**一条未动** → `businessPass` 两跑都仍 false。**不是签字数字**（mock 向量 8 维 / mock chat / 无 IK / 60 题全 `abstained`）。环境事实：Docker Desktop **第 3 次自退**，其中一次落在两跑之间 → 那跑 60 条全 `error`（`Failed query … "documents"`），**机制诚实**（`errorCount=60` 而非假绿），重启后原样重跑得 `errorCount=0`。
- [06 · 回写 + 收口门禁](./issues/06-task-writeback-close.md) — 回写 ops 配方与证据文（§7）/ 两份 fixtures README / module-status（api 真跑段 + contracts + worker）/ 覆盖表（C4 + L2 缺口列改写、**覆盖值一律不动**）/ coverage.md 第十一轮 / `.trellis/spec` HOW / 雾清单；对抗性反向复核 5 条逐条核过。门禁：`check-types` 8/8 · `lint` 8/8 零 warning · `pnpm run test --concurrency=1` **11/11**（api **181** 文件 / **1134** 通过）· `check:module-status` **39 条**（`1/6/7` 全空）· 工作区干净。

### 目的地达成（2026-09-29）

**「让 L1 硬门 Hit@20 从结构性必失败变成可真测」已达成**：

1. **数据面补齐**：13 篇评测语料有仓内可重复的入库入口（`ingest-eval-corpus.ts`），产出**可核对**的映射账本（`kbId` + 语料指纹 + 逐条 `logicalId → docId/title/sourceSha256`，落 `artifacts/` 不入库）；形状与解析口径由 contracts 一份子路径契约锚住。
2. **跑批侧接上**：`L1_DOC_MAP` / `L2_DOC_MAP` 在比对前解析；**不传 = 逐位同今天**（有实证与测例）；账本与本次 KB 或当前夹具不符 → **exit 2 拒跑**；缺映射**继续算 miss**，**绝不**变成 `null`。
3. **真栈实测**：`hitAtK` 从 `0/30` 到 `30/30`，硬门裁决的 `hit_at_k_below_min` 消失 —— 这道 PRD 冻结的门第一次算出了真数字。**门限与公式一个字未改**。
4. **诚实边界**：`businessPass` 仍 false（其余阻塞方一条未动，且都非本图能代）；向量/chat 仍 mock、无 IK，故实测值**不是签字数字**；worker 侧批跑按裁定未接账本。
5. **该被记住的三句话**：① **恒 0 不是检索差，是没得量** —— 夹具写逻辑 id、实测是 uuid，缺的是数据面；② **补数据 ≠ 降门** —— 未映射继续算 miss 是这条改动的底线，把缺失写成「该门不适用」等于把 PRD「有标注则硬门」改成常开；③ **真跑仍在教东西** —— 四眼闸这一处缺陷（同身份自审 403）与 Docker 自退，都只在真跑里现形，mock 与单测都测不出来。

**提交（本地，未 push）**：`51108e6` 契约 · `fd212fd` 入库 CLI · `250416f` 跑批接线 · `4799f7d` 文档回写 · `d7c5611` 工单 03/04 收口 · `a214e52`/`92f476d` 立图与 01/02 收口，以及本图收口的最后一笔。

## Not yet specified

<!-- 收口后剩下的雾，按「谁挡谁」分组，供下一张图挑一个当目的地 -->

本图已收口。下列是**收口后剩下的雾**（带（另图）的原样转给后续图，不是本图的欠账）。

### A · 本图显式划出的（同一数据工程缺口的其它表现）

- **worker 侧批跑不接账本**：`apps/worker/src/eval/run-l1-batch.ts` 与 `run-l2-batch.ts` 仍在 `hitAtKCase` 处直比逻辑 id → 其 Hit@k / docHit 仍**恒 0**。**今天不构成假绿**（两处都不进任何判定，落库白名单也只是常量 `none/0/[]`），但「同一个数字在两处含义不同」本身就是坑。销账要先裁：worker 侧的账本从哪来（env？同请求下发？）、落库形状是否与 api 侧同构（`saveReport` / `saveL2Report` 是逐键白名单，漏键静默丢）。
- **账本 ↔ 库内文档不做运行时对账**：本图只机械校验 `kbId` 与**夹具指纹**两项；「账本里的 docId 是否还在库里」由人用 `GET /knowledge-bases/:kbId/documents`（全量、无分页）比对 `id` + `title`。候选销账两条：给 eval CLI 加一次库内存在性校验（会引入 DB 读、扩大回归面），或给列表项补 `createdAt` / `checksumSha256`（契约变更）。
- **`hitAtK` 的 k 语义**（承 `quality-gate-parity` 簇 29）：k = rerank 后进 verify 的集合长度（balanced 恰 20、fast 为 10 → 更严），与 PRD「检索 Top-k」不是同一集合 —— 本图**未碰**。

### B · 本图实测反证「门能算」≠「门能过」的部分

- **L2 侧的真跑与准出**（簇 7）：`docHitRate` 现在**可以真测**（`L2_DOC_MAP` 已接、有测例），但本机没跑真 L2 批跑；L2 准出仍须 live 真跑归档 + RACI 人签，且四项零容忍 5 处去处只有 1 处机械判。
- **其余五道 L1 硬门的真值**：`coverage`（需真 Gateway：mock chat 让 60 题全 `abstained`）· `judgeAuroc`（需 live 打分器 + ≥100 真标注校准集）· `humanSpot`（须人）· 四要素（须业务提案与人签）。本图把 `hitAtK` 从「不可能」变成「可能」，其余五道**仍不可能**。
- **簇 39（dev-only 桩 Gateway 是否允许）**：本图的实测再次把它顶到台前 —— 没有真 Gateway，覆盖率恒 0、`abstained × 60`。要不要为「无 key 机器」提供 dev-only 桩，仍是**产品决定**（前图已记为雾，本图不擅自建）。

### C · 本机环境事实（非仓库缺陷，但会打断真跑）

- **Docker Desktop 反复自行退出**（本轮第 3 次）。后果：长跑批跑若撞上，整批 case 记 `error`。**不需要改代码**（机制诚实），但「真栈证据」类工作要预留重启与重跑的时间预算，且**必须**把故障那一跑留痕。

### D · 与前图同一批的其它口子（原样转，未动）

- 簇 **8**（`CorpusLoader` 未传 `tenantId`）· 簇 **11**（`loadVisibilityContext` 请求级缓存）· 簇 **13**（`kb_members.role` 完整性债）· 簇 **22**（`drizzle/meta` 类型/默认值级人工走查）· 簇 **31 余量**（覆盖表剩余 **59** 行 `部分测`）· 簇 **32**（`/prds` 与 `.trellis/tasks/` 不在版本库）。

## Out of scope

- **真人抽检账本**（PRD §6「≥20 条，错 ≤1」）：登记面已落，抽检动作须人 —— 非本机可代。
- **≥100 条真标注校准集**与 **live judge 真跑**：须真语料 + 真标注 + 真 Gateway key。
- **真模型 live 跑数 / 人签**：不代签；本图只保证「门能算出真数字」，**不**宣称 Hit@20 达标。
- **改 `prds/00–11` 已冻语义**（含任何门限数字）：须 ADR → 改 PRD → 升版。
- **改仓库默认开关**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **B8 真 ES+IK / 多租户独立索引 / B9 真 RustFS / QUAL-2 真杀毒**：前图已裁，不在本图。
- **P2.5 准出 / 永久关二元出口 / P3a Full 图**：须 L2 归档 + 人签。
