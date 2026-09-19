# 核定 §2.5.2 各 ID 在 HEAD 的真实缺口

Type: research
Status: resolved

## Question

总 backlog §2.5.2 登记于 2026-08-24，其后 `fill-must-haves` 又收口了 29 / 35 / 80 / 85 / 86 / 88 / 95 / 101 / 104 / 105 / 106 等工单，[`coverage-gap-impl.md`](../../.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md) 的「源码缺口（IS）」列可能已滞后。

请在当前 HEAD 上逐 ID 复核以下十一项的真实状态，每项给出三件东西：

1. **判定**（四选一）：**真未做** / **部分已做**（做到哪一步，剩余差什么） / **已做待测**（源码满足该剧本 Then，但无对应测例） / **已被前图收口**（指明收口工单号）。
2. **依据的文件行**：`路径:行号`，以及现行测例路径（若有）。
3. **建议**：**可直接开工** / **需先出决定** / **应划出范围**，各一句理由。

复核对象：

| ID | 剧本步骤的 Then |
|----|-----------------|
| QUAL-K5 | 非 kb_member 的 platform_admin 读 Langfuse / 审计 → 无该 KB evidence 明文 |
| QUAL-E4 | 跨 doc 近重复：指标可见；`pending_review` 可人工处理 |
| QUAL-E5 | L1 contextualize 故障 → L0 回退仍 ready |
| QUAL-L7 | 孤儿清理 job：清半写非激活 version，不碰当前激活版 |
| QUAL-AA1 | KB 策略参数可保存 + 审计；旧文档 chunk 边界 / version 不变 |
| QUAL-ACL-CAP | 显式 `allowedDocIds` 且 `len > 5000` → `acl_filter_too_large`；不截断、无假 answered |
| QUAL-TENANT-Q | 无 `tenantId` 的 query / bulk builder 必须失败（共享与独立索引皆然） |
| QUAL-PLANE | 三平面配额 R4–R10（`maxEmbedCalls` warning 且行为 ≡ 无字段 · ask/ingest 互不阻断 · mock embed TPM · ask 触顶不得 200 空答 answered · 指标 `plane=` · staging 缺配额 warning + 安全默认） |
| QUAL-G3 | 提名黄金集须测试 / 产品审核后才进 `gold.yaml` |
| QUAL-AB8 | 分片策略「设置」打开 ADR-053 弹窗；保存服 AA 语义 |
| QUAL-AC7 | KB 尝试绑 `judge` → 400 / 403；judge 仅平台级 |

另核定**三条前置**的当前状态（是仍缺、还是已具备）：

- 文档「**当前激活 version**」表示：`documents.index_version` 的写入时机与语义；孤儿清理（L7）与文档 ACL 收紧自动 reindex 两处依赖它，是否仍不可断言。
- `pending_review`：落点 / 人工端点 / KB 策略位三处是否仍未冻。
- 签字包：`gatePackageId` / `effectiveAt` 的唯一生产者（`defaultQuality()`）是否仍写死 `null`。

## Answer

核查由两个只读子代理在 HEAD `420572d` 上完成，**未改任何源码、测试或配置**。全量证据（含 `路径:行号`）在两份报告：

- ingest / ask 侧（K5 · E4 · E5 · L7 · AA1 + 三条前置）：[`research/gap-is-a.md`](../research/gap-is-a.md)
- api / admin 侧（ACL-CAP · TENANT-Q · PLANE · G3 · AB8 · AC7 + 签字包前置）：[`research/gap-is-b.md`](../research/gap-is-b.md)

### 逐 ID 判定

