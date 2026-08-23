# api · L1 黄金集评测（B10 工程 seed）

> 路径：`apps/api/src/eval/` · `apps/api/src/scripts/run-l1-golden.ts` · 仓根 `fixtures/l1/`  
> 产品语义：`prds/08-quality`（覆盖率 / 2×2）· 任务 `08-08-b10-l1-golden-set`  
> **本窗状态**：工程底座 **已落地**；OPS-1 live profile + `retrieve_mode`/`signoffEligible`；B10-followup **工程**（`eval_runs` 表 + gold 60 + `L1_PERSIST_EVAL`）已归档；B10-RACI owner 表 `fixtures/l1/RACI.md`；ADR-046 快照绑定已落；**业务人签未做**；**L3 打点部分（无自动熔断）**；L2 题面草案见 [l2-eval](./l2-eval.md)（**≠** 准出）。

---

## 双轨门禁（X-13 · ADR-061）

| 轨 | 含义 | 何时算「绿」 | **禁止**宣称 |
|----|------|--------------|--------------|
| **工程绿** | CI / 本地 vitest + mock 注入 CLI | `l1-matrix` · `run-l1-golden` 注入测通过；exit 0 写报告 | 「L1 业务签字 PASS」 |
| **签字 PASS** | 产品/质量门禁 | `signoffEligible===true`（live retrieve）+ RACI 人签 + 配置快照（ADR-046） | 把 mock coverage 写进签字页 |

| 字段 | 工程绿 | 签字 PASS |
|------|:------:|:---------:|
| `mode` / `retrieve_mode` = mock | ✅ 可 | ❌ |
| = live（`RETRIEVE_ES_MODE=http` 等） | ✅ 可 | 必要条件，**非充分** |
| `signoffEligible` | 仅标注 | 须 true（live+规模） **且** 人工签 |
| coverage 数字 | 工程观察 | 仅 live + 人签后可进门禁叙事 |

**Wrong**：PR 全绿 → 路线图勾「L1 已过」。  
**Correct**：PR 工程绿；签字另附 live 报告 + `fixtures/l1/RACI.md` owner。

---

## Scenario: L1 批跑 CLI → executeAsk → 2×2 报告

### 1. Scope / Trigger

- Trigger：新增 CLI 入口、env 键、跨层（fixture → script → `executeAsk` → graph）、可执行错误矩阵。
- 目标：串行批跑黄金题，产出 **mode 标注** 的 2×2 矩阵与覆盖率；CI 只钉 **纯函数 + mock 注入**，不跑 live LLM。
- 非目标：B6 看板、worker-eval 队列、L2/L3；题面已扩≥30+30，**live 真跑数字**仍见 B10-followup 余量。

### 2. Signatures

| 符号 | 位置 | 说明 |
|------|------|------|
| `cellFor(type, outcome)` | `eval/l1-matrix.ts` | → `'A'\|'B'\|'C'\|'D'\|null` |
| `accumulate(matrix, type, outcome)` | 同上 | 就地 +1 格；error → 返回 `1`（error 增量） |
| `coverage(matrix)` | 同上 | `A/(A+B)`；分母 0 → `null` |
| `goldTypeCounts(cases)` | 同上 | `{ answerable, unanswerableClass }` |
| `computeSignoffEligible(mode, counts)` | 同上 | live ∧ 各≥`SIGNOFF_MIN_PER_CLASS`(30) |
| `bindQualitySnapshotToEval(input)` | `eval/adr046-snapshot.ts` | ADR-046 快照绑定 eval 身份；硬门放宽 / 缺四要素 → 不得 `signedPackage`；coverage=0 / `internal_guard` → 不得 `businessPass` |
| `writeBoundSnapshot(outDir, …)` | 同上 | 写 `l1-gate-snapshot.json`（gitignore 产物） |
| `loadGold(goldPath)` | `scripts/run-l1-golden.ts` | 读 JSON 形 gold；失败抛 `GoldLoadError` |
| `runL1Golden(opts)` | 同上 | 串行批跑 + 写报告；可注入 `execute` |
| `executeAsk(params, deps?)` | `services/ask/execute.ts` | 批跑 **必须** `deps.skipTrace: true` |
| CLI `main` | `run-l1-golden.ts` isMain | 读 env → `runL1Golden` → stdout 摘要 JSON |

```ts
// 批跑入口（生产路径形状）
await executeAsk(params, { skipTrace: true, ...opts.executeDeps });
// outcome = result.graph.status  // 'answered' | 'abstained'（throw → 'error'）
```

