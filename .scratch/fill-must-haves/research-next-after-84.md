# Research: 反馈回流黄金集之后下一步可动手缺口

- **Query**: 对照功能表「必须具备」与源码，找出 wayfinder 地图「按功能表补全必须具备」里，在工单 84 已完成后，下一步可动手、不依赖人签 / 真引擎选型 / 解锁站规的产品语义缺口
- **Scope**: mixed（功能表 + `prds/00–11` + 源码；`docs/module-status` 仅作镜像）
- **Date**: 2026-09-16

权威：WHAT = `prds/00–11`；功能表 = `prds/12-delivery-guides/14-模块需求功能表.md`（派生，冲突跟 PRD）；IS = 源码。地图 = `.scratch/fill-must-haves/map.md`。已关执行到 84；前线 grilling = `.scratch/fill-must-haves/issues/85-after-feedback-promote-gold-order.md`。

**本文件是两份独立研究的合并件**（两份报告全文保留，作为逐条证据）：

- `.scratch/fill-must-haves/research-next-after-84-table.md` — **功能表权威面盘点**（从功能表 + PRD + 验收剧本反查仍未落地的必须具备行）
- `.scratch/fill-must-haves/research-next-after-84-source.md` — **源码 IS 面证据核对**（对候选逐条在源码取 `路径:行`，独立判定已齐 / 半接线 / 缺失）

过期线索：`research-next-after-74.md`（写给 75；**76 / 78 已落地，不得再当缺口**）、`research-next-after-78.md`（写给 79；其推荐 80 / 82 / 84 已落地）。

无活跃 Trellis task。本文件按用户指定路径落盘，不是 `{TASK_DIR}/research/`。

---

## 0. 结论（给 85 用）

**不应暂停。** 人签 / 真引擎 / 解锁站规之外，目的地里仍有可动手的必须具备真空。上一轮研究列出的候选已被 80（跨文档去重）/ 82（L0·contextMode）/ 84（反馈回流）吃掉，所以本轮把口径换成 **功能表 + `prds/00–11` + 验收剧本 P2 必签行**重新对齐。

两份独立研究**各自**找出两条**从未进入本图任何工单**的必须具备行（不在 `map.md` 已锁清单，也不在原雾清单，此前只躺在 `08-06-project-backlog/status.md` §2.5.2 的 `QUAL-*` 指针上标「未开始」）：

| 行 | 入场 | 权威 | 判定 |
|----|------|------|------|
| **提交者不可自审（四眼 / 剧本 V3）** | P2 | 安全 PRD「禁自审默认」· HTTP PRD §approve（ADR-048）· ADR-048 #4 · 数据 PRD 审批表 · 功能表 §4.3/§4.4 · 剧本 V3 | 三层同缺 |
| **孤儿清理（`ingest.maintenance` / 剧本 L7）** | P1–P2 | 存储边界 §2.4「孤儿清理（ADR-038 · **必须**）」· 异步 PRD §5 · 功能表 §6 `ingest.maintenance` | 缺（只对账报数，无清理入口） |

**推荐本批（串行三张）**：

1. **提交者不可自审四眼最小闭环**（信任环红线，先做）
2. **角色与权限树状勾选最小闭环**（IA §2.4 明文，P2 必达）
3. **分片策略保存写服务端修改日志最小闭环**（IA §2.2「写保存 → 服务端修改日志」）

**下一轮首张**：孤儿清理最小闭环（剧本 L7 / QUAL-L7）。

---

## 1. 已锁、不要当缺口重开

