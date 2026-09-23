# 裁定书 · 八条 ADR-ready 发现

Type: research（裁定书） · Status: 完成（2026-09-24，图 `acceptance-divergence` 工单 07 汇总工单 02 纪律二）
依据：工单 01 逐行取证（[`01-then-source-evidence.md`](./01-then-source-evidence.md)，含逐字措辞与 `路径:行号`）+ 工单 02 逐行裁定（`../issues/02-dec-per-row-ruling.md`）。

> **用途**：把「`Then` 与源码对不上、但**本图不能自己改**」的八条写成**可提交的裁定书**（覆盖表该行只写一句话归属 + 指向本文件）。
> **共同改动路径**：改冻结语义须 **ADR → 改 PRD（`prds/00–11`）→ 升 `prds/README.md` 版本**；本图与本仓**都不改** `prds/00–11`。
> **与 16 行的关系**：这八条**不是**「源码已满足、只是覆盖表按『必须』读了许可/析取」的 7 行（那 7 行本图已判 `已测`、无需 ADR）；它们或撞**冻结语义**、或撞**外部基建**、或**引用了源码不存在的面**，故保留 `部分测` + 记债 + 本裁定书。

## 0 · 一览

| # | 发现 | 分册 · 行 | 现象一句话 | 本图归属 | 阻塞方 |
|---|------|-----------|------------|----------|--------|
| 1 | `D-拼句` 死分支与 LLM 路线 | ask | 许可支 `route_post_block=true` **事实不可达**；观测四元第四值 `llm` 源码未预置（LLM route 未接） | 乙（硬要求已满足）+ 甲（取值域，**本图已对齐**） | LLM route 未接（新功能） |
| 2 | `H5e` 档位措辞 | ask | `Then` 引 debug / maintenance 档位，源码全仓无该档位 | 丙 | 补档位**反** ADR-030/034 + 运维手册 |
| 3 | `S1` / `Y6` 壳服务端硬拦截 | acl | 具名信号「403 或 302→web」在**客户端会话壳**下不可能产生 | 乙（实质）+ 债 | 服务端会话载体 / 根中间件（架构） |
| 4 | `M8` 审计 sink | ingest | 「审计含 hash + uploaderId + timestamp」三项并举，worker 无审计写入面 | 甲（审计面） | 审计 sink 未裁 + 真扫描引擎（QUAL-2） |
| 5 | `V5` 重提端点契约 | ingest | 「可重提」无端点，且 PRD **未定义**该端点契约 | 甲（端点） | PRD 未定义端点 |
| 6 | `X4` 白名单前提 | acl | 空白名单放行是 **ADR-050 口径**，非缺口（加严会打红钉住旧口径的测例） | 乙（**本图判 `已测`**） | 撞 ADR-050「相对该 KB 枚举」 |
| 7 | `T6` §6.0 与 ADR-007 | ops | 签字包 τ **无运行时加载口**；运行时 τ 仍取 env | 丁 | ADR-007「`TAU_CLAIM` 唯一源」 |
| 8 | `P3` 抽样链 | ops | 抽样路径 `judge_aux` 引用了源码不存在的面（调用侧无 purpose + 无抽样链） | 丙 | 抽样链 `online_sample` 未落 |

---

## 1 · `D-拼句` 死分支与 LLM 路线

