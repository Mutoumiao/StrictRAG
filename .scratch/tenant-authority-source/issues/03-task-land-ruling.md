# 落地：按裁定改源码 / 加断言 + 测例 + 反证

Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定书落地。**只做裁定要求的**，不扩面。收工时要能回答：改了什么、为什么改、怎么验的、什么没验。

必做：

1. **改动表**：逐条列 `file:line` × 旧 × 新 × 依据（指到裁定书的第几格）。若裁定为「不改源码」，本表如实写「无改动」并给出替代动作（断言 / 打点 / 文档），**不许**为了让工单好看而顺手改。
2. **测例**：
   - 只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」简体中文，并登记该包 `tests/index.md`。
   - 必须覆盖裁定要求的**每一格行为**，含边界（两源相等 / 不等 / 缺 `auth.tenantId` / 缺文档行租户）。
   - **不许**只用「两侧传同一个常量」的夹具自证（前图已证这类断言不构成保护）；若裁定要求的行为只能在真 PG / 真 ES 上分辨，写明并用可用的最强替代（纯函数抽取 / 依赖注入 / 真中间件）落测。
3. **反证**：按裁定书末尾的「反证怎么打」逐条执行，记录每条探针的**实测红条数**与恢复后的绿条数。探针无效（改完仍全绿）必须如实记下并换一条 —— 前图有过「反证探针本身无效」的教训。
4. **既有断言**：逐条核对是否翻；翻了的话在工单里写明「旧断言钉的是哪条口径、裁定为什么判它错」。**未获裁定授权的断言一条不许改。**
5. **门禁**：`pnpm check-types`（全仓）· `pnpm lint`（零 warning）· 相关包测试；改动跨包时跑全仓 `pnpm test`（`--concurrency=1`）。测试存货闸在包目录内跑。
6. **未验证清单**：真 ES / 真 PG / 真模型 / 生产档位各自的实测状态（跑了就写命令与数字，没跑就写阻塞点）。**不得**把「纯函数级可断言」写成「已端到端验证」。

## Answer

### 1 · 改动表（按裁定书逐格落）

| # | 文件 | 旧 | 新 | 依据 |
|---|------|----|----|------|
| 1 | `apps/api/src/graph/state.ts` | `AskGraphInput` / `AskGraphState` 无 KB 租户 | 两者各加 **必填** `kbTenantId: string`（含「必填即防漂移」注释）；`initState` 透传 | R2 / R3 |
| 2 | `apps/api/src/graph/run.ts` | 检索节点直接排预算 → 检索 | 检索节点**前置**加 0b 断言：`state.tenantId !== state.kbTenantId` → `span.end({reason:'not_member'})` + `logger.info({event:'ask_tenant_mismatch',…})` + `finalize(state,'not_member')`（**在 `tryChargeRetrieve` 之前**，故不耗检索预算、不进 dense/ES） | R3 / R4 |
| 3 | `apps/api/src/services/ask/execute.ts` | `ExecuteAskParams` 无 KB 租户 | 加 **必填** `kbTenantId`（注释写明「不得用 `tenantId` 顶替」）并透传给 `runAskGraph` | R3 |
| 4 | `apps/api/src/routes/ask.ts` | 两处 `run({…})` 只传 `tenantId` | 两处各加 `kbTenantId: kb.tenantId`（`kb` 已在手，`tenantId` 仍是令牌租户） | R5 |
| 5 | `apps/api/src/routes/eval.ts` | 内口不查 KB、`body.tenantId` 原样下传 | 内口加 `getKb(kbId)`：取不到 → **404**；取到 → `kbTenantId: kb.tenantId` 下传（开口被堵） | R5 |
| 6 | `apps/api/src/scripts/run-l1-golden.ts` | `RunL1Options` 无 KB 租户 | 加 `kbTenantId?`；`runL1Golden` 内 `opts.kbTenantId ?? tenantId` → 传入 params；**CLI `main()` 读 KB 行**（取不到 → exit 2） | R5 |
| 7 | `apps/api/src/scripts/run-l2-golden.ts` | 同上 | 同上 | R5 |
| 8 | `apps/api/tests/ask/_support/graph-harness.ts` | `baseInput` 无该字段 | `kbTenantId: over.kbTenantId ?? over.tenantId ?? 'tenant-1'`（默认随 `tenantId` 保持一致，要造不等须显式覆写） | R7 |
| 9 | 4 个测试文件的 9 处 `executeAsk({…})` 字面量 | 缺字段 | 各补 `kbTenantId`（同值）—— 属「新增必填入参」的夹具同步，**断言内容不变** | R7 |
| 10 | `apps/api/tests/ask/tenant-consistency.test.ts` + `apps/api/tests/index.md` | 无 | 新增 7 例 + 登记一行 | R7 |

**落点说明**：断言放在 **ask 图的检索节点前置**（= PRD §5「0b 检索层纵深」的位置，失败形态是 `finalize abstained`），因此**两条入口（用户路由 / 内口）共用同一条判定**，且未来任何在图上取证的节点都会先过这道闸。**KB 租户来源限定为 KB 行**（`getKb` / `documentRepo.getKb`），不用文档行「第一行」那一路（R8 已把后者留雾）。

### 2 · 新增覆盖（8 例）

