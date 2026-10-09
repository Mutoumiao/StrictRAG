# 检索语料装载的租户不再「从文档行反推」

Label: wayfinder:map
Status: resolved（前沿：空；**目的地经工单 02 重画**：原定改动裁定为不改，真问题另立簇 40）

## Destination

**原目的地**（已重画，保留以记路线）：让检索语料装载用**入口显式给的** `tenantId`，取代「先按 `kbId` 拉全部文档行、再从首条可用文档反推 `tenantId`」。

**重画后的目的地**：把「检索的租户从哪来」这件事**核清并裁定**，产出可核对的结论 —— 即「哪一处该改 / 哪一处不该改 / 真问题是什么、须先裁什么」。到达时满足：

1. **装载面的租户来源有裁定**（结论 = **不改**），理由可核对：既有 fail-closed 测例有意钉住 + 无 PRD 依据 + 两源在可达状态下同值。
2. **ES 硬闸与装载面的关系说清**：`requireTenantId` 取的是**入口租户**，与装载面的反推值不是同一变量（原以为的「同源」缺口在装载面不存在）。
3. **真问题浮出并归档**：ask 的租户有**两源**（ES 稀疏腿 = 入口租户 / PG 语料 = KB 的租户），`auth.tenantId ≠ kb.tenantId` 时稀疏召回静默丢失（不泄漏）→ 属「租户权威源」的产品问题，三条处置都须先裁。
4. **镜像与雾清单一致**：`docs/module-status/api.md` 技术债表写入该债（标「未实测」）；雾清单簇 8 标「裁定为不修」并新增簇 40。

**不含**：真 ES / 多租户独立索引（B8）· 改 `prds/00–11` · 动任何默认开关 · 放宽任何门禁。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像。
- **来源（雾清单定位）**：`.scratch/fog-inventory-2026-09-23.md` 簇 **8** —— 「`CorpusLoader` 未传 tenantId（检索侧从文档行反推）」，离线可做（回归面较大）。
- **同族已收口的前图**：`close-p2-exit-gaps` 工单 05/17 把 `tenantId` 变成 **ES query / bulk builder 的必填硬约束**（`requireTenantId`，缺即抛）；本图补的是**上游装载面**，与那条口径串成「从入口到 ES 不留推断」。
- 每轮先读：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `apps/api/src/services/retrieve/{retrieve,corpus,types,visibility}.ts` · `prds/03-data/`（租户列）· `prds/09-security/`（多租户边界）· `apps/api/src/services/retrieve/es-sparse.ts`（`requireTenantId` 既有口径）。写代码前读 `.trellis/spec/api/backend/index.md`。
- **本图携带执行**：工单可以动手改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口批次跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 简介」必须简体中文，并登记该包 `tests/index.md`；**禁止**按源码一对一镜像造测例。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸。
- **改既有测例的红线**：本图**只允许新增**测例；若真有既有测例因本图变红，先如实记录「断言期望 vs 实测」，判明是**断言过严**还是**实现缺口**，不得为了让测试变绿而放宽实现。
- **本机限制**：无浏览器；真 ES / 真 PG 不在必需（Docker 可选）。

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 现状核实：租户来源链与影响面](./issues/01-research-is-verify.md) — 反推点 = `corpus.ts:69`（`tenantId: dual[0]?.tenantId`，`dual` 空 → `undefined`）；该值**只**进 `loadVisibilityContext`（部门可见性上下文），**不**进 ES；`RetrieveInput.tenantId` 链 = `ask.ts:314`（`auth.tenantId ?? kb.tenantId`）→ … → `run.ts:320`，但 `retrieve.ts:138-143` 调 `loadCorpus` 时**未传**；生产装载仅 2 处（`retrieve.ts:344` 默认 deps · `seed-es-sparse-probe.ts:47` 另行反推）；`documents.tenant_id` **NOT NULL**、写路径一律写 `kb.tenantId`（无跨租户写面）；ES 侧 `requireTenantId` 取**入口租户** → **挡不住**装载面的反推（两者本非同一变量）；**无**夹具造「文档行租户 ≠ 入口租户」；加租户谓词后**运行时不红**（装载测例把 `db.js` 的 `where` mock 成忽略入参）→ 新增谓词**无回归保护**。
- [02 · 裁定：`tenantId` 显式化的形状与缺租户时的姿态](./issues/02-dec-tenant-explicit.md) — **裁定为不改**（原目的地重画）。五条依据：① 既有测例 `tests/acl/dept-acl-ask-e2e.test.ts:327` 的 `describe('语料装载的 tenantId 来源（fail-closed）')` **有意钉住**该来源；② 无 PRD 依据（本簇自标「PRD 未明写」）且当前语义是 fail-closed；③ `documents.tenant_id` NOT NULL + 写路径一律 `kb.tenantId` → 正常数据两源同值；④ 收益是形式目标、代价是改写被钉住的语义 + 波及 4 处调用点；⑤ ES 硬闸取的入口租户与装载面反推值本非同一变量，「同源缺口」在装载面不存在。**带出的真问题**（→ 簇 40）：ask 租户两源 —— ES 稀疏腿 `retrieve.ts:199`（入口租户，优先 auth）vs PG 语料 `corpus.ts:64-79`（KB 的租户）；不等时**稀疏召回静默丢失**（不泄漏，异租户命中被语料求交滤掉）；**未实测**。
- [03 · 落：按入口租户收窄](./issues/03-task-implement.md) — **不实施**（工单 02 裁定为不改；无代码改动、无新增测例）。
- [04 · 回写](./issues/04-task-writeback.md) — `docs/module-status/api.md` 技术债表新增该债行（标「未实测」）+ 「最近更新」条目；雾清单簇 8 标「裁定为不修」+ 新增簇 **40** + 2026-10-09 追加段。**无代码/测例/契约改动**。

