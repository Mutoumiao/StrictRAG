# 让 Phase 2 出口可核对（账本归零 + 必签测证补齐）

Label: wayfinder:map
Status: open（前沿：04 · 06 · 07 · 10 · 11）

## Destination

让「Phase 2 出口工程侧已收口」这句话从**叙事**变成**可核对**。到达时同时满足两件事：

1. **账本零漂移**：三处状态镜像（总 backlog `.trellis/tasks/08-06-project-backlog/status.md` · 交付控制台 `prds/12-delivery-guides/04-交付控制台.md` §0 · `docs/module-status/`）中，凡与源码不符的行都已按源码改写为终态 —— 不存在「源码已具备、镜像仍写未开始 / 部分 / 缺口」，也不存在反向的高估。
2. **必签测证无空转**：`docs/testing/coverage.md` 中属于 P2 必签范围的「部分测 / 未测」行，凡**可离线补齐**（只用 vitest + 现有 mock）的都已补到有测例；不可补的每行都写明阻塞方与出处，不留含糊的「部分测」。

两者是同一件事的两面：出口的一句话要能被第三方按图索骥地核对。**不**包含业务人签、真 ES / 真杀毒 / 真模型网关等外部依赖，也不放宽任何默认开关。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（当前 0.4.32）为准；总 backlog 是**调度行**、交付控制台 §0 是**派生进度视图**、`docs/testing/coverage.md` 是**派生对照表**，三者**均非接口契约**。**IS 以源码为准**，`docs/module-status/` 是它的镜像。
- **前图**：[`close-p2-exit-gaps`](../close-p2-exit-gaps/map.md)（20/20 已收口，前沿为空）。本图是它的**续图**：前图把「映射表上挂在工程代码上的缺口行」清零并把结论落成源码与决策，但**没有把结论回写到三处镜像**，也没有动覆盖表的「部分测」余量。这两件就是本图的起点。
- 每轮先读：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · 前图 `map.md` 与相关工单 Answer · `docs/testing/README.md` · 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包 `index.md`。
- **本图携带执行**：工单可以动手改文档、补测例，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口批次跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 简介」必须简体中文，并登记该包 `tests/index.md`；**禁止**按源码一对一镜像造测例。
- **同步纪律（硬，本图核心）**：改总 backlog 的 ID 行 / §3 关键路径 / 完成标签 → **必须同 PR** 改交付控制台 §0（子包进度 + 映射表三态）。本图就是把这条纪律补上。
- **口径纪律**：`docs/module-status/` 是 IS 镜像，**禁止**仅凭 task / sign-off 叙事抬成熟度；「已具备」必须能指到源码路径。矩阵只写一句话成熟度，细节进包文。
- **不改仓库默认开关以示「完成」**：`AUTH_ENFORCE`、`DEPT_ACL_ENFORCE`、rewrite、OCR、`INGEST_CONTEXTUALIZE_MODE`、`RETRIEVE_ES_MODE`、`INGEST_ES_MODE` 的默认值不在本图放宽或收紧。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸。
- **本机限制**：无浏览器验证手段 → web / admin 的视觉与交互改动不在本图（属雾）。外部依赖（真 ES 集群 / 真杀毒引擎 / 真模型网关 / 真 RustFS / 人签）不在本图。
- **本图开工时的审计基线（2026-09-20）**：三处镜像共 **34 处漂移**（25 低估 + 9 口径），**反向高估 0 处**；覆盖表 P2 必签余量 **94 行**（全为部分测），其中可离线补 **71 行**、不可离线 **23 行**。详见 `research/ledger-drift.md` · `research/coverage-partial-tests.md` · `research/fog-reachability.md`。

## Decisions so far

