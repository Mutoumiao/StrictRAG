# 研究明细：L2 报告的可判定面今天到底缺什么、有哪些可复用形状

> 只读研究（未改任何源码）。全部结论指到具体文件 + 函数；行号仅供本目录内对照，不进产品文档。
> 工单：`.scratch/l2-report-determinability/issues/01-research-l2-evidence-sources.md`

---

## 0. 一句话结论

L2 报告缺的不是**一个采集字段**，而是三层同时缺：

1. **采集层**——api 内口 `POST /internal/eval/execute-ask` 今天**已经**下发 `evidenceDocIds` / `minSupport` / `answerKind` / `citationCount`，但 worker 的 L2 执行器与 L2 回合类型把这四个键丢在门外（`L2TurnExecuteResult` 里根本没有）；api 自己的 L2 CLI 也不是取不到 docId，而是**没取**（`run-l2-golden.ts:309` 只 map 了 `e.text`，同一个 `e.docId` 就在手边）。
2. **判据层**——`L2Case.expectedDocIds` **全仓零消费者**；而它的取值是**逻辑 id**（`l2-corpus/travel-stay`、`ingest-samples/01-doc`），与真跑 `graph.evidence_snapshot[].docId`（= `documents.id`，uuid v7）**不是同一套标识**；`l2-corpus/*` 那三篇**从未入库、也没有任何入库入口**。所以「按 `expectedDocIds` 判命中」今天**不成立**，差的不是字段，是「语料入库 + 逻辑 id→uuid 映射账本」两件数据工程。
3. **报告层**——L2 报告没有 §8 可复现区块；`l2Fingerprint` 只在 api 的 `{...report}` 里被塞进 `reportJson`，worker 的 `saveL2Report` 是手写白名单（13 键，无指纹）；两侧 `L2CaseRow` / `L2BatchCaseRow` 是逐字段复制的两份类型，「同构」是纪律而非类型保证。

---

## 1. 采集面

### 1.1 两侧在哪一行丢掉 `docId`

| 侧 | 位置 | 事实 |
|----|------|------|
| worker（真丢） | `apps/worker/src/eval/execute-ask-http.ts:126-131`（`createEvalHttpL2Execute`） | 只读 `payload.data.evidenceTexts` 与 `answer`；同文件 `createEvalHttpExecute`（L1，`:69-82`）读 `evidenceDocIds` / `minSupport` / `answerKind` / `citationCount`。**同一份 JSON 形状（`ExecuteAskJson`，`:13-29`），两个执行器各读一半。** |
| worker（类型也在门外） | `apps/worker/src/eval/run-l2-batch.ts:15-23`（`L2TurnExecuteResult`） | `{ outcome, reason?, rewriteUsed?, evidenceTexts?, answer? } \| { outcome:'error', errorMessage? }` —— **无 `evidenceDocIds` / `minSupport` / `answerKind` / `citationCount`**。对照 L1 的 `EvalCaseExecuteResult`（`apps/worker/src/eval/run-l1-batch.ts:46-58`）四个键齐全。 |
| worker（消费点） | `apps/worker/src/eval/run-l2-batch.ts:112-114` | `const evidenceTexts = last?.evidenceTexts ?? [];` —— 只用来跑 `historyLeaked`。 |
| api（没取，不是取不到） | `apps/api/src/scripts/run-l2-golden.ts:309` | `(graph.evidence_snapshot ?? []).map((e) => e.text ?? '')`。对照 L1 同一表达式：`apps/api/src/scripts/run-l1-golden.ts:660-662` map 的正是 `e.docId`。 |

api 内口**已经**下发的全部键（`apps/api/src/routes/eval.ts:329-345`）：`status` · `reason` · `rewriteUsed` · `evidenceTexts` · `evidenceDocIds` · `answerKind` · `citationCount` · `minSupport` · `answer`（9 键）。逐键对照：

| 内口键 | `createEvalHttpL2Execute` 读? | `createEvalHttpExecute`(L1) 读? | L2 上游类型有该键? |
|--------|------------------------------|-------------------------------|--------------------|
| `status` | ✓ | ✓ | ✓（`outcome`） |
| `reason` | ✓ | ✓ | ✓ |
| `rewriteUsed` | ✓ | ✗ | ✓ |
| `evidenceTexts` | ✓ | ✗ | ✓ |
| `answer` | ✓ | ✗ | ✓ |
| `evidenceDocIds` | ✗ | ✓ | ✗ |
| `minSupport` | ✗ | ✓ | ✗ |
| `answerKind` | ✗ | ✓ | ✗ |
| `citationCount` | ✗ | ✓ | ✗ |

> 即：L2 采集面缺的 4 键，**内口全都在下**，断点在 worker 类型 + 执行器；api CLI 侧则是顺手可取而未取。

### 1.2 三处数据形状逐字段

**`GraphEvidence`**（`apps/api/src/graph/state.ts:13-22`）
`chunkId: string`（必填）· `docId: string`（必填）· `title?: string` · `text: string`（必填）· `preview?: string` · `lifecycle?: string` · `score?: number`
→ 唯一构造点：`apps/api/src/graph/run.ts:332-340`。

**`EvidenceSnapshotItem`**（`packages/db/src/schema/ask/ask-traces.ts:5-11`）
`chunkId` · `docId` · `lifecycle?` · `preview?` · `title?`
→ **注意：落库快照里没有 `text`**，映射在 `apps/api/src/services/ask/execute.ts:60-68`（`toEvidenceSnapshot` 只落 `preview`）。所以「落库的 evidence」与「图返回的 evidence」本身就是两个形状 —— 想从 `ask_traces` 反推命中也拿不到正文。

**`L2TurnExecuteResult`**（`apps/worker/src/eval/run-l2-batch.ts:15-23`）——见 1.1 表。

**api 内口 JSON `ExecuteAskJson.data`**（`apps/worker/src/eval/execute-ask-http.ts:13-29`）——见 1.1 表。

### 1.3 `L2Case.expectedDocIds` 今天有没有消费者：**没有（0 个）**

全仓 grep `expectedDocIds` 的 L2 侧命中只有三类：

- 类型字段声明：`packages/contracts/src/eval/l2-gold.ts:56`（`L2Case.expectedDocIds?: string[]`）。
- 加载器校验：`packages/contracts/src/eval/l2-gold.ts:172-173` → `parseDocIds`（`:263-275`，只校验是「非空 string[]」）。
- 夹具文本自身：`fixtures/l2/gold.yaml`。

**runner / worker / HTTP 层一处都不读**：`apps/api/src/scripts/run-l2-golden.ts` 只读 `c.expected.accept` / `c.expected.rewriteUsed` / `c.expected.themePersist`（`:313-315`、`:330`）；`apps/worker/src/eval/run-l2-batch.ts` 同构（`:116-121`、`:137`）。`themePersist` 只被**回显**（`expectedThemePersist`），从未与任何图上字段比较。

### 1.4 夹具语料在哪、id 怎么对

**`fixtures/l2/` 目录结构（全列）**

```
fixtures/l2/
├── gold.yaml            12871 B   （扩展名 .yaml，内容是 JSON，JSON.parse 零依赖）
├── README.md             3598 B
├── RACI.md               1972 B
├── sample-report.md      2908 B
└── corpus/
    ├── leave-policy.txt     445 B
    ├── meal-allowance.txt   431 B
    └── travel-stay.txt      489 B
```

对照 `fixtures/ingest-samples/`：`01-doc.txt` … `10-doc.txt`（各 289 B）。

**gold.yaml 实况（用 `ConvertFrom-Json` 实测，不是读文档）**：**18 条 case**（不是工单里写的 20 条），**每条都带 `expectedDocIds`**，id 数 1～3 个不等，合计 **25 个逻辑 id**。逻辑 id 只有两族：

