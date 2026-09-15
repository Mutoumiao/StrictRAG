# 裁定分片策略审计后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 88

## Question

[分片策略保存写服务端修改日志最小闭环](./88-chunk-strategy-audit-min.md) 完成后。本批三张（禁自审四眼 / 角色树状勾选 / 分片策略审计）已收口。仓库默认强制仍关，人签仍图外。

裁定 **下一步** 本图走哪条。已锁、不要重开：第三批即 P2 语义收官；P2.5 工程路径齐；在线编写完整体验余量；P3a 等 L2 人签；LangGraph 另起路线；B8 / B9 / QUAL-2 不进本回合；P3b 可动手最小已齐；P4 可动手代码真空已尽；P5 开闸 + 重跑已齐。本批切边（`allowSelfApprove` / 独立工单表 / 角色页改码表 / 策略审计新表）不并进已关工单。

研究输入：[research-next-after-84.md](../research-next-after-84.md) §2 剩余清单。

## Answer

按研究 §2 剩余清单逐条摆到「能不能收口成可验证的最小闭环」上过一遍，结论如下。

### 撤销「孤儿清理先做」的原排序 —— 它缺一个前置语义

研究建议孤儿清理（剧本 L7 / `ingest.maintenance` / 存储边界 §2.4「必须」）为下一批首张。**动手前核查发现它现在做不了，且硬做会删错数据**：

- 存储边界 §2.4 的护栏是「删前断言 `index_version != documents.当前激活 index_version`；**激活版永不删**」，动作是「PG 向量 + ES 双侧清理」。
- 但仓库**没有**「激活 version」这一概念：`documents` 只有 `index_version`（`packages/db/src/schema/kb/documents.ts`），且它在 **chunk 阶段就被 `+1` 并重置双就绪**（`apps/worker/src/ingest/pipeline.ts` chunk 段）；`chunk_manifests` 只有 `indexVersion` 与 `frozen`，没有「当前激活」列。
- 后果：一篇 ready 文档 reindex 失败后，`status=failed`、`documents.index_version` 指向**失败的新版本**，而**上一个已可检索版本的数据仍在**（chunks / embeddings / mock ES 都按 `docId + indexVersion` 键存放）。此时若按「非当前 index_version 即为孤儿」清理，会**删掉该文档上一版成功索引的数据** —— 正是 §2.4 护栏要防的误删。
- 因此 L7 的**前置不是实现，是一个语义钉**：要么新增「激活 version」表示（列 / 表 / 由 `status=ready` 时的快照派生），要么把护栏改写成别的等价判据。这属于本图雾里要单独开决定工单的事（**不是**改 `prds/00–11` 冻款，是实现表示问题）。另一半天（触发 = 周期）依赖调度基建，与本图已归基建的 B8 同类。

**裁定：L7 先开「激活 version 表示 / L7 触发语义」决定工单，再动手清理实现。** 本轮不硬做。

### 另一条不能硬做的：签字包链（无真实数据源）

研究把「质量只读签字包链」（功能表 §4.2 / ADR-046）列为可动手。**核查后不能**：契约 `QualitySnapshotSchema` 只有 `tauClaim` / `gatePackageId` / `effectiveAt`，而**唯一生产者把后两者写死 null**（`apps/api/src/routes/kb-settings.ts` `defaultQuality()`）；真实 ADR-046 快照只由 `scripts/run-l1-golden.ts` **落文件**，没有落库。所以「链」现在没有可展示的数据来源，做出来只能是假壳。

**裁定：签字包链先钉数据来源（是否落库 / 由 `eval_runs` 派生），再动手展示。**

### 本批串行三张（均为功能表明文、可自足收口）

1. [文档绑定策略参数快照只读审计最小闭环](./90-doc-strategy-snapshot-readonly.md) — 功能表 §4.5。
2. [citation chunk 级去重最小闭环](./91-citation-dedupe.md) — 功能表 §10.1。
3. [断线按 requestId 重拉终态最小闭环](./92-ask-requestid-replay.md) — 功能表 §3 流式回答。

排序理由：前两张是**只读取展示与引用清洁**（不新增写路径、不碰检索与门禁），第三张是**用户可见可靠性**（§3 明文），三者互不依赖且都能用现有数据收口。`dedupe_cross_doc_rate` 留下一批。

**不并进本批**：孤儿清理（见上）、签字包链（见上）、`dedupe_cross_doc_rate` / 高度重复提示、metrics `fallback` / `node_used` 维、入库报告 L0 vs L1 Hit@k、`pending_review`、真 L1 `contextualize`、`pnpm lint` 门禁清零、原生 `<select>` 站规清扫。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余、B8 / B9 / QUAL-2、MD/TXT 更严体积、魔数嗅探、`pending_review`、QUAL-G3 `gold.yaml` 审核闸、QUAL-K5、三平面 R4/R6/R10（35 切边维持）、**孤儿清理（待「激活 version」表示）**、**签字包链（待数据来源）**。

未改产品代码。

## Comments

- 2026-09-16 用户要求继续 wayfinder，在主分支推进，授权本图全程自行决策。
- Q1：不选 P5 真引擎 / 解锁 P3b 站规 / 暂停 / P4 人签雾。
- Q2：**撤销**研究对 L7 的首位排序，理由见上（缺「激活 version」表示，硬做会删掉上一版可检索数据）；并撤销「签字包链」进本批（gatePackageId 无真实生产者，做出来是假壳）。
- Q3：本批三张全为只读展示 / 引用清洁 / 客户端可靠性；不新增写路径、不改检索与门禁。
- Q4：L7 与签字包链的下一步都是**决定工单**，不是实现工单。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / 人签仍锁；不 `task.py create`；不 push。
