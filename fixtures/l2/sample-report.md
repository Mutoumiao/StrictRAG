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
| historyInEvidence（先前用户轮全文） | n/a（模板） |
| themePersist | 只回显期望；**不**自动判 |

## 零容忍核对

| 项 | 本跑 |
|----|------|
| 主题粘连胡答 | n/a（模板 · 不自动判） |
| 历史文本进 evidence / min_support | n/a（模板） |
| 冲突场景跟错聊天数字 | n/a（模板 · 不自动判） |
| 合法路径跳过 verify | n/a（模板 · 不自动判） |

## 复现

```bash
# 形状 / 覆盖
pnpm --filter @strict-rag/api test -- src/eval/l2-gold.test.ts
# 工程 runner（注入测；CI 不跑 live LLM）
pnpm --filter @strict-rag/api test -- src/scripts/run-l2-golden.test.ts
# 本地批跑（需 L2_KB_ID；写出 artifacts/l2-last-run.*；≠ 准出）
L2_KB_ID=<kb-uuid> pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
# 可选落库（仍 ≠ 准出；signoffEligible 仍 false）
L2_KB_ID=<kb-uuid> L2_PERSIST_EVAL=1 pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
```

真跑数字与人签属后续 P2.5 task，**不**在本目录伪造。