- `ingest-samples/01-doc` … `10-doc` → 对应 `fixtures/ingest-samples/NN-doc.txt`
- `l2-corpus/travel-stay` / `l2-corpus/meal-allowance` / `l2-corpus/leave-policy` → 对应 `fixtures/l2/corpus/*.txt`

映射关系的**唯一载体是两份 README 表格**（`fixtures/l1/README.md:16-24`、`fixtures/l2/README.md:39-49`）+ 一句纪律：「真跑前须把 gold 中的逻辑 id **映射**为当前 KB 的 `documents.id`（uuid）。与 L1 相同纪律」。

**这些 corpus 文件怎么进库？**

- `ingest-samples/*`：有入口 —— `scripts/demo-ingest.mjs`（`pnpm demo:ingest`）走 HTTP：`upload-url → PUT → complete → approve → scan`，最后 PATCH `lifecycle=active`（`:124-216`）；上传时 `const title = path.basename(file, '.txt')`（`:126`）→ 落库 `documents.title = '01-doc'`；脚本把 `docId` 打进日志（`:152` `enqueued ${title} → ${docId}`），**但不写任何映射文件**（无 `L1_DOC_MAP` / `DOC_MAP` / `logicalId` 之类载体，全仓 grep 零命中）。
- `l2-corpus/*`：**没有任何入口**。`l2-corpus` / `travel-stay` 全仓命中只有 `fixtures/l2/README.md:45-47`、`fixtures/l2/gold.yaml`、`docs/module-status/api.md:144`（明写「语料草案 `fixtures/l2/corpus/` **未**走 worker 入库」）。`scripts/demo-ingest.mjs` 只 `readdir(fixtures/ingest-samples)`（`:107`）。

**库里 `documents` 表的主键与「等价列」**

- 主键：`id uuid primary key`，`$defaultFn(() => uuidv7())`（`packages/db/src/schema/_shard/base-columns.ts:10-15`）。
- **没有 `external_id` / `source_key` / 逻辑 id 列**。`packages/db/src/schema/kb/documents.ts` 全文 62 列里与来源相关的只有：`sourceType`（`text('source_type').default('upload')`）、`objectBucket`、`objectKey`、`contentType`、`byteSize`、`checksumSha256`、`parsedText`、`mongoDocId`、`title`。
- `objectKey` 由 `storage.createUploadSlot(kbId, docId, contentType)` 生成（`apps/api/src/routes/documents/index.ts:201-209`），**不含源文件名/路径**。
- 唯一能当「弱外部标识」的是 `documents.title`（`01-doc` 一族）；`l2-corpus/*` 连这个都没有（未入库）。

**`graph.evidence_snapshot[].docId` 的赋值链（逐段）**

1. `apps/api/src/services/retrieve/corpus.ts:103-122`（`loadCorpusFromDb`）：读 PG `documents`（双闸门 `filterDocsForRetrieve` + 生效窗口 + 可见性）∧ `chunks`（`indexVersion` 对账），返回 `{ chunkId: c.id, docId: c.docId, ... }`（`:115` `docId: c.docId`）→ `chunks.docId` 是指向 `documents.id` 的 uuid。
2. `apps/api/src/services/retrieve/retrieve.ts:305-319`：`evidence.push({ chunkId, docId: chunk.docId, title, text: evidenceText, ... })`（`:307-308`）。
3. `apps/api/src/graph/run.ts:332-340`：`const evidence: GraphEvidence[] = r.evidence.map((e) => ({ chunkId: e.chunkId, docId: e.docId, ... }))`。
4. `apps/api/src/graph/run.ts:347-351`：`state = { ...state, evidence, evidence_snapshot: evidence, ... }`。
5. `apps/api/src/graph/run.ts:134`（`finalize`）：`evidence_snapshot: s.evidence_snapshot ?? s.evidence ?? []`。

→ **`evidence_snapshot[].docId` = `documents.id`（uuid v7），不是逻辑 id，也不是 `title`。**

**结论：按 `expectedDocIds` 判命中今天能成立吗？——不能。** 三个必要条件全缺：

| 条件 | 现状 |
|------|------|
| ① 语料在库 | `l2-corpus/*` 三篇**从未入库**、无入口；`ingest-samples/*` 有入口但需人工跑 `demo-ingest` 且映射靠日志 |
| ② id 可对 | 逻辑 id 与 `documents.id` 之间**无任何代码/数据载体**（无 external_id 列、无映射表、无映射文件、无 env）。README 只写「映射」二字 |
| ③ 采集面 | worker 通道丢 `evidenceDocIds`（见 1.1）；api CLI 可取未取 |

**若照搬 L1 的 `hitAtKCase`（`packages/contracts/src/eval/l1-matrix.ts:108-127`，trim 后全等交集）**：
- 未映射时 `expected.some((id) => seen.has(id))` 恒 `false` → 报告写 **0**，不是 `null`。也就是产出一个**看起来像判据的恒零**。
- 这条正是 L1 侧已被护栏钉住的纪律：`packages/contracts/tests/eval/l1-hit-at-k.test.ts`（「逻辑 id→uuid 映射层只认 trim 后全等，未映射不得伪命中」），`docs/testing/coverage/03-ops.md:16` 也明写「未映射时 Hit@k 恒 0」。

### 1.5 L1 侧「命中期望文档」的完整写法，以及哪些部分 L2 不能搬

**取值**
```ts
// apps/api/src/scripts/run-l1-golden.ts:660-662
evidenceDocIds = (result.graph.evidence_snapshot ?? [])
  .map((e) => e.docId)
  .filter((id): id is string => typeof id === 'string' && id.length > 0);
// :669
const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);
// :670
accumulateHitAtK(hitAcc, hit);
```
worker 同构在 `apps/worker/src/eval/run-l1-batch.ts:166`（`evidenceDocIds = result.evidenceDocIds ?? []`）与 `:176`。

**纯函数**（`packages/contracts/src/eval/l1-matrix.ts`）
- `hitAtKCase(expectedDocIds, evidenceDocIds)`（`:108-127`）：无非空 expected → `null`（不计分）；否则 trim 后全等交集是否存在。
- `accumulateHitAtK(acc, hit)`（`:129-134`）：`null` 不进分母；`hit` 加分子。
- `hitAtKRate(acc)`（`:136-139`）：`scored === 0 → null`。
- 加载侧 `parseExpectedDocIds`（`:86-104`）：缺/null/[]/全空白 → `null`；非数组或含非串 → **抛错**。

**可直接搬到 L2 的**：三个纯函数 + 取值表达式（api CLI 一行就能加）。
**在 L2 语义下不成立的**：

- **`k=20` 口径不稳**：L1 的「k」是 `rerankTopN`（档位表 `apps/api/src/graph/budget.ts`），注释写「k=该列表长度」。L2 是**多轮**——每轮各有自己的 evidence 集合。gold 只有一个 `expectedDocIds`，**没有 per-turn 标注**（`L2Case` 无 turn 级期望字段，`l2-gold.ts:50-58`）。「在哪一轮命中算命中」是**语义缺口**，不是代码缺口。
- **「无标注 → null」这条分支在 L2 上永不触发**：18 条**全部**有标注（实测）。L2 的真实缺口是「有标注但映射不到」，与 L1 的「没有标注」是两回事，若共用同一条 `null`/`false` 口径，`0/18` 与「未映射」不可区分。
- **分母口径**：L2 若取「有标注题数」为分母，得到的是**逻辑 id 命中率**（恒 0）；这与 PRD §6.2「近指代主题正确且合法作答 ≥80%」不是同一指标 —— 后者今天由 `l2NearCorefPassRate` 承担，而它在注释里（`packages/contracts/src/eval/l2-matrix.ts:40-47`）**自己承认**「未采集 `evidence_snapshot.docId`，连按 `expectedDocIds` 判命中都做不到」。

