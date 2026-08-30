# 末位超管前端提示

Type: task
Label: wayfinder:task
Status: open
Triage: ready-for-agent
Blocked by: 19

## Question

补末位超管前端提示：api 已 400 挡住禁用/剥光唯一 active 超管；admin 用户页仍可点。这是鉴权/成员余量的第二张执行工单。

权威：[裁定 L3 自动熔断后下一步](./18-after-l3-fuse-order.md)；`apps/api/src/routes/platform-users-roles.ts` 已有 `last active super_admin` 闸。

### 做

- 用户页：唯一 active 超管的「禁用」不可点，并出说明
- 用户页：剥光其超管角色（改角色保存后超管数为 0）不可点 / 提交前拦住，并出说明
- API 400 闸 **不改、不放宽**
- RTL 覆盖上述不可点与文案

### 不做

- 改 api 闸语义或只把英文 message 换成中文当完成
- 启动引导超管页
- 鉴权路径与成员 PUT（前一张）
- 入库报告 / Webhook / 三平面配额 / 修改日志 / 在线编写 / 库选择器
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（admin）。