**现象**：`Then` 的许可支「`route_post_block` 可为 true」在 P2 源码中**事实不可达** —— 进入需 `looksChitchat ∧ POST_BLOCK.test(question)`，而 `looksChitchat` 只认「整句即寒暄」，与 `POST_BLOCK`（政策/制度/`\d{2,}`/`?`/`？` …）**互斥**；ADR-033 观测四元的第四值 `llm` **未预置**（P2 不接 LLM route）。本图已把 route source 取值域对齐到规则三值（`rule_chitchat` / `rule_knowledge` / `fallback_single`），但**死支与 LLM 路未动**。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:83`：`| **D-拼句** | 「你好，请问差旅住宿标准」→ **不得** chitchat（后置禁词闸；应 single 检索路径）；`route_post_block` 可为 true 或 `route_source=rule_knowledge` |`
- `prds/11-decisions/00-adr-index.md:402`（ADR-033 决策 5）：`route_source` ∈ {`rule_chitchat`,`rule_knowledge`,`llm`,`fallback_single`}
- 同四值另见 `prds/04-pipelines/03-graph-edges-frozen.md:133` · `prds/10-delivery/02-ops-runbook.md:46`（运维指标标签）。
- 源码：`apps/api/src/graph/route-rules.ts` 的纯规则 route 自陈「P2 纯规则；balanced/strict LLM route → backlog」。

**为何本图不动**：`Then` 的**硬要求**（不得 chitchat / 应 single）已满足；许可支 A 不可达属**机制缺口**而非 Then 不成立；`llm` 值对应 ADR-033 的 **LLM 路**，接它属**新功能**（backlog），删改观测四元第四值属**改冻结语义**。

**改动路径**：ADR（裁「P2 不接 LLM route 是否合法、第四值何时生效」，或裁改/删第四值）→ 改对应 PRD 段 → 升 `prds/README.md` 版本。**本图不改**。

**若走实现路（接 LLM route）的爆炸面**：新增 LLM route 调用点（`services/gateway/resolve.ts:244` 已有 `route`，但现无调用方）+ `route_source='llm'` 生产点（`route-rules.ts`）+ LLM 失败回退与 `route_llm_conf` 真值；须同步改 `docs/module-status/api.md` 与 `docs/module-status/README.md` 的「P2 不依赖 LLM 路由」现状声明。类型面已放宽（上下游均 `string` / `z.string()`，既有断言**零处**断言具体值），但预算与现状声明会**行为可见**地变。

## 2 · `H5e` 档位措辞

**现象**：`Then` 的前提是存在 debug / maintenance 运行档位；源码 `apps/api/src` 全仓**无**该档位（`maintenance` / `degraded` 零命中；`LOG_LEVEL` 的 `debug` 非运行档位）。实质不变式「rerank 全链失败禁 RRF-only answered」已由 `H5c` 覆盖。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:154`：`| H5e | debug / maintenance 试图 RRF-only 出 knowledge answered | **拒绝**；仅可 `abstained` + 详细 trace 或暂停 ask |`
- **反向冻结（禁止建档位）**：`prds/11-decisions/00-adr-index.md:454`（ADR-030/034）「**禁止一切 RRF-only answered 逃生口（含 debug / maintenance / dogfood）**…」；`prds/10-delivery/02-ops-runbook.md:201`「**禁止**任何「关 rerank / 跳过 rerank / RRF-only 仍 `answered`」的官方或 debug 逃生口（含 maintenance mode、内部 dogfood）。」

**为何本图不动**：补 debug / maintenance 档位**反** ADR-030/034 与运维手册（等于多开一个逃生口，方向相反）；删 `:154` 措辞属**改冻结剧本** —— 两条都须 ADR。

**改动路径**：ADR（裁 H5e 是「P2 不适用（无档位）」还是改措辞）→ 改 `prds/10-delivery/03-acceptance-scenarios.md` H5e 段，或改 ADR-030/034 → 升 `prds/README.md` 版本。

**若走实现路的爆炸面**：新增运行档位开关（env / KB 配置）+ 档位下对 RRF-only 的抑制路径 + `abstained + 详细 trace` 的 trace 面；**且须同步删改** ADR-030/034 与运维手册的禁止句（改冻结语义）。方向是**放宽**且撞三处冻结，属本图 out of scope。

## 3 · `S1` / `Y6` 壳服务端硬拦截

**现象**：`Then` 的具名信号「403 或 302→web」在**客户端会话壳**（`apps/admin/src/components/auth-guard.tsx`，`'use client'`）下**不可能**产生；实际行为是「清会话 + `router.replace('/login')`」。冻结链是「ADR-045 #1 **被 ADR-051 修订**」。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:320`：`| S1 pure read 进 admin | 用户 U 仅 KB-A `read` → 打开 admin → **403 或 302→web**（管理壳不可用） |`
- 同 PRD `:415`：`| Y6 | 无 `admin.shell` 用户打开 admin | **403**/302→web |`
- `prds/11-decisions/00-adr-index.md:957`（ADR-045 #1）：「admin 根中间件/loader：`isPlatformAdmin || hasAnyMembershipRole(['write','admin'])`；否则 **403**（API）或 **302→web**（页面）。」
- `prds/11-decisions/00-adr-index.md:1344`（ADR-051）：「**修订 ADR-045 壳准入**：admin 壳 = 拥有 **`admin.shell`** 权限码。」
- 加强句 `prds/02-engineering/01-clhoria-template-alignment.md:100`：「admin 壳 | 拥有 **`admin.shell`** 权限码（ADR-051）；无码 403/302→web（**根中间件硬拦**，ADR-045）」。

