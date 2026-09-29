# 落「跑批侧按账本解析 + 报告如实标注映射来源」

Label: wayfinder:task
Type: task
Status: open
Blocked by: 02, 03

## Question

按工单 02 的裁定，把映射接到跑批侧（L1 必做；L2 是否一起按裁定书）：

1. **解析**：`apps/api/src/scripts/run-l1-golden.ts` 在读 `expectedDocIds` 之后、调 `hitAtKCase` 之前，按账本把逻辑 id 解析为当前 KB 的 uuid。**默认不传账本参数时的行为必须与今天逐位一致**（同一输入 → 同一 `hitAtK` / 同一 `hitAtKHits` / 同一 `hitAtKScored`）。
2. **报告如实标注**：报告里能读出这次的映射来源（按裁定书的三态或等价形状），且该字段**不参与任何判定**（`computeSignoffEligible` 与 `evaluateAdr046Bind` 的公式**一个字不动**）。若新增必填键，同步处理被字面量钉住的测试与落库路径（工单 01 已列出回归面）。
3. **未映射仍然响亮**：按裁定的行为落地——缺映射**算 miss**（保持 `hitAtK` 为真比值、非 `null`），同时在报告里可分辨「哪些逻辑 id 没映射上」；**禁止**把缺失写成 `null` 或「该门不适用」。
4. **不新增门**：本票**不**改 `hitAt20Min`、**不**给 `computeSignoffEligible` 加条件、**不**给 L2 加判定项。若发现某处代码客观上比 PRD 松，**只记录**，另开图裁定。
5. **测例**：新增 `<包>/tests/<能力>/<意图>.test.ts(x)`（简体中文头 + 登记 index）。至少钉：不传账本 → 与今天逐位一致（**回归锚**）· 传账本且全命中 · 传账本但缺某 id（算 miss 且可分辨）· 账本与 KB 不匹配时的行为（按裁定）· 报告来源字段的三态。
6. **反证**：至少两轮「破坏后变红」（如把缺失改成 `null`、把解析放到比对之后），并记录还原后全绿。

**不许**：改 `fixtures/` 数据文件 · 改 `PILOT_HARD_GATES` / `computeSignoffEligible` · 做模糊或子串匹配 · 让 mock 模式的数字看起来像签字数字。

产物：源码改动 + 测例 + 反证记录 + 一条「不传账本时逐位一致」的实证（同一夹具、同一模式，前后两次 `hitAtK` 三元组完全相同）。

## Answer

（待填）
