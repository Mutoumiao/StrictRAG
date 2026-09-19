# 回写覆盖表：11 行过期标注 + 4 处汇总矛盾 + 23 行阻塞登记

Type: task
Status: open
Blocked by: —

## Question

`docs/testing/coverage.md` 与其四分册（`docs/testing/coverage/00-ask.md` · `01-ingest.md` · `02-acl.md` · `03-ops.md`）今天把**已有测例的行**写成欠债，又把四处汇总数写错。按行级事实回写，并给被阻塞的行留下出处明确的登记。

三件事：

1. **回写 11 行已过期的状态**（只改状态列，不新增测例）：E4 · E5 · L7 · V3 · O4 · R10 · AA1 · AB8 · AC7 · V4 · Q4 —— 每行都已在 `research/coverage-partial-tests.md` 的「A. 已具备但表中仍标部分测」表里给出可指认测例路径。
2. **修四处汇总与行级矛盾**：ask（汇总 24/26 vs 行级 25/25）· ingest（汇总 33 vs 分册 31）· acl（汇总 37 vs 行级 39，且分册「延后 2」在行级无对应）· ops 的 AD / G 子表未随行级更新。
3. **登记 23 行不可离线补的行**，每行写明阻塞方与出处，不得含糊：真 ES / 真双节点 / 真进程（E1 · E2 · H5b · H5d · P1 · AC4）· 人签与 live 真跑（T4 · C1–C3）· **源码与 Then 不一致或源码无落点（D-拼句 · H1 · H5e · M8 · S1 · S4 · Y6 · X4 · X5 · R9 · T6 · V5 · U8/J7c · P3 · AC2）**。

约束：覆盖表是**派生对照表**，改它**不得**抬 `docs/module-status` 的成熟度，**不得**改写剧本原文，**不得**把 mock 结果标成「已测」来清零。被源码阻塞的行要显式登记（改源码或回 PRD 裁口径）——这一簇正是雾中新出现的那块。

## Answer

（进行中）