**为何本图不动**：让客户端壳产生服务端 302 / 403 须**先动会话载体**（改壳架构 / 加服务端中间件），且本机**无浏览器**（本图只判壳的路由与守卫行为，不判视觉）；`Then` 的**实质要求**（管理壳不可用）已成立并已测。

**改动路径**：ADR（裁「服务端硬拦」是 P2 义务还是后续阶段项；裁 403 与 302→web 哪一支）→ 改对应 PRD 段 + 写清 ADR-045 / ADR-051 的修订关系 → 升 `prds/README.md` 版本。

**若走实现路的爆炸面**：需引入**服务端会话载体**（cookie / 服务端 session）+ 根中间件或 loader 的硬拦分支 + 302→web 目标路由；影响 admin 全部页面入口、与既有 `AdminAuthGuard`（纯客户端）语义重叠、`apps/admin` 构建面（现 `next build --webpack`、纯客户端会话）；既有 RTL 断言（`apps/admin/tests/shell/auth-guard.test.tsx`）需改为「服务端 302 / 403」面。属**架构改动**。

## 4 · `M8` 审计 sink

**现象**：`Then`「审计含 hash + uploaderId + timestamp」是**三项并举的硬要求**；worker 侧**无审计写入面**。「无残留 / 无隔离区」已由 `apps/worker/tests/ingest/scan-infected-no-residue.test.ts` 专断言覆盖。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:208`：`| M8 | infected 删除后 | RustFS **无残留**；**无**隔离区；审计含 hash + uploaderId + timestamp |`
- 加强句 `prds/09-security/01-auth-acl-compliance.md:358`：「| infected 处置 | 2 | **立即删** RustFS 对象 + **审计**（hash/filename/kbId/uploaderId/scanResult/timestamp/engineVersion）；**无隔离区** |」
- `prds/11-decisions/00-adr-index.md:666`（ADR-038 #4）：「**#4 infected = 删除 + 审计，无隔离区**…」

**为何本图不动**：「审计」的 **sink 未定**（表 / Pino / Langfuse 三者未裁，PRD 只列字段），且真扫描引擎（QUAL-2）未接、**无真 hash / scanResult 可写** → 现在补只能是空壳；拿阶段账本的 `failed` 行冒充该审计面是**被明令禁止**的。

**改动路径**：ADR（裁审计 sink 与字段集）→ 改 `prds/09-security`（及 `prds/03-data`，若落表）→ 升 `prds/README.md` 版本。

**若走实现路的爆炸面**：落表 → 新增 schema（hash / filename / kbId / uploaderId / scanResult / timestamp / engineVersion）+ migration + worker 写入点（`ingest/pipeline.ts` MALWARE 分支）+ 查询面；落 Pino → 字段集与既有 `admin_write` / 阶段账本的口径划分。**且**须 QUAL-2 真引擎提供真 hash / scanResult，否则字段只能写 `null`（假绿）。爆炸面 = 数据层 + 基建依赖双面。

## 5 · `V5` 重提端点契约

**现象**：`Then`「可重提」是硬要求；源码**无** `rejected → pending` 端点（`resubmit` / `重新提交` / `re-submit` 源码零命中），且 **PRD 未定义**该端点契约（路径 / 权限 / 是否重置审批链）。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:380`：`| V5 | admin reject | 不 scan；可重提 |`
- 同义句 `prds/04-pipelines/01-offline-ingest.md:51`：「| 拒绝 | `rejected`；可改后重提 | 拒绝仍跑流水线 |」
- **反向（PRD 未定义端点）**：`prds/05-api/01-http-api-hono.md:216`：「5. reject：`approval_status=rejected`；不入队。」——**未**提重提端点。

