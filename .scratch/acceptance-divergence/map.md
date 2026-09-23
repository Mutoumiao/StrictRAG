# 验收剧本 16 行「Then ↔ 源码」分歧的裁定与收口

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 · 04 · 05 · 06 · 07 全收口）

## Destination

把「**验收剧本（`prds/10-delivery/03-acceptance-scenarios.md`）与源码对不上**」的 **16 行**，从今天那句「**源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径**」（`docs/testing/coverage.md` 末段，明写**禁止**改写成「待补测」）收敛到**逐行裁定 + 可核对收口**。

16 行（四处分册，名单见 `docs/testing/coverage.md` 末段「源码与 Then 不一致或源码无落点 16 行」）：

- **ask**（`docs/testing/coverage/00-ask.md`）：`D-拼句` · `H1` · `H5e` · `U8` · `J7c`
- **ingest**（`01-ingest.md`）：`M8` · `V5`
- **acl**（`02-acl.md`）：`S1` · `S4` · `Y6` · `X4` · `X5`
- **ops**（`03-ops.md`）：`R9` · `T6` · `P3` · `AC2`

每一行都要拿到四件东西：① **分歧归属**（源码缺实现 / Then 是许可或析取、源码已满足 / Then 引用了源码里不存在的面 / 覆盖表转述偏严 / 须 ADR 才能动）；② **依据**（PRD 原文措辞逐字 + 源码出处）；③ **收口动作**（改源码并补测例 / 订正覆盖表该行口径并补钉住那一支的测例 / 记债并写明缺什么才能销账 / 记成 ADR-ready 裁定书）；④ **一行都不许留在「源码侧待定」**。

### 判据线（本图的立图之本）

- **Then 的措辞就是判据**。PRD 原文写「**可带**」（H1）、「**可为** … **或**」（D-拼句）、「…**或** …」（U8 / J7c / S1 / Y6）、「**建议** Retry-After」（`prds/05-api/01-http-api-hono.md` RATE_LIMITED 那行）的，都是**许可 / 析取**，**源码满足任一支即合规**；覆盖表按「必须」记成缺口，属**镜像偏严（over-claim）**——本图必须订正，不许原样留着当欠账。
- **PRD 写死且是单一硬要求**的（如 X4「未知类型 → **400**」、S4「**可进** admin」、T6「**加载拒绝**」），源码缺就是**实现缺口**：能离线且属「收紧或逐位等价」的落地并补测例；撞冻结语义（如 T6 撞 ADR-007「`TAU_CLAIM` 唯一源」）或撞外部基建（X5 的 ES 查询期 filter 属 B8）的，**如实记债并写明阻塞方**。
- **第三类（建图后新识）· 冻结契约缺口**：某行点到的源码面与**别处已冻的契约**（ADR / 图边 / 在线 / 运维 PRD 的字段表与指标标签）取值域不一致，且**该面既非收紧也非逐位等价地可对齐**（例：`D-拼句` 点到的 `route_source` —— ADR-033 观测四元钉死四值，源码只有 `'rule'` + `'fallback_single'`）。这类**可以落地**，但必须同时满足三条：① **爆炸面已量清**（生产点 + 引用面 + **既有断言清单**，逐条列出），② 该面的类型在上下游是**宽松类型**（`string` / `z.string()`，无需改 DTO 契约），③ 收口报告**显式声明**这是「**行为可见的契约对齐**」（既非收紧亦非逐位等价），并附爆炸面证据。凡三条有一条不满足 → 记债 + ADR-ready，不许硬改。
- **不改 `prds/00–11`**。「Then 写错了」这条结论**本图只能写成 ADR-ready 裁定书**（改冻结语义须 ADR → 改 PRD → 升 `prds/README.md` 版本），不许直接改剧本一个字。

### 成功长什么样

