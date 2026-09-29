# 落：落库白名单取报告真值 + 报告 DTO 透出映射来源

Label: wayfinder:task
Type: task
Status: resolved
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

**已解**（与工单 03 同一批实现；主控已逐条读 diff 复核）。

### A · 落库取真值

- `apps/worker/src/eval/persist.ts` 的 `saveReport` 与 `saveL2Report`：三键由硬编码常量改为 `report.docMapSource` / `report.docMapResolved` / `report.docMapUnmappedIds`；原注释同步改写（不再写「worker 批跑无账本解析」）。
- **等价性**：未设置账本时 `summarizeDocMap(…, null)` 返回 `{ docMapSource:'none', docMapResolved:0, docMapUnmappedIds:[] }`（`packages/contracts/src/eval/corpus-ledger.ts` 的 `!ledger` 分支），与旧常量逐位相同 → 未设账本时库内形状**不变**。由 `apps/worker/tests/eval/persist-doc-map-keys.test.ts`（改写为 4 个 it）捕获 `set` 载荷断言。

### B · DTO 透出

- `packages/contracts/src/eval/eval-run.contract.ts`：`EvalRunSchema` 加三个**可选**字段 `docMapSource`（`z.enum(['ledger','none'])`）/ `docMapResolved`（非负整数）/ `docMapUnmappedIds`（字符串数组）。
- `apps/api/src/services/eval-runs.ts`：`EvalRunRow` 加三个可选成员；`extraStatsFromReport` 从 `reportJson` 里做**类型与取值域校验后**挑出三键（`'ledger' | 'none'` 白名单、`Number.isInteger && >= 0`、`Array.isArray && every string`）；`toEvalRunDto` 输出三键并**缺键容错**（`?? 'none'` / `?? 0` / `?? []`，兼容历史行）。
- **两处同改**已满足 `.strict()` 的要求：`EvalRunSchema` 与 DTO 输出形状一致，列表路径（`routes/eval.ts` 的 parse）不会因多余键或缺失键报错。
- **未动** admin / web 任何页面（按裁定 8）。

### 测例与门禁

- 新增 `apps/api/tests/eval/eval-run-dto-doc-map.test.ts`（3 it，含缺键容错）；改写 `apps/worker/tests/eval/persist-doc-map-keys.test.ts`（4 it）。均已登记 `tests/index.md`。
- 门禁：`check-types` 8/8 · `lint` 8/8（零 warning）· `contracts` 298 · `worker` 275 · `api` 1134（3 skipped）**全绿**；主控独立复跑一次结果相同。
- **反证**：把 `saveReport` 的 `docMapSource` 写回 `'none'` → 落库用例红；把 `toEvalRunDto` 的 `docMapSource` 写死 `'none'` → DTO 用例红（均已还原）。

### 边界

- 三键**可选**是为兼容历史行；当场收紧为必填需要先回填 `eval_runs.report_json` 的历史数据，故留为可选（记入地图 `Not yet specified`）。
