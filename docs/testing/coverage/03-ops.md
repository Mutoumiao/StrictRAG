# 覆盖分册 · ops

> 入口：[../coverage.md](../coverage.md)  
> 期望原文：`prds/10-delivery/03-acceptance-scenarios.md`（剧本 C · G · N · O · P · R · T · AB · AC · AD · I）  
> 冲突采信：源码 > `docs/module-status/` > 本表。工程绿 ≠ 签字 PASS（ADR-061）。mock 路径不得标成生产 ES / 真双节点已测。

## 剧本 C · 可复现评测与签字

工程绿（vitest + mock/注入）**≠** 签字 PASS。C1 的 2×2 纯函数与 CLI 注入可部分测；C2–C5 多为 UAT / 缺实现。在线抽样分不得作为本剧通过条件。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| C1 | 黄金集 1:1、seed 固定，产出 2×2 | 签字剧；工程 seed 可测 | 单测+注入 | 部分测 | api | apps/api/tests/eval/l1-matrix.test.ts · apps/api/tests/eval/l1-cli.test.ts · fixtures/l1/gold.yaml | 已断言 A–D 格、error 出格、coverage=A/(A+B)、mock 时 `signoffEligible=false`、gold≥30+30。缺：live 固定 seed 真跑 2×2 数字、业务题面人审。 |
| C2 | τ 扫描得 tau* | 签字剧 | UAT | 缺实现 | api | packages/db/src/schema/ask/eval-runs.ts（`run_type` 枚举含 `tau_sweep`） | 仅 schema 字面量；无扫描 runner、无 tau* 报告。 |
| C3 | Judge 校准产出 AUROC 报告 | 签字剧 | UAT | 缺实现 | api | apps/api/src/eval/adr046-snapshot.ts（`judgeAurocMin` 硬门数字） | 门槛常量在快照，无校准集 runner、无 AUROC 计算/报告。 |
| C4 | 有 expectedDocIds 时算 Hit@k | 签字剧 | 单测 | 缺实现 | api | fixtures/l1/gold.yaml · apps/api/src/scripts/run-l1-golden.ts（只加载字段） | gold 带 `expectedDocIds`；runner 报告无 Hit@k，测例不断言命中率。 |
| C5 | 签字页对照试点门禁，RACI 人签 | 签字剧；工程绿≠PASS | UAT | UAT | api | apps/api/tests/eval/l1-matrix.test.ts（`computeSignoffEligible`）· apps/api/tests/eval/adr046-snapshot.test.ts · fixtures/l1/RACI.md | 工程可算 `signoffEligible`；签字 PASS 须 live + 四要素 + RACI 人签。mock coverage 禁进签字叙事。 |

## 剧本 G · 反馈闭环

P2 必签。API 已有提交/队列；admin 有薄队列页但无 RTL；web 无提交测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| G1 | 对 abstained 提交 missing_doc，状态 open | P2必签 | 单测 | 部分测 | api | apps/api/tests/feedback/http.test.ts（`category: 'missing_doc'` → 201/`status=open`） | 未断言「仅 abstained 可开单」；web 答后提交无测（`apps/web/src/api/feedback.ts` 无对应 it）。 |
| G2 | 管理员 linked_doc / 上传后队列可关闭 | P2必签 | 单测 | 部分测 | api | apps/api/tests/feedback/http.test.ts（PATCH `dismissed` 后 `status=open` 列表为空）· apps/admin/src/app/(ops)/feedback/_components/feedback-workspace.tsx | 只测 `dismissed`；未测 `linked_doc`、上传后关闭。admin 反馈页无 RTL（`docs/module-status/admin.md`）。 |
| G3 | 提名黄金集须测试/产品审核后才进 gold | P2必签 | 单测 | 缺实现 | api | packages/contracts/src/ask/feedback.contract.ts（`promoted_to_gold`） | 状态枚举有；无审核闸、无「未审不得进 gold.yaml」断言。 |

## 剧本 N · At-rest 加密与备份契约

