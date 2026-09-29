# 回写 + 收口门禁

Label: wayfinder:task
Type: task
Status: open
Blocked by: 05

## Question

把本图的落地与实测按仓内纪律回写，然后收口。范围：

1. **镜像（IS）**：`docs/module-status/worker.md`（评测路径接账本、三态语义、边界）、`api.md` 与 `contracts.md`（若契约 / 白名单有变）。**写回纪律**：正文不写 `路径:行号`，不给裸标识符加反引号（守 `check:module-status` 的 `3-符号` / `5-表`）。
2. **配方与证据**：`docs/ops/operable-stack.md`（worker 侧账本的设置与拒跑语义）、`docs/ops/real-stack-evidence.md`（新增一节，含对照表与留痕目录名，写明**不是签字数字**）。
3. **覆盖表**：`docs/testing/coverage.md` 追加新一轮（**无行级值变化就明写无变化**），`docs/testing/coverage/03-ops.md` 等分册里与评测路径 / Hit@k 相关的**缺口列**按源码新状改写（覆盖值不动）。
4. **HOW**：`.trellis/spec/api/backend/l1-eval.md` · `l2-eval.md` 与 worker 侧对应 spec，写清 worker 侧账本来源、读取时机、失败语义、与 CLI 的同名同义关系。
5. **雾清单**：`.scratch/fog-inventory-2026-09-23.md` 追加 2026-09-29 动态注记（本图挑的雾 + 结论 + 未解决的部分）。
6. **收口门禁（必须在最后一次提交之后复跑）**：`pnpm check-types`（8/8）· `pnpm lint`（8/8 零 warning）· `pnpm run test --concurrency=1`（全绿）· `node scripts/module-status/check.mjs`（**39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` 三类**为空**）· `git status --short` 干净。
7. **对抗性反向复核**：逐条核「镜像里这句话在源码里真能指到吗」，把复核结论写进本工单 Answer（前图纪律）。
8. **地图封图**：`map.md` 补 `## Decisions so far` 六行、`Status: resolved`、`Not yet specified` 按本图新事实重写。

## Answer

<!-- 收口时填 -->
