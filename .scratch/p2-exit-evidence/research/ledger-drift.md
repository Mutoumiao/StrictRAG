# 账本漂移审计（2026-09-20）

结论摘要：

1. 共发现 **34 处漂移**（**25 处「漂移·低估」 + 9 处「待裁定」**；表 40 行中余 6 行判「终态一致」）。若把跨三处的同一议题（L3「自动熔断」口径，#13 / #23 / #26）并为 1 条，则实际议题数为 **32 条**。**未发现「漂移·高估」**：镜像里没有把不存在的能力写成已具备。
2. 低估集中在前图 `close-p2-exit-gaps`（2026-09-19）落地的 11 个 ID：总 backlog §2.5.2 **11 行全写「未开始 / 未指派」**；交付控制台 §0.5 **10 行仍写「部分→缺口 / 缺口」**；而 `docs/module-status/api.md` · `worker.md` · `db.md` 已在 2026-09-19 18:01 按源码回写（三份包文 mtime 与 status.md 同刻）。
3. **整篇未回写的镜像只有一处**：`prds/12-delivery-guides/04-交付控制台.md`，mtime **2026-08-31 23:04**，完全没吃到 2026-09-19 这批收口；`docs/module-status/README.md` 矩阵 mtime **2026-09-15**，其「半产品未实现」一句已被 2026-08-21 的 HALF-* 落地反证。
4. 最严重三条：① 交付控制台 **§0.7 表 14 行 HALF-\* 全写「未开始」**（同文 §0.1 与总 backlog §1.2 均写「已落地」）；② §0.5 **#7 / #8 / #18 / #22** 四个「缺口」已在 2026-08-24 与 2026-09-19 收口，只剩文档未改；③ 总 backlog §2.5.2 **11 行状态列与表头「本表已收口」自相矛盾**，且每行指针都指向**从不存在的** `08-24-qual-*` task 目录（全仓 0 命中）。
5. 另有 9 行需人裁定（分母口径、划出范围该用什么标签、L3「自动熔断」口径、live 真跑数字无仓内证据），见下表与「建议回写清单」。

判定口径：**源码 > 状态文档旧文 > task 叙事 > spec 顶部「现状」一句话**。凡源码可核者一律核对到文件；凡只能靠 task 叙事者判 `待裁定`。

---

