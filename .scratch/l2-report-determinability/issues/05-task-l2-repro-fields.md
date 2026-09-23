# 落 §8 的 L2 侧字段（剧本集哈希 · session/rewrite 版本）

Type: task
Status: open
Blocked by: 02

## Question

按裁定票 02，把 PRD §8 表里属于 L2 的两类字段（「**L2 剧本集哈希**」与「**session 策略版本 / rewrite prompt 版本**」）落到 L2 报告，形状与 L1 图建的 `L1Repro` 同构。

范围（以裁定票为准，此处为默认预期）：

1. 新增 L2 的可复现区块（键名、放置位置、是否子路径导出按裁定），至少含：
   - 剧本集哈希：复用 L1 图已建的稳定哈希写法（`l1QuestionIdsHash` 一类：id 集合内部排序后 sha256），**不另发明**。
   - `session 策略版本` / `rewrite prompt 版本`：有载体则取真值；无载体则 `null` + 记债（**禁止**拿源码文本哈希顶替 —— 前图已定此纪律：会随任意重构噪声跳变）。
2. 与既有 `l2Fingerprint` 的关系按裁定处理（合并 / 并存）；两侧**同构**：
   - api `buildL2EvalRunInsert` 是整对象直落；
   - worker `persist.ts` 的 `saveL2Report` 是**逐键白名单**，必须同步加键，否则新字段在 worker 侧**静默丢弃**；
   - 补一条测例钉住「worker 侧白名单不缺新键」。
3. 哈希进报告是否会把 `node:crypto` 带进 web/admin 客户端打包图 —— 按裁定决定导出路径，并**用 `pnpm build` 实证**（不是推断）。
4. 测例：新增落 `<包>/tests/<能力>/<意图>.test.ts`，文件头中文四段，登记 index；含反证。
5. 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试（**串行**）+ `pnpm install --frozen-lockfile`（若动 `package.json`）。

**不许**：改 PRD §8；编造版本值；新增表 / 迁移。
