# 空库拒答对齐 200

Type: task
Label: wayfinder:task
Status: resolved
Triage: ready-for-agent

## Question

把「库无现行文档」从 409 纠到 PRD 冻结的 **200 拒答信封**，并让 web 走拒答展示而不是系统错误卡。这是第一批第一张执行工单（编号更小；与 [建库闭环](./04-create-kb-closed-loop.md) 无阻塞边）。

### 做

- **api 同步 + SSE**：KB 内无任何 `lifecycle=active` 且 `status=ready` 文档时，HTTP **200** + `status=abstained` + `reason=kb_not_ready` + `05-api` 冻结文案（知识库尚无可用文档，请稍后再试或联系管理员）。`KB_NOT_READY` 不得再作为 ask 主路径的 `error.code`。
- 该 reason 在契约里已有的建议动作 `contact_admin` **可以随响应带上**；不要趁机做建议动作主按钮体系。
- **web**：收到上述拒答应展示拒答，不进系统错误卡。
- **测例与覆盖镜像**：`apps/api/tests/ask/http-stream.test.ts` 等现写 `kb_not_ready → 409` 的用例改为 200 拒答；`docs/testing/coverage/01-ingest.md` E6 现写 409，改为与源码一致的镜像（这是覆盖表，不是 `prds/00–11`）。
- 收工：skill `update-module-status`；在 `.trellis/tasks/08-06-project-backlog/` **只留指针和勾选**，禁止再 `task.py create` 平行实现任务。

写代码前读 `.trellis/spec/` 对应包（api / web / contracts）。权威：`prds/05-api/01-http-api-hono.md` 前置条款（200）；源码落点见 [inventory-p2.md](../inventory-p2.md) §4.1 / §4.3。

### 明确不做

- 建议动作主按钮（其它 reason 的主按钮属后批 web 消费余量）
- 「无可用知识库」提问前阻断空态（列表里没有可问的库）
- 改 `prds/00–11` 里残留的 409 表（`05-api` 错误码表、`10-delivery` 剧本）；地图禁止用本图改冻结文
- 档位、配额文案、反馈类别、断线重拉、`no_docs_in_scope` 细分
- B8 / B9 / QUAL-2、P2.5 及更晚

## Answer

空库 ask 已按 `prds/05-api` 前置条款纠到 **200 拒答信封**。

- **api**：`executeAsk` 图结果一律 `httpStatus: 200`。同步 `ok(AskResponse)`；SSE 走 `phase=finalize` + `data-ask-final`。无 `lifecycle=active` ∧ `status=ready` 文档时：`status=abstained` · `reason=kb_not_ready` · 文案「知识库尚无可用文档，请稍后再试或联系管理员。」· `suggestedActions` 含 `contact_admin`。`KB_NOT_READY` 不再作为 ask 主路径 `error.code`；SSE 不再为该 reason 写 `phase=error`。
- **web**：`data-ask-final` 进 `abstained` → 拒答卡，不进系统错误卡。未做建议动作主按钮。
- **测 / 覆盖**：`apps/api/tests/ask/http-stream.test.ts`（同步+SSE）；web `abstain-alert` / `stream-ready-no-final`；`docs/testing/coverage/01-ingest.md` E6 改为 200 镜像。未改 `prds/00–11` 残留 409 表。
- **HOW**：`.trellis/spec/api/backend/ask-pipeline.md` · `error-handling.md`；web `quality-guidelines.md`。
- **IS**：`docs/module-status/api.md` · `web.md`（局部核实，未经独立审查）。`pnpm check:module-status` 仍有 9 条既有漂移（本工单引入的短名误报已消）。
- **08-06**：`.trellis/tasks/08-06-project-backlog/status.md` §0.3 指针表勾选本工单 **已完成**。未 `task.py create`。

未做：无可用知识库提问前空态；建议动作主按钮；建库闭环（下一张开放工单）。

## Comments

- 本回合认领并执行。落盘如上。
