# K5 事实核查 · 非成员 `platform_admin` 读 trace / 审计「无该 KB evidence 明文」

> 本文件仅做只读核查与记录，**未**修改任何源码 / 测试 / 配置，**未** `git commit`。
> 规则：所有断言均指到 `路径:行号`；搜不到的写「未找到，已搜关键词：…」。不推测。

## 已读文件清单

**PRD（`prds/`）**

- `prds/10-delivery/03-acceptance-scenarios.md`（剧本 K / I）
- `prds/10-delivery/01-phased-roadmap.md`
- `prds/11-decisions/00-adr-index.md`（ADR-035 / 037 / 042 / 049 / 051 / 056）
- `prds/09-security/01-auth-acl-compliance.md`
- `prds/08-quality/01-verification-and-abstention.md`
- `prds/08-quality/02-evaluation-and-gates.md`
- `prds/08-quality/03-langfuse-observability.md`
- `prds/05-api/01-http-api-hono.md`
- `prds/03-data/01-postgresql-schema.md`
- `prds/03-data/02-mongodb-bodies.md`
- `prds/03-data/03-elasticsearch-bm25.md`
- `prds/01-architecture/03-storage-boundaries.md`
- `prds/12-delivery-guides/04-交付控制台.md`
- `prds/README.md`（版本日志 0.4.11 / 0.4.8）

**源码（`apps/api`、`packages`）**

- `apps/api/src/routes/ask.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/dashboard.ts`
- `apps/api/src/routes/sessions.ts`
- `apps/api/src/auth/middleware.ts`
- `apps/api/src/auth/permissions/resolve.ts`
- `apps/api/src/app.ts`
- `apps/api/src/env.ts`
- `apps/api/src/logger.ts`
- `apps/api/src/obs/ask-tracer.ts`
- `apps/api/src/obs/memory-tracer.ts`
- `apps/api/src/obs/metrics.ts`
- `apps/api/src/obs/index.ts`
- `apps/api/src/middleware/admin-write-audit.ts`
- `apps/api/src/services/ask/traces.ts`
- `apps/api/src/services/ask/execute.ts`
- `apps/api/src/services/sessions.ts`
- `apps/api/src/graph/run.ts`
- `apps/api/src/graph/tracer.ts`
- `packages/admin-catalog/src/role-templates.ts`
- `packages/contracts/src/ask/ask.contract.ts`
- `packages/db/src/schema/system/users.ts`

**测试（`apps/api/tests`）**

- `apps/api/tests/ask/http-audit.test.ts`
- `apps/api/tests/ask/final-replay.test.ts`
- `apps/api/tests/acl/kb-member-gate.test.ts`
- `apps/api/tests/acl/permission-resolve.test.ts`
- `apps/api/tests/obs/tracer.test.ts`

**现状镜像 / 覆盖**

- `docs/module-status/api.md`
- `docs/module-status/worker.md`
- `docs/testing/coverage/00-ask.md`
- `docs/testing/coverage/02-acl.md`
- `docs/testing/coverage/03-ops.md`

**上下文（`.scratch` / `.trellis`）**

- `.scratch/close-p2-exit-gaps/issues/08-qual-k5-langfuse-acl.md`
- `.scratch/close-p2-exit-gaps/issues/18-dec-k5-trace-acl.md`
- `.trellis/spec/admin/frontend/quality-guidelines.md`

**路径更正**：工单 18 与任务描述写的 `apps/api/tests/audit/http-audit.test.ts` **不存在**（`apps/api/tests` 下无 `audit/` 目录）。真实路径为 `apps/api/tests/ask/http-audit.test.ts`（见 `docs/module-status/api.md:206`、`docs/testing/coverage/00-ask.md`）。

---

## 一、PRD 原文

### 1.1 剧本 K5（逐字 + 行号）

`prds/10-delivery/03-acceptance-scenarios.md`

| 行号 | 原文 |
|------|------|
| 163 | `## 剧本 K · 单一真相与消毒边界（P2 必过 · ADR-037）` |
| 167 | `\| K1 含工号/手机的**已授权**制度片段 ask \| answered 时 citation 可回溯；**无** retrieve 后改写 \|` |
| 168 | `\| K2 非成员 ask \| **403**（脱敏不替代权限） \|` |
| 170 | `\| K4 单一真相 \| generate 输入、verify 输入、citation 文本、Mongo body **逐字一致**（当轮切片） \|` |
| **171** | **`\| K5 侧信道 \| `platform_admin` **非** kb_member 查 Langfuse/审计 → **无** 该 KB evidence 明文 \|`** |
| 175 | `**通过**：K1–K6 试点必签；K7 随 PII 策略启用时签。` |
| 552 | `## 剧本 I · 观测边界（Phase 4 建议；不挡 P2）` |
| 560 | `\| I5 \| 非成员 platform_admin 打开该 KB trace \| **无** evidence 明文（与 K5 同纪律，可合并测） \|` |

> K5 的措辞对象是 **「Langfuse / 审计」** 与 **「trace」**（I5），不是「ask 回读端点」。这一点在第 4 节细判。

### 1.2 ADR-037「观测服从成员」冻结条款（最关键）

`prds/11-decisions/00-adr-index.md`

