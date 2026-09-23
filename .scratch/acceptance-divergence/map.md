# 验收剧本 16 行「Then ↔ 源码」分歧的裁定与收口

Label: wayfinder:map
Status: open（前沿：工单 03 · 04 · 05 · 06 —— 02 已解锁、均未认领；01 · 02 已收口）

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

### 开工基线（2026-09-23 · 16 行的 PRD 原文与源码现状逐条亲核）

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

## Not yet specified

<!-- 尚未锐化到可开票的雾（都在本图目的地朝向上） -->

- **A · 同类「措辞偏严」是否蔓延到 16 行名单之外**：本图只裁名单里的 16 行。覆盖表另有约 76 行 `部分测`，其中可能还有按「必须」读了 PRD「许可 / 析取」措辞的行（`docs/testing/coverage.md` 末段只列了 16 行，但那份名单的**生成口径**本图看不清）。等 16 行裁完再决定要不要立第二张图——本图不扩名单。
- **B · 裁定为「Then 引用了源码不存在的面」的那几条怎么真正销账**：`D-拼句` 的 `route_source=rule_knowledge`、`H5e` 的 debug / maintenance 档位。销账两条路（**补源码面** vs **删措辞**）都撞「改冻结语义须 ADR」，本图只写 ADR-ready 裁定书。真销账要另开 ADR 流程。
- **C · 覆盖表能不能机械化自检「措辞偏严」**：今天只能靠人读 PRD 措辞（可带 / 可为 / 或 / 建议）比对覆盖值。能否在 `docs/testing/` 加一条可跑的核对规则，取决于 A 的结论。
- **D · 16 行里可能还藏着「覆盖表点名错行 / 行号漂移」**：本图第一轮已抓到一处「结论对但转述不完整」。逐行核完才知道要不要在覆盖表加一条「出处须带可核对锚点」的纪律。
- **E · 相邻工具债（跨图）**：`check:module-status` 的 `5-表` / `3-符号` 误报；`evaluateL2Stale` 无生产调用点（前图核实）。不挡本图。

## Out of scope

- **改 `prds/00–11` 已冻语义**：包括改交付剧本的 Then 措辞、加项、改门限。本图对「Then 错」只能出 ADR-ready 裁定书。
- **`§6.0` 运行时从签字包加载 τ**（`T6` 的真销账）：与 ADR-007「`TAU_CLAIM` 唯一源」冲突，须 ADR → 改 PRD → 升版；本图只裁定归属并记债。
- **真 ES / 多租户独立索引（B8）**：`X5` 的查询期 `doc_type` filter 真值须真 ES；本图只裁定归属。
- **真模型 live 跑数 / 真 judge 打分 / 真 RustFS / 真 PG / Docker / 人签（UAT）**：本机无基础设施与浏览器。
- **admin / web 的视觉与交互改动**：无浏览器验证手段；本图对 `S1` / `S4` / `Y6` 只判「壳的路由与守卫行为」（RTL 可测）。
- **覆盖表里其余约 76 行 `部分测` 的余量**（簇 31 的其它部分）：本图只收 16 行。
- **`fixtures/*` 扩集与逻辑 id → `documents.id` 映射**：承前图 A 段，属数据工程，要真 PG。
- **P2.5 准出 / 永久关二元出口 / P3a Full 图**：须 L2 归档 + 人签。
