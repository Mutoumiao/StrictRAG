# 回写：镜像 · spec · 雾清单 · 导航层陈旧陈述

Type: task
Status: pending
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

待填
