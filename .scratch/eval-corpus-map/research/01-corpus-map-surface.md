# 工单 01（research）：评测语料入库与逻辑 id 映射——现状面核实

> 只读核实；结论一律带路径 + 行号 + 原样形状。逐条对应工单 8 组问题。
> 机械统计用 `node -e` 对夹具跑（gold.yaml 是 JSON 形内容）。本文件不改任何仓库文件。

---

## 1. 夹具的逻辑 id 面

**一句话结论**：L1 = 60 题但**仅 30 题**带 `expectedDocIds`（去重 10 个逻辑 id，30 处引用）；L2 = 18 题**全部**带（去重 6 个逻辑 id，25 处引用）；两侧**有 3 个逻辑 id 交叉**（`ingest-samples/01-doc`…`03-doc`），且 L1 / L2 用两套独立 KB env，故映射账本应「按 KB 分辨」，不是「全局一份」。**地图 `map.md:49` 写的 L1「全部带 `expectedDocIds`」与事实不符。**

### 1.1 机械统计（`node -e` 实跑）

```
fixtures/l1/gold.yaml  cases 60  withExpectedDocIds 30  totalRefs 30  distinct 10
  无 expectedDocIds 键的 case = 30（unanswerable 27 + false_premise 3）
  type 分布 = {answerable:30, unanswerable:27, false_premise:3}
  ids = ingest-samples/01-doc … ingest-samples/10-doc（每个 3 处引用）
fixtures/l2/gold.yaml  cases 18  withExpectedDocIds 18  totalRefs 25  distinct 6
  ids = ingest-samples/01-doc(3) · 02-doc(1) · 03-doc(1)
       + l2-corpus/travel-stay(8) · l2-corpus/meal-allowance(7) · l2-corpus/leave-policy(5)
交叉 = [ingest-samples/01-doc, ingest-samples/02-doc, ingest-samples/03-doc]
```

- L1 夹具形状：`fixtures/l1/gold.yaml` 顶层键 `['version','description','cases']`；题形见 case 样本
  ```json
  { "id": "l1-ans-001", "type": "answerable",
    "expectedDocIds": ["ingest-samples/01-doc"], "rubric": "…" }
  ```
- L2 夹具形状：`fixtures/l2/gold.yaml` 顶层键 `['version','run_type','description','signoffEligible','cases']`；`expectedDocIds` 是 **case 顶层**字段（不是 `expected` 内），见 `packages/contracts/src/eval/l2-gold.ts:174-176`（`if (row.expectedDocIds !== undefined) out.expectedDocIds = parseDocIds(...)`）。

### 1.2 逻辑 id ↔ 文件的绑定关系（README 表格）

- L1：`fixtures/l1/README.md:20-24` —— 表格「逻辑 id | 对应文件」：
  `ingest-samples/01-doc … 10-doc` ↔ `fixtures/ingest-samples/01-doc.txt … 10-doc.txt`。
- L2：`fixtures/l2/README.md:54-59` —— 同一张表；L2 额外 3 行 `l2-corpus/travel-stay|meal-allowance|leave-policy` ↔ `fixtures/l2/corpus/*.txt`。
- 除 README 表格外**无**任何机器可读绑定（无映射文件 / 无 `external_id` 列）。

### 1.3 该「一份」还是「两份」

- 两侧逻辑 id 语义同源（`ingest-samples/*` 共用），但**跑批侧 KB 是两个独立 env**：L1 用 `L1_KB_ID`（`apps/api/src/scripts/run-l1-golden.ts:805`），L2 用 `L2_KB_ID`（`apps/api/src/scripts/run-l2-golden.ts:178`）。
- 因此**同一逻辑 id 在不同 KB 里解析出的 uuid 不同** → 账本必须能按 KB 分辨（**按 KB 一份**，或一份内以 KB 为键）；若两批共用**同一个** KB，则一份账本可同时覆盖 13 个逻辑 id。裁定留工单 02。

---

## 2. 语料入库的现成面（`scripts/demo-ingest.mjs`）

**一句话结论**：`demo-ingest.mjs` 只吃 `fixtures/ingest-samples`（:`34`），但**已能拿到真 `docId`**；它缺的三件事是：不吃 `l2/corpus`、不落映射、每次新建 KB。

### 2.1 前置链与产出

| 步 | 证据（`scripts/demo-ingest.mjs`） |
|---|---|
| `GET /health` | `:78` |
| `GET /ready`（须 ready:true） | `:85-89` |
| `POST /auth/admin/dev-login`（201） | `:92-104`（拿 `accessToken` + `session.userId`） |
| `POST /knowledge-bases`（201） | `:114-116`，`name: demo-kb-${Date.now()}`（**每次新 KB**），拿 `kbId` |
| 逐文件：`upload-url`(201) → `PUT`(200) → `complete`(200) → `approve`(200) → `scan`(200) | `:127-150` |
| 轮询 `GET /documents/:id` 至 `ready` | `:185-198` |
| 逐篇 `PATCH /documents/:id/lifecycle {active}` | `:210-215` |
| `GET /knowledge-bases/:kbId/documents` 断言 ready/active 计数 | `:218-223` |
| 负例：未批 scan → 403 FORBIDDEN | `:157-174` |

