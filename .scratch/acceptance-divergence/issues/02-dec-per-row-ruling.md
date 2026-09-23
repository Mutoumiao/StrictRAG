# 裁定：16 行分歧各归谁、按什么收口

Type: grilling
Status: resolved（主控自裁 2026-09-23；依据 = 工单 01 取证 + 主控反向复核）
Blocked by: 01-research-then-source-evidence

## Question

把工单 01 的 16 行取证，逐行裁定成**四类归属之一**，并给出**收口动作**：

- **甲 · 源码缺实现**（Then 是单一硬要求，源码缺）→ 收口 = 改源码 + 补测例；若离线不可做，写明阻塞方。
- **乙 · 许可 / 析取已满足**（Then 的措辞是「可带 / 可为 / 或 / 建议」，源码满足任一支即合规）→ 收口 = **订正覆盖表该行口径**，**并补一条钉住「源码实际满足的那一支」的测例**（不许只改文字）。
- **丙 · Then 引用了源码里不存在的面**（如 `route_source=rule_knowledge`、debug / maintenance 档位）→ 收口 = **ADR-ready 裁定书**（改措辞或补源码面都撞「改冻结语义须 ADR」），覆盖表缺口列写清归属与路径。
- **丁 · 须 ADR / 撞外部基建**（如 T6 撞 ADR-007；X5 撞 B8 真 ES）→ 收口 = 记债 + 写明阻塞方 + 覆盖表缺口列写清。

裁定必须回答的四问（每行都要）：

1. **分歧归属**是哪一类（甲乙丙丁），依据是什么（PRD 措辞逐字 + 源码锚点）。
2. 该行的**硬要求**是什么（把它从措辞里剥出来），今天源码**是否满足**。
3. 收口动作**具体到文件**（改哪个源文件 / 补哪个测试文件与 `it` 名 / 覆盖表哪一册哪一行改成什么话）。
4. **该行覆盖值怎么重判**（`已测` / `部分测` / `缺实现` / 延后），以及**为什么这个改动是收紧或逐位等价**。

另需裁定三条**跨行纪律**：

- 订正覆盖表口径时的**统一写法**（避免 16 行 16 种话术）：缺口列里「已裁定」与「仍缺」必须能一眼分开。
- 裁定为**丙**的行，裁定书**放哪**（`.scratch/` 图内 / `.trellis/spec/` / `docs/module-status/`），以及**必须写清**「改它需要走 ADR → 改 PRD → 升版」。
- 是否**需要**新增源码面（如 X4 的「KB 未配 docTypes 时未知类型也 400」、H1 的 `Retry-After` 头）——若裁定为需要且离线可做，明确写进工单 03–06 的落地清单；若裁定为不需要，写明**为什么不加**（不许含糊）。

## 纪律

- **不许**为让某行变绿而放宽门禁、删断言、缩断言范围。
- **不许**裁定「改 PRD 措辞」并直接落——只能出 ADR-ready 裁定书。
- **不许**留下任何一行「源码侧待定」。
- 裁定时凡涉及「PRD 到底写了什么」，回到 `prds/10-delivery/03-acceptance-scenarios.md` **原文**，不引覆盖表转述。

## 产出

- 本工单文件内的 `## Answer`（逐行裁定表 + 三条跨行纪律 + 交给工单 03–06 的落地清单）。
- 若裁定需要，附 `research/02-dec-...md` 或直接在 Answer 内展开（不强制另存文件）。

## Answer

**依据**：工单 01 取证（`.scratch/acceptance-divergence/research/01-then-source-evidence.md`）+ 主控对抗性反向复核（见工单 01「主控复核补记」，三行改判）。**一条总原则**：Then 的**措辞**决定它是义务还是许可，PRD 里**已冻但源码缺**的面照 PD 层级判归属，**没有第三套判据**。

### 一、逐行裁定表

