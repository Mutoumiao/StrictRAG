# ask 审计与引用

Type: task
Label: wayfinder:task
Status: open
Triage: ready-for-agent
Blocked by: 09

## Question

补 ask 审计回溯与引用点回。

### 做

- `GET /ask/:requestId`：按权限回溯 `evidence_snapshot` 与 trace
- web 引用卡片可点回分片详情

### 不做

- 审计管理台（搜索 / 过滤 / 导出）
- Langfuse SDK（另列技术债）
- 跨会话全文检索
- 按 `requestId` 断线重拉

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api / web）。权威：功能表 §5.2 引用回溯。