### 2.2 `upload-url` 回包字段 与 `title`

- 回包字段（除 `docId`）：`uploadUrl` / `method` / `objectKey` / `maxBytes`。
  - 契约：`packages/contracts/src/ingest/document.contract.ts:57-64`
    ```ts
    export const UploadUrlResponseSchema = z.object({
      docId: z.string().uuid(), uploadUrl: z.string().min(1),
      method: z.string().min(1), objectKey: z.string().min(1),
      maxBytes: z.number().int().positive() });
    ```
  - 路由构造：`apps/api/src/routes/documents/index.ts:211-217`。
- `title` 取自文件名去扩展名：`scripts/demo-ingest.mjs:125` `const title = path.basename(file, '.txt');`。
- `docId` 在 `:131` 解构、`:152` 入 `docIds`、`:153` 打印 `enqueued <title> → <docId>`。

### 2.3 各步幂等性（源码判定）

| 步 | 幂等？ | 证据 |
|---|---|---|
| `upload-url` | **否** | 每次 `uuidv7()` 新 `docId` + `insertUploadedDoc` 新行：`apps/api/src/routes/documents/index.ts:200-214`；`services/documents.ts:125-150` |
| `PUT` 对象 | 是 | 按 `objectKey` 覆盖写（同 key） |
| `complete` | **危险** | `markCompletePending` 把 `status` 重置回 `uploaded` 且 `approvalStatus` 回 `pending`：`services/documents.ts:160-185` —— 对已 ready 文档重跑会把状态打回 |
| `approve` | 是 | 已 `approved` 直接 200：`routes/documents/index.ts:457-460` |
| `scan` | **否** | 只 `enqueueIngest`，重复调用再入队一个新 job：`routes/documents/index.ts:539-550` |
| `lifecycle→active` | 是 | 需 `canBecomeActive(status)`=ready：`routes/documents/index.ts:581`；`gates/approval-scan.ts:13-15` |

> 另注：`demo-ingest` 的 `upload-url`/`complete`/`approve`/`scan` **未带 auth 头**（只有 `create-kb` 带），依赖 `AUTH_ENFORCE=false`。

### 2.4 三件「没做」的事 + 最小改法

1. **不吃 `fixtures/l2/corpus`**：`FIXTURES_DIR` 写死 `fixtures/ingest-samples`（`:34`）。最小改法：新增/改造脚本，除 `ingest-samples/*.txt` 外再遍历 `fixtures/l2/corpus/*.txt`，并用目录前缀拼逻辑 id（`ingest-samples/<name>` / `l2-corpus/<name>`），与两份 README 表一致。
2. **不落映射**：`docIds` 只留在内存（`:122`），随进程退出蒸发。最小改法：跑完把 `{ 逻辑 id → docId }` 落成账本文件（数据源 = 循环里的 `(逻辑id, docId)`，或事后 `GET …/documents` 对账）。
3. **每次新建 KB**：`:115` `demo-kb-${Date.now()}`。最小改法：允许经 env 传入既有 `kbId`（缺省才新建），并把 KB id 打到 stdout 供 `L1_KB_ID`/`L2_KB_ID` 复用。

### 2.5 可复用的 KB/登录/轮询片段

- `scripts/seed-demo.mjs`：dev-login `:54-60`、create-kb `:63-69`、upload/complete `:70-91`、approve/scan `:91`、轮询 ready `:93-107`、PATCH active `:108-112`，**并打印 `SEED_KB_ID` / `SEED_DOC_ID`**（`:113-114`）。
- `scripts/smoke-half.mjs`：dev-login(201) `:68-79`、create-kb `:82-87`、**四眼审批**（先断言自审 403，再换 `half-smoke-reviewer` `kb_admin`）`:108-133`、轮询 `:138-153`、PATCH active `:156-162`、ask 断言 citations 含本 docId `:165-177`。
- 两者都复用同一 `api()` 薄封装与 `assertOk`。

---

## 3. 跑批侧的入参面

**一句话结论**：L1 走 env（`L1_KB_ID` 必填）+ 唯一 CLI flag `--human-spot`；L2 走 env（`L2_KB_ID` 必填）；`expectedDocIds` 进 `hitAtKCase` 有 **4 处**（api L1 / worker L1 / api L2 / worker L2）；加「映射账本路径」参数 + 「映射来源」报告键会打到一批**字面量构造报告对象**的测例。

