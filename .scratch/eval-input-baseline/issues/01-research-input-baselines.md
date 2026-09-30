# 01 · 研究：三条输入基线的现状面（库内对账可达性 / 题源差异影响面 / 三键消费方与历史行）

Type: research
Status: resolved
Parent: ../map.md

## Question

把本图三条判据线各自的**现状面**核清，落到能做裁定的粒度（详见面问）。

## Answer

三个**角色互斥**的研究子代理并行完成，三份正文：

- [`research/01a-ledger-db-reachability.md`](../research/01a-ledger-db-reachability.md) —— 库内对账可达性。
- [`research/01b-case-source-divergence.md`](../research/01b-case-source-divergence.md) —— 两条入口的题源差异。
- [`research/01c-docmap-keys-consumers.md`](../research/01c-docmap-keys-consumers.md) —— 三键消费面与历史行。

**极简要点（裁定依据，逐条有源码行号）**：

1. **库内对账可达**：api 有 `documentRepo.listDocsByKb` / `getDoc` / `loadCorpusFromDb`，worker 评测路径**完全不读 `documents`**；两侧**都没有**按 id 批量查（全仓无 `inArray(documents.id` 命中）→ 需新写一条。contracts 两个账本文件**只 import node 内置**（不引 `@strict-rag/db`），故库读必须以**注入函数**形式进来。共享层唯一接缝 = `corpus-ledger-file.ts` 的 `resolveCorpusLedgerForRun`。
2. **只查「存在」不够**：重跑 `ingest-eval-corpus` 会为同一 KB 生成新 uuid v7，旧行按 `supersedePair` 落 `superseded`（`apps/api/src/services/documents.ts:225-231`）——**旧账本的 docId 仍然存在却已不可检索**，存在性对账会放行一批必然假 miss。
3. **账本 `title` 与库内 `title` 在 CLI 路径上逐字透传、可全等比较**（夹具 `path.basename` → HTTP body → insert，中间无 trim）；库内**无 `sourceFile` 列**；库内**无任何改名路径**，故 title 漂移只可能来自手工改库 / 手工改账本。
4. **题源确实分歧**：文件侧 `fixtures/l1/gold.yaml` = **60 题**（30 可答 + 27 不可答 + 3 假前提；带 `expectedDocIds` 的只有 30 条），字段含 `expectedChunkIds` / `rubric`；worker `loadGold` 只映射四键，**丢掉**这两个字段。DB 侧**默认空**（全仓无 seed / 无 upsert / **无「文件 → DB」灌题入口**；`insert(goldQuestions)` 唯一落点是运营 CRUD 与反馈晋升，后者不写 `expectedDocIds`）。两侧**必然不同**（60 vs 0），前图那轮相等靠人工灌题。
5. **题集身份已有一半**：`repro.questionIdsHash` 两侧**各自锚自己那一侧**（api 锚文件 `id` 集、worker 锚 DB `case_key` 集），已随报告落 `report_json`，但**没有任何地方互相比较**、也**不知道它锚的是哪一侧**。ADR-046 快照**无**题集哈希槽位。
6. **三键确认不进任何判定**，admin / web **零命中**（运营台不渲染）；api CLI 存整份报告超集、worker 存逐键白名单，**两处同形**，同源于 `summarizeDocMap`。
7. **三键收紧代价很小**：`toEvalRunDto` 恒回填（`apps/api/src/services/eval-runs.ts:244-247`），HTTP 读路径**不会**因历史行缺键失败；唯一会红的是 `packages/contracts/tests/eval/gold-contract.test.ts:70` 的 **1 个 it**。
8. **回归面已量化**：对账若挂在账本路径上，**15 个 it / 5 个文件**会红（逐条列名见 01a §四）；无条件对账则数十个成功用例全红 —— 故必须走「有账本才进对账」。
9. **未核实（需真库）**：`eval_runs` 历史行数与含键分布、`documents.checksum_sha256` 与账本 `sourceSha256` 是否逐位相等。本机 Docker daemon 当时**未运行**（`docker ps` 连接失败）。

## Comments

- 三条研究结论与地图《开工基线》表**无冲突**；其中一条**修正**了地图的旧措辞：「CLI 侧无 DB 读」的旧前提已不成立 —— `run-l1-golden.ts` 与 `run-l2-golden.ts` **都**已 `import { getDb }`（分别用于 `persistEvalRun` / `persistL2EvalRun`）。
