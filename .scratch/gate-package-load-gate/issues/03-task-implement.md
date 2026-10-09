# 落：一致性闸与拒绝路径

Type: task
Status: pending
Blocked by: 02

## Question

按工单 02 的裁定落地（形状以裁定为准，本节只记纪律）：

- 只改**裁定点名的文件**；判定逻辑优先落成**纯函数**（可单测、无 IO），IO 部分保持薄。
- 新增测例：只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 简介」简体中文，并登记该包 `tests/index.md`。
- **反证必须做**：把新闸去掉 → 至少一条用例变红（否则该闸是空转）；把反证结果与红条数写进 Answer。
- 若裁定要求出 ADR：ADR 写进 `prds/11-decisions/00-adr-index.md`（磁盘文件，不在版本库），并在 Answer 里贴出新增条目的标题与状态；若 ADR 要求改 PRD / 升版本，按「ADR → 改 PRD → 升 `prds/README.md` 版本」执行并在 Answer 里写明改了哪几行。
- **不得**放宽任何硬门、不得改默认开关、不得改 `prds/00–11` 的其它条款。
- 若既有测例因新闸变红：先如实记录「断言期望 vs 实测」，判明**断言过严**还是**实现缺口**；不得为变绿而放宽实现。
- 收尾跑：相关包测试 · `pnpm check-types` · `pnpm lint`（零 warning）。

## Answer

待填