| ID | 判定 | 要点 |
|----|------|------|
| QUAL-K5 | **真未做** | `/ask/:requestId` 与 `/final` 有成员闸（`apps/api/src/routes/ask.ts:448/460`），但 `super_admin` 旁路成员闸（`apps/api/src/auth/middleware.ts:239-242` + `role-templates.ts:81-83`），而 `platform_admin` 就是超管的平台角色标签（`auth.ts:55`）。更麻烦的是 `tests/audit/http-audit.test.ts:226-236` 把「超管可读 evidence preview」钉成**正向断言**——与 K5 的 Then 相反。与既有冻结语义的关系需先出决定 |
| QUAL-E4 | **部分已做** | 跨文档判定在独立模块 `apps/worker/src/ingest/cross-doc-dedupe.ts`（不是 chunk 内 `seen`）；「指标可见」已满足（`dedupeCrossDocRate` 落库 + API + admin）。`pending_review` 的落点 / 端点 / KB 策略位**三处仍无**（不在 `packages/contracts/.../document.contract.ts:6-17` 状态枚举、无列、无路由、`config_json` 无开关） |
| QUAL-E5 | **部分已做 · 缺测** | 源码满足剧本：`contextualize-http.ts` + `INGEST_CONTEXTUALIZE_MODE`（默认 off）+ 逐块回退 + 两计数落库。既有注入测只覆盖 429 / 网络 / 畸形 / 空 / 超长，断言「块仍入库 + `l0_fallback` + 计数 (0,1)」；**「文档仍 ready」这条 Then 无任何端到端断言**，5xx 未单独注入 |
| QUAL-L7 | **真未做** | 只有对账报告 `orphan`（`reconcileIndexed`）与整文档 `dropDoc`，无清理 job、无周期调度。`documents.index_version` 在 chunk 段即 `+1`（`apps/worker/src/ingest/pipeline.ts:504/658-661`）且失败不回退 → 前置「激活版不可断言」**仍成立** |
| QUAL-AA1 | **部分已做** | 「参数可保存」（chunk-strategies PATCH 的 `paramOverrides`）与「审计」（`chunkStrategy.<code>.<field>` diff）**已由前图 88 覆盖**。差的是「旧文档 chunk 边界 / version 不变」只有代理断言（`tests/.../chunk-strategy-audit.test.ts:149-150` 断言「未调用文档写仓」），**无数据级断言** |
| QUAL-ACL-CAP | **真未做 · 应划出** | 契约码在 `packages/contracts/src/ask/reason.ts:23`、文案在 `apps/api/src/graph/reasons.ts:93`；全仓 `allowedDocIds` 10 处全是文档或负向测试，DB 无该列，`ACL_DOC_IDS_MAX` 0 命中，`retrieve` 无返回该 reason 的出口 → **无生产者** |
| QUAL-TENANT-Q | **部分已做** | 前图 09 已把 `tenantId` 变成 builder 必填并有正向断言（`apps/api/src/retrieval/es-sparse.ts:15/115/221`、`es-http.ts:31/59`）；缺的是「**缺 `tenantId` 即失败**」的门禁与负向测。`mockEsStore`（`es-store.ts:9-52`）与默认 mock 路径**无 tenant 概念**；独立索引布局属 B8 → 门禁口径需先出决定 |
| QUAL-PLANE | **部分已做** | R5 / R8 / R9 已由前图 35 落（`rate-limit.ts:21-25`、`ask.ts:344-351`、`metrics.ts:58-67`；测例 `quota-planes.test.ts:196/243/290`）。**R4（`maxEmbedCalls`）· R6（embed TPM）· R10（staging 缺配额 warning + 安全默认）真未做**（全仓源码 0 命中） |
| QUAL-G3 | **部分已做 · 应划出** | 运营表回流闸已由前图 84 落（`apps/api/src/routes/feedback.ts:199-246` 写 `gold_questions`）；但 `gold.yaml` 是**静态手写 seed、全仓无生成器**，功能表内 `审核` / `提名` **0 命中**（仅 6 处「黄金集」），剧本原文在 `prds/10-delivery/03-acceptance-scenarios.md:139` → **无实现对象** |
| QUAL-AB8 | **已被前图收口（06 + 82）** | `apps/admin/src/components/settings-workspace.tsx:452` 挂载 chunk-strategy-panel；「设置」开 `role="dialog"`、保存走 `PATCH …/chunk-strategies`（`chunk-strategies.ts:94-131` 落审计）、旧文档不变；测例 `tests/ops/chunk-strategy-panel.test.tsx` 已登记。残留仅 `panel.tsx:149-163` 一处原生 `<select>`（站规余量，图上已记） |
| QUAL-AC7 | **已被前图收口（78）** | KB 绑定白名单 schema（`model-gateway.contract.ts:172-190` + `KB_CONSUME_PURPOSES:48`）对 `judge` 直接 400 `VALIDATION_ERROR`（`kb-settings.ts:187-210`；测例 `kb-consume-bindings-http.test.ts:81-97`）；平台绑 `judge` 路径不变（`model-gateway.ts:170-190`）；admin 页不列 judge（`settings-workspace.tsx:459`） |

### 三条前置

| 前置 | 状态 | 证据 |
|------|------|------|
| 文档「当前激活 version」表示 | **未冻** | 无独立表示；检索闸直接读 `doc.index_version`（`apps/api/src/retrieval/corpus.ts:107-112`）→ reindex 失败后**不能**断言哪一版仍在被检索（旧版数据仍在，只是被闸排除） |
| `pending_review` 三处 | **三处仍无** | 落点 / 端点 / KB 策略位均无（同 E4 行） |
| 签字包数据来源 | **仍写死 null** | `defaultQuality()`（`apps/api/src/routes/kb-settings.ts:61-66`）恒 `gatePackageId: null, effectiveAt: null`；真快照由 `writeBoundSnapshot` 落 `artifacts/l1-gate-snapshot.json`（`adr046-snapshot.ts:217-227`）并作为 `reportJson` 进 `eval_runs`（`eval-runs.ts:33-34`），但**无任何回填 KB 设置的路径** |

### 对地图的影响

原以为 11 张实现票，实际收缩为：**2 张划出**（ACL-CAP 无生产者 · G3 无实现对象）、**2 张登记滞后已收口**（AB8 · AC7）、**2 张补测**（E5 · AA1 的剩余 Then）、**1 张部分补实现 + 部分需决定**（PLANE：R4/R10 可开工，R6 需决定；TENANT-Q 需决定门禁口径）、**3 张需先出决定**（K5 与超管 bypass 的关系 · L7 依赖激活 version 表示 · E4 依赖 `pending_review` 语义）。
