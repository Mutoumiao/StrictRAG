# 研究 · 16 行「Then ↔ 源码」逐行取证（工单 01）

Type: research · Status: 完成 · 只读取证（本票不改任何源码 / 测例 / 文档 / 配置）

> 本票**不裁定**「哪一侧错」——只把措辞、源码行为、覆盖表转述、测例证据摆齐，供工单 02 裁定。
> 所有结论均可被另一会话用本文件给出的 `路径:行号` 与检索命令复现。

## 0 · 方法与复现说明

- **检索工具**：本机 `grep` / `head` / `sed` 不可用；全文检索用 `git grep`（版本库内）+ ripgrep（对 `prds/`）。
- **`prds/` 不在版本库**（`.gitignore:59` 忽略 `/prds`）→ `git grep` **搜不到 prds**；凡引用 PRD 行号均由**读文件**得出，PRD 措辞检索用带 `glob=*` 的 ripgrep。
- **`.scratch/` 在版本库内**（`git grep` 会命中），故下列命令输出里会夹带本图工单文本，**不计入源码**。
- 本票实际跑过的零命中命令（每条均实跑，非凭印象）：
  - `git grep -n "Retry-After"` → 仅命中 `.scratch` 与 `docs`，**`apps/` 零命中**。
  - `git grep -n "rule_knowledge"` → **源码零命中**（仅 `.scratch` / `docs`）。
  - `git grep -n "route_source"` → `apps/api/src/graph/route-rules.ts:5` 取值为 `'rule' | 'fallback_single'`。
  - `git grep -n "plane" -- apps/worker/src` → **零命中**。
  - `git grep -n "metric\|plane" -- apps/worker/src` → **零命中**。
  - `git grep -n "resubmit\|重新提交\|re-submit"` → **源码零命中**。
  - `git grep -n "online_sample"` → **源码零命中**（仅 `.scratch` / `docs`）。
  - `git grep -ni "maintenance" -- apps/api/src` → **零命中**。
  - `git grep -ni "degraded" -- apps/api/src` → **零命中**。
  - `git grep -n "judge_aux" -- apps/api/src packages/contracts/src` → 仅 `services/model-gateway.ts`（174/205/209）与 `packages/contracts/src/system/model-gateway.contract.ts:38`；`services/gateway/resolve.ts` **零命中**。
  - `git grep -n "doc_type\|docType" -- apps/api/src/services/retrieve` → 仅 `corpus.ts` / `retrieve.ts` / `types.ts`；`es-sparse.ts` **零命中**。
  - `git grep -n "assertScopeDocTypesAllowed"` → `services/kb-settings.ts:273`（定义）+ `routes/ask.ts:282`（调用）。
  - `git grep -n "bindQualitySnapshotToEval\|writeBoundSnapshot"` → 源码侧**唯一消费者** `apps/api/src/scripts/run-l1-golden.ts`。
  - `git grep -n "uploaded_by\|uploadedBy" -- apps/api/src` → 写点仅 `routes/documents/index.ts:352`、`services/ingest-complete-pending.ts:309`（另 `services/documents.ts:168/179`、`routes/documents/mappers.ts:16/48` 为传参 / 读）。
  - `git grep -n "retryAfter" -- apps/api/src` → `obs/rate-limit.ts`、`routes/ask.ts:347/349`、`services/ingest-complete-pending.ts`。

---

## 1 · `D-拼句`（ask 分册）

**① PRD 原文（`prds/10-delivery/03-acceptance-scenarios.md:83`，逐字）**

> `| **D-拼句** | 「你好，请问差旅住宿标准」→ **不得** chitchat（后置禁词闸；应 single 检索路径）；\`route_post_block\` 可为 true 或 \`route_source=rule_knowledge\` |`

**加强 / 软化句（别的 PRD 文件）**：
- `prds/11-decisions/00-adr-index.md:402`（ADR-033 观测四元）：「`route_source` ∈ {`rule_chitchat`,`rule_knowledge`,`llm`,`fallback_single`}」——**冻结枚举**含 `rule_knowledge`。
- `prds/04-pipelines/03-graph-edges-frozen.md:133`：「`route_source` | `rule_chitchat` | `rule_knowledge` | `llm` | `fallback_single`」。
- `prds/10-delivery/02-ops-runbook.md:46`：`route_source_total` 标签 `source=rule_chitchat\|rule_knowledge\|llm\|fallback_single`。
- `prds/04-pipelines/03-graph-edges-frozen.md:170`：「fast 模糊问 → … `route_source=fallback_single` 或 `rule_knowledge`」。

**② Then 语义拆解**

| 子句 | 归类 | 依据（措辞 + 出处） |
|---|---|---|
| 「你好，请问差旅住宿标准」**不得** chitchat | **硬要求** | 加粗「**不得**」（剧本 `:83`） |
| 「应 single 检索路径」（括注） | **硬要求**（措辞「应」） | 括注「（后置禁词闸；应 single 检索路径）」（`:83`） |
| 「`route_post_block` **可为** true」 | **许可 / 析取支 A** | 「**可为**」（`:83`）—— 允许而非义务 |
| 「**或** `route_source=rule_knowledge`」 | **许可 / 析取支 B** | 「**或**」（`:83`）—— 任一支成立即可 |

**③ 源码实数（带锚点）**

- `apps/api/src/graph/route-rules.ts:5`：`route_source: 'rule' | 'fallback_single';` —— **无** `rule_knowledge`、**无** `rule_chitchat`。
- `apps/api/src/graph/route-rules.ts:44-101` `ruleRoute()`：对「你好，请问差旅住宿标准」，确定性推演为
  `normalize()`（`:38-40` 去尾 `[!！。.~]+`）后 `n = '你好，请问差旅住宿标准'`；
  `CHITCHAT_EXACT.has(n)` 假（`:14-28` 白名单是整句）；`/^(你好|您好|hello|hi|hey)[\s,，!！.。]*$/` 假（`:61`）；`n.length <= 4` 假；
  → `looksChitchat=false`（`:60-63`）；`KNOWLEDGE_HINT.test(question)` 假（`:32-33` 词表不匹配）；`n.length > 4` 真 → 命中 `:87-92` 支：
  `routeLabel='single'`、`route_source='rule'`、`route_post_block=false`、`route_llm_skipped=true`。
- **`route_post_block=true` 支（`:68-72`）事实不可达**：进入需 `looksChitchat ∧ POST_BLOCK.test(question)`；`looksChitchat` 只接受「整句即寒暄」（`CHITCHAT_EXACT` 整句集合 / `^(你好|您好|hello|hi|hey)…$` 整句正则 / `^(哈+|嗯+|哦+|嘿+)$` 短感叹），而 `POST_BLOCK`（`:31-32`）的词元（政策/制度/…/\d{2,}/?/？ 等）与上述三支无交集 → 二者互斥。
- 全仓无 `route_source=rule_knowledge` 取值：`git grep -n "rule_knowledge"` 源码零命中（见 §0）。

**④ 覆盖表当前口径（`docs/testing/coverage/00-ask.md` D-拼句 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/graph/route-rules.ts:32-77`：`route_post_block=true` 分支在纯规则路径不可达，全仓亦无 `route_source=rule_knowledge` 取值（仅 `'rule'` / `'fallback_single'`）→ Then 无从断言；现有 `route-rules.test.ts` 只覆盖「你好，年假政策」→ single。禁止写成「待补测」」
- **结论句**：「`route_post_block=true` 分支在纯规则路径不可达」+「全仓亦无 `route_source=rule_knowledge` 取值」——**两句均经本票亲核成立**。
- **转述句**：`:32-77` 行号 —— 该区间**不含** `RuleDecision` 类型（在 `:3-9`）与 `route_post_block=true` 支（在 `:68-72`，含于区间内）；行号区间基本可用，但覆盖表**未说清**「不可达的是那句注释所指的机制，而非 Then 的硬要求」：Then 的硬要求（不得 chitchat / 应 single）**已满足**（见 ③）。→ **转述不完整（结论对、关系未说清）**，与 map「已捕获的镜像瑕疵」一致。

**⑤ 现有测例**

- `apps/api/tests/ask/route-rules.test.ts`：`it('chitchat hello')`（`:19`）、`it('knowledge question → single')`（`:23`）、`it('policy word → single not chitchat')`（`:27`）、`it('D-fast: mode=fast 下短句走 single 且从未以 purpose=route 调 chat')`（`:31`）。
  → 只钉住「制度词 → single 非 chitchat」这**一**硬要求；**未**覆盖原句「你好，请问差旅住宿标准」，**未**断言 `route_post_block`，**未**涉及 `route_source` 取值。

**⑥ 离线可做性**

- **只靠读源码 + 纯函数 + 补测例可落地**：补一条「你好，请问差旅住宿标准 → `routeLabel='single'` 且 `route_post_block=false`」的断言，钉住 Then 硬要求的那一支（离线可做）。
- **必须改冻结语义 / 须 ADR**：删改 `route_source=rule_knowledge` 措辞（撞 ADR-033 `:402` 冻结枚举）或补该取值（撞「改冻结语义须 ADR」）——两条都非离线可单方面落地。

---

## 2 · `H1`（ask 分册）

**① PRD 原文（`:146`，逐字）**

> `| H1 | 短时超限刷 ask | **429** \`RATE_LIMITED\`；可带 Retry-After |`

