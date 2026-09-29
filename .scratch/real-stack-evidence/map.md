# 真中间件栈的证据化（把「未验证」变成「本机可复现」）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01–06 全收口。**目的地按实测重写**：见下方「目的地达成情况」）

## Destination

把被九张图反复点名、却一律写着「**不能（离线不可验证）**」的那批阻塞项，从「**声称 / 记债**」推进到「**本机真跑有证据**」，并据此逐行收口：

1. Docker compose 栈（PG · Redis · ES · Mongo · RustFS）在本机**真起**，`GET /ready` 相关项全绿；
2. `pnpm db:migrate` 在**真 PG** 上 apply 干净（雾簇 **23**）；
3. `pnpm smoke:half` 端到端真跑通（P-HALF 从「宣称可运行」变「本机可复现」）；
4. **真 ES** sparse 切片在 `RETRIEVE_ES_MODE=http` 下真跑（B8 切片），据此裁定覆盖表里被「真 ES」阻塞的行（雾簇 **24 / 37** · 覆盖表 **X5** 与 6 行「不可离线补」）；
5. 上述真跑暴露的缺口**逐条**裁定：能收紧或逐位等价落地的当场落地并补测例；撞冻结语义 / 撞外部依赖的**如实记债并写明阻塞方**；
6. 覆盖表 / `docs/module-status/` / `.trellis/spec/` 按真跑结果回写。

### 判据线（本图的立图之本）

- **真跑出来的才叫证据**：本机没跑过的，不许写「已验证」；跑过的，必须留下可复现的命令 + 输出（落 `research/` 或工单 Answer）。
- **不许改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR / 扫描 的**默认值一律不动**；叠加只写进 `docs/` 与工单 Answer，或经 `docker-compose.yml`（属工程文件，允许改，但须收紧或逐位等价）。
- **不改 `prds/00–11`**；不改夹具（`fixtures/*`）。
- **不假装绿**：栈起不来 / 某服务不通，就把它写成阻塞方，不许把「mock 绿」记成「真栈绿」。
- **`docs/ops/operable-stack.md` 的口径不许放宽**：本图只允许**加证据**与**订正与实测不符的句子**。

### 成功长什么样

① `docker compose -f docker/docker-compose.yml up -d` 后五个服务 healthy；② `pnpm db:migrate` 真 PG 上零错误，且迁移清单可核对；③ `pnpm smoke:half` 输出 `PASS` 且 `citations≥1`；④ 真 ES 上 sparse 索引建得起来、bulk 进得去、BM25 查得出（或如实记录它在哪一步断、缺什么）；⑤ 覆盖表里原先写「真 ES / 真 PG 阻塞」的行，要么改判并附真跑证据，要么销账条件写得更准；⑥ `pnpm check:module-status` 仍需零漂移。

## Notes

