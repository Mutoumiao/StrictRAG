# 裁定：L2 三腿证据面各落到什么形状

Type: grilling
Status: open
Blocked by: 01

## Question

研究票 01 的事实到位后，把三腿各**裁成可执行的形状**，好让工单 03 / 04 / 05 只做落地不做选择：

1. **采集面**：
   - `docId` 走哪条路进两侧（api CLI 直接读 `graph.evidence_snapshot[].docId`；worker 从 `ExecuteAskJson.data.evidenceDocIds` 读）？两侧的**结果形状**怎么改才能同构（`L2TurnExecuteResult` 加 `evidenceDocIds`？还是加整个 items 数组）？
   - 「命中期望文档」进不进 `L2BatchReport` / `L2Report`？进的话是什么形状（每条 case 一个 bool + 整批一个率？还是只落实测集合让下游自己算）？
   - 「合法 citation」要不要落机械判据？若要，判据是复用 L1 的 `answerKind='knowledge' ∧ answered ∧ citations>0`，还是 L2 无 `answerKind` 时改用别的（或**如实记为不可判**）？
   - 关键前置：若研究票查明 **fixture 的 `expectedDocIds` 与真跑 `docId` 对不上**，则本腿是「补了原料但判不出命中」——此时裁定是「补原料 + 如实标不可判」还是「先不补」。必须给出依据。

2. **零容忍**：四项逐项裁定落到 **① 机械进判定 / ② 机械记报告但不进判定 / ③ 如实记为「需人 / 需 judge」并记债** 三档中的哪一档，各给理由与 PRD 依据。
   - 「历史文本进 evidence」扩宽到上轮 assistant 文本 —— 改还是不改？若研究票查明「structural上不可能」（evidence 只可能来自 KB chunk），则裁定为「保持现状 + 把不变式写成测例钉住」还是「加纵深防御」。
   - `min_support` 这一半比不比？PRD 写「历史文本进 evidence/`min_support`」，`min_support` 是数值不是文本集合 —— 这句话在 PRD 里到底指什么（研究票给事实，主控给裁定）。
   - 「主题粘连胡答」`themePersist` 交叉约束这个方向**接不接受**？不接受的话如实记什么债。
   - 加严后 `computeL2SignoffEligible` 的**新公式原文**写出来（含 reason/标记名），并给出「旧为真集合 ⊇ 新为真集合」的论证。

3. **§8 L2 字段**：
   - 「L2 剧本集哈希」用哪条既有哈希写法、算什么（id 集合 / 文件内容）、放哪个键、进报告还是只进 `reportJson`。
   - 「session 策略版本 / rewrite prompt 版本」今天有没有载体？没有 → 写 `null` + 记债（**禁止**拿源码文本哈希顶替，前图已定此纪律）。
   - 新增区块走**子路径导出**还是进 `index.ts`（取决于研究票对 `node:crypto` 客户端图路径的核证）。
   - `l2Fingerprint` 要与新字段**合并**还是**并存**？`persist.ts` 白名单要不要同构补齐（两侧不同构是前图踩过的坑）。
   - 新字段要不要透 `…/eval/runs` 的 DTO（`EvalRunSchema` 是 `.strict()`）？透 / 不透各给后果。

4. **统一纪律**（每条都要回答「是 / 否 + 一句话」）：
   - 是否**不新增迁移 / 不新增表 / 不新增 HTTP 端点**？
   - 是否所有改动**收紧或逐位等价**？
   - 默认配置下 `computeL2SignoffEligible` 是否**仍为 false**（不得为变绿而放宽）？
   - 夹具（`fixtures/l2/gold.yaml`）是否**不动**？若必须动（例如为「冲突跟错数字」加结构化字段），动哪几条、为什么、是否属「先裁再动」。

## Answer

（待研究票 01 收口后填写）
