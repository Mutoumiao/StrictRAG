# api · L2 多轮题面（P2.5-L2 工程草案）

> 路径：`apps/api/src/eval/l2-gold.ts` · 仓根 `fixtures/l2/`  
> 产品语义：`prds/08-quality/02-evaluation-and-gates.md` §6.2 · 剧本 **J-P2.5**  
> 任务：`08-15-p25-l2-gold-min`  
> **本窗状态**：题面草案 + 纯函数加载 **已落地**；**无** runner、**无** 准出、**rewrite 仍关**。

---

## 双轨门禁

| 轨 | 含义 | 何时算「绿」 | **禁止**宣称 |
|----|------|--------------|--------------|
| **工程绿** | gold 可 `JSON.parse` + 形状/覆盖 vitest | `l2-gold.test.ts` 通过；9 类齐全；≥15 条 | 「L2 准出 PASS」 |
| **准出 PASS** | 产品/质量门禁（**非本窗**） | 真跑归档 + 零容忍=0 + RACI 人签 | 把草案条数 / 未跑模板写成通过 |

**Wrong**：PR 全绿 → 路线图勾「L2 已过」或打开 `SESSION_REWRITE_ENABLED`。  
**Correct**：PR 工程绿 = 题面可版本化；准出另开 P2.5 runner + 人签。

---

## 1. Scope / Trigger

- Trigger：改 L2 gold 形状、类型枚举、加载不变量、fixtures/l2 文档。
- 目标：可版本化的多轮剧本账本 + 纯校验。
- **非目标**：`run-l2-golden.ts`、`executeAsk`、`eval_runs`、rewrite 节点、开 `SESSION_REWRITE_ENABLED`。

---

## 2. Signatures

| 符号 | 位置 | 说明 |
|------|------|------|
| `L2_TYPES` | `eval/l2-gold.ts` | 9 类只读元组 |
| `loadL2Gold(path)` | 同上 | 读 JSON 形 gold；失败抛 `L2GoldLoadError` |
| `l2TypeCoverage(cases)` | 同上 | `{ present, missing }`；测钉 `missing=[]` |
| `defaultL2GoldPath()` | 同上 | `<repo>/fixtures/l2/gold.yaml` |

**禁止**把加载器塞进 `run-l1-golden.ts` 或调用 ask 图。

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

### 零容忍（写入 gold / README；本窗不跑）

主题粘连胡答 · 历史进 evidence/`min_support` · 冲突跟错聊天数字 · 合法路径跳过 verify。

---

## 4. Validation

| 条件 | 行为 |
|------|------|
| 文件不可读 / 非 JSON | `L2GoldLoadError` |
| 错 `run_type` / `signoffEligible≠false` | `L2GoldLoadError` |
| 缺 type / 空 turns / 重复 id | `L2GoldLoadError` |
| `no_session` 却 `session=same` | `L2GoldLoadError` |

进程内 **无** CLI 退出码（无 runner）。

---

## 5. Tests Required

| 层 | 文件 | 断言点 |
|----|------|--------|
| 加载 | `eval/l2-gold.test.ts` | 非法 JSON / 错 run_type / 重复 id / no_session+same / 缺 type |
| 覆盖 | 同上 | 真实 gold `cases.length≥15` 且 `missing=[]` |

---

## Don't

| 禁止 | 原因 |
|------|------|
| mock / 未跑数字进签字或准出页 | 双轨；sample-report 必须 `n/a（未跑）` |
| 未准出开 `SESSION_REWRITE_ENABLED` | P2 启动闸；phase-scaffold 禁止 |
| 本窗写 L2 CLI 调 `executeAsk` | rewrite 未实现；易被误读为准出 |
| 把 L2 case 塞进 `fixtures/l1/gold.yaml` | 账本必须分列 |
| 宣称 L2 准出 / 全文 P2 / 生产 ES | 本窗 = 题面草案 |

---

## 交叉引用

- L1 对照（只学 JSON.parse 纪律）：[l1-eval](./l1-eval.md)  
- Ask 图 / rewrite 禁开：[ask-pipeline](./ask-pipeline.md)  
- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- Fixture：`fixtures/l2/README.md` · `RACI.md` · `sample-report.md`  
- IS：`docs/module-status/api.md` · 调度 `08-06` **P2.5-L2=部分** · **P2.5-IDX 仍索引**