### 1.6 「合法 citation」：L1 的定义原文，以及 L2 要机械化需要哪些字段

**L1 定义**（`packages/contracts/src/eval/l1-matrix.ts:141-165` `citationCompleteRate`）
> 分子 = `answerKind='knowledge'` ∧ `outcome='answered'` ∧ `citations>0`；分母 = `answerKind='knowledge'` ∧ `outcome='answered'`；分母 0 → null（无 knowledge answered 题 → 该门不适用）。chitchat / 拒答 / error / 未采到 answerKind 一律不进分母。
> 图在 answered ∧ knowledge 时结构上必带合法 citation（`graph/run.ts` 的 `validIds` 闸为空即改拒答），故本率**结构上只能是 1 或 null** —— 此门钉的是该不变式。

**图内不变式原文**（`apps/api/src/graph/run.ts`）
- `:394-403`：`const evidenceIds = new Set(state.evidence.map((e) => e.chunkId));` → `validIds = parsed.citations.filter(id => evidenceIds.has(id) && !citedOnce.has(id))`（只留证据内 id、去重保序）。
- `:405-408`：`if (validIds.length === 0) return finalize(state, 'invalid_citations');`（strip 后无合法引用 → 拒答）。
- `:119`（`finalize`）：`citations: status === 'answered' && reason === 'verified' ? s.citations : []`。
- `:427`：`// 合法 draft 必 verify — 禁止此处 answered`。

**L2 侧机械化需要的字段**：`answerKind` + `citations.length`（等价 `citationCount`）。今天可得性：

| 通道 | `answerKind` | `citations.length` |
|------|--------------|--------------------|
| api L2 CLI | **可得未读**（`result.graph.answerKind`，`AskGraphResult` 有该键 `state.ts:103`；且 `last` 就在手里 `run-l2-golden.ts:305`） | 同（`graph.citations`，`state.ts:104`） |
| api 内口 | **已下发**（`routes/eval.ts:338`） | **已下发**（`:339`） |
| worker L2 | **不可得**（`L2TurnExecuteResult` 无该键；`createEvalHttpL2Execute` 不读） | **不可得**（同） |

---

## 2. 零容忍四项（PRD §6.2）

PRD 原文（`prds/08-quality/02-evaluation-and-gates.md:186`）：「**零容忍（任一即 L2 失败）**：主题粘连胡答、历史文本进 evidence/`min_support`、冲突场景跟错数字、合法路径跳过 verify。」阈值：零容忍项 = 0（`:188`）。

### 2.1 `historyLeaked` 的完整语义与全部调用点

**定义**（`packages/contracts/src/eval/l2-matrix.ts:28-33`）
```ts
export function historyLeaked(evidenceTexts, priorUserTexts): boolean {
  return priorUserTexts.some((q) => q && evidenceTexts.some((t) => t.includes(q)));
}
```
语义 = 「先前**用户**轮原文是否作为子串出现在末轮 evidence 文本里」。**窄于 PRD**：不含 assistant 轮文本、不做归一化、不做数字级比对（`.trellis/spec/api/backend/l2-eval.md:99` 自己把这记为债：「`historyLeaked` 的比对宽度（只比对先前**用户**轮，比 PRD 窄）**未**收紧，属债」）。

**全部调用点**
- `apps/api/src/scripts/run-l2-golden.ts:309-311`：`evidenceTexts = (graph.evidence_snapshot ?? []).map(e => e.text ?? '')`；`priorUserTexts = c.turns.slice(0, -1).map(t => t.text)`。→ **priorUserTexts 取自 gold 里的用户轮原文，不是运行时窗**。
- `apps/worker/src/eval/run-l2-batch.ts:112-114`：`evidenceTexts = last?.evidenceTexts ?? []`；`priorUserTexts = c.turns.slice(0, -1).map(t => t.text)`。同构。
- 再导出：`apps/api/src/scripts/run-l2-golden.ts:119`（`export { acceptHit, historyLeaked, nextSessionId }`）。
- 测例：`packages/contracts/tests/eval/l2-matrix.test.ts:53-59`；`apps/api/tests/eval/l2-cli.test.ts:150-155` 与 `:325-349`（案例 5）；`apps/worker/tests/eval/run-l2-batch.test.ts:50-66`。

**扩到「历史文本（含上轮 assistant 文本）」最少要改几处**：**1 个纯函数 + 2 处调用点（+ 对应测例）**，不需要动图、不需要动内口、不需要新通道：

- assistant 文本两处**都已在手**（进程内窗）：api `run-l2-golden.ts:302` `const assistant = result.graph.answer || result.graph.userMessage || ''` 写进本地 `windows`；worker `run-l2-batch.ts:107` `if (result.answer) hist.push({ role:'assistant', content: result.answer })`。
- 改法二选一：`historyLeaked` 加第二组输入（如 `historyTexts`），或签名改为 `(evidenceTexts, priorTexts)` 由调用方拼 `[...priorUserTexts, ...priorAssistantTexts]`。前者更贴合现有测例的形状。
- 附带事实：`L2Expected.historyInEvidence` 被加载器**钉成 `false` 字面量**（`packages/contracts/src/eval/l2-gold.ts:223-225` 校验、`:247-251` 回写），夹具无法表达「期望泄漏」；这**不需要改**（方向安全）。

### 2.2 上轮 assistant 文本进 evidence，今天结构上可能吗？——**不可能**

逐段依据：

1. **evidence 只有一个写点**。`apps/api/src/graph/run.ts:319-355` 的 retrieve 分支里：`:332-340` 构造 `const evidence = r.evidence.map(...)`；`:347-351` 一次性 `state = { ...state, evidence, evidence_snapshot: evidence, ... }`。`finalize`（`:89-143`）只回读（`:134`）。`initState`（`state.ts:130-155`）初始 `evidence: []`（`:148`）。全仓 grep `evidence` / `evidence_snapshot` 在 `apps/api/src` 的命中表（见 1.2 与本节）里**没有任何第二处赋值**。
2. **`r.evidence` 的正文来自 KB chunk，不来自会话**。`apps/api/src/services/retrieve/retrieve.ts:296-320`：`const evidenceText = bodyById?.get(chunk.chunkId) ?? chunk.text;`（`:305`），`bodyById` 来自 `deps.loadBodies`（Mongo chunk 正文，`createDefaultRetrieveDeps` `:341-357`）或 PG；`chunk` 来自 `loadCorpusFromDb`（`corpus.ts:103-122`，只读 `documents` ∧ `chunks`）。
3. **会话窗只进 rewrite 提示词**。`run.ts:190-250`（`loadAndMaybeRewrite`）：`window` → `rewriteUserPrompt(state.rawQuestion, window)`（`:225-226`），产出 `state.question` / `standaloneQuestion`。retrieve 用的是**改写后的问句**（`:311` `question: state.question`），窗本身不进 retrieve。generate / claim_split / judge 三处传的都是 `state.evidence`（`:371`、`:445`、`:491`、`:518`）。
4. **类型/字段层面：这是约定，不是类型保证**。`GraphEvidence.text: string` 是普通必填字符串，`evidence_snapshot: GraphEvidence[]` 无 provenance / 来源判别字段（`state.ts:13-22`、`:95-96`、`:119-121`）。`packages/db/src/schema/ask/ask-traces.ts:24-27` 的注释「`evidence_snapshot` 仅 KB chunk 元数据，禁止会话原文」是**纪律注释**；`apps/api/src/services/ask/traces.ts:44` 同款注释。没有任何 branded type、没有 runtime 校验拦得住把任意字符串塞进 `state.evidence`。
5. **结论**：assistant 文本今天进 evidence 的唯一现实路径是「KB 里恰好有一篇 chunk 正文包含这段文字」——即既有的 `historyLeaked` 抓到的是**语料撞词**，不是「图把聊天记录当证据」。图的缺陷路径不存在。
   - 对判据设计的含义：把「历史文本进 evidence」当**图的缺陷**去机械化，今天只会得到一个**恒 0 的假判据**（路径不存在）；能钉的真不变式更弱 —— 「运行产物里出现的会话文本不得源自语料（即语料中不得混入会话原文）」。

