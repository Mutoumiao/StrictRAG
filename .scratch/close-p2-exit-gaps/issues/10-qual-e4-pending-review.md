# QUAL-E4：pending_review 人工处理

Type: task
Status: open
Blocked by: 04

## Question

剧本 E4 的剩余部分：「跨 doc 近重复：指标可见；`pending_review` 可人工处理」。前图 80 已做同库近重复默认 `skip_index` + 报告写冲突对；95 已落 `dedupe_cross_doc_rate`（分母 0 → NULL 不写 0）。

**本票在 [裁定 pending_review 落点 / 端点 / KB 策略位](./04-dec-pending-review.md) 落定后实现**：按决定落「落点 + 人工处理端点 + KB 策略位」。

约束：

- 不得与 `needs_ocr` / 审批闸混用语义（`pending_review` 是去重语义，不是扫描语义）。
- 未记录如实「未记录」，不得补 0 假装。
- 不改 ADR-053 策略语义；不发明「高度重复」阈值（数据 PRD 无定义）。
- 端点须走 `packages/contracts` 信封；admin 入口是否含在本票以 04 的决定为准。

补测：放行 / 驳回两条路径 + 非成员 / 无权限拒绝 + 与既有去重报告的数值自洽。

## Answer

<!-- 解析时写 -->
