# 真栈真跑：入库语料 → 带账本跑 L1 → 记录实测 Hit@20

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 03, 04

## Question

在**本机 Docker 真栈**上把新能力真跑一遍，产出**仓内可复核**的实测记录：

1. **起栈**：按 `docs/ops/operable-stack.md` + `docs/ops/real-stack-evidence.md` 的既有配方（含前图补的 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 前置）起 PG + Redis 等，`/ready` 达到配方口径；**不要**改配方里的任何默认开关。
2. **入库并出账本**：用新入口把评测语料入库到**一个** KB，落出账本；报出 KB 全量 uuid 与该 KB 的文档终态（含 `title` / `status` / `lifecycle`）。
3. **带账本跑 L1**：用 `apps/api/src/scripts/run-l1-golden.ts` 跑一次（模式按本机实况，**如实标注** `retrieve_mode`：若无真 Gateway 则为 mock 路径），记录：`hitAtK` / `hitAtKHits` / `hitAtKScored`、`coverage`、`cRate`、`citationComplete`、`evaluated` 的 `reasons`（尤其 `hit_at_k_below_min` 是否出现）、以及映射来源字段。
4. **对照**：同夹具、同 KB，**分别**跑一次「不带账本」与「带账本」，把两个 `hitAtK` 三元组并排记录 —— 这是「映射真起作用」的直接证据（不带账本那一跑是回归锚）。
5. **如实写结论**：实测到的 Hit@20 是**多少就是多少**。若仍低于 70%，**不许**写成「门已达标」，要写清「门现在算得出真数字，值是多少，差在哪（检索召回 vs 未映射）」；并明写这**不是** `retrieve_mode=live`，**不构成**签字证据。
6. **顺带修**：真跑暴露的**只在真栈现形**的缺陷，当场按「收紧或逐位等价」修 + 补测例；撞冻结契约的记债并写清阻塞方（前图先例：ES bulk 等刷新、smoke 四眼）。

**不许**：把 mock 数字写成签字数字 · 改仓库默认开关 · 为了让数字好看而改夹具或过滤逻辑 · 伪造引用 / 代签。

产物：`research/05-real-stack-hit20.md`（命令 + 原始输出摘要 + 两张对照表 + 结论）。若本机环境不具备（如 Docker 不可用），**如实记**为阻塞方并写明缺什么，**禁止**据代码推断填数。

## Answer

**已解**。取证全文：[`../research/05-real-stack-hit20.md`](../research/05-real-stack-hit20.md)。

**真栈**：compose 五服务全 `healthy`（PG 16+pgvector · Redis 7 · ES 8.15.3 vanilla · Mongo 7 · RustFS）· `pnpm db:migrate` 幂等成功 · `/ready` = `postgres/redis/elasticsearch/s3/mongo` 全 up（`gateway: skipped`）。语料入库走新入口：**13 篇**（`ingest-samples/01..10-doc` + `l2-corpus/{leave-policy,meal-allowance,travel-stay}`）全部 `ready` 且 `lifecycle=active`，账本 13 条、`fingerprint=c437c632…`。**四眼闸真跑生效**（首篇自审探针必须 403，通过 → 审批确实换了第二个身份）。

**两跑对照（同一夹具、同一 KB、唯一变量 = `L1_DOC_MAP`）**：

| 字段 | 不带账本 | 带账本 |
|---|---|---|
| `hitAtK` | **0**（0/30） | **1**（30/30） |
| `docMapSource` / `docMapResolved` / `docMapUnmappedIds` | `none` / 0 / `[]` | `ledger` / **10** / `[]` |
| `verdict.reasons` | 含 **`hit_at_k_below_min`** | **不含**该条 |
| `businessPass` | false | false |
| `matrix` / `errorCount` / `outcome` | `{A:0,B:30,C:0,D:30}` / 0 / `abstained × 60` | 同左 |

**目的地达成的直接证据**：PRD 冻结的 `Hit@20 ≥ 70%` 这道硬门，从「结构性必失败」变成「算出真数字并通过（30/30）」——`hit_at_k_below_min` 在带账本那一跑**消失**。命中的 30 条恰是全部 `answerable` 题。

**同时如实写清它没解决什么**（`businessPass` 仍 false，其余阻塞方一条未动，且都与映射无关）：`coverage_zero_or_null`（无 Gateway → mock chat 非法 JSON → 60 题全 `abstained`）· `judge_auroc_missing_or_below_min`（无 live 打分器 + 校准集仅 8 条 < PRD ≥100）· `human_spot_missing`（须人写抽检账本）· `missing_proposal` / `missing_signatures` / `internal_guard`（ADR-046 四要素与业务人签）。**这些一条都不是本图能代的**。

**不是签字数字**（本票实测的边界，全部写进取证文）：向量仍 mock（8 维）、chat 仍 mock（无 `GATEWAY_BASE_URL`）、ES 是 vanilla 无 IK、`AUTH_ENFORCE=false`、扫描 `mock_clean`；`retrieve_mode=live` 只反映 ES 检索档位，不等于可签字。

**真跑暴露的环境事实**：Docker Desktop **再次自行退出**（本轮第 3 次）。其中一次落在两次 L1 之间的窗口 → 那一跑 60 条 case 全 `error`（原文 `Failed query: select … from "documents" …`，PG 不可达），`errorCount=60` / `coverage=null`；**机制诚实**（不假绿、不静默跳过）。重启守护进程 + `compose up -d` 后**原样重跑**得 `errorCount=0`，本票数字以健康栈上的重跑为准，故障那一跑留痕不删。

**未做**：未跑 L2 批跑（`L2_DOC_MAP` 接线已落有测例）· 未接真 Gateway / 未做 live judge / 未做人工抽检 · worker 侧 run-batch 按裁定未接账本。
