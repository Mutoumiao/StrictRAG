# 真栈真跑：经队列跑一次带账本的 worker 评测，记录落库实测

Label: wayfinder:task
Type: task
Status: open
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

<!-- 收口时填 -->
