# 让 Phase 2 出口可核对（账本归零 + 必签测证补齐）

Label: wayfinder:map
Status: open（前沿：09）

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
- [回写覆盖表：11 行过期标注 + 4 处汇总矛盾 + 23 行阻塞登记](./issues/06-coverage-table-writeback.md) — 11 行里 **10 行改 `已测`**，**只有 L7 降为「部分测」**（Then 里的「周期触发」本仓无调度基建、真 ES 侧属 B8，把剩下的那一小截写进缺口列而非笼统「部分测」）。四处计数矛盾按**行级机械重数**修正（不迁就旧数）。23 行阻塞登记写进各分册「缺口」列，其中 **16 行「源码与 Then 不一致」统一标注「源码侧待定」并给源码出处**。收口时又加改两处：**S6 改判 `缺测` → `缺实现`**（守卫补测核出 admin 层无该实现）· **N2 / Z3 / C4 回写 `已测`**。终态：**279 行 · 已测 98 · 部分测 122 · 缺测 0 · 缺实现 7 · 延后 38 · UAT 14**，**P2 必签 `缺测` 清零**。
- [补测批 1 · 信任环收口](./issues/07-tests-batch-1-trust-loop.md) — 11 行全部补到有实质断言，**无「无法断言」行**。新建 6 文件（建库配模型可解析 · 上传→ready→active→成员 ask 可命中一条串联 · POST 与 SSE 双路 `answerKind=knowledge` · 拒答 `suggestedActions` 随 reason 变 · 库外假前提拒答 · generate 全链失败走图 `abstained/internal_guard`）+ 补 4 文件（fast 模式不含 `purpose=route` · 拒答轮不下发 `text-delta` · 手机号 evidence 逐字一致 · 会话分页与跨会话窗隔离）。断言全落在可观测终态，未用 skip。**验证**：api **148 文件 / 919 通过 + 3 skipped**；全仓收口 `pnpm test` **11/11**。
- [补测批 4 · 边界护栏](./issues/10-tests-batch-4-guards.md) — **3 行补成 + 1 行拒绝造假绿**：N2 Mongo 读写无应用层加密 wrapper（3 条护栏，字段集锁死）· Z3 未点详情不预拉 chunk body · C4 Hit@k 逻辑 id→uuid 映射层（**未**接进签字公式）。**S6 无法断言**：admin 菜单只按平台码裁剪、`/auth/me` 无 `byKb`、切库只写 localStorage → 覆盖表原写「缺测（源码已具备）」与源码冲突，**已改判 `缺实现`**；403 真值在 api（S5）。两条落点路径见工单。三包测试 193 / 173 / 224 通过，`check-types` 8/8、`lint` 8/8 零 warning。
- [`drizzle/meta` 基线：补齐 `0021` 快照](./issues/11-drizzle-meta-baseline.md) — `packages/db/drizzle/meta/0021_snapshot.json` 已落盘（26 表）。全程在**仓外副本**生成（`mklink /J` 挂 node_modules），只取快照、丢弃副本产出的 `0022_*.sql`；`id`/`prevId` 无需手改（`randomUUID` + 工具自动写 `0000` 的 `id`）。**硬验收达成**：副本跑 `generate` 打印 `No schema changes, nothing to migrate 😴`，且跑完文件数不变；仓库侧只多那一份未跟踪文件。人工走查 26 表 / 355 列 / 11 唯一约束全一致。**顺带发现**：`ingest_reports` 两个列在迁移 `0015` 有 `DEFAULT`、schema 无 —— 已记入雾中。**同 PR 回写**：`docs/module-status/db.md` 与 db spec 的「缺 21 份」口径改为「基线已补、`generate` 恢复可用」（裁定 8）。
- [补测批 2 · 入库闸与双就绪](./issues/08-tests-batch-2-ingest-gates.md) — 19 行（L1–L5 · L9 · M1 · M2 · M5 · M6 · Q1 · Q2 · Q5 · Q10 · V1 · V2 · V6 · V8 · AA6）新增 **38 条 `it`** + 共享夹具 `ingest-harness.ts`。硬门都钉住了：ES 失败不得 ready（**向量已写仍不可检索**）· 重索引期间 `activeIndexVersion` 不动、只有双就绪那一条 UPDATE 原子切换 · Head 是权威闸（`declaredByteSize` 声称小仍 413）· 未 embed 不得 es_index · 夹带 `status=ready` 一律 400。**四处如实记「无法断言」**：L5 的「api 入队写账本」无落点（`queue.ts` 只 `q.add`）· 部分「ask 检不到」以装载闸主锚表达 · V6 的 Then 写 403 实测 400+404（**未**为凑数放宽 schema）· Q10 不真启进程。**验证**：worker 47/212 · api 155/935+3skip · contracts 27/225 · admin 36/175；收口时全仓 **11/11**。
- [反向复核：这轮回写是否引入新的高估](./issues/12-research-writeback-countercheck.md) — 逐行核 **67 处**改动：**成立 53 · 新高估 1 · 需收紧 13**。**新高估那条**：`db.md` 把「只在**仓外副本**达成」的硬验收写成「仓内跑出」——**正向审计永远查不出这种错**（它只查「说的比做的大」，不查「说的位置不对」）。**13 处需收紧**分三类：三处两说（K5 / 「无处置」/ §0.6 L3 口径 / spec drizzle 口径）· 证据只覆盖 Then 的一半（V4 → **退回 `部分测`**；AB8 · N2 · C4 的「映射层已补」实为「补了护栏测」）· 指针与真跑（`parse-*` 悬空 → `extract-text.ts`；HALF-MONGO/SMOKE/SEED 无仓内真跑记录）。**14 条修正已全部应用**。它另核过：计数与合计逐格相符 · 被改动的行里**没有一处**把 `AUTH_ENFORCE` 等开关说成已开 · 11 个新 issue 指针全部真实存在。
- [第三条 ES 查询路径补租户闸](./issues/13-es-query-third-path-tenant-gate.md) — 由反向复核挖出：`listIndexedChunkIds`（孤儿清理的 ES 对账入口）原只按 `docId` 查、无租户闸也不失败，故「全仓 query builder 必带租户」仍不成立。已补 `requireTenantId(tenantId, where)` + 查询体加 `term: tenantId`，调用点（`pipeline.ts:939`，**唯一调用者**，1 行越界已评审接受）跟着传 `doc.tenantId`。**取舍：加 filter 而非只加校验** —— 与 `buildAclFilter` 口径统一；不加也不泄漏（docId 是 uuid v7 全局唯一），属加严。新增 3 条 `it`（缺/空/纯空白拒绝且断言 **fetch 零调用** + 正常路径对照）。至此 **worker 全部 ES HTTP 查询与写入都在闸内**。

