# 验收剧本 16 行「Then ↔ 源码」分歧的裁定与收口

Label: wayfinder:map
Status: open（前沿：工单 01）

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
| `D-拼句` | ask:83 | 「你好，请问差旅住宿标准」→ **不得** chitchat（后置禁词闸；应 single 检索路径）；`route_post_block` **可为** true **或** `route_source=rule_knowledge` | 该问句在 `apps/api/src/graph/route-rules.ts` 走 `n.length > 4` 支 → `routeLabel='single'` / `route_source='rule'` / `route_post_block=false`；`route_source=rule_knowledge` 全仓不存在（仅 `'rule'` / `'fallback_single'`）；`route_post_block=true` 那一支需 `looksChitchat ∧ POST_BLOCK.test(question)` 同时为真，而 `looksChitchat` 只认「整句就是寒暄」（归一后仅剩称呼 + 尾标点）→ 该支**事实不可达** | 硬要求（不得 chitchat / 应 single）**已满足**；注释里的机制与取值**与源码不符**（措辞面 + 死分支） |
| `H1` | ask:146 | **429** `RATE_LIMITED`；**可带** Retry-After | `apps/api/src` 全仓无 `Retry-After`；429 + `RATE_LIMITED` + body `retryAfterSec` 已有测（`apps/api/tests/obs/rate-limit.test.ts` · `quota-planes.test.ts`）；`prds/05-api/01-http-api-hono.md` 亦写「**建议** `Retry-After`」 | **许可**（可带 / 建议）→ 不设该头即合规；覆盖表按「必须」记 → 镜像偏严 |
| `H5e` | ask:154 | debug / maintenance 试图 RRF-only 出 knowledge answered → **拒绝**；仅可 `abstained` + 详细 trace **或** 暂停 ask | `apps/api/src` 无 `maintenance` / `degraded` / debug 档位开关（grep 零命中）；`apps/api/src/env.ts` 无该维度；现有测只盖「rerank 失败禁 RRF-only answered」 | Then 引用了**源码不存在的面**（无该运行档位）→ 实现缺口 or 须删措辞（撞冻结语义） |
| `U8` | ask:365 | P2 配置 `sessionRewriteEnabledDefault=true` 无 L2 → **启动/配置拒绝** **或** ask rewrite 路径 **400 `SESSION_REWRITE_DISABLED`** | `apps/api/src/routes/kb-settings.ts:111-115` 已 PATCH → 400 `SESSION_REWRITE_DISABLED`（`apps/api/tests/kb/settings-http.test.ts:297` 已断言）；`apps/api/src/env.ts` 无「无 L2 却强制 true → 启动失败」检测 | **析取**（或）→ 源码已满足一支；「启动侧那一支」未做 |
| `J7c` | ask:572 | 未 L2 强制开 rewrite / 误开配置 → **拒绝** **或** `SESSION_REWRITE_DISABLED`（见 U8） | 同上；`packages/contracts/src/common/biz-code.ts` 有该码 | **析取**（或）→ 同上 |
| `M8` | ingest:208 | infected 删除后：RustFS **无残留**；**无**隔离区；审计含 **hash + uploaderId + timestamp** | `apps/worker/src/ingest/object-store.ts:79` 有 `deleteObject`（`pipeline.ts:310` 在 MALWARE 路径调用）；worker 侧无「hash + uploaderId + timestamp」审计面；`uploaded_by` 已在 api 侧两处写入（覆盖表称「已过期项」） | 「对象已删」可离线断言；**审计面**源码无落点 |
| `V5` | ingest:380 | admin reject → 不 scan；**可重提** | 无 `rejected → pending` 重提端点（`git grep 重新提交\|resubmit\|re-submit` 在 `apps/api/src` + `packages/contracts/src` 零命中）；`reject` 200 后 `scan` 403 已有测 | Then 要求的能力源码无落点（且 PRD 未定义端点） |
| `S1` | acl:320 | 用户 U 仅 KB-A `read` → 打开 admin → **403 或 302→web**（管理壳不可用） | `apps/admin/src/components/auth-guard.tsx`：无会话 / 无 `admin.shell` → `clearClientSession()` + `router.replace('/login')`；**既非 403 也非 302→web**（客户端会话下无服务端 302 可用） | **析取 + 括注**；两个具名信号在「客户端会话壳」下都不成立，但括注「壳不可用」成立 |
| `S4` | acl:323 | 用户 V：KB-A `read` + KB-B `write` → **可进 admin** | `auth-guard.tsx` 进壳**只认平台码 `admin.shell`**，与「哪个 KB 的什么码」无关 → 该 Then 在现码模型下不成立 | 单一硬要求，源码行为与该表述冲突 |
| `Y6` | acl:415 | 无 `admin.shell` 用户打开 admin → **403**/302→web | 同 S1（无码 → 清会话 + 跳 `/login`） | 同 S1 |
| `X4` | acl:543 | `docTypes:["no_such_type"]` → **400** | `apps/api/src/services/kb-settings.ts:273-288` `assertScopeDocTypesAllowed`：**KB 未配 `docTypes` 时直接 `{ok:true}` 放行任意类型**；KB 配了才逐条比对 | **单一硬要求，源码有缺口**（未配置时未知类型不 400） |
| `X5` | acl:544 | 单测：dense 与 ES filter **均含** `doc_type∈hr`；**对称**；禁止一路全库一路过滤 | `apps/api/src/services/retrieve/es-sparse.ts` **零处** `doc_type` / `docType`（查询期只 `kbId` + match）；`services/retrieve/corpus.ts` 在**装载层**先滤再 dense∥sparse | 源码缺实现，**阻塞方 = 真 ES 切片（B8）** |
| `R9` | ops:307 | ask 调用 `plane=ask`；**入库 embed `plane=ingest`**；purpose 可区分 | `apps/worker/src` **零处** `plane`（worker 入库 embed 链无任何打点）；`plane=ingest` 仅见于 api 侧 complete 路径 | 源码缺实现（worker 侧打点） |
| `T6` | ops:344 | KB 快照 τ/门禁数字 **=** 已签字包；篡改快照 → **加载拒绝**或不一致告警失败 | `apps/api/src/eval/adr046-snapshot.ts` 只有 `bindQualitySnapshotToEval` / `writeBoundSnapshot`（写侧 + CLI），**唯一消费者是 `apps/api/src/scripts/run-l1-golden.ts`** → 全仓无运行时读取 / 加载入口 | 源码缺实现，**撞冻结语义**（§6.0 与 ADR-007「`TAU_CLAIM` 唯一源」冲突；前图已划为须 ADR） |
| `P3` | ops:260 | verify 路径 Gateway **仅** `judge`；抽样路径**仅** `judge_aux`（单测） | `packages/contracts/src/system/model-gateway.contract.ts:38` 的 **`BindingPurpose`** 含 `judge_aux`；但 `apps/api/src/services/gateway/resolve.ts:7` 的 **`ChatPurpose`（调用侧 purpose）不含 `judge_aux`**（`resolve.ts:244` 只循环 `claim_split` / `judge` / `route` / `rewrite`）；全仓无 online_sample 抽样链 | 前半（verify 走 `judge`）有图测；后半**源码无面**（调用侧无 `judge_aux` purpose + 无抽样链） |
| `AC2` | ops:479 | 模型表：llm + embedding + rerank 各至少一启用 → **可保存** | `apps/api/src/services/model-gateway.ts:176-211` `validatePlatformBindings` 只查「ref 存在 / 启用 / 类型匹配 / `judge`≠`judge_aux`」，**无「三类各至少一」闸**；「可写入三类并绑定」已有测（`apps/api/tests/gateway/bindings-http.test.ts`） | Then 字面只要求「**可保存**」→ 已满足；「三类齐备」是覆盖表的加严读法 → 镜像偏严 |

**一条已捕获的镜像瑕疵（写下来当本图的第二轮教训）**：`docs/testing/coverage/00-ask.md` 的 `D-拼句` 缺口列写「`route_post_block=true` 分支在纯规则路径不可达」——主控亲核 `route-rules.ts` 后确认这条**结论本身成立**（`looksChitchat` 只认整句寒暄 + 尾标点，`POST_BLOCK` 的 `\?|？` 与 `\d{2,}` 等无法与之共存），但覆盖表**没说清**它与 Then 的关系：Then 的硬要求（不得 chitchat / 应 single）**已满足**，不可达的只是那句注释所指的机制。→ 本图不许把「机制不可达」当「Then 不成立」。

## Decisions so far

<!-- 索引：一条已收工单一行，够判断相关性即可，细节放大进链接 -->

（尚未收工单）

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