| 行 | 归属 | 硬要求（剥出后） | 今日是否满足 | 收口动作（具体到文件） | 覆盖值 |
|---|---|---|---|---|---|
| `D-拼句` | **乙 + 甲（点到的面）** | 不得 chitchat、应 single | ✅ 满足 | ① `apps/api/src/graph/route-rules.ts`：把 `route_source` 取值域**对齐 ADR-033 观测四元**（`'rule'` → `'rule_chitchat'` / `'rule_knowledge'`；`'fallback_single'` 不动；`'llm'` 是 P2 未实现路径，**不预置**）；映射裁定：`looksChitchat ∧ !blocked → rule_chitchat`、`looksChitchat ∧ blocked → rule_knowledge`（post-block 闸语义 = 判为知识向）、`KNOWLEDGE_HINT ∨ n.length>4 → rule_knowledge`、其余 → `fallback_single`。② `apps/api/tests/ask/route-rules.test.ts` 补 `it`：原句 → single + 非 chitchat + `route_source='rule_knowledge'`。③ 记债 1 条（`route_post_block=true` 支在 P2 不可达 —— 它对应 ADR-033 决策 2 的 **LLM 路**，而 P2 未接 LLM route，**非缺陷**）。 | `部分测` → **`已测`** |
| `H1` | **乙** | 429 + `RATE_LIMITED` | ✅ 满足 | **不补 `Retry-After` 头**（Then「可带」+ API PRD `:562`/`:599`「建议」= 许可；补头属新增行为，无冻结契约要求）。覆盖表证据列点名 `tests/obs/rate-limit.test.ts` 与 `quota-planes.test.ts` 的两个 `it` 钉住 429 + 码 + `retryAfterSec`。 | `部分测` → **`已测`** |
| `H5e` | **丙** | debug / maintenance 档位下拒绝 RRF-only answered | ➖ 档位在 P2 **无面** | **不建档位**（ADR-030/034 与 `prds/10-delivery/02-ops-runbook.md:201` **明文禁止**该逃生口 → 建档位是反 ADR 方向）。实质不变式「rerank 全链失败禁 RRF-only answered」由 `H5c` 已测覆盖 → 覆盖表缺口列写「已裁定：Then 引用的档位在 P2 无面且被 ADR 禁止；实质由 H5c 覆盖」。 | `部分测` 保留 |
| `U8` | **乙** | 「无 L2 → 禁止启用 rewrite」 | ✅ 支 B 已落 | **不补启动闸**（析取已满足；补启动闸会让无 L2 归档的 dev/test 环境一律启不起来，属引入离线不可满足的启动前置）。覆盖表证据列点名 `apps/api/tests/kb/settings-http.test.ts` 的 400 `SESSION_REWRITE_DISABLED` 断言。 | `部分测` → **`已测`** |
| `J7c` | **乙** | 同 U8 | ✅ 同上 | 同 U8（本行是 U8 的回指行）；覆盖表证据列点名 `packages/contracts/tests/kb/settings-contract.test.ts` 与 `biz-code.ts` 的码。 | `部分测` → **`已测`** |
| `M8` | **甲**（审计面） | 无残留 ✅ · 无隔离区 ✅ · **审计含 hash + uploaderId + timestamp** ❌ | 前两项满足，第三项无落点 | ① `apps/worker/tests/ingest/` 补**专断言** `it`（对象已删 + 无隔离区路径），别只当 `scan-infected-effects.test.ts` 的副产品。② 审计面**本图不实现**：销账条件 = ① PRD 裁清「审计」sink（表 / Pino / Langfuse 三者未定，`prds/09-security:358` 与 ADR-038 #4 只列字段）；② 真扫描引擎（QUAL-2）落地后有真 `hash` / `scanResult` 可写。写入 ADR-ready 汇总。 | `部分测` 保留 |
| `V5` | **甲** | 「不 scan」✅ · 「可重提」❌ | 半缺 | 「不 scan」已测（`reject-http.test.ts`）。「可重提」**本图不新增端点**：属**新增产品面**（既非收紧非等价），且 PRD **未定义**该端点契约（`prds/05-api/01-http-api-hono.md:216` 只写 reject 不入队）。销账条件 = 先裁端点契约（路径 / 权限 / 是否重置审批链 / 是否复用 `POST /documents/write`）。写入 ADR-ready 汇总。 | `部分测` 保留 |
| `S1` | **乙（实质）+ 债** | 「管理壳不可用」（括注） | ✅ 成立 | 具名信号 403 / 302→web 源于 **ADR-045 #1**，已被 **ADR-051 `:1344` 修订**；客户端会话壳下**不可能**有服务端 302 → 覆盖表缺口列写「已裁定 + 记债（服务端硬拦截未落地）」。`apps/admin/tests/shell/auth-guard.test.tsx` 补 `it` 钉「无 `admin.shell` → 不渲染壳子树 + 清会话（`web_consumer` 空码）」。**不动壳行为**（无浏览器；且改壳架构须先动会话载体 = 须 ADR）。 | `部分测` 保留 |
| `S4` | **乙** | 「可进 admin」 | ✅ 按**能力**读成立 | 覆盖表缺口列改写：`admin.shell` 打包在写能力模板（`role-templates.ts:19`/`:24`）→ 有写能力 ⟹ 可进壳；`kb_members.role` 不参与（ADR-051 / ADR-035）。补 `it` 钉「有 `admin.shell` 即可进壳；KB 角色不参与判定」。 | `部分测` → **`已测`** |
| `Y6` | **乙（实质）+ 债** | 403 或 302→web | ➖ 实质同 S1 | 与 `S1` **同一裁定同一债**（仅缺 S1 的括注，不构成实质区别 —— 本图**不**人为拆成两种归属）。 | `部分测` 保留 |
| `X4` | **乙** | `docTypes:["no_such_type"]` → 400 | ✅ 在 Then 的前提下成立 | **不加严**：ADR-050 `:1308` 把非法码限定为「**相对该 KB 枚举**」，`prds/12-delivery-guides/04-交付控制台.md:124` 明写「X4 **依赖 KB 白名单非空**」→ 白名单非空时源码已 400 并已测（`mode-doc-types-gate.test.ts:134`）。反之 `ask-mode-doc-types.test.ts:52` 正**钉住**「KB 空枚举则放行」这一 ADR-050 口径 —— 加严会打红它，属**破坏 ADR 对齐**，不做。缺口列写「已裁定：Then 前提是白名单非空；空白名单放行属 ADR-050 口径，非缺口」。 | `部分测` → **`已测`** |
| `X5` | **丁**（源码缺 + 撞 B8） | dense 与 ES filter 均含 `doc_type∈hr`，对称 | ➖ 净效果对称、**查询体形状不对称** | 覆盖表口径精确化：「ES 查询体不含 `doc_type`；类型过滤的净效果由装载层（`corpus.ts`）+ sparse 事后求交（`retrieve.ts:212`）保证」。可离线钉的对称性断言已在 `ready-active-corpus.test.ts`；真值阻塞方 = 真 ES（B8）。 | `部分测` 保留 |
| `R9` | **甲** | 入库 embed `plane=ingest` | ❌ worker 侧无打点 | **本图不建 worker 指标面**：`apps/worker/src` 连 `metric` 都零命中 → 落点 = 新建指标基建（新增面）。销账条件 = ① worker 指标面；② 真 Redis / 配额基建（embed TPM）。写入 ADR-ready 汇总。 | `部分测` 保留 |
| `T6` | **丁**（撞 ADR-007） | 快照 = 已签字包；篡改 → 加载拒绝 | ➖ 只有写侧 + CLI | **本图不发明运行时加载口**（§6.0 与 ADR-007「`TAU_CLAIM` 唯一源」冲突，源码注释 `kb-settings.ts:62-68` 自陈须先 ADR）。覆盖表缺口列写「已裁定：须 ADR → 改 PRD → 升版」。 | `部分测` 保留 |
| `P3` | **丙** | verify 仅 `judge` ✅ · 抽样仅 `judge_aux` ❌ | 前半满足 | **不把 `judge_aux` 加进 `ChatPurpose`**：没有抽样链时那是**空壳面**。前半由 `verify-required.test.ts` 已测；后半销账条件 = `online_sample` 抽样链落地（属新功能）。 | `部分测` 保留 |
| `AC2` | **乙** | 「可保存」（字面唯一义务） | ✅ 满足 | **不加闸**：「三类各至少一启用」是覆盖表的**加严读法**，`prds/05-api/01-http-api-hono.md:465` 只要求「Provider 至少一模型」。缺口列写「已裁定：字面义务 = 可保存（已测）；『三类齐』非 PRD 要求」。 | `部分测` → **`已测`** |

