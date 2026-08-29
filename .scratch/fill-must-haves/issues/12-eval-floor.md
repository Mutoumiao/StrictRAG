# 评测底线

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 11

## Question

补评测底线：能维护题、能入队、能看结果。

### 做

- gold-questions 存储 + admin 薄页维护题
- `POST eval/runs` 入队
- worker eval 消费者跑 L1 golden
- 结果查询接口

### 不做

- 黄金集自动回流（feedback → 黄金集）
- P4 看板可视化增强
- L1 门禁包签字
- 多模型 fallback
- 在线抽样常态化

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api / worker / admin）。权威：功能表 §4.1、§5.2 评测行。

## Answer

P2 评测底线已接：能维护题、能入队、能看结果。

- 存储：`gold_questions`（`case_key` 每库唯一）+ `eval_runs.status/job_id/error_message`（migration `0010_eval_floor`）
- HTTP：`eval.run` 闸 `GET/POST/PATCH/DELETE …/gold-questions`、`POST/GET …/eval/runs`；空题集 400；只入队 `sr-eval`
- worker：`handleEvalJob` 读库内题 → 串行 2×2 → 回写 run；默认 HTTP 打 api 内口 `POST /internal/eval/execute-ask`（口令 + `skipTrace`）
- admin：`/eval` 薄页维护题、入队、「跑一批」、看 A–D / 覆盖率
- 矩阵纯函数下沉 `@strict-rag/contracts`（api CLI 仍再导出）

明确不做（本工单）：反馈回流黄金集、P4 看板增强、L1 门禁包签字、多模型 fallback、在线抽样、通用 `GET /jobs/:id`、τ 扫描 / 校准。

08-06 只改指针为已完成。未 `task.py create`。

## Comments

- 2026-08-29 认领并落地本工单。
- 内口空 `EVAL_INTERNAL_TOKEN` 时 503；worker 与 api 须同口令才能真跑。本地演示还要起 api + worker + Redis + 已 migrate 的 PG。
- mock 覆盖率仍禁止当业务签字 PASS。