**软化句（别的 PRD 文件）**：
- `prds/05-api/01-http-api-hono.md:562`：「`RATE_LIMITED` | 429 | 触发限流；响应头**建议** `Retry-After`」。
- `prds/05-api/01-http-api-hono.md:599`：「超限：**429** + `RATE_LIMITED` + **建议** `Retry-After`；打点；突增告警见运维 PRD。」

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| **429** | **硬要求** | 加粗「**429**」（`:146`） |
| `RATE_LIMITED` | **硬要求** | 码名（`:146`） |
| 可带 `Retry-After` | **许可**（允许而非义务） | 「**可带**」（`:146`）；两处 PRD 均写「**建议**」（`:562` / `:599`） |

**③ 源码实数**

- 429 + 码 + body：`apps/api/src/routes/ask.ts:346-351` —— `fail(c, BizCode.RATE_LIMITED, 'ask rate limit exceeded', 429, { retryAfterSec, plane:'ask', ask_quota_exhausted:true })`。
- `retryAfterSec` 计算：`apps/api/src/obs/rate-limit.ts:51-52`。
- **响应头 `Retry-After` 全仓不设**：`git grep -n "Retry-After"` → `apps/` 零命中（见 §0）。
- 码值：`packages/contracts/src/common/biz-code.ts`（`RATE_LIMITED`）。

**④ 覆盖表口径（`docs/testing/coverage/00-ask.md` H1 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。主断言已具备（429 + `RATE_LIMITED` + `retryAfterSec`，`tests/obs/rate-limit.test.ts` · `quota-planes.test.ts`）；`Retry-After` 头在 PRD 原文是「可带」，`apps/api/src` 全仓不设该头 → 先裁「该支删还是补头」。禁止写成「待补测」」
- **结论句**：「主断言已具备」+「`apps/api/src` 全仓不设该头」——**均成立**。
- **转述句**：把 Then 的可选支记成缺口（按「必须」读），即**镜像偏严（over-claim）**；覆盖表自身也写明「PRD 原文是『可带』」，**与源码无出入**。

**⑤ 现有测例**

- `apps/api/tests/obs/rate-limit.test.ts`：`it('超限返回 retryAfter')`（`:25`）、`it('limit=0 不限流')`（`:41`）、`it('限流触发 → 429 + RATE_LIMITED')`（`:58`）。
- `apps/api/tests/obs/quota-planes.test.ts`：`it('ask RPM>0 触顶 → 429 RATE_LIMITED + plane=ask + ask_quota_exhausted，不得 200 answered')`（`:196`）。
- `apps/web/tests/ask/quota-429.test.tsx`。
  → 均钉住硬要求（429 + 码 + `retryAfterSec`）那一半；**无**任何测例断言 `Retry-After` 响应头。

**⑥ 离线可做性**

- **离线可做**：若要补头，`fail()` 增响应头 + 一条断言（属「新增头」收紧，不改既有 429 语义与 `retryAfterSec`）。
- **须裁定/人签**：是否补头属工单 02 裁定；不补头亦**不欠测**（许可支）。

---

## 3 · `H5e`（ask 分册）

**① PRD 原文（`:154`，逐字）**

> `| H5e | debug / maintenance 试图 RRF-only 出 knowledge answered | **拒绝**；仅可 \`abstained\` + 详细 trace 或暂停 ask |`

**加强句（别的 PRD 文件）**：
- `prds/11-decisions/00-adr-index.md:454`（ADR-030/034）：「**禁止一切 RRF-only answered 逃生口（含 debug / maintenance / dogfood）**：debug 可详细 trace 但仍 `abstained`；maintenance 暂停 ask 或强制 abstained；**禁止**运维手册出现「紧急关 rerank 顶 RRF」。真降级 → 运维「产品降级」：暂停 ask / 限 `fast`。」
- `prds/10-delivery/02-ops-runbook.md:201`：「**禁止**任何「关 rerank / 跳过 rerank / RRF-only 仍 `answered`」的官方或 debug 逃生口（含 maintenance mode、内部 dogfood）。」
- `prds/10-delivery/01-phased-roadmap.md:143`：「…全链失败无假 answered；禁 RRF-only debug」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| debug / maintenance「试图 RRF-only 出 knowledge answered」→ **拒绝** | **硬要求**（前提是存在 debug / maintenance 档位） | 加粗「**拒绝**」（`:154`） |
| 「仅可 `abstained` + 详细 trace」 | **许可 / 析取支** | 「或」前后两支（`:154`） |
| 「或暂停 ask」 | **许可 / 析取支** | 「或」（`:154`） |

**③ 源码实数**

- **`apps/api/src` 全仓无 debug / maintenance / degraded 档位开关**：`git grep -ni "maintenance" -- apps/api/src` 与 `git grep -ni "degraded" -- apps/api/src` **零命中**；`apps/api/src/env.ts` 内 `debug` 仅出现于 `LOG_LEVEL` 枚举（`:22` `.enum(['fatal','error','warn','info','debug','trace','silent'])`），非运行档位。
- 现有对应机制只在 rerank 失败路径：`apps/api/src/services/retrieve/retrieve.ts:113-114`（注释「顺序：… RRF → preferred 提权 → Gateway rerank。禁止 RRF-only answered。」）、`:236-242`（`rrfFuse` 后 `fused.length===0 → low_retrieval`）、rerank 失败映射见 `services/retrieve/*`。

**④ 覆盖表口径（`00-ask.md` H5e 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/env.ts` 全仓无 debug / maintenance / degraded 开关，Then 无落点；现有 `retrieve-run.test.ts` 只盖「rerank 失败禁 RRF-only answered」。禁止写成「待补测」」
- **结论句**：「`apps/api/src/env.ts` 全仓无 debug / maintenance / degraded 开关，Then 无落点」——**成立**（注意：本票亲核后把范围从 `env.ts` 扩到「`apps/api/src` 全仓」，结果相同）。
- **转述句**：**把 `env.ts` 全仓** —— 只要结论（无落点）成立，归属面大小不影响裁定；转述与源码无实质出入。

**⑤ 现有测例**

- `apps/api/tests/ask/retrieve-run.test.ts`：`it('rerank failure → rerank_unavailable (no RRF answered)')`（`:282`）。
  → 只钉住「rerank 失败禁 RRF-only answered」；**无** debug / maintenance 档位夹具（源码无该模式可构造）。

**⑥ 离线可做性**

- **须 ADR / 改冻结语义**：补 debug / maintenance 运行档位（撞 ADR-030/034 现有语义与运维手册）或删 `:154` 措辞（改冻结剧本）——两条都撞「改冻结语义须 ADR」。
- **离线可做**：只能补一条「rerank 失败禁 RRF-only」的既有语义断言（已存在），对 Then 本身无新证据。

---

## 4 · `U8`（ask 分册）

**① PRD 原文（`:365`，逐字）**

> `| U8 | P2 配置 \`sessionRewriteEnabledDefault=true\` 无 L2 | **启动/配置拒绝**或 ask rewrite 路径 **400 \`SESSION_REWRITE_DISABLED\`** |`

**同义句（别的 PRD 文件）**：
- `prds/05-api/01-http-api-hono.md:271`：「**未 L2 却启用 rewrite**（配置或实现误开）→ **禁止**；对外可 400 `SESSION_REWRITE_DISABLED`（推荐）或启动/配置门禁失败。历史码 `SESSION_DISABLED` 保留兼容…」
- `prds/11-decisions/00-adr-index.md:1086`：「未 L2 却试图启用 rewrite / 或 `sessionRewriteEnabledDefault=true` 对终端生效 → **禁止**；可 400 `SESSION_REWRITE_DISABLED`（新码）或配置门禁拒绝启动。」

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「**启动/配置拒绝**」 | **析取支 A** | 「**或**」（`:365`） |
| 「ask rewrite 路径 **400 `SESSION_REWRITE_DISABLED`**」 | **析取支 B** | 「**或**」（`:365`）；API PRD 亦写「或」（`:271`） |
| 硬约束（「无 L2 → 禁止启用」） | **硬要求** | 「**禁止**」（`:271` / `:1086`）；任一支兑现即合规 |