### 3.1 `run-l1-golden.ts` 全部 env / CLI

| 键 | 必填 | 行为/缺省 | 证据 |
|---|---|---|---|
| `L1_KB_ID` | **是** | 缺 → exit 2 | `apps/api/src/scripts/run-l1-golden.ts:805-808` |
| `L1_MAX_CASES` | 否 | 正整数截断；非法 → exit 2 | `:810-814` |
| `L1_GOLD_PATH` | 否 | 默认 `fixtures/l1/gold.yaml` | `:817`（`defaultGoldPath` `:289-291`） |
| `L1_OUT_DIR` | 否 | 默认 `<repo>/artifacts` | `:818`（`defaultOutDir` `:293-295`） |
| `L1_TENANT_ID` / `L1_USER_ID` | 否 | dev uuid 缺省 | `:628-629` |
| `L1_PERSIST_EVAL` | 否 | `1`/`true` → 写 `eval_runs` | `:749-751` |
| CLI `--human-spot <path>` / `--human-spot=<path>` | 否 | 不传 = 缺测；其他键忽略 | `parseL1CliArgs` `:202-224` |

- gold 加载点：`loadGold()` `:369-430`（只认 `answerable|unanswerable|false_premise`，`parseExpectedDocIds` 转 `expectedDocIds`），在 `runL1Golden` 内 `:615` 调用。

### 3.2 `run-l2-golden.ts` 全部 env / CLI

| 键 | 必填 | 行为/缺省 | 证据 |
|---|---|---|---|
| `L2_KB_ID` | **是** | 缺 → exit 2 | `apps/api/src/scripts/run-l2-golden.ts:178-181` |
| `L2_MAX_CASES` | 否 | 正整数；非法 exit 2 | `:182-187` |
| `L2_GOLD_PATH` / `L2_OUT_DIR` | 否 | 默认同 L1 | `:533-534` |
| `L2_TENANT_ID` / `L2_USER_ID` | 否 | dev uuid | `:334-335` |
| `L2_REWRITE_ENABLED` | 否 | 仅本跑注入 `rewriteEnabled` | `:190-196` |
| `L2_PERSIST_EVAL` | 否 | `1`/`true` → 写 `eval_runs` | `:511` |

- gold 加载点：`loadL2Gold` `:331`。

### 3.3 `expectedDocIds` 进 `hitAtKCase` 的全部位置

```
apps/api/src/scripts/run-l1-golden.ts:669   const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);
apps/worker/src/eval/run-l1-batch.ts:176    const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);
apps/api/src/scripts/run-l2-golden.ts:432   const docHit = hitAtKCase(c.expectedDocIds, evidenceDocIds);
apps/api/src/scripts/run-l2-golden.ts:456   const docHit = hitAtKCase(c.expectedDocIds, []);   // error 行
apps/worker/src/eval/run-l2-batch.ts:193 / :219  （L2 worker 同构）
```
纯函数本体唯一：`packages/contracts/src/eval/l1-matrix.ts:111-127`。

### 3.4 被**字面量**测试钉住的报告键

- **L1**：三处 `const report: L1Report = { … }` 全键字面量构造 —— `apps/api/tests/eval/l1-cli.test.ts:228`、`:275`、`:620`（少一个必填键 = TS 编译红）。`l1-human-spot-cli.test.ts:265` 只做 `as L1Report` 断言、不构造。
- **L2**：`apps/api/tests/eval/l2-cli.test.ts:477-503` 的 `sampleReport()` 全键字面量 —— 给 `L2Report` 加必填键会让它 TS 红；且 `:528-534` 断言 `reportJson` 里 `docHitRate/docHitHits/docHitScored/citationComplete/citationCompleteDen/zeroToleranceCoverage` 逐个存在。
- **repro 键集**：`apps/api/tests/eval/l1-repro-fields.test.ts:236` / `:273`（`Object.keys(report.repro)` 里不得出现 `mode` / `retrieve_mode`）；`packages/contracts/tests/eval/l1-repro.test.ts:67-89` 用 `Object.keys(emptyL1Repro()).sort()` **精确等值**钉 14 个键。
- **L2 同构锚点**：`packages/contracts/src/eval/l2-matrix.ts:93-101` `L2_EVIDENCE_REPORT_KEYS`（7 键）；被 `packages/contracts/tests/eval/l2-evidence-fields.test.ts:71` 精确等值、`apps/worker/tests/eval/run-l2-batch-evidence-collection.test.ts:250/269`、`apps/api/tests/eval/l2-evidence-collection.test.ts:209` 逐键断言。

---

## 4. 报告的严格面

