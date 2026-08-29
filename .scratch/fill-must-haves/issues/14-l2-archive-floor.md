# L2 归档底线

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 13

## Question

补 L2 归档底线：运营能入队多轮跑批、能看账本、没有合格归档就不能把产品默认打开。这是 P2.5 出口（L2 归档准出）的第一张执行工单。

权威：[裁定 P2 收官后下一步](./13-after-p2-close-order.md)；功能表 §10.2 L2、§4.2 会话 rewrite 开关；`prds/08-quality/02-evaluation-and-gates.md` §6.2。

### 做

- `POST …/eval/runs` 可入队 `session_multiturn`；题面仍用 `fixtures/l2/`，不进 `gold_questions`
- worker 现有 `sr-eval` 跑多轮（进程内窗 + 已有内部 execute-ask，**不** import `apps/api`）
- GET 回读；admin `/eval` 能入队 L2 并看报告（可与 L1 同页分区）
- `signoffEligible` 改为工程公式：live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ 达到现有加载器下限（≥15）；mock 必 false；**仍 ≠ 人签**
- 没有合格归档账本时，写 `sessionRewriteEnabledDefault=true` / 产品默认开 → 400；admin 开关保持只读；dogfood 的 env 旁路保留

### 不做

- 仓库默认 `SESSION_REWRITE_ENABLED=true`
- 把工程绿写成准出 PASS
- L2 剧本 CRUD 进库
- 黄金集自动回流
- 主题 LLM judge
- 把题面扩到 30（业务建集）
- web 连续追问卖点 UI、`coref_unresolved` 主按钮
- L3 自动熔断 / 面板
- P3a / P3b
- 剩余 P2 半接线
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api / worker / admin）。

## Answer

L2 归档底线已接：运营能入队多轮、能看账本、没有合格归档就不能写产品默认开。

- 入队：`POST …/eval/runs` `{ runType: 'session_multiturn' }`；题面仍 `fixtures/l2/`，不进 `gold_questions`
- worker：`sr-eval` 按 `runType` 跑 `runL2Batch`（进程内窗 + 内口 execute-ask 带 sessionWindow）；不 import `apps/api`
- GET 回读 pass/fail/zeroToleranceHits；admin `/eval` 「跑 L2」
- `signoffEligible` = live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ ≥15；mock 必 false；**仍 ≠ 人签 / ≠ 准出**
- 无合格归档写 `sessionRewriteEnabledDefault=true` → 400 `SESSION_REWRITE_DISABLED`；有归档本窗仍锁只读；dogfood env 旁路保留

未做（维持划出）：仓库默认打开 rewrite、准出 PASS、L2 剧本 CRUD、扩题到 30、web 连续追问 UI、L3 熔断/面板、P3a/P3b。

08-06 只补指针。未 `task.py create`。

## Comments

- 2026-08-29 认领并落地本工单。
