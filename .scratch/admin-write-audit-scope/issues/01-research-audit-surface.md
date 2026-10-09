# 现状核实：全量 mutating 路由、PRD 审计要求、今天两层审计各覆盖什么

Type: research
Status: resolved
Blocked by: —

## Question

把「管理写审计」这件事**逐条落到源码与 PRD 事实**，好让裁定票能拍板（不发明语义、不写建议）。每条结论**指到路径 + 行号**，并区分「源码事实」与「推断」。**只读**，不改任何源码 / PRD / 文档。

1. **全量 mutating 路由清单（本图的事实底座）**
   - 全仓 `POST` / `PUT` / `PATCH` / `DELETE` 路由**逐条**列出：注册文件:行号 · method · 路径形状（含挂载前缀）· 权限守卫（哪一串 `requirePermission(…)` / 其它）· 一句话作用。
   - 覆盖 `apps/api/src/routes/` 全目录（含 `documents/` 子目录）**以及**任何在别处注册的路由（`app.ts` 里 `app.route()` 的每一个 + 内联注册、`openapi/routes.ts`、内口路由）。
   - 对每一条，标注**今天 `shouldAuditAdminWrite` 是否命中**（true/false），并给出命中的是哪一条正则。
   - 反过来：`shouldAuditAdminWrite` 的每条正则，**今天实际能命中哪些已注册路由**？（有没有「写了但永不命中」的死规则 —— 例如 `PUT …/admin/model-bindings` 这类形状是否真存在于路由表。）
   - 明确排除项：`GET` 全量不算；`/health` `/ready` `/metrics` `/api/v1/auth/*` `/…/ask` 单列。

2. **白名单机制的形状与可测性（为「反漂移测例」准备事实）**
   - `admin_write` 中间件的挂载位置、执行顺序（与 auth / 域路由的相对位置）、`c.req.path` 的实际形状（带不带 `/api/v1` 前缀、有没有 query / 尾斜杠）。
   - **Hono 4.x 能否从真实 app 枚举路由表**？（`app.routes` 的属性形状、是否含 method + path、`createApp()` 能否在测试里直接调用而不起进程/不连 DB。）给出**实际验证过的**结论（例如在临时脚本或测试里 `console.log` 过），不要只凭文档。
   - 有没有现成的「路由清单」可复用？（`openapi/` 的 schema 源、contracts 里的路径常量、任何 `ROUTES` 表。）若有，给出可用性与局限。
   - 若做「默认全审 + 显式例外表」，**例外表**需要哪些条目？（列出今天必须排除的路径与其理由，例如高频自助写。）

3. **PRD / ADR / 剧本的审计要求（逐条原文 + 出处）**
   - `prds/05-api/01-http-api-hono.md`：所有含「审计」「修改日志」「audit」的表行与正文句 —— 逐条给出**行号 + 原文 + 它管的是哪个端点**。特别核 `:104`（KB settings PATCH 的「可写字段变更写**修改日志（diff）**」）与 `:190`（`PATCH …/chunk-strategies`「写**审计日志**」）与 `:494`（「角色/用户变更写 audit」）与 `:662`（settings PATCH 检查单「有审计」）。
   - `prds/09-security/01-auth-acl-compliance.md`：§4 / §5 里所有与「操作可审计」「配置变更写审计」「保留期 180 天」「break-glass 审计」相关的原文与行号。
   - `prds/10-delivery/03-acceptance-scenarios.md`：**逐行**列出带「审计」字样的剧本行（编号 + 原文），并标注每行的主语是**哪条写路径**。
   - `prds/11-decisions/00-adr-index.md`：ADR-035 / ADR-037 / ADR-046 / ADR-051 / ADR-054 / ADR-057 / ADR-062 里凡提到审计 / 留痕 / 修改日志的条款原文与行号。
   - `prds/08-quality/*` 与 `prds/06-async/*` 里「审计 + 告警」类要求（换模 / infected 删除），只列与**写路径留痕**相关的。
   - 结论层：**PRD 对「痕」的强度有没有分级**？（哪些路径明写「修改日志 / diff / 可查账」，哪些只写「审计」「有记录」？）逐条给出你的判断与依据；**推断**要标出来。

