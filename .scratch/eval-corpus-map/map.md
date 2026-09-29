# 让 L1 硬门 Hit@20 可实测（评测语料入库 + 逻辑 id 映射）

Label: wayfinder:map
Status: open（前沿：01）

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
| 比的两种 id | 期望侧 = 夹具**逻辑 id**（`packages/contracts/src/eval/l1-matrix.ts:107-126` 只做 trim 后**字符串全等**）；实测侧 = `result.graph.evidence_snapshot[].docId`（`run-l1-golden.ts:660-662`）= `documents.id`（uuid v7） |
| 夹具实况 | `fixtures/l1/gold.yaml` **60 条** case、**全部**带 `expectedDocIds`、去重 **10 个逻辑 id**（`ingest-samples/01-doc` … `10-doc`）；`fixtures/l2/gold.yaml` **18 条**、**全部**带、去重 **6 个逻辑 id**（`ingest-samples/01..03-doc` + `l2-corpus/{travel-stay,meal-allowance,leave-policy}`） |
| 映射面 | **不存在**：全仓无 `external_id` / 映射文件 / env / 表（`git grep` 只在 `.scratch/` 命中讨论文字）；只有 `fixtures/l1/README.md`（「live 跑批前请按本表把 gold 中逻辑 id **替换/映射** 为当前 KB 内文档 uuid」）与 `fixtures/l2/README.md` 的**人工纪律** |
| 语料入库入口 | `scripts/demo-ingest.mjs` **只吃** `fixtures/ingest-samples`（`:34` `FIXTURES_DIR`）；它**已经**从 upload-url 回包拿到真 `docId`（`:131-132` 解构、`:152` `docIds.push(docId)`、`:153` 打印 `enqueued <title> → <docId>`），但**每跑新建一个 KB**（`demo-kb-${Date.now()}`，`:115`）且**不落任何映射文件** → 映射随跑次蒸发。`fixtures/l2/corpus/*` 三篇**从未入库且无入口** |
| 结构性后果 | `hitAcc.scored = 60`（题题有标注）→ `hitAtK = 0/60 = 0`（**非 null**）→ `0 >= 0.7` 假 → `hit_at_k_below_min` → **`businessPass` 恒 false**。**这是数据工程缺口，不是检索质量差**，且**与是否 live 无关**（真模型也救不回没映射的 id） |
| 前图已裁定、本图不动 | 「命中期望文档」**不进** `computeL2SignoffEligible`（L2 侧只落报告）；`docHitRate` 未映射恒 0 是 L2 侧今天的正确取值 —— 本图**只**补映射数据面，**不改**任何一处的判定公式 |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

## Not yet specified

<!-- 收口后剩下的雾，按「谁挡谁」分组，供下一张图挑一个当目的地 -->

## Out of scope

- **真人抽检账本**（PRD §6「≥20 条，错 ≤1」）：登记面已落，抽检动作须人 —— 非本机可代。
- **≥100 条真标注校准集**与 **live judge 真跑**：须真语料 + 真标注 + 真 Gateway key。
- **真模型 live 跑数 / 人签**：不代签；本图只保证「门能算出真数字」，**不**宣称 Hit@20 达标。
- **改 `prds/00–11` 已冻语义**（含任何门限数字）：须 ADR → 改 PRD → 升版。
- **改仓库默认开关**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **B8 真 ES+IK / 多租户独立索引 / B9 真 RustFS / QUAL-2 真杀毒**：前图已裁，不在本图。
- **P2.5 准出 / 永久关二元出口 / P3a Full 图**：须 L2 归档 + 人签。