- [三处状态镜像 vs 源码：全量漂移审计](./issues/01-research-ledger-drift.md) — **34 处漂移：25 低估 + 9 口径，反向高估 0 处**。整篇未回写的只有交付控制台（mtime 2026-08-31）——其 **§0.7 十四行 HALF-\* 全写「未开始」**，而同文 §0.1 与 backlog §1.2 都写「已落地」；总 backlog **§2.5.2 十一行仍写「未开始 / 未指派」**，与同表表头「本表已收口」自相矛盾，且指针全指向**从不存在的** `08-24-qual-*` task 目录。`docs/module-status/api.md` · `worker.md` · `db.md` 是本批回写最到位的镜像，仅剩元信息栏与三处「无 `pending_review`」旧边界句。
- [覆盖表 P2 必签「部分测 / 未测」余量盘点](./issues/02-research-coverage-partial.md) — **94 行，全为「部分测」，未测 0 行**；**可离线补 71 行**、不可离线 23 行（真 ES / 真进程 6 · 人签 live 1 · **源码与 Then 不一致或无落点 16**）。覆盖表**自身已过期**：11 行已具备却仍标欠债；四处汇总数与行级标注自相矛盾（ask / ingest / acl / ops）。建议四批：信任环 11 · 入库闸 19 · 鉴权与运营壳 38 · 回写与护栏。
- [上一图「雾中项」的可达性核定](./issues/03-research-fog-reachability.md) — **今天可做 4 / 需先补 PRD 或 ADR 3 / 外部阻塞 1 / 无对象 2**。「需先补 PRD」的三项（`pending_review` interim 键名 · embed TPM 口径 · `downrank` 降权口径）都要走 ADR → 改 PRD → 升版本，**划出本图**。本图采纳与「可核对」直接相关的两项：`drizzle/meta` 基线（缺口已从 19 份增至 **21 份**，基线名应为 `0021_snapshot.json`）与覆盖表余量。admin 审阅面与站规清扫留雾。
- [裁定镜像回写的九处口径](./issues/04-dec-mirror-writeback-rules.md) — 九条裁定：① 新增完成标签 **「已关闭（划出）」**（不表示已实现、不计入子包分子；对应仓库既有 `wontfix`）；② §2.5.2 表头一律按**子项**计数 → 「划出 3」改 **4**；③ §0.4 分母 = §0.2 定义里的 ID 数 → P2-L 改 **3 / 5**，OPS-STACK 移出为脚注；④ L3 分三档，三处统一为「**有**进程内闩后停用 rewrite / **无**写 env 的全局关 / **无**面板」（源码 `metrics.ts:71-77` + `execute.ts:153-157` 为据）；⑤ 矩阵日期戳写「全量核对 **2026-09-20**」；⑥ **B10-followup 的 live 真跑数字降级为「仅存 task 叙事」**（`artifacts/` 被 gitignore，仓内不留证），三态仍「部分」；⑦ 矩阵「入库闭环」行末补 L7 / E4；⑧ `drizzle/meta` 口径分两步（05 写 21 份 → 工单 11 落地后改「已补齐」）；⑨「真跑」措辞三处同改。另排除 `check:module-status` 的两条误报并留档基线报告。
- [回写三处状态镜像（账本归零）](./issues/05-writeback-mirrors.md) — 审计的 **25 处低估全部改完**：§2.5.2 十一行改写（已完成 8 · 部分 1 · 已关闭（划出）2）并**清掉所有指向不存在 task 目录的悬空指针** · 交付控制台 §0.5 十一行 + **§0.7 十四行 HALF-\*（原全写「未开始」）** + §0.2/§0.3/§0.4 + 变更日志三条 · `docs/module-status/` 矩阵两处反向陈述与五份包文元信息 + 三处「无 `pending_review`」旧句 · spec 的快照缺口 19 → **21** 并加口径自检。**验证**：`pnpm check:module-status` **39 → 36 条**，**「时效」整类清零**，剩余 36 条经判读全是脚本误报（点号目录 / 概念名 / 指标名）；两份报告留档。**重大发现**：`.gitignore` 把 **`/prds` 与 `.trellis/tasks/` 整个排除在 git 外**，故 A、B 两处回写**是纯磁盘改动、无版本历史、无法 `git diff` 复核** —— 已记入本图雾中。

## Not yet specified

- **两处镜像不在版本库里**（工单 05 发现的硬事实）：`.gitignore:58-59` 把 **`/prds` 与 `.trellis/tasks/`** 整个排除在 git 之外。也就是说三处状态镜像里，**交付控制台与总 backlog 没有版本历史**，任何回写都不留痕、无法用 `git diff` 复核，只能靠读磁盘。是否让它们进版本库属仓库所有者决策（**不是**本图能改的），但「可核对」的定义应该把这条写进去
- **复核这一轮回写本身**：本图由审计驱动回写，回写完还需一次「反向复核」（镜像是否引入了新的高估）。做法待定：是再发一张 research，还是沿用本图的 34 条清单逐条复读
- **16 行「源码与 Then 不一致 / 源码无落点」**：如 `route-rules.ts:32-77` 的 `route_post_block=true` 分支不可达且无 `route_source=rule_knowledge` 取值 · `H5e` 的 debug / maintenance 开关全仓无落点 · `H1` 的 `Retry-After` 头（PRD 原文是「可带」）。这些要么改源码、要么回 PRD 裁口径，**不是补测能解决的**。准入条件是先裁清「哪一侧错」，再决定开实现票还是开 PRD 修订票
- **`pending_review` 的 admin 审阅面**：端点 + DTO（带 `heldChunkId`）已齐，缺的只是 admin 一个二选一控件（`documents-workspace.tsx:1186-1203`），RTL 可离线验收。它**不构成镜像漂移**（`admin.md` 已如实写「无待审 UI」），故未进前沿；若本图提前收口可作为下一张图的起点
- **admin 站规清扫**（20 处原生 `<select>` + 3 处旧 ui `Select`）：行为级可验、**视觉回归不可验**（仓内无 playwright / 视觉 diff）。持续留在雾里，待具备浏览器验证条件
- **覆盖表 23 行里属于「真 ES / 真双节点 / 真进程」的 6 行**：随 B8 / OPS-STACK 一起才有落点

## Out of scope

- **业务人签**：B10-followup `businessPass` / 签字包人审 —— 人不在环内，不代签
- **换生产默认**：B8 真 ES+IK 全文 · B9 真 RustFS / Mongo 正文 · QUAL-2 真杀毒（DEC-SCAN 已裁决现阶段允许 `mock_scan`）
- **P2.5 准出 / 默认开**：L2 准出、rewrite 默认开、L3 面板 —— 需要真模型网关 live 跑数与人签
- **P3b 部门隔离全文**：ES 查询期对称 filter（阻塞在 B8）· 默认开与解禁（须先 ADR）
- **三项要补冻结口径的雾中项**：`pending_review` interim 键名（PRD §5.1 未给键名）· embed TPM 计数口径（ADR-044 明写演进须新 ADR）· `downrank` 降权口径 —— 都要 ADR → 改 PRD → 升 `prds/README.md` 版本，属改冻结语义
- **两项无对象**：`allowedDocIds` 收紧（无生产者，放开成员写面要改 PRD）· worker metrics 出口（功能表把 worker 对外 HTTP 列为禁止项，正解已裁定走入库报告）
- **P3a Full 图**（CRAG / multi_hop）与 **P4 / P5 其余**
- 改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 把「已具备最小 / 默认关」读成「生产已上 / 可签字」
