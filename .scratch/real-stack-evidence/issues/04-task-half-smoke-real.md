# `pnpm smoke:half` 端到端真跑（P-HALF 从「宣称」到「可复现」）

Label: wayfinder:task
Type: task
Status: open
Blocked by: 02, 03

## Question

在真栈上跑通 HALF-SMOKE：`txt 上传 → complete → 审批 → scan → 双就绪 → active → ask 有引用`。

要点：

1. 前置：`pnpm db:migrate`（工单 03）+ api/worker 起（`pnpm up:apps`，或分别 `pnpm --filter @strict-rag/api start` / `@strict-rag/worker start`）；`.env` 叠加 `.env.operable.example`（**仓库默认不动**）。
2. 跑 `pnpm smoke:half`，记录退出码与 `PASS`/`FAIL` 行；`citations ≥ 1` 且含本次 `docId` 才算真绿。
3. **live ask 的已知前置**：`docs/ops/half-smoke.md` 写「缺 `GATEWAY_BASE_URL` 时默认 mock chat 不是 JSON → ask 拒答 → 空引用失败」。本机无真模型 key → 若因此失败，**先核清**：这是否说明「半产品可运行」这条在**没有 Gateway** 的机器上根本不可复现？还是仓库里另有一条 mock-but-JSON 的路径（查 `apps/api/src/services/gateway/` 的 mock 分支与 `GATEWAY_BASE_URL` 缺失时的行为）？**核清事实**再下结论，不许猜。
4. 若卡在某一步，写清卡点，并把卡点对应的**源码行 / env 项**指出来；若是**源码缺陷**（不是缺 key），当场修并补测例。
5. 顺带跑 `pnpm --filter @strict-rag/worker smoke:mongo`（真 Mongo 正文 upsert 回读）。

产物：`research/04-half-smoke.md`（命令 + 关键输出 + 卡点）。

## Answer

（待填）