| # | 文件 | 行/ID | 该行当前声称 | 源码/测例证据（含路径） | 判定 |
|--:|------|-------|--------------|--------------------------|------|
| 1 | `.trellis/tasks/08-06-project-backlog/status.md` | §2.5.2 L326 **QUAL-K5** | 状态「**未开始**」· Owner「未指派」· 指针 task `08-24-qual-k5-langfuse-acl` | 审计口 `GET /ask/:requestId` 与 `/final` 始终成员闸：`apps/api/src/routes/ask.ts:99`（`requireKbMember`）· 403 测例 `apps/api/tests/ask/http-audit.test.ts:200`「非该 KB 成员 403」· Langfuse 全仓仅 mock 无读取面：`apps/api/src/obs/ask-tracer.ts:19-73`、`apps/api/src/obs/memory-tracer.ts:20`、`apps/api/src/env.ts:146-155`。task 目录 `08-24-qual-k5-langfuse-acl` 全仓 0 命中（`.trellis/tasks/` 下不存在） | `漂移·低估` —— K5 范围内的审计口今天已有 403 与测例，Langfuse 无读取入口，镜像仍写「未开始」 |
| 2 | status.md | §2.5.2 L327 **QUAL-E4** | 「**未开始**」· 指针 `08-24-qual-e4-near-dup` | 迁移 `packages/db/drizzle/0021_chunks_dedupe_review.sql:4-5`（`duplicate_of` / `dedupe_status`）· worker 入审落库 `apps/worker/src/ingest/pipeline.ts:595-596` · 测例 `apps/worker/tests/ingest/cross-doc-pending-review.test.ts`（已登记 `apps/worker/tests/index.md:38`）· api 端点 `apps/api/src/routes/documents/index.ts:622-627` + `apps/api/src/services/dedupe-conflict.ts` + `apps/api/tests/ingest/dedupe-conflict-resolve.test.ts`（`apps/api/tests/index.md:120`）· 契约 `packages/contracts/src/ingest/ingest-report.contract.ts:11-19` | `漂移·低估` —— E4 数据面 + 端点 + 报告字段全部落地 |
| 3 | status.md | §2.5.2 L328 **QUAL-E5** | 「**未开始**」· 指针 `08-24-qual-e5-l1-fallback` | `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`（文件头目标＝剧本 E5；500/503/畸形/空输出/AbortError 各注入一次，断言 `status=ready` + `contextSource=l0_fallback`；已登记 `apps/worker/tests/index.md:42`） | `漂移·低估` —— 源码已满足 Then，缺的只是这条断言，现有测例即证 |
| 4 | status.md | §2.5.2 L329 **QUAL-L7** | 「**未开始**」· 指针 `08-24-qual-l7-orphan-clean` | `apps/worker/src/ingest/orphan-clean.ts:55,59`（`no_active_version` 一律不动手；保护激活版 + 在飞版）· 触发接线 `apps/worker/src/ingest/pipeline.ts:52,84-95`（失败后 best-effort）· 迁移 `packages/db/drizzle/0020_documents_active_index_version.sql` · 原子激活 `pipeline.ts:983-986` · 测例 `apps/worker/tests/ingest/orphan-clean.test.ts`、`orphan-clean-on-failure.test.ts`（`tests/index.md:45-46`） | `漂移·低估` —— 孤儿清理已落且带三条护栏反例；镜像写「未开始」 |
| 5 | status.md | §2.5.2 L331 **QUAL-AA1** | 「**未开始**」· 指针 `08-24-qual-aa1-chunk-params` | `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts`（文件头：文档 + chunk 夹具深等，文档写仓被调用即变红；已登记 `apps/api/tests/index.md:145`）· 参数写面与审计 `apps/api/src/routes/chunk-strategies.ts` + `apps/api/src/services/kb-settings-audit.ts`（测例 `apps/api/tests/kb/chunk-strategy-audit.test.ts`） | `漂移·低估` —— 「可保存 + 审计」先前已具备，「旧文档 version 不变」的数据级断言 2026-09-19 已补 |
| 6 | status.md | §2.5.2 L332 **QUAL-ACL-CAP** | 「**未开始**」· 指针 `08-24-qual-acl-filter-cap` | 全仓 `allowedDocIds` 仅 3 处且**全是负向测/文档**：`packages/contracts/tests/ask/contract.test.ts:113`、`apps/api/tests/acl/members-http.test.ts:204`；DB 无列，`retrieve.ts` 从不返回 `acl_filter_too_large`（枚举仅在 `packages/contracts/src/ask/reason.ts:23`、文案 `apps/api/src/graph/reasons.ts:93`）。前图裁定「无生产者 → 划出」见 `.scratch/close-p2-exit-gaps/issues/06-qual-acl-cap.md` | `待裁定` —— 状态列「未开始」与源码相符（确实无实现），但该行缺两件：① 指针 task 不存在；② 未记「划出范围」结论。而 §0.1 完成标签表没有「划出」这一档，写什么标签要人定 |
| 7 | status.md | §2.5.2 L333 **QUAL-TENANT-Q** | 「**未开始**」· 指针 `08-24-qual-tenant-query` | api builder：`apps/api/src/services/retrieve/es-sparse.ts:45-51,84,128`（`requireTenantId` 在 `sparseBulkSource` / `buildAclFilter` 内抛 `EsSparseError(...,'config')`）· worker：`apps/worker/src/ingest/es-http.ts:49,71` · 测例 `apps/api/tests/ask/es-builder-tenant-required.test.ts`（`apps/api/tests/index.md:54`）、`apps/worker/tests/ingest/es-builder-tenant-required.test.ts`（`apps/worker/tests/index.md:31`） | `漂移·低估` —— 两仓 builder 的运行时租户闸与正反例都已落 |
| 8 | status.md | §2.5.2 L335 **QUAL-PLANE** | 「**未开始**」· 指针 `08-24-qual-plane-quota` | R10：`apps/api/src/obs/plane-quota.ts:20,33-40,59-71`（`SAFE_DEFAULT_PLANE_RPM=30`、非 fail closed）· 启动告警 `apps/api/src/index.ts:13,27` · 路由改读 `planeQuotas.{ask,ingest}.rpm`：`apps/api/src/routes/ask.ts:143`、`apps/api/src/routes/documents/index.ts:100` · 测例 `apps/api/tests/obs/plane-quota-safe-default.test.ts`（`tests/index.md:164`）· 文档 `docs/ops/rate-limit-and-metrics.md:57,150` | `漂移·低估` —— 源码已有 R10 安全默认 + R6-a「无半套 ready」，镜像整行写「未开始」；但整行也**不能**标「已完成」（R4 / R6-b 已划出） |
| 9 | status.md | §2.5.2 L336 **QUAL-G3** | 「**未开始**」· 指针 `08-24-qual-g3-gold-review` | `fixtures/l1/gold.yaml` 为静态种子，全仓无生成器（`grep gold\.yaml` 只有 fixtures 与测例；无 `writeFileSync(...gold)` / generator 命中）。前图裁定见 `.scratch/close-p2-exit-gaps/issues/14-qual-g3-gold-review-gate.md` | `待裁定` —— 状态列与源码相符（没有可加闸的对象），但缺「划出」结论与可用指针，标签口径同 #6 |
| 10 | status.md | §2.5.2 L337 **QUAL-AB8** | 「**未开始**」· 指针 `08-24-qual-ab8-strategy-dialog` | admin 分片策略弹窗已落：`apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx:4`（「分片策略设置弹窗」）、挂载点 `.../_components/settings-workspace.tsx:54,452` · 测例 `apps/admin/tests/ops/chunk-strategy-panel.test.tsx` | `漂移·低估` —— 属「登记滞后」：`apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx:701-761,1135` 也已有上传/编写/reindex 三处策略选择 |
| 11 | status.md | §2.5.2 L338 **QUAL-AC7** | 「**未开始**」· 指针 `08-24-qual-ac7-kb-judge-ban` | `packages/contracts/src/system/model-gateway.contract.ts:172-187`（`PutKbConsumeBindingsBodySchema` 只收 `isKbConsumePurpose`，judge 记 issue 后 400）· 端点 `apps/api/src/routes/kb-settings.ts:193-199` · 测例 `apps/api/tests/kb/kb-consume-bindings-http.test.ts:36`（「PUT judge 400 且不落行」） | `漂移·低估` —— 属「登记滞后」：KB 绑 judge 已被 400 拒 |
| 12 | status.md | §2.5.2 表头 L322 | 「**划出 3**（R4 `maxEmbedCalls` 无落点 · R6-b embed TPM 无口径 · ACL-CAP 无生产者 · G3 无实现对象）」 | 同行列举项共 **4 个**；若按 ID 计（PLANE 一行含 R4 + R6-b）则为 3，若按子项计为 4。同段其余计数与源码自洽（实现 6 = PLANE-R10 · TENANT-Q · E5 · AA1 · L7 · E4；已具备 2；登记滞后 2） | `待裁定` —— 与源码无关，属镜像内部**分母口径**：需人定「按 ID 计还是按子项计」再改数字 |
| 13 | status.md | §1.1 L158 **P2.5-L3A** | 「**有**告警 / **无**自动关 / **无**面板 / **≠** 准出」 | 源码有进程内熔断：`apps/api/src/obs/metrics.ts` 的 `isL3RewriteFused` 被 `apps/api/src/services/ask/execute.ts:15,153-157` 消费（闩后强制 `rewriteEnabled=false`）· 测例 `apps/api/tests/obs/l3-rewrite-fuse.test.ts` · **但** `apps/api/src/services/ask/execute.ts` 不写 env、`docs/module-status/api.md:117` 亦记「**无**写 env / **无**收窄窗」 | `待裁定` —— 「自动关」到底指「进程内闩后停用 rewrite」（源码有）还是「写 env 的全局关」（源码无）？此口径未定义，需人裁定后统一三处（另见 #26、#30） |
| 14 | status.md | §1.2 L208–221 **P-HALF 表** | 14 条 HALF-* 全部「**已完成**」 | 与源码一致：`package.json` scripts `up:apps` / `smoke:half` / `seed:demo` · `.env.operable.example` · `scripts/up-stack.mjs` · `apps/worker/src/ingest/pdf-text.ts` · `apps/worker/src/ingest/embed-http.ts` · `apps/api/src/routes/documents/index.ts:884-886`（`GET /documents/:docId/ingest-jobs`）· `docs/ops/auth-enforce-pilot.md` · `docs/ops/half-smoke.md` | `终态一致` —— backlog 这一处是对的；错的在 `docs/module-status/README.md:77` 与交付控制台 §0.7（见 #24、#27） |
| 15 | `prds/12-delivery-guides/04-交付控制台.md` | §0.5 **#1** L103 | 三态「**部分** B10-followup（RACI ✅ · 真跑✅ · ADR-046 快照绑定✅）」；现状口径未提 2026-09-19 的签字包派生 | `apps/api/src/services/eval-runs.ts:50-82,312-317`（`isSignoffPackageRow` + `latestSignoffPackage`）· 调用点 `apps/api/src/routes/kb-settings.ts:61-69`（`defaultQuality` 改为 `await`）· 测例 `apps/api/tests/eval/signoff-package-derive.test.ts`（`tests/index.md:108`）；`.scratch/close-p2-exit-gaps/map.md:41`（「映射表 #1 的工程侧闭合，余下仅业务人签」） | `漂移·低估` —— 工程侧已闭合这件事没进镜像；「部分」的剩余项只剩业务人签 |
| 16 | 04-交付控制台.md | §0.5 **#4** L106 | 三态「**部分→缺口** QUAL-1」；现状口径自相矛盾（同格写「QUAL-1 红线测 ✅」） | `apps/api/tests/auth/enforce-401.test.ts`（`docs/module-status/api.md:79` 记 QUAL-1 已完成）· backlog §2.5 L289 已标「**已完成**」 | `漂移·低估` —— 同一格自认红线测已绿，三态却仍挂「缺口」 |
| 17 | 04-交付控制台.md | §0.5 **#7** L109 | 「**部分→缺口** QUAL-K5」+ 现状口径「**K5 Langfuse 明文 ACL 未做**」 | 同 #1 证据：`apps/api/src/routes/ask.ts:99` + `apps/api/tests/ask/http-audit.test.ts:200` + Langfuse 仅 mock（`apps/api/src/obs/ask-tracer.ts:19`） | `漂移·低估` —— K5 范围内今天已无缺口 |
| 18 | 04-交付控制台.md | §0.5 **#8** L110 | 「**部分→缺口** QUAL-L7」+「**孤儿清理 job 未做**」 | 同 #4 证据：`apps/worker/src/ingest/orphan-clean.ts` + `pipeline.ts:84-95`（周期调度仍未落，属真实边界） | `漂移·低估` —— 「未做」已不成立，仅「周期调度未落」仍成立 |
| 19 | 04-交付控制台.md | §0.5 **#11** L113 | 三态「**缺口** B8 + QUAL-TENANT-Q」+「**O4 tenantId 查询闸未做**」 | 同 #7 证据：`apps/api/src/services/retrieve/es-sparse.ts:45-51`、`apps/worker/src/ingest/es-http.ts:49` + 两仓测例 | `漂移·低估` —— B8 缺口仍真，但 O4 那半已落；整格需拆开写 |
| 20 | 04-交付控制台.md | §0.5 **#18** L120 | 「**部分→缺口** QUAL-V3」+「**禁自审未做**」 | `apps/api/src/routes/documents/index.ts:471-478`（approve）与 `508-515`（reject）均回 403 `self_approve_forbidden` · backlog §2.5.2 L330 已标「**已完成**」（wayfinder · fill-must-haves 86） | `漂移·低估` —— 四眼闸 2026-08-24 起已在源码里 |
| 21 | 04-交付控制台.md | §0.5 **#22** L124 | 「**部分→缺口** QUAL-AA1」+「**KB 策略参数写面未做**」 | `apps/api/src/routes/chunk-strategies.ts`（GET/PATCH `/chunk-strategies`、`/schema`、`/for-upload`）+ 审计 `apps/api/src/services/kb-settings-audit.ts` · 测例 `apps/api/tests/kb/chunk-strategies-http.test.ts`、`chunk-strategy-audit.test.ts`、`chunk-strategy-preserves-docs.test.ts` | `漂移·低估` —— 写面与审计早在 2026-09-16 已在（`docs/module-status/api.md:38-42`） |
| 22 | 04-交付控制台.md | §0.5 **#25** L127 | 三态「**部分**（AD1–AD3 引导已接；**≠ 密码登录 / ≠ PUT 锁全码**）」 | 启动引导超管：`apps/api/src/services/superadmin-bootstrap.ts` + `apps/api/src/index.ts`（listen 前）+ `apps/api/tests/acl/superadmin-bootstrap.test.ts` · **写路径锁超管全码已落**：`apps/api/src/routes/platform-users-roles.ts`（`wouldChangeSuperAdminAwayFromFullCatalog`）+ `apps/api/tests/acl/platform-users-roles.test.ts`（`docs/module-status/api.md:77-78`）；backlog §2.5.2 L334 QUAL-SUPER-BOOT 已「已完成」 | `漂移·低估` —— 括号里的「≠ PUT 锁全码」按字面读是「没有」，而源码有且带测；三态「部分」也低估 |
| 23 | 04-交付控制台.md | §0.5 **#31** L132 | 现状口径「…+ `l3_guard_alert_total`（**有**告警 / **无**自动熔断 / **无**面板）」 | 同 #13：`apps/api/src/services/ask/execute.ts:153-157` + `apps/api/tests/obs/l3-rewrite-fuse.test.ts` | `待裁定` —— 同 #13 的口径问题（「自动熔断」是否含进程内闩后停用） |
| 24 | 04-交付控制台.md | §0.5 **#32** L134 | 「**部分→缺口** QUAL-K5」+「真 SDK/非成员明文 ACL 未接」 | 同 #1：审计口 403 有测；Langfuse 无读取面（真 SDK 未接仍成立） | `漂移·低估` —— 「非成员明文 ACL 未接」已不成立，剩「真 SDK 未接」这一真实边界 |
| 25 | 04-交付控制台.md | §0.5 **#33** L135 | 现状口径「剧本 R4–R10 平面配额 **未做**」 | 同 #8：`apps/api/src/obs/plane-quota.ts` + `apps/api/src/index.ts:27` + `apps/api/tests/obs/plane-quota-safe-default.test.ts`；`docs/ops/rate-limit-and-metrics.md:150` | `漂移·低估` —— R10 已落、R6-a 已具备，只剩 R4 / R6-b 划出 |
| 26 | 04-交付控制台.md | §0.3 L66 | 「L3 **有打点+告警**（含主题投诉 / L2 过期闩） / **无**自动关 / **无**面板 / **≠**准出」；同段首句把「L3 自动熔断或面板」列为不承诺 | 同 #13 | `待裁定` —— 同 #13 口径问题；建议与 #13、#23 一并裁定后统一 |
| 27 | 04-交付控制台.md | §0.7 L208–222 | 表内 14 行 HALF-* 全部「**未开始**」 | 与源码相反：`package.json`（`up:apps` / `smoke:half` / `seed:demo`）· `.env.operable.example` · `apps/worker/src/ingest/pdf-text.ts`、`embed-http.ts` · `apps/api/src/routes/documents/index.ts:884` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`（上传/上架）· `apps/admin/src/components/admin-shell.tsx`（KB `ClosedSelect`）· `docs/ops/auth-enforce-pilot.md` · `docs/ops/half-smoke.md` · 且**同文 §0.1 L39 已写「HALF-* 已落地」**、总 backlog §1.2 全「已完成」 | `漂移·低估` —— 14 行全错，且与本文 §0.1、§0.4（P-HALF `14 / 14 实现行`）自相矛盾 |
| 28 | 04-交付控制台.md | §0.6 L155 | 「#7 剧本 K / #32 Langfuse 诚实「部分」」 | 同 #1 / #17 | `漂移·低估` —— 随 #7/#32 一起改 |
| 29 | 04-交付控制台.md | §0.4 L85 **P2-L** | 进度「**3 / ~4**」 | 同表列出的 ID 共 5 个（OPS-1 · B10-RACI · QUAL-1 已完成；B10-followup · OPS-STACK 部分）；backlog 侧对应行状态见 §3 L406-408 | `待裁定` —— 分子 3 与 backlog 已完成 ID 数对得上，但分母「~4」与列出的 5 个 ID 不符，「~」也未定义（属**分母口径**） |
| 30 | `docs/module-status/README.md` | 矩阵 L77 | 「**半产品可运行缺口（已登记、未实现）**：总 backlog §1.2 P-HALF（知识库下拉 / admin 上传 / 上架 active / 一键拉起 / PDF 文本层 / 烟测等）。**未做 ≠ 已具备**」 | 同 #27 证据；另 `docs/module-status/web.md:34` 已记 web 侧 KB `ClosedSelect`、`apps/admin/src/app/(ops)/kb/settings` 已记设置页三写 | `漂移·低估` —— 该句把已落地的 14 条写成「未实现」，是全仓最刺眼的一处（矩阵 mtime 2026-09-15） |
| 31 | docs/module-status/README.md | 矩阵 L78 | 未交付清单含「admin 设置全量 UI（**docTypes / 策略 / KB 绑定写**）」 | 三者均已落：`apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx`、`settings-workspace.tsx:447-457`（docTypes + KB 消费绑定）· `apps/api/src/routes/kb-settings.ts:193`；`docs/module-status/admin.md:51-53,111` 与 `api.md:171` 已改为「类型分区 CRUD 与三档绑定已接，余量＝paramSchema 动态表单 / 平台策略 CRUD」 | `漂移·低估` —— 包文已改、矩阵未改；真余量只剩 paramSchema 动态表单 / 平台策略 CRUD 页 |
| 32 | docs/module-status/README.md | 矩阵表头 L68 | 「### 能力矩阵（**2026-08-12** · 08-11/08-12 全量核对）」 | 表内已含 08-28 之后的条目（`aclPrincipals`、B13 反馈队列、L2 归档底线、L3 告警等），文件 mtime 2026-09-15 | `待裁定` —— 「全量核对」日期戳与实际内容不符；是重核矩阵还是改日期戳（或改成「增量回写」）由人定 |
| 33 | docs/module-status/README.md | 矩阵 L70–L79 各能力行（除 L77/L78） | 入库闭环 / ask / 会话 / 鉴权 / 运营面 / 反馈 / 网关 / 观测 / 契约 / 工具链 十行 | 逐行核对未见与源码冲突：默认 mock 与开关（`apps/api/src/env.ts`）、`staging/prod 无合法扫描配置`（`apps/worker/src/scan-mode-policy.ts`）、`ES 查询期强制 tenantId+kbId`（`es-sparse.ts:128`）、`LC 后台`、`12 条 ops href`（`packages/admin-catalog/src/menu-tree.ts:98-111`，实数 12）均成立 | `终态一致` —— 十行不含与源码冲突的声明；矩阵缺 L7 / E4 的字样属一句话摘要，不构成误述（建议随 #30 一并补） |
| 34 | docs/module-status/api.md · worker.md · db.md | 元信息「**最近更新**」L10 / L10 / L9 | 三份都写「2026-09-17（… `0019`）」，无 2026-09-19 条目 | 三份文件 mtime 均 **2026-09-19 18:01**，且正文已含 09-19 内容（api.md L45 去重端点、L133 签字包派生；worker.md L45-47 孤儿清理 / 待审；db.md L36 迁移 `0020` / `0021`） | `漂移·低估` —— 元信息栏漏记本批回写，读者会误判文档未覆盖 09-19 |
| 35 | docs/module-status/api.md · worker.md | api.md L161「入库报告完整语义」· worker.md L62 与 L84 | 三处均写「**无** `pending_review`」 | 报告其实已带该动作：契约 `packages/contracts/src/ingest/ingest-report.contract.ts:11-19`（`action: CrossDocDedupeActionSchema` + `heldChunkId`）· 同文 api.md L46 自认「action ∈ `skip_index|pending_review`，入审时带 `heldChunkId`」· worker.md L47 亦自认入审落库 · `apps/worker/tests/index.md:38` 断言「报告冲突对带 heldChunkId」 | `漂移·低估` —— E4 落地后旧边界句未改，与同篇正文冲突（真实余量是「无处置/聚合指标 + 无 admin 审阅面」） |
| 36 | docs/module-status/api.md · worker.md · db.md | 与 11 个 ID 直接相关的正文段：api.md L45/L113/L133 · worker.md L45-47/L83 · db.md L36/L38/L41 | 去重端点 / tenantId+kbId 强制 / 签字包读时派生 / 孤儿清理 / 待审落点 / `active_index_version` / 迁移 22 条与 meta 只余 `0000` 快照 | 逐条核对均与源码相符：`0020`/`0021` 存在且 `_journal.json` 共 22 条（`entries.length=22`，末三条 `0019/0020/0021`）· `packages/db/drizzle/meta/` 确只有 `0000_snapshot.json` · `chunk-strategy-preserves-docs.test.ts`、`orphan-clean.test.ts` 等均在 `tests/index.md` 登记为「现行」 | `终态一致` —— 包文是本批回写最到位的镜像（除 #34 / #35 两处） |
| 37 | docs/module-status/admin.md | L31（十二条 href）· L52（策略弹窗）· L37（入库报告「不是 pending_review」） | 12 条落地 href；设置页有分片策略弹窗；报告行不是待审 UI | `packages/admin-catalog/src/menu-tree.ts:98-111` 实数 12 · `chunk-strategy-panel.tsx` + `tests/ops/chunk-strategy-panel.test.tsx` · 待审审阅面确实未做（前图把 admin 审阅面留雾，`.scratch/close-p2-exit-gaps/map.md:50`） | `终态一致` —— 与源码相符；AB8 的工程侧因此已是「已具备」（见 #10） |
| 38 | docs/module-status/web.md | 全篇（L34 KB `ClosedSelect` · L70 rewrite 边界 · L63 B11 类型） | KB 只列可见库、rewrite 强制关、类型可选 | `apps/web/src/components/ask-panel.tsx` · `apps/web/src/hooks/use-knowledge-ask.ts`（`getScope` / `getAskFinal`）；无与源码冲突的声明 | `终态一致` —— 本包文与 11 个 ID 无关，未见漂移 |
| 39 | 04-交付控制台.md | §0.1 L39 · §0.2 L45–63 · §0.2 L64 · §0.4 L84 / L86 · §0.5 L139-140 | §0.1「HALF-* 已落地」· §0.2 P2-W/P2-L/P2-S/P2-X 勾选 · §0.2「映射表其余缺口 ID / 待盘点行」已勾 · §0.4 P-HALF `14 / 14 实现行`、P2-X `2 / 3` · §0.5 待盘点 **0 行** | 与源码/backlog 一致：HALF 见 #27 证据；P2-X = OPS-2 ✅（backlog §2.4 L277）+ QUAL-3 ✅（§2.5 L291）+ QUAL-2 延期（§2.5 L290）；§0.5 表中确无「待盘点」三态行（逐行 35 行核对） | `终态一致` —— 这些格子是对的，恰恰反证 §0.7 与 §0.5 十个「缺口」格子（#15–#25）是漏改，而非口径之争 |
| 40 | 04-交付控制台.md · status.md | §0.2 L52「**B10-followup** 各≥30 真跑 + eval 账本（live ×2 · `signoffEligible=true`）」· §0.5 #1 同数字 · status.md §1.1 L151 | 「真跑 2026-08-14 live ×2（30/30 · `signoffEligible=true`）」 | `artifacts/` 被 `.gitignore` 忽略且本机不存在（`artifacts/l1-last-run.*` / `l1-gate-snapshot.json`），仓内**无**可核对的 live 运行产物；`fixtures/l1/sample-report.md` 按 api.md L130 自述「非 live 签字数字」；唯一记载在 task 叙事 `.trellis/tasks/archive/2026-08/08-14-b10-followup-live-signoff/`（无产物文件） | `待裁定` —— 判定优先级里 task 叙事低于状态文档，且真跑产物未入库；缺的证据是「一次可核对的 live 跑产物或 eval_runs 行」 |

**高估核查**：逐行找过反向漂移，**0 处**。可疑候选均已排掉：backlog §1.2 HALF 全「已完成」（证据见 #14）、§0.2 L64「缺口清零」（工程缺口确已清零）、`admin.md` 「12 条 href」（`ADMIN_IMPLEMENTED_HREFS` 实数 12）、`db.md` 「journal 22 条 / meta 只余 `0000`」（实测相符）、`api.md` 签字包派生（`eval-runs.ts:312` 实证）。

---

## 建议回写清单

### A. `.trellis/tasks/08-06-project-backlog/status.md`

1. **L322（§2.5.2 表头）**：把「**划出 3**」改成「**划出 4**」（若采用子项口径）；如采用 ID 口径则改成「**划出 3 张 ID**（PLANE 含 R4 + R6-b 两个子项 · ACL-CAP · G3）」。二选一由人定（见 #12）。
2. **L326 整行替换为**：
```
| **QUAL-K5** | K5 | 非成员 platform_admin 读 Langfuse/审计 → 无该 KB evidence 明文 | **已完成** | wayfinder | [08](../../../.scratch/close-p2-exit-gaps/issues/08-qual-k5-langfuse-acl.md) · 审计口成员闸 403（`apps/api/src/routes/ask.ts` · `apps/api/tests/ask/http-audit.test.ts`）· Langfuse 仅 mock 且**无读取面** · 禁止再 `task.py create` |
```
3. **L327 整行替换为**：
```
| **QUAL-E4** | E4 | 跨 doc 近重复 + 指标 + pending_review | **已完成** | wayfinder | [10](../../../.scratch/close-p2-exit-gaps/issues/10-qual-e4-pending-review.md) · 迁移 `0021` · `apps/worker/src/ingest/cross-doc-dedupe.ts` · `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve`；admin 审阅面仍属雾 |
```
4. **L328 整行替换为**：
```
| **QUAL-E5** | E5 | L1 contextualize 故障 → L0 回退仍 ready | **已完成** | wayfinder | [11](../../../.scratch/close-p2-exit-gaps/issues/11-qual-e5-contextualize-evidence.md) · `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`（未验证真 Gateway） |
```
5. **L329 整行替换为**：
```
| **QUAL-L7** | L7 | 孤儿清理 job；不碰当前激活 version | **已完成** | wayfinder | [09](../../../.scratch/close-p2-exit-gaps/issues/09-qual-l7-orphan-clean.md) · 迁移 `0020` · `apps/worker/src/ingest/orphan-clean.ts`（三条护栏）· 触发落「文档 failed」；**周期调度未落地**；真 ES 侧属 B8 |
```
6. **L331 整行替换为**：
```
| **QUAL-AA1** | AA1 | KB 策略参数可保存+审计；旧文档 version 不变 | **已完成** | wayfinder | [13](../../../.scratch/close-p2-exit-gaps/issues/13-qual-aa1-kb-strategy-params.md) · `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts` |
```
7. **L332（QUAL-ACL-CAP）**：状态列由「**未开始**」改为「**已关闭（划出）**」，指针由 `task 08-24-qual-acl-filter-cap` 改为：
```
[06](../../../.scratch/close-p2-exit-gaps/issues/06-qual-acl-cap.md) · 全仓无 `allowedDocIds` 生产者（仅 contracts 负向测）→ 不造无生产者半接线
```
   同 PR 在 §0.1 标签表增一行（否则「已关闭（划出）」是新标签）：
```
| **已关闭（划出）** | 经工单/ADR 裁定**无实现对象**或**无口径**而主动关闭；**不**表示已实现，也**不**计入子包分子 |
```
8. **L333 整行替换为**：
```
| **QUAL-TENANT-Q** | O4 | 无 `tenantId` 的 ES query/bulk builder 必须失败 | **已完成** | wayfinder | [05](../../../.scratch/close-p2-exit-gaps/issues/05-qual-tenant-query.md) · `apps/api/src/services/retrieve/es-sparse.ts` `requireTenantId` + `apps/worker/src/ingest/es-http.ts`；≠ O1 kbId 过滤测 |
```
9. **L335（QUAL-PLANE）**：状态列改为「**部分**」，指针整段替换为：
```
[07](../../../.scratch/close-p2-exit-gaps/issues/07-qual-plane-quota.md) · R10 安全默认 `apps/api/src/obs/plane-quota.ts`（启动 warning，非 fail closed）· R6-a「无半套 ready」已具备 · **R4 / R6-b 已划出**（无落点 / 无口径）· **≠** P0 红线 R1–R10
```
10. **L336（QUAL-G3）**：状态列改为「**已关闭（划出）**」，指针替换为：
```
[14](../../../.scratch/close-p2-exit-gaps/issues/14-qual-g3-gold-review-gate.md) · `fixtures/l1/gold.yaml` 是静态手写 seed、全仓无生成器 → 无可加闸对象；运营表回流见 [反馈回流黄金集最小闭环](../../../.scratch/fill-must-haves/issues/84-feedback-promote-gold-min.md)（≠ gold.yaml）
```
11. **L337 整行替换为**：
```
| **QUAL-AB8** | AB8 | 分片策略「设置」打开 ADR-053 弹窗；保存服 AA 语义 | **已完成** | wayfinder | [15](../../../.scratch/close-p2-exit-gaps/issues/15-qual-ab8-strategy-dialog.md) · `apps/admin/.../kb/settings/_components/chunk-strategy-panel.tsx` · `apps/admin/tests/ops/chunk-strategy-panel.test.tsx` · ≠ 只读展示已实现码 |
```
12. **L338 整行替换为**：
```
| **QUAL-AC7** | AC7 | KB 尝试绑 judge → 400/403；judge 仅平台 | **已完成** | wayfinder | [12](../../../.scratch/close-p2-exit-gaps/issues/12-qual-ac7-kb-judge-ban.md) · `PutKbConsumeBindingsBodySchema`（`packages/contracts/src/system/model-gateway.contract.ts`）· `apps/api/tests/kb/kb-consume-bindings-http.test.ts` |
```
13. **L158（P2.5-L3A 指针）**：把「**无**自动关」改为：
```
**有**进程内闩后停用 rewrite（`isL3RewriteFused`） / **无**写 env 的全局关 / **无**面板
```
   （如 #13 裁定「自动关」不含进程内熔断，则改为：**有**进程内闩后停用 rewrite / **无**写 env 的全局关，并把该口径在 §0.1 或本节加一句定义。）

### B. `prds/12-delivery-guides/04-交付控制台.md`

14. **§0.5 #1（L103）现状口径**改为：
```
gold 60 + live ×2 `retrieve_mode=live` / 30/30 / `signoffEligible=true`；`l1-gate-snapshot.json` 绑定 eval 身份；**工程侧已闭合**：`qualitySnapshot.gatePackageId` / `effectiveAt` 从 `eval_runs` 读时派生（`apps/api/src/services/eval-runs.ts`）；coverage=0 / 缺人签 → `businessPass=false`（余下仅业务人签）
```
15. **§0.5 #4（L106）整行**改为：
```
| 4 | 剧本 B1（含角色越权 B1-5） | O/W | **已具备 + 证据** QUAL-1 | B4-W hydrate ✅；QUAL-1 红线测 ✅（`tests/auth/enforce-401.test.ts`）；`AUTH_ENFORCE` 仓库默认仍关，试点按策略 A 开 |
```
16. **§0.5 #7（L109）整行**改为：
```
| 7 | 剧本 K（单一真相 / 观测服从成员） | T | **已具备 + 证据** QUAL-K5 | K2 成员闸 ✅；K5 审计口非成员 403（`tests/ask/http-audit.test.ts`），Langfuse 仅 mock 且无读取面；K4 当轮 citation←evidence.text（Mongo 仍 B9）；K6 渲染消毒走测补 |
```
17. **§0.5 #8（L110）整行**改为：
```
| 8 | 剧本 L（入库末段双就绪/manifest） | T | **已具备 + 证据** QUAL-L7 | mock ES 双就绪闭环 ✅；孤儿清理已落（`ingest/orphan-clean.ts`，三条护栏 + 11 条测例），触发落「文档 failed」；**周期调度未落** · **≠** 生产 ES |
```
18. **§0.5 #11（L113）整行**改为：
```
| 11 | 剧本 O（ES 布局 O1/O2/O4） | X/L | **缺口** B8（QUAL-TENANT-Q 已落） | live 切片 OPS-1；O1 测 kbId filter（≠ tenantId）；O4 双仓 builder 缺 `tenantId` 即抛（`es-sparse.ts` / `es-http.ts` + 双仓测例）；多租户独立索引布局仍属 B8 |
```
19. **§0.5 #18（L120）整行**改为：
```
| 18 | 审批闸剧本 V（upload 源） | O/T | **已具备 + 证据** QUAL-V3 | 审批 API/UI + scan 闸 ✅；禁自审 403 `self_approve_forbidden`（approve / reject 同口径，ADR-048 #4） |
```
20. **§0.5 #22（L124）整行**改为：
```
| 22 | 分片策略剧本 AA | S | **已具备 + 证据** QUAL-AA1 | B12 注册表+complete/reindex 闸 ✅；KB 策略参数写面 + `kb_settings_audits` 审计 ✅；保存不回收既有文档 version / chunk 边界（`chunk-strategy-preserves-docs.test.ts`） |
```
21. **§0.5 #25（L127）整行**改为：
```
| 25 | 系统用户与角色剧本 AD | W/O | **已具备 + 证据** QUAL-SUPER-BOOT | B4 CRUD + B4-W hydrate ✅；启动引导超管 ✅；写路径锁超管全码 ✅（`tests/acl/platform-users-roles.test.ts`）；**≠** 密码登录 / **≠** 生产 IdP |
```
22. **§0.5 #31（L132）现状口径**：把「**无**自动熔断」改为「**有**进程内闩后停用 rewrite / **无**写 env 的全局关」（口径同 #13）。
23. **§0.5 #32（L134）整行**改为：
```
| 32 | Langfuse 全链路 | T | **部分**（K5 ACL 已具备；真 SDK 未接） | memory span + `LANGFUSE_ENABLED` mock export；审计口非成员 403 已具备、**无**读取面；真 SDK 未接 · 属雾 |
```
24. **§0.5 #33（L135）现状口径**改为：
```
`graph/budget.ts` + `run.ts` tryCharge*；R10 staging/prod 缺 plane 配额 → 启动 warning + 安全默认（`obs/plane-quota.ts`）；R6-a「无半套 ready」已具备；R4 `maxEmbedCalls` / R6-b embed TPM **划出**（无落点 / 无口径）· ≠ P0 红线
```
25. **§0.6 L155**：把「#7 剧本 K / #32 Langfuse 诚实「部分」」改为：
```
#7 剧本 K 工程侧已具备（K5 审计口成员闸；Langfuse 无读取面）；#32 仍「部分」（真 Langfuse SDK 未接）
```
26. **§0.7（L208–222）**：14 行状态列全部由「未开始」改为「已完成」，并把「要补什么」列换成指针（可整表替换）：
```
| 序 | ID | 要补什么 | 状态 |
|:--:|----|----------|:----:|
| 1 | HALF-ENV | 可复制 http/s3/mongo env（不改 CI 默认） | 已完成 |
| 2 | HALF-MONGO | compose Mongo 真起 + parse 写库冒烟 | 已完成 |
| 3 | HALF-UP | 一键拉起 api+worker（`pnpm up:apps`） | 已完成 |
| 4 | HALF-SMOKE | 上传→审批→入库→上架→问答 烟测（`pnpm smoke:half`） | 已完成 |
| 5 | HALF-SEED | 演示种子 KB+成员+可问文档（`pnpm seed:demo`） | 已完成 |
| 6 | HALF-KB | admin/web 知识库下拉 | 已完成 |
| 7 | HALF-UPLUI | admin 上传入口 | 已完成 |
| 8 | HALF-PUB | 双就绪后上架 active | 已完成 |
| 9 | HALF-JOBS | 入库阶段只读查询 + 页上可见 | 已完成 |
| 10 | HALF-PARSE | txt/md UTF-8 明示 | 已完成 |
| 11 | HALF-PDF | PDF 文本层（无 OCR） | 已完成 |
| 12 | HALF-EMBED | worker 可选真向量（默认仍 mock） | 已完成 |
| 13 | HALF-AUTHDOC | 试点打开鉴权的步骤（不改默认） | 已完成 |
| 14 | HALF-KBSET | 设置页 docTypes / 策略 / KB 绑定写 | 已完成 |