① `docs/testing/coverage/` 四册里那 16 行的「缺口」列，**没有一行**还是「源码侧待定」——每行都写清**裁定结论 + 依据 + 收口动作**；② 裁定为「源码缺实现且离线可做」的，源码已改、测例已补、`已测` / `部分测` 按新口径重判；③ 裁定为「镜像偏严」的，覆盖表口径已订正并**补上钉住那一支的测例**（不许只改文字不留证据）；④ 裁定为「须 ADR / 撞外部基建」的，写成可提交的裁定书并留在债里，**不假装绿**；⑤ 全程**收紧或逐位等价**，且**没有任何一处**因「没测 / mock / 没原料」而变绿。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准（`prds/08-quality/02-evaluation-and-gates.md` 与交付剧本均为 **0.4.34**）；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是**派生对照**（本图主要战场）。
- **`/prds` 不在版本库**（`.gitignore:59` 忽略 `/prds`）→ 能读不能提交；`.trellis/tasks/` 同理。本图所有落盘都在 `docs/`、`.scratch/`、`.trellis/spec/`、源码与测例。
- **前图**：[`l2-report-determinability`](../l2-report-determinability/map.md)（已收口，紧接 `l1-signoff-evidence` · `quality-gate-parity`）。全仓雾索引：[`.scratch/fog-inventory-2026-09-23.md`](../fog-inventory-2026-09-23.md) **簇 31**（覆盖表余量，含「16 行源码与 Then 不一致」）即本图；簇 31 的其它部分（约 76 行 `部分测` 的余量）**不在本图**。
- **每轮先读**：本图 · `docs/testing/coverage.md` · `docs/testing/coverage/{00-ask,01-ingest,02-acl,03-ops}.md` 相关行 · `prds/10-delivery/03-acceptance-scenarios.md` 对应剧本段 · 该行源码与既有测例 · `docs/module-status/<包>.md` · `docs/agents/issue-tracker.md` · `docs/agents/domain.md`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**（同前三张图）：工单可直接改源码、补测例、回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`，且**串行**跑（`pnpm run test --concurrency=1`；前图实测：并发抢 CPU 会让 `@strict-rag/web` 超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**；**不改夹具**（`fixtures/*`）——本图不是扩集。
- **质量红线不放宽**：门禁只加严（ADR-046）；本图所有改动必须**收紧或逐位等价**。
- **本图特有的「不许」**：
  - **不许**把「镜像偏严」的订正做成「删掉缺口列了事」——必须**同时**补一条钉住「源码实际满足的那一支」的测例，否则等于用文字掩盖证据缺失。
  - **不许**为了让某行从 `部分测` 变 `已测`，去删既有断言、缩断言范围、或把 `it` 改 `it.skip`。
  - **不许**把「Then 措辞错」直接落成「已测」而不留 ADR-ready 记录——那会让下一张图以为剧本已被裁过。
  - **不许**动 `check:module-status` 的基线（**39 条 = 2 env + 13 符号 + 24 表**）；写回镜像时遵守前图纪律：`docs/module-status/*.md` 正文**不写 `路径:行号`**、不给裸标识符加反引号。
- **前图教训（三条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」——**本图第一轮抽查就已经抓到一次覆盖表转述与源码的细微出入**，见下）；③ 凡在镜像 / 覆盖表里写加式，必须用脚本按行机械核一遍（前图手工加式写错过一次）。
- **本机限制**：无浏览器 → **admin / web 的视觉与交互改动不做**；但 **RTL 单测可写可跑**（`apps/admin/tests/shell/*`、`apps/web/tests/*` 已有先例），故 `S1` / `S4` / `Y6` 的判定**以「壳的路由与守卫行为」为准，不以视觉为准**。真 PG / 真 ES / 真 RustFS / Docker / 人签 / 真模型 live 均不在。
- **成果预期**：预期**不新增表、不新增迁移**；可能新增 1–2 个 HTTP 响应头或端点**仅当**某行裁定为「PRD 单一硬要求且离线可做」（如 X4），届时按该行裁定执行并在收口报告里写清。

### 开工基线（2026-09-24 · 16 行的 PRD 原文与源码现状逐条亲核）

「措辞」列是 `prds/10-delivery/03-acceptance-scenarios.md` 的**逐字**原文；「源码现状」列是主控本轮**亲自** `git grep` / 读文件核过的结果（不是照抄覆盖表）。

| 行 | 分册 | PRD 原文要点（措辞） | 源码现状（亲核） | 分歧类型初判 |
|---|---|---|---|---|
| `D-拼句` | ask:83 | 「你好，请问差旅住宿标准」→ **不得** chitchat（后置禁词闸；应 single 检索路径）；`route_post_block` **可为** true **或** `route_source=rule_knowledge` | 该问句在 `apps/api/src/graph/route-rules.ts` 走 `n.length > 4` 支 → `routeLabel='single'` / `route_source='rule'` / `route_post_block=false` → **硬要求（不得 chitchat / 应 single）已满足**。但本条暴露一个**独立且更硬的缺口**：`route_source` 的**冻结取值域**是 `rule_chitchat` \| `rule_knowledge` \| `llm` \| `fallback_single`（**ADR-033 决策 5**，`prds/11-decisions/00-adr-index.md:402`；另见 `prds/04-pipelines/03-graph-edges-frozen.md:133` · `prds/04-pipelines/02-online-ask-langgraph.md:170` · `prds/10-delivery/02-ops-runbook.md:46` 运维指标标签 —— **四处冻结写法**），而源码类型只有 `'rule' \| 'fallback_single'`（`route-rules.ts:5`），`'rule'` **不在冻结枚举内**；`route_post_block=true` 那一支需 `looksChitchat ∧ POST_BLOCK.test(question)` 同时为真，而 `looksChitchat` 只认「整句就是寒暄」→ 该支**事实不可达**；`docs/module-status/api.md` 对 `route_source` **零记载**（缺口连债都没记） | 行本身的硬要求 = **乙**（已满足）；它点到的 `route_source` 取值域 = **甲（源码缺实现，冻结契约）**，且**爆炸面已量清**：生产点只有 `route-rules.ts`，`state.ts:61` / `ask.contract.ts:129` 都是宽松 `string` / `z.string()`，既有测例**零处**断言 `'rule'` |
| `H1` | ask:146 | **429** `RATE_LIMITED`；**可带** Retry-After | `apps/api/src` 全仓无 `Retry-After`；429 + `RATE_LIMITED` + body `retryAfterSec` 已有测（`apps/api/tests/obs/rate-limit.test.ts` · `quota-planes.test.ts`）；`prds/05-api/01-http-api-hono.md` 亦写「**建议** `Retry-After`」 | **许可**（可带 / 建议）→ 不设该头即合规；覆盖表按「必须」记 → 镜像偏严 |
| `H5e` | ask:154 | debug / maintenance 试图 RRF-only 出 knowledge answered → **拒绝**；仅可 `abstained` + 详细 trace **或** 暂停 ask | `apps/api/src` 无 `maintenance` / `degraded` / debug 档位开关（grep 零命中）；`apps/api/src/env.ts` 无该维度；现有测只盖「rerank 失败禁 RRF-only answered」 | Then 引用了**源码不存在的面**（无该运行档位）→ 实现缺口 or 须删措辞（撞冻结语义） |
| `U8` | ask:365 | P2 配置 `sessionRewriteEnabledDefault=true` 无 L2 → **启动/配置拒绝** **或** ask rewrite 路径 **400 `SESSION_REWRITE_DISABLED`** | `apps/api/src/routes/kb-settings.ts:111-115` 已 PATCH → 400 `SESSION_REWRITE_DISABLED`（`apps/api/tests/kb/settings-http.test.ts:297` 已断言）；`apps/api/src/env.ts` 无「无 L2 却强制 true → 启动失败」检测 | **析取**（或）→ 源码已满足一支；「启动侧那一支」未做 |
| `J7c` | ask:572 | 未 L2 强制开 rewrite / 误开配置 → **拒绝** **或** `SESSION_REWRITE_DISABLED`（见 U8） | 同上；`packages/contracts/src/common/biz-code.ts` 有该码 | **析取**（或）→ 同上 |
| `M8` | ingest:208 | infected 删除后：RustFS **无残留**；**无**隔离区；审计含 **hash + uploaderId + timestamp** | `apps/worker/src/ingest/object-store.ts:79` 有 `deleteObject`（`pipeline.ts:310` 在 MALWARE 路径调用）；worker 侧无「hash + uploaderId + timestamp」审计面；`uploaded_by` 已在 api 侧两处写入（覆盖表称「已过期项」） | 「对象已删」可离线断言；**审计面**源码无落点 |
| `V5` | ingest:380 | admin reject → 不 scan；**可重提** | 无 `rejected → pending` 重提端点（`git grep 重新提交\|resubmit\|re-submit` 在 `apps/api/src` + `packages/contracts/src` 零命中）；`reject` 200 后 `scan` 403 已有测 | Then 要求的能力源码无落点（且 PRD 未定义端点） |
| `S1` | acl:320 | 用户 U 仅 KB-A `read` → 打开 admin → **403 或 302→web**（管理壳不可用） | `apps/admin/src/components/auth-guard.tsx`：无会话 / 无 `admin.shell` → `clearClientSession()` + `router.replace('/login')`；**既非 403 也非 302→web**（客户端会话壳无服务端 302 能力）。壳准入的**冻结链**：ADR-045 #1（`prds/11-decisions/00-adr-index.md:957`）「admin 准入 = 根中间件硬拦截：`isPlatformAdmin \|\| hasAnyMembershipRole(['write','admin'])`；否则 **403**（API）或 **302→web**（页面）」→ 已被 **ADR-051 `:1344` 修订**为「admin 壳 = 拥有 **`admin.shell`** 权限码」。源码把 `admin.shell` **打包进**写能力模板（`packages/admin-catalog/src/role-templates.ts:19` / `:24`），`web_consumer` 为空 → 「仅 read」无壳码 | 括注「壳不可用」**成立**（乙）；两个具名信号（403 / 302→web）源于**已被修订的 ADR-045 #1**，在客户端会话壳下不可得 → 附带一条「壳硬拦截未落地」的债（丁 味） |
| `S4` | acl:323 | 用户 V：KB-A `read` + KB-B `write` → **可进 admin** | **按能力读 → 成立**：有写能力 ⟹ 其全局角色模板为 `doc_operator` / `kb_admin` ⟹ 有效码含 `admin.shell`（打包，见上）⟹ 可进壳。**按「按 KB 的成员角色驱动」读 → 不成立**：有效码只来自全局角色（`apps/api/src/auth/role-hydrate.ts:111` · `apps/api/src/auth/permissions/resolve.ts:22`），`kb_members.role` 不参与运行时授权（ADR-051 / ADR-035「角色列降级为模板锚点」）。**ADR-051 修订的正是 ADR-045 #3「任一 write/admin 即可进 admin」**，故 Then 的 KB 角色措辞沿用的是**已被修订**的那套 | **乙**（硬要求「可进 admin」按能力读成立），并记一条「Then 的 KB 角色措辞源于被修订的 ADR-045」的措辞债 |
| `Y6` | acl:415 | 无 `admin.shell` 用户打开 admin → **403**/302→web | 同 S1（无码 → 清会话 + 跳 `/login`）；本行**无**「（管理壳不可用）」括注，两个具名信号就是全部 Then | 同 S1 但**无括注可依** → 裁定须回答「客户端清会话 + 跳 /login 算不算『不进壳』的等价观测」；服务端硬拦截须先动会话载体（须 ADR）→ 大概率落**甲 + 记债** |
| `X4` | acl:543 | `docTypes:["no_such_type"]` → **400** | `apps/api/src/services/kb-settings.ts:273-288` `assertScopeDocTypesAllowed`：**KB 未配 `docTypes` 时直接 `{ok:true}` 放行任意类型**；KB 配了才逐条比对 | **单一硬要求，源码有缺口**（未配置时未知类型不 400） |
| `X5` | acl:544 | 单测：dense 与 ES filter **均含** `doc_type∈hr`；**对称**；禁止一路全库一路过滤 | `apps/api/src/services/retrieve/es-sparse.ts` **零处** `doc_type` / `docType`（查询期只 `kbId` + match）；`services/retrieve/corpus.ts` 在**装载层**先滤再 dense∥sparse | 源码缺实现，**阻塞方 = 真 ES 切片（B8）** |
| `R9` | ops:307 | ask 调用 `plane=ask`；**入库 embed `plane=ingest`**；purpose 可区分 | `apps/worker/src` **零处** `plane`（worker 入库 embed 链无任何打点）；`plane=ingest` 仅见于 api 侧 complete 路径 | 源码缺实现（worker 侧打点） |
| `T6` | ops:344 | KB 快照 τ/门禁数字 **=** 已签字包；篡改快照 → **加载拒绝**或不一致告警失败 | `apps/api/src/eval/adr046-snapshot.ts` 只有 `bindQualitySnapshotToEval` / `writeBoundSnapshot`（写侧 + CLI），**唯一消费者是 `apps/api/src/scripts/run-l1-golden.ts`** → 全仓无运行时读取 / 加载入口 | 源码缺实现，**撞冻结语义**（§6.0 与 ADR-007「`TAU_CLAIM` 唯一源」冲突；前图已划为须 ADR） |
| `P3` | ops:260 | verify 路径 Gateway **仅** `judge`；抽样路径**仅** `judge_aux`（单测） | `packages/contracts/src/system/model-gateway.contract.ts:38` 的 **`BindingPurpose`** 含 `judge_aux`；但 `apps/api/src/services/gateway/resolve.ts:7` 的 **`ChatPurpose`（调用侧 purpose）不含 `judge_aux`**（`resolve.ts:244` 只循环 `claim_split` / `judge` / `route` / `rewrite`）；全仓无 online_sample 抽样链 | 前半（verify 走 `judge`）有图测；后半**源码无面**（调用侧无 `judge_aux` purpose + 无抽样链） |
| `AC2` | ops:479 | 模型表：llm + embedding + rerank 各至少一启用 → **可保存** | `apps/api/src/services/model-gateway.ts:176-211` `validatePlatformBindings` 只查「ref 存在 / 启用 / 类型匹配 / `judge`≠`judge_aux`」，**无「三类各至少一」闸**；「可写入三类并绑定」已有测（`apps/api/tests/gateway/bindings-http.test.ts`） | Then 字面只要求「**可保存**」→ 已满足；「三类齐备」是覆盖表的加严读法 → 镜像偏严 |