| 行号 | 原文 |
|------|------|
| 576 | `### ADR-037 · 主路径禁止 retrieve 后脱敏 + 单一真相 + 观测服从成员边界` |
| **589** | `- **观测服从 ADR-035 成员边界**：非该 KB 成员（含非成员 \`platform_admin\`）**不可**见该 KB evidence/问句明文（截断/哈希到不可逆，或 trace 级 ACL = \`kb_members\` read+）。敏感 KB：Langfuse **仅 self-host**，且查看权 = 成员。` |
| 1342 | `- **修订 ADR-035**：废止「\`platform_admin\` 不隐式全权」——产品 **超级管理员 = 显式全权**（全权限码 + 全 KB 内容/平台操作）。`（ADR-051 修订关系） |
| 1345 | `- **不修改**：ADR-048 审批闸；信任脊骨；037 脱敏；pure read 仅 web；…`（ADR-051 明示 **不改** ADR-037 脱敏） |

### 1.3 09-security §5「审计与观测明文边界」（直接口径）

`prds/09-security/01-auth-acl-compliance.md`

| 行号 | 原文 |
|------|------|
| 8 | `\| **修订** \| **0.4.34**：权限术语统一（\`super_admin\` 显式全权 vs \`platform_admin\` 非超管内容边界，ADR-051/056）；… \|` |
| 324 | `## 5. 审计与观测明文边界（ADR-035 + ADR-037）` |
| 328 | `\| 记录 \| 谁、何时、requestId、问句（可明文或哈希，按 KB 敏感级）、status/reason、配置快照 id、下载/删除/ACL/成员变更、**break-glass** \|` |
| 329 | `\| evidence 快照 \| ask_traces 保留当轮引用片段预览，供审计（默认 90 天，可配）；**与 verify 同一文本** \|` |
| **331** | `\| **KB 内容明文可见** \| 仅 **该 KB \`kb_members\`（read+）** 或 \`super_admin\` 显式全权（审计）或安全会签临时授权；**非成员且非 \`super_admin\` 的平台账号不可见** evidence/问句明文（哈希/截断或拒绝） \|` |
| 332 | `\| 租户级运维元数据 \| \`platform_admin\` 可看状态/计数/错误码；**不含**语料明文 \|` |
| **335** | `> 修订：**内容明文**跟 \`kb_members\`（及 \`super_admin\` 显式全权），**平台元数据**跟 \`platform_admin\`；非超管平台账号不因 \`platform_admin\` 身份获得 KB 内容明文（ADR-051/056）。` |
| 344 | `\| 敏感 \| 仅 \`local_vllm\`；**禁止** Cloud Langfuse 明文（**仅 self-host**）；trace 查看 = \`kb_members\`（ADR-037） \|` |
| 254 | `\| 7 \| Phase 3：用户无 doc D 权限 → evidence/answer/Langfuse 明文均无 D 原文 \|`（验收用例） |
| 258 | `\| 11 \| 无 \`dashboard.view\` 调面板 API → **403**；授码后可 200（内容仍无 evidence 明文） \|` |

### 1.4 08-quality Langfuse PRD（§6 + 验收）

`prds/08-quality/03-langfuse-observability.md`

| 行号 | 原文 |
|------|------|
| 8 | `\| **修订** \| **0.4.34**：无实质变更（仅版本对齐）；… 0.4.11：trace 明文服从 \`kb_members\`（ADR-037） \|` |
| 22 | `\| Cloud \| 注意问句/文档出境 \|` |
| 37 | `关闭 \`LANGFUSE_ENABLED\` 时系统 **仍可 ask**（仅丢观测）。` |
| 56 | `2. retrieve 记录 chunkId + preview 截断，正文默认不上送全文。` |
| 141 | `## 6. 脱敏、采样与访问控制（ADR-037 · ADR-042）` |
| 145 | `\| 默认落库 \| question + chunkId + preview≤200（**与 evidence 同源，无后置 PII 抹除**） \|` |
| 146 | `\| 敏感 KB \| **仅 self-host**；completion 可只存 hash；**禁止** Cloud 明文 \|` |
| 148 | `\| **查看明文** \| 调用方须为该 KB **\`kb_members\`（read+）** 或安全会签；**非成员 platform_admin 不可见** evidence/问句明文 \|` |
| 149 | `\| **辅助 Judge 是 in-use 消费者（ADR-042 #4）** \| aux prompt 含 evidence/question → 与观测同纪律；… Cloud 明文 aux **禁止** \|` |
| 150 | `\| **查看 aux 上下文** \| 非该 KB 成员 **不可** 见 aux 评分所用的 evidence/question 明文（与 trace 同闸） \|` |
| 151 | `\| 实现选项 \| (1) UI/API 按成员过滤 trace；(2) 对非成员仅返回哈希/截断到不可逆 \|` |
| 152 | `\| 禁止 \| 用「日志脱敏」冒充「答案已脱敏」；retrieve 后改写再写入 generation 当原文；用 Cloud aux 绕过成员边界 \|` |
| 169 | `- [ ] 一次 ask 在 Langfuse 可见 span 树`（验收） |
| **173** | `- [ ] 非成员 platform_admin **不可**见 KB evidence 明文` |
| 172 | `- [ ] 敏感模式不落全文；仅 self-host` |

`prds/08-quality/01-verification-and-abstention.md:36-38`：`输入一致` / `**禁止** retrieve 后字段级脱敏改写` / `脱敏仅允许在入库时写入权威 body`。
`prds/08-quality/02-evaluation-and-gates.md:160`：L3 在线抽样数据源 = `生产 trace / 实时指标`。

### 1.5 05-api 相关冻结行

`prds/05-api/01-http-api-hono.md`

