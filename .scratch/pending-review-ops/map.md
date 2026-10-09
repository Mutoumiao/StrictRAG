# 「待审冲突」运营可见可办 + 入库账本镜像纠偏

Label: wayfinder:map
Status: open（前沿：05；01–04 已收口）

## Destination

把跨文档近重复的 `pending_review` 待审冲突，从「有端点、有落库、有报告字段、**无运营面**」补成运营台**可发现、可二选一处置、可核对**。到达时同时满足四件：

1. **可发现** —— 运营（持 `doc.editor` 的 KB 成员）不读源码、不手拼 uuid，就能从运营台看到「哪些文档有 `pending_review` 待审块」。
2. **可办** —— 二选一处置走**既有** `POST /api/v1/documents/:docId/dedupe-conflicts/:chunkId/resolve`（不新增权限码、不代跑 reindex），前端有该控件，并有 RTL 测例钉住「谁看得见 / 点了写什么 / 不许点」。
3. **可核对** —— 处置前后 `chunks.dedupe_status` / `duplicate_of` 的终态可读出，且与入库报告 `conflictPairs`（带 `heldChunkId`）口径一致；处置结果不得与该报告自相矛盾。
4. **镜像一致** —— `docs/module-status/{admin,api,worker,db}.md` 与覆盖表 / 交付控制台 §0 里凡写「无审阅面 / 无查询面」的陈述，都按源码改成终态或如实记为债。

