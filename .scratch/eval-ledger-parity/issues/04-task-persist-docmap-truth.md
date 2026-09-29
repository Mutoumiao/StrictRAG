# 落：落库白名单取报告真值（`eval_runs.report_json` 与 api 侧同形）

Label: wayfinder:task
Type: task
Status: open
Blocked by: 03

## Question

按工单 02 第 4 组的裁定，把 `apps/worker/src/eval/persist.ts` 两处白名单里的**硬编码常量**改成**取报告真值**，使 `eval_runs.report_json` 的形状与 api CLI 侧同构。范围：

1. **`saveReport`**（L1）与 **`saveL2Report`**（L2）里的映射来源三键不再写死 `'none'` / `0` / `[]`，改为 `report.docMapSource` / `report.docMapResolved` / `report.docMapUnmappedIds`。
2. **等价性证明**：未设置账本时，报告里的真值必须**恰好**等于今天的常量 —— 用一个测例钉住（捕获 `set` 载荷断言三键值），而不是靠注释声明。
3. **白名单纪律**：确认白名单**覆盖报告新增的每一个键**（漏键静默丢是本仓已踩过的坑）；若工单 03 引入了新的报告键，同步加进两处白名单。
4. **测例**：更新或新增 `apps/worker/tests/eval/` 下相关测例（重点看 `persist-doc-map-keys.test.ts` 是否需要按新语义改写），文件头中文四段，登记 `apps/worker/tests/index.md`。
5. **不许**改 `reportJson` 里其它既有键的语义；**不许**改 `eval_runs` 表的既有列。

## Answer

<!-- 收口时填 -->