| 行号 | 原文 |
|------|------|
| 435 | `### 2.9 引用回溯（审计）` |
| 438 | `GET /api/v1/ask/:requestId` |
| **441** | `返回 ask_traces 摘要：**含当时 evidence 快照**（chunkId、docId、lifecycle、preview 截断），不依赖现网 chunk 是否仍存在。` |
| 464 | `\| 密钥 \| POST/PATCH 可带 \`apiKey\`；**GET 响应永不含明文**（\`hasApiKey\` + 掩码） \| 日志/trace 打 Key \|` |
| 613 | `\| \`GET /metrics\`（可选） \| **必须内网或鉴权** \| Prometheus 文本；**禁止** 公网裸奔 \|` |
| 614 | `\| \`GET /api/v1/admin/ops/dashboard\`（或等价聚合） \| **仅 \`platform_admin\`**（ADR-049） \| … \|` |
| **619** | `**数据面板纪律（ADR-049）**：响应 **禁止** 含 evidence/问句/chunk 正文；**禁止** 写配置/改门禁；只读。` |
| 652 | `- [ ] 日志/trace 含 requestId 上下文` |

### 1.6 03-data / 01-architecture 相关冻结行

`prds/03-data/01-postgresql-schema.md`

| 行号 | 原文 |
|------|------|
| 282 | `\| tenant_id / kb_id / user_id \| 归属；**仅本人或该 KB admin** 可读（platform_admin 无成员仍不可读会话内容） \|`（`ask_sessions`） |
| 292 | `\| raw_question / standalone_question \| 原问与 rewrite 后（审计；standalone 可截断） \|` |
| 296 | `\| **evidence_snapshot** \| JSON：当轮 **KB** chunkId/docId/lifecycle/preview[]，**审计权威**；**禁止**写入会话原文 \|` |

`prds/03-data/02-mongodb-bodies.md:77`：`**单一真相（ADR-037）**：generate ≡ verify ≡ citation ≡ Mongo \`text\`（当轮切片）。`
`prds/03-data/02-mongodb-bodies.md:90`：`\| 日志 \| 禁止完整 body 进普通日志；观测服从 ADR-037 \| 排障 dump 全文到公网 ELK \|`

`prds/01-architecture/03-storage-boundaries.md`

| 行号 | 原文 |
|------|------|
| 21 | `\| **Langfuse** \| trace/score/dataset \| 观测与实验 \| 业务主数据 \|` |
| 98 | `> 说明：P2 **不**做应用层字段加密；ES BM25 倒排、Mongo body 在**应用语义**上为明文——保护的是**介质被盗**，不是 DBA 直连。见 ADR-040 威胁模型。` |
| 112 | `- at-rest **不替代** ACL / \`kb_members\`。` |
| 105 | `\| 访问 \| 与生产数据面同级（运维 + 审计） \|` |

### 1.7 映射表 #15 / #32 与路线图

`prds/12-delivery-guides/04-交付控制台.md`

| 行号 | 原文 |
|------|------|
| 109 | `\| 7 \| 剧本 K（单一真相 / 观测服从成员） \| T \| **部分→缺口** QUAL-K5 \| K2 成员闸 ✅；K4 当轮 citation←evidence.text（Mongo 仍 B9）；K6 渲染消毒走测补；**K5 Langfuse 明文 ACL 未做** · 总 backlog §2.5.2 \|` |
| **117** | `\| 15 \| 非成员且非超管不可 ask；超管全权 \| T/W \| **已具备** \| 成员 403 + B4-W DB 角色 hydrate；超管 bypass 仍认 role code \|` |
| 134 | `\| 32 \| Langfuse 全链路 \| T \| **部分→缺口** QUAL-K5 \| memory span + \`LANGFUSE_ENABLED\` mock export；真 SDK/非成员明文 ACL 未接 · §2.5.2 \|` |

`prds/10-delivery/01-phased-roadmap.md:131`：`- 非成员且非超管不可 ask；**super_admin 可全权**（ADR-051）`
`prds/README.md:213`：`2026-08-01 · **0.4.11** 脱敏纪律：主路径禁 retrieve 后改写；入库成权威正文；观测/审计服从 kb_members；语料/用户消毒分管道；**ADR-037**；剧本 K`

---

## 二、出口清单（逐个判定「谁能读 / 现有什么闸 / 非成员 platform_admin 能否读到明文」）

### 2.1 `GET /api/v1/ask/:requestId`（**审计口** §2.9）

**定义与闸**

- 路由 `apps/api/src/routes/ask.ts:448`：`routes.get('/ask/:requestId', requireAuth(), async (c) => {`
- `requireAuth()` 定义 `apps/api/src/auth/middleware.ts:137-145`：**恒要求登录**（与 `AUTH_ENFORCE` 无关）；无 / 无效 Bearer → 401。
- 成员闸：`apps/api/src/routes/ask.ts:460-472` 调 `evaluateKbMember(c, trace.kbId, …)`；失败回 403 `FORBIDDEN`（非 401）。

**返回字段（明文体量）**

- DTO 映射 `apps/api/src/services/ask/traces.ts:116-141` `toAskAudit()`：`requestId / kbId / status / reason / mode? / latencyMs? / sessionId / evidenceSnapshot[{chunkId, docId, lifecycle?, preview?, title?}] / graphTrace`。
- `preview` 经 `clipEvidencePreview`（`traces.ts:93-98`）截断到 `EVIDENCE_SNAPSHOT_PREVIEW_MAX = 200`（`packages/contracts/src/ask/ask.contract.ts:110`）。
- **不含** `answer` / `rawQuestion` / `text` / `body`（注释 `traces.ts:112-115`：`不含 answer / rawQuestion / userId，也不得带 text/body`；测试 `apps/api/tests/ask/http-audit.test.ts:110-111` 断言 `answer` 为 `undefined`）。
- **evidence preview 明文来源**：`ask_traces.evidence_snapshot`（`prds/03-data/01-postgresql-schema.md:296`），写入于 `apps/api/src/services/ask/execute.ts:255-262`，由 `toEvidenceSnapshot(graph)` 生成 —— 即 **当轮 evidence.text 的前缀**（`apps/api/src/services/ask/execute.ts:61-65`：`preview: e.preview ?? e.text?.slice(0, 200)`）。**这就是「evidence 明文（截断 200 字）」的实体**。

