# 落：落库白名单取报告真值 + 报告 DTO 透出映射来源

Label: wayfinder:task
Type: task
Status: open
Blocked by: 03

## Question

按工单 02 第 4 组与第 8 组的裁定，做两件事：让落库形状取报告真值，并让报告 DTO 透出映射来源。

### A · 落库白名单取真值

1. **`saveReport`**（L1）与 **`saveL2Report`**（L2）里的映射来源三键不再写死 `'none'` / `0` / `[]`，改为 `report.docMapSource` / `report.docMapResolved` / `report.docMapUnmappedIds`。
2. **等价性证明**：未设置账本时报告真值必须**恰好**等于今天的常量（`summarizeDocMap(…, null)` 的返回值）—— 用测例捕获 `set` 载荷断言三键值，不靠注释声明。
3. **白名单纪律**：确认白名单覆盖报告新增的每一个键（漏键静默丢是本仓已踩过的坑）。

### B · DTO 透出映射来源

4. `packages/contracts/src/eval/eval-run.contract.ts` 的 `EvalRunSchema` 加三个**可选**字段 `docMapSource` / `docMapResolved` / `docMapUnmappedIds`（形状对齐报告侧的类型，`docMapSource` 取值域 `'ledger' | 'none'`）。
5. `apps/api/src/services/eval-runs.ts` 的 `toEvalRunDto`（经 `extraStatsFromReport`）从 `reportJson` 读这三键并放进 DTO；缺键用 `?? 'none'` / `0` / `[]` 容错（历史行兼容）。
6. **A 与 B 必须同时完成**：只加 DTO 字段不加映射函数输出会让 `.strict()` 的列表路径（`routes/eval.ts:219`）报错；只加映射函数不扩 schema 同样报错。

### 通用

7. **测例**：新增或更新 `apps/worker/tests/eval/`（重点看 `persist-doc-map-keys.test.ts` 是否需按新语义改写）与 `apps/api/tests/` 下 eval-runs DTO 相关测例；文件头中文四段，登记各自包 `tests/index.md`。
8. **不许**改 `reportJson` 里其它既有键的语义；**不许**改 `eval_runs` 表的既有列；**不许**动 admin 页面。

## Answer

<!-- 收口时填 -->