- 域：StrictRAG。**WHAT** 以 `prds/00–11` 为准（当前 **0.4.34**）；**IS 以源码为准**；`docs/module-status/` 是镜像；`docs/testing/coverage/` 是派生对照。
- **前图**：[`acceptance-divergence`](../acceptance-divergence/map.md)（已收口）· [`l2-report-determinability`](../l2-report-determinability/map.md) · [`l1-signoff-evidence`](../l1-signoff-evidence/map.md) · [`quality-gate-parity`](../quality-gate-parity/map.md)。全仓雾索引：[`.scratch/fog-inventory-2026-09-23.md`](../fog-inventory-2026-09-23.md)。
- **本图挑的簇**：雾簇 **23**（迁移未经真 PG apply）· **24**（B8 真 ES+IK / 多租户独立索引）· **36**（孤儿清理周期调度）· **37**（自动 reindex / dense 反向构造）中被「没有真中间件」卡住的部分 —— 这几簇此前被 4–5 张图显式划为「**不能**（离线不可做）」，**本图正是去验证这个「不能」是否成立**。
- **每轮先读**：本图 · `docs/ops/operable-stack.md` · `docs/ops/half-smoke.md` · `docs/testing/coverage.md` 及其分册相关行 · `docs/module-status/{api,worker,db}.md` · `.trellis/spec/` 对应包 · `docs/agents/issue-tracker.md`。
- **本图携带执行**：工单可直接改源码 / 改 `docker/` / 补测例 / 回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：改源码后跑 `pnpm check-types` + `pnpm lint` + 相关包测试；收口跑全仓 `pnpm test`（**串行**：`pnpm run test --concurrency=1`）。
- **`check:module-status` 基线**：**39 条 = 2 env + 13 符号 + 24 表**；写回镜像时正文**不写 `路径:行号`**、不给裸标识符加反引号（前图教训）。
- **本机新增能力（相对前图）**：本机 **Docker Desktop 可用**（前图口径是「Docker / 真 PG / 真 ES 均不在」）→ 本图的核心变量就是这一条；若 Docker 起不来，本图就地转成「阻塞方精确化」并收口，不许把没跑的东西写成跑了。
- **没有浏览器**：admin / web 的视觉改动不做；RTL 单测可写可跑。
- **本图特有的「不许」**：
  - 不许把 compose 或 env 叠加当成「生产线」话术——`docs/ops/operable-stack.md` 顶部「**非生产级**」那句不许删；
  - 不许为了让 `smoke:half` 绿去改 `smoke-half.mjs` 的断言（空引用必须失败）；要改只能**加严**；
  - 不许把真跑失败改写成「未验证」——失败要写清**哪一步、什么错、缺什么**。

### 目的地达成情况（收口时按实测重写）

| 原定成功长什么样 | 实际 |
|---|---|
| ① 五服务真起 healthy | ✅ 达成 |
| ② `pnpm db:migrate` 真 PG 零错误 | ✅ 达成（23 = 23 = 23，`db:generate` 零漂移） |
| ③ `pnpm smoke:half` 输出 `PASS` | ⚠️ **未达成，且不是「没跑」**：入库段（上传 → complete → 四眼审批 → scan → 双就绪 `ready`）在真 RustFS + 真 Mongo + **真 ES** 上跑通；末步 ask 因**无可用 Gateway**（三契约）按既定口径空引用失败。详见 [research/04](../.scratch/real-stack-evidence/research/04-half-smoke.md) 与雾簇 39 |
| ④ 真 ES sparse 切片真跑 | ✅ 达成（建索引 / mapping / bulk / 中文检索命中 / `aclPrincipals` 三态与查询期收窄全部真跑通过） |
| ⑤ 覆盖表被「真 ES / 真 PG」阻塞的行改判或写准 | ✅ 达成（E1 阻塞方改判；X5 阻塞方改判为「源码缺面」并证明不构成泄漏） |
| ⑥ `check:module-status` 零漂移 | ✅ 达成（39 条基线未变） |

**额外收获（不在原计划内）**：真集群上现形并修掉**两处源码缺陷**（ES bulk 不等刷新 → 误红 `ES_RECONCILE_FAILED`；`smoke:half` 撞 ADR-048 四眼闸），各留证据与测例。

## Decisions so far