**旁路**

- `apps/api/src/auth/middleware.ts:239-242`：`if (roleBypassesKbMembership(auth.roles)) { return { ok: true }; }`
- `apps/api/src/auth/permissions/resolve.ts:60` 再导出 `roleBypassesKbMembership`；定义在 `packages/admin-catalog/src/role-templates.ts:81-83`。
- 仅 **`super_admin`** 模板 `bypassKbMembership: true`（`packages/admin-catalog/src/role-templates.ts:13` 注释「仅 super_admin」、`:40-45`）；`kb_admin / doc_operator / web_consumer` 均 `false`（`:46-64`）。
- 即：**没有** `platform_admin` 这个「角色码」；旁路只认角色码 `super_admin`。

**判定**：非成员、且**角色码不是 `super_admin`** 的账号（含 `users.platform_role = 'platform_admin'` 的非超管平台账号）→ **403，读不到 preview 明文**。成员 → 读到 preview（审计设计如此）。`super_admin` 非成员 → **200 且读到 preview 明文**（`apps/api/tests/ask/http-audit.test.ts:228-237` 是正向断言）。

### 2.2 `GET /api/v1/ask/:requestId/final`（**终态回读口**，非 §2.9 审计口）

- 路由 `apps/api/src/routes/ask.ts:480`；注释 `:477-479` 明示「≠ 审计口 §2.9 · 成员闸同审计口」。
- 成员闸：`apps/api/src/routes/ask.ts:490-505` 同 `evaluateKbMember`；无成员 → 403。
- 返回：`toAskFinal`（`apps/api/src/services/ask/traces.ts:172-216`）→ `ready=true` 时 `response: AskResponseSchema`，**含 `answer`（生成答案全文）**、`citations[{chunkId, docId, title, preview?}]`、`minSupport`、`reason`、`userMessage`。
- **`answer` 是生成答案，可能逐字包含 evidence 正文**；`citations[].preview` 来自当轮 evidence（`apps/api/src/graph/run.ts:411-418`）。
- 旁路同上（仅 `super_admin`）：`apps/api/tests/ask/final-replay.test.ts:258-268`（超管非成员 → `ready=true`）。

**判定**：非成员且非 `super_admin` → 403；成员 → 读到 answer 与 citation preview；`super_admin` 非成员 → 200 读到 answer（生成答案明文）。

### 2.3 Langfuse 出口

**是否真 SDK**：**否，仅 mock**。

- 开关默认关：`apps/api/src/env.ts:149-153`（`LANGFUSE_ENABLED` `.default('false')`）；`apps/api/README.md:16`「`LANGFUSE_ENABLED=true` 时打 mock export 日志；真 SDK 后接」。
- 接线入口 `apps/api/src/obs/ask-tracer.ts:65-74`：`LANGFUSE_ENABLED` 为真时仅 `log.info({ langfuse: true, spans: [span 名], scores }, 'langfuse mock export (SDK 未接入；主链 span 已记)')` —— **无网络导出、无 SDK、无 Langfuse 项目/落库**。
- 进程内 memory tracer：`apps/api/src/obs/memory-tracer.ts:21` `const traces = new Map<string, TraceRecord>()`；开关 `OBS_MEMORY_TRACE` 默认 `true`（`apps/api/src/env.ts:160-163`）。

**span 里写了什么字段**

- span 名与属性（`apps/api/src/graph/run.ts`）：
  - `:201` `ask.session_load` `{ sessionId }`
  - `:219` `ask.rewrite`
  - `:271` `ask.route` `{ questionLen: state.question.length }`（**只有长度，无问句**）
  - `:296` `ask.retrieve` `{ kbId }`，`:355` end `{ evidenceCount }`（**只有计数**）
  - `:364` `ask.generate`（无属性）
  - `:433` `ask.claim_split`
  - `:482` `ask.verify` `{ claimCount }`
  - `:285 / :555` `ask.finalize` `{ reason }`
  - retrieve 失败仅 `{ reason }`（`:327`）
- trace metadata（`apps/api/src/obs/ask-tracer.ts:31-38`）：`tenantId / userId / kbId / sessionId / mode / requestId` —— **无 evidence / 问句文本**。
- **结论**：现有 span 与 metadata **不落 evidence 明文**；mock export 日志更是只打 span **名** 与 scores（`ask-tracer.ts:70-71`）。
- **无读取面**：`getTraceRecord` / `listTraceRecords`（`apps/api/src/obs/memory-tracer.ts:23/27`）经 `apps/api/src/obs/index.ts:47-48` 导出，但**全仓无任何 HTTP 路由引用**（仅测试 `apps/api/tests/obs/tracer.test.ts:13/39/82/371` 使用）。即今天**不存在**「读 trace」的 HTTP 出口。