| 项 | 口径 |
|----|------|
| P2 第三批语义收官；P2.5 工程路径齐 | 人签 / 准出 PASS / 默认开 rewrite 图外 |
| BlockNote / editor-draft / web 编辑器 | P2.x 完整体验余量；62 已做 Markdown 提交审批 |
| P3a Full 图 | 等 L2 人签（图外） |
| LangGraph 重构 | 另起路线（`apps/api/src/graph/run.ts` 仍是线性状态机） |
| B8 / B9 / QUAL-2 | 真 ES+IK / 真 RustFS / 真杀毒，不进本回合 |
| P3b 可动手最小闭环 | 已齐；**仓库默认开** `DEPT_ACL_ENFORCE`、角色 principal 仍锁 |
| P4 可动手代码真空 | 已尽；人签 / 再认证 / 数据面板增强 / Grafana / 独立 `tau_sweep` 入队 / tau* 接运行时 / live judge 不是本回合代码真空 |
| P5 OCR 开闸 + 历史重跑 | 已齐（默认关）；真引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe = 选型 |
| 80 已落地 | 同 KB 跨文档近重复默认 `skip_index`；报告写冲突对。**不要再当缺口** |
| 82 已落地 | worker 服从 `contextMode` 快照并写 L0 情境前缀。**不要再当缺口** |
| 84 已落地 | PATCH `promoted_to_gold` 真写 `gold_questions`。**不要再当缺口** |
| 35 切边 | `maxEmbedCalls` / embed TPM / staging fail-closed = 部署与计量基建；剧本 R4/R6/R10 **不在本图重开** |
| ES 租户迁移 | ADR-041 事件驱动独立索引；不属本图 |

### 1.1 `docs/testing/coverage.md` 与 `status.md` §2.5.2 已滞后（以源码为准）

四处「缺实现 / 未开始」实际已落地，勿误当缺口：**E4**（跨 doc 近重复，由 80 落地）、**E5**（L1 故障 L0 回退，由 82 落地）、**AB8**（策略设置弹窗，由 06 + 82 落地）、**AC7**（KB 绑 judge 400，由 78 落地）。

`QUAL-V3` / `QUAL-L7` / `QUAL-K5` / `QUAL-AA1` / `QUAL-ACL-CAP` / `QUAL-TENANT-Q` / `QUAL-PLANE` / `QUAL-G3` 的「未开始」与源码一致。

---

## 2. 功能表入场行对照

| # | 缺口 | 入场 | 判定 | 权威出处 |
|---|------|------|------|----------|
| 1 | 提交者不可自审（`approve` 不比提交人；`uploaded_by`/`approved_by` 无写入方；审批面无「提交人」） | **P2** | 缺（三层同缺）；剧本 V3 标「缺实现」 | 功能表 §4.3 / §4.4；安全 PRD §禁自审默认；HTTP PRD §approve(ADR-048)；ADR-048 #4；数据 PRD 审批表；剧本 V3；`documents.ts:38-40` |
| 2 | 孤儿清理 job（`ingest.maintenance` 非激活 version 双侧清理 + 激活版永不删） | **P1–P2** | 缺；只对账报数，无清理入口 | 功能表 §6 `ingest.maintenance`、§13 P1；异步 PRD §5；存储边界 §2.4（**必须**）；ADR-038；剧本 L7 |
| 3 | 角色与权限「树状勾选」 | **P2** | 半接线：页头写「树状」，实现是扁平勾选；`MENU_TREE` 已有且被壳消费，但角色页不消费 | 功能表 §4.1 / §4.4；IA §2.4；安全 PRD 表「角色树 UI｜P2 必达」 |
| 4 | 分片策略 PATCH 的服务端修改日志 | **P2** | 缺：不写审计（KB 设置 PATCH 已写） | 功能表 §4.2 末段 / §4.5；IA §2.2；剧本 AA1 |
| 5 | 文档绑定策略参数快照只读审计 | **P2** | 缺（DB 列有、HTTP/UI 无） | 功能表 §4.5；`documents.ts:44` |
| 6 | 质量只读「签字包链」 | **P2** | 半接线：只有 `gatePackageId` + `effectiveAt`，且生产者写死 null | 功能表 §4.2；ADR-046 |
| 7 | 断线按 `requestId` 重拉终态 | **P2** | 缺（需显式重开 10 的划出项） | 功能表 §3；`apps/web/src/api/ask.ts` 注释「非断线重拉」 |
| 8 | citation chunk 级去重 | **P2** | 缺：`validIds` 未去重 | 功能表 §10.1；`apps/api/src/graph/run.ts` 约 396–418 |
| 9 | 跨文档去重率 `dedupe_cross_doc_rate` / 「高度重复」提示 | P1–P2 | 半接线：计数已出，率与提示缺 | 入库 PRD §5.2；功能表 §6 去重末段；剧本 E4 |
| 10 | 指标骨架 `fallback` / `node_used` 维 | P2 | 半接线：`meta.fallbackUsed` 已有，metrics 无该维 | 功能表 §10.3 |
| 11 | 真 L1 `contextualize` | P1 | 缺（网关无该 purpose） | 入库 PRD §4；工单 82 切边外 |
| 12 | `pending_review` 人工二选一 | P1 | 缺（默认动作是 `skip_index`，二选一是可选动作） | 功能表 §4.3 / §5.2 |
| 13 | 入库报告 L0 vs L1 Hit@k 抽样 | P1–P2 | 半接线（未找到 PRD 必须条款） | 功能表 §5.2 / §10.2 |

