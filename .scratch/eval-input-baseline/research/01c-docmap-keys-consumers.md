# 01c · 报告三键（docMapSource / docMapResolved / docMapUnmappedIds）消费面与历史行

类型：研究（只读）
范围：`EvalRunSchema` 上层三键的契约定义、全部消费方、写入点、历史行规模、收紧为必填的代价、测例影响面。
不下裁定结论；每条结论附 `路径:行号`；未核实项显式标注。

---

## 1. 契约定义

### 1.1 `EvalRunSchema` 三键

`packages/contracts/src/eval/eval-run.contract.ts:32-65`（`EvalRunSchema`），三键在 `:56-58`：

- `:56` `docMapSource: z.enum(['ledger', 'none']).optional()`
- `:57` `docMapResolved: z.number().int().nonnegative().optional()`
- `:58` `docMapUnmappedIds: z.array(z.string()).optional()`

事实：三键均为 **可选**（`.optional()`）。
事实：取值域校验只有内联三处 —— `ledger / none` 枚举、`int().nonnegative()`、`string[]`；无跨三键的联合校验（例如不校验「source=none 时 resolved 必须为 0」）。
事实：`.strict()` 在 `:65`（对象体 `})` 于 `:64` 收口，`:65` 挂 `.strict()`）。同族 `.strict()` 见 `:15 / :29 / :65 / :77 / :86 / :93`；`EvalRunListResponseSchema` 的外层对象 `.strict()` 在 `:93`（定义 `:89-93`）。`.strict()` 只拒绝「未知键」，不放行「缺键」——故三键一旦设为必填，缺键即 parse 失败。

三键的类型锚（不在 `EvalRunSchema` 内，在账本契约）：
`packages/contracts/src/eval/corpus-ledger.ts:51-52` 定义 `DOC_MAP_SOURCES = ['ledger','none']` 与 `DocMapSource`；`:55-61` 定义 `DocMapSummary`（报告顶层三键形状，**非 optional**）。`EvalRunSchema` 的三键与之同义但降为可选。

### 1.2 `toEvalRunDto` 如何取三键、缺键容错

`toEvalRunDto` **不在 contracts**，在 `apps/api/src/services/eval-runs.ts:224-252`。取数与容错链：

- 原始抽取：`extraStatsFromReport(reportJson)`，`apps/api/src/services/eval-runs.ts:98-150`。三键相关判定在 `:139-149`：
  - `:139-141` 仅当 `row.docMapSource === 'ledger' || 'none'` 才写入；
  - `:142-144` 仅当为非负整数才写入 `docMapResolved`；
  - `:145-149` 仅当为 `string[]` 才写入 `docMapUnmappedIds`。
  - 缺键或脏值 → 该键**从 `out` 省略**（`:113-126` 的局部类型里三键均为 optional）。
- 行映射：`mapRow` 在 `:219` 以 `...extraStatsFromReport(r.reportJson)` 展进 `EvalRunRow`；`EvalRunRow` 三键在 `:39-41` 为 optional。
- DTO 兜底：`toEvalRunDto` 在 `:244-247`：
  - `:245` `docMapSource: row.docMapSource ?? 'none'`
  - `:246` `docMapResolved: row.docMapResolved ?? 0`
  - `:247` `docMapUnmappedIds: row.docMapUnmappedIds ?? []`
  - 注释 `:244`：「缺键容错（历史行没有 → none/0/[]），与 `EvalRunSchema` 的可选三键同改」。

结论（现状）：**容错发生在 `toEvalRunDto`，不在 schema**。历史行缺键经 `extraStatsFromReport` 被省略，再由 `toEvalRunDto` 回填为 `none/0/[]`；因此任何经 `toEvalRunDto` 的读路径**不会**因缺键而 parse 失败。

---

## 2. 全部消费方

全仓 grep `docMapSource|docMapResolved|docMapUnmappedIds` 命中文件（排除 `docs/` 叙述）如下。

### 2.1 生产代码（非测试）

