# 按映射表收口 Phase 2 出口工程缺口

Label: wayfinder:map
Status: open

## Destination

把 `prds/12-delivery-guides/04-交付控制台.md` §0.5 的 Phase 2 出口映射表上**所有挂在工程代码上的**缺口行清零：总 backlog §2.5.2 已挂号的验收剧本缺实现（QUAL-K5 · E4 · E5 · L7 · AA1 · ACL-CAP · TENANT-Q · PLANE · G3 · AB8 · AC7）全部落到源码并留可核对证据；挡住 L7 / E4 的两条前置（文档「当前激活 version」表示 · `pending_review` 落点与端点）先出决定。到达时映射表不再有「缺口 ID」行——剩下的是 #1 业务人签与 #9 QUAL-2 延期债（两者显式不在本图）。

## Notes

- 域：StrictRAG。WHAT 冲突以 `prds/00–11` 为准；总 backlog §2.5.2 是调度行、`docs/testing/coverage.md` 是派生对照，**均非接口契约**。IS 以源码为准，`docs/module-status/` 是镜像。
- **前图**：[`fill-must-haves`](../fill-must-haves/map.md) 已 106/106 收口。本图是它的续图：前图留下的「缺实现」与「前置未解」在这里收。
- 每轮先读：本图、`docs/agents/issue-tracker.md`、`docs/agents/domain.md`、`docs/testing/coverage.md` + 相关分册、`.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md`、相关包 `docs/module-status/`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**：工单可以动手写代码补缺口，不只锁决策。缺口**只**在本图工单上做；`.trellis/tasks/08-06-project-backlog/` 只留指针与勾选。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint` + 相关包测试；收口批次跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头目标/简介用简体中文，并登记 index。
- **站规（UI）**：web / admin 新下拉必须基于 `@strict-rag/ui` 关闭列表，禁止浏览器原生 `<select>` 外壳。`Button` / `Input` / `Textarea` 仍走 ui 包。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸。
- 不改仓库默认开关以示「完成」：`AUTH_ENFORCE`、`DEPT_ACL_ENFORCE`、rewrite、OCR、`INGEST_CONTEXTUALIZE_MODE` 的默认值不在本图放宽或收紧。

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [核定 §2.5.2 各 ID 在 HEAD 的真实缺口](./issues/01-verify-gap-is.md) — 11 个挂 ID 收缩为：2 张划出（ACL-CAP 无生产者 · G3 无实现对象）、2 张登记滞后（AB8 已由 06+82 收口 · AC7 已由 78 收口）、2 张补测（E5 的「文档仍 ready」端到端断言 · AA1 的「旧文档 version / 边界不变」数据级断言）、PLANE 缺 R4/R6/R10、TENANT-Q 缺「缺 `tenantId` 即失败」门禁与负向测；三条前置（激活 version 表示 · `pending_review` 三处 · 签字包回填）**均仍未解**。证据：[gap-is-a.md](./research/gap-is-a.md) · [gap-is-b.md](./research/gap-is-b.md)
- [裁定本图第一批执行顺序](./issues/02-first-batch-order.md) — 一批三张串行（**PLANE R4+R10 → E5 补测 → AA1 补测**，全为无硬前置的收口型工单）；立即可关四张（[ACL-CAP](./issues/06-qual-acl-cap.md) 划出 · [G3](./issues/14-qual-g3-gold-review-gate.md) 划出 · [AC7](./issues/12-qual-ac7-kb-judge-ban.md) 已收口 · [AB8](./issues/15-qual-ab8-strategy-dialog.md) 已收口）；新开五张决定/研究票（[TENANT-Q 口径](./issues/17-dec-tenant-q-scope.md) · [K5 闸](./issues/18-dec-k5-trace-acl.md) · [签字包来源](./issues/16-dec-signoff-package-source.md) · [embed TPM](./issues/19-research-embed-tpm.md) · 及既有的 [激活 version](./issues/03-dec-active-version.md) / [pending_review](./issues/04-dec-pending-review.md)）；不做项见票内。
- [QUAL-PLANE R4 + R10](./issues/07-qual-plane-quota.md) — **R10 已落**：新增 `obs/plane-quota.ts`，staging/production 缺 plane 配额（`0`）→ 启动 warning + 安全默认 `30`（数值取运维文档试点值），**非 fail closed**；dev/test 与仓库默认逐位不变；路由改读 `planeQuotas.{ask,ingest}.rpm`；6 条新测 + 门禁 8/8 · 8/8 · 11/11（api 138/884）。**R4 划出范围**：本仓无 runtime 图配置入口（`graphProfile` 0 命中 · KB 设置 strict 白名单 · `budgetOverride` 标注「生产勿传」），护栏属未来 profile loader。
- [QUAL-E5](./issues/11-qual-e5-contextualize-evidence.md) — 判为**缺测**（源码已满足 Then）。新增 `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`（7 条）：500 / 503 / 畸形 / 空输出 / AbortError 各注入一次，走完 chunk→embed→es_index，断言 `status=ready` 且 `contextSource=l0_fallback`、计数 `(0,1)` 不被后阶段复写、正文不被改写；成功路径作对照。**反证**：破坏回退后 6/7 变红。未验证真 Gateway；真超时无注入点（未加 timeout 参数）。
- [QUAL-AA1](./issues/13-qual-aa1-kb-strategy-params.md) — 判为**部分已做**（「可保存 + 审计」已由前图 88 覆盖），只补数据级断言。新增 `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts`（3 条）：文档 + chunk 边界夹具为唯一「被改即变红」对象，含正向对照防假绿。**反证**：路由里插一句文档写仓 → 3/3 变红。**第一批三张（07 / 11 / 13）已收官**；下一步需再裁定。
- [裁定文档「当前激活 version」表示](./issues/03-dec-active-version.md) — PRD 早已把「激活 version」当作独立于 `index_version` 的概念（§2.2「双就绪 → `ready` + **原子**激活」· ORM §「事务用于 `index_version` 激活」· L「dense+sparse 均成功才 ready 并激活」）。裁定：`documents` 加 `active_index_version`（**可空无默认**），**只在 `es_index` 成功那次与 `status='ready'` 同一条 UPDATE 写**；孤儿清理护栏 = 不删 `active_index_version`、不删在飞 `index_version`、`NULL` 时一律不动手；**检索闸不改**（PRD 逐字是「匹配当前 `index_version`」）；迁移 `0020`（手写 SQL + journal）。**更正前图前提**：reindex 失败时旧版数据虽在，但文档在 chunk 段即离开 `ready`，双闸门已挡住——风险是「删掉重试/回退仍需要的那一版」，不是「删掉正在服务的版本」。
- [裁定 `pending_review` 落点 / 端点 / KB 策略位](./issues/04-dec-pending-review.md) — 落点 = `chunks` 两列 `duplicate_of` + `dedupe_status`（仅取值 `'pending_review'`，处理完回 `NULL`，列名取自数据 PRD §3.2）；KB 策略位 = `config_json.crossDocDedupeAction`（默认 `skip_index`，白名单只收 `skip_index | pending_review`，**`downrank` 一律 400 拒绝**）；端点 = 新增 `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve`（body `{winner:'this'|'other'}`，权限 `doc.editor` + 成员闸，**不新增权限码**）；待审期**保守取「暂不 index」**且**不碰对方文档的既有索引**。

## Not yet specified

- **`pending_review` 的 interim 可配置性**：PRD §5.1 说「双方可暂均 index 或均不 index（**KB 策略**）」，但未给键名 → 本图固定取「暂不 index」，键名待 PRD 补行
- **`downrank` 跨 doc 去重动作**：PRD §5.1 的合法取值，但「仍索引但 metadata 降权（检索层读取）」在本仓无实现 → 策略白名单**明确 400 拒绝**，不留静默通道；待检索层降权设计成形再开
- **`pending_review` 的 admin 审阅面**：功能表 §4.3 说「文档页抽屉或同页」，属 P1 的 UI 面；本图只落 API 与数据面
- **admin 站规清扫**（20 处原生 `<select>` + 4 处旧 ui `Select`：documents 7 · departments 6 · models 3 · settings 2 · chunk-strategy-panel 1 · eval 1；login / chunks / members 用旧 `Select`）：是站规余量，**不是**映射表缺口；本机无浏览器验证手段，替换的视觉回归不可验 → 留在雾里，待具备浏览器验证条件。**注**：`chunk-strategy-panel.tsx:149-163` 那处已在核查中被点名（QUAL-AB8 的残留），仍归本条
- **`drizzle/meta` 基线缺失**（`db:generate` 仍不可用，缺 `0001`–`0019` 共 19 份快照）：工程债；推荐路径 A1 见 [`research-drizzle-meta-baseline.md`](../fill-must-haves/research-drizzle-meta-baseline.md)；采纳前须先做类型/默认值级人工走查
- **`allowedDocIds` 收紧路径 / 成员写面**：准入条件是**先指名真实生产者**（前图裁定 103）；无生产者前不实现
- **覆盖表 P2 必签 `部分测` 余量**（信任环 A/D/F/H/K/U → 入库闸 L/M/V → 运营壳）：另批补测，不进本图
- **worker metrics 出口**：前图已裁定不开端口；`contextualize_l1_ok` / `l0_fallback` 的正解是进库报告（105 已落）

## Out of scope

- **QUAL-ACL-CAP（B1-A4 白名单超限拒答）**：全仓无 `allowedDocIds` 生产者（10 处全是文档或负向测试，DB 无列，`retrieve` 无该 reason 出口）→ 实现等于造无生产者半接线 · [已关闭](./issues/06-qual-acl-cap.md)
- **QUAL-G3（`gold.yaml` 审核闸）**：`gold.yaml` 是静态手写 seed、全仓无生成器 → 没有可加闸的对象；要先有生成器（属新功能）· [已关闭](./issues/14-qual-g3-gold-review-gate.md)
- **QUAL-PLANE R4（`maxEmbedCalls` → warning + 忽略）**：本仓无 runtime 图配置入口（`graphProfile` / `wallClockMs` 0 命中；KB 设置是 strict 白名单；`budgetOverride` 标注「生产勿传」）→ 护栏属**未来 profile loader**（P3a / B8 接入时实现）· [已关闭](./issues/07-qual-plane-quota.md)
- **换生产默认**：B8 真 ES+IK 全文、B9 真 RustFS、QUAL-2 真杀毒（延期债；DEC-SCAN 已裁决现阶段允许 `mock_scan`）
- **业务人签**：B10-followup `businessPass`、签字包人审——人不在环内不代签
- **P3a Full 图**（CRAG / multi_hop）与 **P4 其余**（门禁包人签 / 再认证 / 数据面板增强 / 独立 `tau_sweep` / `verifier_calib` 入队）
- **P5 真 OCR 引擎 / Cloud OCR / 启动自动全库重跑**
- 用本图改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 把「已具备最小 / 默认关」读成「生产已上 / 可签字」
- **已由前图收口、本图不重复做**：QUAL-AC7（KB 绑 `judge` 已被 78 拒 400）· QUAL-AB8（admin 分片策略弹窗已被 06+82 落）——**登记滞后**，非缺口