**③ 源码实数**

- 支 B **已落**：`apps/api/src/routes/kb-settings.ts:107-118` —— `wantsRewriteDefaultOn(raw)`（`:49-58`，认 `sessionRewriteEnabledDefault` 或 `sessionRewrite.enabledDefault` ）→ `hasArchive(kbId)`（`:83-85` 默认 `evalRunRepo.hasQualifyingL2Archive`）→ 无归档 → `fail(c, BizCode.SESSION_REWRITE_DISABLED, 'session rewrite default stays off until a qualifying L2 archive exists', 400)`（`:110-115`）。
- 码存在：`packages/contracts/src/common/biz-code.ts:19` `SESSION_REWRITE_DISABLED`。
- 支 A **未做**：`apps/api/src/env.ts` 无「无 L2 却强制 true → 启动失败」检测（`env.ts:120-130` 只有 `SESSION_REWRITE_ENABLED` 默认 `false` 的解析）。

**④ 覆盖表口径（`00-ask.md` U8 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/routes/kb-settings.ts:111-115` 已 PATCH → 400 `SESSION_REWRITE_DISABLED`（`settings-http.test.ts:297` 已断言）；剩「无 L2 却强制 true → 启动失败」在 `apps/api/src/env.ts` 无检测 / 启动闸。禁止写成「待补测」」
- **结论句**：「PATCH → 400 `SESSION_REWRITE_DISABLED` 已断言」+「启动侧无检测」——**均成立**（本票亲核：源码行为在 `:110-115`，覆盖表写 `:111-115`，**差 1 行**，不影响结论；测试断言的行号本票核到 `settings-http.test.ts:299`（`it` 在 `:286`），覆盖表写 `:297`，**差 2 行**）。
- **转述句**：行号轻微漂移（`:111-115` vs 实际 `:110-115`；`settings-http.test.ts:297` vs 断言在 `:299`）——**结论无出入**。

**⑤ 现有测例**

- `apps/api/tests/kb/settings-http.test.ts`：`it('PATCH 含 sessionRewriteEnabledDefault → 400')`（`:286`，断言码在 `:299`）、`it('有合格 L2 归档仍不可写 rewrite 开关（本窗只读）')`（`:302`）。
- `packages/contracts/tests/kb/settings-contract.test.ts`：`it('rejects sessionRewriteEnabledDefault')`（`:46`）、`it('requires sessionRewrite locked off')`（`:128`）。
- `apps/api/tests/env/defaults.test.ts`：`it('default / omitted → false')`（`:51`）、`it('true parses successfully (dogfood)')`（`:61`）。
  → 钉住析取支 B（400 `SESSION_REWRITE_DISABLED`）；**无**测例钉启动侧拒绝。

**⑥ 离线可做性**

- **离线可做**（若裁为需加严）：在 `env.ts` / 启动加载器加「无合格 L2 却 `SESSION_REWRITE_ENABLED=true` → 拒绝启动」并配负向测例（属加严）。
- **须裁 / 须 L2 归档**：真 L2 合格判定需 live 归档（`hasQualifyingL2Archive` 依赖 `eval_runs`），端到端属人签。

---

## 5 · `J7c`（ask 分册）

**① PRD 原文（`:572`，逐字）**

> `| J7c | 未 L2 强制开 rewrite / 误开配置 | **拒绝**或 \`SESSION_REWRITE_DISABLED\`（见 U8） |`

**同义句**：同 U8（`prds/05-api/01-http-api-hono.md:271`、`prds/11-decisions/00-adr-index.md:1086`）；另 `prds/10-delivery/03-acceptance-scenarios.md:575`：「错误码表含 `SESSION_REWRITE_DISABLED`（及兼容 `SESSION_DISABLED`）」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「**拒绝**」 | **析取支 A** | 「**或**」（`:572`） |
| 「`SESSION_REWRITE_DISABLED`（见 U8）」 | **析取支 B** | 「**或**」（`:572`）；「（见 U8）」显式回指 |

**③ 源码实数**：与 U8 同（`routes/kb-settings.ts:110-115`；`biz-code.ts:19`）。

**④ 覆盖表口径（`00-ask.md` J7c 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定（同 U8）：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`packages/contracts/src/common/biz-code.ts` 有码、`apps/api/src/routes/kb-settings.ts:111-115` 已 400；剩「无 L2 却强制 true」在 `apps/api/src/env.ts` 无落点。禁止写成「待补测」」
- **结论句**：「有码、已 400」+「启动侧无落点」——**均成立**；行号同 U8（`:111-115` 差 1 行）。

**⑤ 现有测例**：同 U8（`biz-code.ts` 被 `settings-contract.test.ts` / `settings-http.test.ts` 覆盖）；无 J7c 专属 `it`。

**⑥ 离线可做性**：同 U8。

---

## 6 · `M8`（ingest 分册）

**① PRD 原文（`:208`，逐字）**

> `| M8 | infected 删除后 | RustFS **无残留**；**无**隔离区；审计含 hash + uploaderId + timestamp |`

**加强句（别的 PRD 文件）**：
- `prds/09-security/01-auth-acl-compliance.md:358`：「| infected 处置 | 2 | **立即删** RustFS 对象 + **审计**（hash/filename/kbId/uploaderId/scanResult/timestamp/engineVersion）；**无隔离区** |」（比剧本多出 filename/kbId/scanResult/engineVersion）。
- `prds/11-decisions/00-adr-index.md:666`（ADR-038 #4）：「**#4 infected = 删除 + 审计，无隔离区**：立即删 RustFS 对象 + 审计（hash、filename、kbId、uploaderId、scanResult、timestamp、engineVersion）。**不建**隔离区。」

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| RustFS「**无残留**」 | **硬要求** | 加粗「**无残留**」（`:208`） |
| 「**无**隔离区」 | **硬要求** | 加粗「**无**」（`:208`） |
| 「审计含 hash + uploaderId + timestamp」 | **硬要求**（三项并举，无「或」） | 并列「+」（`:208`） |

**③ 源码实数**

- 对象删除：`apps/worker/src/ingest/object-store.ts:79-95` `deleteObject()`（本地 `unlink` / S3 `DeleteObjectCommand`）；调用点 `apps/worker/src/ingest/pipeline.ts:308-318`（`mock_infected` 分支 → 删对象 → `status='failed'` / `errorCode='MALWARE'`）。
- 「无隔离区」：`git grep -ni "quarantine\|隔离" -- apps/worker/src apps/api/src` 本票未见隔离区路径（`docs` 与 ADR 只写「不建隔离区」）。
- **审计面（hash + uploaderId + timestamp）无落点**：worker 侧无审计写入；`uploaded_by` 已在 api 写入两处 —— `apps/api/src/routes/documents/index.ts:352`（`POST /documents/write` 路径 `markCompletePending` 传 `uploadedBy`）与 `apps/api/src/services/ingest-complete-pending.ts:309`。
  - **覆盖表转述与源码出入**：覆盖表写 `apps/api/src/routes/documents/index.ts:361` 写入 `uploaded_by`；**实际写入点是 `:352`**（`:361` 是 `status: 'uploaded'`，非 `uploadedBy`）。`git grep -n "uploaded_by\|uploadedBy" -- apps/api/src` 佐证（见 §0）。

