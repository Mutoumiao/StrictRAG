# 真中间件栈的证据化（把「未验证」变成「本机可复现」）

Label: wayfinder:map
Status: claimed（前沿：工单 01 起）

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

## Decisions so far

<!-- 索引：一行一票，票里存细节 -->

## Not yet specified

- `IK` 中文分词在真 ES 上的**装与不装**分别意味着什么：compose 用的是 vanilla ES 8.15.3（无 IK 插件），`sparseText` 是 `text` 无显式 analyzer → 走 `standard`。真跑能不能命中、命中质量如何，是工单 05 的直接产物；由此派生「IK 到底是不是 B8 必达」这一裁定的可判性。
- 多租户**独立索引**（vs 现在的单索引 + `tenantId` filter）：这是 B8 的另一半，本图先把「单索引 + filter」真跑，独立索引另裁。
- 真 ES 上 `aclPrincipals` 的 `__acl_none__` 哨兵与 `exists` 语义（此前只在 mock 上验过）。
- 真 RustFS 的 `ensureBucket` / presign 路径在 compose 里是否真能 PUT（`STORAGE_MODE=s3`）。
- Mongo 正文链路（`document_bodies`）在真 Mongo 上的 upsert / 读回。
- 孤儿清理（簇 36）与自动 reindex（簇 37）在真栈上是否**只差调度基建**——若真跑证明「业务逻辑已对、只差 cron」，那是另一张图的活；本图只负责把「差什么」钉死。

## Out of scope

- **真杀毒**（QUAL-2 / DEC-SCAN 已裁决现阶段 mock）——生产力/安全债，不在本图。
- **真模型**（Gateway live 判分 / live judge / 真向量 embed）：本机无可用 key；live ask 若因此拒答，本图如实记为阻塞方，**不**代签、**不**伪造引用。
- **人签**（B10-followup 业务签字 · RACI 具名签字）——非本机可代。
- **IK 生产集群 / 生产多活 / 盘上加密全绿 / 生产 IdP**。
- **admin / web 的视觉与交互改动**（本机无浏览器）。