| 例 | 断言 |
|----|------|
| 图 · 等值 | `status='answered'` ∧ 注入的 retrieve 被调 **1** 次（回归锚） |
| 图 · 不等值 | `status='abstained'` ∧ `reason='not_member'` ∧ 注入的 retrieve **0 次**（不进 dense/ES） |
| 路由 · 令牌租户 = KB 行租户 | 200 ∧ `answered` |
| 路由 · 令牌租户 ≠ KB 行租户 | 200 ∧ `abstained` ∧ `not_member`（钉「不得用 KB 租户顶替令牌租户」） |
| 路由 · **令牌没声明租户** | 200 ∧ `answered`（R2 边界：回落只会产生相等，不算不一致） |
| 内口 · `kbId` 不存在 | **404**（此前是开口；「请求写错」与「身份与数据矛盾」分开处置） |
| 内口 · body 租户 = KB 行租户 | 200 ∧ `answered` |
| 内口 · body 租户 ≠ KB 行租户 | 200 ∧ `abstained` ∧ `not_member` |

路由 / 内口用例走**真 `executeAsk` + 真图**（只注入 `graphDeps` 的 chat 与 `skipTrace`），故不是「只断言传参」的形状。

### 3 · 反证（逐条实测）

| 探针 | 改法 | 实测 | 恢复后 |
|------|------|------|--------|
| P1 删判定 | `run.ts` 的 `if (state.tenantId !== state.kbTenantId)` → `if (false)` | **3 红**（图·不等值 · 路由·不等值 · 内口·不等值），4 绿 | 7 绿 |
| P2 抹平不等 | `routes/ask.ts` 的两处 `kbTenantId: kb.tenantId` → `kbTenantId: tenantId` | **1 红**（路由·不等值转 `answered`），6 绿 | 7 绿 |

两个探针都有效（P1 命中图这条真判据，P2 命中「入口把两值抹平」这个漂移口）。

### 4 · 既有断言零翻

- **api 全量**：`187 files passed` · `1169 passed | 3 skipped (1172)`（改动前 186 文件 / 1161 passed + 3 skipped ⇒ **+1 文件 · +8 例，零红零翻**）。
- 装载面的 fail-closed 测例（`dept-acl-ask-e2e.test.ts:327-341`）**未动、未红**：本图**不改装载面**（R6 已裁）。
- ES 稀疏腿的两条「入口租户」断言（`retrieve-run.test.ts:462` · `sparse-kb-filter.test.ts:117`）**未动、未红**：R6 已裁「不改取值来源」，故本条不触发。
- 唯一被动的既有断言是 `ExecuteAskParams` 的 9 处字面量构造点**补字段**（值同），断言本身一字未改。

### 5 · 门禁数字

| 门 | 结果 |
|----|------|
| `pnpm --filter @strict-rag/api test` | 187 文件全绿 · 1169 passed + 3 skipped |
| `pnpm check-types` | **8 successful, 8 total** |
| `pnpm lint` | **8 successful, 8 total**（`--max-warnings 0`，api 实际执行非缓存） |
| 全仓 `pnpm test --concurrency=1` | **11 successful, 11 total**（admin-catalog 13 · contracts 322 · db · worker 289 · api 1169+3 · admin 200 · web 56） |
| `pnpm check:module-status` | 47 条（2 env + 13 符号 + 32 表），`1-路径` / `6-联动` / `7-时效` **均为空**；与立图前同数（本次回写**未新增**噪声） |

### 6 · 未验证 / 残余（如实登记）

- **未做全栈真栈端到端**：本图只在图级与路由级证明「不等值 → 拒答」。**真 ES 上的最小对照已由工单 01 跑过**（A 查 2 / B 查 1 · `kb-onlyA`：A→1 / B→0），证明的是**旧行为**（静默丢失）；新行为的端到端（起 api + 真 PG + 真 ES + 网关）**本轮未做**。
- **CLI 批跑的嵌入式用法**：`runL1Golden` / `runL2Golden` 若被**编程方式**调用而不传 `kbTenantId`，等于声明「入口租户就是 KB 租户」，该批不做一致性判定。生产 CLI（`main()`）已读 KB 行，故真实批跑受保护；**残余 = 嵌入式调用**。销账条件：把该参提为必填，或让批跑改走内口。
- **超管跨租户**：本图的断言**不给超管例外**（租户是存储隔离边界）。这是**与 ADR-051 `:1360`「内容与平台全路径」的字面张力**（该条未写租户）→ 记债并登总 backlog `DEC-TENANT-SA`（销账条件见裁定书 R8）。
- **`kbTenantId` 的防漂移面有边界**：`tests/` 不在 `check-types` 覆盖面（`apps/api/tsconfig.json` 的 `include` 只有 `src`），CLI runner 的该参是**可选**（`?? tenantId`）→ 这两处不靠类型护栏，靠测例与「入口读 KB 行」的纪律。
- **dev 探针未纳入**：`apps/api/src/scripts/seed-es-sparse-probe.ts` 自行取**文档行第一行**租户并**直连** `searchSparseEs`（绕过 `runRetrieve` 与本断言）。非生产 ask 入口，**不在保护范围**，如实登记。
- **内口 `membership: 'member'` 硬编码**（0b 的成员侧在内口被绕过）：本图**未动**（属内口信任模型），留雾 + 记债。
- **`kb_members.tenant_id` 取邀请人租户 / 无同租户校验**：**未动**（无消费者、无越权），留雾。
- **装载面取「第一行」租户**：**未动**，留雾。