P2 部署/运维必过（ADR-040）。形态是部署检查表，勿编造单测证据。N2 应用无字段加密可单测，现缺测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| N1 | 五面加密：Mongo/PG/ES/RustFS/Redis 持久化全开，缺一面即部署失败 | P2部署必过 | 部署检查表 | UAT | — | docs/ops/at-rest-checklist.md | 检查单默认未检；本 chore 不实现加密栈。 |
| N2 | Mongo 读写无应用层字段 encrypt wrapper；ask body 与剧本 K 单一真相仍绿 | P2部署必过 | 单测 | 缺测 | worker | apps/worker/src/ingest/mongo-body.ts · apps/worker/tests/ingest/mongo-body.test.ts | 源码无字段加密 wrapper；测例只断言空 URL 走 local，未断言「无 encrypt」。 |
| N3 | 非 api/worker 网段默认不可连 Mongo 管理口 | P2运维联签 | 部署检查表 | UAT | — | docs/ops/at-rest-checklist.md | 网络隔离属部署，无单测。 |
| N4 | dump/snapshot 加密；明文备份不得离生产网 | P2部署必过 | 部署检查表 | UAT | — | docs/ops/at-rest-checklist.md | 备份加密未自动化。 |
| N5 | staging：加密备份解密恢复成功；恢复日志无 body 全文 | P2部署必过 | UAT | UAT | — | docs/ops/at-rest-checklist.md | 恢复演练，无自动化。 |
| N6 | 密钥轮换后旧备份仍可用旧钥恢复 | P2运维联签 | UAT | UAT | — | docs/ops/at-rest-checklist.md | 抽检演练。 |
| N7 | 威胁模型声明与 ADR-040 边界一致，无「已加密」无限定话术 | P2部署必过 | 文档护栏 | UAT | — | docs/ops/at-rest-checklist.md · docs/module-status/api.md | 人审话术；无文档闸测本条。 |
| N8 | 若启用 RDB/AOF：持久化卷加密 on | P2运维联签 | 部署检查表 | UAT | — | docs/ops/at-rest-checklist.md | Redis 卷加密属部署。 |
| N9 | 合同/合规/敏感三类触发器有检查表；命中则开新 ADR | P2运维联签 | 部署检查表 | UAT | — | docs/ops/at-rest-checklist.md | 流程检查表，无代码闸。 |

## 剧本 O · ES 共享索引与租户路由

O1/O2/O4 为 P2 代码门禁必签；O3/O5–O11 在启用独立索引或 staging 迁移时签。默认 `RETRIEVE_ES_MODE=mock`；缺 URL 走 mock **≠** 生产多租户已测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| O1 | 两租户同共享索引：A ask 永不返回 B 的 chunk | P2必签代码门禁 | 单测 | 缺测 | api | apps/api/src/services/retrieve/es-sparse.ts（filter 仅 `kbId`）· apps/api/tests/ask/es-sparse.test.ts | 查询无 `tenantId`；测例不断言跨租户隔离；默认 mock。禁止标已测。 |
| O2 | Router 默认全部指向共享名；写入/查询一致 | P2必签代码门禁 | 单测 | 部分测 | api | apps/api/tests/ask/es-sparse.test.ts · apps/worker/tests/ingest/es-http.test.ts（默认 index=`strict_rag_dev`） | 两边默认名一致。无 Router 对象、无写查一体断言。 |
| O3 | 配置一租户独立 index 后，该租户写/查只打独立名 | 独立索引演练 | UAT | 延后 | api | docs/module-status/api.md（≠ 多租户 Router / B8） | 独立索引能力未做。 |
| O4 | 无 `tenantId` 的 query builder → 单测/门禁失败（独立索引亦然） | P2必签代码门禁 | 单测 | 缺实现 | api | apps/api/src/services/retrieve/es-sparse.ts · apps/worker/src/ingest/es-http.ts | 查询/bulk 均无 `tenantId` 强制字段；缺的是门禁实现，不是「已有闸未测」。 |
| O5 | staging：回填 → chunkId 集一致 → 切 router → 查询单边新 → 共享无残留 | 独立索引演练 | UAT | 延后 | worker | apps/worker/tests/ingest/es-http.test.ts（`reconcileIndexed` 仅对账集合） | 迁移演练未做。 |
| O6 | 切换前只旧、切换后只新；无双索引联合查询 | 独立索引演练 | UAT | 延后 | api | — | 无切 router 实现。 |
| O7 | 独立 mapping 与共享一致；手改独立 mapping → 告警/门禁 | 独立索引演练 | UAT | 延后 | worker | apps/worker/src/ingest/es-http.ts（mapping 最小字段） | 无独立 template 对账闸。 |
| O8 | 删租户：共享 delete_by_query + tenant filter 无残留，或删独立 index | 独立索引演练 | UAT | 延后 | worker | — | 无删租户 ES 路径。 |
| O9 | 无工单「独立」→ 拒；有触发数据+会签 → 允许 | 独立索引演练 | UAT | 延后 | — | — | 会签流程未做。 |
| O10 | 新增独立 = 路由表变更，不靠代码 if/else 发版 | 独立索引演练 | UAT | 延后 | api | — | 无路由表。 |
| O11 | 能按 tenant 看 bulk 拒绝/延迟 | 独立索引演练 | UAT | 延后 | worker | — | 无按 tenant 的 bulk 指标。 |

