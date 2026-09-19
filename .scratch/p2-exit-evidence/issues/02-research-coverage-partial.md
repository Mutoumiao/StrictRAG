# 覆盖表 P2 必签「部分测 / 未测」余量盘点

Type: research
Status: resolved
Blocked by: —

## Question

`docs/testing/coverage.md` 中属于 **P2 必签**范围的剧本步骤，今天仍标「部分测 / 未测」的共多少行？每行缺哪条断言、落点在哪、能否离线补？

## Answer

产出：[`research/coverage-partial-tests.md`](../research/coverage-partial-tests.md)（逐剧本表 + 四批建议）。

**P2 必签余量共 94 行，全部是「部分测」，未测 0 行**（按分册「阶段」列的 P2 标注统计；另有 7 行边界行单列）。其中 **可离线补齐 71 行**，**不可离线 23 行**。

23 行不可离线的三类原因：真 ES / 真双节点 / 真进程（6 行）· 人签与 live 真跑（1 行）· **源码与 Then 不一致或源码无落点（16 行）**——后者不是补测能解决的，要先改源码或回 PRD 裁口径。

另外两个必须记下的发现：

1. **覆盖表本身已过期**：至少 11 行仍标「部分测 / 缺实现」，但今天已有可指认测例（E4 · E5 · L7 · V3 · O4 · R10 · AA1 · AB8 · AC7 · V4 · Q4）。
2. **覆盖表汇总数与行级标注自相矛盾**：ask 汇总 24/26 vs 行级 25/25；ingest 汇总 33 vs 分册 31；acl 汇总 37 vs 行级 39；ops 的 AD / G 子表未更新。**盘点一律以行级标注为准。**

建议批次（已按依赖与价值排序，详见研究文件末节）：

| 批 | 内容 | 行数 | 预计 `it` 数 |
|:--:|------|:----:|:------------:|
| 1 | 信任环收口（ask 图 / 会话 / 建库） | 11 | 12–13 |
| 2 | 入库闸与双就绪（worker 为主） | 19 | ~20 |
| 3 | 鉴权矩阵与运营壳（api / admin / admin-catalog） | 38 | ~40 |
| 4 | 覆盖表回写、边界护栏与阻塞登记 | 11 + 3 + 23 | 3–4 |

落为工单：[07](./07-tests-batch-1-trust-loop.md) · [08](./08-tests-batch-2-ingest-gates.md) · [09](./09-tests-batch-3-authz-ops.md) · [10](./10-tests-batch-4-guards-and-register.md) · 覆盖表回写见 [06](./06-coverage-table-writeback.md)。
