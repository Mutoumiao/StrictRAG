# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: open
Blocked by: 03, 04

## 做什么

1. **按 02 的「回写清单」逐处写回**：
   - `docs/module-status/api.md`：ADR-046 那段改写——哪几条门今天真的进判定、缺测语义、`businessPass` 在生产路径上不可达（**写明是有意**）、`judgeAuroc` 缺的是接线而非无生产者。
   - `docs/module-status/contracts.md`：两份 `compute*SignoffEligible` 的门清单 + 「只加严」。
   - `docs/module-status/worker.md`：若 L1 / L2 报告字段变了。
   - `docs/testing/coverage/03-ops.md` · `00-ask.md`：按脚本机械重数更新计数；T3 行保持「部分测」并补本图结论；引用完整率那条若从「缺实现」变成可断言，要改。
   - `.trellis/spec/api/` 对应包：新增「硬门判定落点」条目（门限常量在哪 / 判定在哪 / `null` 语义 / 新增门限时的硬约束 / 双写常量的处置）。
   - **`docs/module-status/*.md` 里禁止写 `路径:行号`**，不给裸枚举加反引号。
2. **登记测例**：把 03 / 04 新增的测例文件登记进对应包的 `tests/index.md`。
3. **对抗性反向复核**：每处回写逐条核「这话在源码里真能指到吗」。
4. **收口门禁（必须在最后一次提交之后跑）**：`pnpm check-types` · `pnpm lint` · `pnpm test`（全仓）全绿；`pnpm check:module-status` 的 `1-路径` / `6-联动` / `7-时效` 三类为空；`git status --short` 干净。
5. 在 `map.md` 写「目的地达成」段，未闭合项写进 Not yet specified。

## Answer

（待填）
