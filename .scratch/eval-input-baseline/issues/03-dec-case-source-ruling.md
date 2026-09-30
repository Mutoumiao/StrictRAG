# 03 · 裁定：两条入口的题源以谁为准 / 差异要不要成为信号

Type: grilling
Status: open
Parent: ../map.md
Blocked by: 01

## Question

今天 api CLI 读文件 `fixtures/l1/gold.yaml`，worker 队列读 DB 表 `gold_questions`。裁定：

1. **权威题源**：DB 为准 / 文件为准 / 两者皆可但语义各自钉死？判据必须来自 `prds/08-quality`（黄金集 / 校准集 / 准出报告的定义）与仓库既有纪律，不许凭偏好。
2. **差异可检测**：若允许并存，「两侧题集不同」用什么承载（报告顶层字段 / 题集哈希 / signoff 快照），以及**检测不到时**（历史行、旧报告）的姿态。
3. **若裁成收敛到一处**：给出「文件 → DB」或「DB → 文件」的最小落点（归属包 + 入口名），并说明本图是否含该实现，或转入 `Not yet specified`。

**约束**：不许改 `fixtures/` 数据文件；不许改门限数字；不许把「题集不同」静默成「同」。
