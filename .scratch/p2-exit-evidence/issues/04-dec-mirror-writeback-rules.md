# 裁定镜像回写的九处口径

Type: grilling
Status: open
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

（进行中）
