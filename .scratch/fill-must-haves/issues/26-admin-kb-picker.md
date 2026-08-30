# admin 顶栏当前 KB 选择器

Type: task
Label: wayfinder:task
Status: open
Triage: ready-for-agent
Blocked by: 25

## Question

补 admin 顶栏当前 KB：只列出本次 `GET /knowledge-bases` 可见库，禁止粘贴 uuid。这是剩余 P2 半接线里本批唯一一张执行工单。

权威：[裁定库选择器只列成员库后下一步](./25-after-kb-picker-order.md)；功能表 §4「进入知识库后须有当前 KB 选择器」；[库选择器只列成员库](./24-kb-picker-members-only.md) 的 web 消费面（本张是运营台对称面，不是 §3 知识库切换）。GET 已按成员过滤（超管旁路）；本张改 ui 原子 + admin 消费面。

### 做

- 在 `@strict-rag/ui` 新增关闭列表下拉：展示选项文案，值为 id；不能输入 uuid、不能搜任意字符串。不是 combobox。现有 ui `Select`（原生 `<select>` 外壳）**不得**用于本顶栏
- admin 顶栏用该组件消费本次 GET 行：展示库名，值为 id
- 只能选列表项；禁止粘贴任意 uuid。现有「仍可粘贴」测例作废并改写
- 空列表：当前身份没有可见知识库；有 `kb.create` 时仍可建库。不说开通成员。不出粘贴框
- 列表失败：加载失败 + 重试；不给选择器；文案不说开通成员
- 有可见库但未选中（含脏缓存作废）：各运营页把「请在顶栏填写知识库 UUID」改成「请在顶栏选择知识库」
- `localStorage` `strict-rag:admin:last-kb-id` 若不在本次列表中：不采用。有可见库则选择器无选中、运营页按未选库走。不自动改选第一项
- 建库成功：选中新建库并写入当前 KB（创建者是库管，选项须有这一行）。不改建库权限 / `initialAdminUserId`
- 测例钉：空态无输入；列表失败无输入且可重试；只能选返回的 id；脏缓存不拿去打运营 API；失败 / 空态 / 未选中文案可区分；建库成功后当前 KB 为新建 id

### 不做

- 改 GET 过滤语义（含 `AUTH_ENFORCE` 关时列租户全量、超管旁路）
- 改 Ask 成员闸；admin 再做一层成员过滤
- 用现有原生外壳 `Select` / combobox / 自动选第一项
- 回改 web 知识库下拉或档位下拉（见 [web 下拉换 ui 关闭列表](./27-web-select-ui-library.md)）
- 失败 Webhook / 三平面配额 / 修改日志 / 启动引导超管 / 在线编写
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（ui、admin）。站规：web/admin 新下拉必须基于 `@strict-rag/ui` 关闭列表，禁止原生 `<select>` 外壳。
