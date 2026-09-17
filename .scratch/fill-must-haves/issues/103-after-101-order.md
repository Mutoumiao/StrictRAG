# 裁定真 L1 contextualize 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 101

## Question

本批三张（lint 清零 / 文档 ACL 端点 / 真 L1 contextualize）+ 债一张（admin 脆弱测例）已收官。本图往哪走。

已锁、不要重开：`prds/00–11` 不改；默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 默认开 rewrite / 真引擎选型 / 人签 / 准出全部锁死；P3a 等 L2 人签；LangGraph 另起路线；B8 / B9 / QUAL-2 不进本回合。

研究输入（本轮新写三份）：
- [research-idempotency-key.md](../research-idempotency-key.md) —— `Idempotency-Key`（铁律 6）条款、落点、TTL 三样已冻，零实现，可直接落码。
- [research-metrics-worker.md](../research-metrics-worker.md) —— worker metrics 出口取证：**不开端口**是正解，但查出 `prds/04` §5.2 点名入库报告必出的两个计数当前没落。
- [research-drizzle-meta-baseline.md](../research-drizzle-meta-baseline.md) —— 迁移工具链基线债取证。

## Answer

### 先修一条被误读的「出口」结论

`contextualize_l1_ok` / `contextualize_l0_fallback` 不是我上一张票的「装饰性日志字段」——`prds/04-pipelines/01-offline-ingest.md` §5.2 标题就是**「指标（入库报告必出）」**，正文四行逐字列出 `dedupe_doc_internal_dropped` / `dedupe_cross_doc_dropped` / `dedupe_cross_doc_rate` / `contextualize_l1_ok` / `contextualize_l0_fallback`；§9.1 另写「L1 触顶/失败 → L0 回退；块仍可索引；**指标 `contextualize_l0_fallback`**」。前两个去重计数与去重率已由工单 94/95 落库，**后两个 contextualize 计数没落**——只落了三态 `contextSource` 与 Pino 字段。这是本批第一张。

至于「worker 要不要开 metrics 端口」：**不开**。功能表两处把「**Worker 对外 HTTP**」写进禁止列（`:34`、`:206`）；`prds/10` §2 对 worker 观测的用词是「建议具备导出、实现可选」；功能表 `:352` 的 `/metrics` 条款在 api 章节。所以 worker 侧的「指标出口」在本仓的口径就是**结构化日志 + 落库报告**，不是 scrape 端点；将来若要 scrape 须先 ADR 解禁令。

### 本批串行三张

1. [问答 `Idempotency-Key` 最小闭环](./104-ask-idempotency-key.md) —— PRD 05-api §2.7 **契约铁律 6**（`prds/05-api/01-http-api-hono.md:423`）+ §1 写操作总则（`:21`）+ 04-pipelines §8 同义重述；落点与 TTL 也已冻（`ask:idem:{key}`，10m，`prds/03-data/04-rustfs-redis.md:96`）。**零实现**：同 key 重发现在会再跑一张图、再写一行同 `request_id` 的 trace、会话历史多一轮。S–M。
2. [入库报告补 contextualize 两计数](./105-ingest-report-contextualize-counts.md) —— `prds/04` §5.2「必经报告必出」，与已落的 `dedupe_cross_doc_rate` 同一张表同一节；工单 101 已产出计数，只差落库 + DTO + admin 展示。S。
3. [文档 ACL 收紧的索引一致性最小闭环](./106-acl-tighten-index-consistency.md) —— 功能表 §5.5 行「`aclPrincipals` 进索引；dense 与 ES 对称 filter；`[]` = 不可读；**收紧须 reindex**」（P3b）+ ADR-009 决策 4「ACL 收紧须 reindex 后确认（最终一致）」+ ES PRD §4.3 同义；`docs/testing/coverage/02-acl.md` 的 **B2-2 标「延后」，理由逐字写着「reindex-on-change 未做」**。M。

排序理由：第 1 张是本图**唯一**有「冻结契约铁律 + 冻结落点 + 零实现」三件套的缺口，边际收益最高；第 2 张是上一张票自己留下的半成品补齐（同一节同一表），不补就等于把「报告必出」读成「日志出过就算」；第 3 张与第 1 张无交集，但它是 P3b ACL 面最后一块可动手语义（端点已由工单 100 落），且必须**先写清它不是安全洞**才不会被人拿去当解锁强制项的理由。

三张都能在现有测例体系内钉死（注入 Redis 内存 store / 注入 fetchImpl / 落库断言），不需真 Redis 集群、真 ES、真 Gateway。

### 本轮明确不做 / 留雾

