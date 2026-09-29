# 真栈真跑：经队列跑一次带账本的 worker 评测，记录落库实测

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 03, 04

## Question

在本机 Docker 真栈上，把**生产路径**（运营台发起 → BullMQ → worker 消费）跑一次，取**落库实测**，与 api CLI 的实测对照。步骤：

1. **起栈**：compose 服务 + api 进程 + **worker 进程**（worker 是常驻消费者，前图未起过 —— 起法与所需 env 用工单 01 第 7 项的结论）。Docker Desktop 本机**会自行退出**，起栈前先探活，退出则重启并轮询；故障那一跑**必须留痕**，不许删。
2. **备语料与账本**：复用上一图的 `ingest-eval-corpus.ts` 把 13 篇语料送入一个 KB，产出 `artifacts/eval-corpus-ledger-<kbId>.json`。
3. **对照两跑**（同一 KB、同一 gold、唯一变量 = 账本）：
   - 不带账本：起 worker **不设**账本 env → `POST /knowledge-bases/:kbId/eval/runs`（或按工单 02 的裁定形式下发）→ 等 job 终态 → 读 `eval_runs.report_json`；
   - 带账本：按裁定设置账本 → 再跑一次 → 读同一位置。
4. **记录**：把两次的 `hitAtK`（`hits` / `scored`）、三键取值、`status`、`errorCount` 写进 `research/05-real-stack-worker-run.md`，并与 api CLI 侧同夹具的实测**并排对照**。
5. **反证**：至少做一组「账本与本次 KB 不符」的真跑，确认 job 落 `failed` 且 `errorMessage` 点名原因（**不许**静默恒 0）。
6. **诚实边界**：mock 向量 / mock chat（无 `GATEWAY_BASE_URL`）/ 无 IK / 60 题全 `abstained` 等必须写明；**本页任何数字都不是签字数字**；`eval_runs` 的落库值**不得**被当成 P2.5 准出证据。

产物：`research/05-real-stack-worker-run.md`（含命令、原始输出片段、对照表、留痕目录名）。可顺带补 `docs/ops/` 的可复现配方（正式回写在工单 06）。

## Answer

**已解**。取证正文（含环境、三态对照表、库内原始形状、与 CLI 侧对照、留痕）：[`../research/05-real-stack-worker-run.md`](../research/05-real-stack-worker-run.md)。

**这是本仓第一次把「运营台发起 → BullMQ → worker → 落库」这条链端到端跑通**（工单 01 核实过：此前两侧测试都注入替身，中间无人贯通）。

三态实测（唯一变量 = worker 的 `L1_DOC_MAP`；同 KB `01a0eda2-6781-7ca3-90e8-17dcd7ba68c2`、同账本、同夹具）：

| 场景 | `L1_DOC_MAP` | `status` | `caseCount` | `hitAtK` | `docMapSource` | `docMapResolved` | `errorMessage` |
|---|---|---|---|---|---|---|---|
| A | 未设置 | succeeded | 30 | **0**（0/30） | `none` | 0 | — |
| B | 本 KB 账本 | succeeded | 60 | **1**（**30/30**） | **`ledger`** | **10** | — |
| C | kbId 被改坏 | **failed** | 0 | `null` | — | — | `corpus ledger kbId 00000000-… != run KB 01a0eda2-…` |

- **B 的 `docMapResolved=10` 与上一图 api CLI 侧完全相同** —— 同夹具、同账本、同 10 个去重逻辑 id，两条入口对同一份账本给出**同一含义**的 `hitAtK`（本图目的地达成）。
- **C 证明「设置但不可用」不被降级**：若降级，C 会与 A 给出同样的 `none/0/[]`，那道新鲜的闸就等于常开。
- **库内原始 `report_json`（不经 DTO）与 DTO 透出一致**（B：`ledger/10/1/30/30`；A：`none/0/0/30/0`）；失败行不写 `report_json`（`markFailed` 只写 `status` + `error_message`）。
- **`signoff_eligible=1`（B 跑）是 L1 工程口径**（live ∧ 两类各 ≥30），**不是业务 PASS**（`coverage=0`、无 judge、无抽检、无四要素）。
- **环境坑三条（非仓库缺陷，已写进取证文）**：① `pnpm dev:api` 经 turbo 会按 `dev` 任务的 6 键 env 白名单**过滤掉** operable 变量（官方 `pnpm up:apps` 用 `pnpm --filter … start`，不经 turbo，不受影响）；② `pnpm --filter @strict-rag/api` 的 `@` 经 `.cmd` 被 shell 拼坏，改用 `pnpm --dir`；③ **Docker Desktop 自退 1 次**，恢复后 **ES 的 host 端口转发丢失**（容器内正常、`compose ps` 也显示映射），`docker compose restart elasticsearch` 后 9 秒恢复 —— 前两条已够写进 `docs/ops/`（工单 06）。
- **本跑数字不是签字数字**：向量 mock（8 维）、chat mock（无 `GATEWAY_BASE_URL`）、ES 无 IK、可答类全 `abstained`。
- **新发现（转下一图）**：两条入口的**题源**不同 —— CLI 读 `fixtures/l1/gold.yaml`，worker 读 DB 表 `gold_questions`。本图只对齐了「数字含义」，未对齐题源。
