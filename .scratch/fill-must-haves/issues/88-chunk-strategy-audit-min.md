# 分片策略保存写服务端修改日志最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 87

## Question

补 P2 运营审计真空：分片策略 PATCH 不写服务端修改日志，而 IA 把「写保存 → 服务端修改日志」冻成必达；KB 设置 PATCH 已写 `kb_settings_audits`，策略 PATCH 没有。

权威：`prds/00-product/05-frontend-ia.md` §2.2「审计：可写保存 → 服务端修改日志」；功能表 §4.2 末段 / §4.5；`prds/10-delivery/03-acceptance-scenarios.md` 剧本 AA1「KB 策略参数可保存 + 审计；旧文档 version 不变」。

现状（源码）：

- `apps/api/src/routes/chunk-strategies.ts` — PATCH 保存策略参数，**不写审计**
- `apps/api/src/services/chunk-strategy-catalog.ts` — 目录读写，无 audit 写入
- `apps/api/src/middleware/admin-write-audit.ts` — Pino 写操作日志白名单**不含**该路径（ARCH-P1b-2 仍只 Pino，不落表）
- 对照：KB 设置 PATCH 已写 `kb_settings_audits`（工单 33）；`apps/api/src/services/kb-settings-audit.ts`

口径：

- 策略 PATCH 有 diff → 落服务端修改日志；**无 diff 不落**
- **不加新表**：复用既有审计形态（以源码既有 `kb_settings_audits` 或等价既有审计路径为准；若确实无处落，先裁到既有表结构，禁止为审计新建独立资源）
- 旧文档 `index_version` 与 `chunk_strategy_params` 快照**不变**（策略变更只影响后续上传 / reindex）
- 审计须记：操作者、字段旧→新、时间
- 禁止新增原生 `<select>`
- 测例禁止依赖墙钟

### 做

- api：策略 PATCH diff → 落修改日志；无 diff 不落；旧文档快照不变
- 测例：api — 有 diff 落一条；无 diff 不落；旧文档 `index_version` 与快照不变

### 不做

- 改策略解析语义 / 改旧文档
- 把 ARCH-P1b-2 的 Pino 写操作日志改成落表
- 新建独立审计资源 / 表
- 角色树 / 参数快照只读审计展示 / 签字包链 / 断线重拉 / 入场 `aclPrincipals` / citation 去重 / 孤儿清理
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api chunk-strategies + kb-settings；`docs/module-status/` api。禁止 push。禁止 `task.py create`。

## Answer

分片策略保存写服务端修改日志最小闭环已落地。

- `applyKbChunkStrategyPatch` 增返回 **有 diff 才非空** 的修改日志：键 `chunkStrategy.<code>.enabled` / `.recommendedFamilies` / `.paramOverrides`，值为 `{from, to}`；`before` 取生效前快照（含表空时的默认种子）。
- 路由 PATCH 在 diff 非空时打 `event=chunk_strategy_patch` Pino 日志并落审计行；**复用 `kb_settings_audits`（`kbSettingsAuditRepo`），不新建表**。
- 无 diff 不落；非法 PATCH 400 且不落。
- 只动 `kb_chunk_strategies`：旧文档 `index_version` 与 `chunk_strategy_params` 快照不变（测例用 `documents` 写方法 spy 钉死）。
- 新增路由依赖 `auditRepo`（默认真实 repo，测例注入内存 repo）；`apps/api/tests/kb/chunk-strategies-http.test.ts` 的 PATCH 用例已注入内存 repo（否则会打到 PG）。
- 因与 KB 设置共用审计表，admin 设置页既有「修改日志」一节会自动显示策略改动，**无需新 HTTP / 新页面**。

证据：`apps/api/src/services/chunk-strategy-catalog.ts` `ChunkStrategyPatchDiff` · `apps/api/src/routes/chunk-strategies.ts` · 测例 `apps/api/tests/kb/chunk-strategy-audit.test.ts`（4）。

验证：`apps/api/tests/kb/chunk-strategy-audit.test.ts`（4）、`chunk-strategies-http.test.ts`（6）、`ingest/chunk-strategies.test.ts`（16）、`ingest/reindex-strategy.test.ts`（7）全绿；全量 `pnpm --filter @strict-rag/api test` 128 文件 / 815 测试绿；`pnpm check-types` 8/8 绿。

未 `task.py create`。未 push。

## Comments

- 2026-09-16 认领并在主分支执行。权威切边见 [裁定反馈回流黄金集后下一步](./85-after-feedback-promote-gold-order.md)。