### 2.3 `min_support`：定义 · 产生处 · 「历史文本进 min_support」能否观测

- **`parseMinSupport`**：`packages/contracts/src/eval/l1-matrix.ts:179-184` —— 非 number / 非有限 / `<0` / `>1` → `null`。
- **`graph.minSupport` 的产生处**：`apps/api/src/graph/run.ts:540-543` `const minSupport = Math.min(...scores);`（judge 分，min 否决，禁止 mean 洗白）；只在 `finalize`（`:120-121`）对 `reason === 'verified' || reason === 'unsupported_claims'` 输出。
- **「历史文本进 `min_support`」今天能否观测：不能。**
  - `min_support` 是 `[0,1]` 的数，**文本不可能「进入」它**；PRD 的意图只能是「历史文本被当作 claim 送去 verify」。
  - 要观测这点需要 **claim 原文**（`state.claims[].text`）。而 `AskGraphResult`（`state.ts:99-128`）**不含 `claims`**；落库的 `graph_trace` 也只落 `llmCalls/retrieveCalls/route_source/routeLabel`（`apps/api/src/services/ask/execute.ts:261-269`）。
  - 图内部对 claim 有一道闸（`run.ts:464-472`：`c.chunkIds = c.chunkIds.filter(id => evidenceIds.has(id) && citationIds.has(id))`，空则 `claim_split_failed`），但这是**chunkId 层**的约束，不是文本层 —— 也就是说：claim **文本**可以复述历史内容，只要它的 chunkId 挂在合法 evidence 上。**这条今天完全不可观测。**
- **L2 两侧为什么都没采集它**
  - api L2 CLI：`result.graph.minSupport` **其实可取**（同一 `last` 对象；L1 CLI 用 `parseMinSupport(result.graph.minSupport)` 采了，`run-l1-golden.ts:662`），只是 L2 CLI 没写。
  - worker L2：`L2TurnExecuteResult` **根本没有该键**（`run-l2-batch.ts:15-23`），而 api 内口在 `routes/eval.ts:341-344` 已经下发了 —— 属「通道有，类型无」。

### 2.4 另三项：可观测原料盘点（没原料就如实说没原料）

| 项 | fixture 侧结构化字段 | 图上字段 | 结论 |
|----|---------------------|----------|------|
| **主题粘连胡答** | `expected.themePersist`（boolean，18 条全有） | `status` / `reason` / `answerKind` / `citations` / `minSupport` / `debug.*` —— **没有任何表示「本轮主题」的字段** | **无原料**。api CLI 只把 `expectedThemePersist` 回显进 row（`run-l2-golden.ts:330`），没有任何可比对的图上值。要机械化必须先定义「主题」为何物 —— 今天仓库里没有这个定义。 |
| **冲突场景跟错数字** | **无数字字段**；只有 `rubric` 自由文本里出现数字（`l2-kb-conflict-001`：「库内一线住宿上限为 600 元」；`l2-kb-conflict-002`：「库内一线餐补 120 元/天」），且这些数字**确实在语料里**（`fixtures/l2/corpus/travel-stay.txt`：一线 600 / 其它 400；`meal-allowance.txt`：一线 120 / 其它 80） | `answer`（文本）· `citations[].preview`（引用的 chunk） | **有原料、无判据**：需要先发明规则（例如「answer 中出现的金额集合 ⊆ 被引 chunk 中出现的金额集合」），这是**新判据**，不是采集。 |
| **合法路径跳过 verify** | `expected.accept` / `expected.rewriteUsed` / `rubric`（自由文本，如 `l2-explicit-backref-002`「零容忍：跳过 verify 直接 answered」、`l2-adversarial-002`「零容忍：合法路径跳过 verify」） | `status` / `reason` | **无直接字段**。没有任何「是否调用过 verify」的布尔；只能靠 `reason` 反推（`verified` vs `unsupported_claims`），或靠 `debug.llmCalls` 计数反推调用序列 —— 后者是**形似判据**（见 §6）。注意 `debug` 里也没有 purpose 维度（`run.ts:136-141` 只有 `llmCalls` 总数、`retrieveCalls`、`route_*`、`evidenceCount`）。 |

> 关于 `debug` 的一个易错点：`AskGraphResult.debug` 是**图返回值**，不依赖 `options.debug`；`options.debug` 只影响 `AskResponse` 的封装（`services/ask/execute.ts:91-101`）。所以 api L2 CLI **可以**读 `last.graph.debug.llmCalls`（今天没读），而 worker 内口不下发 `debug` → worker 侧不可得。

### 2.5 `fixtures/l2/gold.yaml` 18 条逐条实况

（`id` | `type` | `expected.themePersist / rewriteUsed / accept` | `expectedDocIds` 个数 | rubric 是否含具体数字或明确判据）

| # | id | type | themePersist | rewriteUsed | accept | docIds | rubric |
|---|----|------|--------------|-------------|--------|--------|--------|
| 1 | `l2-near-coref-001` | near_coref | true | true | answered | 2 | 无数字；含「零容忍：历史文本进 evidence；粘在住宿上胡答」 |
| 2 | `l2-near-coref-002` | near_coref | true | true | answered | 1 | 无数字；「零容忍：把上轮答案全文当 citation」 |
| 3 | `l2-near-coref-003` | near_coref | true | true | answered | 1 | 无数字；「零容忍：继续答年假或编造病假数字」 |
| 4 | `l2-weak-coref-001` | weak_coref | true | true | coref_unresolved/abstained/answered | 1 | 无数字 |
| 5 | `l2-weak-coref-002` | weak_coref | true | true | coref_unresolved/abstained/answered | 1 | 无数字 |
| 6 | `l2-explicit-backref-001` | explicit_backref | true | true | answered | 2 | 无数字 |
| 7 | `l2-explicit-backref-002` | explicit_backref | true | true | answered | 1 | 无数字；「零容忍：跳过 verify 直接 answered」 |
| 8 | `l2-topic-switch-001` | topic_switch | false | true | answered/abstained | 1 | 无数字 |
| 9 | `l2-topic-switch-002` | topic_switch | false | true | answered/abstained | 1 | 无数字 |
| 10 | `l2-kb-conflict-001` | kb_conflict | true | true | answered/abstained | 1 | **有数字**：「库内一线住宿上限为 600 元」 |
| 11 | `l2-kb-conflict-002` | kb_conflict | true | true | answered/abstained | 1 | **有数字**：「库内一线餐补 120 元/天」 |
| 12 | `l2-adversarial-001` | adversarial | true | true | answered/abstained | 1 | 无数字 |
| 13 | `l2-adversarial-002` | adversarial | true | true | answered/abstained | 1 | 无数字；「零容忍：合法路径跳过 verify」 |
| 14 | `l2-no-session-001` | no_session | false | false | answered/abstained | 1 | 无数字 |
| 15 | `l2-no-session-002` | no_session | false | false | answered/abstained | 2 | 无数字 |
| 16 | `l2-budget-001` | budget | false | true | budget_exhausted/answered/abstained | 3 | 无数字 |
| 17 | `l2-budget-002` | budget | true | true | budget_exhausted/answered/abstained | 3 | 无数字 |
| 18 | `l2-session-isolation-001` | session_isolation | false | false | coref_unresolved/abstained/answered | 1 | 无数字 |

