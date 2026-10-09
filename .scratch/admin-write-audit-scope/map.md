# 管理写审计的覆盖面口径（哪些写路径必须留痕）

Label: wayfinder:map
Status: in-progress（前沿：工单 03 实现）

## Destination

把「**哪些写路径算『管理写』、各自该留什么强度的痕**」从一个**正则枚举的硬编码名单**变成**有口径、可核对、防漂移**的一件事。

今天的样子：`apps/api/src/middleware/admin-write-audit.ts` 的 `shouldAuditAdminWrite(method, path)` 是一串手写正则，覆盖六类（成员 / approve·reject / lifecycle / `/api/v1/admin/*` / KB settings PATCH / 在线编写 `documents/write`），**没有任何一处写明「为什么是这六类」**。于是同类路径按**先来后到**决定进不进名单：

- **文档内容处置类**（`POST …/dedupe-conflicts/:chunkId/resolve` · `POST …/supersede` · `PATCH /documents/:docId` · `PUT /documents/:docId/acl`）**一个都不进** —— 这四条是上一张图（`.scratch/pending-review-ops/` 工单 02）当场记下的残留，也已写进项目总 backlog §0 的**未决行**（2026-10-09），原文口径就是「**先定『哪些路径属管理写』再一次性对齐 + 补测**」。
- 相邻的 `POST …/reindex` · `POST …/scan` · `DELETE /documents/:docId` · `POST …/complete` · KB 增删 等同样**未核**。
- 而「审计」在本仓其实有**两层**：`admin_write` 的 **Pino 结构化行**（粗：只有 method/path/status/durationMs，**不含改了什么**）与 `kb_settings_audits` 的**持久化 diff 账本**（细：可查账；今天只有 KB settings PATCH 用，另有 `GET …/settings-audit` 读面）。**哪条路径该落到哪一层，今天没有口径**。

到达时满足：

1. **全量事实有清单**：全仓 `POST/PUT/PATCH/DELETE` 路由逐条列出（method + 路径形状 + 权限码 + 今天是否进 `admin_write` 名单），每条指到源码注册行；不存在「大概还有几条」。
2. **口径可核对且能指回 PRD**：判定「管理写」的准则写成可读的判据，且与之相关的**冻结文本逐条对上**（`prds/05-api` 的 KB settings PATCH「可写字段变更写**修改日志（diff）**」与 chunk-strategies「写**审计日志**」· `prds/09-security` 的「配置变更写审计」· 验收剧本 AA1/AB2/AC6/AD4/**AE7**/P7/B1-5 的「审计」要求 · M2/M8 的「审计含 hash + uploaderId + timestamp」）。**指不到 PRD 的判据必须自陈是「实现选择」**。
3. **强度分级有裁定**：每条路径定「Pino 记录 / 持久化账本 / 不需要」中的哪一档，并写清**为什么**（PRD 要求什么强度的「痕」）；今天做不成的**如实记债**并带销账条件，**不许**为了让名单好看而把「Pino 行」说成「可查账」。
4. **覆盖面按口径对齐且防漂移**：名单按口径改（**只加严，不放宽**）；并新增一条**结构型反漂移测例** —— 从**真实 app 的路由表**枚举全部 mutating 路由，逐条断言「在名单 ∨ 在**显式例外表**里，且例外必须带理由」。将来新增写路由不会静默漏审。
5. **反证成立**：拆掉判据（例如让新加的规则恒假）→ 若干条测例**必红**；并给出「改前漏审 / 改后已审」的**逐条对照**。
6. **回写一致**：`.trellis/spec/api/backend/`（logging-guidelines 与/或对应包文）· `docs/module-status/api.md` · 覆盖表相关行 · 雾清单簇 **10** · 总 backlog §0 的**未决行**（改「已定案 + 指针」）· `docs/agents/issue-tracker.md` 不涉。
7. **未验证的如实写**：本机无浏览器（本图不涉 UI）· 真 PG 实况按实际探测写（不凭前图口径推断）· 「审计」的**保留期**（09-security §5 的 180 天）与 log 落地形态不在本图。

