# L2 样例报告（模板 · 非本仓真跑）

> **本文件不是一次真实批跑。** 所有结果格均为 `n/a（模板）`。  
> **禁止**填入 mock / 臆造 live 数字后当准出附件。  
> 工程 runner 已有（`scripts/run-l2-golden.ts`）；`signoffEligible` 在报告上硬为 `false`。  
> 可选 `L2_PERSIST_EVAL` 写 `eval_runs`；**有账本 ≠ 准出**。

| 字段 | 值 |
|------|-----|
| ranAt | n/a（模板） |
| kbId | n/a（模板） |
| run_type | `session_multiturn` |
| retrieve_mode | n/a（模板） |
| mode | n/a（模板） |
| rewriteEnabled | n/a（模板） |
| signoffEligible | `false`（字面量；live retrieve 也不得改 true） |
| evalRunId | n/a（模板；`L2_PERSIST_EVAL` 开时才有） |
| caseCount | n/a（模板） |
| passCount | n/a（模板） |
| failCount | n/a（模板） |
| errorCount | n/a（模板） |
| zeroToleranceHits | n/a（模板） |
| nearCorefPassRate | n/a（模板；分母 `nearCorefPassDen` = `near_coref` 题数，含 `error`） |
| docHitRate | n/a（模板）—— **未映射时恒 0，不得当成绩**（逻辑 id ≠ KB uuid；**不进** `signoffEligible`） |
| docHitHits | n/a（模板） |
| docHitScored | n/a（模板；分母 = 有非空 `expectedDocIds` 的题数） |
| citationComplete | n/a（模板 · 只记率、不进判定） |
| citationCompleteDen | n/a（模板；分母 = `knowledge ∧ answered` 题数） |

## 题型覆盖（账本有 · 结果无）

| type | gold 条数 | 通过 | 失败 |
|------|----------:|------|------|
| near_coref | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| weak_coref | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| explicit_backref | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| topic_switch | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| kb_conflict | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| adversarial | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| no_session | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| budget | 见 `gold.yaml` | n/a（模板） | n/a（模板） |
| session_isolation | 见 `gold.yaml` | n/a（模板） | n/a（模板） |

## 末轮机械判定（模板）

| 项 | 本跑 |
|----|------|
| accept（status/reason ∈ expected.accept） | n/a（模板） |
| rewriteUsed 对齐 | n/a（模板） |
| historyInEvidence（先前用户轮全文；判的是「语料撞词」这一种） | n/a（模板） |
| docHit（命中期望文档） | n/a（模板；**未映射时恒 false → 率恒 0，不得当成绩**） |
| citationOk（合法 citation 三态） | n/a（模板；`null` = 不适用或未下发，`false` 不进 `failReasons`） |
| themePersist | 只回显期望；**不**自动判 |

## 零容忍处置档位（`zeroToleranceCoverage`）

| item | judged | place | judged | hits |
|------|--------|-------|--------|------|
| topicStickiness | `debt` | topicStickiness | `debt` | n/a（模板） |
| historyText | `debt`（半判半债） | historyInEvidence | **`mechanical`** | n/a（模板） |
| historyText | `debt`（半判半债） | historyInMinSupport | `debt` | n/a（模板） |
| kbConflictNumber | `debt` | kbConflictNumber | `debt` | n/a（模板） |
| skipVerify | `debt` | skipVerify | `debt` | n/a（模板） |

口径必须写全：PRD §6.2 的**四项零容忍 → 五处去处 = 1 处机械判 + 4 处记债**；四个 PRD 项在**整项层面全部记为 `debt`**（`historyText` 半判半债；把它写成整项 `mechanical` 会把 `min_support` 那半句债藏起来）。`mechanical` 才带 `hits`，`debt` 恒 `null`。**记债 ≠ 放行；机械判一处 ≠ 该项已覆盖。**

## 可复现（PRD §8）

| 字段 | 值 |
|------|-----|
| l2GoldSetHash | n/a（模板；= 本跑**实际使用**的题面 id 集合：trim → 去空 → 升序 → sha256，口径同 L1 剧本集哈希；截断即另一个题面集） |
| sessionStrategyVersion | —（**全仓无版本载体** → 恒 `null`，记债；**禁止**拿源码文本哈希顶替） |
| rewritePromptVersion | —（同上：`rewriteSystemPrompt()` 是内联字符串，源码即版本） |

## 复现

```bash
# 形状 / 覆盖
pnpm --filter @strict-rag/api test -- tests/eval/l2-gold.test.ts
# 工程 runner（注入测；CI 不跑 live LLM）
pnpm --filter @strict-rag/api test -- tests/eval/l2-cli.test.ts
# 报告可判定面（采集面 / 零容忍处置档位 / §8 可复现区块）
pnpm --filter @strict-rag/api test -- tests/eval/l2-evidence-collection.test.ts tests/eval/l2-zero-tolerance-coverage.test.ts tests/eval/l2-repro-fields.test.ts
# 本地批跑（需 L2_KB_ID；写出 artifacts/l2-last-run.*；≠ 准出）
L2_KB_ID=<kb-uuid> pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
# 可选落库（仍 ≠ 准出；signoffEligible 仍 false）
L2_KB_ID=<kb-uuid> L2_PERSIST_EVAL=1 pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
```

真跑数字与人签属后续 P2.5 task，**不**在本目录伪造。