## Not yet specified

- **两处镜像不在版本库里**（工单 05 发现的硬事实）：`.gitignore:58-59` 把 **`/prds` 与 `.trellis/tasks/`** 整个排除在 git 之外。也就是说三处状态镜像里，**交付控制台与总 backlog 没有版本历史**，任何回写都不留痕、无法用 `git diff` 复核，只能靠读磁盘。是否让它们进版本库属仓库所有者决策（**不是**本图能改的），但「可核对」的定义应该把这条写进去
- **把反向复核固化成流程**（工单 12 的结论）：本图的教训是「只做正向回写不够」——**正向审计查不出「验证发生在哪」写错**（新高估那条就是把仓外副本验收写成仓内）。下一张图若再做镜像回写，应把「对抗性复核」列为**回写工单的后继依赖**，而不是可选动作。这条要不要提升为仓库纪律（写进 `.trellis/spec/guides/` 或 `docs/agents/`），须先定
- **两处镜像怎么复核**（前一条的落地难处）：`/prds` 与 `.trellis/tasks/` 不在 git，`git diff` 取不到改动前状态，复核只能「以磁盘现状 + 源码对账」——本轮就是这么做的，但这意味着**无法知道镜像「原来」写了什么**，也回滚不了
- **S6 改判带出的真问题**（工单 06 / 10）：`admin` 的写菜单只按**平台码**裁剪，`/auth/me` 没有 `byKb`，切库只写 localStorage。所以「按当前 KB 角色裁菜单」在 admin 层**不存在实现**。要让它有落点只有两条路：给 `/auth/me` 加 `byKb`（契约变更，须走 contracts + PRD 侧确认），或把该断言移回 api（扩 `kb-member-gate`）。选哪条是**产品/契约决定**，不在本图
- **`ingest_reports` 的两个默认值漂移**（工单 11 走查发现）：`cross_doc_dropped` / `conflict_pairs` 在手写迁移 `0015` 里带 `DEFAULT 0` / `DEFAULT '[]'::jsonb`，而 `packages/db/src/schema/kb/ingest-reports.ts:27,33` 只声明 `.notNull()` 无 default。按「源码为真」schema 是源，但改哪一侧（补 schema default 还是出手写迁移去掉 default）要先裁口径 —— 这是**两个源文件之间**的漂移，不是镜像漂移，故不在本图目的地内
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
