# 裁定：「管理写」的口径、例外表与审计强度分级

Type: grilling（主控裁定）
Status: resolved
Blocked by: 01

## Question

基于工单 01 的事实，拍出下面四件，并逐条写清**依据**（PRD 原文 / 源码事实 / 实现选择）：

1. **口径**：判定「管理写」的准则是什么？至少给出两种候选并说明取舍 —— 例如
   - (a) **默认全审 + 显式例外**（口径 = 「会改变持久化状态且非本人私有」的写路径；例外表逐条带理由）；
   - (b) **按语义分组枚举**（权限/生命周期/内容处置/配置/平台管理），每组的纳入理由指回 PRD；
   - (c) **按权限码**（`*.manage` / `*.write` / `*.editor`）—— 若中间件拿不到权限码，说明为什么不可行（源码事实）。
   必须回答：`POST …/documents/:docId/complete` 与 `POST …/sessions` 这两条**今天被有意判否**的路径，在新口径下**应否改判**，以及改判与不改判各自的依据。

2. **强度分级**：每条路径定档 —— **不需要 / 领域事件 / `admin_write` Pino / 持久化可查账**。
   - 依据只能是 PRD 原文 + 验收剧本要求；**PRD 没写**的档位属于**实现选择**，要标出来。
   - 明确「Pino 行 ≠ 可查账」；凡 PRD 明写「修改日志 / diff / 可查账」而今天只有 Pino 或什么都没有的，逐条写明。
   - 逐条给**处置**：本图落地 / 记债（带销账条件）/ 划出（带理由）。

3. **簇 10 与 backlog 未决行的收口口径**：
   - 「跨部门 grant 的**删除**要不要留痕」——按 PRD（AE7「审计有记录」）与今天的事实（`admin_write` + 领域事件），给出**定论**：已满足 / 缺什么。
   - backlog §0 的「文档内容处置类写审计口径」未决行 → 本图给它**定案**（改「已定案 + 指针」），并把四条路径的处置写清。

4. **防漂移机制**：是否引入「从真实 app 路由表枚举 mutating 路由，逐条断言 ∈ 名单 ∨ ∈ 带理由的例外表」的结构型测例？
   - 若引入：例外表放哪（源码常量 / 测试夹具）· 断言形状 · 新路由漏登记时**怎么红** · 是否会把「新增路由」变成必须同 PR 处理的门（这是**加严**，说明它为何可接受）。
   - 若不引入：给出理由，并说明退而求其次的防漂移手段。

## Answer

主控裁定。**不动 `prds/00–11` 任何条款文本**（本图落的是实现口径，不是改语义）；**不新建表 / 迁移**。

### R1 · 口径（「管理写」是什么）

**判定式（实现形状）**：`管理写 = MUTATING ∧ ¬基础设施路径 ∧ ¬例外表命中` —— 即**默认全审 + 显式例外**（工单 02 的候选 (a)）。取消今天的「正则可选枚举」：那种写法下**新增一条写路由会静默免审**，正是本图要消掉的病。

**语义口径（为什么这样算）**：管理写 = **改变 KB 治理状态或平台治理状态**的写 —— 治理状态 = ① 访问（成员 / 角色 / 权限码 / 文档 ACL / 跨部门授权）② 内容去向与状态（lifecycle / supersede / 权限处置 resolve / 删除 / 元数据与可见级）③ 配置（KB 设置 / 分片策略 / 模型绑定 / 平台网关配置）。**判据要能指回 PRD**：逐条例外的理由、以及每条新纳入路径的 PRD 依据，都写进源码注释与 spec（见 R7）。

**例外表（11 条，逐条带理由；顺序即实现顺序）**：

| # | 路由 | 理由（事实 + 依据） |
|---|---|---|
| 50 | `POST /api/v1/knowledge-bases/:kbId/ask` | ask SSE 长连；高频自助；沿用既有排除 |
| 46–49 | `POST /api/v1/auth/{admin,web}/{dev-login,token/refresh}` | 身份面；每次续期一条；沿用既有排除 |
| 38 | `POST /api/v1/knowledge-bases/:kbId/sessions` | 每次新会话一条（**最高频自助写**）；无 PRD 留痕条款；**既有有意断言** |
| 39 | `POST /api/v1/ask/:requestId/feedback` | 每次点赞/点踩一条（高频自助）；无 PRD 条款 |
| 2 | `POST /api/v1/knowledge-bases/:kbId/documents/upload-url` | 上传暂存三连之一；高频；内容提交由 `documents` 表自身持久留痕 |
| 3 | `PUT /api/v1/internal/objects` | 上传暂存（local 存储中转）；同上 |
| 4 | `POST /api/v1/knowledge-bases/:kbId/documents/:docId/complete` | 上传暂存收尾；**既有有意断言**；无 PRD 条款 |
| 45 | `POST /api/v1/internal/eval/execute-ask` | 内口（`x-eval-internal-token`，**非用户令牌**）；批跑高频 |
| — | `/health` · `/ready` · `/metrics` | 非业务写（今天也是 GET，保留以防将来加写方法） |

