# 回写：镜像 · spec · 雾清单 · 导航层陈旧陈述

Type: task
Status: resolved
Blocked by: 03

## Question

按工单 02/03 的结论回写，**每条都要能指到证据路径**（不得只改措辞）：

1. **镜像**：`docs/module-status/api.md`（`qualitySnapshot` / 签字包 / τ 相关句 + 技术债表 + 最近更新）· 必要时 `contracts.md` / `db.md`（若契约或 schema 有变）。
2. **spec**：`.trellis/spec/api/backend/l1-eval.md`（§6.0 加载 / τ 唯一源一节）· 若有新范式，同步 `.trellis/spec/guides/testing.md`。
3. **雾清单**：`.scratch/fog-inventory-2026-09-23.md` 簇 **3** 行按结论改写（「须 ADR」是否仍成立、销账口径）；若本图核出新雾，新增簇号并写明其「离线可做」一栏。
4. **覆盖表**：若本图影响的验收剧本行有变（剧本 T / 签字页必含行 / 剧本 C），按实测改 `docs/testing/coverage/*`。
5. **总 backlog**：`.trellis/tasks/08-06-project-backlog/status.md` 的相关行（磁盘文件）。
6. **导航层陈旧陈述纠偏（本图立图时顺带核出的、与簇 3 无关但会误导下一张图的假前提）** —— 逐条**先核实再改**，改时写清「旧句 → 新句 + 证据路径」：
   - `.scratch/fill-must-haves/map.md` `Not yet specified` 里**孤儿清理**那条写「前置未解：今天没有『当前激活 version』可断言」→ 源码里 `documents.active_index_version` 已落（`packages/db/drizzle/0020_documents_active_index_version.sql` · `packages/db/src/schema/kb/documents.ts` · `apps/worker/src/ingest/pipeline.ts:984-987` es_index 成功时原子写 · `apps/worker/src/ingest/orphan-clean.ts:55-63` 以它为护栏 · 失败路径触发 `pipeline.ts:227`）。**待核**：那条里「触发=周期另依赖调度基建」是否仍准确。
   - 同段**签字包链**那条写「`qualitySnapshot` 的 `gatePackageId` / `effectiveAt` 唯一生产者 `defaultQuality()` 写死 null」→ 今天由 `evalRunRepo.latestSignoffPackage(kbId)` 派生（`apps/api/src/routes/kb-settings.ts:62-72` · `apps/api/src/services/eval-runs.ts` 的 `latestSignoffPackage`）。改后须写清**真正的**残余前置是什么（若仍有）。
   - 同段**自动 reindex-on-tighten（前置：激活 version 表示）** → 该前置已消除，且已裁为**人工触发**（`docs/module-status/api.md` 明确记「旧前置已消除」）→ 按「已裁、非缺口」改写。
   - 同段 **`drizzle/meta` 基线缺失（`db:generate` 仍不可用）** → `0021_snapshot.json` 已落盘、`db:generate` 恢复可用（`.trellis/spec/db/backend/database-guidelines.md` 的 Gotcha 段）→ 按事实改写。
   - 同段 **`pending_review`（前置：落点 / 人工端点 / KB 策略位三处未冻）** → **待核**：worker 已有 `apps/worker/tests/ingest/cross-doc-pending-review.test.ts`、admin 审阅面已由 `pending-review-ops` 图落地 → 按核到的实际范围改写（哪几处已冻、哪几处仍缺）。
   - `.scratch/fog-inventory-2026-09-23.md` 汇总表簇 **10**「grant 写审计是否落表（今天只有 Pino）」→ **待核后**按源码改写：`dept_cross_grants` 行自带 `reason` / `granted_by` / `created_at`，且 `DeptCrossGrantSchema` 已暴露 `grantedBy` / `grantedAt` / `reason` 给读面（`packages/contracts/src/system/dept-grants.contract.ts:6-14`）→ 真正无持久痕的是 **DELETE**（`apps/api/src/routes/dept-grants.ts:126-146` 只有 Pino）。改后该行的「缺口」应指向删除留痕，而非「只有 Pino」这句笼统话。
7. 收尾跑 `pnpm check:module-status`，确认 `1-路径` / `6-联动` / `7-时效` 三类为空（`2-env` / `3-符号` / `5-表` 的历史噪声不在本图范围）。

## Answer

**已回写**（每条都能指到证据路径）。

### 1–2 镜像与 spec

