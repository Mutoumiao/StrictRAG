# 评测底线

Type: task
Label: wayfinder:task
Status: open
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