补两条统计事实：
- `near_coref` 只有 **3 条**（与 `l2-matrix.ts:44-47` 注释一致）→ 80% 门只能取 0 / 33.3 / 66.7 / 100%。
- 9 类题型齐（`L2_TYPES` 9 个全出现），`caseCount=18 ≥ 15`（余量只有 3 条）。

---

## 3. §8 的 L2 侧字段

PRD §8 条目原文（`prds/08-quality/02-evaluation-and-gates.md:224`）：「seed、models、**fallbackChains 版本**、retrieveK、rerankTopN、tauClaim、crag\*、contextMode、mode、promptVersions、题面 ID 哈希、校准集哈希、lifecycle 过滤规则版本、**session 策略版本 / rewrite prompt 版本**、L2 剧本集哈希。」

### 3.1 「L2 剧本集哈希」≠ `l2RewriteFingerprint`

**`l2RewriteFingerprint`**（`apps/api/src/eval/l2-fingerprint.ts:4-6`）
```ts
export function l2RewriteFingerprint(prompt: string, modelId: string): string {
  return createHash('sha256').update(`${prompt}\0${modelId}`).digest('hex');
}
```
唯一调用点：`apps/api/src/scripts/run-l2-golden.ts:164`，入参是 `rewriteSystemPrompt()` + `opts.rewriteModelId ?? ''`。
→ **算的是「rewrite 提示词 + 模型身份」，不是剧本集。** 它连一道题的 id 都不含。所以 PRD §8 的「L2 剧本集哈希」**今天在仓库里没有任何实现**；`L1Repro.l2GoldSetHash` 被**类型钉成 `null`**（`packages/contracts/src/eval/l1-repro.ts:102`，注释「L2 侧归下一张图 → 恒 null」）。

**可搬的现成件（原文）**
```ts
// packages/contracts/src/eval/l1-repro.ts:30-37
export function l1QuestionIdsHash(ids: readonly string[]): string | null {
  const list = ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .sort();
  if (list.length === 0) return null;
  return sha256Hex(JSON.stringify(list));
}
// :44-49
export function l1CalibSetHash(rawContent: string | null | undefined): string | null {
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) return null;
  return sha256Hex(rawContent);
}
```
- 「剧本集 id 集合哈希」**可行性高**：`l1QuestionIdsHash(cases.map(c => c.id))` 直接可用，规范化（trim → 去空 → **升序** → JSON）对文件重排免疫。
- **L2 的 case id 稳定吗？** 稳定：加载器强制 `/^l2-[a-z0-9-]+$/`（`packages/contracts/src/eval/l2-gold.ts:79`）且文件内唯一（`:136-140`）；`id` 是 gold 文件里的字面量（`fixtures/l2/gold.yaml`）。**但**运行集会受 `L2_MAX_CASES` 截断影响（api `run-l2-golden.ts:235`、worker `run-l2-batch.ts:77-78`）——哈希会变，这在语义上是正确的（截断即另一个题面集），但要在口径里写清「哈希算的是**本跑实际用的**题面集」。
- **校准集哈希不要搬**：L2 侧没有校准集（`fixtures/l2/` 无 calib 文件），该键在 L2 应记 `null`，不是拿 gold 内容顶替。
- **另一条可选口径**：`l1CalibSetHash(整份 gold.yaml 原文)` = 逐字节哈希（对行尾敏感，跨平台检出会变）。若目标是「题面集身份」，id 集合哈希更稳；若要「文件身份」，逐字节更严格。**今天两者都没实现。**

### 3.2 session 策略版本 / rewrite prompt 版本：**全仓无版本载体**

- `SESSION_REWRITE_ENABLED` 是**布尔**：`apps/api/src/env.ts:126`（Zod）；消费点 `services/ask/execute.ts:98/156/232/273`、`run-l2-golden.ts:139`。
- KB 侧只有「锁」，不是版本：`packages/contracts/src/kb/kb-settings.contract.ts:91-94` `SessionRewriteLockSchema = { enabledDefault: literal(false), locked: literal(true) }`。
- `rewriteSystemPrompt()`（`apps/api/src/graph/prompts.ts:5-12`）是**内联字符串数组**→ 源码即版本，无常量、无 KB 配置键、无表列。
- 类型层佐证：`L1Repro.sessionStrategyVersion: null` 与 `promptVersions: null` 都是 **`null` 字面量**（`l1-repro.ts:97-100`，注释「无版本载体」），「编一个假版本号过不了类型检查」。
- **结论：如实说没有载体。** L2 侧只能同样是 `null`。

### 3.3 `L1Repro`（14 键）原文形状 + L2 同构需要什么

`L1Repro`（`packages/contracts/src/eval/l1-repro.ts:76-103`）14 键：
`seed: null` · `models{ env{chat,embed,rerank}, kbBindings }` · `fallbackChainsVersion: null` · `retrieveK` · `rerankTopN` · `tauClaim` · `crag: null` · `contextMode: null` · `promptVersions: null` · `questionIdsHash` · `calibrationHash` · `lifecycleFilterVersion: null` · `sessionStrategyVersion: null` · `l2GoldSetHash: null`。
（注释明确：**区块内没有 `mode` 键** —— 顶层 `mode` 是 `retrieve_mode` 的历史别名。）

L2 若同构，逐键可行性：

| L1Repro 键 | L2 能否取到 | 依据 |
|-----------|-------------|------|
| `seed` | null（同） | 无随机种子载体 |
| `models.env` | api 侧可（读 env）；worker 侧可（`apps/worker/src/env.ts`） | 与 L1 同源 |
| `models.kbBindings` | 需读库（api `readKbBindings` 已有现成注入，`run-l1-golden.ts:693-702`） | api 可；worker 无该客户端 |
| `retrieveK` / `rerankTopN` | **api 可**（`last.graph.mode` → `retrieveBudgetForMode`，L1 的做法 `run-l1-golden.ts:657`）；**worker 不可得**（`L2TurnExecuteResult` 无 `mode`，内口不下发） | 见 §1 |
| `tauClaim` | api 可（`env.TAU_CLAIM`） | — |
| `questionIdsHash`（→ L2 题面 id 哈希） | **可算**，`l1QuestionIdsHash(cases.map(c=>c.id))` | §3.1 |
| `calibrationHash` | null（L2 无校准集） | — |
| `l2GoldSetHash`（→ 剧本集哈希） | **可算**（同上函数 / 逐字节） | §3.1 |
| 其余 6 项（`fallbackChainsVersion`/`crag`/`contextMode`/`promptVersions`/`lifecycleFilterVersion`/`sessionStrategyVersion`） | null | 无载体 |

### 3.4 `l2Fingerprint` 今天进不进报告本体

**不进。** 三段证据：

1. `L2Report` 类型（`apps/api/src/scripts/run-l2-golden.ts:62-84`）**没有** `l2Fingerprint` 键。
2. 它只被塞进 **DB insert 的 `reportJson`**：`buildL2EvalRunInsert`（`:142-168`）
   ```ts
   reportJson: {
     ...report,
     l2Fingerprint: l2RewriteFingerprint(rewriteSystemPrompt(), opts.rewriteModelId ?? ''),
   },
   ```
   → **整对象直落 + 加键**。`writeL2Report`（`:179-188`）写出的 `artifacts/l2-last-run.json` 只是 `JSON.stringify(report)`，**无指纹**。
3. worker 侧 `saveL2Report`（`apps/worker/src/eval/persist.ts:146-181`）是**手写逐键白名单**，13 键全列：
   `run_type` · `retrieve_mode` · `signoffEligible` · `ranAt` · `caseCount` · `passCount` · `failCount` · `errorCount` · `zeroToleranceHits` · `nearCorefPassRate` · `nearCorefPassDen` · `cases` · `kbId`
   → **没有 `l2Fingerprint`**，也没有 `mode` / `rewriteEnabled` / `evalRunId`。即：**worker 侧 L2 跑批落库的 `report_json` 永远没有指纹**（L2 过期告警在 worker 归档上无从比对）。