**一句话结论**：L1 `repro`（`L1Repro`）与顶层 `mode`/`retrieve_mode` **没有**现成槽位承载「映射来源」三态，必须**新增键**；L1 落库有两条路，api CLI 走「整对象直落」（无白名单），worker 走**逐键白名单** `saveReport`。

### 4.1 现有形状

- `repro` 形状 = `packages/contracts/src/eval/l1-repro.ts:74-102` 的 `L1Repro`，键：`seed` · `models{env{chat,embed,rerank},kbBindings}` · `fallbackChainsVersion` · `retrieveK` · `rerankTopN` · `tauClaim` · `crag` · `contextMode` · `promptVersions` · `questionIdsHash` · `calibrationHash` · `lifecycleFilterVersion` · `sessionStrategyVersion` · `l2GoldSetHash`。`emptyL1Repro()` `:106-122`。
  - 文件头显式**排除** `mode`（`:8-12` 注释：「区块内**没有** `mode` 键 … 不许在本区块里再造一个第二源」）。
- `mode` / `retrieve_mode` 是 L1Report **顶层**且同值：类型 `run-l1-golden.ts:96-100`；赋值 `:713-715`（`mode` 与 `retrieve_mode` 都取 `resolveEvalMode(opts.esMode)`）。

### 4.2 有无现成槽位

**无。** `L1Repro` 无任何「来源 / 映射 / ledger」键；顶层 `mode` 语义是检索模式（mock/live/unknown），与「映射来源」正交。→ **必须新增键**。候选落点两种，各有代价：① 顶层 `L1Report` 新键；② `repro` 内新键（但 `repro` 键集被 `l1-repro.test.ts:69` 精确等值钉住，且设计上明令「不进第二源」，放通用来源字段需慎重）。裁定留工单 02。

### 4.3 落库白名单（worker 侧）

- **L1 worker**：`saveReport` 是**逐键白名单** —— `apps/worker/src/eval/persist.ts:104-145` 把 `reportJson` 逐键抄出（`retrieveMode`/`signoffEligible`/`caseCount`/`matrix*`/`coverage`/`errorCount`/`ranAt`/`reportJson{mode,retrieve_mode,signoffEligible,ranAt,caseCount,answerableCount,unanswerableClassCount,matrix,coverage,hitAtK,hitAtKHits,hitAtKScored,tauStar,tauSweep,judgeAuroc,judgeAurocScored,judgeAurocSource,citationComplete,citationCompleteDen,humanSpot,repro,errorCount,cases,kbId}`）。**新键不抄 = 库内静默丢失**。
- **L1 api CLI**：走 `buildEvalRunInsert` `run-l1-golden.ts:233-258`，其中 `reportJson: report`（`:257`）**整对象直落**，无白名单 → api 侧新键自动带上。
- **L2 worker**：`saveL2Report` 同为逐键白名单 `apps/worker/src/eval/persist.ts:148-188`；两侧锚点 `L2_EVIDENCE_REPORT_KEYS`。加 L2 键须**三处齐改**（名单 + 白名单 + 两侧同构测例）——见 `docs/module-status/worker.md:110`。

---

## 5. 账本要写什么才「可核对」

**一句话结论**：`documents` 有稳定锚（`id`/`kbId`/`title`/`createdAt`/`status`/`lifecycle`）+ `checksumSha256`；`GET …/documents` 回包**不含** `createdAt`/`kbId`/`checksumSha256`、且**无分页**（返回全量），可做「账本↔库内」的 id+title 对账；`artifacts/` 整目录 gitignore（0 跟踪），`.scratch/` 被 git 跟踪。

### 5.1 `documents` 表稳定字段（`packages/db/src/schema/kb/documents.ts`）

| 列 | 行 | 备注 |
|---|---|---|
| `id` | `baseColumns`（`_shard/base-columns.ts:11-15`） | uuid v7，主键 |
| `tenantId` | `:11` | |
| `kbId` | `:12` | |
| `title` | `:13` | notNull |
| `status` | `:14` | 管线状态，默认 `uploaded` |
| `approvalStatus` | `:17` | none/pending/approved/rejected |
| `lifecycle` | `:20` | draft/active/superseded/archived |
| `objectKey` / `contentType` / `byteSize` / `checksumSha256` | `:23-26` | |
| `indexVersion` / `activeIndexVersion` | `:31` / `:39` | |
| `createdAt` / `updatedAt` | `baseColumns:16-29` | 本地格式串 |

### 5.2 `GET /knowledge-bases/:kbId/documents` 回包与分页