| 文件:行号 | 角色 | 渲染 / 逻辑判定 |
|---|---|---|
| `packages/contracts/src/eval/corpus-ledger.ts:51-61` | 类型定义（`DocMapSource` / `DocMapSummary`） | 无 |
| `packages/contracts/src/eval/corpus-ledger.ts:239-262` | `summarizeDocMap` **生产三键的唯一纯函数** | 无（构造） |
| `packages/contracts/src/eval/eval-run.contract.ts:56-58` | schema 字段 | 无 |
| `apps/api/src/services/eval-runs.ts:39-41` | `EvalRunRow` 可选字段 | 无 |
| `apps/api/src/services/eval-runs.ts:107-109` | `extraStatsFromReport` 返回类型 | 无 |
| `apps/api/src/services/eval-runs.ts:122-124` | `extraStatsFromReport` 局部类型 | 无 |
| `apps/api/src/services/eval-runs.ts:139-149` | `extraStatsFromReport` 抽取/校验 | 逻辑（仅类型守卫，不参与门限） |
| `apps/api/src/services/eval-runs.ts:245-247` | `toEvalRunDto` 回填 | 逻辑（缺键兜底） |
| `apps/api/src/routes/eval.ts:219` | `EvalRunListResponseSchema.parse(...)`（列表端点） | 逻辑（schema 解析，见 §5） |
| `apps/api/src/routes/eval.ts:235` | GET `/:runId` 直接返回 `toEvalRunDto(row, true)`（**无 schema parse**） | 无 |
| `apps/api/src/scripts/run-l1-golden.ts:154-158` | `L1Report` 三键（**必填**） | 无 |
| `apps/api/src/scripts/run-l1-golden.ts:597-599` | `formatReportMd` **渲染** md 行 | 渲染 |
| `apps/api/src/scripts/run-l1-golden.ts:790-792` | 报告构造（取 `docMap` 真值） | 无 |
| `apps/api/src/scripts/run-l1-golden.ts:918-920` | CLI stdout JSON 字段 | 渲染 |
| `apps/api/src/scripts/run-l2-golden.ts:150-154` | `L2Report` 三键（**必填**） | 无 |
| `apps/api/src/scripts/run-l2-golden.ts:324-327` | `formatReportMd` **渲染** md 行 | 渲染 |
| `apps/api/src/scripts/run-l2-golden.ts:550-552` | 报告构造 | 无 |
| `apps/api/src/scripts/run-l2-golden.ts:607` | CLI stdout JSON 字段 | 渲染 |
| `apps/worker/src/eval/run-l1-batch.ts:134-138` | `L1BatchReport` 三键（**必填**） | 无 |
| `apps/worker/src/eval/run-l1-batch.ts:297-299` | 报告构造 | 无 |
| `apps/worker/src/eval/run-l2-batch.ts:135-139` | `L2BatchReport` 三键（**必填**） | 无 |
| `apps/worker/src/eval/run-l2-batch.ts:309-311` | 报告构造 | 无 |
| `apps/worker/src/eval/persist.ts:145-147` | `reportJson` 白名单写入（L1） | 无 |
| `apps/worker/src/eval/persist.ts:191-193` | `reportJson` 白名单写入（L2） | 无 |

### 2.2 三键是否进任何判定 —— 结论

事实：**三键不进任何判定**。证据：

- 全仓 grep 三键名，除「构造 / 类型 / 校验 / 渲染 / 落库」外，**无任何**门限、`signoffEligible`、`computeSignoffEligible`、`computeL2SignoffEligible`、`evaluateAdr046Bind`、`hitAtKCase` 的读取点。
- `apps/api/src/services/dashboard.ts:214-224` 的 `qualityFromEvalRow` 调 `extraStatsFromReport`，但只消费 `hitAtK`(`:221`) / `tauStar`(`:222`) / `judgeAuroc`(`:223`)，**不读三键**。
- `apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx` 渲染 `hitAtK`(`:298-299`) / `tauStar`(`:302-305`) / `judgeAuroc`(`:308-311`) 与行级 `hitAtK`(`:340`)；全仓 grep `apps/admin` **零命中** `docMap*` → **运营台不渲染、不判定三键**。
- `apps/web` grep `docMap*` **零命中**。
- `apps/api/src/routes/eval.ts:219` 的 parse 只是 wire 形状校验，结果不含阈值比较。

因此三键的「消费」实际只有：CLI 侧 md/JSON 渲染（`run-l1-golden.ts:597-599,918-920`；`run-l2-golden.ts:324-327,607`）、API 列表/详情 DTO 透出（`eval-runs.ts:245-247`；`routes/eval.ts:219,235`）、worker 落库（`persist.ts:145-147,191-193`）。

---

## 3. 写入点

### 3.1 api CLI 侧（`run-l1-golden.ts` / `run-l2-golden.ts`）

- 取值来源：`summarizeDocMap(cases.map(c => c.expectedDocIds), ledger)`（L1 `run-l1-golden.ts:727-730`；L2 `run-l2-golden.ts:517-519`）。`summarizeDocMap` 语义见 `corpus-ledger.ts:239-262`。
- 报告对象：L1 `run-l1-golden.ts:790-792`（`docMapSource/docMapResolved/docMapUnmappedIds` 逐键赋 `docMap.*`）；L2 `run-l2-golden.ts:550-552`。
- 落库：`buildEvalRunInsert` 在 `run-l1-golden.ts:255-281`，其 `reportJson: report`（`:278`）—— **整份 `L1Report` 原样入库**（含三键）。L2 走 `buildL2EvalRunInsert`，`reportJson: { ...report, l2Fingerprint: ... }`（`run-l2-golden.ts:240-243`）—— 同样是报告超集，含三键。