**为何本图不动**：新增端点属**新增产品面**（既非收紧亦非逐位等价）；端点契约在 PRD **未定义**，自行发明等于造第二套契约。

**改动路径**：ADR（裁端点契约：路径 / 权限码 / 是否重置审批链 / 是否复用在线编写入口）→ 改 `prds/05-api`（补端点）+ `prds/04-pipelines` → 升 `prds/README.md` 版本；随后按 PRD 落 `packages/contracts` DTO/码 + `apps/api` 路由 + 测例。

**若走实现路的爆炸面**：新增路由（`routes/documents`）+ 状态迁移 `rejected → pending`（须决定是否清 `approved_by`、是否重跑四眼）+ 权限码选型（`approval.decide` / `doc.upload`）+ 审计 + 契约 DTO/码；并须核「重提后仍**不**自动入队 scan」。爆炸面 = API + contracts + 审批状态机 + 文档。

## 6 · `X4` 白名单前提

**现象**：`Then` 只举 `docTypes:["no_such_type"] → 400`；源码在 KB **未配** `docTypes` 时**放行任意类型**（`assertScopeDocTypesAllowed` 空枚举 → `{ok:true}`），配了枚举才逐条比对。**本图裁定 X4 = 乙（`已测`）**，本文件只记录「若要改口径须走 ADR」。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:543`：`| X4 | `docTypes:["no_such_type"]` | **400** |`
- 限定句 `prds/11-decisions/00-adr-index.md:1308`（ADR-050）：「非法：未知 `docTypes` 码（**相对该 KB 枚举**）→ **400** `VALIDATION_ERROR`。」
- `prds/11-decisions/00-adr-index.md:1279`：「`ask.scope.docTypes` | 本次 ask 可选类型过滤；省略/空数组 = **不**按类型收窄」
- 交付面 `prds/12-delivery-guides/04-交付控制台.md:124`：「X4 依赖 KB 白名单非空」。

**为何本图不动**：`Then` 在「白名单非空」前提下的硬要求已满足并已测（`apps/api/tests/ask/mode-doc-types-gate.test.ts`）；「空白名单放行」本身是 **ADR-050 口径**，且被 `apps/api/tests/kb/ask-mode-doc-types.test.ts` 的正向断言**钉住** —— 加严会打红该断言（破坏 ADR 对齐），属**改冻结语义**。

**改动路径**：若要「一律 400」（含空白名单）→ ADR（裁 ADR-050「相对该 KB 枚举」是否收窄为绝对枚举）→ 改 `prds/11-decisions` + 对应 PRD 字段表 → 升 `prds/README.md` 版本；并同步改钉住旧口径的测例。

**若走实现路的爆炸面**：改 `apps/api/src/services/kb-settings.ts` 的 scope 闸空枚举分支 + **打红** `apps/api/tests/kb/ask-mode-doc-types.test.ts`（须逐条判「旧断言钉旧行为」还是「新行为错」，**不许**直接改断言）+ 与 `assertDocTypeAllowed`（PATCH 文档：空枚举时反而拒）的口径统一问题。属**收紧**但撞 ADR-050 口径。

## 7 · `T6` §6.0 与 ADR-007

**现象**：`Then`「KB 快照 τ/门禁数字 = 已签字包；篡改 → 加载拒绝或不一致告警失败」；源码只有**写侧 + CLI**（`adr046-snapshot.ts` 的 `bindQualitySnapshotToEval` / `writeBoundSnapshot`，全仓唯一消费者 `scripts/run-l1-golden.ts`），**无运行时读取 / 加载入口**；运行时 τ 仍取 env `TAU_CLAIM`。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:344`：`| T6 配置绑定 | KB 快照 τ/门禁数字 **=** 已签字包；篡改快照 → 加载拒绝或不一致告警失败 |`
- 加强句 `prds/08-quality/02-evaluation-and-gates.md:151`：「| 加载 | 运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载** | 运行时 τ 与签字包脱节 |」
- 冲突面（源码注释自陈）：`apps/api/src/routes/kb-settings.ts` 注释「`tauClaim` 仍取 `TAU_CLAIM`（ADR-007 唯一源；改由签字包加载须先 ADR）」。

