# 裁定镜像回写的九处口径

Type: grilling
Status: resolved
Blocked by: —

## Question

审计（[01](./01-research-ledger-drift.md)）报出 9 处「待裁定」，它们不是源码问题，而是**镜像内部口径**问题。回写（[05](./05-writeback-mirrors.md)）必须先有这些口径，否则每处都要临场发明写法。逐条裁定：

1. **「划出范围」用什么完成标签**（QUAL-ACL-CAP / QUAL-G3 两行，及 PLANE 的 R4 / R6-b 两个子项）：总 backlog §0.1 的完成标签表里没有「划出」这一档。
2. **§2.5.2 表头「划出 3」的分母**：同行列了 4 个子项（R4 · R6-b · ACL-CAP · G3），按 ID 计是 3、按子项计是 4。
3. **P2-L 子包进度「3 / ~4」的分母**：同表列出 5 个 ID（OPS-1 ✅ · B10-RACI ✅ · QUAL-1 ✅ · B10-followup 部分 · OPS-STACK 部分），「~」未定义。
4. **L3「自动熔断 / 自动关」的口径**：`isL3RewriteFused` 进程内闩后强制 `rewriteEnabled=false` 已落（有测例），但不写 env；backlog §1.1 L158 写「无自动关」、交付控制台 §0.3 / §0.5 #31 写「无自动熔断」、`docs/module-status/api.md` 写「无写 env / 无收窄窗」——三处口径不一致，需定义后才好统一。
5. **覆盖表 / 矩阵的日期戳口径**：`docs/module-status/README.md` 表头写「2026-08-12 · 全量核对」，但表内已含 08-28 之后的内容；是重核全表还是改戳（或改成「增量回写」）。
6. **B10-followup「live ×2 / 30/30 真跑」的证据口径**：`artifacts/` 被 gitignore、本机不存在，仓内无可核对的 live 产物，唯一记载是 task 叙事。是补一条可核对指针、还是把「真跑 ✅」降级为「见 task 叙事」。
7. **`docs/module-status/` 矩阵该不该补 L7 / E4 字样**（审计 #33 判「不构成误述」）。
8. **`drizzle/meta` 口径不一致的归属写法**：`.trellis/spec/db/backend/database-guidelines.md:193` 写「19 份」、`docs/module-status/db.md:52` 写「21 份」。
9. **总 backlog §1.1 L151 与交付控制台 §0.2 / §0.5 #1 的「真跑」措辞**是否随第 6 条一起改。

## Answer

裁定（2026-09-20）。**注**：本图由人授权全自主执行，以下裁定由 agent 作出并留有依据，**不等于**产品/业务侧的正式确认；凡涉产品语义的分歧，以 `prds/00–11` 原文为准。

**1 · 新增完成标签「已关闭（划出）」**。总 backlog §0.1 增一行：

> | **已关闭（划出）** | 经工单或 ADR 裁定**无实现对象**或**无口径**而主动关闭；**不**表示已实现，也**不**计入子包分子 |

依据：仓库的工单三态里本就有 `wontfix`（`docs/agents/triage-labels.md`），此处只是给它一个中文完成标签；不新增语义。QUAL-ACL-CAP 与 QUAL-G3 用它。

**2 · §2.5.2 表头一律按「子项」计数**。同段「实现 6」数的是子项（PLANE-R10 / TENANT-Q / E5 / AA1 / L7 / E4），故「划出 3」是**口径不一致**，改为 **划出 4（子项）**，并保留括号枚举以便核对（R4 · R6-b · ACL-CAP · G3）。

**3 · §0.4 的分母 = §0.2 该子包定义里列出的 ID 数**。P2-L 在 §0.2 的定义含 5 个 ID（OPS-1 · B10-RACI · QUAL-1 · B10-followup · B8 live），故进度改 **3 / 5**；**OPS-STACK 从该格移出**改为脚注（它属 OPS 挂账，不在 P2-L 的定义里）。同时把这条分母来源写进 §0.4 的公式说明，免得下次再出现「~4」。