- 路由：`apps/api/src/routes/documents/index.ts:143-173`，返回 `ok(c, visible.map(toListItem))`（`:171`）。
- 列表项 = `DocumentListItem`（`packages/contracts/src/ingest/document.contract.ts:184-217`）经 `toListItem`（`apps/api/src/routes/documents/mappers.ts:42-67`）映射。
  - **包含**：`id` / `title` / `status` / `approvalStatus` / `submittedBy` / `lifecycle` / `byteSize` / `indexVersion` / `errorCode` / `embedReady` / `esReady` / `ownerDeptId` / `visibilityLevel` / `docType` / `chunkStrategy` / `chunkStrategyParams` / `aclPrincipals` / `effectiveFrom` / `effectiveTo` / `supersedesDocId` / `supersededByDocId`。
  - **不含**：`createdAt` / `updatedAt` / `kbId` / `tenantId` / `checksumSha256` / `objectKey`。（`toDetail` 才补 `tenantId`/`kbId`/`createdAt`/`updatedAt`：`mappers.ts:69-79`，经 `GET /documents/:docId`。）
- **分页：无。** `listDocsByKb` 直接 `select().from(documents).where(eq(documents.kbId, kbId))` 全量返回（`apps/api/src/services/documents.ts:116-118`），路由也**不读** `page`/`limit`/`cursor`。→ 对账语义 = 「一次拿全库列表，按 id/title 与账本比对」。
- 回包信封：`ok(c,data)` → `buildSuccess(data, meta)`（`apps/api/src/lib/response.ts:37-39`）；`data` 即数组。

### 5.3 「映射是否新鲜」可用的校验面

- **KB 被换**：账本记 `kbId`，跑批时与 `L1_KB_ID`/`L2_KB_ID` 比对（KB id 必须全等）。
- **文档被删 / 换**：账本记每个 `docId`；用 `GET …/documents` 全量列表核对 `id` 是否仍在、`title` 是否仍匹配。
- **夹具文件被改**：账本记**语料指纹**（`fixtures/ingest-samples/*.txt` / `fixtures/l2/corpus/*.txt` 的 sha256，或与 `checksumSha256` 对齐）。仓库已有 `l1QuestionIdsHash`/`l1CalibSetHash`（`packages/contracts/src/eval/l1-repro.ts:29-49`）可作哈希口径先例；`documents.checksumSha256`（`:26`）为入库对象 sha256。
- 账本还需记录：**生成时刻**（ISO）、**逻辑 id → docId 全表**、**KB/租户**。

### 5.4 `artifacts/` gitignore 语义 与 既有证据约定

- `.gitignore:15-16`：
  ```
  # L1 eval last-run reports (fixtures/l1/sample-report.md is committed)
  artifacts/
  ```
  → `artifacts/` **整目录忽略**，`git ls-files artifacts` = **0**。故账本若落 `artifacts/` 属「不入库的运行产物」。
- `.scratch/` **未被忽略**，已被 git 跟踪（`git ls-files .scratch` = 263 文件）。
- `docs/ops/real-stack-evidence.md` 的记证据方式：**committed markdown 正文**记结论表（`:12-19`），**链接到 `.scratch/<图>/research/*.md` 逐项取证**（`:8-10`）；明确「此页任何数字都不得进签字包」（`:6`），复现命令写 §5（`:66-71`）。→ 可作「真栈实测记录」的写法先例。

---

## 6. KB 绑定

**一句话结论**：KB 目前以 env `L1_KB_ID` / `L2_KB_ID` 传入；语料入库脚本会 created 新 KB 并打印 id（`demo-ingest` `:226-227` 打印 `kbId=`，`seed-demo` `:113` 打印 `SEED_KB_ID=`），但**没有任何自动接线**把入库 KB 交给跑批 env —— 靠人手工粘贴。

- 传入口：`L1_KB_ID`（`run-l1-golden.ts:805`）、`L2_KB_ID`（`run-l2-golden.ts:178`）。
- 建 KB 并打印：`scripts/demo-ingest.mjs:114-116`（`name: demo-kb-${Date.now()}`）+ `:226-227`（`log('kbId=${kbId}')`）；`scripts/seed-demo.mjs:63-69` + `:113`（`SEED_KB_ID=`）。
- `docs/ops/` 现有配方的最适合插入点：**`docs/ops/operable-stack.md` §3「业务进程」**（`:44-68`，列了 `pnpm db:migrate` / `pnpm up:apps` / `pnpm smoke:half`）——在此加一条「建语料 KB + 出账本」（新脚本 + 输出 `kbId` 与账本路径），随后 §「链路」`half-smoke.md` 命令段（`:18-22`）、`real-stack-evidence.md` §5（`:66-71`）呼应。

---

## 7. 口径核对（Hit@20 恒 0 链 + `hitAtK==null` 可达性）

**一句话结论**：链**逐跳成立**，但**地图把 L1 的计分题数写成 60**——实际 `scored = 30`（30 题带标注 / 60 题）。`hitAtK = 0/30 = 0`（非 null）→ `0 >= 0.7` 假 → `hit_at_k_below_min` → `businessPass` 恒 false。`hitAtK == null` 在今天**默认夹具下不可达**（只有「所有被跑题都无 `expectedDocIds`」才可达）。

