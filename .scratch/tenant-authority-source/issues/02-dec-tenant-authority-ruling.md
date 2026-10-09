# 裁定：ask 检索期的租户权威源与落点

Type: grilling
Status: resolved
Blocked by: 01

## Question

工单 01 给出取值链全图与可达性之后，**拍一次板**，把「ask 检索期认哪个租户」定成一条可核对的规则。裁定书必须能被第三方拿源码逐条复核。

要裁的至少这几格（每格给**结论 + 依据 + 方向**）：

1. **权威源**：ask 检索期认 —— 入口租户（`auth.tenantId ?? kb.tenantId`）· KB 行租户（`kb.tenantId`）· 还是「两者必须相等，否则不进检索」？给依据（PRD / ADR 原文 + 行号；若属实现选择，**明写「PRD 沉默」**）。
   - 硬材料：**同一仓的两条入口今天给了两个答案** —— 用户路径认入口租户、内口评测路径认 KB 行租户（`routes/eval.ts` 入队带 `kb.tenantId`，内口取请求体）。这个不对称是裁定的核心，不许绕开。
2. **方向**：本仓的「门禁只加严不放宽」对本格意味着什么？逐条论证「改后比改前严 / 松 / 等价」。
3. **落点**：改动落在哪一层 —— ES 查询腿 · 装载面 · ask 入口 · 还是只加断言？
   - 若动装载面：必须正面回应兄弟图 `.scratch/retrieve-corpus-tenant-scope/` 工单 02 的五条「不改」依据，逐条说明为什么今天可以推翻（或说明为什么不推翻）。
   - 若只加断言：说清它怎么让「静默丢失」不再静默（打点 / 拒绝 / 告警各是什么行为），以及会不会改变现有行为。
4. **「不等」时的行为**：拒绝（哪一态：400 / 403 / 5xx / 空答拒答）· 降级取 `kb.tenantId` · 还是照旧（只记录）？给状态机级描述，并指出它落在哪条质量红线之内或之外。
5. **ADR 需求**：改的是不是既有语义（`ask.ts` 的 `auth.tenantId ?? kb.tenantId` 是既有实现）？是否需要 ADR → 改 PRD → 升版本，还是可以「源码收紧 + 记 ADR 债」收口？给判据与结论。
6. **测例纪律**：哪些**既有断言**会因此改判？逐条写下「旧断言钉的是哪条口径、为什么它与本裁定冲突、改判的理由」；**不许**为了让测试变绿而调口径。若某条断言今天只是「两侧传了同一个常量」，明写它本来就不构成保护。
7. **邻接缺口**（工单 01 第 6 组核出的）：成员行租户取邀请人的 · `kb_members.tenant_id` 无消费者 · 装载面取第一行 —— 哪些属本图必须堵的那一格、哪些**明确划出**并写销账条件。划出的要写清「凭什么可以划出」。
8. **测试基建**：前图发现装载测例把 `db.js` 的 `where` mock 成忽略入参（新增查询谓词无回归保护）。本裁定的验证策略要正面处理这点：靠 mock 测例够不够？不够的话替代验证手段是什么（真 PG 夹具 / 纯函数抽取 / 路由表级断言）？
9. **未验证项如实登记**：真 ES / 真 PG 未跑到的部分、以及「今天不可达但结构上可达」的部分，分别怎么记。

裁定书末尾必须附一节 **「反证怎么打」**：列出 2–4 个**能证明本裁定判错**的探针（改哪一行 → 哪几条测例应变红 / 哪个对照应变差），供工单 03 执行。

## Answer

### R0 · 先把立项前提修正掉（工单 01 核出）

- 「本议题 **PRD 沉默**」**不成立**：`prds/11-decisions/00-adr-index.md:151`（ADR-009）与 `prds/04-pipelines/02-online-ask-langgraph.md:170` **明文**要求「检索层纵深：断言 `userId ∈ kb_members(kbId)` **且 tenant 一致**；失败 → finalize abstained `reason=not_member`（或 `internal_guard`），**不进 dense/ES**」。**源码今天没有这条「一致」断言**。
- 「AE8 对称」**不是**租户依据：AE8 原行只写「dense 与 ES filter 均含**部门**条件 | 对称」（`prds/10-delivery/03-acceptance-scenarios.md:524`）；且既有 `describe('runRetrieve 的 ES 收窄与 PG 语料同源（AE8 对称）')` **没有断言 `tenantId`**（只断言 `ownerDeptIds` / `maxVisibleLevel` / evidence 集合）——「两侧传同一个 `TENANT`」是夹具事实，不是被钉住的量。
- 「未实测」**已被推翻**：真 ES 最小对照跑出实际数字（同 KB 三文档租户 A/A/B：A 查 2 命中、B 查 1；`kb-onlyA`：A→1、**B→0**）→ 「两源不等时稀疏腿静默丢失且不泄漏」是**实测结论**。
- 可达性收窄为「**只在 dev/test 可达**」+ 「内口是结构上的开口」：`/web/dev-login` 的 `tenantId` 只对**新 email** 生效（`apps/api/src/services/members.ts:50-64`），且整条只在 `APP_ENV∈{development,test}` 通（`apps/api/src/routes/auth.ts:90-92`）；内口 `apps/api/src/routes/eval.ts:294-327` **既不校验 `kbId` 存在、也不校验 `body.tenantId`**。