**4 · L3 术语分三档，三处统一**（`apps/api/src/obs/metrics.ts:71-77` 与 `apps/api/src/services/ask/execute.ts:153-157` 为源码依据）：

| 档 | 状态 | 含义 |
|----|:----:|------|
| **进程内闩后停用** | **已具备** | 三个 kind 任一触闩后，该进程内强制 `rewriteEnabled=false`；**不写 env、不落库、重启即失效** |
| 写 env 的全局关 | 未做 | 落盘式关停 |
| 面板 / 滑窗收窄 | 未做 | 运维面与 1h 滑窗 |

三处（backlog §1.1 L158 · 交付控制台 §0.3 / §0.5 #31）统一改写为「**有**进程内闩后停用 rewrite / **无**写 env 的全局关 / **无**面板」。依据：源码的注释本身就写「进程内；不写 env / 库」，而 `docs/module-status/api.md` 也如实记「无写 env」，只有 backlog 与控制台写成「无自动关 / 无自动熔断」，属**漏记已具备的那一档**。

**5 · 矩阵日期戳写「全量核对 2026-09-20」**。理由：本图的研究 01 就是一次对矩阵的全量核对（40 行逐条），所以不必降级为「增量回写」；同时在 `docs/module-status/README.md` 的「更新时机」补一句「矩阵按行增量回写；全量核对只在专门审计时做，并在表头注明日期」。

**6 · B10-followup 的 live 真跑数字降级**。判定优先级是「源码 > 状态文档 > task 叙事」，而该数字仓内**无可核对产物**（`artifacts/` 被 gitignore，本机不存在；`fixtures/l1/sample-report.md` 自述非 live 签字数字）。故三处（§0.2 · §0.5 #1 · backlog §1.1 L151）改为：

> 真跑记载仅存 task 叙事 `archive/2026-08/08-14-b10-followup-live-signoff`（`artifacts/` 被 gitignore，**仓内不留证**）

三态**仍为「部分」**（人签未做）——本条只改措辞，不改结论。

**7 · 矩阵补 L7 / E4 字样**：在「入库闭环」行末补一句「跨 doc 近重复可入审（`pending_review`）· 孤儿清理已落（周期调度未落）」。依据：矩阵是「端到端成熟度只写一次」的地方，这两项改变了端到端行为。

**8 · `drizzle/meta` 口径分两步**：本图工单 05 先把两处统一为「缺 `0001`–`0021` 共 21 份」（已实读：22 个 `.sql`、journal 22 条、`meta/` 只有 `0000_snapshot.json`）；工单 [11](./11-drizzle-meta-baseline.md) 落地后**同 PR** 把两处再改为「快照已补齐至 `0021_snapshot.json`，`db:generate` 可用」。`.trellis/spec/db/backend/database-guidelines.md` 处给**自检命令**而不只是写数字，避免再次过期。

**9 · 「真跑」措辞**同第 6 条，三处一并改。

**10 · 排除两条工具误报**（`pnpm check:module-status` 报出，已亲核）：

- 「`db.md` 引用的 `.scratch/fill-must-haves/research-drizzle-meta-baseline.md` 全仓未找到」——**文件确实存在**，是该脚本的 `walkFiles` 跳过点号目录所致。不改文。
- 「`api.md` / `worker.md` 写 `STORAGE_MODE=s3` 而代码默认 `local`」——两处包文原文就是「对象存储：默认 `local`（`STORAGE_MODE=s3` 走 RustFS）」，无漂移。不改文。

该脚本另有「符号」「表」两类共 32 条同类误报（`NULL` / `CONFLICT` / `node_used` 等概念名与指标名）。它的 7 号「时效」检查是有效的：本期报的 api / contracts / db / worker 四份包文「最近更新」未同步，与研究 01 的第 34 条一致，由工单 05 修。基线报告留档：`research/module-status-check-before.txt`。