4. **今天两层审计各覆盖什么（实现事实）**
   - `admin_write`（Pino）：载荷字段、上下文、写入时机（成功/抛错）、有没有读取面、保留期相关配置。
   - `kb_settings_audits`（持久化）：谁写、写什么（`diffJson` 形状）、读面端点与权限、失败 PATCH 是否写、成员闸、默认条数；**它是不是只服务 KB settings PATCH 一条路径**？（还是 chunk-strategies 也复用？核 `apps/api/tests/kb/chunk-strategy-audit.test.ts` 到底在测什么。）
   - 全仓还有没有**第三处**留痕机制（inline `childLogger(...).info({event: …})` 的领域事件，例如 `dept_cross_grant_create/delete`、`supersede`、`resolve`、lifecycle 变更）？逐条列出 `event:` 名与写点行号 —— 这些**是不是**已经构成部分「审计」？（注意与 `admin_write` 的区别：领域事件 vs 通用操作日志。）
   - 逐路径对照表：**路径 × 今天的痕（无 / 领域事件 / admin_write / 持久化账本）× PRD 要求的痕** —— 缺口一格一格列出来。

5. **既有测例与登记现状**
   - `apps/api/tests/obs/admin-write-audit.test.ts` 逐组列出断言（含 `complete → false`、`sessions → false` 这两条有意断言）与它们在文件里的行号。
   - `apps/api/tests/index.md` 里该文件的登记行原文；`docs/testing/coverage*.md` 里与本图相关的行。
   - 若名单变化，**会翻的既有断言**逐条列出（路径行号 + 为什么翻）。特别是：新口径若把 `complete` 或 `sessions` 判成「要审」，翻的是哪几条。
   - 有没有别的测试文件（HTTP 级）会因为新增审计行数而变红？（例如断言日志调用次数的用例。）

6. **反向复核（防高估 = 防止本图做重复功）**
   - 有没有**别处**已经实现了「管理写 = 全量 mutating 减例外」的口径或清单？（全仓搜 path 列表 / 权限码驱动的中间件 / 任何 `AUDITED_*` 常量。）找过再回答。
   - 有没有既有裁定 / 债行**已经声明本项不做或延后**？（`.scratch/pending-review-ops/` 工单 02 · `close-p2-exit-gaps` · `p3b-*` 图 · `p2-exit-evidence` · `docs/module-status/api.md` 技术债行 —— 给出原文与出处，避免本图与既有裁定打架。）
   - 簇 10 的原始问题（「跨部门 grant 的**删除**要不要留痕」）今天的事实是什么？AE7 的「审计有记录」是否已被 `admin_write` + 领域事件 `dept_cross_grant_delete` 满足？**给出证据**（`dept-grants.ts` 的 DELETE 路径是否落在 `/api/v1/admin/` 前缀下 → 是否被 `admin_write` 命中）。
   - 镜像 `docs/module-status/api.md` 里关于 `admin_write` / 管理写审计的**原文句**（含技术债表相关行）。

7. **噪声与代价（为裁定准备，不下结论）**
   - 若改成「默认审计 + 显式例外」，**新增**会被打点的路径有哪些？逐条估**发生频率量级**（每用户每会话 / 每次上传 / 每次运营动作），并指出哪些是**高频自助写**（会放大日志量）。
   - 有没有「同一请求被打两次」的风险？（领域事件 + `admin_write` 各一行 —— 今天哪些路径已经是这样。）
   - `admin_write` 的行**能不能**满足「可查账」？（有没有读取 / 查询 / 留存机制；Pino 落哪里。）给出你今天能核到的最大事实，核不到的标「未核」。

## Answer

**研究子代理产出（451 行 / 54 KB）：[research/01-audit-surface.md](../research/01-audit-surface.md)**（全文按本节 1–7 组组织；行号实测；全称否定附搜索范围；临时探针已删、仓库零改动）。要点：

