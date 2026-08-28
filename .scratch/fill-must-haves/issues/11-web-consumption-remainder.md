# web 消费余量

Type: task
Label: wayfinder:task
Status: open
Triage: ready-for-agent
Blocked by: 10

## Question

补 web 消费端 P2 语义。

### 做

- 档位 UI：读 `allowedModes` + `defaultMode` 并传 `mode`
- 无可用库空态：「找管理员开通成员」阻断
- 建议动作按 reason 出主按钮
- 识别 429 出配额文案
- 反馈类别补报错 / 缺文档

### 不做

- 库选择器改造为「只列成员库」（半接线，另行）
- 在线编写
- 引用点回（归 ask 审计与引用）

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（web）。权威：功能表 §3、§5.2 消费面相关行。