**一条已捕获的镜像瑕疵（写下来当本图的第二轮教训）**：`docs/testing/coverage/00-ask.md` 的 `D-拼句` 缺口列写「`route_post_block=true` 分支在纯规则路径不可达」——主控亲核 `route-rules.ts` 后确认这条**结论本身成立**（`looksChitchat` 只认整句寒暄 + 尾标点，`POST_BLOCK` 的 `\?|？` 与 `\d{2,}` 等无法与之共存），但覆盖表**没说清**它与 Then 的关系：Then 的硬要求（不得 chitchat / 应 single）**已满足**，不可达的只是那句注释所指的机制。→ 本图不许把「机制不可达」当「Then 不成立」。

**主控复核补记（建图后自查，已订正基线）**：

1. **`S4` 一行我初判下得太重**。亲核 `apps/api/src/auth/role-hydrate.ts:111`（`effectiveCodes: defaultCodesForRoles(claimsRoles)`）与 `apps/api/src/auth/permissions/resolve.ts:22` 后确认：有效码**只来自全局角色**，`kb_members.role` 不参与；但 `admin.shell` 同时被**打包在** `DOC_OPERATOR_CODES` / `KB_ADMIN_CODES`（`packages/admin-catalog/src/role-templates.ts:19` / `:24`）里，`web_consumer` 为空。故 `S4` 的 Then **按能力读成立**（有写能力 ⟹ 有壳码 ⟹ 可进壳），只在「按 KB 的成员角色驱动」这一读法下不成立。
2. **三行壳准入的冻结链是「ADR-045 #1 **被 ADR-051 修订**」**，不是简单的「源码与 Then 冲突」：ADR-045 #1（`:957`）写「根中间件硬拦截 … 否则 403（API）或 302→web（页面）」，ADR-051（`:1344`）把它**修订**成「admin 壳 = 拥有 `admin.shell` 权限码」；ADR-045 #3（`:963-964`）「任一 `write`/`admin` 即可进 admin」同样被修订。→ `S1` / `S4` / `Y6` 三行的裁定必须写清**它们引的是哪一版**，否则「源码侧待定」会被下一张图读成「源码错」。
3. **`D-拼句` 我初判为「措辞面 + 死分支」，不够**。它点到的 `route_source` 是**四处冻结写法**（ADR-033 决策 5 + 图边 PRD `:133` + 在线 PRD `:170` + 运维 PRD `:46` 的指标标签），源码类型 `'rule' | 'fallback_single'` 里 `'rule'` **不在冻结枚举内**；`docs/module-status/api.md` 对该字段**零记载**。→ 这是**冻结契约缺口**（本图第三类），爆炸面已量清：生产点只有 `route-rules.ts`，上下游都是宽松类型，既有断言**零处**断言 `'rule'`。