### 3.2 worker 侧（`persist.ts` reportJson 白名单）

- L1 `saveReport`：`apps/worker/src/eval/persist.ts:145-147`（键名逐一列出，值取 `report.docMapSource/docMapResolved/docMapUnmappedIds`）；注释 `:143-144` 声明「取报告真值…放白名单以免库内形状与 api 分叉」。
- L2 `saveL2Report`：`apps/worker/src/eval/persist.ts:191-193`；注释 `:190`。
- worker 报告来源：`run-l1-batch.ts:297-299` / `run-l2-batch.ts:309-311`，同样赋 `docMap.*`。

### 3.3 两处是否同形 —— 结论

**同形**。两处键名均为 `docMapSource` / `docMapResolved` / `docMapUnmappedIds`；值域均为 `ledger|none` / 非负整数 / `string[]`；两侧取值源都是 `summarizeDocMap`（api CLI 与 worker batch 都 import 自 `@strict-rag/contracts/eval-corpus-ledger`）。差异仅在**载体形状**：api CLI 存整份报告超集（`reportJson: report`），worker 存显式白名单（字段更少）；就三键本身上下一致。

---

## 4. 历史行规模（`eval_runs` 行数）

**未核实（需真库）**。

已核事实：

- 本机 Docker **当前不可用**：`docker ps` 报 `error during connect ... //./pipe/docker_engine: The system cannot find the file specified`（Docker daemon 未运行）。故本次无法连库计数。
- 无 seed / demo 数据写入 `eval_runs`：`scripts/seed-demo.mjs` grep `eval_runs|evalRun|INSERT` **零命中**；`*.sql` grep 仅命中建表/加列迁移（`packages/db/drizzle/0006_b10_eval_runs.sql:1`、`0010_eval_floor.sql:19-23`），无 seed 行。
- 库内行的**唯一写入口**是运行期：api CLI `run-l1-golden.ts:290`（`db.insert(evalRuns)`，受 `L1_PERSIST_EVAL` 开关，`:796-798`）与 `run-l2-golden.ts:252`（受 `L2_PERSIST_EVAL`）；worker 队列 `persist.ts:104/155`（`update`，行由 API `POST …/eval/runs` 预建，`eval-runs.ts:262-293`）。开关默认关（见 `fixtures/l2/README.md:32` 等），故历史行多寡取决于本机是否真跑过并开了 persist。
- 离线旁证（**非库内行**）：仓内有真跑产物 `artifacts/l1-{no-map,no-map-2,with-map,with-map-2}/l1-last-run.json`，`ranAt` 均为 2026-09-29，且含三键（`artifacts/l1-with-map/l1-last-run.json:738-740`、`artifacts/l1-no-map/l1-last-run.json:798-800`）；`docs/ops/real-stack-evidence.md:92,112-118` 记载真栈 L1 跑两次。这些是否经 `L1_PERSIST_EVAL` 落进 `eval_runs` **离线不可判**。

可核命令（Docker 可用后执行；PG 连接见 `docker/docker-compose.yml:19-27`，库 `strict_rag` / 用户 `strict_rag` / 端口 `5432`）：

```bash
docker compose -f docker/docker-compose.yml up -d postgres
# 总行数
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag -c "select count(*) from eval_runs;"
# 有/无三键的历史行数（report_json 为 jsonb，列名见 packages/db/src/schema/ask/eval-runs.ts:34）
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag \
  -c "select count(*) filter (where report_json ? 'docMapSource') as with_keys, count(*) filter (where not (report_json ? 'docMapSource') or report_json is null) as without_keys from eval_runs;"
# 按 run_type / report_json 是否含键分布
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag \
  -c "select run_type, (report_json ? 'docMapSource') as has_key, count(*) from eval_runs group by 1,2 order by 1,2;"
```

边界：即使库里 `without_keys>0`，也**不等于**读路径会 parse 失败（见 §5）。

---

## 5. 收紧为必填的真实代价

### 5.1 全部 `.strict()` / parse 调用点

- `EvalRunSchema` 定义与 `.strict()`：`packages/contracts/src/eval/eval-run.contract.ts:32-65`（`.strict()` 在 `:65`）。
- `EvalRunListResponseSchema` 外层 `.strict()`：`eval-run.contract.ts:89-93`（`.strict()` 在 `:93`）。
- 运行期唯一 parse 点：`apps/api/src/routes/eval.ts:219` `EvalRunListResponseSchema.parse({ items: items.map(...) })`（`items` 来自 `listByKb` → `mapRow` → `toEvalRunDto`，三键已回填）。详情端点 `:235` 直接返回 `toEvalRunDto`，**不经过 schema parse**。
- OpenAPI 文档生成（非运行期 parse）：`apps/api/src/openapi/document.ts:20,108` `zodSchema(EvalRunSchema)`。
- 测试内 parse：`packages/contracts/tests/eval/gold-contract.test.ts:70,71,74,75,76,77,78,79`；`apps/api/tests/eval/eval-run-dto-doc-map.test.ts:44,54`。

