# L3 自动熔断

Type: task
Label: wayfinder:task
Status: open
Triage: ready-for-agent
Blocked by: 16

## Question

补 L3 自动熔断：护栏闩后，本进程后续 ask 强制关掉 rewrite 路径，退回单轮；会话壳仍落 transcript。这是 P2.5 阶段剩余必须具备的第二张执行工单。

权威：[裁定 L2 归档底线后下一步](./15-after-l2-floor-order.md)；`prds/08-quality/02-evaluation-and-gates.md` §0 L3；`prds/10-delivery/02-ops-runbook.md` §2.5。打点与告警已有，见 `.trellis/spec/api/backend/l3-metrics.md`。

### 做

- `coref_fail_rate` / `topic_complaint` / `l2_stale` 闩后，后续 ask **进程内**强制 `rewriteEnabled=false`
- 会话壳仍落 transcript；系统退化为单轮可用
- `rewrite_dogfood` **不**触发熔断（env 为 true 时该闩会立刻亮，拿它熔断等于掐死 dogfood）
- 测例：闩后即使 env 为 true 也 `rewriteUsed=false`；`rewrite_dogfood` 不熔断；复位后恢复；不碰 L1 签字字段

### 不做

- 写 `SESSION_REWRITE_ENABLED=false` 进 env / `.env`
- 写 `sessionRewriteEnabledDefault` 进库
- 收窄 `clipSessionWindow`
- 1h 滑窗（沿用现有进程寿命闩）
- 回滚 rewrite prompt 文件
- Grafana / admin 面板（面板属 P4）
- 自动撤销 L1 签字
- 仓库默认打开 rewrite
- 人签 / 准出 PASS
- web 连续追问消费（前一张）
- P3a / P3b
- 剩余 P2 半接线
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api）。