### 目的地达成（2026-10-09 · 重画版）

**「把检索的租户从哪来核清并裁定」已达成**：

1. **装载面**：裁定不改，理由可核对（既有 fail-closed 测例 + 无 PRD 依据 + 两源同值 + 形式目标不动语义）。
2. **ES 硬闸**：确认取**入口租户**，与装载面反推值不是同一变量 —— 原设想的「统一到同源」在装载面不成立。
3. **真问题归档**：ask 租户两源、不等时稀疏召回静默丢失；三条处置（ES 腿改按 `kb.tenantId` / 不等即拒 ask / 明示跨租户不得发生并加断言）**都须先裁** → 记入 `api.md` 技术债 + 雾清单新簇 **40**。
4. **无代码改动**：本图 0 处源码 / 测例 / 契约变更；提交只含图与镜像。

**该被记住的两句话**：① **「反推」不等于「缺陷」** —— 只有当能说出「改了更好」的可核对理由（PRD 依据 / 被钉住的语义可推翻）时才动；本图的正确产出是**不动**。② **核实会把目的地换掉**：本图核出的真问题（租户权威源）与出发时的假设（装载面反推）**不是同一件事**，而它更接近本质。

**提交（本地，未 push）**：`a7f4fd2` 立图 · 本图收口提交（图 + 镜像）。**只在本分支 `main`，未建 worktree。**

## Not yet specified

- **ask 的租户权威源是 auth 还是 KB**（本图核出的真问题 · 已登记雾清单簇 **40** 与 `api.md` 技术债）：三条处置 —— ① ES 稀疏腿改按 `kb.tenantId`（对齐 PG 语料）② `auth.tenantId ≠ kb.tenantId` 即拒 ask ③ 明确「跨租户访问不得发生」并在写路径 / 读取面加断言。**准入 = 先做一次裁定**（可能须 ADR：现行 `ask.ts:314` 的 `auth.tenantId ?? kb.tenantId` 是既有实现，改它属改语义）。**未实测**：不等值时的实际表现（稀疏腿是否真的一条不中）无真 ES 证据。
- **`documents.tenant_id` 的 DB 约束**：今天只有 NOT NULL，无「必须等于所属 KB 的租户」约束；加它需 migration + 生产数据前提（是否存在历史异租户行未核）。
- **`loadVisibilityContext` 的请求级复用**（簇 11）：同一请求内 `loadCorpus` 可能被调 2 次（带 scope 与不带 scope 各一次）→ 可见性上下文重算 2 次。是否值得缓存属性能取向，**留雾**。
- **装载测例的 `db.js` mock 忽略 `where`**：本图发现任何新增的**查询谓词**都没有回归保护（mock 直接返回全夹具）。若将来在装载面加谓词，须同时改 mock 口径或在真 PG 上验 —— 属测试基建债，**留雾**。

## Out of scope

- **多租户独立索引布局 / 真 ES 查询期部门对称 filter**：B8
- **改 `tenantId` 缺失时的产品语义**（例如让 ask 在无租户时拒答）：须先裁产品口径，本图只处理检索装载面
- **`documents.tenant_id` 加 NOT NULL / 外键 / 唯一约束**：改 schema 须 migration + 生产数据前提，属新图
- **改 `prds/00–11` 已冻语义**（须 ADR → 改 PRD → 升 `prds/README.md` 版本）
- **放宽** `requireTenantId` 的 ES builder 硬闸（前图已收口，本图不动）
- 把「已具备最小 / 默认关」读成「生产已上 / 可签字」