**分布**：`已测` **7**（`D-拼句` `H1` `U8` `J7c` `S4` `X4` `AC2`）· 保留 `部分测` **9**（`S1` `Y6` `H5e` `M8` `V5` `X5` `R9` `T6` `P3`）。**没有一行留「源码侧待定」**。

### 二、三条跨行纪律

1. **覆盖表缺口列的定型写法**：`已裁定：〈归属〉· 依据〈PRD 措辞 + 源码锚点（路径:行号）〉· 收口〈已落地动作（点名测例文件 + it 名）｜阻塞方 + 销账条件〉`。**禁止**再出现「源码侧待定」，**禁止**只写「待补测」。
2. **ADR-ready 裁定书集中一处**：落到图内 `.scratch/acceptance-divergence/research/02-adr-ready-findings.md`（八条：`D-拼句` 死分支与 LLM 路线 · `H5e` 档位措辞 · `S1`/`Y6` 壳硬拦截 · `M8` 审计 sink · `V5` 端点契约 · `X4` 白名单前提 · `T6` §6.0 与 ADR-007 · `P3` 抽样链），并在对应包 `.trellis/spec/` 留**一行指针**。**不动 `prds/`**；每条必须写「改它需 ADR → 改 PRD → 升 `prds/README.md` 版本」。
3. **是否新增源码面的统一答案**：本图**只落地一处** —— `D-拼句` 的 `route_source` 取值域对齐（第三类「冻结契约缺口」：爆炸面已量清 —— 生产点仅 `route-rules.ts`；`state.ts:61` 与 `ask.contract.ts:129` 均宽松类型；既有断言**零处**断言 `'rule'`）。**其余一律不加**，理由逐条写在上表（补头 / 补启动闸 / 建档位 / 加 `judge_aux` purpose / 建 worker 指标面 / 加三类闸 / 新增重提端点 —— 七项「不加」，各有依据，多数是「补了会反 ADR 或引入离线不可满足的前置」）。

