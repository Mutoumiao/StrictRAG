# 真栈真跑：入库语料 → 带账本跑 L1 → 记录实测 Hit@20

Label: wayfinder:task
Type: task
Status: open
Blocked by: 03, 04

## Question

在**本机 Docker 真栈**上把新能力真跑一遍，产出**仓内可复核**的实测记录：

1. **起栈**：按 `docs/ops/operable-stack.md` + `docs/ops/real-stack-evidence.md` 的既有配方（含前图补的 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 前置）起 PG + Redis 等，`/ready` 达到配方口径；**不要**改配方里的任何默认开关。
2. **入库并出账本**：用新入口把评测语料入库到**一个** KB，落出账本；报出 KB 全量 uuid 与该 KB 的文档终态（含 `title` / `status` / `lifecycle`）。
3. **带账本跑 L1**：用 `apps/api/src/scripts/run-l1-golden.ts` 跑一次（模式按本机实况，**如实标注** `retrieve_mode`：若无真 Gateway 则为 mock 路径），记录：`hitAtK` / `hitAtKHits` / `hitAtKScored`、`coverage`、`cRate`、`citationComplete`、`evaluated` 的 `reasons`（尤其 `hit_at_k_below_min` 是否出现）、以及映射来源字段。
4. **对照**：同夹具、同 KB，**分别**跑一次「不带账本」与「带账本」，把两个 `hitAtK` 三元组并排记录 —— 这是「映射真起作用」的直接证据（不带账本那一跑是回归锚）。
5. **如实写结论**：实测到的 Hit@20 是**多少就是多少**。若仍低于 70%，**不许**写成「门已达标」，要写清「门现在算得出真数字，值是多少，差在哪（检索召回 vs 未映射）」；并明写这**不是** `retrieve_mode=live`，**不构成**签字证据。
6. **顺带修**：真跑暴露的**只在真栈现形**的缺陷，当场按「收紧或逐位等价」修 + 补测例；撞冻结契约的记债并写清阻塞方（前图先例：ES bulk 等刷新、smoke 四眼）。

**不许**：把 mock 数字写成签字数字 · 改仓库默认开关 · 为了让数字好看而改夹具或过滤逻辑 · 伪造引用 / 代签。

产物：`research/05-real-stack-hit20.md`（命令 + 原始输出摘要 + 两张对照表 + 结论）。若本机环境不具备（如 Docker 不可用），**如实记**为阻塞方并写明缺什么，**禁止**据代码推断填数。

## Answer

（待填）
