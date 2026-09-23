# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: open
Blocked by: 03, 04, 05

## Question

工单 03 / 04 / 05 落地后，把现状写回镜像与规范，并跑收口门禁。

1. **回写 `docs/module-status/`**（api · worker · contracts · README 的能力矩阵，按实际改到哪些包）：如实写「已具备 / 未做 / 债」，每条能指到证据路径；**不写 `路径:行号`**；不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）。
2. **回写 `docs/testing/coverage*.md`**：新增能力落进覆盖表，标明「全 / 部分 / 缺」与理由。
3. **回写 `.trellis/spec/`**：把新增的判据、同构要求、缺测不放行语义写进对应包 spec（api / worker / contracts 侧各按实际）。
4. **对抗性反向复核**：逐条核「这话在源码里真能指到吗」；把口径写成可核对的形式（例如「四项零容忍里 N 项进判定、M 项记债」必须数得清）。
5. **收口门禁（必须在最后一次提交之后复跑）**：
   - `pnpm check-types` 全绿 · `pnpm lint` 零 warning；
   - `pnpm test` 全仓（**不得与他人并发**），记录各包文件数 / 通过数；
   - `pnpm check:module-status` → 须回到基线 **39 条 = 2 env + 13 符号 + 24 表**，且 `1-路径` / `6-联动` / `7-时效` **全空**；
   - `git status --short` 干净。
6. **收口补记**：把本图 `Not yet specified` 里已被消掉 / 新长出来的雾更新掉；若发现本图有「裁定但未落地」「实现缺口但超出本图」的项，明确写清挂在哪个工单 / 转给下一张图，**不许**含糊带过。