## Decisions so far

<!-- 索引：一条已收工单一行，够判断相关性即可，细节放大进链接 -->

（尚未收工单）

- [研究：16 行「Then ↔ 源码」分歧的逐行取证](./issues/01-research-then-source-evidence.md) — 研究子代理产出，明细 16 节 + 归类表在 [research/01-then-source-evidence.md](./research/01-then-source-evidence.md)。要点：① **「覆盖表按『必须』读了 PRD 的『许可 / 析取』措辞」共 6 行**（`H1` 的「**可带** Retry-After」，且 API PRD `:562` / `:599` 两处都写「**建议**」；`U8` / `J7c` 的「**或**」；`S1` / `Y6` 的「403 **或** 302→web」；`AC2` 的「**可保存**」，API PRD `:465` 只要求「至少一模型」）。② 真实源码缺口 4 行（`M8` 审计面 · `V5` 重提端点 · `X4` 空枚举放行 · `R9` worker 零打点），锚点可复跑。③ 引用了源码不存在的面 4 行（`D-拼句` · `H5e` · `S4` · `P3`）。④ 撞冻结语义 / 外部基建 2 行（`T6` 撞 ADR-007 · `X5` 撞 B8）。⑤ **覆盖表转述与源码有出入 3 处**（`M8` 写 `:361` 实为 `:352`；`X4` 把函数出处写成 `routes/ask.ts`，实为 `services/kb-settings.ts:273`；多处行号漂移）。**主控反向复核后改判三行**（见该票「主控复核补记」）：`D-拼句` 由丙改判为「乙 + 它点到的面属甲」、`S4` 由丙改判为乙、`S1`/`Y6` 须写清「引的是已被修订的 ADR-045 #1」；其余 13 行采纳。
- [裁定：16 行分歧各归谁、按什么收口](./issues/02-dec-per-row-ruling.md) — 主控自裁（工单 01 + 主控反向复核为依据）。**逐行归属**：`已测` **7 行**（`D-拼句` `H1` `U8` `J7c` `S4` `X4` `AC2`）· 保留 `部分测` **9 行**（`S1` `Y6` `H5e` `M8` `V5` `X5` `R9` `T6` `P3`），**一行不留「源码侧待定」**。**三处最关键裁定**：① **`D-拼句` 点到的 `route_source` 是「冻结契约缺口」**（ADR-033 观测四元 + 图边 `:133` + 在线 `:170` + 运维 `:46` **四处**冻结写法钉死四值，源码只有 `'rule' | 'fallback_single'`，`'rule'` 不在枚举内；镜像对该字段**零记载**）→ **本图唯一一处源码落地**，爆炸面已量清（生产点仅 `route-rules.ts`；`state.ts:61` / `ask.contract.ts:129` 均宽松类型；既有断言**零处**断言 `'rule'`）；`route_post_block=true` 支在 P2 不可达属**非缺陷**（它对应 ADR-033 的 LLM 路，P2 未接）。② **`S1` / `S4` / `Y6` 三行同源，冻结链是「ADR-045 #1 `:957` **被 ADR-051 `:1344` 修订**」**：因 `admin.shell` **打包在写能力模板**里（`role-templates.ts:19`/`:24`），「有写能力 ⟹ 有壳码 ⟹ 可进壳」**成立** → `S4` 按能力读为乙；`S1` / `Y6` 的具名信号在客户端会话壳下不可能有（服务端 302 须先动会话载体）→ 保留 `部分测` + 记一条「壳硬拦截未落地」的债。③ **七项「不加」**：不补 `Retry-After` 头 · 不补 rewrite 启动闸 · 不建 debug / maintenance 档位（ADR-030/034 与运维手册 `:201` **禁止**该逃生口）· 不把 `judge_aux` 加进 `ChatPurpose`（无抽样链 = 空壳面）· 不建 worker 指标面 · 不加三类模型闸 · 不新增重提端点 —— 每项都有依据（多为「补了会反 ADR 或引入离线不可满足的前置」）。**跨行纪律三条**：缺口列定型写法（禁「源码侧待定 / 待补测」，记债须写**销账条件**）· ADR-ready 裁定书集中落 `research/02-adr-ready-findings.md`（八条）并只留一行 spec 指针、**不动 `prds/`** · 新增源码面全局只一处。