**④ 覆盖表口径（`01-ingest.md` M8 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/worker/src/ingest/object-store.ts` 只有 `deleteObject`，「审计含 hash + uploaderId + timestamp」无落点；已过期项：`uploaded_by` 已在 `apps/api/src/routes/documents/index.ts:361` 与 `apps/api/src/services/ingest-complete-pending.ts:309` 写入。「对象已删」可离线断言。≠ 真杀毒。禁止写成「待补测」」
- **结论句**：「object-store 只有 `deleteObject`」「审计面无落点」「对象已删可离线断言」——**均成立**。
- **转述句**：`routes/documents/index.ts:361` —— **与源码不一致**（实际 `:352`）；`ingest-complete-pending.ts:309` **正确**。→ **转述锚点漂移（行号错、结论不受影响）**。

**⑤ 现有测例**

- `apps/worker/tests/ingest/scan-infected-effects.test.ts`：`it('scanning → failed/MALWARE：对象已删，无 manifest / 向量 / 正文写入')`（`:65`）、`it('对照：mock_clean 不删对象且入队 parse')`（`:88`）。
  → 钉住「对象已删 / 无 manifest / 无正文」那一半；**无**任何测例钉「审计含 hash + uploaderId + timestamp」（源码无该面）。

**⑥ 离线可做性**

- **只靠读源码 + 纯粹 + 补测例可落地**：「对象已删 / 无残留」（`deleteObject` 本地与 S3 同口径）与「无隔离区」。
- **须新增源码面（离线可做，属加严）**：审计面（hash + uploaderId + timestamp）——worker 侧当前无审计写入；若裁定要补，可离线加（不改冻结语义）。
- **必须真 RustFS / 真杀毒**：真对象存储删除验证、真扫描引擎（QUAL-2 未接）。

---

## 7 · `V5`（ingest 分册）

**① PRD 原文（`:380`，逐字）**

> `| V5 | admin reject | 不 scan；可重提 |`

**同义句（别的 PRD 文件）**：
- `prds/04-pipelines/01-offline-ingest.md:51`：「| 拒绝 | `rejected`；可改后重提 | 拒绝仍跑流水线 |」
- `prds/12-delivery-guides/02-产品说明.md:305`：「B -->|驳回| Z[rejected 可改后重提]」。
- `prds/05-api/01-http-api-hono.md:216`：「5. reject：`approval_status=rejected`；不入队。」（**未**提重提端点）。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「不 scan」 | **硬要求** | 陈述（`:380`）；离线 PRD「拒绝仍跑流水线」为其否定式 |
| 「**可重提**」 | **硬要求** | 陈述（`:380`）；离线 PRD「可改后重提」（`:51`） |

**③ 源码实数**

- 驳回：`apps/api/src/routes/documents/index.ts:484-523` `POST /documents/:docId/reject`（`pending`→`rejected`；`rejected` 幂等回 200；非 `pending` 返回 `RULE_VIOLATION`；含四眼禁自审）。
- scan 闸：`apps/api/src/routes/documents/index.ts:525-560` `POST /documents/:docId/scan`（`canEnqueueScan(approvalStatus)` 不过 → 403）。
- **无 `rejected → pending` 重提端点**：`git grep -n "resubmit\|重新提交\|re-submit"` 源码零命中（见 §0）；PRD **未定义**该端点路径（`prds/05-api/01-http-api-hono.md:216` 只写 reject 不入队）。

**④ 覆盖表口径（`01-ingest.md` V5 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/routes/documents/index.ts` 无 rejected→pending 重提端点（PRD 未定义该端点）；已测部分：reject 200 后 scan 403 且不入队。禁止写成「待补测」」
- **结论句**：「无 rejected→pending 重提端点」+「PRD 未定义该端点」——**成立**；「reject 200 后 scan 403 且不入队」**成立**（测例在 `reject-http.test.ts:105`）。
- **转述句**：与源码一致，无出入。

**⑤ 现有测例**

- `apps/api/tests/ingest/reject-http.test.ts`：`it('pending reject → 200 approvalStatus=rejected')`（`:85`）、`it('驳回后 POST scan → 403，且 enqueueIngest 不被调用')`（`:105`）。
  → 钉住「不 scan」；**无**任何测例钉「可重提」（源码无该能力）。

**⑥ 离线可做性**

- **离线可做**：「不 scan」已可断言（已有）。
- **须先定义端点 / 撞冻结语义**：重提端点 PRD 未定义路径；若要实现 `rejected → pending`，属**新增产品面**（须先回 PRD 裁口径或走 ADR），非「收紧或逐位等价」——本票不自决。

---

## 8 · `S1`（acl 分册）

**① PRD 原文（`:320`，逐字）**

> `| S1 pure read 进 admin | 用户 U 仅 KB-A \`read\` → 打开 admin → **403 或 302→web**（管理壳不可用） |`

**加强句（别的 PRD 文件）**：
- `prds/05-api/01-http-api-hono.md:54`：「| **admin 壳** | 无 `admin.shell` → **403**/302→web |」
- `prds/02-engineering/01-clhoria-template-alignment.md:100`：「admin 壳 | 拥有 **`admin.shell`** 权限码（ADR-051）；无码 403/302→web（**根中间件硬拦**，ADR-045）」；`:101`「pure read | **仅 `apps/web`**；访问 admin → 403/302→web…」。
- `prds/11-decisions/00-adr-index.md:957`（ADR-045）：「admin 根中间件/loader：`isPlatformAdmin || hasAnyMembershipRole(['write','admin'])`；否则 **403**（API）或 **302→web**（页面）。」
- `prds/09-security/01-auth-acl-compliance.md:259`：「12. 无 `admin.shell` 访问 admin → **403**/302」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 打开 admin →「**403**」 | **析取支 A** | 「**或**」（`:320`） |
| 「**302→web**」 | **析取支 B** | 「**或**」（`:320`） |
| 「（管理壳不可用）」 | **硬要求（括注）** | 括注陈述（`:320`） |

**③ 源码实数（无浏览器，按 RTL / 守卫行为取证）**

- `apps/admin/src/components/auth-guard.tsx:33-57`（挂 `app/(ops)/layout.tsx`）：无本地会话 → `router.replace('/login')`（`:35-38`）；有会话但 `!me.permissions.includes('admin.shell')` → `clearClientSession()` + `router.replace('/login')`（`:41-46`）；`fetchAuthMe` 抛错 → `clearClientSession()` + `router.replace('/login')`（`:52-55`）。
- **既非 403、也非 302→web**：这是**客户端会话壳**（`'use client'`），无服务端中间件 302 能力，也无 403 响应；实际结果是「清会话 + 客户端跳 `/login`」。
- `web_consumer` 模板码为空：`packages/admin-catalog/src/role-templates.ts:57-65`（`code:'web_consumer'` / `defaultCodes: []` / 注释「无 `admin.shell`」）。

**④ 覆盖表口径（`02-acl.md` S1 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/admin/src/components/auth-guard.tsx`（挂 `app/(ops)/layout.tsx`）实现清会话跳 `/login`，与 Then「403 或 302→web」不一致（`apps/admin/tests/shell/auth-guard.test.tsx`）。禁止写成「待补测」」
- **结论句**：「实现清会话跳 `/login`」——**成立**；「与 Then 不一致」为覆盖表的**判断句**（本身未逐字命中「403」或「302→web」两支）。
- **转述句**：括号「（挂 `app/(ops)/layout.tsx`）」——本票未逐字复核该挂载路径，标注为**待核**（不影响源代码行为结论）。

**⑤ 现有测例**

- `apps/admin/tests/shell/auth-guard.test.tsx`：`it('无本地会话 → /login')`（`:41`）、`it('无 admin.shell → 清会话并 /login')`（`:54`）、`it('有 admin.shell 渲染子树')`（`:79`）。
- `packages/admin-catalog/tests/acl/catalog-clip.test.ts`：`it('web_consumer 无 admin.shell')`（`:37`）。
  → 钉住「无码不可进壳（清会话 + /login）」这一近似支；**无**测例断言 403、也**无**断言 302→web。

**⑥ 离线可做性**

- **离线可做（RTL）**：可补「无 `admin.shell` → 不渲染子树 + 清会话 + `router.replace('/login')`」的断言（已有近邻）。
- **无浏览器 / 须裁**：403 或 302→web 的**服务端硬拦**属壳架构问题（现有壳为客户端会话，无服务端中间件 302）；`prds/02-engineering/01-clhoria-template-alignment.md:100` 与 ADR-045 `:957` 要求「根中间件硬拦」——是否落地属裁定，非本票可定。

---

## 9 · `S4`（acl 分册）

**① PRD 原文（`:323`，逐字）**

> `| S4 多 KB 进壳 | 用户 V：KB-A \`read\` + KB-B \`write\` → **可进 admin** |`

**加强 / 软化句（别的 PRD 文件）**：
- `prds/11-decisions/00-adr-index.md:963-964`（ADR-045 #3）：「**#3 多 KB 双层独立判定** —— **壳准入（用户级）**：跨 KB 聚合——任一 `write`/`admin` 即可进 admin。」
- `prds/11-decisions/00-adr-index.md:1344`（ADR-051）：「**修订 ADR-045 壳准入**：admin 壳 = 拥有 **`admin.shell`** 权限码。」；`:1354`「消费者无 `admin.shell` → 仅 web」。
- `prds/09-security/01-auth-acl-compliance.md:391`：「多 KB：write KB 可进壳，对 read-only KB 写仍 403」；`:124`「`admin.shell` | page | platform | 进入 admin」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「用户 V：KB-A `read` + KB-B `write`」 | **举例 / 前置**（用 KB 角色描述用户） | 陈述（`:323`）；ADR-045 `:963-964` 用「任一 write/admin」 |
| 「→ **可进 admin**」 | **硬要求**（单一） | 「**可进 admin**」（`:323`） |

