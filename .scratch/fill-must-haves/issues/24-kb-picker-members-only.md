# 库选择器只列成员库

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 23

## Question

补 web 知识库切换：只列出当前身份可见的库。这是剩余 P2 半接线里本批唯一一张执行工单。

权威：[裁定入库报告最小闭环后下一步](./23-after-ingest-report-order.md)；功能表 §3「知识库切换」；[web 消费余量](./11-web-consumption-remainder.md) 划出项。`GET /api/v1/knowledge-bases` 已按成员过滤（超管旁路）；本张只改消费面。

### 做

- web 用本次 `GET /knowledge-bases` 返回的行做原生下拉：展示库名，值为 id；无自由输入
- 只能选列表项；禁止粘贴任意 uuid
- 空列表：沿用现有「你还不是任何知识库的成员…找管理员开通成员」空态，不出提问表
- 列表失败：加载失败 + 重试；不给出输入框；文案不说「去开通成员」
- `localStorage` 里的 kbId 若不在本次列表中：不采用。有可见库则选择器无选中、不能提问；列表为空仍走空态。不自动改选第一项
- 测例钉：空态无输入；列表失败无输入且可重试；只能选返回的 id；脏缓存不拿去提问；失败文案与空态文案可区分

### 不做

- 改 `GET /knowledge-bases` 过滤语义（含 `AUTH_ENFORCE` 关时列租户全量、超管旁路）
- 改 Ask 成员闸；web 再做一层成员过滤
- admin 顶栏手填 uuid
- 列表失败回退粘贴（工单「web 消费余量」那条回退作废）
- combobox / 可搜索完整选择器
- 自动选列表第一项
- 失败 Webhook / 三平面配额 / 修改日志 / 启动引导超管 / 在线编写
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（web）。

## Answer

web `AskPanel` 用本次 `GET /knowledge-bases` 行做原生 `<select>`：展示库名、值为 id；无自由输入。空列表仍走 EmptyKbCard「找管理员开通成员」。列表失败独立错误卡 + 重试，不给输入、不说开通成员。`localStorage` 脏 id 不采用、不自动选第一项；未选中时提问 disabled。未改 GET 过滤、未改 Ask 成员闸、未改 admin 顶栏。

测例：`apps/web/tests/ask/kb-picker-members-only.test.tsx` · `empty-kb.test.tsx`。未 `task.py create`。

证据：`apps/web/src/components/ask-panel.tsx` · `apps/web/tests/ask/kb-picker-members-only.test.tsx`。

## Comments

- 2026-08-30 认领本工单并执行。开放前沿即本张。
- 2026-08-30 收工：关本工单；建 [裁定库选择器只列成员库后下一步](./25-after-kb-picker-order.md)。未 `task.py create`。