- [落地：ask 分册五行（D-拼句 · H1 · H5e · U8 · J7c）](./issues/03-task-ask-divergence.md) — **本图唯一一处源码改动**：`apps/api/src/graph/route-rules.ts` 把 `route_source` 取值域对齐 ADR-033 观测四元（`'rule'` → `rule_chitchat`（寒暄支）/ `rule_knowledge`（知识向支与后置禁词支）；`fallback_single` 两支不动；`'llm'` 不预置），类型仍为冻结枚举的**真子集**。新增两条 `it`（`D-拼句` 原句 → single + 非 chitchat + `route_source=rule_knowledge`；纯寒暄 → `rule_chitchat`），既有 `fallback_single` 断言**未动**。覆盖表 `00-ask.md`：`D-拼句` `H1` `U8` `J7c` 改判 `已测`（措辞为许可 / 析取），`H5e` 保留 `部分测` 并写明「档位在 P2 无面且被 ADR-030/034 与运维手册 `:201` **禁止**，实质由 `H5c` 覆盖」；小计 26/25 → 30/21。反证两轮（改坏映射 → 新 `it` 红；删该 `it` → 全绿，证明红来自「该 `it` × 映射」）。门禁：`check-types` / `lint` 8/8 · api 177 文件 / 1098 通过 + 3 skipped。
- [落地：ingest 分册两行（M8 · V5）](./issues/04-task-ingest-divergence.md) — 新增 `apps/worker/tests/ingest/scan-infected-no-residue.test.ts`（行为 `it`：`deleteObject` 恰一次且键即原对象键、删后键不再存在、无第二键；源码护栏 `it`：worker 源码零 `quarantine` 落点、`object-store.ts` 导出面只有删除与读）；`apps/api/tests/ingest/reject-http.test.ts` 新增 V5 边界 `it`（`rejected` 再 reject 幂等 200 且不写库、非 `pending` → `RULE_VIOLATION`，即「无回 pending 的重提路径」）。**不做面守住**：未实现审计面（明确不拿阶段账本 `failed` 行冒充 hash + uploaderId + timestamp）· 未新增重提端点。覆盖表 `01-ingest.md` 两行保留 `部分测`，**顺手订正转述错锚点** `routes/documents/index.ts:361` → `:352`。门禁：worker 56 文件 / 251 通过 · api 177 / 1099 + 3 skipped。
- [落地：acl 分册五行（S1 · S4 · Y6 · X4 · X5）](./issues/05-task-acl-divergence.md) — `apps/admin/tests/shell/auth-guard.test.tsx` 新增两例（`:79` 空码不进壳；`:106` S4 的「KB 角色不参与判定」①②两段），**未改壳行为**（无浏览器，仅 RTL）。覆盖表 `02-acl.md`：`S4` `X4` 改判 `已测`，`S1` `Y6` `X5` 保留 `部分测` 并写明归属与债（含「ADR-045 #1 `:957` 被 ADR-051 `:1344` 修订」的链）；尾注「源码侧待定」两处连带清掉；小计 56/8 → 58/6。**不加严 `assertScopeDocTypesAllowed`**（空白名单放行属 ADR-050「相对该 KB 枚举」口径，`ask-mode-doc-types.test.ts:52` 正钉住它）· **不动 `es-sparse.ts`**。脚本按行核计数 `58+6+2+0+3 = 69`。
- [落地：ops 分册四行（R9 · T6 · P3 · AC2）](./issues/06-task-ops-divergence.md) — **本票只改覆盖表**（四行的「不做」都是裁定的核心）：`AC2` 改判 `已测`（Then 字面义务只要求「可保存」；「三类各至少一」是覆盖表加严读法，PRD 无此硬要求），`R9` `T6` `P3` 保留 `部分测` 并写明销账条件（worker 指标面 + 真配额基建 · ADR → 改 PRD → 升版 · `online_sample` 抽样链）。小计 40/19 → 41/18；加式与合计**用脚本按行核**（脚本首跑 60 处「不一致」定位为脚本自身 off-by-one，修脚本后 0 处）。未建 worker 指标面 · 未发明运行时签字包加载口 · 未把 `judge_aux` 加进调用侧 `ChatPurpose` · 未加三类模型闸。

