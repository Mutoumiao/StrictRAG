# web 连续追问消费

Type: task
Label: wayfinder:task
Status: resolved
Triage: ready-for-agent
Assignee: grok
Blocked by:

## Question

补 web 连续追问消费：指代失败要当成这一档拒答来展示和操作，且不得写成卖点。这是 P2.5 阶段剩余必须具备的第一张执行工单。

权威：[裁定 L2 归档底线后下一步](./15-after-l2-floor-order.md)；功能表 §3 建议动作 / 连续追问 rewrite；`prds/04-pipelines/02-online-ask-langgraph.md` §2.1。

API 已返回 `reason=coref_unresolved` 与建议动作「用完整问题重述」；web 通用 `rephrase` 主按钮已能点。本张收口该 reason 的消费面，不重做 rewrite 图边。

### 做

- 拒答卡走 `coref_unresolved`（业务拒答，不是系统崩溃）
- 主按钮「用完整问题重述」：聚焦输入，回填上次问句供改，**不**自动重发弱指代
- RTL 覆盖该 reason
- 界面禁止出现「已支持连续追问 / 已准出」及同类宣传

### 不做

- 仓库默认 `SESSION_REWRITE_ENABLED=true`
- 把 `rewriteUsed` 当用户卖点或可见标记
- dogfood 开时提示「多轮已启用」
- J3/J4 API 夹具（主题切换、会话数字与库冲突）
- 改 admin rewrite 开关为可写
- L3 自动熔断 / 面板
- P3a / P3b
- 剩余 P2 半接线
- 库选择器只列成员库 / 在线编写
- LangGraph 重构
- 人签 / 准出 PASS

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（web）。

## Answer

`coref_unresolved` 走拒答卡（abstain，非系统红）；主按钮「用完整问题重述」回填 `lastQuestion`、聚焦输入、不自动重发；该 reason 隐藏表单旁「重试」。RTL：`apps/web/tests/ask/coref-unresolved.test.tsx`。界面无「已支持连续追问 / 已准出 / 多轮已启用」。rewrite 仍服务端强制关；未改 admin 开关、未做 L3 熔断、未 `task.py create`。

证据：`apps/web/src/components/ask-panel.tsx`（`abstainHelperText` · `rephrase` 只回填 · 隐藏重试）；`docs/module-status/web.md`。

## Comments

- 2026-08-30 认领本工单后写 web 消费面。未开 rewrite、未做 [L3 自动熔断](./17-l3-auto-fuse.md)。
- `pnpm --filter @strict-rag/web test` 41 绿；`check-types` / `lint --max-warnings 0` 绿。未开浏览器手点（本环境无浏览器工具）。
- `pnpm check:module-status` 仍报既有 4 条 + 一条 联动误报（工作区已改 `docs/module-status/web.md`）。