- [工单 01 · 真栈可达性与阻塞行口径（研究）](./issues/01-research-real-stack-reachability.md) — 全仓**无任何** compose / migrate / smoke 的真跑原始输出；`smoke:half` 在无 Gateway 机器上**源码侧即注定**在末步失败；X5 的「对称」源码侧无面可验；E1/E2 与簇 23/24 本机可判，H5b/P1/H5d/AC4 与 T4/C1/C2/C3 本机判不了。正文：[research/01](./research/01-real-stack-reachability.md)
- [工单 02 · 起真栈：compose 五服务 healthy + `/ready`](./issues/02-task-stack-up.md) — 五服务真起真绿、探活全过；**配方缺一步**：全新库上 api 因 `SuperAdminBootstrapError` **必然非零退出**，而四份运维文档都没写 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 这个前置（已补进 `operable-stack.md`）；`/ready` 的 s3 首启前恒 down（桶由首次 put 建，文档口径已订正）。正文：[research/02](./research/02-stack-up.md)
- [工单 03 · 迁移在真 PG 上 apply 干净](./issues/03-task-migrate-on-real-pg.md) — 空库从零 apply 零错误，SQL 文件 / journal / 已应用 **23 = 23 = 23**，能力级真写真读通过，`db:generate` **零漂移**。雾簇 23 **已解**。正文：[research/03](./research/03-migrate-real-pg.md)
- [工单 04 · `pnpm smoke:half` 端到端真跑](./issues/04-task-half-smoke-real.md) — **真跑抓出两处源码缺陷**：① `smoke-half.mjs` 用同一主体自审，撞 ADR-048 #4 四眼闸（403）→ 改为「先断言自审必 403，再换 `kb_admin` 审批」；② `bulkIndexSparse` 未等 ES 刷新即对账 → 文档被误写 `status=failed` / `ES_RECONCILE_FAILED`（mock ES 永不暴露）→ 改 `POST /_bulk?refresh=wait_for` 并补测例。修复后入库段一次成功。正文：[research/04](./research/04-half-smoke.md)
- [工单 05 · 真 ES sparse 切片真跑](./issues/05-task-real-es-sparse.md) — 索引 / mapping / bulk / **中文检索命中** / `aclPrincipals` 三态与查询期收窄在真集群上逐位符合预期；**IK 不是「能命中」的必要条件**；X5 的不对称**不构成泄漏**（语料求交），代价是召回。正文：[research/05](./research/05-real-es.md)
- [工单 06 · 回写与收口](./issues/06-task-writeback-close.md) — 回写 `docs/ops/operable-stack.md` · `half-smoke.md` · 新增 `docs/ops/real-stack-evidence.md` · `docs/module-status/worker.md` · coverage 两行缺口列 + 第十轮记录 · 雾索引重排。

## Not yet specified

**本图已解（不再留在这里）**：IK 装不装意味着什么（**已实测：不是命中必要条件**，只影响分词粒度与排序质量）· 真 ES 上 `aclPrincipals` 哨兵与 `exists` 语义（**已实测逐位符合**）· 真 RustFS / 真 Mongo 链路是否真能 PUT / upsert（**已在端到端真跑中走过**）· 孤儿清理与自动 reindex「是不是只差调度基建」（**已裁定：孤儿清理是只差调度基建；自动 reindex 是人工触发，不再是欠债**）。

**仍开着（已搬进 [`fog-inventory-2026-09-23.md`](../fog-inventory-2026-09-23.md) 簇 39 与相关簇）**：

- **半产品「问答」段的可复现性**（本图最大的新雾）：`GATEWAY_MODE=http` 要求上游同时提供 chat + embeddings + **rerank** 三契约；常见本地模型服务（如 Ollama）只给前两条、也不暴露 `/rerank`。要不要为「无 key 机器」提供一个 **dev-only 的 JSON 桩 Gateway / 本地适配器**，是一个**产品决定**（不是工程默认值问题）——本图**不擅自建**，如实记为雾并写明两条路（先裁再做 / 或永久写成环境前置）。
- 多租户**独立索引**（vs 单索引 + `tenantId` filter）：B8 的另一半，本图只真跑了单索引路线。
- `E2`（supersede 后 ES 侧不引用旧版）的 ES 命中半截：同源可判，本图未落。
- 真 PG/ES 上的**可重复集成测位**：本图的真跑是**取证**而非**仓内可重复断言**；E1 / X5 的销账都卡在这一条。

## Out of scope

- **真杀毒**（QUAL-2 / DEC-SCAN 已裁决现阶段 mock）——生产力/安全债，不在本图。
- **真模型**（Gateway live 判分 / live judge / 真向量 embed）：本机无可用 key；live ask 若因此拒答，本图如实记为阻塞方，**不**代签、**不**伪造引用。
- **人签**（B10-followup 业务签字 · RACI 具名签字）——非本机可代。
- **IK 生产集群 / 生产多活 / 盘上加密全绿 / 生产 IdP**。
- **admin / web 的视觉与交互改动**（本机无浏览器）。
