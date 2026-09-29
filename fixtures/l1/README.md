# L1 黄金集（工程 seed）

> **本窗 = 工程底座**，不是业务签字包。`mock` 模式下的 2×2 数字 **禁止** 写入业务签字页当生产门禁。

## 文件

| 路径 | 说明 |
|------|------|
| `gold.yaml` | ≥30 题 SSOT（内容为 JSON 形，零依赖解析；扩展名按 design 冻结） |
| `judge-calibration.json` | Judge AUROC 校准集：`claim` + `evidence` + `supported\|unsupported`；**不是** gold 题型 |
| `human-spot.example.json` | 人工抽检账本**样例**（形状契约在 `@strict-rag/contracts` `HumanSpotLedgerSchema`）：`evalRunId` + `sampledBy` + `sampledAt` + `checked` + `errors` + 可选 `items`；样例是**恰好达标**的 20 条 / 错 1，不是真实抽检数字 |
| `RACI.md` | **B10-RACI**：业务/测试 owner + 题面审核记录；**挡业务签字页** |
| `sample-report.md` | 可提交样例报告（非真实 live 签字数字） |
| 仓根 `artifacts/l1-last-run.{json,md}` | 最近一次 CLI 输出（gitignore） |

## `expectedDocIds` 与 dev fixture

合成 gold 的文档 id 使用 **逻辑 id**，绑定 `fixtures/ingest-samples/`：

| 逻辑 id | 对应文件 |
|---------|----------|
| `ingest-samples/01-doc` … `10-doc` | `fixtures/ingest-samples/01-doc.txt` … `10-doc.txt` |

入库后真实 `documents.id`（uuid）因环境而异。live 跑批前请按本表把 gold 中逻辑 id **替换/映射** 为当前 KB 内文档 uuid。报告可写 Hit@k（字符串全等）；**不对 A 格命中率设下限**，映射缺失只让 Hit@k 变低，不影响工程底座 2×2 验收。

> **映射入口已落**（工单 03 / 04）：`apps/api/src/scripts/ingest-eval-corpus.ts` 把两份语料入库并产出映射账本（落 artifacts，运行产物不入库）；跑批侧用 env 指定账本即按当前 KB 的 uuid 比对，未传账本时与本表人工替换前的行为**逐位一致**（缺映射继续算 miss）。命令见 `docs/ops/operable-stack.md`。

## 题型比例（本窗 seed）

| type | 约数 | 说明 |
|------|-----:|------|
| `answerable` | 15 | 可答 |
| `unanswerable` | 12 | 不可答 |
| `false_premise` | 3 | 假前提（不可答子集） |
| **合计** | **≥30** | 可答:不可答 ≈ 1:1 |

签字规模题面：`gold.yaml` 已扩至 **可答 30 + 不可答类 30**（含 `false_premise`）。  
**真跑数字** 须 `retrieve_mode=live` 且 B3-W 后重跑 → 总 backlog **B10-followup**；`L1_PERSIST_EVAL=1` 写入 `eval_runs`。

## 人工抽检账本（PRD §6 硬门「≥20 条，错 ≤1」）

- 抽检人写一份 JSON 账本（形状契约 `packages/contracts/src/eval/human-spot.contract.ts`：`evalRunId` / `sampledBy` / `sampledAt` / `checked` / `errors` / 可选 `items`）。
- 机器可校验的不变式只有三条：`errors ≤ checked`；**给了 `items` 时** `items.length === checked` 且 `items` 里 `wrong` 的条数 `=== errors`。
- 「错」的口径 PRD 未定义 → 由抽检人按 rubric 判；登记面只承载整数 + 可选明细，不发明机械口径。
- 进闸：`pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts --human-spot fixtures/l1/human-spot.example.json`；**不传该参数 = 缺测 → 该硬门不放行**。
- 账本**不进库**（无表 / 无 HTTP 端点）；报告落条数 / 错数 / 来源（`humanSpot`），`null` = 没人登记。

## 跑法

见 `apps/api/README.md` · L1 黄金集 一节。