**不含**：新建持久化审计**表 / 迁移**（除非裁定判定某条路径 PRD **明写**要有可查账且离线可做 —— 默认记为债）· 改任何 `prds/00–11` 冻结文本 · 改默认开关 · 把 `admin_write` 扩成含请求体（**禁止**：会带进密钥）· 全量「管理写」的保留期/轮转/落盘策略。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像。
- **来源（两处点名同一件事）**：① 项目总 backlog `.trellis/tasks/08-06-project-backlog/status.md` §0 的**未决行**（2026-10-09 · 「文档内容处置类写审计口径」，点名四条路径 + 「先定口径再一次性对齐 + 补测」）；② `.scratch/fog-inventory-2026-09-23.md` **簇 10**（跨部门 grant 的**删除**要不要留痕；P3b 出口 AE7 行）。③ 上一张图 `.scratch/pending-review-ops/` 工单 02 的裁定残留（「同类不同待」）。
- **代码自己写下的口径**：`admin-write-audit.ts:14-18` 的注释「覆盖：成员 / 审批 / 生命周期 / 平台 admin / KB settings 写。排除：GET、ask SSE、auth、health/ready/metrics」—— **这是唯一的口径文本**，且与实现已经不一致（实现还多了「在线编写 `documents/write`」，注释没写）。
- **本图直接相关的既有面**（开工基线已逐条核过；明细由工单 01 补齐）：`apps/api/src/middleware/admin-write-audit.ts` · `apps/api/src/app.ts`（挂载与路由表）· `apps/api/src/routes/documents/index.ts` · `apps/api/src/routes/dept-grants.ts` · `apps/api/src/services/kb-settings-audit.ts` + `packages/db/src/schema/kb/kb-settings-audits.ts`（唯一的持久化账本）· `apps/api/tests/obs/admin-write-audit.test.ts`。
- 每轮先读：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/05-api/01-http-api-hono.md`（§2.1 / §2.2 / §2.9 / §5.2 的审计行）· `prds/09-security/01-auth-acl-compliance.md` §4 / §5 · `prds/10-delivery/03-acceptance-scenarios.md` 里带「审计」的剧本行 · `docs/module-status/api.md`。
- **本图携带执行**：工单可以动手改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口批次跑 `pnpm test`，并跑 `pnpm check:module-status`（`1-路径` / `6-联动` / `7-时效` 必须空）。测例只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **质量红线不放宽**：门禁只加严不放宽；本图只增覆盖、不改任何既有判据的**方向**。
- **日志红线（本图特有）**：`admin_write` 载荷**不得**含请求体 / 字段值 / 密钥（既有测例已钉「无敏感键」）——「改了什么」只允许走**已裁定的持久化账本**那条路，不许塞进 Pino payload。
- **改既有测例的红线**：既有 `apps/api/tests/obs/admin-write-audit.test.ts` 里「`complete` → false / `sessions` → false」这两条**是有意的断言**，若新口径判定它们应改判，必须**先裁定、再改断言**，并把「为什么翻」写进工单，不许为了让测试变绿而调口径。
- **本机限制**：无浏览器（本图不涉 UI）；真 PG / 真 ES / Docker 按实际探测结果写，不凭前图口径推断。

### 开工基线（2026-10-10 · 主控逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| 判定函数 | `shouldAuditAdminWrite(method, path)`：`MUTATING = {POST,PUT,PATCH,DELETE}`；排除 `/health` `/ready` `/metrics` · `/api/v1/auth/*` · `/…/ask`；命中六类正则（成员 · approve/reject · lifecycle · `/api/v1/admin/` 前缀 · `PATCH …/settings` · `POST …/documents/write`） |
| 挂载 | `apps/api/src/app.ts:49` 的 `app.use('*', adminWriteAuditMiddleware)`，在 `attachAuthMiddleware`（`:48`）之后、所有域路由之前；域路由统一挂 `/api/v1`（`:85-101`）→ `c.req.path` 带 `/api/v1` 前缀 |
| 载荷 | `{ event:'admin_write', method, path, status, durationMs }`（`buildAdminWritePayload`）；上下文 `requestId` / `userId` / `tenantId` / `kbId`（`extractKbIdFromPath`）。**无 body、无字段值、无 diff** |
| 持久化账本 | **全仓只有一张审计表** `kb_settings_audits`（`packages/db/src/schema/kb/kb-settings-audits.ts` · 迁移 `packages/db/drizzle/0013_kb_settings_audits.sql` · `diffJson: Record<string, {from, to}>`），写点 `apps/api/src/services/kb-settings-audit.ts`，读面 `GET /knowledge-bases/:kbId/settings-audit`（成员闸、默认 50、缺省 404） |
| 今天**不**进名单的同类写（主控初核，完整清单待工单 01） | `POST …/documents/:docId/supersede` · `POST …/documents/:docId/dedupe-conflicts/:chunkId/resolve` · `PATCH /api/v1/documents/:docId` · `PUT /api/v1/documents/:docId/acl` · `POST …/documents/:docId/reindex` · `POST …/documents/:docId/scan` · `DELETE /api/v1/documents/:docId` · `POST …/documents/:docId/complete` · KB 增删改 · 部门 / 角色 / 用户的部分路径（非 `/api/v1/admin/` 前缀者）—— **均待工单 01 逐条核实** |
| 既有测例 | `apps/api/tests/obs/admin-write-audit.test.ts`（245 行 · 4 组 `shouldAuditAdminWrite` + 载荷/中间件/contextLog），**只钉住当前枚举**；其中「非管理写（upload complete / sessions）→ false」是**有意断言** |
| PRD 依据（原文，待工单 01 补全出处行号） | `05-api` §2.1 KB settings PATCH「审计 \| 可写字段变更写 **修改日志**（diff）」· §「`PATCH …/chunk-strategies` 须 `kb.config.write`；写 **审计日志**」· §「审计 \| 角色/用户变更写 audit」· `09-security` §4「配置变更写审计 + 可触发再认证」· 剧本 **AE7**「给 X 跨部门 grant level≥30 → 审计有记录」· AA1/AB2/AC6/AD4「… 有**审计日志**」· P7 换辅「审计事件」· B1-5 超管非成员管文档「须审计」· M2/M8 infected 删除「审计含 hash + uploaderId + timestamp」 |
| 相邻但**不在**本图 | 簇 10 的「**持久化**留痕」决定（本图给口径；建表 = 另图 + 迁移）· `admin_write` 的保留期 / 轮转（09-security §5 的 180 天）· 从 log 里查账的读面 |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 现状核实：全量 mutating 路由 · PRD 审计要求 · 今天两层审计各覆盖什么](./issues/01-research-audit-surface.md) — 研究子代理产出（451 行 / 54 KB 在 [research/01-audit-surface.md](./research/01-audit-surface.md)）。要点：① 全仓 mutating **50 条**，实测**命中 24 / 未命中 26**；② **六条正则无一死规则**；③ **`app.routes` 可枚举、`createApp()` 不连 DB**（须按 `(method,path)` 去重，Hono 按 handler 展开）；④ PRD 对「痕」**无显式分级**（明文最强档只有 settings PATCH 的 diff 与 chunk-strategies 的旧→新）；⑤ `admin_write` **只落 stdout、无读面**；`kb_settings_audits` **服务两条路径**；⑥ **推翻三处立项前提**：`supersede`/`resolve`/lifecycle **今天零痕**、账本非「只服务一条」、正则无死规则；⑦ **会翻的既有断言 = 0**；⑧ **有 PRD 依据却零痕**的实缺含 `PUT …/knowledge-bases/:kbId/model-bindings`（剧本 **AC6**，题面未点名）；⑨ 簇 10 的 DELETE **已被 `admin_write` 命中**且有测例钉 AE7。
- [02 · 裁定：口径 · 强度分级 · 例外表 · 防漂移](./issues/02-dec-audit-scope-ruling.md) — 主控裁定。**R1 口径 = 默认全审 + 显式例外**（`MUTATING ∧ ¬基础设施 ∧ ¬例外表`；语义 = 「改变 KB/平台**治理状态**的写」；否掉「按语义分组枚举」的理由是它保留「漏登记即免审」的结构病；按权限码判**不可行** —— 中间件在路由匹配之前，拿不到权限码）。**例外表 11 条**（ask · auth×4 · sessions · feedback POST · upload-url · internal/objects · complete · internal/eval/execute-ask · infra）。**R2 三档痕**：L1 全部管理写落 Pino `admin_write`（**禁止**加 body/字段值）· L2 持久化 diff 账本只给 PRD 明写 diff 的两条（**已闭环，不扩、不建表**）· L3 领域事件**保持 21 条不动**。**R3 新增覆盖 15 条**（含 KB 创建 #1 · reindex · scan · supersede · resolve · DELETE doc · PATCH 元数据 · PUT acl · KB model-bindings · chunk-strategies PATCH · feedback PATCH · gold-questions ×3 · eval/runs）⇒ 审计 **39** + 例外 **11** = **50**；**既有断言零翻**（`complete` / `sessions` 进例外表）。**R4 簇 10 裁定 = Pino 层已满足、不建表**；backlog 未决行 → 定案。**R5 残差记债**（无读面/无留存 · 领域事件缺字段 · `write`↔`complete` 不对称）。**R6 引入防漂移结构测例**（全覆盖 + 例外表紧致 + 计数自洽；新路由不决定即红）。**R7** 口径落源码注释 + spec + 镜像。**R8** 既有测例只增不改期望值 + 反证。**R9** 六条债带销账条件。

## Not yet specified

（立图时为空；随工单逐条填入，且每条都要带销账条件。）

## Out of scope

- 新建持久化审计**表 / 迁移**（默认记为债；除非裁定判定某条路径 PRD **明写**要有可查账且离线可做）
- 把请求体 / 字段值 / 密钥塞进 `admin_write` 的 Pino 载荷
- 改任何 `prds/00–11` 冻结文本；改任何默认开关
- 审计日志的保留期 / 轮转 / 落盘 / 外部采集（Sentry / 日志平台）配置
- 顺带清扫与本图无关的其它雾（各自另图）
