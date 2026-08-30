# 入库报告最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 21

## Question

补入库报告最小闭环。这是剩余 P2 半接线里本批唯一一张执行工单。

权威：[裁定末位超管前端提示后下一步](./21-after-last-superadmin-order.md)；`prds/05-api/01-http-api-hono.md`（`GET /api/v1/knowledge-bases/:kbId/ingest-report`）；功能表 §4.3 / §5.2。管道 PRD 去重指标是完整语义，本张只出已发生事实。

### 做

- worker 落可查询报告：双就绪成功写一版；文档内去重清空失败也写（未 ready）；对账失败写当时对账，不标双就绪
- 字段：`docId` / `kbId` / `indexVersion` / `chunkCount` / 文档内 dropped 计数 / 双就绪与对账
- 跨 doc、L1 contextualize、冲突对、Hit@k：省略或显式未实现，禁止填 0 装齐
- `GET /api/v1/knowledge-bases/:kbId/ingest-report`：返回该库已落库的行；空列表 200；不因部分文档无报告而 404；不为未完成文档造空壳
- 权限：`doc.view` + 文档所属库成员闸
- admin 文档行展开区，紧挨现有「入库阶段」；只展示本行文档；无报告显示「暂无入库报告」
- 测例钉 GET 信封、权限、空列表、落库事实、admin 入口与无报告文案

### 不做

- 跨 doc MinHash / `pending_review` 人工二选一 / L0 vs L1 Hit@k 抽样
- 失败 Webhook
- 三平面配额 / 修改日志 / 超管引导页 / 在线编写 / 库选择器
- 另发明 `GET …/documents/:docId/ingest-report`
- 新权限码 / 用 `kb.config.write`
- 新路由入库报告页 / 独立抽屉
- 每个 stage 写报告（阶段仍看 `ingest-jobs`）
- 用报告替代 `ingest-jobs` 账本
- 改 ADR-038 双就绪
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（worker、api、admin、contracts、db）。

## Answer

worker 按 `docId+indexVersion` 落可查询 `ingest_reports`：双就绪成功写一版；文档内去重清空失败也写（未 ready）；对账失败写当时对账、不标双就绪。字段只含已发生事实（chunkCount / internalDropped / 双就绪 / 对账计数）。跨 doc / L1 / 冲突对 / Hit@k 未装齐。

`GET /api/v1/knowledge-bases/:kbId/ingest-report`：成员闸 + `doc.view` WhenEnforced；空列表 200；缺库 404。admin 文档行展开区紧挨「入库阶段」只展示本行；无报告「暂无入库报告」。

未做：跨 doc 去重 / `pending_review` / Hit@k 抽样 / Webhook / doc 级 GET / 新权限码。未 `task.py create`。

证据：`packages/db/src/schema/kb/ingest-reports.ts` · `apps/worker/src/ingest/ingest-report.ts` · `apps/api/src/routes/ingest-report.ts` · `apps/admin/src/app/(ops)/documents/report.services.ts` · `apps/api/tests/ingest/ingest-report-http.test.ts` · `apps/admin/tests/ops/ingest-report.test.tsx`。

## Comments

- 2026-08-30 认领本工单并执行。开放前沿即本张。