- **worker metrics HTTP 端口**：见上，**不开**（功能表两处禁止「Worker 对外 HTTP」；`docs/module-status/worker.md` 与 worker spec 已有「无 HTTP 端口」三处一致性表述）。要 scrape 须先 ADR，另起路线。
- **ACL 收紧自动入队 reindex**：**不做自动化**。本仓 `documents.index_version` 在 chunk 段就 `+1`，reindex 失败后它指向失败版本而上一个可检索版本的数据仍在（孤儿清理同一前置：缺「当前激活 version」表示）。在 ACL 元数据改动上自动触发会重跑 parse/chunk/embed 全链并可能把健康文档带进半套状态 —— 风险大于收益。本批只做**如实外显「需 reindex」+ 钉死「PG 闸即时、ES 路滞后、不构成泄漏」**并补负向夹具（顺手覆盖 B2-3 的 dense 单路构造）。
- **`allowedDocIds` 收紧路径**：**降为雾**。ADR-009 决策 3 的语义与 `acl_filter_too_large` 码确实已冻（05-api `:539`、04-pipelines §「状态字段语义」、ES PRD §4.4、glossary），但：① ES PRD §4.4 标题自标「（debug / 评测 / 迁移 · **可选**）」；② 客户端**禁传**（05-api §1 请求白名单只有 `stream`/`debug`/`mode`/`locale` + `scope.docTypes`）；③ 仓库现无 debug/评测/迁移任一路径会传它 —— 现在实现等于造一条**无生产者的半接线**（本图已多次拒绝回填 P2 半接线）。**准入条件写进地图**：先指名一个真实生产者（或书面判定为保留码），再开工。
- **成员 `allowedDocIds` 写面**：**不做，且原判据再确认**。05-api §2.2 逐字给的是 `PUT …/members/:userId # body: { role: read|write|admin }`；功能表 §5.2 成员行的「`null allowedDocIds` = 成员全库」说的是**取值语义**，不是「成员端点要能写它」。工单 19 的裁定与 `packages/contracts/tests/ask/contract.test.ts:113`（拒 `allowedDocIds`）保持不动。
- **admin 文档 ACL 编辑面**：功能表 §4.3 文档运营动作**没有**这一行（只有「部门与可见级别」），属推定必须具备；做它须先定「选人来源」（KB 成员 vs 平台用户，触权限面）→ 留雾。
- **`drizzle/meta` 基线**：仍留雾，但雾已变薄（见研究）。要动的前提是「生产是否已上线/已有真实数据」这一事实，本批不改工具链、不提交 generate 产出。
- **在线编写 BlockNote 完整体验 / `editor-draft`**：功能表 §5.2 有 `editor-draft` + `submit-approval` 行（P2.x 编辑器），§4.3 与 §13 把「BlockNote 完整体验」列进最终产品范围；但现仓 `POST …/documents/write` 是「即写即审」，加草稿态要定草稿落点（新表 vs `documents.status=draft` 语义冲突）与编辑器依赖（BlockNote 不在冻结技术栈表）→ 下批首选的**决定工单**。
- 仍锁：孤儿清理（待「激活 version」表示）· 签字包链（待数据来源）· L0 vs L1 Hit@k（待对照载体）· `pending_review`（三处未冻）· QUAL-G3（功能表无此行）· 真引擎 / 人签 / 默认开类。
- **admin 原生 `<select>` 站规清扫**：仍无浏览器验证手段 → 不进本批。

### 本批切边

- 第 1 张：**不加 env 开关**（只在带 header 时生效，不带 = 与今天逐位相同）；**不**改 `AskRequestSchema`（`.strict()`，键是请求头）；**不**用进程内 Map（多副本下违反硬性「不得」）；**不**做 SSE 真重连 attach、**不**改 web 客户端；**不**加起始标记进 `ask_traces`。
- 第 2 张：**不**新增指标口径（只落 §5.2 点名的两个计数）；**不**改 `contextSource` 三态语义；**不**碰 metrics 导出。
- 第 3 张：**不**自动入队 reindex、**不**开 `DEPT_ACL_ENFORCE`、**不**加角色 principal、**不**改 PG 闸判定函数、**不**改 ES filter 生成器语义。
- 三张都不改 `prds/00–11`；都不 `task.py create`；不 push。

## Comments

- 2026-09-17 本图第四轮裁定。研究侧本轮新写三份（idempotency / metrics-worker / drizzle-meta），前两份直接决定本批构成。
- Q1：为什么把 `Idempotency-Key` 提为本批首位 —— 它是本图唯一同时满足「已冻契约铁律 + 已冻存储落点与 TTL + 零实现」三件的缺口；其余候选至少缺一件。
- Q2：为什么 worker metrics 出口**不开端口** —— 功能表两处禁止列含「Worker 对外 HTTP」；`prds/10` 对 worker 观测只写「建议具备导出」。把「报告必出」的计数落进入库报告才是本仓口径下的正解，于是本批第 2 张取代了「建 metrics 出口」这一伪缺口。
- Q3：ACL 收紧**不做自动 reindex** —— 与孤儿清理同一前置（缺「激活/失败 version」表示），自动化会把健康文档带进半套状态；本批只做如实外显 + 无泄漏证明 + 负向夹具。
- Q4：`allowedDocIds` 由「下一批候选」下调为「留下批准入条件」——无生产者就实现，等于造假接线；本条沿用本图前几轮对「P2 半接线」的一贯处置。