**③ 源码实数**

- `apps/admin/src/components/auth-guard.tsx:41-46`：进壳**只认平台码** `me.permissions.includes('admin.shell')` —— 与「V 在哪个 KB 是 read / write」**无关**。
- 有效码**只来自全局角色**，`kb_members.role` 不参与运行时授权：`apps/api/src/auth/role-hydrate.ts:108-112`（`claimsAuthz()` → `effectiveCodes: defaultCodesForRoles(claimsRoles)`）与 `apps/api/src/auth/permissions/resolve.ts:22-23`（`resolveEffectiveCodes()` → `defaultCodesForRoles(input.roleCodes)`）；佐证同 `docs/testing/coverage/02-acl.md` S5 行裁定（ADR-051 / ADR-035「角色列降级为模板锚点」，见 `.scratch/kb-role-vs-code/issues/04-dec-role-gate-ruling.md`）。
- `admin.shell` **被打包进写能力模板**：`packages/admin-catalog/src/role-templates.ts:18-25`（`DOC_OPERATOR_CODES` 首项 `'admin.shell'`，`:19`；`KB_ADMIN_CODES` 展开前者，`:24`）；`web_consumer` 空码（`:57-65`）。
- → **两种读法分歧**（结论相反，供工单 02 先定读法再裁）：(a) 按**能力**读 —— 凡有写能力的模板都带壳码 → Then「可进 admin」**成立**；(b) 按**「按 KB 的成员角色驱动」**读 —— 有效码只来自全局角色、`kb_members.role` 不参与 → Then **不成立**。

**④ 覆盖表口径（`02-acl.md` S4 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/admin/src/components/auth-guard.tsx` 进壳只认平台码（`admin.shell`），「KB-A read + KB-B write → 可进壳」在现码模型下不成立（`packages/admin-catalog/tests/acl/catalog-clip.test.ts`）。禁止写成「待补测」」
- **结论句**：「进壳只认平台码（`admin.shell`）」+「『KB-A read + KB-B write → 可进壳』在现码模型下不成立」——**均成立**（与 `auth-guard.tsx:41-46` 逐位一致）。
- **转述句**：无出入。

**⑤ 现有测例**

- `apps/admin/tests/shell/auth-guard.test.tsx`：`it('有 admin.shell 渲染子树')`（`:79`）。
- `packages/admin-catalog/tests/acl/catalog-clip.test.ts`：`it('doc_operator 仅落地且有码：/documents')`（`:71`，隐含 doc_operator 有码）。
  → 钉住「有 `admin.shell` 可进壳」；**无**测例涉及「KB-A read + KB-B write」的 KB 角色前提（源码不以此为判据）。

**⑥ 离线可做性**

- **离线可做（RTL）**：可补「仅 KB 角色（无 `admin.shell`）→ 不进壳」的断言。
- **须裁 / 撞冻结语义**：Then 的 KB 角色前提与 ADR-051 `:1344`（壳准入 = `admin.shell` 码）冲突；ADR-045 `:963-964`（任一 write/admin）与 ADR-051 修订并存 —— 需工单 02 裁定，收口路径可能须 ADR。

---

## 10 · `Y6`（acl 分册）

**① PRD 原文（`:415`，逐字）**

> `| Y6 | 无 \`admin.shell\` 用户打开 admin | **403**/302→web |`

**加强句**：同 S1（`prds/05-api/01-http-api-hono.md:54`、`prds/02-engineering/01-clhoria-template-alignment.md:100`、`prds/11-decisions/00-adr-index.md:957`、`prds/09-security/01-auth-acl-compliance.md:259`）。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「**403**」 | **析取支 A** | 「/」（`:415`，等价「或」） |
| 「302→web」 | **析取支 B** | 「/」（`:415`） |

**③ 源码实数**：同 S1（`apps/admin/src/components/auth-guard.tsx:41-46`：无码 → `clearClientSession()` + `/login`）。

**④ 覆盖表口径（`02-acl.md` Y6 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定（同 S1）：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/admin/src/components/auth-guard.tsx` 无码清会话跳 `/login`，非 403、非 302→web（`apps/admin/tests/shell/auth-guard.test.tsx`）。禁止写成「待补测」」
- **结论句**：「无码清会话跳 `/login`，非 403、非 302→web」——**成立**。
- **转述句**：无出入。

**⑤ 现有测例**：同 S1（`auth-guard.test.tsx:54` `it('无 admin.shell → 清会话并 /login')`）。

**⑥ 离线可做性**：同 S1。

---

## 11 · `X4`（acl 分册）

**① PRD 原文（`:543`，逐字）**

> `| X4 | \`docTypes:["no_such_type"]\` | **400** |`

**加强 / 限定句（别的 PRD 文件）**：
- `prds/11-decisions/00-adr-index.md:1308`（ADR-050）：「非法：未知 `docTypes` 码（**相对该 KB 枚举**）→ **400** `VALIDATION_ERROR`。」
- `prds/11-decisions/00-adr-index.md:1279`：「`ask.scope.docTypes` | 本次 ask 可选类型过滤；省略/空数组 = **不**按类型收窄」；`:1292`「`scope` 省略 / `docTypes` 省略或 `[]` → **不加** `doc_type` 谓词」。
- `prds/12-delivery-guides/04-交付控制台.md:124`：「X4 依赖 KB 白名单非空」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| `docTypes:["no_such_type"]` → **400** | **硬要求**（单一） | 加粗「**400**」（`:543`）；ADR-050 `:1308` 同 |

**③ 源码实数**

- `apps/api/src/services/kb-settings.ts:273-288` `assertScopeDocTypesAllowed({ scopeDocTypes, kbDocTypes })`：
  `:278` `if (!params.kbDocTypes.length || !params.scopeDocTypes?.length) return { ok: true };` —— **KB 未配 `docTypes` 时对任意类型放行**（`kbDocTypes` 空 → 直接 `{ok:true}`）。
- 调用点：`apps/api/src/routes/ask.ts:282-285`（`docTypeGate = assertScopeDocTypesAllowed({ scopeDocTypes: parsed.data.scope?.docTypes, kbDocTypes })`）。
- 对照：`assertDocTypeAllowed`（另一函数，`services/kb-settings.ts:256-268`，用于 `PATCH /documents/:docId docType`，调用点 `routes/documents/index.ts:735`）在**空枚举**时对非空码返回 `{ok:false}`（`:262-267`）——**与 scope 闸行为相反**。

**④ 覆盖表口径（`02-acl.md` X4 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/routes/ask.ts`（`assertScopeDocTypesAllowed`：KB 未配 `docTypes` 时放行任意类型）与 Then「未知类型一律 400」不一致（`tests/ask/mode-doc-types-gate.test.ts` · `tests/kb/ask-mode-doc-types.test.ts`）。禁止写成「待补测」」
- **结论句**：「KB 未配 `docTypes` 时放行任意类型」——**成立**（`:278`）。
- **转述句**：把函数出处写成 `apps/api/src/routes/ask.ts` —— **不精确**：函数**定义**在 `apps/api/src/services/kb-settings.ts:273`，`routes/ask.ts` 只是调用点（`:282`）。→ **转述锚点不精确（结论成立）**。另「Then『未知类型一律 400』」是覆盖表对 Then 的**转述**（Then 原文只举 `no_such_type` 一例），与 ADR-050 `:1308` 的「相对该 KB 枚举」限定并存。

**⑤ 现有测例**

- `apps/api/tests/ask/mode-doc-types-gate.test.ts`：`it('scope.docTypes 不在 KB 允许列表 → 400')`（`:134`）。
- `apps/api/tests/kb/ask-mode-doc-types.test.ts`：`it('docTypes 读写对称：config 解析 + scope 子集闸')`（`:39`）—— 该测试 `:52` 断言 `assertScopeDocTypesAllowed({ scopeDocTypes:['x'], kbDocTypes:[] }).ok` 为 `true`，**钉住当前「KB 空则放行」行为**。
  → 现有测例钉住「KB 配了枚举时非成员码 → 400」；**未**覆盖「KB 未配枚举 + 未知码」。

**⑥ 离线可做性**

- **离线可做（属加严）**：把 `:278` 改成「KB 未配 `docTypes` 时也不放行未知类型」（或按 ADR-050 `:1308` 收窄语义），并配负向测例。
  - **风险点（留给 02 裁 + 03 落地）**：加严会打红 `ask-mode-doc-types.test.ts:52` 的既有断言；须逐条判「旧断言钉的是旧行为」还是「新行为错」，**不许**直接改断言让它变绿。
- **撞冻结语义面**：ADR-050 `:1308` 的「相对该 KB 枚举」限定 vs 剧本 X4「一律 400」是否同义，属口径裁定。

---

## 12 · `X5`（acl 分册）

**① PRD 原文（`:544`，逐字）**

> `| X5 | 单测：dense 与 ES filter 均含 \`doc_type∈hr\` | 对称；禁止一路全库一路过滤 |`

