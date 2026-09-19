# 核定 embed TPM（R6）的口径

Type: research
Status: open
Blocked by: 02

## Question

剧本 R4–R10 中的 R6「mock embed TPM」在 HEAD 上**真未做**（全仓源码 0 命中），且前图 35 当时把它划出。核查提示「口径未定」，所以先研究再实现。

请给出：

1. **PRD 原文行**：R6 在 `prds/10-delivery/03-acceptance-scenarios.md` 的原文，以及 `prds/07-models` / `prds/06-async` / `prds/08-quality` 中关于 **embed TPM（tokens per minute）** 的冻结语义行（若只有一处，如实说明）。
2. **口径**：TPM 是「按调用次数折算」还是「按真实 token 数」？mock embed（`INGEST_EMBED_MODE=mock`）**没有真实 token 消耗**，此时 TPM 该按什么计数——按文本长度估算、按固定权重、还是不计数只留结构？给出 PRD 依据；**若 PRD 未定义，明说未定义**，并给出「最小且不发明语义」的落法建议。
3. **与既有平面配额的关系**：现有 ask / ingest 固定窗口（`apps/api/src/services/rate-limit.ts:21-25`）与 `plane` 指标（`apps/api/src/obs/metrics.ts:58-67`）的现状，R6 是否复用它。
4. **建议**：`可直接开工`（给出最小断言形状）/ `需先出决定`（指出必须由人裁的那一点）/ `应划出范围`。

产出写到 `research/embed-tpm.md`，并在票内 Answer 给出结论摘要。

## Answer

<!-- 解析时写 -->
