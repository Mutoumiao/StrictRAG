# 落 L2 采集面：`docId` 与「命中期望文档」

Type: task
Status: open
Blocked by: 02

## Question

按裁定票 02 的形状，把 L2 两侧的采集面补上，让「主题是否命中期望文档」从**没有原料**变成**有原料且有判据**。

范围（以裁定票为准，此处为默认预期）：

1. 两侧的 turn 结果形状都能拿到 `evidenceDocIds`：
   - api CLI：从 `graph.evidence_snapshot[].docId` 取（L1 侧已有同款写法）。
   - worker：`createEvalHttpL2Execute` 从回包 `data.evidenceDocIds` 读（L1 的 `createEvalHttpExecute` 已有同款写法），并把 `L2TurnExecuteResult` 扩到能携带它。
2. 「命中期望文档」按裁定落到报告 / 判定（复用 `hitAtKCase` 一类既有纯函数；无标注题 → `null` → **不放行**，不得 fail-open）。
3. 「合法 citation」按裁定落（若裁定为「不可判」，则如实落到报告的可读位置并在文档里记债，**不许**造替代判据）。
4. 两侧**同构**：api CLI 与 worker batch 的字段名、口径、缺测语义必须一致；`apps/worker/src/eval/persist.ts` 的白名单同步补齐（逐键白名单会**静默丢弃**新键）。
5. 测例：新增落 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」简体中文，登记该包 `tests/index.md`；**必须包含可达性证明**（合法输入 → 该门能变真）与**反证**（把新采集面拆掉 → 立刻变红且 reason 可分辨）。
6. 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ 相关三包测试（**串行**跑，不与其他测试命令并发）。

**不许**：新增迁移 / 表 / HTTP 端点；放宽 `computeL2SignoffEligible` 任何既有条件；改 `fixtures/l2/gold.yaml`（除裁定票明确要求）。
