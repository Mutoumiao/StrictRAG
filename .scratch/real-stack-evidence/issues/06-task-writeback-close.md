# 回写与收口（覆盖表 / module-status / spec / 雾重排）

Label: wayfinder:task
Type: task
Status: open
Blocked by: 04, 05

## Question

把工单 02–05 真跑得到的结论回写到正确的地方，并收口本图：

1. **`docs/module-status/`**：把「真栈未验证」相关的句子改成**实测结论**（含证据路径）；`docs/ops/operable-stack.md`、`docs/ops/half-smoke.md` 里与实测不符的句子订正（**只允许加证据或订正**，不许放宽）；遵守镜像纪律：正文**不写 `路径:行号`**、不给裸标识符加反引号。
2. **`docs/testing/coverage/`**：把工单 05 逐条裁定的行（至少 `X5`，及工单 01 核出的其它「真 ES / 真 PG 阻塞」行）改判或把销账条件写准，并附真跑证据路径。判据以 PRD 原文措辞为准；**不许**为了让某行变绿去放宽断言。
3. **`.trellis/spec/`**：真跑暴露的「真实运行时行为 vs spec 描述」差异，回写对应包 spec（HOW）。
4. **雾重排**：更新 `.scratch/fog-inventory-2026-09-23.md` 里被本图解掉 / 收窄的簇（23 · 24 · 36 · 37），并把本图 `Not yet specified` 里新暴露的雾搬过去或立成下一张图的候选。
5. **收口门禁**：最后一次提交**之后**跑 `pnpm check:module-status`（`1-路径` / `6-联动` / `7-时效` 三类须为空）+ `pnpm check-types` + `pnpm lint` + 全仓 `pnpm test --concurrency=1`，把命令与结果写进本票 Answer。
6. 更新本图 `map.md`：Destination 达成情况写清（**哪些真跑了、哪些没跑成及为什么**）、Decisions-so-far 补全、前沿清空或如实留票。

产物：本票 Answer + 各处回写的 commit。

## Answer

（待填）