**为什么不是「按权限码判」**：中间件在**路由匹配之前**执行（`app.ts:49` 早于域路由 `:85-101`），手上只有 `method` + `path`，**拿不到** `requirePermission(...)` 的结果 —— 【源码事实】故口径必须落在**路径**上。

**两条候选的取舍**：(b)「按语义分组枚举」被否 —— 它保留了「漏登记即免审」的结构病，且分组会随时间继续漂移（这正是今天的现状）。(a) 的代价是**每新增一条写路由都要显式决定**（要么被审、要么进例外表），这是**加严**，符合「门禁只加严不放宽」；且这个代价由 R6 的测例**强制**，不靠人记。

### R2 · 强度分级（「痕」有几档）

**L1 · Pino 通用行（`admin_write`）**：**全部管理写**都落。载荷仍只有 `{event,method,path,status,durationMs}` + 上下文（`requestId`/`userId`/`tenantId`/`kbId`）—— **禁止**加请求体 / 字段值 / 密钥（既有测例已钉）。

**L2 · 持久化可查账（`kb_settings_audits` + `GET …/settings-audit`）**：**只**给 PRD 明写「修改日志 / diff / 旧→新」的路径 —— 今天 = KB settings PATCH（`05-api:104` + ADR-054`:1574`）与 chunk-strategies PATCH（`05-api:190` + ADR-053`:1501`），**两条已闭环**。本图**不**扩 L2、**不建表**（`logging-guidelines.md:48` 的站规明写禁止「为操作日志新建审计表」；其余路径 PRD 只写「写 audit / 审计」，未要求 diff）。

**L3 · 领域事件（带业务语义的 Pino 行）**：现有 **21 处打点（去重后 20 个事件名）** —— `department_patch` 在 `routes/departments.ts:171`（parentMoved 支）与 `:178`（普通支）各一处 —— **保持不动**；本图**不新增**领域事件（新纳入路径只落 L1）。

**明写「Pino 行 ≠ 可查账」**：`admin_write` 只落 stdout、**无读面 / 无留存配置**；凡 PRD 要求「可查账」的地方今天只有 Pino 的，**如实记债**（R9）。

### R3 · 覆盖面落地（只加严；新增 15 条）