### 7.1 逐跳证据

| 跳 | 证据 |
|---|---|
| 门限常量 | `apps/api/src/eval/adr046-snapshot.ts:27` `hitAt20Min: 0.7`（`PILOT_HARD_GATES`） |
| 判定 | `adr046-snapshot.ts:216` `const hitAtKOk = input.hitAtK == null \|\| input.hitAtK >= gates.hitAt20Min;`；`:217` `if (!hitAtKOk) reasons.push('hit_at_k_below_min');` |
| businessPass | `adr046-snapshot.ts:250-259`（含 `hitAtKOk`） |
| 计分 | `run-l1-golden.ts:669` `hitAtKCase(...)` → `:670` `accumulateHitAtK` → `:723` `hitAtK: hitAtKRate(hitAcc)` → `:783` 传 `bindQualitySnapshotToEval` |
| 纯函数 | `packages/contracts/src/eval/l1-matrix.ts:111-127`（只做 trim 后字符串全等 `expected.some(id => seen.has(id))`）；`:129-134`（`hit===null` 跳过、否则 `scored++`）；`:136-139`（`scored===0 → null`） |
| 实测侧 uuid 来源 | `run-l1-golden.ts:660-662` `evidenceDocIds = graph.evidence_snapshot[].docId` |

### 7.2 计分数 = 30（**非地图所写 60**）

- L1 夹具 60 题里**只有 30 题**有 `expectedDocIds`（§1.1）；其余 30 题 `parseExpectedDocIds` 得 `null` → `hitAtKCase` 返回 `null` → `accumulateHitAtK` **不** `scored++`。
- 故 `scored = 30`，`hits = 0`（逻辑 id 永不等于 uuid）→ `hitAtKRate = 0/30 = 0`（**非 null**）→ `0 >= 0.7` 假 → `hit_at_k_below_min`。
- 结论方向与地图一致（`businessPass` 恒 false），但**数值口径应为 30 不是 60**。

### 7.3 `hitAtK == null` 今天是否可达

- 可达条件：`hitAcc.scored === 0`（`l1-matrix.ts:137`），即**所有实际跑过的题都无非空 `expectedDocIds`**。
- 今天**默认夹具 + 默认参数下不可达**：gold 前 30 题都是 `answerable` 且带 id，且默认不截断（`run-l1-golden.ts:620`）→ `scored = 30 > 0`。
- 能让它变 null 的路径（皆非默认）：① `L1_GOLD_PATH` 指向一份全无 `expectedDocIds` 的 gold；② `L1_MAX_CASES` 截断到**不含任何带 id 题**的前缀（今天前 30 题都带 id，故 ≤30 截断仍 `scored>0`）；③ worker L1 侧 `gold_questions.expectedDocIds` 全为 null。→ 结论：**PRD「有标注时」的 null 出口今天不会被默认跑批触发**；缺映射时**必然**是 `scored>0` 且 `hits=0`（记 miss，不是 null），正合地图「不许把缺映射偷换成 null」的红线。

---

## 8. 侧证（module-status 与 coverage）

**一句话结论**：module-status/api.md 与 worker.md 对「逻辑 id 无 `external_id`、映射缺口」有明确措辞；coverage 的 C4 行标 `已测`（护栏已测，映射本身仍是人工步骤）、L2 行标 `部分测` 且把「逻辑 id → `documents.id` 映射」写作剩余阻塞方。

### 8.1 `docs/module-status/`

| 文件:行 | 现值要点 |
|---|---|
| `docs/module-status/api.md:146` | 「语料草案 `fixtures/l2/corpus/` **未**走 worker 入库；**逻辑 id → `documents.id` 映射缺**（`documents` 无 `external_id`）→ `docHitRate` 今天只能恒 0」 |
| `docs/module-status/api.md:184` | 评测硬门数据源债：「`docHitRate` 未映射恒 0（夹具写逻辑 id、`documents` 无 `external_id`）」等 |
| `docs/module-status/api.md:137` | businessPass 边界：Hit@k ≥ 试点下限（无标注题 → 该门不适用）；「默认配置下 `businessPass` 在生产路径上仍不可达」 |
| `docs/module-status/worker.md:91` | L2 报告面 worker 侧：「`docHitRate` 未映射时**恒 0**（夹具写逻辑 id、`documents` 无 `external_id`）→ 不得当成绩」 |
| `docs/module-status/worker.md:110` | `saveL2Report` 逐键白名单纪律：「漏键 = 新字段在库内静默丢弃、零测试红」 |
| `docs/module-status/README.md:77` | 观测/评测行：L1 有 `expectedDocIds` 时报告 Hit@k **并已进签字公式**（≥70%；无标注 → 不适）；L2 未映射 `docHitRate` 恒 0 |

