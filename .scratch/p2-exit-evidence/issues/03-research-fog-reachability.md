# 上一图「雾中项」的可达性核定

Type: research
Status: resolved
Blocked by: —

## Question

前图 Not yet specified 的 10 项里，哪些今天已有可下手的具体对象，且不依赖外部基础设施与人签？

## Answer

产出：[`research/fog-reachability.md`](../research/fog-reachability.md)（逐项表 + 4 张可做项的展开）。

**今天可做 4 项 · 需先补 PRD 或 ADR 3 项 · 被外部依赖阻塞 1 项 · 无对象 2 项。**

| 项 | 结论 | 依据要点 |
|----|------|----------|
| `pending_review` interim 可配置性 | 需先补 PRD | PRD §5.1 只写「KB 策略」未给键名，补键名 = 补冻结行（须 ADR → 改 PRD → 升版本） |
| embed TPM（R6-b） | 需先补 PRD | 「触顶」无计数口径；ADR-044 明写演进须新 ADR |
| 真 Langfuse 读取面 | 被外部阻塞 | 只有 mock 且无读取入口，需真 SDK / 密钥 |
| `downrank` | 需先补 PRD | 降权字段与权重口径未冻，检索层无降权位 |
| `pending_review` admin 审阅面 | **今天可做** | 端点 + DTO（带 `heldChunkId`）已齐，缺的只是 admin 一个二选一控件；RTL 可离线验收 |
| admin 站规清扫 | 今天可做（**仅行为级**） | `ClosedSelect` 已同页混用；但**视觉回归不可验**（仓内无 playwright / 视觉 diff） |
| `drizzle/meta` 基线 | **今天可做** | 硬指标可断言（仓外副本生成后 `drizzle-kit generate` 打印 `No schema changes`）；缺口已从 19 份增至 **21 份**（`0001`–`0021`） |
| 覆盖表部分测余量 | **今天可做** | 见工单 [02](./02-research-coverage-partial.md) |
| `allowedDocIds` 收紧 | 无对象 | 无生产者；放开成员写面要改 PRD |
| worker metrics 出口 | 无对象 | 功能表把 worker 对外 HTTP 列为禁止项，正解已裁定走入库报告 |

附带更正：`research-drizzle-meta-baseline.md` 的机制结论今天仍成立，但编号过期——基线快照应命名 **`0021_snapshot.json`**。另发现口径不一致需一并纠正：`.trellis/spec/db/backend/database-guidelines.md:193` 写「19 份」，`docs/module-status/db.md:52` 写「21 份」。

本图采纳其中与「可核对」直接相关的两项：`drizzle/meta` 基线 → 工单 [11](./11-drizzle-meta-baseline.md)；覆盖表余量 → 工单 [06](./06-coverage-table-writeback.md) / [07](./07-tests-batch-1-trust-loop.md) 等。admin 审阅面与站规清扫留在雾里（前者不构成镜像漂移，后者被浏览器阻塞）。
