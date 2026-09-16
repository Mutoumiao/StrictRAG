# 裁定 MD/TXT 体积档后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 96

## Question

本批三张（metrics 维 / 入库报告去重率 / MD/TXT 体积档）+ 债一张（脆弱测例）已收官。本图往哪走。

已锁、不要重开：`prds/00–11` 不改；默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 默认开 rewrite / 真引擎选型 / 人签 / 准出全部锁死；P3a 等 L2 人签；LangGraph 另起路线；B8 / B9 / QUAL-2 不进本回合。

研究输入：[research-next-after-92.md](../research-next-after-92.md)（此前 10 候选证据仍在用；本轮补看候选 6 / 7）。

## Answer

### 先清一条债：`pnpm lint` 门禁清零

`apps/api` 的 7 条 `no-unused-vars` warning 让 `pnpm lint` 在 HEAD 即红，本轮每次验证都要挂一句免责。它挡的是「所有后续工单的验证可信度」，先清掉最划算（S）。**它不改任何断言 / 覆盖**。

### 本批串行三张（含债一张）

1. [lint 门禁清零](./99-lint-zero-warnings.md) — **清理债**，S；只清 4 个测试文件里的未使用变量，不动断言。
2. [文档 ACL 端点 `GET/PUT /documents/:docId/acl`](./100-doc-acl-endpoint.md) — PRD 05-api §2.4 **冻结端点**（"P2 可无端点但不可导入敏感库"），现在靠多用途 `PATCH /documents/:docId` 代偿；语义（`字段缺失 = 成员可读` / `[] = 不可读`）与判定函数、PG 闸、ES 对称 filter **都已落**，只缺这个口。S–M。
3. [真 L1 `contextualize`](./101-real-l1-contextualize.md) — 功能表 §6 `ingest.contextualize`（**P1**）+ ADR-013「生产默认 L1 LLM contextualize」；worker 已有 `embed-http.ts` 同型 HTTP 网关先例，**无硬前置**；M。

排序理由：先清债（让后续验证干净）→ 再补两个**已冻语义但缺实现/入口**的 P1–P3b 面；三张互不依赖（第 3 张与第 2 张无交集），串行只为可复核。两张都能在现有测例体系内钉死（HTTP 三态 + 注入 `fetchImpl`），无需真集群 / 真 LLM。

### 本轮明确不做 / 留雾

- **admin 文档 ACL 编辑面（成员选择器）**：`/acl` 端点落地后，admin 侧仍可用既有 Textarea 手填（现状可用）；换成选择器属 UI 体验余量，且要做就得先定「选人来源」（KB 成员列表 vs 平台用户列表，涉及权限面）→ 留下批。
- **收紧后 reindex**：**不是安全洞** —— PG 闸（`doc-acl.ts`）即时生效，且 `retrieve.ts` 的 ES 结果与 PG 现值为权威求交，索引滞后不构成泄漏；它只是索引与现值不一致。要做得先写清这层语义并决定触发路径（触 ADR-053「改配置不自动全库 reindex」）→ 留雾。
- **l0_fallback 历史行的 dense 单路负向夹具（B2-3）**：测试面余量，与上面同一族 → 留雾。
- **成员 `allowedDocIds` / `ACL_DOC_IDS_MAX` / `acl_filter_too_large`**：码与文案有、`retrieve.ts` 从不返回；属**成员面**而不是 `aclPrincipals`，与「角色 principal」冻结项相邻 → 不在本轮碰，留雾。
- **`Idempotency-Key`（PRD §2.7 铁律 6）**：真需求（断线场景「还在跑 vs 不存在」的唯一正解），但要动 ask 主路径的幂等语义，**须先做研究**（本轮研究未覆盖）→ 留下批的前置研究。
- **`drizzle/meta` 基线缺失**：`db:generate` 目前不可用、迁移靠手写 SQL + journal；修它属工程债且要重建 16 份快照，风险与本图目标无关 → 留雾（已在 `db` 规范写清当前实践）。
- **admin 原生 `<select>` 站规清扫**：仍无浏览器验证手段 → 不进本批。
- 仍锁：孤儿清理（待「激活 version」表示）· 签字包链（待数据来源）· L0 vs L1 Hit@k（待对照载体）· `pending_review`（三处未冻）· QUAL-G3（功能表无此行）· 真引擎 / 人签 / 默认开类。

### 本批切边

- 第 2 张**不改**默认检索语义、不默认开 `DEPT_ACL_ENFORCE`、不加角色 principal、不做 reindex-on-tighten、不做 admin UI。
- 第 3 张**不**引厂商 SDK / 本地权重（真引擎选型锁死；走 HTTP OpenAI 兼容）；**不加**库级 TPM 硬闸（embed TPM 已划出）；**不**改 `sparseText = contextPrefix + "\n" + body` 与 embed 口径（已冻）。
- 三张都不改 `prds/00–11`；都不 `task.py create`；不 push。

## Comments

- 2026-09-16 本图第三轮裁定。研究侧复用 `research-next-after-92.md` 的候选 6（真 L1 contextualize）与候选 7（aclPrincipals 剩余面）证据，未另起研究。
- Q1：把 `lint 门禁清零`（债）放进本批首位 —— 理由是它挡的是后续每一张票的验证可信度。
- Q2：`真 L1 contextualize` 的**默认口径**在工单里裁为**仓库默认关**（无真 Gateway 时默认 on 只会全量落 `l0_fallback` 并污染报告），与 OCR / rewrite 同款「能力落地、默认关」。
- Q3：`reindex-on-tighten` 明确标注「不是修安全洞」，不得借它解锁部门强制或角色 principal。
- Q4：`Idempotency-Key` 需要先研究再裁，不进本批直接开工。
