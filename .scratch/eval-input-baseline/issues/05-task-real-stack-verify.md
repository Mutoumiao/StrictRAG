# 05 · 真栈真跑：对账与题源信号在真 PG 上的实测

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 04

## Question

在本机 compose 真栈上取证：账本指向不存在 / 不可检索 / title 不符的文档时是否响亮失败；正向是否与今天逐位一致；题源信号能否读出。

## Answer

取证正文：[`research/05-real-stack-reconcile.md`](../research/05-real-stack-reconcile.md)（专职取证代理执行，关键声明由主控用 `psql` 独立复核）。已汇总进 [`docs/ops/real-stack-evidence.md`](../../../docs/ops/real-stack-evidence.md) §9。

**环境**：compose 五服务（PG 14?/Redis/ES 8.15.3/Mongo/RustFS），复用前图命名卷 —— KB `01a0eda2-6781-7ca3-90e8-17dcd7ba68c2` 的 13 篇文档全 `ready ∧ active`，账本 13 条，`gold_questions` 60 行。operable env 走**进程级注入**，**未改**仓根 `.env`。

| 场景 | 实测 | 退出码 |
|---|---|---|
| **P 正向**（真账本） | 跑通出报告：`hitAtK=1`（30/30）· `docMapSource=ledger` · `docMapResolved=10` · `goldSource='file'` · `goldSetMatchesRepoFile=true` | 0 |
| **N1 `missing`** | 改一条 `docId`（不动 logicalId / sha256）→ 拒跑，逐字点名 `ingest-samples/01-doc→0000…00ff missing`；两份坏账本仍被 `parseCorpusLedger` 接受 → 证明报错来自**对账**而非指纹档 | 2 |
| **N2 `not_retrievable`**（本图核心） | 库内某篇临时 `lifecycle='superseded'` → 拒跑，消息带实测 `status=ready lifecycle=superseded`；再以 `status='failed'` 做等价一档 → 同样拒跑；两档**均已还原**并用 `select` 证明 13/13 `ready ∧ active` | 2 |
| **N3 `title_mismatch`** | 账本某条 `title` 改一字符 → 拒跑，消息带实测 `title=01-doc` | 2 |
| **N4 题源不匹配** | `L1_GOLD_PATH` 指改过一个 `id` 的副本 → **仍出报告**（信号非闸）：`goldSource='file'` 不变、`goldSetMatchesRepoFile=false` | 0 |
| **M 队列侧** | worker 的 `L1_DOC_MAP` 指向坏账本入队 → job `failed`，`error_message` 是**对账**那条（主控复核：`eval_runs.id=01a0f32b-0a10-7a4a-a37d-f2a3b0cb7c2a`，`status=failed`，报文含 `missing=1`）—— **不是**前图既有的 kbId / 指纹那条 | — |

**N2 的意义**：它复现的正是「重跑入库后旧账本仍查得到旧行、却已不可检索」的形状 —— 行还在（`missing=0`）、指纹自洽、`kbId` 全对，但该行已 `superseded`。**只查「存在」的旧口径会放行**，产生一批必然假 miss；新闸以可检索姿态为准才拦得住。

**这不是签字数字**：无真 Gateway（chat / embed 仍 mock）、向量 8 维、ES 无 IK、`coverage=0`、可答类全 `abstained`；`businessPass` 仍 `false`（reasons 与前十轮同，**不含** `hit_at_k_below_min`）。

**未做 / 未核实**：① N2 用 `psql update` 直接改姿态复现，**未**真走一遍「重新入库产生新 docId + 旧行 superseded」的入库状态机（形状等价、来源不同）；② worker 侧的 `goldSetMatchesRepoFile` 未在真跑里验（信号非闸）；③ M 只跑了 L1，L2 队列路径未实测。
