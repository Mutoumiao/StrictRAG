# L2 样例报告（模板 · 未跑）

> **本文件不是一次真实批跑。** 所有结果格均为 `n/a（未跑）`。  
> **禁止**填入 mock / 臆造 live 数字后当准出附件。  
> 本窗无 runner；`signoffEligible` 在 gold 根对象上硬为 `false`。

| 字段 | 值 |
|------|-----|
| ranAt | n/a（未跑） |
| run_type | `session_multiturn` |
| caseCount | n/a（未跑） |
| retrieve_mode | n/a（未跑） |
| signoffEligible | `false`（草案硬约束；未跑不得改 true） |
| errorCount | n/a（未跑） |
| 近指代主题正确率 | n/a（未跑） |
| 零容忍项 | n/a（未跑） |

## 题型覆盖（账本有 · 结果无）

| type | gold 条数 | 通过 | 失败 |
|------|----------:|------|------|
| near_coref | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| weak_coref | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| explicit_backref | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| topic_switch | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| kb_conflict | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| adversarial | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| no_session | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| budget | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |
| session_isolation | 见 `gold.yaml` | n/a（未跑） | n/a（未跑） |

## 零容忍核对

| 项 | 本跑 |
|----|------|
| 主题粘连胡答 | n/a（未跑） |
| 历史文本进 evidence / min_support | n/a（未跑） |
| 冲突场景跟错聊天数字 | n/a（未跑） |
| 合法路径跳过 verify | n/a（未跑） |

## 复现

```bash
# 本窗只跑形状 / 覆盖测；没有 L2 CLI
pnpm --filter @strict-rag/api test -- src/eval/l2-gold.test.ts
```

真跑与归档属后续 P2.5 task，**不**在本目录伪造。
