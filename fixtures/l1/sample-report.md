# L1 样例报告（工程 dogfood · 非签字）

> **mode: mock** — 以下数字仅演示报告格式。**禁止**当作业务签字 / 生产门禁。

| 字段 | 值 |
|------|-----|
| ranAt | 2026-08-09T00:00:00.000Z |
| caseCount | 5（样例截断；全量 seed ≥30） |
| mode | **mock** |
| errorCount | 0 |
| coverage | 0.5（A/(A+B)；分母 0 时为 null） |

## 2×2

|  | answered | abstained |
|--|----------|-----------|
| 可答 | A=1 | B=1 |
| 不可答 | C=1 | D=2 |

## cases（节选）

| id | type | outcome | cell |
|----|------|---------|------|
| l1-ans-001 | answerable | answered | A |
| l1-ans-002 | answerable | abstained | B |
| l1-una-001 | unanswerable | answered | C |
| l1-una-002 | unanswerable | abstained | D |
| l1-fp-001 | false_premise | abstained | D |

## 复现

```bash
# 默认 CI：矩阵单测 + mock graph 集成测
pnpm --filter @strict-rag/api test

# 手动全量 / 截断（需 L1_KB_ID；真 LLM 不进默认 CI）
L1_KB_ID=<kb-uuid> L1_MAX_CASES=5 pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
```