### R1 · 答案不是「二选一」，而是「**两值必须一致**」

依据 = 上面两条**冻结明文**（ADR-009 `:151` / online `:170`）。这条落在「**PRD 已明文、源码未实现**」一档 ⇒ 本图是**补实现**，不是改语义 ⇒ **不触发 ADR → 改 PRD → 升版本**。
PRD 真正沉默的只有一格：**「一致」是比较哪两个 tenant**（R2 裁这一格）。

### R2 · 比较的双方 = 令牌租户 vs KB 行租户；「令牌没声明租户」不算不一致

- 双方 = `auth.tenantId`（令牌）与 `kb.tenantId`（KB 行）。理由：**KB 行是写侧唯一的租户来源**（文档行 / 分片 / chunk_embeddings / ES bulk 全部落 `kb.tenantId`），令牌租户不是。
- `auth.tenantId` **缺失**时入口按今日回落 `?? kb.tenantId`，该回落**只能**产生相等 ⇒ 「缺失」不构成不一致、**逐位等价**。**明确否决**「缺失即拒」：`AUTH_ENFORCE` 默认关时根本没有令牌租户，判「缺失即拒」会把默认档下的全部 ask 打成拒答。
- 因此判定式可以直接比**回落之后**的入口值：入口回落只在「令牌未声明」时发生，不会掩盖真正的不等。

### R3 · 落点 = ask 管线（`services/ask/execute.ts`）；失败形态 = **abstain**，不是 403

- 依据：PRD 0b 的失败形态逐字是「finalize **abstained**」；0a 的 403 是「第一道」，本图补的是「**纵深**」。
- 落点放在 `runRetrieve` **之前** ⇒ 不一致时**不进 dense / 不进 ES**（PRD 逐字要求）。
- KB 租户以**必填入参**形式进入管线：`ExecuteAskParams` 新增 `kbTenantId: string` ⇒ **类型系统即防漂移**（新入口少传即编译不过，不会静默免检）。

### R4 · 判定式与 reason

- 判定式：`params.tenantId !== params.kbTenantId` → abstain。
- reason = **`not_member`**（PRD 0b 的首选词，且与既有成员纵深断言同词）。**不选 `internal_guard`**：其用户文案是「服务暂时无法完成可靠回答 / 稍后重试」，会把一个须联系管理员的跨租户问题说成偶发故障。日志 `message` 写明 cause（含 `kbTenantId` / 入口租户），用户文案沿用既有 `not_member`（「您无权访问该知识库。」）。

### R5 · 两条入口都要落（含内口），并堵住内口开口

- **用户路径** `apps/api/src/routes/ask.ts`：`kb` 已在手（`getKb` 已调）→ 传 `kbTenantId: kb.tenantId`。
- **内口** `apps/api/src/routes/eval.ts` 的 `/internal/eval/execute-ask`：**补一次 `getKb`**（该 dep 已存在，`EvalRouteDeps.getKb`），KB 行取不到 → 拒（`not_member`），并把 `kb.tenantId` 作为 `kbTenantId` 传下去 ⇒ 「接受任意 `tenantId`」这个开口被堵。
- **两个评测脚本** `apps/api/src/scripts/run-l1-golden.ts` / `run-l2-golden.ts`：今天 `tenantId` 取 env 默认（可能 ≠ KB 租户）→ 必须补 `kbTenantId`（值来自 KB 行）。**副作用如实写**：若有人用 `L1_TENANT_ID` / `L2_TENANT_ID` 显式指到 ≠ KB 租户，本图之后该批跑会按新规则拒答 —— 这是**预期的 fail-closed**，须在 spec / 镜像里写明用法。

### R6 · 明确否决的两条候选（附残余）

