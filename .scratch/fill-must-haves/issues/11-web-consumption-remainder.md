# web 消费余量

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
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

## Answer

成员可读 `GET /api/v1/knowledge-bases/:kbId/ask-modes`（只 `allowedModes`/`defaultMode`，不含 τ）；web 下拉读档并传 `options.mode`。可见库为空时阻断提问并提示找管理员开通成员；列表失败仍可粘贴 uuid。拒答 `suggestedActions` 出主按钮。流式 429 `RATE_LIMITED` 出配额文案。反馈补报错 `wrong_answer` / 缺文档 `missing_doc`。

划出维持：库选择器只列成员库、在线编写、引用点回（已在 ask 审计与引用）。

审阅 follow-up：换库先清空档位、FeedbackBar 按 requestId 重置、AskModes 去重、客户端 Zod parse、httpStatus 回填、档位 id 须 uuid 才拉。

## Comments

- 2026-08-28 按图顺序认领本工单。
- 未改 `GET …/settings` 权限（仍 `kb.config.write`）。
- 未跑浏览器 E2E（无 browse 工具）；以 RTL / API 测例为准。