**判定**：Langfuse 侧目前**无任何可被 `platform_admin` 读取的出口**（真 SDK 未接、无 UI/API）。K5 的 Langfuse 明文闸**无处可加**，属「缺实现」——与 `docs/testing/coverage/00-ask.md:72`（`Langfuse 默认关；无非成员读 trace 的明文 ACL`）、`docs/module-status/api.md:157`（`审计管理台 无搜索 / 过滤 / 导出；Langfuse 仍 mock 日志`）、`:188`（`观测未接真实 Langfuse`）、`prds/12-delivery-guides/04-交付控制台.md:134` 一致。

### 2.4 Pino 结构化日志

- logger：`apps/api/src/logger.ts:9-19`；child 上下文仅 `requestId / tenantId / userId / kbId / sessionId`（`:20-31`）——**无问句 / answer / evidence 字段位**。
- 全仓 `log.*` 调用点（grep `apps/api/src`）共 16 处，逐条核对**均不含** evidence / 问句 / answer 正文：
  - `app.ts:72/74`（ready checks）、`routes/ask.ts:165/173/182`（幂等键）、`:347`（限流）、`:412`（stream done，字段 `status/reason/latencyMs`）、`:417`（err）、`services/ask/execute.ts:278`（save failed err）、`:282-289`（字段 `status/reason/latencyMs/spanCount`）、`obs/plane-quota.ts:65`、`middleware/on-error.ts:52/60/64`、`obs/ask-tracer.ts:67`（span 名 + scores）。
- Gateway：`apps/api/src/services/gateway/*` 无 `logger` 调用（grep `services/gateway` 仅命中请求体拼装与字段定义，无日志）。
- 但注意 `routes/ask.ts:519-521` 的 `log.info({ status, reason, latencyMs }, 'ask done')` 亦不含正文。

**判定**：现有 Pino 出口**不落 evidence / 问句 / answer 明文**（符合 `prds/03-data/02-mongodb-bodies.md:90`）。`/metrics` 与 `admin_write` 亦见下。无鉴权即可读日志的口子**不存在**（日志不出进程，除非运维接采集器 —— 属部署面，非本节仓储面）。

### 2.5 `GET /metrics`

- 装配 `apps/api/src/app.ts:79-80`：注释「**指标骨架快照（P2 无鉴权；生产可前置网关保护）**」，`app.get('/metrics', (c) => c.json({ service: 'api', metrics: metricsSnapshot() }, 200))` —— **无鉴权**。
- 快照 `apps/api/src/obs/metrics.ts:49-51` `metricsSnapshot()` → `Record<string, number>`。
- 标签（label）集合来自 `metricInc` 调用：`status / reason / plane / ok / fallback / purpose / kind / provider / model / scope / result`（`metrics.ts:66-68/92-96/142-150/153/168/175/181/186`）——**全部是枚举/计数，无 evidence / 问句 / chunk 文本**。
- PRD 要求：`prds/05-api/01-http-api-hono.md:613`（必须内网或鉴权）；`prds/12-delivery-guides/04-交付控制台.md:133`（指标骨架已具备 + 证据）。现状债 `docs/module-status/api.md:189`（`/metrics 无鉴权`）。

**判定**：`/metrics` **无鉴权**（任何登录态/未登录均可读），但**不含 evidence 明文**（无明文标签）。K5 的「无明文」在此出口**天然成立**；它的闸问题属 `prds/10-delivery/03-acceptance-scenarios.md:556`（剧本 I1）而**非** K5。

### 2.6 admin 审计面 / 会话面 / 数据面板

- **管理写操作日志** `apps/api/src/middleware/admin-write-audit.ts`：`buildAdminWritePayload`（`:50-63`）字段仅 `event / method / path / status / durationMs`，注释 `:50`「**不含 body / 密钥**」；打点 `:91` 仅带 `requestId/userId/tenantId/kbId`。**无明文**。
- **数据面板** `apps/api/src/routes/dashboard.ts`：`GET /admin/dashboard/summary`（`:27`）与 `/tracks`（`:34`），走 `requirePermission('dashboard.view')`（`:25`，超管模板全码默认拥有）。返回 `DashboardSummarySchema`（计数）/ `DashboardTracksSchema`（L1 账本 + 24h 延迟），**无 evidence/问句正文**（`prds/05-api/01-http-api-hono.md:619`）。
- **会话详情** `apps/api/src/routes/sessions.ts:91-113`：`GET …/sessions/:sessionId` 走 `requireKbMember`（`:94`），再 `repo.getOwned({ sessionId, kbId, userId: auth.userId })`（`apps/api/src/services/sessions.ts:120-140`）。`listMessages` 也按 `userId` 过滤（`:143-162`），返回 `content = rawQuestion` 与 `content = answer`（`:170/174`）。
  - **即 `super_admin` 非成员虽旁路成员闸，但 `getOwned` 按 `userId` 归属过滤 → 非本人线程 404**；与 `prds/03-data/01-postgresql-schema.md:282`（`仅本人或该 KB admin 可读（platform_admin 无成员仍不可读会话内容）`）方向一致，但**源码只实现「本人」**，未见「该 KB admin 可读他人会话」的路径。

**判定**：admin 审计面**不落明文**；会话面**按 userId 归属加闸**（比成员闸更严），非成员 `platform_admin` 读不到他人会话正文。

### 2.7 module-status 现状描述