### 三、交给工单 03–06 的落地清单

- **03（ask）**：`route-rules.ts` 取值域对齐 + 补 `D-拼句` / `H1` / `U8` / `J7c` 的指向型 `it`；覆盖表四行（`D-拼句` `H1` `U8` `J7c`）改 `已测`，`H5e` 保留 `部分测` 并改写缺口列。
- **04（ingest）**：`M8` 补「对象已删 + 无隔离区」专断言 `it`；`V5` 只订正口径（不新增端点）。
- **05（acl）**：`S4` `X4` 改 `已测` 并补指向型 `it`；`S1` / `Y6` 保留 `部分测` + 改写缺口列（同一条债）；`X5` 口径精确化。
- **06（ops）**：`AC2` 改 `已测`；`R9` `T6` `P3` 保留 `部分测` + 改写缺口列；汇总表与分册合计**用脚本按行求和核**。
- **07（回写）**：四册 + `docs/testing/coverage.md` 汇总/轮次叙述 + `docs/module-status/{api,worker,admin,...}.md`（`route_source` 这条债**今天镜像零记载**，须补）+ `02-adr-ready-findings.md`；收口门禁在最后一次提交后复跑。

**三句硬话**：① 本图**把七行判绿**，靠的是「Then 的措辞是许可 / 析取」与「Then 的前提在新版 ADR 下成立」，**不是**放宽任何门禁；② 九行保留 `部分测` 是**真债**（服务端硬拦截 / 审计 sink / 重提契约 / ES 真值 / worker 打点 / §6.0 / 抽样链），一行都不假装绿；③ 全局**只动一处源码**（`route_source` 取值域对齐），爆炸面证据已附。