**为何本图不动**：§6.0 与 **ADR-007「`TAU_CLAIM` 唯一源」冲突** → 发明运行时加载口须先 ADR（前图已划为须 ADR）。本图只裁定归属 + 记债。

**改动路径**：ADR（裁 §6.0 与 ADR-007 的关系：签字包是否成为 τ 的运行时源）→ 改 `prds/08-quality` §6.0/§8 与 ADR-007 → 升 `prds/README.md` 版本。

**若走实现路的爆炸面**：新增运行时加载器（读 `l1-gate-snapshot.json` 或由 `eval_runs` 派生）+ 与 `env.TAU_CLAIM` 的优先级 / 冲突策略 + `GET …/settings` 的 `qualitySnapshot.tauClaim` 来源改写（现取 env）+ 篡改检测（哈希比对）+ 全仓所有读 `TAU_CLAIM` 的点。爆炸面 = **环境源切换**（行为可见），且撞 ADR-007 唯一源。

## 8 · `P3` 抽样链

**现象**：`Then` 后半「抽样路径仅 `judge_aux`」引用了源码**不存在的面**：`BindingPurpose`（绑定侧）含 `judge_aux`，但 `ChatPurpose`（调用侧）不含，且全仓**无** `online_sample` 抽样链。前半（verify 走 `judge`）已有图测。

**冻结依据（逐字）**：
- `prds/10-delivery/03-acceptance-scenarios.md:260`：`| P3 | purpose | verify 路径 Gateway 仅 `judge`；抽样路径仅 `judge_aux`（单测） |`
- 加强句 `prds/07-models/01-model-gateway.md:234`：「**按 purpose 分链** | generate 与 judge **不得共用一条无差别环**；**judge 与 judge_aux 亦不得共用或穿透**（ADR-042）」
- `prds/11-decisions/00-adr-index.md:796`（ADR-042）：「`fallbackChains.judge_aux` **独立**；链耗尽 → 跳过该条抽样 + `judge_aux_fail`；**禁止**落入 `fallbackChains.judge`」
- 源码：`packages/contracts/src/system/model-gateway.contract.ts:38`（`BindingPurpose` 含 `judge_aux`）vs `apps/api/src/services/gateway/resolve.ts:6-12`（`ChatPurpose` 不含）；`online_sample` 源码零命中。

**为何本图不动**：把 `judge_aux` 加进 `ChatPurpose` 而**无抽样链**，是**空壳面**（没有任何调用方）→ 属「抽样链」这一新功能的前置，不该单独落。

**改动路径**：ADR / PRD（裁抽样链 `online_sample` 的落点与阶段，见 `prds/07-models` / `prds/04-pipelines`）→ 改 PRD → 升 `prds/README.md` 版本；随后落调用侧 purpose + 链隔离 + 预算隔离 + 测例。

**若走实现路的爆炸面**：新增抽样链（触发点 / 抽样率 / 落库 / `judge_aux` 链解析与隔离，含扩 `ChatPurpose` 与 `resolve.ts:244` 的 purpose 循环）+ aux 预算隔离（不得增长 ask `maxLLMCalls`）+ `aux_*` 打点与 score 名 + Langfuse 过滤；并牵动 P4/P5/P7–P11 一串延后行。爆炸面 = 网关解析 + 预算 + 观测 + 评测多面。

---

## 9 · 收口说明

- 本文件是这八条**唯一的 ADR-ready 汇总处**；各分册对应行「缺口」列只写归属 + 收口 + **销账条件**，不再展开。
- 对应包 spec 只留**一行指针**：`.trellis/spec/api/backend/index.md` 的「ADR-ready 裁定指针」节。
- **本图对 `prds/00–11` 一个字未改**；`§6.0` 与 ADR-007 亦未动。
- 八条里**唯一**被本图落地的是第 1 条的 `route_source` 取值域对齐（属「冻结契约缺口」第三类，爆炸面已量清、已在收口报告声明为「行为可见的契约对齐」）；其余七条**一律保持 `部分测` 或按裁定判 `已测`**，一条都不假装绿。
