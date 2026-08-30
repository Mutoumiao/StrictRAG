# web 下拉换 ui 关闭列表

Type: task
Label: wayfinder:task
Status: claimed
Assignee: grok
Triage: ready-for-agent
Blocked by: 26

## Question

把 web 仍用原生 `<select>` 外壳的下拉，换成 `@strict-rag/ui` 关闭列表组件。这不是本批执行工单；等 [admin 顶栏当前 KB 选择器](./26-admin-kb-picker.md) 把该原子落地。

权威：[裁定库选择器只列成员库后下一步](./25-after-kb-picker-order.md) Q10；站规「web/admin 新下拉必须基于 ui 库关闭列表」。语义权威仍是 [库选择器只列成员库](./24-kb-picker-members-only.md)：只列本次 GET、空态开通成员、失败重试无输入、脏缓存作废。

### 做

- web 知识库下拉改用 ui 关闭列表（与 admin 顶栏同一组件）
- web 问答档位下拉若仍走原生外壳 `Select`，一并换掉
- 不改过滤 / 空态 / 失败 / 脏缓存 / 不能提问 的已锁语义
- 测例改查询方式以适配自定义下拉，断言点保持：只能选列表 id、失败无输入、脏缓存不提问

### 不做

- 改 GET 过滤或 Ask 成员闸
- combobox / 可搜索完整选择器
- 回改 admin 顶栏
- 失败 Webhook / 三平面配额 / 修改日志 / 启动引导超管 / 在线编写
- P3a / P3b / P4 / 人签 / 默认开 rewrite / LangGraph

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（web、ui）。
