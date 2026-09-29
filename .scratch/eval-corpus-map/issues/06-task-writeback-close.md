# 回写镜像 / 配方 / 覆盖表 + 收口门禁

Label: wayfinder:task
Type: task
Status: open
Blocked by: 03, 04, 05

## Question

把本图的结论写回**该写的地方**，并做一次对抗性复核：

1. **回写清单**（逐条点名文件与要改的那一句）：
   - `docs/ops/`：补一条「评测语料入库 + 出账本 + 带账本跑批」的可复现步骤（插在哪一节由工单 01 的结论定；**不改**已有默认开关的描述）。
   - `fixtures/l1/README.md` / `fixtures/l2/README.md`：「逻辑 id 映射」一节从「人工替换纪律」改写成「有账本入口了，怎么用」，并写清**未映射仍然算 miss**。**只改 README，不动数据文件。**
   - `docs/module-status/api.md`（及 worker / db 若涉及）：按 `update-module-status` 的纪律回写（正文**不写路径行号**、裸标识符**不加反引号**）；写清「Hit@20 现在算得出真数字」与「**未**达标 / **未** live / **未**人签」。
   - `docs/testing/coverage/`：涉及 Hit@k / 逻辑 id 映射的行，**阻塞方**改判为「无仓内可重复的语料入库与映射入口」→ 现已具备，覆盖值按实况给（**不许**因为补了映射就抬成熟度；仍要 live 真跑 + 人签才能算测）。
   - `.scratch/fog-inventory-2026-09-23.md`：簇 **8** 附近的「逻辑 id 映射」相关口子（含 `l2-report-determinability` A 段那一项）标记处置结果，并追加 2026-09-29 的动向行。
   - `docs/ops/real-stack-evidence.md`：若工单 05 在真栈跑出了新的可复现事实，追加一节（或新建证据文并在该文加指针）。
2. **对抗性反向复核**：逐条核「这话在源码里真能指到吗」—— 尤其「门能算出真数字」这条**不许**被写成「Hit@20 已通过」。
3. **收口门禁**（必须在**最后一次提交之后**复跑）：`pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · 全仓 `pnpm test --concurrency=1`（并发会让 web 包超时假红）· `node scripts/module-status/check.mjs`（`1-路径` / `6-联动` / `7-时效` 须为空；基线 39 条 = 2 env + 13 符号 + 24 表）· `git status --short` 干净。
4. **按需 commit**：把本图改动按「一个逻辑改动一次提交」落成本地提交（**不 push**），提交说明写清做了什么 / 未做什么。
5. **地图收口**：填各工单 `## Answer`、把决议追加进 `map.md` 的 Decisions-so-far、写「目的地达成情况」、更新 `Not yet specified`（剩下的雾按「谁挡谁」分组，供下一张图挑）。

产物：回写后的文件 + 门禁原始输出摘要 + 本地提交清单 + 收口后的 `map.md`。

## Answer

（待填）