### 3. Contracts

#### Gold 文件（`fixtures/l1/gold.yaml`）

- 扩展名按 design 为 `.yaml`，**内容为 JSON**（`JSON.parse`，**零 yaml 依赖**）。
- 根：`{ "cases": GoldCase[] }`，`cases` 非空数组。

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | string | 必填非空 |
| `question` | string | 必填非空 |
| `type` | enum | **仅** `answerable` \| `unanswerable` \| `false_premise` |
| `expectedDocIds?` | string[] | 逻辑 id（见 fixtures README）；本窗不设 A 格命中下限 |
| `expectedChunkIds?` | string[] | 可选 |
| `rubric?` | string | 可选 |

Seed 规模：可答 30 + 不可答类 30（含 `false_premise`）；**mock 数字禁签字**。

#### 2×2 格映射（error 不计格）

| type \\ outcome | `answered` | `abstained` | `error` |
|-----------------|------------|-------------|---------|
| `answerable` | **A** | **B** | 不计；`errorCount++` |
| `unanswerable` | **C** | **D** | 同上 |
| `false_premise` | **C** | **D** | 同上（不可答子集） |

- **覆盖率** `coverage = A / (A+B)`；无 answerable 样本 → `null`（勿当 0）。
- `false_premise` **不**单独成格。

#### `L1Report`（写出 `artifacts/l1-last-run.json` + `.md`）

| 字段 | 约束 |
|------|------|
| `mode` | `'mock' \| 'live' \| 'unknown'` ← `resolveEvalMode(RETRIEVE_ES_MODE)`（历史字段） |
| `retrieve_mode` | 与 `mode` 同步（OPS-1 签字归因） |
| `signoffEligible` | `live` **且** 本跑 `answerable≥30` ∧ `unanswerableClass≥30` → `true`；mock / unknown / 截断冒烟 → `false`；**≠** 自动业务签字 |
| `answerableCount` / `unanswerableClassCount` | 本跑实际题量（受 `L1_MAX_CASES` 截断）；`false_premise` 计入不可答类 |
| `evalRunId?` | `L1_PERSIST_EVAL` 写入 `eval_runs` 后的 id |
| `gateSnapshot?` / `gateVerdict?` | ADR-046：配置快照绑定 `evalBindId`；`signedPackage` 须四要素且硬门未放宽；`businessPass` 另须 signoffEligible ∧ coverage>0 ∧ 非全 `internal_guard` |
| `ranAt` | ISO 字符串（artifact / report_json）；**写库** `eval_runs.ran_at` 用 `formatLocalDateTime`（`evalRunDbRanAt`） |
| `caseCount` / `errorCount` | number |
| `matrix` | `{ A,B,C,D }` |
| `coverage` | `number \| null` |
| `cases[]` | 每题 `id,type,outcome,cell,reason?,errorMessage?` |
| `kbId` | 本跑使用的 KB |

`mode`/`retrieve_mode` 规则：`RETRIEVE_ES_MODE===mock` → `mock`；`===http` → `live`；其余 → `unknown`。  
`undefined` 时读 `env.RETRIEVE_ES_MODE`（单测须 **显式** 传入 esMode，勿依赖进程 env 偶发值）。

#### 环境键（CLI）

| 键 | 必填 | 默认 | 说明 |
|----|------|------|------|
| `L1_KB_ID` | **CLI 必填** | — | 缺失 → exit **2** |
| `L1_MAX_CASES` | 否 | 全量 | 正整数；非法 → exit 2 |
| `L1_GOLD_PATH` | 否 | `<repo>/fixtures/l1/gold.yaml` | |
| `L1_OUT_DIR` | 否 | `<repo>/artifacts` | |
| `L1_TENANT_ID` | 否 | 固定 dev uuid | |
| `L1_USER_ID` | 否 | 固定 dev uuid | |
| `L1_PERSIST_EVAL` | 否 | 关 | `1`/`true` → insert `eval_runs`（db migration 0006） |

> **Turbo**：`turbo.json` 的 `lint` / `test` task env 须声明 `L1_*`（含 `L1_PERSIST_EVAL`）；新增键同步改 turbo。

#### 产物与 git

| 路径 | 提交？ |
|------|--------|
| `fixtures/l1/gold.yaml` · `README.md` · `sample-report.md` | ✅ |
| `artifacts/l1-last-run.*` | ❌ gitignore |
| mock 数字进业务签字页 | ❌ **禁止** |