**不含**：真 ES 侧 / 生产 LSH / `downrank` 降权 / worker 侧自动处置（各要 ADR 或新基建）；不改 `prds/00–11`；不放宽任何门禁；不动任何仓库默认开关。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（当前 0.4.32/0.4.33）为准；总 backlog 是**调度行**、交付控制台 §0 是**派生进度视图**、`docs/testing/coverage.md` 是**派生对照**，三者**均非接口契约**。**IS 以源码为准**，`docs/module-status/` 是镜像。
- **来源（雾清单定位）**：`.scratch/fog-inventory-2026-09-23.md` 簇 **17**（`pending_review` 的 admin 审阅面；离线可做 RTL）与簇 **14**（`GET …/ingest-jobs` 暴露面粒度）。两张前图都把它记为「下一张图的起点」：`.scratch/close-p2-exit-gaps/map.md` Not yet specified 末条 · `.scratch/p2-exit-evidence/map.md` Not yet specified 倒数第三条。
- **前图**：`close-p2-exit-gaps`（20/20）把 `pending_review` 的**端点 + 数据面**落地（工单 10 · 迁移 `0021`）；`p2-exit-evidence`（14/14）把镜像与覆盖表回写到位。本图补的是**运营面**，不重做端点。
- 每轮先读：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/04-pipelines/01-offline-ingest.md` §5.1 · `prds/03-data/01-postgresql-schema.md` §3.2 · `prds/12-delivery-guides/03-功能地图.md` §4.3 · `docs/module-status/{admin,api,worker}.md`。写代码前读 `.trellis/spec/<包>/index.md`（api → `api/backend`；admin → `admin/frontend`）。
- **本图携带执行**：工单可以动手改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口批次跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 简介」必须简体中文，并登记该包 `tests/index.md`；**禁止**按源码一对一镜像造测例。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `GATEWAY_MODE` / `SESSION_REWRITE_ENABLED` 的默认值一律不动。
- **权限口径**：运行时授权**以权限码为准**（ADR-051 / ADR-035）；`kb_members.role` 不参与运行时闸。处置端点权限 = `doc.editor`（既有），**不新增权限码**。
- **本机限制**：无浏览器验证手段 → 视觉回归不可验；UI 行为用 RTL 验收（离线）。真 ES / 真模型 / 人签不在本图。

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 现状核实](./issues/01-research-is-verify.md) — 全链核清：`dedupe_status`/`duplicate_of` 只由 worker `pipeline.ts:580-598` 写（迁移 `0021`，唯一取值 `pending_review`）；报告中 `pending_review` 项**必带** `heldChunkId` 且已由 admin 拉到；处置端点 `POST …/dedupe-conflicts/:chunkId/resolve`（`doc.editor` 始终验 + 成员闸 `always`）**已有**，**无**「列待审冲突」读端点；admin **无**任何审阅入口（只把 `otherDocId` 拼成文本，**不显示 `action`/`heldChunkId`**）；处置**零审计**；`GET …/ingest-jobs` = `doc.view`(WhenEnforced) + 成员闸。**镜像漂移 6 处**：「无查询面」类旧句与已落的 per-doc 只读 API 不符（`worker.md` · `db.md` · `README.md`）。
- [02 · 裁定：审阅面落点 / 发现路径 / 权限 / 审计](./issues/02-dec-review-surface.md) — **发现路径 = 复用文档页已读的入库报告**（`conflictPairs` 已带 `heldChunkId`，缺的是渲染与动作）→ **不新开 api 读端点**（无生产者的半接线 + 新暴露面）；**落点 = 文档行展开详情内的入库报告区块**；**权限沿用 `doc.editor`**（不新增码，UI 判据与既有「保存」按钮同源）；`winner='this'` 回 `reindexRequired=true` → UI 提示须自行 Reindex、**不代跑**；**审计本图不做**，记债（白名单同类不同待：`PATCH` 元数据写与 `supersede` 状态迁移同样不在内，只开一个口会口径分裂）；**簇 14 不改语义、只纠镜像**。
- [03 · 落：api 侧](./issues/03-task-api-discover-surface.md) — **api 源码零改动**（裁定不新端点；既有 5 条 resolve 测例 + 成员闸测已满足裁定语义，**不**改写）。补 01 号研究点名的缺口：新增 contracts 契约测 **4 条**（body 只收 `winner` 两取值且拒未知字段；响应须回显三身份字段 + `reindexRequired`），登记 `index.md`。
- [04 · 落：admin 可见可办](./issues/04-task-admin-review-ui.md) — 新增 `dedupe-review.services.ts`（`pendingReviewConflicts` 只挑 `pending_review` ∧ 非空 `heldChunkId`、按 `heldChunkId` 去重；`dedupeWinnerLabel`；`resolvePendingConflict` 把 400/404 判**终态**）；`api.ts` 加 `resolveDedupeConflict`（**既有**端点，不新增码）；文档行展开的入库报告区块内加「待审冲突」两按钮块（处置后停用、无码只读、明写报告不改写 + 须自行 Reindex）。新增 RTL **11 条**，登记 `index.md`。**反证**：去掉 `action` 判据 → 2 条变红（首轮因夹具未带 `heldChunkId` 而无效，已补夹具）。门禁：admin **39 文件 / 198 通过** · contracts **37 / 321** · lint 零 warning。
## Not yet specified

- **文档内容处置类是否纳入 Pino 写审计白名单**（工单 02 裁定带出的债）：`admin-write-audit.ts` 的白名单覆盖成员 / 审批 / 生命周期 / 平台 admin / KB 设置写，**不含** `POST …/dedupe-conflicts/:chunkId/resolve`、`POST …/supersede`、`PATCH /documents/:docId`、`PUT /documents/:docId/acl`。只给其中一条开口会造成同类路径口径分裂 → 准入条件 = 先定「哪些路径属管理写」的口径（一个裁定），再一次性对齐白名单 + 补测。
- **`ingest_jobs` 完整运维查询面（簇 14）**：今天只有 **per-doc 只读**（`GET /api/v1/documents/:docId/ingest-jobs`，HALF-JOBS 落）与 admin 文档旁看阶段；**跨文档**列表 / 筛选 / 分页**未落**，且镜像（`worker.md` · `db.md`）仍写「无查询面」。本图只**纠偏镜像**；要不要建跨文档运维面，取决于「成员即可读全量账本」的暴露面裁定（见工单 02），留作雾。
- **`pending_review` 的聚合指标**：入库报告只有逐条 `conflictPairs`，无「待审积压」计数。要加指标须先定消费者（本仓 worker 无 metrics 出口，正解是进报告或 ask 侧）。
- **`downrank` 处置结果**：PRD §5.1 的合法取值，写入端已 400 拒绝；若将来要做，`dedupe_status` 需第二取值，属新设计。
- **`duplicate_of` 指向的「对方块」侧面对话**：本仓处置只动**被拦下的本块**（`duplicate_of` 指向对方），不碰对方文档；运营若想看到「对方长什么样」须跨库读面，属雾。

## Out of scope

- **worker 侧自动处置**（自动选赢家）：PRD 未定义；人工二选一是既定口径 · [端点已落](../../apps/api/src/routes/documents/index.ts)
- **生产 LSH / 阈值调整**：字 3-gram Jaccard ≥ 0.9 是演示实现，数据 PRD 无阈值；属 B8/新设计
- **`downrank` 跨 doc 去重动作**：无检索层降权实现 · 前图已划出
- **真 ES 侧清理 / 多租户独立索引**：B8
- **改 `prds/00–11` 已冻语义**（须 ADR → 改 PRD → 升 `prds/README.md` 版本）
- **admin 站规清扫**（原生 `<select>` 替换）：视觉回归不可验（本机无浏览器）
- 把「已具备最小 / 默认关」读成「生产已上 / 可签字」
