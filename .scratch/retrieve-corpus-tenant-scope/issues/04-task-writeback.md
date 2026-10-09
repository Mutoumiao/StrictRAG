# 回写：镜像 / spec / 覆盖表 / 雾清单 + 对抗性复核

Type: task
Status: open
Blocked by: 03

## Question

1. `docs/module-status/api.md`：检索语料装载一节按实现回写（租户来源、缺租户姿态、与 ES builder 硬闸的口径关系）；「最近更新」补条目。
2. `.trellis/spec/api/backend/ask-pipeline.md`（或 `auth-authorization.md` / `quality-guidelines.md` 中最相关者）：若本图定下「装载面租户显式」的口径，写进 spec（HOW）；**先**看是否已有同题段落，避免双份。
3. `docs/testing/coverage/` 相关行（`01-ingest.md` / `02-acl.md` 里涉及 corpus / 租户的行）：缺口列按实现改写，**覆盖值逐格判**（判据没动的不许抬）。
4. `.scratch/fog-inventory-2026-09-23.md`：**簇 8 标已解**（或按裁定写实）；若带出新的未决项，补进本图 `Not yet specified` 与雾清单。
5. **对抗性复核**：逐条核本轮回写的每一处，判「成立 / 新高估 / 需收紧」并逐条修正；**新高估多半出在「把验证发生在哪写错」**（前图教训）。收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`（`1-路径` / `6-联动` / `7-时效` 三类须为空）。