| 位置 | 改了什么 |
|------|----------|
| `docs/module-status/api.md` | ① `qualitySnapshot.tauClaim` 句补「env 是承载、签字包是权威」+ `gatePackageRejectedReason`；② 签字包一节重写为「**只读回填 + 加载闸**」（四态、判据、无容差、warn、`≠` 业务人签、未做四项）；③ 技术债行 **T6 重写**（原「无加载口 → 销账条件 = ADR → 改 PRD → 升版」→「已落一半 + 仍欠五项」）；④ 最近更新加 2026-10-09 条 |
| `docs/module-status/contracts.md` | `qualitySnapshot` 句补可选 `gatePackageRejectedReason`；最近更新加条（含「只加可选键、旧响应照旧解析」） |
| `docs/module-status/worker.md` | 最近更新加条：内口回传 τ → 批跑整批同值才记进 `repro.tauClaim`、分歧/全缺记 null；写明「此前队列路径的包 τ 恒 null」 |
| `docs/module-status/admin.md` | 最近更新加条：质量只读区加一行原因、不加控件；**明写「本机无浏览器，只跑 RTL，视觉 / 交互未验」** |
| `.trellis/spec/api/backend/l1-eval.md` | **新增一节「签字包『加载』校验（§6.0 / ADR-046 #4 · ADR-062）」**（冻结原文 / 权威归属 / 判据 / 四态 / 生产者 / 测例 / 未做）；§8 的 `tauClaim` 说明改为「api CLI = 与快照同一变量；worker = 内口回传、同值才记」 |
| `.trellis/spec/api/backend/index.md` | ADR-ready 八条那条补：**`T6` 已收掉一半**（ADR-062），仍欠的是读法切换 |

### 3 雾清单

- 簇 **3** 行按结论改写：「已解一半（2026-10-09）」+ 仍欠清单 + **依据更正**（§6.0 = ADR-046 决策 #4；原记的「撞 ADR-007」措辞不准确，ADR-007 原文未规定来源）。
- 簇 **10** 行**顺手纠偏**（原写「grant 写审计今天只有 Pino」不准确）：`dept_cross_grants` 行自带 `reason` / `granted_by` / `created_at`，且 `DeptCrossGrantSchema` 已把这三点暴露给读面；真正无持久痕的是 **DELETE**。→ 该行改为「跨部门 grant 的**删除**要不要留痕」。
- 新增 **2026-10-09 追加段**（本图的目的地、四次反转、仍欠清单、T6 由「丁」转「部分测」）。

### 4 覆盖表

- `docs/testing/coverage/03-ops.md` 的 **T6 行**：覆盖值**不动**（仍 `部分测`），「主包」由 `api` 扩为 `api · contracts · admin · worker`，「证据」列换成新测例（含反证），「缺口」列改为「已收掉一半（ADR-062）+ 仍欠五项」，并写明依据更正。
- `docs/testing/coverage.md` 加**第十五轮**日志（无行级覆盖值变化）、把「T1/T2/T3 运行时加载口零落点」一句按事实收窄。

### 5 总 backlog

- `.trellis/tasks/08-06-project-backlog/status.md` 的 **B10-followup** 行补记本图落地（含仍欠四项）。**核过**：`QUAL-L7` 行原本就写对了范围（「触发落『文档 failed』」），无需改。

### 6 导航层陈旧陈述纠偏（本图立图时核出、会误导下一张图的五条假前提）

逐条**先核源码再改**，改时写「旧句 → 事实 + 证据路径」：

| # | 旧句（`fill-must-haves/map.md`） | 事实（证据） |
|---|--------------------------------|--------------|
| 1 | 孤儿清理「前置未解：今天没有『当前激活 version』可断言」 | **已落**：`documents.active_index_version`（migration `0020`）· `pipeline.ts:984-987` 与 `status=ready` 原子写 · `orphan-clean.ts` 以「激活版 + 在飞版」为护栏、无激活表示一律不动手 · 触发之一（文档 failed）已接线（`pipeline.ts:227`）。**仍欠**：周期触发（缺调度基建）+ 真 ES 侧清理（B8） |
| 2 | 签字包链「`gatePackageId` / `effectiveAt` 唯一生产者 `defaultQuality()` 写死 null」 | **已落**：由 `evalRunRepo.latestSignoffPackage` 从 `eval_runs` 读时派生（`routes/kb-settings.ts` 的 `defaultQuality`） |
| 3 | 自动 reindex-on-tighten「前置：激活 version 表示」 | 前置**已消除**，且本项**已裁为人工触发**（非缺口）——`docs/module-status/api.md` 明记「旧前置已消除」 |
| 4 | `pending_review`「前置：落点 / 人工端点 / KB 策略位三处先冻」 | **三处均已落地**：落点 `chunks.dedupe_status`（仅取值 `pending_review`）· KB 策略位 `kb_settings.crossDocDedupeAction`（默认 `skip_index`）· 端点 `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve` + admin 审阅面（图 `pending-review-ops`）。仍欠只有 `downrank` |
| 5 | `drizzle/meta` 基线缺失（`db:generate` 仍不可用） | `0021_snapshot.json` 已落盘（2026-09-20），`db:generate` 恢复可用（验收在仓外副本达成）；仍开着的只有「类型 / 默认值级人工走查」（雾清单簇 22） |

另在 `fill-must-haves/map.md` 的 Notes 加一条**纠偏说明与教训**（「凡引用本文件挑目的地，先核源码再动工」）。

### 7 门禁

`pnpm check:module-status` → **44 条**，`1-路径` / `6-联动` / `7-时效` **为空**（`2-env(2)` / `3-符号(13)` / `5-表(29)` 是历史噪声，不属本图）。

### 未做

- 未改任何 `prds/00–11` **条款文本**（ADR-062 是归属澄清，条目里已写明不触发版本变更）。
- 未把「未做清单」写成「已具备」：τ 读法切换 / ask 路径 / 启动校验 / 其余质量参数 / §6.0 另三行 / §7 时效，六项全部按「带销账条件的债」记进镜像、spec 与雾清单。