按 R1 判定式，**新纳入**：`POST /api/v1/knowledge-bases`(#1 · **ADR-035`:502`「创建 KB…审计强制」**) · `POST …/documents/:docId/reindex`(#6 · ADR-053`:1502`) · `POST …/documents/:docId/scan`(#9) · `POST …/documents/:docId/supersede`(#11 · ADR-020`:182`「保留审计」) · `POST …/dedupe-conflicts/:chunkId/resolve`(#12 · backlog 点名 + `09-security:328`) · `DELETE /api/v1/documents/:docId`(#13 · `09-security:328` 明写「删除」) · `PATCH /api/v1/documents/:docId`(#14 · backlog 点名) · `PUT /api/v1/documents/:docId/acl`(#15 · `09-security:328` 明写「ACL」) · `PUT …/knowledge-bases/:kbId/model-bindings`(#20 · 剧本 **AC6**「审计」) · `PATCH …/chunk-strategies`(#21 · 与账本口径对齐) · `PATCH /api/v1/feedback/:feedbackId`(#40) · `POST/PATCH/DELETE …/gold-questions`(#41–43) · `POST …/eval/runs`(#44)。

**结果**：审计 39 条（24 + 15）· 例外 11 条 = 全量 50 条。

**既有断言零翻**：`complete`(#4) 与 `sessions`(#38) 在例外表里 ⇒ `apps/api/tests/obs/admin-write-audit.test.ts:76-86` 的两条**有意断言继续为真**。本图**不**改任何既有断言的期望值。

### R4 · 簇 10 与 backlog 未决行的收口口径

**簇 10（跨部门 grant 的删除要不要留痕）→ 裁定：Pino 层已满足，不建表。** 依据：`DELETE /api/v1/admin/dept-cross-grants/:id` 落在 `/api/v1/admin/` 前缀下、**已被 `admin_write` 命中** + 领域事件 `dept_cross_grant_delete`；`dept-grants-http.test.ts` **路由级用例**（`:306-350`）对 POST / DELETE 各断言一条领域事件，**中间件级用例**（`:352-395`）只发了 POST（`:374`）—— DELETE 那条靠 `/api/v1/admin/` 前缀命中、**未**被直接断言（主控实测 `audited=true`）。两者合起来满足剧本 **AE7**「审计有记录」；表级留痕**无 PRD 依据**（AE7 只写「有记录」），且 ADR-057 要的「原因审计」已由 `dept_cross_grants.reason` 列 + `granted_by` / `created_at` 承载。⇒ 簇 10 **按「已满足」销账**（并写明「表级留痕 = 明确不做」的依据）。

**backlog §0 未决行 → 定案**：四条名义路径按 R3 全部纳入 L1；口径见 R1；改「已定案 + 指针」。

### R5 · 「可查账」的残差（如实记债，不在本图落地）

- `admin_write` **无读面 / 无留存 / 无轮转配置** ⇒ 仓内**不能**满足「可查账」；`09-security:330` 的「审计日志 180 天」**未落地**（生产是否外接采集**未核**，仓内无证据）。
- L3 领域事件缺字段：`model_bindings_put` 缺 P7/ADR-055 要的「旧/新 provider+model + 原因」；`chunk_strategy_reindex` 缺 ADR-053`:1502` 要的「谁」。**本图不补**（补 = 改语义/加字段，须另裁）。
- **口径不对称（已知残留）**：`POST …/documents/write`(#5，已审) 与 `POST …/complete`(#4，例外) 同属「内容提交」，前者多一层 Pino 痕。**不改**（改任一方向都须另裁：纳入 complete 会翻既有断言、移除 write 是放宽）。

### R6 · 防漂移机制（裁定：引入，且是本图的核心交付）

**新增结构型测例**（`apps/api/tests/obs/admin-write-coverage.test.ts`）：从**真实 app**（`createApp()`，不连 DB、不起进程）枚举 `app.routes` → 按 `(method, path)` **去重** → 只留 mutating → 断言：

1. **全覆盖**：每条 mutating 路由，`shouldAuditAdminWrite(method, path) === true` **或**该路由被某条约外的 `routes` 声明**逐字**列中。
2. **例外表紧致**：每条例外声明的路由集合非空、每条都在 `app.routes` 里真实存在、且该例外正则**在 mutating 路由集上恰好命中声明的那些**（多命中一条即红 —— 防「例外写宽了、新路由静默免审」）。
3. **计数自洽**：审计条数 + 例外条数 = 全量 mutating 条数（今天 = 39 + 11 = 50）。

⇒ 将来新增写路由**不显式决定就红**（默认被审、要免审必须进表并写理由）。这是**加严**，符合红线。

### R7 · 口径的落脚点（写在哪）

- **源码**：`admin-write-audit.ts` 的注释写 R1 的判定式 + 例外表（每条带理由）并**去掉**「覆盖：五类」的陈旧枚举。
- **spec**：`.trellis/spec/api/backend/logging-guidelines.md` 的 ARCH-P1b-2 一节按 R1–R3 改写（含「L1/L2/L3 三档 + 例外表 + 反漂移测例」），并修正与源码不一致处（今天只列 5 类、漏「在线编写」）。
- **镜像**：`docs/module-status/api.md:26` 那句按新口径改写（同样补上漏掉的第 6 类）。

### R8 · 测例与反证

- 既有 `admin-write-audit.test.ts` **不动期望值**，只**增补**新纳入路径的正向用例（逐条注明依据）。
- 新文件落 R6 的三条断言 + 「新增写路由未决定即红」的**反证**（临时加一条假路由 / 临时放宽一条例外 → 必红；验证后还原）。
- 强度：L1 载荷仍钉「无敏感键、无 body」。

### R9 · 记债（逐条带销账条件）

1. `admin_write` 无读面 / 无留存 / 无轮转 —— 销账 = 定「要不要在仓内可查账」（要则须裁 L2 扩面或接外部采集）。
2. `09-security:330` 的 180 天保留期 —— 销账 = 明确承接方（仓内留存 vs 外部平台）并写进 OPS。
3. 领域事件缺字段（`model_bindings_put` 的旧/新/原因 · `chunk_strategy_reindex` 的「谁」）—— 销账 = 先裁「领域事件要不要承担 PRD 的字段清单」。
4. 其余「写 audit」类（角色/用户/部门/grant/model provider）**不落表** —— 销账 = PRD 若明确要 diff 才建（须 ADR → 改 PRD）。
5. `write` ↔ `complete` 的口径不对称 —— 销账 = 若产品要把「内容提交」整体纳入或整体排除。
6. PRD 无显式「痕强度分级」（本图的三档是**归纳**）—— 销账 = 产品若认这个分级，回写 PRD。
