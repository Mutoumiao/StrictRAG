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

## Not yet specified

- **admin 站规清扫**（20 处原生 `<select>` + 4 处旧 ui `Select`：documents 7 · departments 6 · models 3 · settings 2 · chunk-strategy-panel 1 · eval 1；login / chunks / members 用旧 `Select`）：是站规余量，**不是**映射表缺口；本机无浏览器验证手段，替换的视觉回归不可验 → 留在雾里，待具备浏览器验证条件
- **`drizzle/meta` 基线缺失**（`db:generate` 仍不可用，缺 `0001`–`0019` 共 19 份快照）：工程债；推荐路径 A1 见 [`research-drizzle-meta-baseline.md`](../fill-must-haves/research-drizzle-meta-baseline.md)；采纳前须先做类型/默认值级人工走查
- **`allowedDocIds` 收紧路径 / 成员写面**：准入条件是**先指名真实生产者**（前图裁定 103）；无生产者前不实现
- **覆盖表 P2 必签 `部分测` 余量**（信任环 A/D/F/H/K/U → 入库闸 L/M/V → 运营壳）：另批补测，不进本图
- **worker metrics 出口**：前图已裁定不开端口；`contextualize_l1_ok` / `l0_fallback` 的正解是进库报告（105 已落）

## Out of scope

- **换生产默认**：B8 真 ES+IK 全文、B9 真 RustFS、QUAL-2 真杀毒（延期债；DEC-SCAN 已裁决现阶段允许 `mock_scan`）
- **业务人签**：B10-followup `businessPass`、签字包人审——人不在环内不代签
- **P3a Full 图**（CRAG / multi_hop）与 **P4 其余**（门禁包人签 / 再认证 / 数据面板增强 / 独立 `tau_sweep` / `verifier_calib` 入队）
- **P5 真 OCR 引擎 / Cloud OCR / 启动自动全库重跑**
- 用本图改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 把「已具备最小 / 默认关」读成「生产已上 / 可签字」