### 8.2 `docs/testing/coverage/`（涉及 Hit@k / 逻辑 id 的行）

| 文件:行 | 现值 | 影子阻塞方 |
|---|---|---|
| `docs/testing/coverage/03-ops.md:18`（C4） | 覆盖 = **已测** | 缺口列：「逻辑 id→uuid 仍是**跑批前人工步骤**（`fixtures/l1/README.md:20-24`；`gold.yaml` 写逻辑 id，`run-l1-golden.ts:669` / `run-l1-batch.ts:176` 直比 `evidence.docId`）→ 未映射时 Hit@k 恒 0」 |
| `docs/testing/coverage/03-ops.md:20`（L2） | 覆盖 = **部分测** | 缺口②：「`docHitRate` 在夹具逻辑 id 未映射时恒 0（`fixtures/l2/corpus/*` 从未入库、`documents` 无 `external_id`）→ 不得当成绩，且不进判定」；**阻塞方：live 真跑 + 语料入库（逻辑 id → `documents.id` 映射）+ 人签，非离线可补** |
| `docs/testing/coverage.md:47` | 剧本 C 汇总行含「C4 Hit@k」 | — |
| `docs/testing/coverage.md:104` | 当前保持 `部分测` 的行，含 **L2**（「live 真跑归档 + 逻辑 id → `documents.id` 映射 + RACI 人签仍缺」） | 同上 |

---

## 不确定 / 未核实

1. **L1 报告里「映射来源」键的落点（顶层 vs `repro`）**：源码无既定先例；须工单 02 裁定。**需人裁**。
2. **账本文件位置与是否入库**：`artifacts/` 被 gitignore、`.scratch/` 被跟踪；把账本落哪、要不要 committed（供真栈证据文引用）**需人裁**（地图要「仓内可重复 + 可核对」，但未指定路径）。
3. **`GET …/documents` 是否需要新字段（如 `createdAt`）来对账**：今天列表项无 `createdAt`/`checksumSha256`；若只靠 `id`+`title` 对账够不够，**需人裁**。
4. **L2 语料 `l2-corpus/travel-stay` 等是否要与 L1 的 `ingest-samples/*` 入同一个 KB**：决定账本「一份/两份」。源码只给出两个独立 env，无既定口径；**需人裁**（与工单 02 相关）。
5. **真栈实测的 `hitAtK` 数字**：须起 Docker 真栈 + 真入库 + 跑 L1 CLI 才能取到。本票**只读、不起服务**，故未取。**需跑服务**。
6. **`demo-ingest` 缺 auth 头在 `AUTH_ENFORCE` 下会怎样**：源码显示 `upload-url`/`complete`/`approve`/`scan` 未带 auth（`demo-ingest.mjs:127-150`），但 `AUTH_ENFORCE` 打开后的实际 403/401 行为需跑服务确认。**需跑服务**（本图明确不改默认开关，故可能不在范围）。
7. **地图口径偏差的「是否为有意」**：`map.md:49` 的「全部带 `expectedDocIds`」与 `map.md:51` 的「scored = 60」与源码不符（见 §1、§7.2），我按「地图笔误」处理；若地图另有出处请指正。

---

## 对裁定与实现的影响

### 工单 02 必须裁的内容

1. **账本是「一份」还是「按 KB 一份」**：取决于 L1/L2 是否共用同一 KB（今天两个独立 env → 建议按 KB 分辨或账本内以 `kbId` 为键）。
2. **账本落点与是否入库**：`artifacts/`（gitignore，不入库）vs committed 文件（供 `docs/ops/real-stack-evidence.md` 引用）。
3. **「映射来源」三态落在哪个键**：顶层 L1 报告新键 vs `repro` 新键（`repro` 键集被精确等值钉住，且设计上禁「第二源」）；三态取值建议对齐既有三态范式（如 `judgeAurocSource`）。
4. **「映射账本路径」参数的形状**：env（如 `L1_LEDGER_PATH`/`L2_LEDGER_PATH`）vs CLI flag（今天 L1 只有 `--human-spot`）；取舍会影响 turbo.json env 声明。
5. **缺映射的逐位等价**：确认「缺映射 = 记 miss（`scored++` 且 `hits` 不加）」而非 `null`——这与 §7.3 一致，须在判定处**不动公式**。

### 工单 03 / 04 会碰到的回归面（加「账本参数 + 报告键」）

**A. TypeScript 字面量构造（加必填键即编译红）**

| 文件 | 位置 |
|---|---|
| `apps/api/tests/eval/l1-cli.test.ts` | `:228`、`:275`、`:620`（三处 `const report: L1Report = {…}`） |
| `apps/api/tests/eval/l2-cli.test.ts` | `:477-503` `sampleReport()` |
| （受牵连）`apps/api/tests/eval/l1-human-spot-cli.test.ts` | `:265` `as L1Report` 断言（值比对可能需同步） |

