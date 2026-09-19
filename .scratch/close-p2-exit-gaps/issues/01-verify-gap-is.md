# 核定 §2.5.2 各 ID 在 HEAD 的真实缺口

Type: research
Status: open

## Question

总 backlog §2.5.2 登记于 2026-08-24，其后 `fill-must-haves` 又收口了 29 / 35 / 80 / 85 / 86 / 88 / 95 / 101 / 104 / 105 / 106 等工单，[`coverage-gap-impl.md`](../../.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md) 的「源码缺口（IS）」列可能已滞后。

请在当前 HEAD 上逐 ID 复核以下十一项的真实状态，每项给出三件东西：

1. **判定**（四选一）：**真未做** / **部分已做**（做到哪一步，剩余差什么） / **已做待测**（源码满足该剧本 Then，但无对应测例） / **已被前图收口**（指明收口工单号）。
2. **依据的文件行**：`路径:行号`，以及现行测例路径（若有）。
3. **建议**：**可直接开工** / **需先出决定** / **应划出范围**，各一句理由。

复核对象：

| ID | 剧本步骤的 Then |
|----|-----------------|
| QUAL-K5 | 非 kb_member 的 platform_admin 读 Langfuse / 审计 → 无该 KB evidence 明文 |
| QUAL-E4 | 跨 doc 近重复：指标可见；`pending_review` 可人工处理 |
| QUAL-E5 | L1 contextualize 故障 → L0 回退仍 ready |
| QUAL-L7 | 孤儿清理 job：清半写非激活 version，不碰当前激活版 |
| QUAL-AA1 | KB 策略参数可保存 + 审计；旧文档 chunk 边界 / version 不变 |
| QUAL-ACL-CAP | 显式 `allowedDocIds` 且 `len > 5000` → `acl_filter_too_large`；不截断、无假 answered |
| QUAL-TENANT-Q | 无 `tenantId` 的 query / bulk builder 必须失败（共享与独立索引皆然） |
| QUAL-PLANE | 三平面配额 R4–R10（`maxEmbedCalls` warning 且行为 ≡ 无字段 · ask/ingest 互不阻断 · mock embed TPM · ask 触顶不得 200 空答 answered · 指标 `plane=` · staging 缺配额 warning + 安全默认） |
| QUAL-G3 | 提名黄金集须测试 / 产品审核后才进 `gold.yaml` |
| QUAL-AB8 | 分片策略「设置」打开 ADR-053 弹窗；保存服 AA 语义 |
| QUAL-AC7 | KB 尝试绑 `judge` → 400 / 403；judge 仅平台级 |

另核定**三条前置**的当前状态（是仍缺、还是已具备）：

- 文档「**当前激活 version**」表示：`documents.index_version` 的写入时机与语义；孤儿清理（L7）与文档 ACL 收紧自动 reindex 两处依赖它，是否仍不可断言。
- `pending_review`：落点 / 人工端点 / KB 策略位三处是否仍未冻。
- 签字包：`gatePackageId` / `effectiveAt` 的唯一生产者（`defaultQuality()`）是否仍写死 `null`。

## Answer

<!-- 解析时写：一 ID 一节的判定 + 文件行 + 建议；产出 research/gap-is.md -->
