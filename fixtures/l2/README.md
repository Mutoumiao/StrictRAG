# L2 多轮题面（工程草案）

> **草案 ≠ 准出。** 本目录只有可版本化的剧本与形状校验。  
> **没有** runner、**没有** `eval_runs` 落库、**没有** live 数字。  
> **禁止**把「已有 gold」写成 L2 通过、可默认开 rewrite、或可宣传连续追问。

## 文件

| 路径 | 说明 |
|------|------|
| `gold.yaml` | ≥15 条 SSOT；扩展名 `.yaml`，**内容为 JSON**（`JSON.parse`，零 yaml 依赖） |
| `RACI.md` | 业务/测试 owner 占位；**不挡**本窗工程关单 |
| `sample-report.md` | 报告模板；数字处为 `n/a（未跑）` |
| `corpus/` | 差旅住宿 / 餐补 / 请假三篇短制度；**本窗不入库** |

根对象约束：`version=1` · `run_type=session_multiturn` · `signoffEligible=false`。  
加载器：`apps/api/src/eval/l2-gold.ts`。HOW：`.trellis/spec/api/backend/l2-eval.md`。

## 逻辑 id 映射

真跑前须把 gold 中的逻辑 id **映射**为当前 KB 的 `documents.id`（uuid）。与 L1 相同纪律。

| 逻辑 id | 对应文件 |
|---------|----------|
| `ingest-samples/01-doc` … `10-doc` | `fixtures/ingest-samples/01-doc.txt` … `10-doc.txt` |
| `l2-corpus/travel-stay` | `fixtures/l2/corpus/travel-stay.txt` |
| `l2-corpus/meal-allowance` | `fixtures/l2/corpus/meal-allowance.txt` |
| `l2-corpus/leave-policy` | `fixtures/l2/corpus/leave-policy.txt` |

`corpus/` 正文**尚未**走 worker 入库。未映射 / 未入库时不得拿检索命中率当成绩。

## 题型（§6.2 八类 + 隔离）

| type | 最少 | 对齐剧本 |
|------|-----:|----------|
| `near_coref` | 1 | J2（近指代） |
| `weak_coref` | 1 | J6 |
| `explicit_backref` | 1 | 显式回溯 |
| `topic_switch` | 1 | J3 |
| `kb_conflict` | 1 | J4 |
| `adversarial` | 1 | J5 |
| `no_session` | 1 | J8（每轮 `session=none`，`rewriteUsed=false`） |
| `budget` | 1 | 连续追问不炸预算 |
| `session_isolation` | 1 | J2x（至少一轮 `session=new`） |

签字目标规模（**非本窗**）建议 30～50 + 真跑归档，见 P2.5 出口。

## 零容忍（写入账本；本窗不判定通过）

任一即未来 L2 失败：

- 主题粘连胡答
- 历史文本进 evidence / `min_support`
- 冲突场景跟错聊天数字
- 合法路径跳过 verify

## 本窗不做

- `run-l2-golden.ts` / 调用 `executeAsk`
- 写 `eval_runs`
- 打开 `SESSION_REWRITE_ENABLED`
- 宣称 L2 准出 / 全文 P2 / 生产 ES
