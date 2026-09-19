# 回写三处状态镜像（账本归零）

Type: task
Status: resolved
Blocked by: 04

## Question

按 [04](./04-dec-mirror-writeback-rules.md) 裁定的口径，把审计（[01](./01-research-ledger-drift.md)）报出的 **25 处「漂移·低估」+ 9 处口径项**逐条回写，使三处镜像与源码零漂移。

回写范围（逐条替换文本已在 `research/ledger-drift.md`「建议回写清单」给全）：

- **`.trellis/tasks/08-06-project-backlog/status.md`**：§2.5.2 十一行状态列与指针（K5 · E4 · E5 · L7 · AA1 · ACL-CAP · TENANT-Q · PLANE · G3 · AB8 · AC7）· 表头计数 · §1.1 L158（P2.5-L3A 口径）· 若裁定需要则增 §0.1 一行新标签。
- **`prds/12-delivery-guides/04-交付控制台.md`**：§0.5 映射表 #1 / #4 / #7 / #8 / #11 / #18 / #22 / #25 / #31 / #32 / #33 · §0.6 · **§0.7 十四行 HALF-\*（全写「未开始」，实为已落地）** · §0.3 · §0.4 P2-L 分母 · §0.2 真跑措辞 · §10.1 变更日志。
- **`docs/module-status/`**：`README.md` 矩阵 L77（「半产品缺口…未做」在该句里被写反）· L78（删去已交付的「admin 设置全量 UI」）· 表头日期戳与入库闭环行 · `api.md` / `worker.md` / `db.md` 的「最近更新」栏与三处「无 `pending_review`」旧边界句。

**不做**：不改 `prds/00–11` 的任何冻结条款（那要 ADR → PRD → 升版本）；不为凑数抬 `docs/module-status` 的成熟度标签；不动源码。

## Answer

已按工单 [04](./04-dec-mirror-writeback-rules.md) 的九条口径回写三处镜像。审计报的 **25 处「漂移·低估」全部改完**，另按裁定 5–8 增改了四处口径。

**A · `.trellis/tasks/08-06-project-backlog/status.md`**

- §2.5.2 十一行状态列与指针全部改写：**已完成 8**（K5 · E4 · E5 · L7 · AA1 · TENANT-Q · AB8 · AC7）· **部分 1**（PLANE：R10 已落、R4 / R6-b 划出）· **已关闭（划出）2**（ACL-CAP · G3）。所有指向 `08-24-qual-*` 的**悬空 task 指针**换成 `.scratch/close-p2-exit-gaps/issues/` 的工单链接（该批 task 目录已核实**从不曾存在**：`.trellis/tasks/` 下只有 `08-06-project-backlog` 与 `archive`）。
- 表头「划出 3」→「**划出 4**」，并加一行「计数口径：一律按**子项**计」。
- 另加一条 2026-09-20 回写说明，写明本表状态列先前与表头自相矛盾这件事的来源。
- §0.1 完成标签表增 **「已关闭（划出）」**（含定义与「不计入子包分子」）。
- §1.1：B10-followup 的「真跑 ✅」加「**仓内不留证**」限定（裁定 6）；P2.5-L3 / L3A / L2S / L3F 四行的「无自动关 / ≠自动熔断」统一改为「**有**进程内闩后停用 rewrite（`isL3RewriteFused`） / **无**写 env 的全局关」（裁定 4）。

**B · `prds/12-delivery-guides/04-交付控制台.md`**

- §0.5 十一行按源码改写：#4 / #7 / #8 / #18 / #22 / #25 由「部分→缺口」升为「**已具备 + 证据**」并换上测例路径；#11 拆开写（B8 仍是真缺口，O4 那半已落）；#1 / #31 / #33 补工程侧闭合与 R10；#32 由「部分→缺口」改为「**部分**（真 SDK 未接）」。
- **§0.7 十四行 HALF-\*** 由「未开始」全部改为「已完成」，并补落地指针列 + 「本表为派生导航、SSOT 在 backlog §1.2」的括注。
- §0.3（L3 三档口径）· §0.4（P2-L 改 **3 / 5**、写出分母来源、OPS-STACK 移出分母）· §0.2（B10-followup 证据口径）· §0.6（#7 已具备 / #32 仍部分）· §0.5 表下注释。
- §10.1 变更日志补三条：**2026-09-20**（本轮回写）· **2026-09-19**（P2 出口工程缺口收口）· **2026-08-21**（P-HALF 全 14 条落地）。