**加强句（别的 PRD 文件）**：
- `prds/04-pipelines/02-online-ask-langgraph.md:186`：「`scope.docTypes` 非空 → `doc_type IN docTypes`（OR）；**dense∥ES 对称**；`doc_type IS NULL` **不命中**」；`:212`「非空 | 仅 `doc_type ∈ 列表`；未分类不进；与 ACL 求交」。
- `prds/11-decisions/00-adr-index.md:1293`（ADR-050）：「`docTypes` 非空 → retrieve：`doc_type IN docTypes`（多选 = **OR**），且 **dense∥ES 对称**。」

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「dense 与 ES filter **均含** `doc_type∈hr`」 | **硬要求** | 「**均含**」（`:544`） |
| 「**对称**」 | **硬要求** | 「对称」（`:544`） |
| 「禁止一路全库一路过滤」 | **硬要求** | 「禁止」（`:544`） |

**③ 源码实数**

- **dense 侧受类型过滤**（但发生在**装载层**，非 dense 查询）：`apps/api/src/services/retrieve/corpus.ts:44-47`（`filterDocsForRetrieve` 内 `scope.docTypes` 逐条比对）→ `loadCorpusFromDb`（`:58-122`）只用通过过滤的 docIds 取 chunk / embedding；`services/retrieve/retrieve.ts:174-183` dense 打分只对 `corpus` 内的 chunk 进行。
- **ES sparse 查询期无 `doc_type` filter**：`apps/api/src/services/retrieve/es-sparse.ts` —— `git grep -n "doc_type\|docType" -- apps/api/src/services/retrieve` 对该文件**零命中**；`buildAclFilter`（`:192-216`）只加 `tenantId` + `kbId`（+ 部门 / 级别 / 名单），`searchSparseEs`（`:293-351`）`must: [{ match: { sparseText } }]`。
- **sparse 结果靠语料求交事后收窄**：`apps/api/src/services/retrieve/retrieve.ts:212-213` —— `sparseRanked = sparseRanked.filter((id) => byId.has(id))`（`byId` = docType 过滤后的 corpus）。故**类型过滤的净效果对称，但 ES 查询体本身不含 `doc_type`**。
- 类型过滤的另一切面：`retrieve.ts:144-155`（`typeScopeApplied` → `no_docs_in_scope`）。

**④ 覆盖表口径（`02-acl.md` X5 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/services/retrieve/es-sparse.ts` 查询期仅 `kbId` + match，未下 `doc_type` filter，与 `apps/api/src/services/retrieve/corpus.ts`（装载层先滤再 dense∥sparse）不对称（属 B8 ES 切片）。禁止写成「待补测」」
- **结论句**：「es-sparse 查询期仅 `kbId` + match，未下 `doc_type` filter」——**成立**；「corpus 装载层先滤再 dense∥sparse」——**成立**。
- **转述句**：「不对称」为覆盖表**判断句** —— 源码事实是「净效果对称（sparse 事后求交）」但「查询体形状不对称」。→ **转述偏严/表述不精确**（把「查询体形状」落成「不对称」）。

**⑤ 现有测例**

- `apps/api/tests/ask/ready-active-corpus.test.ts`：`it('scope.docTypes filters after dual gate')`（`:34`）、`it('empty scope.docTypes does not filter types')`（`:39`）、`it('missing docType never matches non-empty scope')`（`:44`）。
- `apps/api/tests/ask/es-sparse.test.ts`：`it('强制 tenantId + kbId（共享索引安全隔离）')`（`:36`）、`it('收窄生效时 _search 的 filter 是 部门组 + 级别组 两个独立元素')`（`:187`）等 —— **均未**断言 `doc_type` filter。
  → 钉住装载层类型过滤；**无**测例钉 ES 查询期 `doc_type`。

**⑥ 离线可做性**

- **只在「装载层 + 事后求交」口径下可离线断言**（现有行为）。
- **须真 ES（B8）/ 撞外部基建**：ES 查询期下 `doc_type` filter 的真值与 mapping，须真 ES 集群（`RETRIEVE_ES_MODE=mock` 只比对 chunkId 集合，`== 生产 ES` 不可主张）。

---

## 13 · `R9`（ops 分册）

**① PRD 原文（`:307`，逐字）**

> `| R9 指标三维 | ask 调用 \`plane=ask\`；入库 embed \`plane=ingest\`；purpose 可区分 |`

**加强句（别的 PRD 文件）**：
- `prds/07-models/01-model-gateway.md:291`：「**embed（ADR-044）**：… query embed **仅** retrieve 内调用，归 **`plane=ask`**；入库 embed 归 **`plane=ingest`**。」；`:309`「| `aux` | judge_aux、eval.run / online_sample | 失败不影响 ask |」。
- `prds/04-pipelines/01-offline-ingest.md:298`：「L1/入库 embed 归 **ingest** 平面…（ADR-044 / 剧本 R）」；`:312`「平面 | `contextualize` + 入库 `embed` ∈ **`plane=ingest`**（per-tenant）」。
- `prds/11-decisions/00-adr-index.md:908`：「P2 归属：rerank ∈ **ask**；`eval.run` / `eval.online_sample` / `judge_aux` ∈ **aux**；入库 L1 + embed ∈ **ingest**。」；`prds/04-pipelines/02-online-ask-langgraph.md:232`「**`ingest`** | 入库 L1 `contextualize` + 入库 embed 批等…」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「ask 调用 `plane=ask`」 | **硬要求** | 陈述（`:307`） |
| 「入库 embed `plane=ingest`」 | **硬要求** | 陈述（`:307`）；两处 PRD 加强 |
| 「purpose 可区分」 | **硬要求** | 陈述（`:307`） |

**③ 源码实数**

- api 侧 ask 平面：`apps/api/src/obs/metrics.ts`（`ASK_PLANE`；`recordRerank*` 带 `plane: ASK_PLANE`，`:167` / `:176`；`recordRateLimited(scope, plane='ask')`，`:180-182`）；`routes/ask.ts:347`（`plane:'ask'`）。
- api 侧 ingest 平面（**complete 路径**）：`apps/api/src/obs/metrics.ts:184-187` `recordIngestComplete` → `metricInc('ingest_complete_total', { plane: INGEST_PLANE, ... })`；`apps/api/src/services/ingest-complete-pending.ts:132/140/293/301`（`plane:'ingest'`）。
- **worker 入库 embed 链无任何打点**：`git grep -n "plane" -- apps/worker/src` 与 `git grep -n "metric\|plane" -- apps/worker/src` **零命中**（见 §0）；worker embed 阶段见 `apps/worker/src/ingest/pipeline.ts:732 case 'embed'`（无指标）。→ 即「入库 embed 归 `plane=ingest`」**在 worker 侧无落点**。
- 「purpose 可区分」：`apps/api/src/services/gateway/resolve.ts:6-12` `ChatPurpose`（generate / claim_split / judge / route / rewrite / other），`purposeModels` 依此打点（详见 P3）。

**④ 覆盖表口径（`03-ops.md` R9 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「ask/llm/rerank 带 `plane=ask`；complete 成功或限流带 `plane=ingest`。源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。worker 入库 embed 链无打点（`apps/worker/src/ingest/pipeline.ts`），`plane=ingest` 仅见于 api complete（`tests/obs/quota-planes.test.ts:290-308`）；无 embed TPM。禁止写成「待补测」」
- **结论句**：「worker 入库 embed 链无打点」+「`plane=ingest` 仅见于 api complete」——**均成立**；「无 embed TPM」**成立**（`env.ts` 无 `maxEmbedCalls`，见 `03-ops.md` R4 行）。
- **转述句**：与源码一致，无出入。

**⑤ 现有测例**

- `apps/api/tests/obs/quota-planes.test.ts`：`it('/metrics 快照含 plane=ask 与 plane=ingest；aux 只留常量不打点')`（`:290`）、`it('ingest RPM>0 触顶 complete → 429 RATE_LIMITED + plane=ingest，不 markComplete')`（`:223`）。
- `apps/api/tests/obs/metrics.test.ts`：`it('ask_total / llm_call / rerank 可聚合')`（`:23`）、`it('rerank node / fallback / fail 三维按端点聚合')`（`:81`）。
  → 钉住 api 侧 ask / ingest 平面标签；**无**测例钉 worker 入库 embed 的 `plane=ingest`（worker 无打点面）。