### 目的地达成（2026-09-24）

「验收剧本 16 行 Then ↔ 源码不一致」从「**源码侧待定：先裁清哪一侧错**」收敛到**逐行裁定 + 可核对收口**：

1. **16 行各有归属**：`已测` **7**（`D-拼句` `H1` `U8` `J7c` `S4` `X4` `AC2`）· 保留 `部分测` **9**（`S1` `Y6` `H5e` `M8` `V5` `X5` `R9` `T6` `P3`）。**一行不留「源码侧待定」**（四册逐文 `grep` 零命中；`03-ops.md` 仅剩一处出现在新轮次叙述里，是描述「已订正」）。
2. **两条判据线立住了**：① **Then 的措辞即判据** —— 「可带 / 可为 / 建议」是许可、「或」是析取，源码满足任一支即合规，覆盖表按「必须」记成缺口属**镜像偏严**（6 行）；② **引的是哪一版 ADR** —— `S1` / `S4` / `Y6` 三行的冻结链是「ADR-045 #1 **被 ADR-051 修订**」，因 `admin.shell` 打包在写能力模板里，「有写能力 ⟹ 可进壳」成立。
3. **只有一处源码改动**，且严格按第三类「冻结契约缺口」的三条前提走：`route_source` 取值域对齐 ADR-033 观测四元（爆炸面已量清 —— 生产点仅 `route-rules.ts`；`state.ts:61` / `ask.contract.ts:129` 均宽松类型；既有断言**零处**断言 `'rule'`），并在收口报告里声明这是**行为可见的契约对齐**（既非收紧亦非逐位等价）。
4. **七项「不加」**（都有依据，多数是「补了会反 ADR 或引入离线不可满足的前置」）：不补 `Retry-After` 头 · 不补 rewrite 启动闸 · 不建 debug / maintenance 档位 · 不加三类模型闸 · 不把 `judge_aux` 加进调用侧 `ChatPurpose` · 不建 worker 指标面 · 不新增重提端点。**九行真债**逐条写了销账条件。
5. **八条 ADR-ready 裁定书**落 [research/02-adr-ready-findings.md](./research/02-adr-ready-findings.md)（现象 · 冻结依据逐字 + 行号 · 为何本图不动 · 改动路径 · 若实现路的爆炸面），并在 `.trellis/spec/api/backend/index.md` 留一行指针；**未动 `prds/00–11` 一个字**。