## 剧本 P · 主/辅 Judge 隔离

P1/P3/P4/P6 为 P2 配置/单测必签。`online_sample` 未启 → P4/P5/P7–P11 延后。缺 URL 走 mock 的网关测 ≠ 生产双节点已测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| P1 | staging/prod 配置 judge≡judge_aux 同 provider+model → 启动失败 | P2配置必签 | 单测 | 部分测 | api | apps/api/tests/gateway/bindings-http.test.ts（PUT `judge`≡`judge_aux` → 400） | HTTP 保存拒绝已测。无 staging/prod **启动加载**同模失败测。 |
| P2 | local/dev 同模 → warning 可启动（非生产） | 配置演练 | 单测 | 缺实现 | api | apps/api/src/services/model-gateway.ts（`validatePlatformBindings` 一律拒同模） | 无 env 分档 warning；dev 同模可启动路径未做。 |
| P3 | verify 路径 Gateway 仅 `judge`；抽样路径仅 `judge_aux` | P2单测必签 | 单测 | 部分测 | api | apps/api/tests/ask/verify-required.test.ts · apps/api/src/services/gateway/resolve.ts（`ChatPurpose` 无 `judge_aux`） | verify 走 `judge` 有图测。抽样/`judge_aux` 链未实现，无法测隔离。 |
| P4 | mock `judge_aux` 全链失败 → 不调用 `judge` 链；仅 `judge_aux_fail`；ask 仍正常 | 启用 online_sample 时 | 注入 | 延后 | api | — | `online_sample` 未启。 |
| P5 | 抽样调用后用户 ask 的 `maxLLMCalls` 不因 aux 增长 | 启用 online_sample 时 | 单测 | 延后 | api | apps/api/tests/ask/budget.test.ts（仅 ask 图 LLM/retrieve 预算） | 无 aux 预算隔离测。 |
| P6 | L1 门禁条件无 `aux_*`；类型层 aux 与 min_support 不可互赋 | P2单测必签 | 单测 | 部分测 | api | apps/api/src/eval/adr046-snapshot.ts（`PILOT_HARD_GATES` 无 `aux_*`）· apps/api/tests/eval/adr046-snapshot.test.ts | 硬门对象无 aux 键。类型层「aux 与 min_support 不可互赋」未测。 |
| P7 | 改 `judge_aux` → 审计 + 旧基线 superseded；不强制 Verifier 校准集 | 启用 online_sample 时 | UAT | 延后 | api | — | 辅模型换绑作业未开。 |
| P8 | 改 `judge` → 须触发 ADR-016 校准路径（与 P7 对照） | 启用 online_sample 时 | UAT | 延后 | api | — | 主 Judge 换绑校准未开。 |
| P9 | 敏感 KB Cloud 明文 aux → 拒；self-host 或只评结构可 | 启用 online_sample 时 | UAT | 延后 | api | — | aux 敏感策略未做。 |
| P10 | 非成员 platform_admin 不可见 aux 所用 evidence/question 明文 | 启用 online_sample 时 | 单测 | 延后 | api | — | aux 作业未开。 |
| P11 | Langfuse generation 可按 `judge` / `judge_aux` 过滤；score 名 `aux_*` | 启用 online_sample 时 | UAT | 延后 | api | apps/api/tests/obs/metrics.test.ts（仅 `purpose=judge` 计数） | `LANGFUSE_ENABLED` 默认 false；无 `aux_*` score。 |