**C · `docs/module-status/`**

- `README.md`：矩阵表头日期戳改「**最近一次全量核对 2026-09-20**（前次 2026-08-12）」；L77 那句把已落地的 14 条写成「未实现」的**反向陈述**整句重写；L78 未交付清单里删掉已交付的「admin 设置全量 UI」；「入库闭环」行末补 `pending_review` 与孤儿清理（周期调度未落）；「更新时机」补一句「矩阵按行增量回写，全量核对只在专门审计时做」并指出 `pnpm check:module-status` 的可用范围与误报面。
- 包文元信息「最近更新」补 2026-09-19 条目：`api.md` · `worker.md` · `db.md` · `contracts.md` · `admin.md`（`contracts.md` 是 `check:module-status` 时效项额外点出的，审计未列）。
- 三处「**无** `pending_review`」旧边界句改为「**有**冲突对（带 `heldChunkId`）但**无**处置 / 聚合指标 / 审阅面」：`worker.md` 两处 · `api.md` 一处；`contracts.md` 的「拒 pending_review」改为「`action ∈ skip_index|pending_review`」；`admin.md` 的「不是 pending_review」改为「**无** `pending_review` 二选一控件（仍属雾）」。
- 裁定 8：`.trellis/spec/db/backend/database-guidelines.md` 的快照缺口由「`0001`–`0019` 共 19 份」改为「`0001`–`0021` 共 **21** 份」（与 `db.md:54` 一致），补上 `0020`/`0021` 的 journal tag 例子，并加一条**口径自检**（缺口份数 = `drizzle/*.sql` 文件数 − 1），避免再次写死过期数字。

**验证**

- `pnpm check:module-status` 重跑：**39 → 36 条**，其中**「7-时效」一项整类清零**（原报 api / contracts / db / worker 四份包文「最近更新」未同步）。剩余 36 条经逐条判读**全是该脚本的误报**：1-路径 1 条（它跳过 `.scratch/` 点号目录，故找不到确实存在的取证文件）· 2-env 2 条（两处包文原文即写「默认 `local`」）· 3-符号 14 条 + 5-表 19 条（`NULL` / `CONFLICT` / `node_used` / `active_index_version` 等概念名与指标名）。前后两份报告留档：`research/module-status-check-before.txt` · `research/module-status-check-after.txt`。
- 门禁：本工单只动 `.md`，全仓 `pnpm check-types` 与 `pnpm lint`（零 warning）绿。

**必须记录的一条结构性事实（影响「可核对」的定义）**

`.gitignore:58-59` 把 **`.trellis/tasks/` 与 `/prds` 整个排除在 git 之外**，`artifacts/` 同样。（另 `.claude` / `.agents` / `.gstack` 亦被忽略。）

因此本工单的 **A、B 两处回写（总 backlog 与交付控制台）是纯磁盘改动，不进版本库、无法用 `git diff` 复核**；能进版本库的只有 C（`docs/module-status/`）与 `.trellis/spec/`。复核 A / B 只能靠读磁盘文件（本工单已逐条写入、并在提交说明里点明）。**这不是本图能改的**（是否让 `prds/` 进版本库属仓库所有者决策），但它意味着：三处镜像里有两处**没有版本历史**，任何一次回写都不留痕——已记入本图 **Not yet specified**。

**未做**：任何源码改动（工单只回写镜像）；未动 `prds/00–11` 的冻结条款；未抬任何 `docs/module-status` 成熟度标签。
