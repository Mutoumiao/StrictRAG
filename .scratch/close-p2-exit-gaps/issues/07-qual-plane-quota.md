# QUAL-PLANE：三平面配额 R4–R10

Type: task
Status: open
Blocked by: 02

## Question

剧本 R4–R10「三平面配额」。前图 35 只落了 ask / ingest 分 store 固定窗口（默认 0 = 关）+ `plane` 指标 + `ask_quota_exhausted`；`maxEmbedCalls` / embed TPM / staging fail-closed 当时划出。

请逐条补齐 R4–R10 的 DoD（每条对应 PRD 剧本原文行，答案里写清出处）：

1. `maxEmbedCalls` 配置存在时**启动 warning** 且行为 ≡ 无该字段。
2. ask / ingest 配额**互不阻断**（已有能力，补回归钉住）。
3. mock embed 的 **TPM** 口径。
4. **ask 触顶不得 200 空答 `answered`**（按 PRD 原文走拒答或 429）。
5. 指标带 `plane=`。
6. staging 缺配额时 warning + **安全默认**。

约束：不得放宽既有 RPM 闸语义；不得把「进程内全局限流」当作生产方案（见 `docs/ops/rate-limit-and-metrics.md`）；不得把触顶路径写成假 `answered`。

## Answer

<!-- 解析时写 -->