**两侧不同构会造成什么具体后果（「加了字段会被静默丢弃」的判定依据）**：
- worker：`L2BatchReport` 上加字段（如 `repro` / `goldSetHash`），`saveL2Report` 不写它 → **TS 无报错**（显式对象字面量 = 结构类型，多余源字段被忽略）、**无既有测试红**（现有测例只断 `savedL2.run_type` / `signoffEligible`）→ 库里静默少键。
  这一条在本仓已被记为**纪律**而非编译保证：`docs/module-status/worker.md:10` 原话「`persist.ts` 的 `reportJson` 逐键白名单同步加这三个键（**不加 = 静默丢弃**，已由同构测例钉住）」——「同构测例」是**人写的**，不是类型机制。
- api：`{...report}` 直落 → 新字段自动进 `report_json` 与 artifacts 报告。
- 净效果：同一份 L2 跑的「报告」，**api 归档里有 l2Fingerprint、worker 库里的没有**；任何下游按「报告里有 × 键」做的判断，在两条路径上会给不同答案。

### 3.5 `evaluateL2Stale`：它读的指纹从哪来、过期判据、改指纹会不会连带打红

**定义**（`apps/api/src/obs/metrics.ts:128-138`）
```ts
// ponytail: last 由调用方注入；本函数零 I/O。env 开且从未 persist L2 时会与 rewrite_dogfood 叠告，允许。
export function evaluateL2Stale(input: { rewriteEnvOn?: boolean; current: string; last?: string | null }): void {
  if (input.rewriteEnvOn !== true) return;
  const stale = !input.last || input.last !== input.current;
  if (!stale) return;
  latchL3GuardAlert('l2_stale', { kind: 'l2_stale' });
}
```
- **指纹从哪来**：函数**不读指纹**，`current` / `last` 由调用方以字符串传入（零 I/O）。设计意图是「当前 `l2RewriteFingerprint` vs 库里上次的 `reportJson.l2Fingerprint`」——但**谁比对、谁注入，今天没人**（见下）。
- **过期判据**：`!last || last !== current`（缺席也算过期），且仅当 `rewriteEnvOn === true`。
- **调用点**：全仓 grep `evaluateL2Stale` 命中只有 —— `apps/api/src/obs/index.ts:9`（再导出）、`apps/api/src/obs/metrics.ts:129`（定义）、`apps/api/tests/obs/l2-stale.test.ts`（全篇）、`apps/api/tests/obs/l3-rewrite-fuse.test.ts:14,155`。→ **没有任何生产调用点**（未核实：是否存在动态/间接调用；静态检索范围内为零）。
- **改动 `l2Fingerprint` 会不会连带打红 `apps/api/tests/obs/l2-stale.test.ts`？——不会。** 该测只传字面量 `'cur'` / `'same'` / `'now'` / `'old'`（`:28-74`），与指纹函数零耦合。唯一与指纹字符串耦合的断言在 `apps/api/tests/eval/l2-cli.test.ts:530-536`（`reportJson.l2Fingerprint === l2RewriteFingerprint(rewriteSystemPrompt(), '')`，外加「改一个字就不同」）。

---

## 4. 落点与回归面

### 4.1 三腿各要动哪些文件

| 腿 | contracts | api | worker | 性质 |
|----|-----------|-----|--------|------|
| **A 采集面**（docId / minSupport / answerKind / citationCount 进 L2 报告） | 可不动（复用 `hitAtKCase` / `citationCompleteRate`）；若加 L2 专用口径 → `l2-matrix.ts` | `scripts/run-l2-golden.ts`（`:305-311` 附近取 4 键；`L2CaseRow`/`L2Report` 加键） | `eval/run-l2-batch.ts`（`L2TurnExecuteResult` + `L2BatchCaseRow`/`L2BatchReport` 加键）、`eval/execute-ask-http.ts`（L2 执行器读 4 键）、`eval/persist.ts`（白名单显式加键） | **改既有形状**（类型加必填键） |
| **B 零容忍**（历史文本含 assistant） | `l2-matrix.ts` 改 `historyLeaked` 签名 | `run-l2-golden.ts:309-311` 调用点 | `run-l2-batch.ts:112-114` 调用点 | **改既有形状**（纯函数签名） |
| **C §8 字段**（L2Repro） | 新增 `L2Repro` 类型 + 复用 `eval-repro` 子路径的哈希函数（**纯新增**） | `run-l2-golden.ts` 报告字段 + `formatL2ReportMd` 渲染 | `run-l2-batch.ts` 报告字段 + `persist.ts` 白名单 | **混合**：contracts 纯新增；两侧报告改既有形状 |

不需要动的：`apps/api/src/routes/eval.ts`（内口 9 键已全下发）、题目加载器（`l2-gold.ts` 形状不变）、DB schema（`eval_runs.report_json` 是 jsonb，无需迁移）。

### 4.2 会翻的既有断言（逐条点名）

**会红（若真按上述改）**

| 文件 | 用例名（`it` / `describe`） | 触因 |
|------|------------------------------|------|
| `apps/api/tests/eval/l2-cli.test.ts` | `describe('buildL2EvalRunInsert / persist gate')` → `it('maps report → session_multiturn; signoff 0; matrix 0; coverage null; ranAt local')` | 见 4.3（报告字面量） |
| 同上 | `it('live report still maps signoffEligible to 0 unless report says true')` | 同上 |
| 同上 | `it('reportJson.l2Fingerprint matches current prompt+empty model; signoff stays 0')` | 同上（且指纹口径若改必查） |
| 同上 | `it('5 evidence contains prior user text → fail + leak')`（`:325-349`） | 改 `historyLeaked` 签名/口径 |
| 同上 | `it('historyLeaked is substring of prior user full text')`（`:150-155`） | 同上 |
| `packages/contracts/tests/eval/l2-matrix.test.ts` | `describe('historyLeaked / acceptHit / nextSessionId')` 两个 it | 改纯函数签名 |
| `packages/contracts/tests/eval/l2-matrix.test.ts` | `describe('computeL2SignoffEligible')` 两个 it | 若给工程公式加门 |
| `packages/contracts/tests/eval/l2-near-coref-rate.test.ts` | 全篇（`computeL2SignoffEligible` 各边界） | 同上 |
| `apps/worker/tests/eval/run-l2-batch.test.ts` | `it('history leak increments zeroToleranceHits and fails the case')`（`:50-66`） | 改 `historyLeaked` 口径 |
| `apps/worker/tests/eval/run-l2-batch.test.ts` | `it('mock 即使零泄漏也不得 signoffEligible')`、`it('live + 九类齐 + ≥15 + 零泄漏 → 工程 signoffEligible')` | 报告加键 / 公式加门 |
| `apps/worker/tests/eval/run-l2-batch-near-coref-rate.test.ts` | 3 个 it（`5 条 near_coref、4 pass 1 fail = 恰好 80%`、`near_coref 全 error → 率 0`、`分母只取 near_coref`） | 同上 |
| `apps/worker/tests/eval/execute-ask-http.test.ts` | `it('200 带 evidenceDocIds 原样带回')`（`:51`）、`it('…minSupport…')`（用 `toEqual` **全等**断 execute 返回值）、`it('L2 执行器带 sessionId 与窗')`（`:109-142`） | 改执行器读键 → 返回值多键，**`toEqual` 全等断言最容易红** |
| `apps/worker/tests/eval/consumer.test.ts` | `it('session_multiturn 跑 L2 并 saveL2Report')`（`:107-146`） | 改 `saveL2Report` 白名单（该测只断 `run_type`/`signoffEligible`，**不一定红**，但同构测例应补） |
| `apps/api/tests/eval/l2-near-coref-rate.test.ts` | 4 个 it | 若报告加键/公式变 |
| `packages/contracts/tests/eval/l1-repro.test.ts` | `describe('emptyL1Repro · §8 区块形状')` → `it('键 = PRD §8 条目，且没有 mode / retrieve_mode 第二源')` | **只在**你往 `emptyL1Repro()` 加键/改键集时红（键集被逐字面量列出，`:66-88`） |
| `apps/api/tests/eval/l1-repro-fields.test.ts` | `it('记债字段逐条为 null，且报告里没有任何占位串')`（`:201-228`，断 `repro.l2GoldSetHash` 为 null） | **只在**你改了 **L1** 侧的 `l2GoldSetHash` 口径时红；新增独立 `L2Repro` 不触 |
| `apps/worker/tests/eval/run-l1-batch-repro.test.ts` | `expect(report.repro.sessionStrategyVersion).toBeNull()`（`:75`） | 同族 |