## 剧本 R · 三平面配额与 embed 预算

R1–R6、R8–R10 为 P2 必签。R7/R11/R12 在启用对应路径时签。源码现无 `plane` / `maxEmbedCalls` / TPM 配额。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| R1 | 多次 retrieve → query embed 次数 ≤ retrieve；不增加 maxLLM | P2必签 | 单测 | 缺测 | api | apps/api/src/services/retrieve/retrieve.ts（每 retrieve 一次 `embed([question])`）· apps/api/tests/ask/budget.test.ts | 结构上 embed 不计 LLM。无「embed 次数 ≤ retrieve」计数断言。 |
| R2 | route/grade/generate/verify 不直接调用 embed | P2必签 | 单测 | 缺测 | api | apps/api/src/graph/run.ts（无 embed 调用） | 图内无 embed。无静态/单测锁定「仅 retrieve 内」。 |
| R3 | ask 路径对 evidence body 再 embed → 失败或禁止 | P2必签 | 单测 | 缺测 | api | apps/api/src/services/retrieve/retrieve.ts（dense 用已有 `chunk.embedding`） | 无「对 body 再 embed 则失败」闸测。 |
| R4 | runtime 配 `maxEmbedCalls` → 启动 warning；行为 ≡ 无该字段 | P2必签 | 单测 | 缺实现 | api | apps/api/src/env.ts · apps/api/src/graph/budget.ts（仅 maxLLM/maxRetrieve） | 无 `maxEmbedCalls` 字段。 |
| R5 | 打满 ingest 配额 → ask 仍可达；打满 ask 不阻断 ingest | P2必签 | 注入 | 缺实现 | api | — | 无三平面配额。ask 429 是 RPM 闸（`obs/rate-limit.test.ts`），不是平面配额。 |
| R6 | mock embed TPM 触顶 → 队列堆积+告警；文档非 ready 直至清单全 embed；无半套 ready | P2必签 | 注入 | 缺实现 | worker | apps/worker/tests/ingest/embed-es-serial.test.ts（双就绪，非 TPM） | 无 ingest TPM/配额。 |
| R7 | contextualize 429 耗尽 → L0 索引路径；`contextualize_l0_fallback`；ask 不受影响 | 启用 L1 路径时 | 注入 | 延后 | worker | — | 无 contextualize 实现。 |
| R8 | ask 平面触顶 → 429/503 或强制 fast；不 200 空答 answered；`ask_quota_exhausted` | P2必签 | 单测 | 缺实现 | api | apps/api/tests/obs/rate-limit.test.ts（`RATE_LIMITED`，非平面配额） | 无 `ask_quota_exhausted`。 |
| R9 | 指标三维：ask 调用 `plane=ask`；入库 embed `plane=ingest`；purpose 可区分 | P2必签 | 单测 | 缺实现 | api | apps/api/tests/obs/metrics.test.ts（`purpose` 标签，无 `plane`） | 无 `plane=` 标签。 |
| R10 | staging 缺 plane 配额 → warning + 安全默认；非无限流裸奔 | P2必签 | 单测 | 缺实现 | api | apps/api/src/env.ts | 无 plane 配额启动闸。 |
| R11 | rerank 打点 `plane=ask`；仍不计 maxLLM/maxRetrieve | 启用对应路径时 | 单测 | 延后 | api | apps/api/tests/obs/metrics.test.ts（`recordRerank` 无 plane） | rerank 计数有；无 plane。 |
| R12 | `eval.run` / online_sample 打点 `plane=aux`；失败不影响 ask | 启用对应路径时 | 单测 | 延后 | api | — | aux 平面未开。 |

## 剧本 T · 业务线加严 / 放宽门禁

