# 02 · 裁定：账本 ↔ 库内对账的落点 / 失效语义 / 三键形状

Type: grilling
Status: open
Parent: ../map.md
Blocked by: 01

## Question

基于工单 01 的现状面，裁定四组：

1. **落点**：对账逻辑放哪一层（`corpus-ledger.ts` 纯函数 / `corpus-ledger-file.ts` I/O 层 / 两侧各自的跑批入口）；库读要用什么形状（按 `docId` 批量 in 查询 / 按 `kbId` 全列再比对）；是否允许做成**可选入参**（不传 = 与今天逐位一致）。
2. **失效语义**：`docId` 不存在 → 拒跑（响亮失败）还是记债继续跑？`title` 漂移 → 同一档还是另一档？「账本里多出一条库里没有的」与「库里存在但账本没记」要不要分开？给出与 `CorpusLedgerError` 的关系。
3. **两侧对称**：api CLI 与 worker 队列**必须一起接**（前图裁定 ⑦ 的判据），裁定具体接入点与「未传库句柄」时的姿态。
4. **三键形状定案**：`docMapSource` / `docMapResolved` / `docMapUnmappedIds` 收紧为必填（含历史行回填方案）还是明示保持可选，给出**理由与销账条件**。

**约束**：不许把「对不上」降级成「无账本」；不许把「未映射」变成 `null`；不许改门限数字与判定公式；不许改仓库默认开关。
