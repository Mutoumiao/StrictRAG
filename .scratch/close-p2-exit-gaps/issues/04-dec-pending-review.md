# 裁定 pending_review 落点 / 端点 / KB 策略位

Type: grilling
Status: open
Blocked by: 02

## Question

剧本 E4 要求「跨 doc 近重复：指标可见；`pending_review` 可人工处理」。前图 80 只做了「同库近重复默认 `skip_index` + 报告写冲突对」，95 落了 `dedupe_cross_doc_rate` 指标；`pending_review` 当时以「落点 / 端点 / KB 策略位三处未冻」划出。

请裁定三处，各自给出**可直接编码**的结论：

1. **落点**：被判为跨文档近重复的 chunk 存在哪里、状态字段叫什么、粒度是文档级还是 chunk 级；与既有 `documents.status` / `lifecycle` 的关系（不得混用 `needs_ocr` / 审批闸语义）。
2. **人工处理端点**：谁（权限码）在哪个资源上放行或驳回；请求 / 响应形状（须走 `packages/contracts` 的 `ApiResponse` 信封与既有错误码体系）；admin 侧入口是否本图包含。
3. **KB 策略位**：是否进 `config_json`、默认值、「未写跟 env」口径；开启后默认行为是 `skip_index` 还是 `pending_review`。

另须说明：**未记录与已记录的空值**如何区分（沿用 95 的「分母 0 → NULL 不写 0」口径），以及本图**不做**的部分（例如自动 LSH、人工阈值发明）。

## Answer

<!-- 解析时写 -->