T1–T7、T9 为 P2 必签（契约/夹具/文档）。T8/T10 在多 KB 或放宽演练时签。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| T1 | 未声明加严的 KB → 门禁包 = 试点默认（C≤5% 等）可打印 | P2必签 | 单测 | 部分测 | api | apps/api/src/eval/adr046-snapshot.ts（`PILOT_HARD_GATES.cRateMax=0.05`）· apps/api/tests/eval/adr046-snapshot.test.ts（试点全等 → equal） | 常量可打印。无「未声明加严 KB 加载即该包」HTTP/运行时测。 |
| T2 | 将 C 上限改为 8% 无 ADR/合规会签 → 配置门禁拒绝或发布检查失败 | P2必签 | 单测 | 部分测 | api | apps/api/tests/eval/adr046-snapshot.test.ts（`cRateMax` 放宽 → looser，`signedPackage=false`） | 纯函数拒放宽。无发布/配置 HTTP 拒绝路径。 |
| T3 | 提案 C≤3% 未重跑 2×2 → 不得标记 `stricter_than_pilot` 已签字 | P2必签 | 单测 | 部分测 | api | apps/api/tests/eval/adr046-snapshot.test.ts（缺四要素 → 不得标已签字） | 四要素缺提案/签字已测。未专测「未绑定 L1 重跑」。 |
| T4 | 提案 + L1 重跑 + 业务/产品签字 + 配置快照绑定 → 可生效加严包 | P2必签 | 单测 | 部分测 | api | apps/api/tests/eval/adr046-snapshot.test.ts（四要素齐 + 未放宽 + live 覆盖>0 → `signedPackage`） | 人签仍 UAT；测例用注入布尔，非真实签字流。 |
| T5 | 加严包「覆盖↑ 且 C 上限↑」→ 拒绝（diff 校验失败） | P2必签 | 单测 | 已测 | api | apps/api/tests/eval/adr046-snapshot.test.ts（coverageMin↑ 且 cRateMax↑ → `direction=looser`） | — |
| T6 | KB 快照 τ/门禁数字 = 已签字包；篡改快照 → 加载拒绝或不一致告警失败 | P2必签 | 单测 | 部分测 | api | apps/api/tests/eval/adr046-snapshot.test.ts（`bindQualitySnapshotToEval` / `writeBoundSnapshot`） | 绑定身份稳定已测。无运行时「篡改快照拒绝加载」。 |
| T7 | 存在 `stricter_than_pilot` + 相对默认 diff + `eval_runs` 关联 | P2必签 | 单测 | 缺测 | api | apps/api/src/eval/adr046-snapshot.ts（字段 `stricterThanPilot`） | 快照有字段。无审计事件 + `eval_runs` 关联断言。 |
| T8 | KB-A 加严、KB-B 默认 → 各自独立，互不污染 | 多 KB 演练 | UAT | 延后 | api | — | 无多 KB 快照隔离测。 |
| T9 | ask.options 传 `tauClaim` → 400/拒绝（仍不可调） | P2必签 | 契约+单测 | 已测 | contracts | packages/contracts/tests/ask/contract.test.ts · apps/api/tests/ask/http-validation.test.ts · apps/api/tests/kb/settings-http.test.ts · packages/contracts/tests/kb/settings-contract.test.ts | AskOptions / 请求根 / PATCH settings 均拒 `tauClaim`。 |
| T10 | 合法放宽须有 ADR 编号 + 合规会签 + 产品 A 记录后才可换包 | 放宽演练 | UAT | 延后 | api | — | 合法放宽路径未做。 |

## 剧本 AB · 知识库设置页