- **候选 ①（ES 稀疏腿改按 `kb.tenantId`）不做**：断言前置后两值恒等，改取值来源**不改变任何结果**（逐位等价），代价却是翻两条既有断言（`apps/api/tests/ask/retrieve-run.test.ts:462` · `apps/api/tests/ask/sparse-kb-filter.test.ts:117`）并要给测试 deps 补 KB 行。**残余（记债）**：直接调用 `runRetrieve` 的调用点（今天只有测试）不受本断言保护。销账条件 = 出现**第三个生产入口**时，把断言**下沉到 `runRetrieve`**（届时给 `RetrieveInput` 加必填 `kbTenantId`，或改 ES 腿按 KB 租户）。
- **候选 ②（路由层直接 403 拒）不采用**：那是 0a 的形态；0b 明写失败形态是 abstain，路由层再做一遍属重复且形态不符。

### R7 · 验收与反证

新增测例（`apps/api/tests/ask/` 或 `tests/eval/`，按能力落目录、头注释简体中文、登记 index）覆盖：

1. 两值相等 → 照常检索（逐位等价，回归锚）。
2. 两值不等 → `ok:false` / `reason='not_member'`，**且 sparse 未被调用**（Dense 也不该跑）。**反证**：把判定删掉 → 本条必红。
3. 内口：KB 行不存在 → 拒；KB 行存在且 `body.tenantId ≠ kb.tenantId` → 拒。
4. 用户路由：令牌租户 ≠ KB 租户时，路由交出的 `tenantId` 是**令牌租户**（不是 KB 租户）、`kbTenantId` 是 **KB 行租户**。**反证**：把 `kbTenantId` 写成 `tenantId` / 写成常量 → 本条必红（这两处正是「静默抹平不等」的漂移口）。
5. 反证探针无效时如实记录并换探针（前图教训）。

**既有断言零翻**：研究票 §4.3 已证今天**全仓无**「入口租户 ≠ 文档行/KB 租户」的夹具 ⇒ 新断言在既有夹具上恒不命中；`ExecuteAskParams` 的既有构造点补字段属**新增必填入参**，断言内容不变。**若实跑出现翻红，先如实报告再裁，不许放宽实现。**

### R8 · 邻接缺口的处置（留 / 划 都写明销账条件）

| 缺口 | 处置 |
|------|------|
| `apps/api/src/routes/members.ts:73` 成员行租户取**邀请人**的、无「目标用户须同租户」校验 | **划出（留雾）**：今天 `kb_members.tenant_id` **无任何消费者**（研究票 §6.2），无越权；收紧属成员模型议题。销账条件 = 真 IdP 接入或该列出现第一个消费者时必裁 |
| 内口把 `membership: 'member'` **硬编码**（绕过 0b 的成员断言） | **划出（留雾 + 记债）**：内口不携带真实身份，堵它要动内口信任模型，不属本图 |
| `apps/api/src/services/retrieve/corpus.ts:71` 取**第一行**文档的租户 | **划出（留雾）**：今天无路径能造出「同 KB 内文档行租户不一致」（研究票 §6.3）；要动它必须先裁「哪一行才算」 |
| `prds/09-security/01-auth-acl-compliance.md:219` 省略「且 tenant 一致」（与 ADR-009 / online 措辞不一致） | **不改 PRD**；在 spec + 镜像记「措辞差，以更具体者（ADR-009 `:151` / online `:170`）为准」 |
| **超管跨租户访问是否放行**（ADR-051 `:1360` 只写「超管全权：无需 `kb_members`」，**未写跨租户**） | **本图不给超管例外**：租户是存储隔离边界（ES filter / Mongo 分库 / RustFS key 前缀全按租户），且断言确定性优于猜测。**划出 + 记债**：销账条件 = 接真 IdP 或做多租户试点前，由 ADR 明确「超管可否跨租户」；若届时判「可」，本图这条断言需同步开例外（属改冻结语义，须 ADR → 改 PRD → 升版） |
| 装载测例把 `db.js` 的 `where` mock 成忽略入参（新增查询谓词无回归保护） | **划出 + 记债**：本图不在装载面加谓词，故不触发；销账条件 = 下次在装载面加谓词时同步改 mock 口径或用真 PG 验 |

### R9 · 本图结论的规定表述（防高估）

准确表述 = 「**补实现 ADR-009『且 tenant 一致』这条检索层纵深断言；权威源不二选一，而是要求两值一致**」。
**禁止**写成「改了 ask 的租户语义」· 「让 ask 认 KB 的租户」· 「修了跨租户泄漏」（本场景**不泄漏**，是召回丢失）· 「多租户已就绪」。
