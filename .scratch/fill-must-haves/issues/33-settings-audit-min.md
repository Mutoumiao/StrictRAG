# 修改日志最小闭环

Type: task
Label: wayfinder:task
Status: claimed
Assignee: grok
Triage: ready-for-agent
Blocked by: 32

## Question

补知识库设置修改日志最小闭环：谁 / 何时 / 字段旧→新可查询。这是剩余 P2 半接线里本批唯一一张执行工单。

权威：[裁定写路径锁超管全码后下一步](./32-after-superadmin-codes-lock-order.md)；功能表 §4.2；`apps/api/src/services/kb-settings.ts` `mergeKbSettingsPatch` 已算 `diff`，PATCH 只打 Pino。ARCH-P1b-2 的 `admin_write` 中间件是日志、不落表，本张不改那条纪律。

### 做

- **表**：`kb_settings_audits`（Drizzle schema + 迁移，接 `0012` 之后）。列：`baseColumns` + `tenantId` + `kbId` + `actorUserId` + `diffJson`（`Record<field, { from, to }>`）。
- **写**：`PATCH /knowledge-bases/:kbId/settings` 成功且 `merged.diff` 非空时插入一行。空 diff 不写。失败 PATCH 不写。
- **读**：`GET /api/v1/knowledge-bases/:kbId/settings-audit`。返回该库已落行，新在前，上限 50。空列表 200。缺库 404。不为未改过的库造空壳。
- **权限**：与 settings 相同，`kb.config.write` + 成员闸。不新码。
- **契约**：列表项含 `id` / `kbId` / `actorUserId` / `createdAt` / `diff`。禁止密钥字段。
- **admin**：知识库设置页加「修改日志」一节，展示本库已落行（时间、操作者、字段旧→新）。无独立路由 / 无新菜单。无行时文案「暂无修改日志」。
- **测例**：
  - PATCH 有 diff → GET 见该行；空 diff 不增行
  - 权限：无 `kb.config.write` → 403
  - 空列表 200；缺库 404
  - 契约无密钥键
  - admin：有行展示 diff；无行「暂无修改日志」

### 不做

- 把 `admin_write` 中间件全路径落表（ARCH-P1b-2 仍是 Pino、不落表）
- 角色/用户/成员/审批/lifecycle 的修改日志
- 失败 Webhook / 三平面配额 / 在线编写
- 新权限码 / 独立审计管理台 / 导出
- 记 tauClaim / qualitySnapshot / API Key
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构
- 浏览器 E2E

收工：更新 `.trellis/spec/` 对应包；回写 `docs/module-status/`；`.trellis/tasks/08-06-project-backlog/` 目录若无则跳过，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（db / contracts / api / admin）与 HOW `.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头目标/简介简体中文，并登记 index。

## Comments

- 2026-09-07 认领并执行。权威切边见 [裁定写路径锁超管全码后下一步](./32-after-superadmin-codes-lock-order.md)。