**证据**：源码 `apps/api/src/graph/route-rules.ts` · 测例 `apps/api/tests/ask/route-rules.test.ts` · `apps/worker/tests/ingest/scan-infected-no-residue.test.ts` · `apps/api/tests/ingest/reject-http.test.ts` · `apps/admin/tests/shell/auth-guard.test.tsx` · 覆盖表四册 + `docs/testing/coverage.md` · 镜像 `docs/module-status/{README,api,worker,admin}.md` · 规范 `.trellis/spec/guides/testing.md` §1.2 · `research/02-adr-ready-findings.md`。反证共 **7** 条红（03 两轮 · 04 一轮两处 · 05 两轮 · 06 一轮），还原后全绿。

**收口门禁（在最后一次提交之后复跑）**：`pnpm check-types` **8/8** · `pnpm lint` **8/8** 零 warning · `pnpm build` **8/8** · `pnpm run test --concurrency=1 --force` **11/11**（api 177 文件 / 1099 通过 + 3 skipped · worker 56 / 251 · contracts 34 / 283 · admin 38 / 187 · web 19 / 56 · db 11 / 31 · admin-catalog 1 / 13；四 app 存货闸 `# tests 8 / # fail 0`）· `pnpm check:module-status` **39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `4-端点` / `6-联动` / `7-时效` **全空** · `git status --short` 干净。

**三条口径教训（本图新增）**：① **覆盖表的「不一致」未必是缺口** —— 16 行里 6 行是**镜像按「必须」读了 PRD 的许可 / 析取措辞**；凡「源码与 Then 对不上」，第一件事是回 PRD 看**措辞**。② **引 ADR 必须核「哪一版」** —— `S1` / `S4` / `Y6` 引的 ADR-045 #1 已被 ADR-051 修订，不核版本就会把「按新 ADR 已成立」写成「源码错」。③ **转述漂移是真的会发生在任何一侧** —— 覆盖表 3 处锚点错（`:361`→`:352`、函数出处、行号漂移），而**本图的实现票自己也写错过一处**（`05` 票把 `:106` 写成 `:107`，由工单 07 的反向复核抓到，已在票内订正）。

<!-- 尚未锐化到可开票的雾（都在本图目的地朝向上） -->

## Not yet specified

<!-- 收口后剩下的雾，按「谁挡谁」分组，供下一张图挑一个当目的地 -->

本图已收口。下列是**收口后剩下的雾**（带（另图）的原样转给后续图，不是本图的欠账）。

### A · 同类「措辞偏严」是否蔓延到 16 行名单之外

