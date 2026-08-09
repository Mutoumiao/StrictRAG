# L1 黄金集（工程 seed）

> **本窗 = 工程底座**，不是业务签字包。`mock` 模式下的 2×2 数字 **禁止** 写入业务签字页当生产门禁。

## 文件

| 路径 | 说明 |
|------|------|
| `gold.yaml` | ≥30 题 SSOT（内容为 JSON 形，零依赖解析；扩展名按 design 冻结） |
| `sample-report.md` | 可提交样例报告（非真实 live 签字数字） |
| 仓根 `artifacts/l1-last-run.{json,md}` | 最近一次 CLI 输出（gitignore） |

## `expectedDocIds` 与 dev fixture

合成 gold 的文档 id 使用 **逻辑 id**，绑定 `fixtures/ingest-samples/`：

| 逻辑 id | 对应文件 |
|---------|----------|
| `ingest-samples/01-doc` … `10-doc` | `fixtures/ingest-samples/01-doc.txt` … `10-doc.txt` |

入库后真实 `documents.id`（uuid）因环境而异。live 跑批前请按本表把 gold 中逻辑 id **替换/映射** 为当前 KB 内文档 uuid；本窗 **不对 A 格命中率设下限**，映射缺失不影响工程底座验收。

## 题型比例（本窗 seed）

| type | 约数 | 说明 |
|------|-----:|------|
| `answerable` | 15 | 可答 |
| `unanswerable` | 12 | 不可答 |
| `false_premise` | 3 | 假前提（不可答子集） |
| **合计** | **≥30** | 可答:不可答 ≈ 1:1 |

签字规模（可答≥30 且 不可答≥30）见总 backlog **B10-followup**，**非本窗**。

## 跑法

见 `apps/api/README.md` · L1 黄金集 一节。