P2 必签（UI 可薄，契约不可缺）。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AB1 | 有 `kb.config.write` 打开「知识库设置」见分区：基本信息 / 文档类型 / 分片策略入口 / 问答档位 / 质量只读 / 会话锁 | P2必签 | 单测 | 部分测 | admin | apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx · apps/admin/tests/ops/kb-settings-workspace.test.tsx | 页上有上述分区。测例只盖权限/分级/部门勾选，不断言分区齐全。 |
| AB2 | 改 `name`、`allowedModes`、`defaultMode` 并保存 → 200、有审计；随后 ask 用新 mode 白名单 | P2必签 | 单测 | 部分测 | api | apps/api/tests/kb/settings-http.test.ts（PATCH 白名单 200 回读）· apps/api/tests/obs/admin-write-audit.test.ts（settings PATCH 应审计）· apps/api/tests/ask/mode-doc-types-gate.test.ts | HTTP 保存已测。未串「PATCH 后 ask 用新白名单」。审计是中间件布尔，非本 PATCH 日志内容。 |
| AB3 | ask `options.mode` ∉ `allowedModes` → 400 | P2必签 | 单测 | 已测 | api | apps/api/tests/ask/mode-doc-types-gate.test.ts · apps/api/tests/kb/ask-mode-doc-types.test.ts | mode 不在允许列表 → 400/`mode not allowed`。 |
| AB4 | PATCH body 含 `tauClaim`（或 crag / allowDegraded）→ 400；运行时 τ 不变 | P2必签 | 契约+单测 | 已测 | api | apps/api/tests/kb/settings-http.test.ts（PATCH `tauClaim` → 400）· packages/contracts/tests/kb/settings-contract.test.ts（拒 `tauClaim` / `allowDegradedGenerate` / `cragOk`） | GET `qualitySnapshot.tauClaim` 来自 env，PATCH 拒写。 |
| AB5 | 质量区仅展示 τ + 签字包信息；无写入控件；GET 可读 snapshot | P2必签 | 单测 | 部分测 | api | apps/api/tests/kb/settings-http.test.ts（GET 含只读 `qualitySnapshot.tauClaim`）· apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx（质量只读区） | API GET 已测。admin 测例未断言无 τ 滑块/写入控件。 |
| AB6 | 无 `kb.config.write` → 菜单隐藏或页 403；PATCH 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/kb/settings-http.test.ts（doc_operator GET 403）· apps/admin/tests/ops/kb-settings-workspace.test.tsx（无码 403 态）· packages/admin-catalog/tests/acl/catalog-clip.test.ts | API 与薄页均拒无码。 |
| AB7 | 维护 docTypes 后 GET doc-types：列表与设置一致 | P2必签 | 单测 | 部分测 | api | apps/api/tests/kb/ask-mode-doc-types.test.ts（config 解析）· apps/admin/tests/ops/kb-settings-services.test.ts（`parseDocTypesInput`） | 解析/客户端拆分已测。`settings-http` 未测 PATCH `docTypes` 后 GET 回读一致。无独立 `GET …/doc-types` 路由。 |
| AB8 | 分片策略「设置」打开 053 弹窗；保存服 AA 语义 | P2必签 | 单测 | 缺实现 | admin | apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx（仅展示已实现码）· docs/module-status/admin.md | 无 053 弹窗；complete/reindex 策略闸在入库分册。 |

## 剧本 AC · 模型供应商与绑定

P2 必签。缺 URL 走 mock 的网关测 ≠ 生产双节点已测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AC1 | 超管新建 Provider（预设+名称+Key+baseUrl）并手填/拉取 models → 200；列表可见；GET 无 apiKey 明文 | P2必签 | 单测+契约 | 已测 | api | apps/api/tests/gateway/bindings-http.test.ts（POST 201；GET 无 `apiKey`/`sk-super-secret`）· packages/contracts/tests/system/model-gateway-contract.test.ts | 手填 models 已测。真实 fetch-models 上游代理未做（非本步阻塞）。 |
| AC2 | 模型表：llm + embedding + rerank 各至少一启用可保存 | P2必签 | 单测 | 部分测 | api | apps/api/tests/gateway/bindings-http.test.ts（可写入三类模型并绑定） | 可保存三类。无「缺一类则拒保存 Provider」闸。 |
| AC3 | 平台绑定 generate/embed/rerank/judge/judge_aux 合法 ModelRef → 200；类型不匹配 → 400 | P2必签 | 单测+契约 | 已测 | api | apps/api/tests/gateway/bindings-http.test.ts（embed 绑 llm → 400；五 purpose 合法 → 200）· packages/contracts/tests/system/model-gateway-contract.test.ts（`requiredModelTypeForPurpose`） | — |
| AC4 | prod/staging 绑 judge≡judge_aux 同 provider+model → 拒绝保存/加载 | P2必签 | 单测 | 部分测 | api | apps/api/tests/gateway/bindings-http.test.ts（同模 400 / 文案含 judge） | 保存拒绝已测。启动/加载同模失败未测。 |
| AC5 | rerank fallback 链长 &lt; `RERANK_MIN_NODES` → 拒绝（ADR-034） | P2必签 | 单测 | 已测 | api | apps/api/tests/gateway/resolve-mock.test.ts（staging http 单节点抛 `/RERANK_MIN_NODES/`；双 URL 接受） | 配置闸已测。mock 双节点重试 ≠ 生产双节点签字。 |
| AC6 | KB 设置选 generate/embed/rerank 覆盖；ask/入库解析用 KB 选择；审计 | P2必签 | 单测 | 部分测 | api | apps/api/tests/gateway/resolve-mock.test.ts（`mergeBindingRows` KB 覆盖 generate）· apps/api/src/routes/kb-settings.ts（GET/PUT KB bindings） | 合并覆盖已测。无 KB PUT HTTP 测；无 ask/入库解析用 KB 选择的端到端。 |
| AC7 | KB 尝试绑 judge → 400/403 | P2必签 | 单测 | 缺实现 | api | apps/api/src/routes/kb-settings.ts（PUT 走 `PutPlatformBindingsBodySchema` + `validatePlatformBindings`，未禁 judge） | KB 写入口未拒绝 judge。 |
| AC8 | 无 `model.gateway.manage` 调 Provider API → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/gateway/bindings-http.test.ts（kb_admin GET providers → 403/`model.gateway.manage`） | — |
| AC9 | `model-catalog` 仅启用模型；无凭证字段 | P2必签 | 单测 | 已测 | api | apps/api/tests/gateway/bindings-http.test.ts（仅 `enabled:true`；body 不含 secret） | — |

