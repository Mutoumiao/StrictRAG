# 让评测跑批的输入事实基线在两条入口上同一且可检测

Label: wayfinder:map
Status: open（前沿：工单 01）

## Destination

把评测跑批（L1 黄金集）的**输入**拉回到同一条事实基线上，让「两条入口跑的到底是不是同一件事」从**默认可分歧**变成**可检测**。到达时同时满足三件：

1. **账本 ↔ 库内文档存在性可检测**：账本每条 `logicalId → docId` 在跑批前与当前 KB 的 `documents` 对账；账本指向**已不存在**的文档（或标题漂移）时**响亮失败**，不再静默产生一批假 miss。落点在共享层（contracts 子路径），两条入口**一起接**，不许单侧加一道新的不对称。
2. **两条入口的题源差异被裁定并落地**：今天 api CLI 读文件 `fixtures/l1/gold.yaml`、worker 队列读 DB 表 `gold_questions` —— 两侧的**题集可以不同**，而报告与门禁都只说「Hit@k」。裁定「以谁为准」，并把「两侧题集不同」变成**可检测信号**（或收敛到单一题源）。
3. **报告/契约的映射来源三键定案**：`EvalRunSchema` 的 `docMapSource` / `docMapResolved` / `docMapUnmappedIds` 今天为**可选**（为兼容历史行）。裁定「收紧为必填并回填」或「明示保持可选并写明理由」，不留模糊。

三者是同一件事的三面：**跑批的输入必须是可核对的事实**。**不**改任何门限数字、不改判定公式、不改 `prds/00–11`、不放宽或收紧任何仓库默认开关、不代签。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（当前 0.4.33 编排 / 0.4.32 语义）为准；**IS 以源码为准**，`docs/module-status/` 是它的镜像，`docs/testing/coverage/` 是派生对照表。
- **前图**：[`eval-ledger-parity`](../eval-ledger-parity/map.md)（6/6 已收口，前沿为空）。本图挑的是它 `Not yet specified` **A 段三条**（同一数据工程缺口的其它表现）。前图把「同一个数字在两处含义不同」销掉；本图销的是「**同一个数字底下是不是同一份输入**」。
- **本图立的判据线**：`hitAtK` 这个数字要可信，前提是**输入侧**先可信 —— 账本指向的文档真在库里、两条入口跑的是同一题集。输入不可检时，数字「看起来正常」本身就是坑（结构性假零 / 结构性假高）。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` §3 / §6 · `packages/contracts/src/eval/corpus-ledger.ts` · `packages/contracts/src/eval/corpus-ledger-file.ts` · `packages/contracts/src/eval/eval-run.contract.ts` · `apps/api/src/scripts/{run-l1-golden,ingest-eval-corpus}.ts` · `apps/api/src/eval/corpus-map.ts` · `apps/worker/src/eval/{consumer,persist,run-l1-batch}.ts` · `docs/ops/{operable-stack,real-stack-evidence}.md`。写代码前读 `.trellis/spec/` 对应包（`api/backend/l1-eval.md` · `worker` 包 index · `packages/contracts` index）。
- **本图携带执行**：工单可直接改代码、补测例、回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test --concurrency=1`（前图实测：并发抢 CPU 会让 web 包超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**；**不改任何门限数字**（`PILOT_HARD_GATES` 六键一字不动）；**不动** `computeSignoffEligible` / `computeL2SignoffEligible` / `evaluateAdr046Bind` / `hitAtKCase` 本体。
- **本图特有的「不许」**：
  - **不许**把「账本对不上库」降级成「无账本」或「该门不适用」：对不上必须**响亮失败**（与 `CorpusLedgerError` 同族），两者混成一个出口 = 把一道新鲜的闸改常开。
  - **不许**在 worker 侧另写一套账本 / 对账逻辑 —— 复用 `@strict-rag/contracts/eval-corpus-ledger` 与 `eval-corpus-ledger-file` 子路径。
  - **不许**把「缺映射 / 未映射」变成 `null`（`hitAtK == null` 的语义是 PRD 的「有标注时」）。
  - **不许**改 `fixtures/` 的**数据文件**（两份 `README.md` 可改）。
  - **不许**做模糊 / 子串 / 前缀匹配 —— 只认账本里的精确 uuid。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**，也不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（三条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）；③ 镜像/覆盖表里的加式必须**用脚本按行机械核**。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图；真模型 live 跑数 / 人签也不在。**Docker Desktop 在本机可用**（前两张图已验证真栈真跑），真跑要预留重启与重跑预算，故障那一跑**必须留痕**。

