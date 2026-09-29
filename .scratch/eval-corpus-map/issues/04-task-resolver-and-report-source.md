# 落「跑批侧按账本解析 + 报告如实标注映射来源」

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 02, 03

## Question

按工单 02 的裁定，把映射接到跑批侧（L1 必做；L2 是否一起按裁定书）：

1. **解析**：`apps/api/src/scripts/run-l1-golden.ts` 在读 `expectedDocIds` 之后、调 `hitAtKCase` 之前，按账本把逻辑 id 解析为当前 KB 的 uuid。**默认不传账本参数时的行为必须与今天逐位一致**（同一输入 → 同一 `hitAtK` / 同一 `hitAtKHits` / 同一 `hitAtKScored`）。
2. **报告如实标注**：报告里能读出这次的映射来源（按裁定书的三态或等价形状），且该字段**不参与任何判定**（`computeSignoffEligible` 与 `evaluateAdr046Bind` 的公式**一个字不动**）。若新增必填键，同步处理被字面量钉住的测试与落库路径（工单 01 已列出回归面）。
3. **未映射仍然响亮**：按裁定的行为落地——缺映射**算 miss**（保持 `hitAtK` 为真比值、非 `null`），同时在报告里可分辨「哪些逻辑 id 没映射上」；**禁止**把缺失写成 `null` 或「该门不适用」。
4. **不新增门**：本票**不**改 `hitAt20Min`、**不**给 `computeSignoffEligible` 加条件、**不**给 L2 加判定项。若发现某处代码客观上比 PRD 松，**只记录**，另开图裁定。
5. **测例**：新增 `<包>/tests/<能力>/<意图>.test.ts(x)`（简体中文头 + 登记 index）。至少钉：不传账本 → 与今天逐位一致（**回归锚**）· 传账本且全命中 · 传账本但缺某 id（算 miss 且可分辨）· 账本与 KB 不匹配时的行为（按裁定）· 报告来源字段的三态。
6. **反证**：至少两轮「破坏后变红」（如把缺失改成 `null`、把解析放到比对之后），并记录还原后全绿。

**不许**：改 `fixtures/` 数据文件 · 改 `PILOT_HARD_GATES` / `computeSignoffEligible` · 做模糊或子串匹配 · 让 mock 模式的数字看起来像签字数字。

产物：源码改动 + 测例 + 反证记录 + 一条「不传账本时逐位一致」的实证（同一夹具、同一模式，前后两次 `hitAtK` 三元组完全相同）。

## Answer

**已解**（实现由子代理按裁定书落，主控逐处复核 diff + 独立复跑门禁）。

**接线**（`apps/api/src/scripts/run-l1-golden.ts` / `run-l2-golden.ts`）：
- 新 env `L1_DOC_MAP` / `L2_DOC_MAP`（已在 `turbo.json` 的 `lint`/`test` env 段登记）。**不设 → 与今天逐位一致**；设了 → `resolveCorpusLedgerForRun`（`apps/api/src/eval/corpus-map.ts`）读账本并校验 `kbId` 全等 ∧ `corpusFingerprint` 全等（当前夹具重算），任一不符 → `CorpusLedgerError` → **`exit 2` 拒跑**；账本先读，避免跑完整批才发现映射不可用。
- 解析落点：`hitAtKCase` **之前** `resolveExpectedDocIds(c.expectedDocIds, ledger)`（无账本时原样传 `c.expectedDocIds`）；缺映射**原样保留** → 必然 miss。
- 报告**顶层新三键**（L1 / L2 同形）：`docMapSource: 'ledger' | 'none'` · `docMapResolved: number`（去重） · `docMapUnmappedIds: string[]`（字典序去重）；md 渲染各加一行说明。**三键不进任何判定** —— `PILOT_HARD_GATES`、`computeSignoffEligible`、`evaluateAdr046Bind`、`computeL2SignoffEligible` 与 `hitAtKCase` 本体**一字未动**。
- `apps/worker/src/eval/persist.ts`：两个白名单（`saveReport` / `saveL2Report`）各加三键，取值 = 常量 `none/0/[]`并写明理由（worker 批跑按裁定 2 **不做**账本解析；api CLI 侧才有真值）—— 目的只是让库内形状与 api 侧不分叉。
- **`L2_EVIDENCE_REPORT_KEYS` 未纳入**这三键（纳入会要求 worker 的 L2 批跑报告带它们，与「run-batch 刻意不改」冲突）；worker 侧改由独立测例守白名单。

**「不传账本逐位一致」的实证**：把 HEAD 版 `run-l1-golden.ts`（`git show`）与新版本、同夹具同 execute、均不传账本各跑一次 → `hitAtK / hits / scored` 与 2×2 矩阵逐位相同（`tripleEqual: true`），新跑三键为 `none/0/[]`。另在 `apps/api/tests/eval/l1-doc-map.test.ts` 钉住该不变式。

**回归面**（研究工单列出的全数处理）：`l1-cli.test.ts` 三处字面量报告、`l2-cli.test.ts` 的 `sampleReport()`、md 渲染断言均已随新键同步；`repro` 键集**未被污染**（三键放顶层而非 `repro`）。**未用** `as any` / `@ts-ignore` / 放宽断言。

**测例**：`apps/api/tests/eval/l1-doc-map.test.ts`（9 条：无账本逐位一致 · 全命中 · 缺映射算 miss 且可分辨 · kbId 不符拒跑 · 指纹不符拒跑 · 坏账本拒跑 · 三键取值）· `l2-doc-map.test.ts`（5 条，同形）· `apps/worker/tests/eval/persist-doc-map-keys.test.ts`（2 条）。

**反证**：见工单 03 的 ①②③（解析顺序 / 新鲜度 / 白名单），另 L2 侧同形复用同一契约故未重复破坏。

**未做（按裁定显式划出）**：`apps/worker/src/eval/run-l1-batch.ts` / `run-l2-batch.ts` **不改**（worker 批跑的 Hit@k / docHit 仍恒 0，且两者都不进任何判定 → 不是假绿，是同一数据工程缺口的另一处表现）；「账本里的 docId 是否仍在库内」不做运行时校验（改由账本 `title` + `GET …/documents` 全量人工对账）。