- `docs/module-status/api.md:109`：`GET /api/v1/ask/:requestId`：`登录 + 该 trace 的 KB 成员（evaluateKbMember；超管旁路）回读当时 evidenceSnapshot（chunkId/docId/lifecycle/preview 截断）与 graphTrace；不返回 answer / rawQuestion / 正文 …`
- `docs/module-status/api.md:110`：`GET /api/v1/ask/:requestId/final`：`断线重拉该轮终态（成员闸同上）`。
- `docs/module-status/api.md:115`：`/metrics 端点无鉴权`。
- `docs/module-status/api.md:157`：`审计管理台 无搜索 / 过滤 / 导出；Langfuse 仍 mock 日志`。
- `docs/module-status/api.md:188`：`观测未接真实 Langfuse … LANGFUSE_ENABLED 默认 false`。
- `docs/module-status/worker.md:93`：`【安全债 · QUAL-2】真杀毒未接`（与 K5 无直接关联，仅列示 worker 无 trace 出口）。
- `docs/module-status/worker.md:66` 区段：worker 有 Pino 日志、无 metrics 出口；`docs/module-status/worker.md:82`「worker **无** metrics 出口」。

### 2.8 出口汇总

| 出口 | 路径 | 谁能读 | 现有闸 | 非成员 `platform_admin`（非 `super_admin`）能否读到该 KB 明文 |
|------|------|--------|--------|------------------------------------------------------------|
| 审计回溯 | `GET /ask/:requestId`（`routes/ask.ts:448`） | 登录 + 成员 / `super_admin` | `evaluateKbMember`（`:460`）+ `roleBypassesKbMembership` 仅 `super_admin`（`middleware.ts:240`） | **否**（403）；`super_admin` 非成员 → **是**（preview 明文） |
| 终态回读 | `GET /ask/:requestId/final`（`routes/ask.ts:480`） | 同上 | 同上（`:490`） | **否**（403）；`super_admin` 非成员 → **是**（answer 明文） |
| Langfuse SDK | — | — | 未接（`ask-tracer.ts:65-74` 仅日志） | **否**（无读取面） |
| memory tracer | 进程内 Map（`memory-tracer.ts:21`） | 无 HTTP 面 | 无路由引用 | **否** |
| Pino 日志 | `logger.ts` | 进程/运维采集 | 无正文字段位 | **否**（不落明文） |
| `/metrics` | `app.ts:80` | 任何人 | **无鉴权**（债） | **否**（无明文标签） |
| admin 写日志 | `admin-write-audit.ts:91` | 运维采集 | 无 body | **否** |
| 数据面板 | `routes/dashboard.ts:27/34` | `dashboard.view` | 权限码 + 超管模板 | **否**（只回计数） |
| 会话详情 | `routes/sessions.ts:91` | 成员 + userId 归属 | `requireKbMember` + `getOwned` | **否**（非本人 404） |

---

## 三、既有断言

### 3.1 把「超管可读 evidence preview」钉成正向断言的用例

文件真实路径：**`apps/api/tests/ask/http-audit.test.ts`**（非 `tests/audit/`）。

（a）**成员读 evidence preview 的正向断言**（`http-audit.test.ts:108-111`）：

```ts
    expect(body.data.evidenceSnapshot[0]?.chunkId).toBe(CHUNK);
    expect(body.data.evidenceSnapshot[0]?.preview).toBe('员工年假为15天');
    expect(body.data.graphTrace?.routeLabel).toBe('single');
    expect(body.data.answer).toBeUndefined();
```

（b）**超管非成员旁路读审计口**（`http-audit.test.ts:228-237`），逐字：

```ts
  it('超管可旁路成员闸回读', async () => {
    const { accessToken } = await token(['super_admin']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { requestId: string } };
    expect(body.data.requestId).toBe(REQ);
  });
```

> 注意：该用例只断言 `status === 200` 与 `requestId`，**没有**在超管分支再断言 `evidenceSnapshot[0].preview` 的值；但因为它走的是与成员同一返回路径（`toAskAudit`），200 即意味着读到同一份 preview。工单 18 描述的「把超管可读 evidence preview 钉成正向断言」在本文件里是 **200 状态**（隐含 preview），断言原文如上。

（c）**超管非成员旁路读终态口**（`apps/api/tests/ask/final-replay.test.ts:258-267`）：

```ts
  it('超管可旁路成员闸回读', async () => {
    const { accessToken } = await token(['super_admin']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ready: boolean } };
    expect(body.data.ready).toBe(true);
  });
```

### 3.2 其它相关既有测例（成员闸 / 超管旁路 / 脱敏）

| 用途 | 文件:行 | 断言要点 |
|------|---------|----------|
| 非成员 ask → 403 | `apps/api/tests/ask/http-audit.test.ts:200-209` | `status 403` + `error.code === 'FORBIDDEN'` |
| 非成员 final → 403 | `apps/api/tests/ask/final-replay.test.ts:233-242` | 同上 |
| 无 Bearer → 401 | `apps/api/tests/ask/http-audit.test.ts:222-226` | `status 401` |
| 超管旁路成员闸（探针） | `apps/api/tests/acl/kb-member-gate.test.ts:89-96` | `it('super_admin ask without membership → 200')` |
| 非成员（kb_admin）→ 403 membership | `apps/api/tests/acl/kb-member-gate.test.ts:106-118` | `message` 含 `not a knowledge base member` |
| 角色旁路单元 | `apps/api/tests/acl/permission-resolve.test.ts:56-57` | `it('super_admin bypasses kb membership')`，`canAccessKbScoped` 未传 `isKbMember` 也放行 |
| 审计 response 不带正文 | `apps/api/tests/ask/http-audit.test.ts:169-198` | `preview.length === EVIDENCE_SNAPSHOT_PREVIEW_MAX`；`text` / `body` 为 `undefined` |
| 审计 graphTrace 白名单 | `apps/api/tests/ask/http-audit.test.ts:141-167` | 只留 `routeLabel` / `llmCalls`，夹带的 `answer` 被剔除 |
| 契约层 preview 上限 | `packages/contracts/tests/ask/audit-contract.test.ts`（`ask.contract.ts:110`） | `EVIDENCE_SNAPSHOT_PREVIEW_MAX = 200`，超长 parse 失败 |
| memory tracer span 名 | `apps/api/tests/obs/tracer.test.ts:24-51` | span 名与 scores，**无明文断言面** |
| 超管跨部门读文档 | `apps/api/tests/acl/chunks-dept-filter.test.ts:162-168`、`documents-dept-filter.test.ts:175-181/352-358` | DEPT_ACL 开时超管 200（属部门 ACL，非 K5） |