（SSOT = 总 backlog §1.2；本表为派生导航，默认仍 mock / AUTH 关。）
```
   并在 **§10.1 变更日志**顶部补一条：
```
| 2026-08-21 | 实施：**P-HALF 全 14 条 HALF-*** 落地（`.env.operable.example` · Mongo 冒烟 · `up:apps` · `smoke:half` · `seed:demo` · KB 下拉 · admin 上传/上架/阶段 · txt/md/PDF 文本层 · http embed 可选 · AUTH 试点配方 · 设置页 docTypes/策略/KB 绑定）；默认仍 mock / AUTH 关；**≠** 可签字 / **≠** 生产 ES / **≠** 真杀毒 |
```
27. **§0.4 P2-L（L85）**：把「**3 / ~4**」改为「**3 / 5**」（OPS-1 · B10-RACI · QUAL-1 计入；B10-followup · OPS-STACK 为部分）；若裁定分母只数「签字关键路径 ID」，则改「**3 / 4**」并在公式下加一句分母定义（见 #29）。

### C. `docs/module-status/`

28. **`README.md` L77 整句替换为**：
```
**半产品可运行（P-HALF · 已落地，2026-08-21）**：总 backlog §1.2 的 14 条 HALF-* 均已实现（`pnpm up:apps` / `smoke:half` / `seed:demo` · `.env.operable.example` · KB 下拉 · admin 上传/上架/入库阶段 · PDF 文本层 · http embed 可选 · AUTH 试点配方 · 设置页 docTypes+策略+KB 绑定写）；**默认仍 mock / AUTH 关**（**≠** 生产 ES / **≠** 真杀毒 / **≠** 可签字）。
```
29. **`README.md` L78**：从「矩阵未覆盖、且明确尚未交付的能力」清单里删去「admin 设置全量 UI（docTypes/策略/KB 绑定写）」，替换为：
```
admin 设置**余量**（paramSchema 动态表单 / 平台策略 CRUD 页）
```
30. **`README.md` 矩阵表头 L68 与 L70 入库闭环行**：表头改为「### 能力矩阵（按包文增量回写；最近一次全量核对 2026-08-12，最近一次修订 2026-09-19）」，并在「入库闭环」行末补一句：
```
**跨 doc 近重复可入审（`pending_review`）· 孤儿清理已落（周期调度未落）**
```
31. **`api.md` L10 / `worker.md` L10 / `db.md` L9「最近更新」**：各在句首补 2026-09-19 条目，例如 api.md：
```
| 最近更新 | 2026-09-19（剧本 E4 去重冲突 resolve 端点；ADR-046 签字包读时派生；O4 双仓 tenantId 契约闸；AA1 保文档断言）；2026-09-17（…） |
```
   worker.md：
```
| 最近更新 | 2026-09-19（剧本 L7 孤儿清理 `orphan-clean.ts`；剧本 E4 `pending_review` 入审；O4 bulk builder 租户闸）；2026-09-17（…） |
```
   db.md：
```
| 最近更新 | 2026-09-19（`documents.active_index_version`，migration `0020`；`chunks.duplicate_of` / `dedupe_status`，migration `0021`；均无默认）；2026-09-17（…） |
```
32. **`api.md` L161 否定句**改为：
```
**有** `pending_review` 冲突对（带 `heldChunkId`），但**无**处置 / 聚合指标、**无** admin 审阅面 / L0 vs L1 Hit@k / 「高度重复」阈值提示
```
33. **`worker.md` L62 与 L84 否定句**同样改为：
```
**有** `pending_review` 冲突对（带 `heldChunkId`），但**无**处置 / 聚合指标与审阅面 / 生产 LSH / Hit@k / 「高度重复」阈值提示
```
34. **`status.md` §1.1 L151（B10-followup）与控制台 §0.2 L52 / §0.5 #1**：live 真跑数字若继续保留，须补一条可核对指针（例如「真跑产物以 `artifacts/l1-gate-snapshot.json` 为准，**该目录被 gitignore，仓内不留证**」），或把「真跑 ✅」降级为「见 task 叙事（`.trellis/tasks/archive/2026-08/08-14-b10-followup-live-signoff/`）」。这条属 #40 的待裁定项，未定前**不要**把数字写成「已具备 + 证据」。