**B. 精确键集 / `Object.keys` 断言**

| 文件 | 位置 | 钉的是 |
|---|---|---|
| `packages/contracts/tests/eval/l1-repro.test.ts` | `:69-89` | `emptyL1Repro()` 键集**精确等值**（14 键）+ 无 `mode` |
| `apps/api/tests/eval/l1-repro-fields.test.ts` | `:236`、`:273` | `Object.keys(report.repro)` 无 `mode`/`retrieve_mode`；`repro` 无 `mode` |
| `packages/contracts/tests/eval/l2-evidence-fields.test.ts` | `:71`、`:88` | `L2_EVIDENCE_REPORT_KEYS` 精确等值与去重 |
| `apps/api/tests/eval/l2-evidence-collection.test.ts` | `:209` | `for key of L2_EVIDENCE_REPORT_KEYS toHaveProperty` |
| `apps/worker/tests/eval/run-l2-batch-evidence-collection.test.ts` | `:250`、`:269` | worker 白名单逐键 |

**C. worker 逐键白名单（漏键静默丢、零测试红）**

| 文件 | 位置 |
|---|---|
| `apps/worker/src/eval/persist.ts` | `saveReport` `:104-145`（L1）；`saveL2Report` `:148-188`（L2） |
| `apps/worker/tests/eval/run-l1-batch.test.ts` | `:65-71` 断言 `hitAtK`/`hitAtKHits`/`hitAtKScored`；新增 L1 键须在此补测否则无人守 |
| `apps/worker/tests/eval/run-l2-batch-repro.test.ts` / `l2-zero-tolerance-coverage.test.ts` | 逐键比对 `set` 载荷 |

**D. turbo / 环境变量声明（若加 env）**

| 文件 | 位置 |
|---|---|
| `turbo.json` | `lint` `:20-46`、`test` `:64-97`（L1_*/L2_* 已登记；新 env 须登记，否则 lint/test 缓存与传递出问题） |
| `scripts/module-status/check.mjs` | `:298-299` 的 env 白名单（`check:module-status` 的 `2-环境` 类） |

**E. md 渲染断言**

| 文件 | 位置 |
|---|---|
| `apps/api/tests/eval/l1-cli.test.ts` | `:646-648`（`writeL1Report` 产物含 `coverage` 等） |
| `apps/api/tests/eval/l1-repro-fields.test.ts` | `:155-156`、`:240-260`（`formatReportMd` 渲染 repro 行） |
| `apps/api/tests/eval/l2-cli.test.ts` | `:433-435`（`l2-last-run.md` 含 `session_multiturn` / `signoffEligible`） |

**不改但会被引用/对照的既有文件**：`fixtures/l1/gold.yaml`、`fixtures/l2/gold.yaml`、`fixtures/*/README.md`（可改表格文字，前图先例）、`fixtures/ingest-samples/*`、`fixtures/l2/corpus/*`（数据文件不许动）、`prds/08-quality/02-evaluation-and-gates.md`（§3/§6 硬门，不许动）。

### 与地图「开工基线」冲突/补充（明确到行）

- **`map.md:49`** 处 L1 夹具：「**60 条** case、**全部**带 `expectedDocIds`」→ 事实是 **60 条中仅 30 条**带（另 30 条无该键）；「去重 10 个逻辑 id」正确。**该行「全部」应改为「30 条（answerable 类）」**。
- **`map.md:51`** 处结构性后果：「`hitAcc.scored = 60`（题题有标注）」→ 事实是 **`scored = 30`**（30 带标注 / 60 题）。**该行 `60` 应改为 `30`**；结论（`hitAtK=0` 非 null → `hit_at_k_below_min` → `businessPass` 恒 false）不变。
- **`map.md:48`** 处引用行号：「`packages/contracts/src/eval/l1-matrix.ts:107-126`」→ `hitAtKCase` 实际在 **`111-127`**（`parseExpectedDocIds` 在 `86-104`）。属轻微行号偏移。
- **`map.md:50`** 处：「全仓无 `external_id` …（`git grep` 只在 `.scratch/` 命中讨论文字）」→ 结论「无映射面」正确，但「只在 `.scratch/` 命中」不精确：`external_id` 字样也出现在 `fixtures/l2/README.md:63`、`docs/module-status/api.md:146`、`docs/module-status/worker.md:91`、`apps/api/src/scripts/run-l2-golden.ts:120`（均为说明性文字，无实现）。
- **`map.md:49`** 处 L2 夹具（「18 条 … 去重 6 个逻辑 id」）与 `coverage/03-ops.md:20`（「25 处引用」）**均与事实一致**，无需改。
