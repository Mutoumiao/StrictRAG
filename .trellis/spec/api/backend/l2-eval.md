# api · L2 多轮题面 + 工程 runner（P2.5-L2 / P2.5-L2R / P2.5-L2P）

> 路径：`apps/api/src/eval/l2-gold.ts` · `apps/api/src/scripts/run-l2-golden.ts` · 仓根 `fixtures/l2/`  
> 产品语义：`prds/08-quality/02-evaluation-and-gates.md` §6.2 · 剧本 **J-P2.5**  
> 任务：`08-15-p25-l2-gold-min`（题面）· `08-16-p25-l2-runner-min`（runner）· `08-16-p25-l2-persist-min`（账本）  
> **本窗状态**：题面草案 + 纯函数加载 + **工程 runner** + **可选 persist** 已落地；**无** 准出、**无** 人签。  
> 图边 `session_load`/`rewrite` 已由 **P2.5-RW** 落地，**默认仍关**（dogfood 可开）。**runner / persist / 图边落地 ≠ L2 准出**。

---

## 双轨门禁

| 轨 | 含义 | 何时算「绿」 | **禁止**宣称 |
|----|------|--------------|--------------|
| **工程绿** | gold 形状/覆盖 + runner 注入测 | `l2-gold.test.ts` + `run-l2-golden.test.ts` 通过；9 类齐全；≥15 条 | 「L2 准出 PASS」 |
| **准出 PASS** | 产品/质量门禁（**非本窗**） | 真跑归档 + 零容忍=0 + RACI 人签 | 把草案条数 / mock 报告写成通过 |

**Wrong**：PR 全绿 → 路线图勾「L2 已过」或把仓库默认改为 `SESSION_REWRITE_ENABLED=true`。  
**Correct**：PR 工程绿 = 题面可版本化 + CLI 可注入跑；图边可 dogfood；准出另开人签 + 语料入库。

---

## 1. Scope / Trigger

- Trigger：改 L2 gold 形状、类型枚举、加载不变量、fixtures/l2 文档、批跑 CLI。
- 目标：可版本化的多轮剧本账本 + 纯校验 + 可注入的串行 runner + 可选 `eval_runs` persist。
- **非目标**：把 persist 当准出、算出 `signoffEligible=true`、ADR-046、主题 LLM judge、把 rewrite **默认**打开、宣称准出。

---

## 2. Signatures

| 符号 | 位置 | 说明 |
|------|------|------|
| `L2_TYPES` | `eval/l2-gold.ts` | 9 类只读元组 |
| `loadL2Gold(path)` | 同上 | 读 JSON 形 gold；失败抛 `L2GoldLoadError` |
| `l2TypeCoverage(cases)` | 同上 | `{ present, missing }`；测钉 `missing=[]` |
| `defaultL2GoldPath()` | 同上 | `<repo>/fixtures/l2/gold.yaml` |
| `nextSessionId` / `acceptHit` / `historyLeaked` | `scripts/run-l2-golden.ts` | 分配 / 末轮机械分 |
| `runL2Golden(opts)` | 同上 | 串行批跑 + 进程内窗；可注入 `execute`；`persistEval?` |
| `buildL2EvalRunInsert` | 同上 | 纯映射：`runType=session_multiturn` · `signoffEligible='0'` · `matrix*=0` · `coverage=null` |
| `persistL2EvalRun` | 同上 | insert `eval_runs`；**禁止**调用 L1 `persistEvalRun`（会写死 `golden_2x2`） |
| `writeL2Report` | 同上 | `artifacts/l2-last-run.json` + `.md` |
| `parseL2CliEnv` | 同上 | `L2_KB_ID` 缺 / 非法 `L2_MAX_CASES` → exit 2 |

批跑 **必须** `skipTrace: true`；窗用 `clipSessionWindow` 注入 `loadSessionWindow`，**不**读 `ask_traces`。  
**禁止**把加载器塞进 `run-l1-golden.ts`；**禁止**把 runner / persist 当准出。

`persistEval === true` 或（未显式 false 且 `L2_PERSIST_EVAL` 为 `1`/`true`）才写库；默认关。写完文件报告后再 persist；失败上抛（CLI exit 1）。`signoffEligible` **字面量 false**（含 live）。

---

## 3. Contracts

### Gold 根对象（`fixtures/l2/gold.yaml`）

扩展名 `.yaml`，内容合法 JSON；**零 yaml 依赖**。

