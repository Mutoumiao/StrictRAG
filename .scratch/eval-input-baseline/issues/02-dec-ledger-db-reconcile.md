# 02 · 裁定：账本 ↔ 库内对账的落点 / 失效语义 / 三键形状

Type: grilling
Status: resolved
Parent: ../map.md
Blocked by: 01

## Question

基于工单 01 的现状面，裁定四组：落点 / 失效语义 / 两侧对称 / 三键形状定案。

## Answer

依据 [`research/01a`](../research/01a-ledger-db-reachability.md) 与 [`research/01c`](../research/01c-docmap-keys-consumers.md)。

### R1 · 落点：纯函数在 `corpus-ledger.ts`，I/O 编排在 `corpus-ledger-file.ts`，库读走**注入函数**

- 纯函数 `diffLedgerAgainstDocs(ledger, refs)` 落 `packages/contracts/src/eval/corpus-ledger.ts`（零 I/O、零新依赖，与既有 `resolveExpectedDocIds` / `summarizeDocMap` 同族）。
- I/O 编排（读文件 → 校验 → 查库 → 判定）落 `corpus-ledger-file.ts`：`resolveCorpusLedgerForRun` 增加**必填**入参 `lookupDocs: (docIds: readonly string[]) => Promise<readonly LedgerDocRef[]>`，并**改为 async**。
- **禁**把 DB 句柄注入 contracts（该文件只 import node 内置；引入 `@strict-rag/db` 会破子路径纪律，且会把客户端打包面拖进来）。
- `LedgerDocRef = { docId, kbId, title, status, lifecycle }`。

### R2 · 必填而非可选：只要用了账本，对账就跑

- 四个入口**全都有** DB 句柄（api 两侧已 import `getDb`；worker 两侧用 `apps/worker/src/db.ts`，需新增 import）→ 做成可选等于给「把闸改常开」留后门。故共享层**必填**注入；各入口的 `lookupDocs` 缺省即**真库查询**（测试用显式桩覆盖），生产路径**不可绕**。
- **未设账本**（`L1_DOC_MAP` / `L2_DOC_MAP` 未设置或纯空白）→ **完全不进对账**，与今天**逐位一致**（前图「失效三态」的第一态原样保留）。
- 顺序：`kbId` 全等 → `corpusFingerprint` 全等 → **对账**。前两档仍早于任何库读（负向测例不受影响）。

### R3 · 失效语义：三类，各自可分辨，全部响亮失败

| 类 | 判据 | 含义 |
|---|---|---|
| `missing` | 按 `docId` 查不到行，**或**该行 `kb_id ≠ 本次 run 的 kbId` | 账本点名了一篇不在本 KB 里的文档 |
| `not_retrievable` | 行存在但 `status ≠ 'ready'` **或** `lifecycle ≠ 'active'` | 检索闸不满足 → 该条目在证据里**不可能**出现，属结构性假 miss |
| `title_mismatch` | 行存在且可检索，但 `documents.title` 与账本条目 `title` **不逐字相等** | 账本已不再描述它声称的东西 |

- **为什么不止查「存在」（本裁定的核心）**：重跑 `ingest-eval-corpus` 为同一 KB 生成**新 uuid v7**，旧行落 `superseded` 而**仍在库里**（`apps/api/src/services/documents.ts:225-231`）—— 存在性对账会**放行**一批必然假 miss。以「可检索姿态」为准才抓得到最常见的失效。
- **为什么 `title` 只做全等比较而不做归一**：CLI 入库路径上 `title` 逐字透传（`corpus-ledger-file.ts:77` → `ingest-eval-corpus.ts:378/281` → `routes/documents/index.ts:206` → `services/documents.ts:140`），全等是良定义的；库内**无** `sourceFile` 列、**无**改名路径，故 title 不符只可能来自手工改库 / 手工改账本，两种都该响亮失败。
- **错误信息形状**：`CorpusLedgerError`，点名 `logicalId` + `docId` + 实测 `status` / `lifecycle` / `title`，并给出三类各自**计数**。**禁**降级成「无账本」、**禁**只报一句「对账失败」。
- 沿用既有纪律：坏账本 / 对不上 → **拒跑**（CLI `exit 2`；worker `markFailed` + `errorMessage` 复用原文）。

### R4 · 三键形状定案：**收紧为必填**

- `EvalRunSchema` 三键去掉 `.optional()`（`packages/contracts/src/eval/eval-run.contract.ts:56-58`）。
- 依据：`toEvalRunDto` 恒回填三键（`apps/api/src/services/eval-runs.ts:244-247`），HTTP 读路径**不会**因历史行失败；唯一会红的是 `packages/contracts/tests/eval/gold-contract.test.ts:70` 的 **1 个 it**（补键即可）。
- **不引入「历史行 / 真 none」区分**：历史行那时**确实**没有账本，读作 `none / 0 / []` 在语义上正确；造一个第三种读数是凭空发明语义。

### R5 · 测例注入面

- api：`RunL1Options` / `RunL2Options` 增加可选 `lookupDocs`（缺省 = 真库查询）。
- worker：`runL1Batch` / `runL2Batch` opts 与 `EvalConsumerDeps` 增加可选 `lookupDocs`；`evalPersist` 增加库查询（`persist` 已持 `getDb`）。
- 既有 **15 个 it / 5 个文件**（逐条见 01a §四）改为注入桩；**不许**靠「删掉传账本的用例」变绿。

### 禁则（写进实现工单）

不许把「对不上」降级成「无账本」；不许把「未映射」变成 `null`；不许改门限数字 / 判定公式 / 默认开关 / `prds/00–11`；不许为让测例变绿而放宽该闸（反证必须红）。
