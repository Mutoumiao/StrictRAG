# 回写：镜像 / 覆盖表 / 交付 §0 / 雾清单

Type: task
Status: resolved
Blocked by: 03, 04

## Question

把本图的结论落到**所有派生面**，并做一次对抗性复核（前图 `p2-exit-evidence` 工单 12 的教训：正向回写查不出「把验证发生在哪写错」）：

1. `docs/module-status/admin.md`：文档页是否已有审阅面（按新实现改「无待审 UI」一类的旧句）。
2. `docs/module-status/api.md`：处置端点 +（若有）新读端点的边界；审计口径。
3. `docs/module-status/worker.md` / `db.md`：**「无查询面 / 无审阅面」一类的旧句按源码纠偏**（per-doc `GET …/ingest-jobs` 已落这一事实；跨文档面仍未落则如实写）。
4. `docs/testing/coverage/03-ops.md`（或对应分册）：E4 行「缺口」列按新实现改写（**覆盖值**是否变化须逐格判）。
5. `prds/12-delivery-guides/04-交付控制台.md` §0.5 与 `.trellis/tasks/08-06-project-backlog/status.md` §2.5.2 / §1.1 的对应行（**注意**：`/prds` 与 `.trellis/tasks/` 不在 git 内，改动只落磁盘）。
6. `.scratch/fog-inventory-2026-09-23.md`：簇 17 收口一行；簇 14 按裁定改写。
7. **对抗性复核**：逐条核对本轮回写的每一处，判「成立 / 新高估 / 需收紧」，逐条修正；收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`。

## Answer

### 已回写（按工单 7 项）

1. **`admin.md`**：报告区块一节改写为「冲突对汇总行只展示 `otherDocId` + **待审冲突块**另列（`pending_review` ∧ 非空 `heldChunkId`、按 `heldChunkId` 去重、有 `doc.editor` 两按钮、处置后停用、无码只读、报告不改写）」；新增证据行「待审冲突处置」；「最近更新」加 2026-10-09（保留 2026-09-20 的「未做」为**历史**记录，不改写）。
2. **`api.md`**：端点行补「**零审计**（不在 `admin-write-audit` 白名单，与 `PATCH` 元数据写 / `supersede` 同类未纳入）」+ 契约测指针；清单行「**无** admin 审阅面」改「**已落**」；「最近更新」加 2026-10-09。
3. **`worker.md`**：**五处**纠偏 —— `ingest_jobs` 行与第 102 行「无查询面 / 无运维查询面」→「per-doc 只读已落（api `GET /documents/:docId/ingest-jobs`）/ 跨文档未落」；两处「无审阅面」→「worker 侧无自动处置，**admin 侧处置面已落**」；修一处状态列名笔误（写作 `dupe` 开头，已改回 `dedupe_status`）；加「最近更新」2026-10-09（并写明本包源码零改动）。
4. **`db.md`**：两处「无查询 API / 查询面无」→「per-doc 只读查询面已落 / 跨文档未落」；加「最近更新」2026-10-09（源码零改动）。
5. **`contracts.md`**：新增「跨 doc 去重冲突处置」契约行（resolve DTO 两个 schema + 测例指针）；加「最近更新」2026-10-09。
6. **`docs/module-status/README.md`**：矩阵「入库闭环」行补「**admin 侧已有待审二选一处置面**」；未交付清单把「入库 `ingest_jobs` 完整运维查询面」改为「**跨文档**运维查询面（… + **per-doc 只读查询面已落**；跨文档列表 / 筛选 / 分页未落）」。矩阵表头「全量核对」日期**不改**（本轮是增量行回写，非全量审计）。
7. **`docs/testing/coverage/01-ingest.md` E4 行**：主包 `worker · api` → `worker · api · admin`；证据补 contracts 契约测与 admin RTL；缺口列写实（生产 LSH 非本阶段 · **待审积压聚合指标未落** · **处置零审计**）。**覆盖值 `已测` 不变**。
8. **`prds/12-delivery-guides/04-交付控制台.md`**（磁盘 · 不在 git）：§0.5 #6 的「无查询面」→「per-doc 只读查询面已落 / 跨文档运维面未落」；变更日志加 2026-10-09 一行。
9. **`.trellis/tasks/08-06-project-backlog/status.md`**（磁盘 · 不在 git）：§2.5.2 **QUAL-E4** 行「admin 审阅面仍属雾」→「**已落**（… RTL 指针）+ 余项（积压指标未落 · 零审计）」；§0 新增一行「文档内容处置类写审计口径（未决）」。
10. **`.scratch/fog-inventory-2026-09-23.md`**：新增 2026-10-09 追加段；**簇 17 标「已解」**；**簇 14 改写**为「镜像已纠 / 跨文档面未落 / 是否收紧未裁」。

### 对抗性复核（判「成立 / 新高估 / 需收紧」）

| # | 改动 | 判定 | 处置 |
|---|------|:----:|------|
| 1 | `worker.md` 最近更新写「三处旧句」 | **需收紧** | 实际 **5 处**，已改 |
| 2 | `contracts.md` 最近更新未同步（本轮改了 `packages/contracts`） | **需收紧** | `check:module-status` 的「7-时效」报出，已补 2026-10-09 |
| 3 | 最近更新里字面写出错误列名 token | **需收紧** | 会被核对脚本当表名（噪声），已改写措辞不带该 token |
| 4 | `admin.md` 保留 2026-09-20「审阅面未做」 | **成立** | 按倒序历史条目，不改写历史；新条目在最前 |
| 5 | E4 覆盖值保持 `已测` | **成立** | 本轮只补证据与缺口列；行级覆盖值未变 |
| 6 | README 矩阵表头日期不改 | **成立** | 约定「全量核对才改日期」，本轮为增量 |
| 7 | 交付控制台 §0.5 #6 / backlog QUAL-E4 改「已落」 | **成立** | 有源码（HALF-JOBS 的 per-doc 只读 API）+ 本轮 RTL 为证 |
| 8 | 各处「11 条 / 4 条」测例数 | **成立** | 实测 `it(` 计数：11 / 4 |

**新高估 0 处**。

### 门禁（最后一次提交之后复跑）

`pnpm check:module-status`：**40 条**，**`1-路径` / `6-联动` / `7-时效` 三类为空**（此三类为「须为空」的硬类）；余 40 条按分类 = `2-env` 2 · `3-符号` 13 · `5-表` 25，抽样判读均为该脚本的已知误报（概念名 / 列名被当表名，如 `dedupe_status` · `conflict_pairs` · `generate` · `migrate`）。`admin` test 39 文件 / 198 通过 · `contracts` test 37 文件 / 321 通过 · 两包 `check-types` 与 `lint`（零 warning）绿。

### 边界（诚实记）

- `prds/` 与 `.trellis/tasks/` **不在 git 内**，第 8 / 9 项改动**只落磁盘、无版本历史、无法 `git diff` 复核**（前图已记同一事实）。
- 第 3 项只是消除脚本噪声，源列名本身未变。
- 本图**未**做：跨文档运维查询面 · 待审积压聚合指标 · 处置审计 · 视觉回归。