### 5.2 哪些路径会因历史行缺键而 parse 失败

**结论：走 `toEvalRunDto` 的运行期读路径不会失败。** 因为 `apps/api/src/services/eval-runs.ts:245-247` 在 parse 之前已把三键回填为 `none/0/[]`，所以 `routes/eval.ts:219` 收到的 DTO 恒含三键，历史行缺键被兜底吸收。`routes/eval.ts:235` 不 parse。→ 收紧为必填后，**历史行在 HTTP 层零 parse 失败**。

**真正会红的唯一已知路径：** `packages/contracts/tests/eval/gold-contract.test.ts` 的 it「run DTO requires matrix and forbids unknown fields」（`:56`）。其 `run` 夹具（`:57-69`）**不含三键**，直接 `EvalRunSchema.parse(run)`（`:70`）及后续 spread（`:71-79`）—— 收紧后会在 `:70` 抛 Zod 错。**1 个 it**。该 it 不经 `toEvalRunDto`，是当前唯一「直接构造裸 EvalRun 对象再 parse」的点。

其他潜在失败面（收紧后需连带处理，非「历史行」触发）：未来任何直接对 `reportJson` 调 `EvalRunSchema.parse` 的代码；当前无此类运行期代码。

### 5.3 用户可见后果

- 运营台（admin）**不**解析三键、**不**渲染三键，故不会因缺键报错；即便收紧，运营台无感（`eval-workspace.tsx` 无 `docMap*`）。
- worker / job 不消费三键（`persist.ts` 只写不读其判定），不会因此失败。
- 因此「历史行缺键」在**收紧为必填**后：**运行期静默**（被 `toEvalRunDto` 回填），唯一显性代价是 §5.2 的 1 个 contracts 测例需同步补键；隐性代价是语义 —— 回填把「历史行没有此键」与「本就没传账本（真 none）」压成同一读数 `none/0/[]`，若裁定要求区分，则当前 DTO 回填口径需另行设计（此项属裁定问题，不在此研究下结论）。

---

## 6. 既有测例的影响面（断言这三键的文件与 it 数）

| 文件 | 文件内 `it(` 总数 | 断言三键的行号（`expect(...)` 侧） | 涉及 it 数 |
|---|---|---|---|
| `apps/api/tests/eval/eval-run-dto-doc-map.test.ts` | 3 | `:41-43`、`:45-46`；`:51-54`；`:60-64` | 3 |
| `apps/worker/tests/eval/persist-doc-map-keys.test.ts` | 4 | `:91-93`；`:118-120`；`:134-136`；`:172-174` | 4 |
| `apps/api/tests/eval/l1-doc-map.test.ts` | 9 | `:136-138`；`:159-161`；`:191-192`；`:224/229`（md）；`:240-242`；`:248` | 6 |
| `apps/api/tests/eval/l2-doc-map.test.ts` | 5 | `:147-149`；`:164-166`；`:198`（md）；`:224-225` | 4 |
| `apps/worker/tests/eval/run-l1-batch-doc-map.test.ts` | 8 | `:78-80`；`:93-95`；`:119-120` | 3 |
| `apps/worker/tests/eval/run-l2-batch-doc-map.test.ts` | 8 | `:99-101`；`:116-118`；`:238-239` | 3 |
| `packages/contracts/tests/eval/corpus-ledger.test.ts` | 15 | `:175-177`；`:191-193`；`:201-202`（`summarizeDocMap` 3 个 it） | 3 |
| `apps/api/tests/eval/l1-cli.test.ts` | 21 | 无断言；三键仅作 `L1Report` 夹具字面量（`:253-255`、`:303-305`、`:651-653`） | 0 |
| `apps/api/tests/eval/l2-cli.test.ts` | 24 | 无断言；`sampleReport` 夹具字面量 `:500-502` | 0 |

补充：`apps/api/tests/eval/l1-cli.test.ts` / `l2-cli.test.ts` 的夹具因 `L1Report` / `L2Report` **本就必填三键**而含键，属类型要求，不构成三键行为断言。

---

## 未核实清单（需真环境）

1. `eval_runs` 历史行总数、含/不含三键的行数：**未核实（需真库）**。本机 Docker daemon 未运行；可核命令见 §4。
2. 仓内 `artifacts/l1-*` 真跑产物是否经 persist 落进 `eval_runs`：**未核实（需真库 + 跑批开关状态）**。
3. 生产 / 试点环境是否存在历史行：仓库内无该信息。