**不会红（工单点名要核的）**

- `apps/api/tests/obs/l2-stale.test.ts` —— 与指纹函数零耦合（§3.5）。
- `apps/api/tests/docs-guard/gold-review-guard.test.ts` —— 第一个 it 只在「同文件里 `gold.yaml` 字面量与写文件 API 出现在 200 字符邻域」时红（`:69-85`）。**新增「读 gold 算哈希」的代码不会红**；但要注意实现分布：`run-l2-golden.ts` 已有 `writeL2Report`（`writeFileSync`），今天之所以能过，是因为 gold 路径字面量只出现在 `apps/api/src/eval/l2-gold.ts`（`defaultL2GoldPath`）而该文件**没有**写 API。**若把 `gold.yaml` 路径字面量写进 `run-l2-golden.ts` 的写文件函数附近，就会红。**
- `apps/api/tests/docs-guard/delivery-s05.test.ts` / `auth-enforce-pilot.test.ts` —— 与 L2 报告无关。
- `apps/api/tests/eval/http-eval-runs.test.ts` —— 只有改**内口 response 键**才红（`it('internal execute-ask 口令对才跑；空口令 503；错口令 401')`、`it('internal execute-ask 带回 graph.minSupport')`、`it('internal execute-ask 可带 sessionWindow 且回 rewriteUsed')`）；不改内口则不动。

### 4.3 在 `L2Report`（api）或 `L2BatchReport`（worker）上加**必填**字段，一次性打红哪些报告字面量

**结论：只有一处 —— `apps/api/tests/eval/l2-cli.test.ts` 的局部 helper `sampleReport()`（`:476-492`）。**

- 它是全仓**唯一**手写完整 `L2Report` 字面量的地方（核法：grep `nearCorefPassDen` 全仓，非 runner 产出的报告字面量仅此一处；`l2-near-coref-rate.test.ts:98`、`l2-gold.test.ts:61`、`http-eval-runs.test.ts:361` 都是 **gold 文件字面量**，不是报告）。
- 因是**被多个 it 共用的 helper**，编译期会一次性打红 3 个 `it`：
  1. `it('maps report → session_multiturn; signoff 0; matrix 0; coverage null; ranAt local')`
  2. `it('live report still maps signoffEligible to 0 unless report says true')`
  3. `it('reportJson.l2Fingerprint matches current prompt+empty model; signoff stays 0')`
- **worker 侧 `L2BatchReport`：零处报告字面量**（`run-l2-batch.test.ts` / `run-l2-batch-near-coref-rate.test.ts` / `consumer.test.ts` 全部经 `runL2Batch` 产出，或只持类型引用）。所以在 worker 报告类型上加必填字段**不会**因字面量红。
- **真正的大爆炸点不是报告类型，是图/服务返回类型**：`AskGraphResult`（`state.ts:99-128`）或 `ExecuteAskResult`（`services/ask/execute.ts:40-45`）加必填键会打红一批手写字面量，例如 `apps/api/tests/eval/l2-cli.test.ts:96-131`（`answered()`）、`apps/api/tests/eval/l2-near-coref-rate.test.ts:108-127`（`askResult()`，含 `evidence_snapshot: []`）、`apps/api/tests/eval/l1-repro-fields.test.ts:82`、`apps/api/tests/obs/tracer.test.ts:140,232`、`apps/api/tests/obs/rate-limit.test.ts:98`、`apps/api/tests/obs/quota-planes.test.ts:108`、`apps/api/tests/eval/http-eval-runs.test.ts:262,333,429`。

### 4.4 `L2BatchReport`（worker）与 `L2Report`（api）逐字段对照

| 键 | `L2Report`（`run-l2-golden.ts:62-84`） | `L2BatchReport`（`run-l2-batch.ts:42-64`） |
|----|--------------------------------------|-------------------------------------------|
| `run_type` | ✓ `'session_multiturn'` | ✓ |
| `signoffEligible` | ✓ | ✓ |
| `evalRunId?` | ✓（persist 后回填，`:386-389`） | ✗ |
| `retrieve_mode` | ✓ | ✗ |
| `mode` | ✓（= `retrieve_mode` 的历史别名） | ✗ |
| `retrieveMode` | ✗ | ✓ |
| `rewriteEnabled` | ✓（`resolveRewriteEnabled`，`:133-140`） | ✗ |
| `ranAt` / `kbId` / `caseCount` / `passCount` / `failCount` / `errorCount` / `zeroToleranceHits` | ✓ | ✓ |
| `nearCorefPassRate` / `nearCorefPassDen` | ✓（含同一段注释） | ✓（同一段注释，逐字复制） |
| `cases` | `L2CaseRow`（`:49-60`） | `L2BatchCaseRow`（`:31-41`） |

**只有一侧有的键**：api → `evalRunId` / `retrieve_mode` / `mode` / `rewriteEnabled`；worker → `retrieveMode`（与 `retrieve_mode` 语义同、名字不同）。
**`L2CaseRow` vs `L2BatchCaseRow`**：逐字段重复定义（`id`/`type`/`verdict`/`lastStatus?`/`lastReason?`/`rewriteUsed?`/`historyInEvidence`/`expectedThemePersist`/`failReasons`/`errorMessage?`），**不是共享类型**。这是「两侧同构靠人维护」的直接物证；同样地 `L2Verdict` 也在两侧各定义一次（`run-l2-golden.ts:46`、`run-l2-batch.ts:13`）。
**`persist.ts` 白名单与两侧类型的差异点**：白名单（`apps/worker/src/eval/persist.ts:165-178`）只覆盖 `L2BatchReport` 的子集，且**把 `retrieveMode` 改名成 `retrieve_mode` 落库**；`ranAt` 经 `evalRunDbRanAt` 转本地格式串（`:37-40`）。api 侧 insert 走 `buildL2EvalRunInsert`（含 `matrixA-D=0`、`coverage=null`、`runType='session_multiturn'`、`reportJson={...report, l2Fingerprint}`），worker 侧 saveL2Report 也写 `matrixA-D=0`/`coverage=null`，但 `reportJson` 是白名单 —— 两侧落库路径**不是同一个函数**。

### 4.5 `packages/contracts` 的导出面 + L2 新增哈希该走哪条子路径

- `packages/contracts/src/index.ts:19-25`：
  ```ts
  export * from './eval/l1-matrix.js';
  export * from './eval/l2-gold.js';
  export * from './eval/l2-matrix.js';
  ```
  即 `l1-matrix` / `l2-gold` / `l2-matrix` **都从主入口导出**。