## 剧本 AD · 启动超管与角色树

P2 必签。无 `SUPER_ADMIN_*` 空库启动路径；无启动失败测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AD1 | 空库 + 配置 SUPER_ADMIN_* 启动 api → 创建超管；permission_definitions 含 catalog 全码；超管角色绑全码 | P2必签 | 单测 | 缺实现 | api | apps/api/src/env.ts（无 `SUPER_ADMIN_*`）· apps/api/src/services/platform-users-roles.ts（`ensureSystemRoles` 种子四模板）· apps/api/tests/acl/platform-users-roles.test.ts | 无空库启动建超管。dev-login `ensureUserRoleCodes` ≠ 本步。 |
| AD2 | 缺 SUPER_ADMIN_* 且无超管启动 → 启动失败 | P2必签 | 单测 | 缺实现 | api | apps/api/src/env.ts | 无该启动失败闸。 |
| AD3 | 已有超管再启动 → 不用 env 重置密码；码仍补齐 | P2必签 | 单测 | 缺测 | api | apps/api/src/services/platform-users-roles.ts（`ensureSystemRoles` 已有系统角色则 return） | 有「已有则跳过种子」。无启动再入、不重置密码、补码测。 |
| AD4 | 超管建角色：树勾选 doc.* 等保存 → 200；审计 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/platform-users-roles.test.ts（POST 合法码 201；未知码 400）· apps/api/tests/obs/admin-write-audit.test.ts（`/admin/roles` 写应审计） | 审计为中间件命中，非本 POST 日志体。 |
| AD5 | 超管建平台用户并绑该角色；用户登录 admin 后 `/me/permissions` = 角色并集 | P2必签 | 单测 | 部分测 | api | apps/api/tests/acl/platform-users-roles.test.ts（POST 用户 + 绑角色 201，列表含 `roleCodes`） | 无登录后 `/me/permissions` = 并集测。 |
| AD6 | 无 `user.manage` 调用户 API → 403 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/platform-users-roles.test.ts（kb_admin GET users → 403/`user.manage`） | — |
| AD7 | 禁用唯一超管 / 剥超管角色至 0 → 400 | P2必签 | 单测 | 已测 | api | apps/api/tests/acl/platform-users-roles.test.ts（唯一 active 超管 disable/剥角色 → 400/`last active super_admin`） | — |
| AD8 | 角色绑 catalog 外 code → 400 | P2必签 | 单测+契约 | 已测 | api | apps/api/tests/acl/platform-users-roles.test.ts（`not.a.real.code` → 400/`invalid`）· packages/contracts/tests/system/platform-users-roles-contract.test.ts | — |
| AD9 | 菜单无「系统设置」空壳（P2）；默认树不出现；模型 Key 不在系统域 | P2必签 | 单测 | 部分测 | admin-catalog | packages/admin-catalog/src/menu-tree.ts（无「系统设置」href）· packages/admin-catalog/tests/acl/catalog-clip.test.ts · packages/admin-catalog/src/permissions.ts（`system.settings` 预留） | clip 后无该空壳路由。未断言「模型 Key 不在系统域」的 UI 结构。 |
| AD10 | 供应商页 Key：password/掩码；GET 无明文 | P2必签 | 单测 | 部分测 | api | apps/api/tests/gateway/bindings-http.test.ts（GET 无明文）· packages/contracts/tests/system/model-gateway-contract.test.ts（读出口 `hasApiKey`）· apps/admin/src/app/(ops)/models/_components/models-workspace.tsx（`type=password`） | API 读出口已测。admin 掩码无 RTL。 |

