# B13 · 反馈运营 SLA

**目标**：用户提交的 open 反馈在 **1 个工作日**内由运营处理（关闭 / 关联文档 / 入 reindex / 晋升黄金集）。

| 项 | 说明 |
|----|------|
| 入口 | web 问答结果「有帮助 / 无帮助」→ `POST /ask/:requestId/feedback` |
| 队列 | admin `/feedback` · 码 `feedback.queue`；无码 403 |
| 处理 | PATCH 状态：`dismissed` / `linked_doc` / `queued_reindex` / `promoted_to_gold`（晋升须 `goldType`，写入运营 `gold_questions`；**不**写 `fixtures/l1/gold.yaml`、**不**自动入队评测） |
| SLA | 工作日 1 天；超期在队列中仍可见（不自动丢弃） |
| Owner | mutou（运营） |

**非目标**：自动评分算法、改 ask 图主路径。
