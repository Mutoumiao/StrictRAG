# ask 审计与引用

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
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

## Answer

已完成第三批第二张执行工单，范围按正文「做 / 不做」锁死：

- **contracts**：`AskAuditResponseSchema` / `EvidenceSnapshotItemSchema`（当时 chunkId/docId/lifecycle/preview/title + graphTrace；strict 拒绝 text/body/answer/rawQuestion）。
- **GET `/api/v1/ask/:requestId`**：登录 + 该 trace 的 KB 成员（`evaluateKbMember`；超管旁路）；回读落库 `evidenceSnapshot`（preview 再截 200）与 `graphTrace`；不返回 answer / rawQuestion / 正文；不查现网分片。
- **web**：answered 非闲聊引用可点；`getAskAudit` → 展示当时快照详情；失败不编造正文。闲聊无点回。

**未做（维持划出）**：审计管理台、Langfuse SDK、跨会话全文检索、按 `requestId` 断线重拉。

验证：`contracts` / `api` / `web` `check-types` 全绿；contracts 新测 7 过；api `http-audit` 8 过；web 引用点回 3 过。web/contracts lint 绿。api lint 仅既有 warning（非本工单文件）。审查后补：preview max 进契约、graphTrace 白名单、OpenAPI GET 路径、引用点回 inFlight + requestId key + aria-controls。

IS 已回写 `docs/module-status/{api,web,contracts}.md`；HOW 已同步 ask-pipeline / web quality-guidelines。`.trellis/tasks/08-06-project-backlog/status.md` §0.3 指针：10 已完成，11/12 未开始。覆盖表 F3 改为已测。

## Comments

- 2026-08-28 按图顺序认领本工单（Blocked by 检索语义补钉已 resolved）。
- 2026-08-28 落地 GET 审计回溯 + web 引用点回当时快照；关单。