#### 依赖注入（单测 / CI）

```ts
type RunL1Options = {
  goldPath: string;
  outDir: string;
  kbId: string;
  maxCases?: number;
  tenantId?: string;
  userId?: string;
  /** 注入假 execute，避免 live LLM */
  execute?: (params: ExecuteAskParams, deps?: ExecuteAskDeps) => Promise<ExecuteAskResult>;
  executeDeps?: ExecuteAskDeps;
  /** 写入 PG eval_runs；默认看 L1_PERSIST_EVAL */
  persistEval?: boolean;
};
```

- 默认 `execute = executeAsk`，且批跑硬编码合并 `{ skipTrace: true, ...executeDeps }`。
- **禁止**批跑写 ask_traces（海量噪声 + 拖慢 + 污染观测）。

### 4. Validation & Error Matrix

| 条件 | 行为 |
|------|------|
| 无 `L1_KB_ID`（CLI） | stderr + **exit 2** |
| `L1_MAX_CASES` 非正数 | stderr + **exit 2** |
| gold 文件不可读 / 非 JSON | `GoldLoadError` → CLI **exit 2** |
| `cases` 空或非数组 | `GoldLoadError` |
| 单 case 缺 id/question 或 type 非法 | `GoldLoadError`（含 index） |
| 单题 `executeAsk` **throw** | 该题 `outcome=error`；矩阵不加格；继续串行 |
| 单题返回 `graph.status` | 按 `cellFor` 入格 |
| 其它未捕获异常（非 GoldLoad） | CLI **exit 1** |

进程退出码：**0** 成功写报告（含 errorCount>0 的「有失败题」）；**2** 配置/金标加载；**1** 意外。

### 5. Good / Base / Bad Cases

- **Good**：`L1_KB_ID` 已设 · gold ≥1 · mock 或注入 `execute` · 串行完成 · 报告 `mode` 正确 · `artifacts/` 写出。
- **Base**：默认 gold 30 题 · `skipTrace: true` · 覆盖率公式 · error 不进 A–D。
- **Bad**：把 `RETRIEVE_ES_MODE=mock` 的 coverage 写进业务签字 / 宣称 L1 门禁 PASS；并行批跑打爆 Gateway；批跑不设 `skipTrace`；引入 `yaml` 包只为解析 JSON 形 gold；CI 强依赖 live LLM。

### 6. Tests Required

| 层 | 文件 | 断言点 |
|----|------|--------|
| 纯函数 | `tests/eval/l1-matrix.test.ts` | A/B/C/D 映射；error→null；accumulate error 增量；coverage 分母 0→null |
| CLI/IO | `tests/eval/l1-cli.test.ts` | loadGold 合法/非法；`resolveEvalMode` 三态；注入 execute 得矩阵；写出 json+md；error 题不污染格；live+30/30→signoffEligible；mock/截断→false |
| 集成（可选） | 同文件 mock graphDeps 路径 | `runL1Golden` + `executeDeps.graphDeps` 不撞 DB trace |

**CI 边界**：单元/注入测必须绿；**不要求** 默认 PR 流水线跑真实 Gateway + ES。

本地 live 烟测（人工）：

```bash
L1_KB_ID=<uuid> L1_MAX_CASES=5 pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
```

### 7. Wrong vs Correct

#### Wrong

```ts
// 并行 Promise.all 批跑 live → 打爆网关 / 乱序难复现
await Promise.all(cases.map((c) => executeAsk(...))); // 无 skipTrace

// mock 数字当签字
// coverage=0.93 (mode=mock) → 业务验收 PASS  // 禁止
```

#### Correct

```ts
for (const c of cases) {
  try {
    const result = await executeAsk(params, { skipTrace: true });
    outcome = result.graph.status;
  } catch {
    outcome = 'error'; // 不计 A–D
  }
  accumulate(matrix, c.type, outcome);
}
// 报告头必须含 mode；mock 禁止写入业务签字页
```

---

## Design Decision: CLI 直调 executeAsk（非 HTTP 自调用）

**Context**：需要可脚本化批跑，且能注入 graph 做 CI。

**Options**：
1. HTTP 打本机 `/ask` — 需起服、鉴权、难注入  
2. **直调 `executeAsk`** — 同进程、可 `graphDeps` / `skipTrace`  