### 2.1 已齐（不要再开）

web P2 全路径、admin P2 运营最小全路径（含 74 / 76 / 78 / 84）、api P2 主路径、P3b 可动手最小、P4 可动手最小、P5 开闸 + 重跑。详见 §1 与两份子报告。

### 2.2 看起来像缺口、本回合不当执行工单

| 项 | 为何不进 |
|----|----------|
| MD/TXT 更严体积 | PRD / ADR-039 / 功能表均写 **「可选 / 可更严」**，不是硬必须 |
| 魔数 / 文件头嗅探 | `prds/00–11` **无条款**；039 只要求 MIME/扩展名 + checksum（72 已落） |
| PG 硬删 / HTTP ES `_delete_by_query` / 生产 Router 迁移 | 68 已 archived + mock purge；三存生产对齐偏 B8 |
| `allowedDocIds` 成员大列表（QUAL-ACL-CAP） | ADR-009 已关；19 明确不做 → 该 QUAL 行实际 moot |
| `/health/ready` 路径名、`/metrics` 裸奔 | 存活/就绪已有；metrics 是基建债 |
| QUAL-K5 Langfuse 明文 ACL | Langfuse 仅 mock（`obs/ask-tracer.ts`），无真体可验 → 雾 |
| 句级 `[chunkId]` / 重叠句归属 / Langfuse SDK | 第三批质量半接线，08 划出 |
| 原生 `<select>` 换 `ClosedSelect` | **站规债**已量化：admin 20 处原生 + 4 处旧 ui `Select`；web 已清零。是站规余量，不是功能表语义；可另批清扫 |

---

## 3. 仍留雾（依赖人签 / 选型 / 解锁站规）

- L2 准出人签；默认开 rewrite；对外宣传连续追问
- P3a CRAG / multi_hop
- 仓库默认开 `DEPT_ACL_ENFORCE`；角色 principal
- P4：门禁包人签与再认证、数据面板增强、独立 `tau_sweep`/`verifier_calib` 入队、tau* 接运行时、live judge、Grafana
- P5：真 OCR / Cloud / 自动全库 / 容量 / 抽样常态化 / CoVe / 超长异步
- B8 真 ES+IK、B9 真 RustFS/Mongo 生产、QUAL-2 真杀毒
- BlockNote / editor-draft / web 用户编辑器
- LangGraph.js 官方图重构
- 真 L1 LLM `contextualize`（Gateway 费用路径）
- QUAL-G3 `gold.yaml` 审核闸（人审 seed）
- QUAL-PLANE 三平面 R4/R6/R10（35 切边维持）
- ES 租户索引迁移（ADR-041）

---

## 4. 给 85 的裁定建议

1. **不选** 85 题面五候选。
2. 本批三张串行：禁自审四眼 → 角色树状勾选 → 分片策略服务端修改日志。
3. 下一轮首张：孤儿清理最小闭环。
4. 不要把 §2.2 各项并进本批。
5. 默认开强制 / 角色 principal / 默认开 OCR / 默认开 rewrite / 人签 / 真引擎仍锁。
6. **暂停**只在剩余项都依赖人签或选型时才合理；当前不是。

## Caveats / Not Found

- 无活跃 Trellis task；本文件只写在用户指定路径。
- `eval_runs` 是否已存 `gateBundle` / `evalBindId` 未定位（影响 §2 第 6 项的列设计）。
- 子报告未跑测试；admin 测例同名文件未逐一确认。
- `docs/module-status` 只作交叉参考，可能滞后（§1.1 已点名四处）。
- 未改 map / 工单 / 产品代码。