| 字段 | 约束 |
|------|------|
| `version` | 必须 `1` |
| `run_type` | 必须 `session_multiturn`（禁 `golden_2x2`） |
| `signoffEligible` | 必须 `false` |
| `cases` | 非空数组；本窗 seed **≥15** |

### Case / Turn 不变量（加载器强制）

| 条件 | 规则 |
|------|------|
| `id` | `/^l2-[a-z0-9-]+$/`；文件内唯一 |
| `type` | 九类之一 |
| `turns` | ≥1；每轮 `role=user`、`text` 非空、`session∈same\|new\|none` |
| `type≠no_session` | `turns.length≥2` |
| `type=no_session` | 每轮 `session=none`；`expected.rewriteUsed=false` |
| `type=session_isolation` | 至少一轮 `session=new` |
| `expected.historyInEvidence` | 必须 `false`（历史 ≠ evidence） |

`jScenario` 可选：`J1` / `J2` / `J2x` / `J3` / `J4` / `J5` / `J6` / `J8`。  
本窗 seed 至少覆盖 **J2 / J2x / J3 / J4 / J5 / J6 / J8**。

### 零容忍

主题粘连胡答 · 历史进 evidence/`min_support` · 冲突跟错聊天数字 · 合法路径跳过 verify。  
runner **只机械钉**「先前用户轮全文不得出现在末轮 `evidence_snapshot[].text`」；`themePersist` **不**自动判。

---

## 4. Validation

| 条件 | 行为 |
|------|------|
| 文件不可读 / 非 JSON | `L2GoldLoadError` |
| 错 `run_type` / `signoffEligible≠false` | `L2GoldLoadError` |
| 缺 type / 空 turns / 重复 id | `L2GoldLoadError` |
| `no_session` 却 `session=same` | `L2GoldLoadError` |

CLI 退出码：`0` 写出报告（含 fail/error 题）；`2` 缺 `L2_KB_ID` / 非法 `L2_MAX_CASES` / gold 加载失败；`1` 意外（含 persist 失败）。  
报告 `signoffEligible` **字面量 false**（含 `retrieve_mode=live`）。可选 `evalRunId`（persist 后回填）。**禁止** `businessPass` / `signedPackage` / 把 persist 当准出。

---

## 5. Tests Required

| 层 | 文件 | 断言点 |
|----|------|--------|
| 加载 | `eval/l2-gold.test.ts` | 非法 JSON / 错 run_type / 重复 id / no_session+same / 缺 type |
| 覆盖 | 同上 | 真实 gold `cases.length≥15` 且 `missing=[]` |
| runner | `scripts/run-l2-golden.test.ts` | same/new/none 分配；跨 case 不串窗；泄漏 fail；accept 命中 pass；rewrite 关 + expected true → fail；真 gold+注入 `caseCount≥15` 且 `signoffEligible===false`；execute throw → error |
| persist | 同上 | mapper：`runType=session_multiturn` / `'0'` / matrix 0 / coverage null / ranAt 非 ISO-Z；`persistEval: false` 不碰 DB；开闸用 persist mock，不连真 PG |

---

## Don't

| 禁止 | 原因 |
|------|------|
| mock / 未跑数字进签字或准出页 | 双轨；sample-report 必须 `n/a（模板）` |
| 未准出把默认改为 `SESSION_REWRITE_ENABLED=true` | 图边 ≠ 准出；phase-scaffold 禁止默认 true |
| 把 runner / persist 当 L2 准出 / 算出 `signoffEligible=true` | 本窗 signoffEligible 字面量 false；有账本 ≠ 准出 |
| 调用 L1 `persistEvalRun` 吞 L2 报告 | 会写死 `golden_2x2` + 伪造 matrix |
| ADR-046 / 主题 judge | 对齐 L1 也曾拆 follow-up |
| 把 L2 case 塞进 `fixtures/l1/gold.yaml` | 账本必须分列 |
| 宣称 L2 准出 / 全文 P2 / 生产 ES / 连续追问已开 | 本窗 = 题面 + 工程 runner + 可选 persist |

---

## 交叉引用

- L1 对照（只学 JSON.parse 纪律）：[l1-eval](./l1-eval.md)  
- Ask 图 / rewrite 默认关：[ask-pipeline](./ask-pipeline.md)  
- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- Fixture：`fixtures/l2/README.md` · `RACI.md` · `sample-report.md`  
- IS：`docs/module-status/api.md` · 调度 `08-06` **P2.5-L2=部分** · **P2.5-L2R=部分** · **P2.5-L2P=部分** · **P2.5-RW=部分** · **P2.5-IDX 仍索引**