### 开工基线（2026-09-30 · 逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| 账本契约 | `packages/contracts/src/eval/corpus-ledger.ts`：`CORPUS_LEDGER_VERSION = 1`；条目五键 `logicalId` / `docId` / `title` / `sourceFile` / `sourceSha256`；`parseCorpusLedger` 只机械校验形状 + 版号 + 指纹自洽，**不碰库** |
| 账本读取与新鲜度 | `packages/contracts/src/eval/corpus-ledger-file.ts`：`resolveCorpusLedgerForRun` 只校验 `kbId` 全等 ∧ `corpusFingerprint` 全等（对当前夹具重算），**不校验 docId 是否还在库**（文件头注释自陈「改由人工对账，裁定 4 显式划出」） |
| api 侧账本落点 | `apps/api/src/eval/corpus-map.ts` 是**纯 re-export**；CLI 侧解析点在 `apps/api/src/scripts/run-l1-golden.ts` |
| worker 侧账本落点 | `apps/worker/src/eval/consumer.ts` 的 `docMapPathOf` 判未设置，每次 job 重读；`run-l1-batch.ts` 在 `hitAtKCase` **之前**解析 |
| **题源（关键分歧）** | api CLI：`run-l1-golden.ts` 的 `defaultGoldPath()` → `fixtures/l1/gold.yaml`（文件）；worker 队列：`apps/worker/src/eval/consumer.ts` 的 `persist.loadGold(job.kbId)` → DB 表 `gold_questions`。**两侧题集可以不同，无任何检测** |
| worker 侧已有 DB 句柄 | `apps/worker/src/eval/persist.ts` 持 `getDb()` 并已 `loadGold` / `saveReport` —— 对账所需的库读**已在 worker 进程内** |
| api 侧已有 DB 句柄 | `run-l1-golden.ts` 已 `import { getDb } from '../services/db.js'` 并 `db.insert(evalRuns)` —— 「CLI 侧无 DB 读」的旧前提**已不成立**，两侧同时加对账可达 |
| 报告三键 | `DocMapSummary`（`ledger` / `none` + 计数 + 未映射 id 列表），`EvalRunSchema` 三键为**可选**（前图工单 04 为兼容历史行而降为可选） |
| 不变量 | 判定只在 api 侧；worker 侧批跑结果**不进任何判定**；`signoff_eligible` 是工程口径，非业务 PASS |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

## Not yet specified

- **「账本 ↔ 库内存在性」的下一步**：若本图把对账做成**可选开关**，则「谁在什么场景下必须开」仍需一张图（生产评测路径是否强制、`ingest-eval-corpus` 是否顺手自洽产账本 —— 即让账本在生成时就与库一致，而不是跑批时才发现）。
- **L2 侧同族问题未动**：`L2_DOC_MAP` 的账本同样不做库内对账；L2 的 `docHitRate` 至今未跑过真批跑（前图已记）。
- **`eval_runs` 历史行的其它可选键**：除映射来源三键外，`repro` 区块字段是否也该收紧为必填，取决于 §8 可复现面的下一张图。
- **题源收敛若裁成「DB 为准」**：需要一条「文件 → DB」的灌题入口（`seed:demo` 或 `ingest-eval-corpus` 的扩展），这条链的落点归属（api 脚本 / worker / admin 面）留给下一张图。

## Out of scope

- **改 `prds/00–11` 已冻语义**（含任何门限数字与判定公式）：须 ADR → 改 PRD → 升版。
- **真模型 live 跑数 / 人签 / ≥100 真标注校准集**：须真 Gateway key + 人。
- **B8 真 ES+IK / 多租户独立索引 / B9 真 RustFS / QUAL-2 真杀毒**：前图已裁。
- **P2.5 准出 / rewrite 默认开 / admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **改仓库默认开关**。