**⑥ 离线可做性**

- **离线可做**：api 侧标签已具备；worker 侧打点若裁定要补（须先在 worker 建指标面），属新增面，**不改冻结语义**。
- **须真 Redis / 真 TPM（撞外部基建）**：「入库 embed TPM / 队列反压」的真值须真 Redis / 真配额基建（`03-ops.md` R6 已记 `缺实现`）。

---

## 14 · `T6`（ops 分册）

**① PRD 原文（`:344`，逐字）**

> `| T6 配置绑定 | KB 快照 τ/门禁数字 **=** 已签字包；篡改快照 → 加载拒绝或不一致告警失败 |`

**加强句（别的 PRD 文件）**：
- `prds/08-quality/02-evaluation-and-gates.md:151`：「| 加载 | 运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载** | 运行时 τ 与签字包脱节 |」。
- `prds/00-product/01-vision-and-success.md:113`：「运行行时 τ/门禁数字须来自已签字包；与 `eval_runs` 关联；不一致 → **拒绝加载**」。
- `prds/11-decisions/00-adr-index.md` ADR-007（`TAU_CLAIM` 唯一源）—— 源码注释自陈 `apps/api/src/routes/kb-settings.ts:62-68`：「`tauClaim` 仍取 `TAU_CLAIM`（ADR-007 唯一源；改由签字包加载须先 ADR）」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「KB 快照 τ/门禁数字 **=** 已签字包」 | **硬要求** | 「**=**」（`:344`）；「仅来自已签字包」（`:151`） |
| 「篡改快照 → **加载拒绝**」 | **析取支 A** | 「**或**」（`:344`） |
| 「**或不一致告警失败**」 | **析取支 B** | 「**或**」（`:344`） |

**③ 源码实数**

- 只有**写侧 + CLI**：`apps/api/src/eval/adr046-snapshot.ts:265` `bindQualitySnapshotToEval()`（纯函数）、`:315` `writeBoundSnapshot()`（落盘 `<outDir>/l1-gate-snapshot.json`）。
- **全仓唯一消费者是 CLI**：`apps/api/src/scripts/run-l1-golden.ts:21/23/769/793`（import + 调用）—— `git grep -n "bindQualitySnapshotToEval\|writeBoundSnapshot"` 源码侧仅此一处（见 §0）。
- **无运行时读取 / 加载入口**：无任何运行时 happy path 从签字包读 τ/门禁并与运行时参数比对；运行时 `tauClaim` 仍取 `env.TAU_CLAIM`（`apps/api/src/routes/kb-settings.ts:69` `defaultQuality()` → `tauClaim: env.TAU_CLAIM`；且 `gatePackageId/effectiveAt` 由 `evalRunRepo.latestSignoffPackage` 派生）。
- 撞冻结语义：ADR-007「`TAU_CLAIM` 唯一源」—— 改由签字包加载须先 ADR（源码注释自陈）。

**④ 覆盖表口径（`03-ops.md` T6 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/eval/adr046-snapshot.ts:265,315`（`bindQualitySnapshotToEval` / `writeBoundSnapshot`）只有写侧 + CLI，全仓无运行时读取 / 加载入口；绑定身份稳定已测。禁止写成「待补测」」
- **结论句**：「只有写侧 + CLI，全仓无运行时读取 / 加载入口」——**成立**；行号 `:265` / `:315` **精确**（本票亲核一致）。
- **转述句**：无出入。

**⑤ 现有测例**

- `apps/api/tests/eval/adr046-snapshot.test.ts`：`it('绑定 live eval 身份；缺人签 + coverage=0 不标 PASS')`（`:183`）、`it('同一入口跑两次：绑定身份稳定，业务 PASS 仍为 false')`（`:194`）、`it('无 evalRunId 时用 report:kb:ranAt 绑定')`（`:215`）、`it('不传 gates → 门禁包 = pilot 默认、无加严标记、可逐项打印数字')`（`:223`）。
- `apps/api/tests/eval/stricter-than-pilot-bind.test.ts`。
  → 钉住写侧绑定身份稳定 / 加严判定；**无**测例钉「运行时加载拒绝」或「篡改不一致告警」（源码无该入口）。

**⑥ 离线可做性**

- **离线可做**：可补写侧纯函数断言（已有近邻）。
- **须 ADR（撞冻结语义）**：运行时从签字包加载 τ 与 §6.0 冲突 ADR-007「`TAU_CLAIM` 唯一源」（改须 ADR → 改 PRD → 升版）；本图只裁定归属并记债。

---

## 15 · `P3`（ops 分册）

**① PRD 原文（`:260`，逐字）**

> `| P3 | purpose | verify 路径 Gateway 仅 \`judge\`；抽样路径仅 \`judge_aux\`（单测） |`

**加强句（别的 PRD 文件）**：
- `prds/07-models/01-model-gateway.md:33`：「| 'judge_aux' // 仅在线抽样/体验维；不计 ask maxLLMCalls（ADR-042）」；`:234`「**按 purpose 分链** | generate 与 judge **不得共用一条无差别环**；**judge 与 judge_aux 亦不得共用或穿透**（ADR-042）」；`:238`「**judge_aux 链耗尽** | **跳过**该条抽样 + `judge_aux_fail`；**禁止**落入 `judge` 链」；`:332`「**judge 与 judge_aux 链可分离**；`judge_aux` 耗尽 **不** 调 `judge`（ADR-042）」。
- `prds/11-decisions/00-adr-index.md:796`（ADR-042）：「`fallbackChains.judge_aux` **独立**；链耗尽 → 跳过该条抽样 + `judge_aux_fail`；**禁止**落入 `fallbackChains.judge`」；`:806`「`judge` ↔ `judge_aux` purpose 隔离 **永久**」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「verify 路径 Gateway **仅** `judge`」 | **硬要求** | 「**仅**」（`:260`） |
| 「抽样路径**仅** `judge_aux`（单测）」 | **硬要求**（前提是存在抽样路径） | 「**仅**」（`:260`）；「（单测）」标形态 |

**③ 源码实数**

- **`BindingPurpose`（绑定侧）含 `judge_aux`**：`packages/contracts/src/system/model-gateway.contract.ts:34-42`（`'generate','claim_split','judge','judge_aux','embed','rerank','route','rewrite'`）。
- **`ChatPurpose`（调用侧）不含 `judge_aux`**：`apps/api/src/services/gateway/resolve.ts:6-12`（`generate | claim_split | judge | route | rewrite | other`）；`resolve.ts:243` 只循环 `['claim_split','judge','route','rewrite']` 应用 purpose 模型。
- verify 走 `judge`：`apps/api/src/graph/run.ts:480-518`（`// --- verify (batch judge + min) ---`，`chat(..., 'judge', ...)`，`:486` / `:512`）。
- **全仓无 online_sample 抽样链**：`git grep -n "online_sample"` 源码零命中（见 §0）。
- `validatePlatformBindings` 只用 `judge_aux` 做「judge≠judge_aux」校验：`apps/api/src/services/model-gateway.ts:204-211`。

