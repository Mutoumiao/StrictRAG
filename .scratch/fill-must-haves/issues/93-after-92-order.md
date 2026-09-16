# 裁定断线重拉后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 92

## Question

[断线按 requestId 重拉终态](./92-ask-requestid-replay.md) 完成后（工单 01–92 全部结题）。本图往哪走。

已锁、不要重开：第三批即 P2 语义收官；P2.5 工程路径齐；在线编写最小闭环齐（无 BlockNote）；P3a 等 L2 人签；LangGraph 另起路线；B8 / B9 / QUAL-2 不进本回合；P3b 可动手最小已齐；P4 可动手代码真空已尽；P5 开闸 + 重跑已齐；默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 默认开 rewrite / 真引擎选型 / 人签 / 准出全部锁死；`prds/00–11` 不改。

研究输入：[research-next-after-92.md](../research-next-after-92.md)（10 个候选逐条给到功能表原文、PRD 条款、源码证据、前置判定、规模与验证方式）。

## Answer

按研究逐条摆到「能不能收口成**可验证**的最小闭环」上过一遍。结论：

### 本批串行三张（均为功能表 / PRD 明文，无前置，纯单测可钉）

1. [metrics `fallback` / `node_used` 维最小闭环](./94-metrics-fallback-node-dim.md) — 功能表 §10.3 + `prds/10-delivery/01-phased-roadmap.md:85` 把「`llm_call_*` / `rerank_*` 含 fallback 与 node_used」写成 **P2 必须级**骨架；真值**已在手却被丢**（`graph/run.ts` 不收 `res.meta.fallbackUsed`；rerank 客户端遍历多端点却不回 meta）。
2. [入库报告 `dedupe_cross_doc_rate` 最小闭环](./95-ingest-report-dedupe-rate.md) — 功能表 §6 去重行要求入库报告在剩余可检索占比过低时标「高度重复」，PRD 04 §5.2 把 rate 列为**入库报告必出**；全仓零命中。**只做 rate 数值**（口径须在票内写明，PRD 只给名字）。
3. [MD/TXT 更严体积档最小闭环](./96-md-txt-size-tier.md) — 功能表 §5.2 / §6「默认 50 MiB…（**MD/TXT 可更严**）」+ PRD 09 §7「可选 MD/TXT 更严（建议 10 MiB）」；审查报告把该行列为 P1 缺口。现只有单一 `max`。

排序理由：三者都是**先补齐「必须级」可观测与报告面**，不新增用户可见写路径、不碰检索闸与门禁、不动默认关的强制开关；且都能在现有测例体系内钉死（metrics 标签聚合、报告行快照、complete 体积闸），无需真集群。

### 本批明确不做 / 留雾（连同研究新发现的前置一起记账）

- **入库报告 L0 vs L1 Hit@k**：功能表只要求「**可**抽样对照」，而仓库没有「同一文档两份可检索数据」的载体（ADR-053 禁同 version 双索引、检索闸只认激活 version、真 L1 未落）→ 硬做只能产假数字。**前置：先有 L1 语料与可对照载体。**
- **`pending_review`**：落点（`chunks` 无 `duplicate_of` / `dedupe_status` / `searchable`）、人工决定端点、KB 策略位（`crossDocDedupeAction` 全仓零命中）三处未冻。**前置：三处语义先冻。**（连带：「高度重复」提示的阈值「以数据 PRD 为准」，而 `prds/03-data` **没有任何阈值/占比定义** → 本批只做 rate 数值，不发明阈值。）
- **QUAL-G3 `gold.yaml` 审核闸**：**功能表无此行**（出自 `docs/testing/coverage/03-ops.md`）；与运营 `gold_questions` 无通道，审核主体/落点未冻，且邻近「人签 / 准出」锁定项。**不进本图执行面。**
- **在线编写余量（BlockNote / `editor-draft`）**：`editor-draft` 与 `submit-approval` 路由均不存在，`approval_tickets.staging_ref` 落点未定；功能表本身把 BlockNote 列为 P2 可缺。
- **真 L1 `contextualize`（M）**：**无硬前置**（worker 已有 `embed-http` 同型 HTTP 网关先例），列为**下一批首选**；本批不并（避免与「真引擎」类改动串在一起）。
- **入场 `aclPrincipals` 剩余面（`GET/PUT /documents/:docId/acl` + admin 用户选择器）**：无硬前置但属 P3b 提前面，须写明「不动默认检索语义、不开 `DEPT_ACL_ENFORCE`、不加角色 principal」；列下一批候选。
- **admin 原生 `<select>` 站规清扫**：研究列为首选（纯机械替换），但本图当前**没有浏览器验证手段**，24 处外壳替换属「改完只能靠 RTL 断言、视觉回归看不见」的改动 → **本批不做**，等能真点界面或能给出等价验证方式时再上。
- **回归 / 工程债三条**（`pnpm lint` 清零 · api 脆弱测例加固 · `drizzle/meta` 基线缺失）：**下一批优先清**（各 S），本批不并。
- 仍锁：仓库默认开强制、角色 principal、BlockNote 完整栈、P3a、P4 其余（人签/再认证/数据面板增强/真 judge）、P5 其余（真 OCR 引擎/容量/熔断调优/在线抽样/CoVe）、`Idempotency-Key`（PRD §2.7 铁律 6，见地图雾）、孤儿清理（待「激活 version」表示）、签字包链（待数据来源）。

### 本批切边

- 不并进已关工单：`dedupe_cross_doc_rate` 不连带 `pending_review`；metrics 维不连带远端 Prometheus / Grafana / 告警规则；体积档不连带魔数嗅探（**魔数嗅探在功能表与 `prds/00–11` 均无依据**，属加固，若做须显式标注来源）。
- 三张都不改 `prds/00–11`；都不动默认关的强制开关注解；都不 `task.py create`；不 push。

## Comments

- 2026-09-16 用户要求继续 wayfinder，本图全程自行决策。
- Q1：不选「先清债再补功能」——债三条记在雾里并列为下一批首选，本批仍按功能表必须级推进。
- Q2：**不接受的三个候选**（研究的排序被下调）：L0 vs L1 Hit@k（无对照载体）、`pending_review`（三处语义未冻）、QUAL-G3（功能表无此行）——与上一轮撤销孤儿清理 / 签字包链同一口径：**缺前置的宁可不做**。
- Q3：**admin 站规清扫虽无前置但不进本批**：无浏览器验证手段，24 处外壳替换的视觉回归不可验。
- Q4：魔数嗅探显式不做（无 PRD 依据）；「高度重复」阈值显式不发明（数据 PRD 无定义）。
- Q5：本批第二张只做 rate 的**数值**口径，不做提示文案与阈值判断，避免一次票里塞两件未冻语义。
