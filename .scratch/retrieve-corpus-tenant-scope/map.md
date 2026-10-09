# 检索语料装载的租户不再「从文档行反推」

Label: wayfinder:map
Status: open（前沿：01）

## Destination

让检索语料装载用**入口显式给的** `tenantId`，取代今天「先按 `kbId` 拉全部文档行、再从首条可用文档反推 `tenantId`」的做法。到达时同时满足：

1. **显式** —— `CorpusLoader` 的入参带上 `tenantId`，`retrieve` 把 `RetrieveInput.tenantId` 传下去；装载内**不再**从文档行推断租户。
2. **加严** —— 语料查询按 `tenantId` 收窄：跨租户的文档行不得进语料（今天只按 `kbId` 收，租户靠反推 → 若库内混入异租户行，检索会按**第一条**文档的租户建可见性上下文）。
3. **逐位不变** —— 单租户 KB（正常情形：KB 内所有文档同租户）的语料、可见性上下文与检索结果**逐位不变**；所有既有测例断言**一字不改**。
4. **镜像一致** —— `docs/module-status/api.md` 与 `.trellis/spec/api/` 里关于「检索语料装载」的描述按实现回写；覆盖表相关行的缺口列若因此变化则改写（覆盖值须逐格判）。

**不含**：真 ES / 多租户独立索引布局（B8）· ES 查询期部门对称 filter · `tenantId` 缺失时的产品语义变更（见工单 02）· 不改 `prds/00–11` · 不放宽任何门禁 · 不动默认开关。

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

## Not yet specified

- **`CorpusLoader` 入参形状的最终形态**：是加必填 `tenantId: string`，还是加一个 `tenantId?: string` + 装载内 fail-closed？取决于「缺租户时该拒答还是该只按 `kbId` 收」（工单 02）。
- **`retrieve` 之外的 `loadCorpusFromDb` 调用点**（如 `apps/api/src/scripts/seed-es-sparse-probe.ts`）在显式化后各自的租户从哪来 —— 属工单 01 的核实面。
- **KB 与租户的关系是否已被约束**：今天 `documents` 有 `tenantId` 列，但「同 KB 跨租户」是否为不可能状态取决于 schema / 写路径是否有闸；本图不新增约束（那要 migration + 生产数据前提），只如实记录。
- **`loadVisibilityContext` 的请求级复用**（簇 11）：同一请求内 `loadCorpus` 可能被调 2 次（带 scope 与不带 scope 各一次）→ 可见性上下文重算 2 次。是否值得缓存属性能取向，**留雾**。

## Out of scope

- **多租户独立索引布局 / 真 ES 查询期部门对称 filter**：B8
- **改 `tenantId` 缺失时的产品语义**（例如让 ask 在无租户时拒答）：须先裁产品口径，本图只处理检索装载面
- **`documents.tenant_id` 加 NOT NULL / 外键 / 唯一约束**：改 schema 须 migration + 生产数据前提，属新图
- **改 `prds/00–11` 已冻语义**（须 ADR → 改 PRD → 升 `prds/README.md` 版本）
- **放宽** `requireTenantId` 的 ES builder 硬闸（前图已收口，本图不动）
- 把「已具备最小 / 默认关」读成「生产已上 / 可签字」