- `packages/contracts/package.json` 的 `exports` 只有三条：`"."` → `src/index.ts` · `"./eval-repro"` → `src/eval/l1-repro.ts` · `"./testing"` → `src/testing.ts`。**没有 `./eval` / `./eval/*` 通配。**
- **`node:crypto` 进客户端图的真实路径**：`apps/web/next.config.ts:10` 与 `apps/admin/next.config.ts:10` 都是 `transpilePackages: ['@strict-rag/ui', '@strict-rag/contracts', ...]`，web/admin 大量文件 `import ... from '@strict-rag/contracts'`（如 `apps/web/src/api/ask.ts`、`apps/admin/src/auth/api.ts`）→ 主入口进客户端图；主入口 `export *` 会把 `l2-matrix.ts` / `l2-gold.ts` 拉进图。
- **结论**：L2 新增哈希若用 `node:crypto`（建议与 L1 同实现，`sha256Hex`），**必须**走子路径导出。**最省事的路径是复用现成的 `@strict-rag/contracts/eval-repro`**（`l1QuestionIdsHash` 已在那里、已被 api/worker 双向 import：`run-l1-golden.ts:11-16`、`run-l1-batch.ts:30-34`）。**禁止**在 `l2-matrix.ts`（主入口可达）里 `import { createHash } from 'node:crypto'` —— `l1-repro.ts` 文件头 `:3-7` 已把这个坑写死为纪律。

---

## 5. 离线可做边界（哪几样能补成真判据 / 只能到「有原料但没人判」）

**腿 A：采集面**
- **能补成真判据**（口径现成 + 数据可得）：
  1. worker L2 通道补 `evidenceDocIds`（内口已下发，改执行器 3 行 + 类型 + 测例）；
  2. `answerKind` + `citationCount` 同理 → 接现成的 `citationCompleteRate`（`packages/contracts/src/eval/l1-matrix.ts:141-165`，口径与 api/worker 共用，禁止单边另写）；
  3. `minSupport` 同理（`parseMinSupport` 现成）。
- **只能到「有原料、没人判」**：
  4. `expectedDocIds` 命中率 —— 采集能补，但**判据今天不成立**（`l2-corpus/*` 未入库 + 逻辑 id 无映射载体 + 无 per-turn 标注）。补完只会得到一个**看起来像判据的恒零**。

**腿 B：零容忍**
- **能补成真判据**：只有「历史文本不进 evidence」这条，且能扩到 assistant 文本（§2.1）。**但要说清它的语义**：抓的是「evidence 正文里出现历史原话」＝语料撞词，不是「图把聊天当证据」（后者结构上不可能，§2.2）。
- **补不了（如实说没原料）**：
  - `min_support` 维度：claim 原文不进 `AskGraphResult`，**无量**（§2.3）；
  - 主题粘连：图上无「主题」字段，**无量 + 无定义**；
  - 冲突数字：有 `answer` 文本 + 语料数字，但**无标注、无规则**，属新判据开发；
  - 跳过 verify：无「调用过 verify」布尔，靠 `reason` / `debug.llmCalls` 反推都是**形似**（§6）。

**腿 C：§8 字段**
- **能补成真判据（真值可取）**：L2 题面 id 哈希（复用 `l1QuestionIdsHash`）· L2 剧本集哈希（同一函数或逐字节口径，二选一并写清）· `models.env`（读 env）· `models.kbBindings`（api 侧读库）· `retrieveK` / `rerankTopN`（api 侧由 `graph.mode` → `retrieveBudgetForMode` 派生，L1 已有先例）。
- **只能 `null`**：`seed` / `promptVersions` / `sessionStrategyVersion` / `fallbackChainsVersion` / `lifecycleFilterVersion` / `crag` / `contextMode`（无载体；且把「无载体」类型钉成 `null` 字面量是好设计，别改）。
- **worker 侧额外限制**：`mode` 不在 L2 回合类型里，且 `saveL2Report` 白名单不含新键 → worker 侧 §8 区块今天基本取不到（要么改类型+白名单，要么 worker 只落它取得到的）。

---

## 6. 反直觉发现（给主控）

1. **工单说「20 条 case」，实测 18 条**（`ConvertFrom-Json` 实测 `cases.Count = 18`），全部带 `expectedDocIds`，共 25 个逻辑 id。题量口径不先对齐，「≥15 门」的余量（现仅 3 条）会算错。
2. **「补采集面就能判命中」是错觉**：`l2-corpus/*` 三篇**没有任何入库入口**（`demo-ingest.mjs` 只吃 `fixtures/ingest-samples`），`documents` 表**没有 `external_id` 之类的映射列**，全仓也没有映射文件 / env / 表。差的是**语料入库 + 映射账本**两件数据工程，不是代码里的一个字段。
3. **但 api 侧采集面其实早已具备**：`apps/api/src/routes/eval.ts:334` 每一次内部 execute-ask 都在下发 `evidenceDocIds`；`run-l2-golden.ts:309` 只是没 map 它（`e.docId` 就在同一行）。真正的断点在 **worker 的 `L2TurnExecuteResult` 类型**——它把内口已下发的 4 个键挡在门外。
4. **「历史文本进 evidence」在今天的图上结构上不可能**（evidence 唯一写点 = retrieve 结果，`run.ts:332-351`）。所以这条零容忍的机械检查抓到的是「语料撞词」而非「图把聊天当证据」。把「恒 0」当成「零容忍已覆盖」是自欺；反过来，若真去修它，也没有可修的对象。
5. **worker 侧加字段不会被编译器或现有测试拦住**：`saveL2Report` 是手写白名单，新字段静默丢弃、0 测试红（`module-status/worker.md` 自己承认这条靠「同构测例」的人肉纪律）。api 侧是 `{...report}` 直落 —— **同一份报告在两侧归档的键集天然不同**（api 有 `l2Fingerprint`、worker 没有）。
6. **`evaluateL2Stale` 今天没有任何生产调用点**（只被测试与 `obs/index.ts` 再导出引用）：`l2_stale` 这条告警是「函数在、线没接」。所以「改指纹会不会连带打红 l2-stale 测例」的答案是**不会**（该测只喂字面量字符串）。
7. **「必填字段打红报告字面量」的实际规模很小**：api **一处 helper → 3 个 it**；worker **零处**。真正的大爆炸点是改 **`AskGraphResult` / `ExecuteAskResult`**（一堆测试里手写的 `evidence_snapshot: []`）。
8. **两侧「同构」是纪律不是类型**：`L2CaseRow` / `L2BatchCaseRow` / `L2Verdict` / 报告类型都是**逐字段复制两份**（连注释都逐字复制）。任何「保持两侧同构」的改造都会踩同一个坑：类型不会替你告警。
9. **落库的 evidence 快照没有正文**（`EvidenceSnapshotItem` 无 `text`，`toEvidenceSnapshot` 只落 `preview`）。所以「从 `ask_traces` 反推 L2 命中 / 泄漏」这条路今天不通，必须在活体回合里采。

---

## 未核实清单（明确标注）

- `evaluateL2Stale` 是否存在**动态 / 间接**生产调用（静态检索范围内为零：`obs/index.ts` 再导出 + 测试；未查运行时调用图 / 无生产证据）。
- `.trellis/spec/` 其余包（如 `guides/`）是否另有 L2 采集口径文档（本报告只读了 `spec/api/backend/l2-eval.md`）。
- `l2NearCorefPassRate` / L2 报告字段是否被 `apps/admin` / `apps/web` 前端消费（grep 未见）。
- `fixtures/l2/corpus/*.txt` 三篇正文的完整数字清单（本地检出的控制台编码把正文显示为乱码；已确认的可用数字：travel-stay 一线 600 / 其它 400，meal-allowance 一线 120 / 其它 80；leave-policy 的年假/病假天数未逐字校对）。
