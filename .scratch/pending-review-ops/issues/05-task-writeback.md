# 回写：镜像 / 覆盖表 / 交付 §0 / 雾清单

Type: task
Status: open
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
