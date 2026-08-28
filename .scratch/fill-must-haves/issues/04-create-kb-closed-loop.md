# 建库闭环

Type: task
Label: wayfinder:task
Status: open
Triage: ready-for-agent

## Question

补上「能创建一个有首位库管的知识库」闭环：API 字段 + 成员写入 + admin 入口。这是第一批第二张执行工单（编号大于 [空库拒答对齐 200](./03-align-kb-not-ready-200.md)；两张无阻塞边，无票名时先做空库拒答）。

### 做

- **API**：`POST /api/v1/knowledge-bases` 须 `kb.create`；body **必填** `initialAdminUserId`；写入该用户 `kb_members(role=admin)`。权威：`prds/05-api/01-http-api-hono.md` §2.1。
- **`tenantId`**：以令牌为准，覆盖/忽略 body。不要再让客户端指定租户。
- **admin**：有 `kb.create` 才显示创建入口；挂在已有 **KB 选择器或文档域**，**不**单开空壳二级菜单。表单：名称 + 首位库管；首位库管 **预填当前用户、可改**。
- 契约：`CreateKbBodySchema` 现只有 `tenantId` / `name` / `description`（`packages/contracts/src/ingest/document.contract.ts`），按上面改。
- 落点线索：`apps/api/src/routes/documents/index.ts`、`apps/api/src/services/documents.ts` `createKb`。
- 收工：skill `update-module-status`。08-06 指针若第一张执行工单已写过，本张只补建库这一行，禁止平行 Trellis 实现任务。

写代码前读 `.trellis/spec/` 对应包（api / admin / contracts / admin-catalog）。

### 明确不做

- 成员 PUT、`allowedDocIds`
- 超管启动引导、末位超管前端提示
- 建库向导里配分片策略 / 文档类型 / 模型绑定
- 独立「创建知识库」二级菜单
- 策略三层表、Reindex UI、评测页

## Comments