**① 全量 mutating 路由 = 50 条，今天命中 24 / 未命中 26**（实测：临时 vitest 探针 `createApp()` 后 dump `app.routes`，逐条对**真实** `shouldAuditAdminWrite` 调用）。注册面只有 `apps/api/src/routes/**` + `app.ts` 内联（仅 GET 3 条）+ `openapi/routes.ts`（仅 2 条 GET）。

**② 六条正则无一死规则** —— 每条都命中至少 1 条真实路由；`PUT /api/v1/admin/model-bindings` **确实存在**（`model-gateway.ts:170`），而同名的 `PUT /api/v1/knowledge-bases/:kbId/model-bindings`（`kb-settings.ts:223`）**不**命中 —— 这是一条**有 PRD 依据却零痕**的实缺（剧本 AC6 明写「审计」）。

**③ `app.routes` 枚举可行（实测）**：`createApp()` 在测试里可直接调用、**不连 DB、不起进程**（DB 是 `getDb()` 懒连）；元素键 `[basePath,path,method,handler]`。**关键坑**：Hono 按 **handler 逐条展开**（一条路由挂 N 个 handler 就出现 N 条同 method+path，`ingest-report` 出现 3 次）⇒ 反漂移测例**必须按 `(method,path)` 去重**。仓内**无**集中路径常量表可复用。`c.req.path` 实测：带 `/api/v1` 前缀、不含 query、无尾斜杠。

**④ PRD 对「痕」无显式分级**（本报告按措辞归纳三档，已标【推断】）。真有明文的最强档只有两条：`05-api:104` KB settings PATCH「写**修改日志（diff）**」（+ ADR-054`:1574`）与 `05-api:190` chunk-strategies「写**审计日志**」（+ ADR-053`:1501`「旧→新」）。`09-security:328` 是**唯一**把「**下载/删除/ACL/成员变更**」写进记录清单的条款。

**⑤ 今天两处留痕 + 一处领域事件**：`admin_write`（仅 Pino→stdout，**无读面 / 无留存配置**，仓内不能满足「可查账」）· `kb_settings_audits` 持久化账本（**服务两条路径**：settings PATCH + chunk-strategies PATCH，非题面以为的一条）· 21 个 inline 领域事件（覆盖 `/admin/*` 写 + 两条 KB 配置写 + reindex + ACL 收紧）。

**⑥ 推翻立项前提的三处**：(a) **`supersede` / `resolve` / `lifecycle` 今天完全零痕**（连领域事件都没有 —— 题面以为有）⇒ 缺口比假设更大；(b) 账本**服务两条**路径；(c) 六条正则**无死规则** ⇒「清理死规则」不是本图的问题。

**⑦ 会翻的既有断言：零。** 唯一把「不审」写成硬断言的是 `apps/api/tests/obs/admin-write-audit.test.ts:76-86`（`complete` / `sessions` → false）；断言 `childLogger().info` **次数**的只有该文件；`dept-grants-http.test.ts` 用 `find(event)` 不断言次数 ⇒ 新增审计行不会使它变红。

**⑧ 噪声面**：若「默认审计 + 显式例外」，噪声源是 `sessions`(#38) > `feedback` POST(#39) > 上传三连(#2/#3/#4)；今天已有 18 条路径「领域事件 + `admin_write` 各一行」（双写）。

**⑨ 反向复核**：全仓**没有**别处实现过「管理写 = 全量 mutating 减例外」的口径或清单；现有相关裁定（backlog §0:31 · pending-review-ops 工单 02 · 雾簇 10 · p3b-principal-forms · module-status/api.md:47）**均为「未决/待裁」**，无一处声明永久不做。**簇 10 的事实**：`DELETE /api/v1/admin/dept-cross-grants/:id` 落在 `/api/v1/admin/` 前缀下 → **已被 `admin_write` 命中** + 领域事件 `dept_cross_grant_delete`，且 `dept-grants-http.test.ts:306-395` **已正面钉住 AE7** ⇒ 「AE7 审计有记录」在 **Pino 层已满足**，仅「表级留痕」未满足。

**⑩ spec 与源码已不一致**：`logging-guidelines.md:36` 的「覆盖」只列 5 类，实现已有第 6 类（`POST …/documents/write`）。