- 本图只裁了 `docs/testing/coverage.md` 末段点名的那 16 行。覆盖表另有 **59 行 `部分测`**，其中可能还有按「必须」读了 PRD「许可 / 析取」措辞的行 —— 那份 16 行名单的**生成口径**本图看不清（是逐行读过 PRD 措辞，还是只看「源码对不上」？）。
- 销账 = 把「回 PRD 看措辞」这条纪律机械化（见 C），或对剩余 `部分测` 逐行重读 PRD 措辞。属**可离线**，但要人读 PRD。

### B · 八条 ADR-ready 裁定书的真销账

- 全部落在 [research/02-adr-ready-findings.md](./research/02-adr-ready-findings.md)：`D-拼句` 死分支与 LLM 路线 · `H5e` 档位措辞 · `S1`/`Y6` 壳服务端硬拦截 · `M8` 审计 sink · `V5` 重提端点契约 · `X4` 白名单前提 · `T6` §6.0 与 ADR-007 · `P3` 抽样链。
- 每条都要走 **ADR → 改 PRD → 升 `prds/README.md` 版本**；本图**不做**。其中 `T6` 与 `S1`/`Y6` 是**冻结语义直接冲突**（ADR-007 / ADR-045→051），`M8` / `V5` / `P3` 是**新增产品面**（审计 sink、端点契约、抽样链）。

### C · 覆盖表的机械化自检

- 今天「措辞偏严」只能靠人读 PRD。能不能在 `docs/testing/` 加一条**可跑的**核对（如：把 Then 里「可带 / 可为 / 建议 / 或」的措辞与覆盖值对齐检查），取决于 A 的结论。
- 本图已把「先判措辞 / 订正必补测例 / 冻结契约缺口须量爆炸面」写进 `.trellis/spec/guides/testing.md` §1.2，但那是**纪律**，不是**闸**。

### D · 覆盖表的「出处须可核对」

- 本图抓到 3 处锚点错（`uploaded_by` 写 `:361` 实为 `:352` · `assertScopeDocTypesAllowed` 出处写成调用点 · 多处行号漂移），且实现票自己也写错过一处（`:107` vs `:106`）。
- 销账 = 在覆盖表/镜像里要求**出处带可核对锚点**（或干脆不写行号，只写符号名 + 文件），并决定谁来核。属**工具 / 纪律**面。

### E · 16 行之外的同族行（不在本图）

- `S3`（读面 `doc.view` 口径冲突）· `S6`（源码确无按当前 KB 角色裁菜单 → `缺实现`）· `B2-2`（角色码 principal + 真 ES reindex 半截）· `V4`（Then 后半「其后 M/L 链可绿」只有分段证据）· `M2`（「审计可查」同 `M8` 同款无落点）· `AA6`（Then 末段「检索用新切块」无测例）· `T1`/`T2`/`T3`（运行时加载 / 发布口无落点）· `G1`/`G2`/`O2` —— 都是**别的图**记的 `部分测` 半截，本图**不碰**。
- 其中 `M2` 与 `M8` 是**同一个「审计面」缺口**，`S6` 与 `S1`/`Y6` 是**同一条壳准入线** —— 下一张图若要收这一类，应**合并**处理，不要各图各写一套。

### F · 相邻工具债（跨图）

- `check:module-status` 的 `5-表` / `3-符号` 误报（本图又踩过：写入镜像时必须用描述性写法，不能给裸 snake_case 加反引号）；`evaluateL2Stale` 无生产调用点（前图核实）；运维 PRD 列的 `route_source_total` / `route_post_block_total` / `route_llm_skip_total` 三个指标**代码里一个都没有**（本图核 `route_source` 时顺带发现，未处理）。

## Out of scope

- **改 `prds/00–11` 已冻语义**：包括改交付剧本的 Then 措辞、加项、改门限。本图对「Then 错」只能出 ADR-ready 裁定书。
- **`§6.0` 运行时从签字包加载 τ**（`T6` 的真销账）：与 ADR-007「`TAU_CLAIM` 唯一源」冲突，须 ADR → 改 PRD → 升版；本图只裁定归属并记债。
- **真 ES / 多租户独立索引（B8）**：`X5` 的查询期 `doc_type` filter 真值须真 ES；本图只裁定归属。
- **真模型 live 跑数 / 真 judge 打分 / 真 RustFS / 真 PG / Docker / 人签（UAT）**：本机无基础设施与浏览器。
- **admin / web 的视觉与交互改动**：无浏览器验证手段；本图对 `S1` / `S4` / `Y6` 只判「壳的路由与守卫行为」（RTL 可测）。
- **覆盖表里其余约 76 行 `部分测` 的余量**（簇 31 的其它部分）：本图只收 16 行。
- **`fixtures/*` 扩集与逻辑 id → `documents.id` 映射**：承前图 A 段，属数据工程，要真 PG。
- **P2.5 准出 / 永久关二元出口 / P3a Full 图**：须 L2 归档 + 人签。