**未找到**：任何「非成员 `platform_admin`（非 `super_admin`）读 trace / 审计 / Langfuse 被拒或脱敏」的测例。
已搜关键词：`platform_admin`、`非成员`、`trace`、`Langfuse`、`明文`、`脱敏`（范围 `apps/api/tests`、`apps/*/tests`）。与 `docs/testing/coverage/00-ask.md:72`「K5 … 缺实现」、`docs/testing/coverage/03-ops.md:175`「I5 … 延后 … 无 Langfuse/审计侧信道测」一致。

---

## 四、冲突判读依据

> 本节只给**事实与判读依据**，不给结论性裁定。

### 4.1 映射表 #15 原文与语境

`prds/12-delivery-guides/04-交付控制台.md:117`：
`| 15 | 非成员且非超管不可 ask；超管全权 | T/W | **已具备** | 成员 403 + B4-W DB 角色 hydrate；超管 bypass 仍认 role code |`

其 PRD 依据：`prds/10-delivery/01-phased-roadmap.md:131`（`非成员且非超管不可 ask；**super_admin 可全权**（ADR-051）`）、`prds/09-security/01-auth-acl-compliance.md:103`（`**超管显式全权** … 无需 kb_members`）、`:252`（验收 `5 · super_admin 非 kb_member ask / 管文档 → 200 允许`）。

### 4.2 「`platform_admin`」的两种含义（判读关键）

| 含义 | 出处 | 语义 |
|------|------|------|
| **A. 平台角色枚举值** `users.platform_role ∈ {platform_admin, user}` | `packages/db/src/schema/system/users.ts:16`；ADR-035 `prds/11-decisions/00-adr-index.md:495`（`platform_role 枚举（仅两值）：platform_admin \| user … P2 不出现 super_admin`） | 历史上 = **非**「超级管理员」的平台账号；ADR-035 明文「`platform_admin` 不隐式全权 … 非成员时不得走任何 KB 内容路径（含 ask）」（`:501`） |
| **B. 超管的平台角色标签** | 源码 `apps/api/src/routes/auth.ts:55`：`platformRole: role === 'super_admin' ? 'platform_admin' : 'user'`；`apps/api/src/services/superadmin-bootstrap.ts:178`：`platformRole: 'platform_admin'` | 源码把 **角色码 `super_admin`** 的账号在 `users.platform_role` 列写成 `'platform_admin'` |

ADR-051 之后的术语统一（`prds/09-security/01-auth-acl-compliance.md:8`）：`super_admin` = 显式全权（角色码），`platform_admin` = **非超管内容边界**（平台角色）。`prds/09-security/01-auth-acl-compliance.md:335` 一字一句：「**非超管平台账号不因 `platform_admin` 身份获得 KB 内容明文**」。

即：**PRD 冻结语义中，`platform_admin`（含「非成员」限定）与 `super_admin` 是互斥的两类**；`super_admin` 被 `:331` 显式列为「内容明文可见」的允许方。源码 `routes/auth.ts:55` 把超管的 `platform_role` 列写成 `platform_admin` 是**列值命名**，**不是**授权判定依据（授权判定走 `auth.roles` / `effectiveCodes`，见 `middleware.ts:199` 与 `auth/permissions/resolve.ts:10`）。

### 4.3 K5 覆盖的是 trace / 审计出口，还是也含 ask 回读端点

依据行：

1. K5 字面只写 **「查 Langfuse / 审计」**（`prds/10-delivery/03-acceptance-scenarios.md:171`）；I5 写 **「打开该 KB trace」**（`:560`）。
2. PRD 中「**审计**」这一出口有明确专名：`prds/05-api/01-http-api-hono.md:435` `### 2.9 引用回溯（审计）` → `:438` `GET /api/v1/ask/:requestId` → `:441` 返回 evidence 快照。即 **`GET /ask/:requestId` 就是 K5 所指的「审计口」**。
3. `GET /ask/:requestId/final` 的源码注释与 module-status 均**明示它 ≠ 审计口**：`apps/api/src/routes/ask.ts:477-479`（`≠ 审计口 §2.9 · 成员闸同审计口`）、`docs/module-status/api.md:155`（`审计口 GET /ask/:requestId 语义不变（仍不是 AskResponse 重放）`）。它是**断线重拉终态**口。
4. 09-security §5 的标题即 **「审计与观测明文边界」**（`:324`），其约束对象是「审计 / 观测（trace）出口」（`:328-332`）。
5. `prds/08-quality/03-langfuse-observability.md:148/150` 的「查看明文 / 查看 aux 上下文」限定语是 **trace / aux 观测**；`:151` 给了两个实现选项（UI/API 过滤 trace、或返回不可逆哈希）——**未**提及改动 ask 回读端点语义。