**Decision**：选项 2。CLI 与 route 共享同一业务入口；route 仍只调 `executeAsk`。

**Extensibility**：B6 看板只读报告 artifact / `eval_runs` 表（`L1_PERSIST_EVAL`）；批跑逻辑仍可复用 `runL1Golden`。

---

## Design Decision: gold.yaml 内容 JSON + 零 yaml 依赖

**Context**：design 冻结扩展名 `.yaml`；解析库增加 catalog 与体积。

**Decision**：文件扩展名保留；内容合法 JSON；`JSON.parse`。`.json` 路径亦可被 `loadGold` 读取。

**禁止**：为 seed 单独加 `yaml`/`js-yaml` 依赖（除非未来真 YAML 多文档需求 + ADR）。

---

## Design Decision: CI = 矩阵纯测 + mock 注入，非 live 门禁

**Context**：默认 Gateway/ES mock；live 成本与 flaky 高。

**Decision**：
- 自动化钉 **cell 映射 / coverage / loadGold / 注入 execute**  
- live 全量 ≥30 为人工/后续 B10-followup 签字路径  
- 报告 **强制 `mode` 字段**；文案禁止把 mock 当生产门禁

---

## Design Decision: error 出 A–D

**Context**：throw / 基础设施失败 ≠「系统错误答了不可答题」。

**Decision**：`outcome=error` → `cellFor=null`；只增 `errorCount`。避免 error 灌进 C 或 B 扭曲覆盖率。

---

## Convention: 批跑必 skipTrace

**What**：`runL1Golden` 调用 `executeAsk` 时始终 `skipTrace: true`。

**Why**：批跑会生成大量 ask_traces 行；评测不需要落库；单测也不该依赖 PG trace。

**Related**：`ExecuteAskDeps.skipTrace` 定义于 `services/ask/execute.ts`；观测指标 `recordAskResult` 仍会走（可接受；若未来要静默可再开 `skipMetrics`，**非本窗**）。

---

## Convention: turbo 声明 L1_* env

**What**：凡测试/脚本可能读 `process.env.L1_*` 的 task，在 `turbo.json` 登记。

**Why**：未声明 → turbo `no-undeclared-env-vars` 失败，本地绿 CI 红。

---

## Don't

| 禁止 | 原因 |
|------|------|
| mock coverage 写进业务签字 / 宣称「L1 门禁 PASS」 | 产品红线；仅工程 seed |
| `L1_MAX_CASES` 截断 live 冒烟仍标 `signoffEligible=true` | 规模门；须两类各≥30 |
| 批跑省略 `skipTrace` | 污染 traces |
| CI 强制 live LLM 全量 | flaky / 成本；与本窗边界冲突 |
| 把 `false_premise` 算进 A 侧分母 | 覆盖率仅 `A/(A+B)`，分母只有 answerable |
| 在 route 内复制 2×2 逻辑 | 复用 `eval/l1-matrix` |
| 宣称 B10 业务完成 / 全文评测平台完成 | 本窗 = 工程底座 |

---

## 交叉引用

- 信任路径：[ask-pipeline](./ask-pipeline.md)（`executeAsk` / `GraphDeps`）  
- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- 目录：[directory-structure](./directory-structure.md)  
- Fixture 说明：`fixtures/l1/README.md` · 跑法：`apps/api/README.md`  
- IS：`docs/module-status/api.md` · backlog B10 挂账 `08-06-project-backlog`  
- 已做（工程）：`eval_runs` 表 + `persistEvalRun` / `L1_PERSIST_EVAL` · gold≥60 · OPS-1 `retrieve_mode`/`signoffEligible` · B10-RACI `fixtures/l1/RACI.md`  
- 未做：业务人签 · worker-eval · L2 准出 · L3 自动熔断；L2 题面 + runner + 可选 persist（≠ 准出）→ [l2-eval](./l2-eval.md)  
- ADR-046 快照：`runL1Golden` 写 `l1-gate-snapshot.json` 并挂 `gateSnapshot`/`gateVerdict`；默认不代签 → `signedPackage=false`；coverage=0 / 全 `internal_guard` → `businessPass=false`  
- 签字禁令：`signoffEligible=true` = `retrieve_mode=live` **且** 两类各≥30；**≠** 自动业务 PASS；coverage=0 / 全 `internal_guard`（无真实 Gateway）**禁止**当成绩单；人审仍禁「仅 env Gateway 绿灯」（见 live profile §4.5）  