**④ 覆盖表口径（`03-ops.md` P3 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/services/gateway/resolve.ts` 的 `ChatPurpose` 无 `judge_aux`，全仓亦无 online_sample 抽样链；verify 走 `judge` 有图测（`tests/ask/verify-required.test.ts`）。禁止写成「待补测」」
- **结论句**：「`ChatPurpose` 无 `judge_aux`」+「全仓无 online_sample 抽样链」+「verify 走 `judge` 有图测」——**均成立**。
- **转述句**：无出入；未把 `BindingPurpose` 含 `judge_aux` 说成「调用侧已具备」（与工单 06 纪律一致）。

**⑤ 现有测例**

- `apps/api/tests/ask/verify-required.test.ts`：`it('R9: in-kb happy path → answered verified（必经 verify）')`（`:20`）、`it('R9: claim_split parse fail → 未完整 verify 不得 answered')`（`:31`）、`it('R9: claim_split gateway error → claim_split_failed')`（`:49`）。
- `apps/api/tests/obs/metrics.test.ts`（仅 `purpose=judge` 计数）。
  → 钉住「verify 走 judge」那一半；**无**测例钉「抽样路径仅 `judge_aux`」（无抽样链可断）。

**⑥ 离线可做性**

- **离线可做**：verify 侧 purpose 断言（已有近邻）；若把 `judge_aux` 加进 `ChatPurpose` 并只做解析/隔离测例，属离线可做（须先有抽样链才有验收意义）。
- **须新增源码面 / 可能超本图**：抽样路径 `judge_aux`（online_sample 链）—— 现状源码无面；落地属新功能，可能超本图范围。

---

## 16 · `AC2`（ops 分册）

**① PRD 原文（`:479`，逐字）**

> `| AC2 | 模型表：llm + embedding + rerank 各至少一启用 | 可保存 |`

**别的 PRD 文件对照句（非本 Then 的加强，而是**不同**口径）**：
- `prds/05-api/01-http-api-hono.md:465`：「| 模型 | Provider body 含 `models[]`：`name`/`type`/`enabled`；type ∈ llm\|embedding\|rerank | **空 models 保存（至少一模型）** |」——**只**要求「Provider 至少有一个模型」，**未**要求「llm/embedding/rerank 三类各至少一」。
- 检索 `各至少|至少一` 在 `prds/`：无任何行要求「三类各至少一启用」。

**② Then 语义拆解**

| 子句 | 归类 | 依据 |
|---|---|---|
| 「模型表：llm + embedding + rerank 各至少一启用」 | **前置 / 举例**（描述输入态，非义务） | 陈述（`:479`） |
| 「**可保存**」 | **硬要求（字面唯一义务）** | 「可保存」（`:479`，非否定、非「必须三类齐」） |

**③ 源码实数**

- `apps/api/src/services/model-gateway.ts:176-211` `validatePlatformBindings(providers, bindings)` 只查：ref 存在（`:188-190`）、Provider/模型启用（`:191-192`）、类型匹配（`:193-198`）、`judge≠judge_aux`（`:204-211`）。
- **无「llm / embedding / rerank 各至少一」闸**：函数内无按 `ModelType` 聚合计数的逻辑（`git grep` 与函数体亲核）。

**④ 覆盖表口径（`03-ops.md` AC2 行，逐字）**

- 覆盖值：`部分测`
- 缺口列：「源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/services/model-gateway.ts:176-214`（`validatePlatformBindings`）无「缺 llm/embedding/rerank 任一类即拒 Provider」闸；Then 字面只要求「各至少一启用可保存」（已测）。禁止写成「待补测」」
- **结论句**：「无『缺任一类即拒』闸」——**成立**；「Then 字面只要求『各至少一启用可保存』（已测）」——覆盖表**自陈**是「字面」读法。
- **转述句**：覆盖表**自身**已指出「三类齐备」是加严读法；行号写 `:176-214`，实际函数结束于 `:211`（`:212-214` 是注释/函数间），**差 2-3 行**，不影响结论。→ 关键点：**This Then 的字面义务（「可保存」）与源码一致**；覆盖表按「必须三类齐」记成缺口，属**镜像偏严（over-claim）**。

**⑤ 现有测例**

- `apps/api/tests/gateway/bindings-http.test.ts`：`it('PUT 绑定：合法 ModelRef 200；embed 绑 llm 400；judge≡judge_aux 400')`（`:146`）—— 该例 POST Provider 时写入 llm×2 + embedding×1 + rerank×1（`:159-164`），并成功绑定 `generate`/`judge`/`judge_aux`/`embed`/`rerank` → 200（`:203-229`）。
  → 钉住字面 Then（三类模型可保存 + 可绑定）；**无**测例钉「三类各至少一」闸（源码不存在）。

**⑥ 离线可做性**

- **离线可做**：字面 Then（可保存）已具备且已测。
- **若裁为需加严（三类各至少一）**：可离线加闸 + 负向测例（属加严），但 PRD 无此硬要求（仅 `:465` 要求「至少一模型」），须先裁口径。

---

## 17 · 16 行 × 四类初步归类（**只归类，不裁定**）

> 分类义（按本票工单）：
> **甲** 源码缺实现（Then 是单一硬要求，源码缺）· **乙** 许可 / 析取已满足（措辞「可带 / 可为 / 或 / 建议」，源码满足任一支即合规；含「覆盖表按必须读许可/析取」的镜像偏严）· **丙** Then 引用了源码里不存在的面 · **丁** 须 ADR / 撞外部基建。

| # | 行 | 分册 | PRD 行号 | 初步归类 | 归类依据（一句话） |
|---|---|---|---|---|---|
| 1 | `D-拼句` | ask | `:83` | **丙** | 硬要求（不得 chitchat / 应 single）已满足；`route_source=rule_knowledge` 是源码不存在的取值，`route_post_block=true` 支事实不可达（撞 ADR-033 冻结枚举，兼 丁 味） |
| 2 | `H1` | ask | `:146` | **乙** | 「可带 `Retry-After`」为许可；429 + `RATE_LIMITED` 硬要求已满足；覆盖表按「必须」记 → 镜像偏严 |
| 3 | `H5e` | ask | `:154` | **丙** | Then 引用 debug / maintenance 档位；源码无该档位（`apps/api/src` 零命中） |
| 4 | `U8` | ask | `:365` | **乙** | 「启动拒绝**或** 400」为析取；源码满足支 B（400 `SESSION_REWRITE_DISABLED`） |
| 5 | `J7c` | ask | `:572` | **乙** | 同 U8（「拒绝**或** `SESSION_REWRITE_DISABLED`」） |
| 6 | `M8` | ingest | `:208` | **甲** | 「审计含 hash + uploaderId + timestamp」是硬要求，源码无落点（对象已删那一半已满足） |
| 7 | `V5` | ingest | `:380` | **甲** | 「可重提」硬要求，源码无端点（且 PRD 未定义端点） |
| 8 | `S1` | acl | `:320` | **乙** | 「403 **或** 302→web」为析取；但源码未逐字命中两支（清会话 + `/login`），结论落在括注「壳不可用」——本行是乙/丁边界（加强句 ADR-045 `:957` 要求根中间件 403/302） |
| 9 | `S4` | acl | `:323` | **丙** | Then 用「KB read / write 角色」作壳准入，源码壳准入只认平台码 `admin.shell` → 引用了现码模型不存在的判定面（兼 丁 味：ADR-045 `:963-964` vs ADR-051 `:1344`） |
| 10 | `Y6` | acl | `:415` | **乙** | 同 S1（「403/302→web」析取） |
| 11 | `X4` | acl | `:543` | **甲** | 「未知类型 → 400」单一硬要求；源码在 KB 未配 `docTypes` 时放行任意类型（`kb-settings.ts:278`） |
| 12 | `X5` | acl | `:544` | **丁** | 源码缺「ES 查询期 `doc_type` filter」；阻塞方 = 真 ES（B8）（兼具 甲 味） |
| 13 | `R9` | ops | `:307` | **甲** | 「入库 embed `plane=ingest`」硬要求，worker 侧无任何打点 |
| 14 | `T6` | ops | `:344` | **丁** | 无运行时读取 / 加载入口；落实撞 ADR-007「`TAU_CLAIM` 唯一源」须 ADR |
| 15 | `P3` | ops | `:260` | **丙** | verify 侧有图测；「抽样路径仅 `judge_aux`」引用了源码不存在的面（调用侧 `ChatPurpose` 无 `judge_aux` + 无 online_sample 链） |
| 16 | `AC2` | ops | `:479` | **乙** | Then 字面只要求「可保存」（已满足）；「三类各至少一」是覆盖表加严读法 → 镜像偏严 |

**分布**：甲 **4**（`M8` `V5` `X4` `R9`）· 乙 **6**（`H1` `U8` `J7c` `S1` `Y6` `AC2`）· 丙 **4**（`D-拼句` `H5e` `S4` `P3`）· 丁 **2**（`X5` `T6`）。合计 **16**。

**标注为乙/丁或甲/丙边界的三行**（`S1` · `S4` · `X5`）已在上表括注，供工单 02 裁定参考——本票只归类，不裁定归属。

---

## 18 · 与覆盖表转述有出入的三处（本票亲核捕获）

1. **`M8`（`01-ingest.md`）**：覆盖表写 `apps/api/src/routes/documents/index.ts:361` 写入 `uploaded_by`；**实际写入点是 `:352`**（`:361` 为 `status: 'uploaded'`）。`ingest-complete-pending.ts:309` 正确。
2. **`X4`（`02-acl.md`）**：覆盖表把 `assertScopeDocTypesAllowed` 的出处写成 `apps/api/src/routes/ask.ts`；**函数定义在 `apps/api/src/services/kb-settings.ts:273`**，`routes/ask.ts:282` 只是调用点。
3. **行号轻微漂移（结论不受影响）**：`U8` / `J7c` 写 `kb-settings.ts:111-115`（实际响应块 `:110-115`）、`settings-http.test.ts:297`（断言在 `:299`）；`AC2` 写 `model-gateway.ts:176-214`（函数止于 `:211`）；`D-拼句` 写 `route-rules.ts:32-77`（区间可用，但未说清「不可达的是机制、非 Then 硬要求」）。