## 剧本 I · 观测边界

Phase 4 建议，**不挡 P2** → 默认延后。I2 指标可部分测。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| I1 | 未鉴权访问 `/metrics`（若启用）→ 拒绝（401/403/网络不可达），禁止公网裸奔 | P4建议 | 部署检查表 | 延后 | api | apps/api/src/app.ts（`GET /metrics` 无鉴权）· docs/ops/rate-limit-and-metrics.md | 现进程内裸奔；生产须网关保护。无 401/403 测。不挡 P2。 |
| I2 | 一次 answered ask → Langfuse 有 span；可选指标 `ask_*` 递增 | P4建议 | 单测 | 部分测 | api | apps/api/tests/obs/tracer.test.ts（memory tracer 主链 span；executeAsk 接线）· apps/api/tests/obs/metrics.test.ts（`ask_total` / `llm_call_total` / `rerank_total`） | 进程内 tracer/指标已测。`LANGFUSE_ENABLED` 默认 false，真 Langfuse 未测。 |
| I3 | `eval.online_sample` 干跑打低分 → 仅告警/报告；不自动撤销已签字 L1 门禁、不拦截灰度 | P4建议 | UAT | 延后 | api | — | `online_sample` 未启；不自动撤门禁无实现可测。 |
| I4 | 质量看板 vs 延迟看板分开展示或分面板 | P4建议 | UAT | 延后 | admin | apps/api/tests/ops/dashboard-http.test.ts（B6 计数摘要，非双看板） | B6 ≠ 观测大盘。 |
| I5 | 非成员 platform_admin 打开该 KB trace → 无 evidence 明文（与 K5 同纪律） | P4建议 | 单测 | 延后 | api | apps/api/tests/obs/tracer.test.ts（memory span，非鉴权面） | 无 Langfuse/审计侧信道测。可与剧本 K5 合并。 |

## 本分册计数

行数须与上表合计一致。

| 剧本 | 步骤数 | 已测 | 部分测 | 缺测 | 缺实现 | 延后 | UAT |
|------|--------|------|--------|------|--------|------|-----|
| C | 5 | 0 | 1 | 0 | 3 | 0 | 1 |
| G | 3 | 0 | 2 | 0 | 1 | 0 | 0 |
| N | 9 | 0 | 0 | 1 | 0 | 0 | 8 |
| O | 11 | 0 | 1 | 1 | 1 | 8 | 0 |
| P | 11 | 0 | 3 | 0 | 1 | 7 | 0 |
| R | 12 | 0 | 0 | 3 | 6 | 3 | 0 |
| T | 10 | 2 | 5 | 1 | 0 | 2 | 0 |
| AB | 8 | 3 | 4 | 0 | 1 | 0 | 0 |
| AC | 9 | 5 | 3 | 0 | 1 | 0 | 0 |
| AD | 10 | 4 | 3 | 1 | 2 | 0 | 0 |
| I | 5 | 0 | 1 | 0 | 0 | 4 | 0 |
| **合计** | **93** | **14** | **23** | **7** | **16** | **24** | **9** |

ID 闭集（93）：C1–C5；G1–G3；N1–N9；O1–O11；P1–P11；R1–R12；T1–T10；AB1–AB8；AC1–AC9；AD1–AD10；I1–I5。