**判读**：K5 的「无明文」在 PRD 文本层**覆盖 trace / 审计出口**；`GET /ask/:requestId`（审计口）**属于**该范围；`GET /ask/:requestId/final`（终态回读）**不在** K5 文本范围内（它由 §2.7 铁律 5「断线重拉」定义，且被显式标注 ≠ 审计口）。

### 4.4 与 #15 是否真冲突

**依据行**：

- #15 的允许方是 **`super_admin`**（`prds/12-delivery-guides/04-交付控制台.md:117`；`prds/10-delivery/01-phased-roadmap.md:131`；`prds/09-security/01-auth-acl-compliance.md:252`）。
- K5 的约束对象是 **`platform_admin` 非 kb_member**（`prds/10-delivery/03-acceptance-scenarios.md:171`）。
- 09-security §5 把两者**显式并列区分**：`super_admin` = 可见明文（`:331`）；`platform_admin`（非超管）= 不可见明文（`:331`、`:332`、`:335`）。
- ADR-037 `:589` 明确写「非该 KB 成员（**含非成员 `platform_admin`**）不可见」——用词即 `platform_admin`，与 `super_admin` 分列。
- 源码判定层面：旁路只认角色码 `super_admin`（`packages/admin-catalog/src/role-templates.ts:40-45` + `auth/middleware.ts:240`）；`platform_admin` **不是角色码**，不会触发旁路。因此「非成员、非 `super_admin` 的平台账号」在 `/ask/:requestId` 与 `/final` 上**已经 403**。

**判读依据**：

- 若 K5 的 `platform_admin` 按 **PRD 冻结语义（= 非超管平台账号）** 理解 → K5 与 #15 **不冲突**：#15 说的是 `super_admin`（显式全权）走 ask/审计 200，#15 **未**主张「非超管平台账号可读明文」。两者在 09-security §5 被同时写清，互为补充。
- 若 K5 的 `platform_admin` 按 **源码 `platform_role` 列值（= 超管标签）** 理解 → 则与 #15 **表面冲突**：此时「非 kb_member 的 platform_admin」= 超管，而 #15/09-security §5 允许超管读明文。冲突的根因是 **词义**（列值 `platform_role` vs 角色码 `super_admin`），不是两条 PRD 条款本身矛盾。
- **事实层面**：源码**没有**任何「按 `users.platform_role` 判定读 trace/审计」的代码路径（已搜 `platform_admin` 全仓：命中 `routes/auth.ts:55`、`services/superadmin-bootstrap.ts:178` 两处**赋值**，无判定；判定全走 `auth.roles`）。故今天的实际行为是：**非成员、角色码非 `super_admin` → 一律 403**（与 PRD 一致）；**超管 → 200**（与 #15/09-security 一致）。
- **K5 的「缺实现」落点**：不在「已有出口的成员闸」（该闸已存在且正确），而在 **Langfuse 真实读取面尚未存在**（`prds/08-quality/03-langfuse-observability.md:148/151` 的「UI/API 按成员过滤 trace」实现选项 (1) 无载体；memory tracer 无 HTTP 面）；以及**若未来接真 Langfuse SDK**，需按 `:148/151` 加成员过滤 / 哈希。这与 `prds/12-delivery-guides/04-交付控制台.md:109/134`、`docs/testing/coverage/00-ask.md:72`、`docs/testing/coverage/03-ops.md:175` 的「未做/缺实现」描述一致。

### 4.5 判读依据行清单（汇总）

| 议题 | 依据行 |
|------|--------|
| K5 字面只覆盖 Langfuse / 审计 / trace | `prds/10-delivery/03-acceptance-scenarios.md:171`、`:560` |
| 「审计口」= `GET /ask/:requestId` | `prds/05-api/01-http-api-hono.md:435/438/441`；源码 `apps/api/src/routes/ask.ts:448` |
| `/final` ≠ 审计口 | `apps/api/src/routes/ask.ts:477-479`；`docs/module-status/api.md:155` |
| 成员闸存在 | `apps/api/src/routes/ask.ts:460`、`:490`；`apps/api/src/auth/middleware.ts:329-355` |
| 旁路仅 `super_admin` | `apps/api/src/auth/middleware.ts:240`；`packages/admin-catalog/src/role-templates.ts:13/40-45/81-83` |
| `platform_admin` = 非超管平台账号 | `prds/09-security/01-auth-acl-compliance.md:8/331/332/335`；`prds/11-decisions/00-adr-index.md:495/501` |
| `super_admin` = 显式全权（含内容明文） | `prds/09-security/01-auth-acl-compliance.md:103/252/331`；`prds/11-decisions/00-adr-index.md:1342`；`prds/10-delivery/01-phased-roadmap.md:131` |
| ADR-037 观测服从成员 | `prds/11-decisions/00-adr-index.md:576/589`；`prds/README.md:213` |
| Langfuse 明文闸实现选项 | `prds/08-quality/03-langfuse-observability.md:141/148/151/173` |
| evidence 明文出口与截断 | `prds/03-data/01-postgresql-schema.md:296`；`prds/05-api/01-http-api-hono.md:441`；`packages/contracts/src/ask/ask.contract.ts:110`；`apps/api/src/services/ask/traces.ts:93-98/116-141` |
| 数据面板禁明文 | `prds/05-api/01-http-api-hono.md:619`；`apps/api/src/routes/dashboard.ts:27/34` |
| `/metrics` 无鉴权但无明文标签 | `apps/api/src/app.ts:79-80`；`apps/api/src/obs/metrics.ts:49-51`；`docs/module-status/api.md:189` |
