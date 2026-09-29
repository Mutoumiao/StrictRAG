# 全仓剩余迷雾清点（2026-09-23）

> **性质**：跨图的**导航索引**，不是第二套状态 SSOT。雾的正文仍在各图 `map.md` 的 `Not yet specified` / `Out of scope`。
> **用途**：立下一张图时先读本文挑目的地，避免重扫 9 张图。
> **口径**：9 张图的**前沿全部为空**；下表是清点后聚类的结果（38 簇，同缺口多图点到已合并）。**离线可做**一栏指「只靠读源码 + 写纯函数 + 补测例 + 回写文档，在本机能做完」。
>
> **清点后的动向**（2026-09-23 追加，2026-09-24 更新）：簇 4 + 5 + 2 的 L1 侧已由 [`l1-signoff-evidence`](./l1-signoff-evidence/map.md) 收口；簇 1 已由 [`l2-report-determinability`](./l2-report-determinability/map.md) 收口；**簇 31 里的「16 行 Then ↔ 源码不一致」已由 [`acceptance-divergence`](./acceptance-divergence/map.md) 收口**（7 行判 `已测` · 9 行保留 `部分测` 并写明销账条件 · 8 条 ADR-ready 裁定书 · 一处源码对齐 ADR-033）。三张图均**只在本分支**推进、不带 worktree。**簇 31 剩下的部分**（覆盖表另有 59 行 `部分测`，含 16 行名单之外的同族行）仍空着。

> **2026-09-29 追加（wayfinder 图 [`real-stack-evidence`](./real-stack-evidence/map.md)）**：本图挑的是**「不能（离线不可做）」这个前提本身**——本机 **Docker Desktop 可用**（此前九张图的口径是「Docker / 真 PG / 真 ES 均不在」），于是把簇 **23 / 24 / 36 / 37** 拿去验。结论：**簇 23 已解**（真 PG 从零 apply 23/23、`db:generate` 零漂移）；**簇 24 部分解**（真 ES 8.15.3 上建索引 / mapping / bulk / 中文检索 / `aclPrincipals` 三态与查询期收窄全部真跑通过；**IK 不是「能命中」的必要条件**，它只影响分词粒度与排序质量；多租户**独立索引**仍未动，单索引 + `tenantId` filter 路线真跑正常）；**簇 36 仍是「不差业务逻辑、只差调度基建」**（真跑未改变该判断，本仓确无 cron/Repeat）；**簇 37 收窄**（「自动 reindex」已裁为人工触发，剩「真 ES 上 reindex 覆盖旧 principals」半截，本图未做）。**顺带解出两处只在真集群现形的源码缺陷**（ES bulk 不等刷新 → 误红 `ES_RECONCILE_FAILED`；`smoke:half` 撞 ADR-048 四眼闸），并新增簇 **39**（见下表）。证据：[`docs/ops/real-stack-evidence.md`](../docs/ops/real-stack-evidence.md)。

## 汇总表

| # | 簇 | 挡谁 | 离线可做 | PRD 依据 | 出处（图） |
|---|----|------|:--------:|----------|-----------|
| 1 | L2 报告采集面（丢 `evidence_snapshot.docId`）与零容忍判据（四项里只有一项进过机械判定，且比 PRD 窄） | P2.5 L2 准出 | 采集面能；真判定不能 | 08-quality §6.2 | quality-gate-parity · p3b-doc-acl |
| 2 | L1/L2 报告 §8 可复现字段（14 类基本不存在） | 不挡本句；挡 §7 再认证的可核对性 | 能 | 08-quality §8（+§7） | quality-gate-parity |
| 3 | §6.0 运行时读取签字包（τ 仍取 env，无「不一致即拒加载」入口） | 挡「加严包真实生效」；**须 ADR** | 不能 | 08-quality §6.0 ↔ ADR-007 冲突 | quality-gate-parity · close-p2-exit-gaps |
| 4 | 人工抽检登记面（全仓只有两个常量，无入口/无表/无字段） | L1 准出（七硬门之一） | 能建面；抽检动作须人 | 08-quality §6 | quality-gate-parity |
| 5 | 校准规模（夹具 8 条 vs PRD ≥100）与打分器接线（生产入口不接） | L1 准出（AUROC 真实路径不可达） | 扩集/接线能；真判分不能 | 08-quality §4 | quality-gate-parity |
| 6 | QUAL-2 真杀毒（今天 `mock_scan`） | 生产上线；不挡开发主线 | 不能 | 交付剧本 M · DEC-SCAN | fill-must-haves · close-p2-exit-gaps · p2-exit-evidence |
| 7 | P2.5 准出（L2 须 live 真跑 + 人签） | rewrite/session 默认开 与 P3a | 不能 | 10-delivery 路线图 · 08-quality §6.1/§6.2 | 五张图 Out of scope |
| 8 | `CorpusLoader` 未传 tenantId（检索侧从文档行反推） | 不挡；工程债 | 能（回归面较大） | 未核实（PRD 未明写） | p3b-doc-acl · p3b-principal-forms · quality-gate-parity |
| 9 | `DEPT_INHERIT_DOWN` 关继承时「库级文档」语义 | 不挡；须 PRD 补行才销账 | 口径定后能补测 | PRD 未明说（ADR-057） | p3b-doc-acl · p3b-principal-forms · quality-gate-parity |
| 10 | grant 写审计是否落表（今天只有 Pino） | P3b 出口 AE7 行 | 能（先裁是否落表） | 交付剧本 AE7 · ADR-057 | p3b-doc-acl · p3b-principal-forms · quality-gate-parity |
| 11 | `loadVisibilityContext` 请求级缓存 | 不挡；性能债 | 能 | PRD 未写 | p3b-doc-acl · p3b-principal-forms · quality-gate-parity |
| 12 | 角色 principal / `role:` 主体 | 不挡（已裁不做，且属放宽方向） | 能但收益 0 | ADR-057 §5 | kb-role-vs-code · p3b-* |
| 13 | `kb_members.role` 完整性债（无 CHECK / 读取侧 cast / 无 parse） | 不挡；债 | 能 | ADR-035 §决策 5/7（未销账） | kb-role-vs-code |
| 14 | `GET …/ingest-jobs` 暴露面粒度（成员即可读全量账本） | 不挡；产品取向 | 能（若裁收紧） | 05-api（未核实节） | doc-read-member-gate · kb-role-vs-code |
| 15 | 404/403 存在性探测面 | 不挡；须裁代价 | 能（会改 404 语义） | ADR-035 §决策 4 | doc-read-member-gate · kb-role-vs-code |
| 16 | `allowedDocIds` 无生产者（准入 = 先指名生产者） | 不挡 | 能但先要有生产者 | ADR-009 决策 3 · 05-api §2.2 | close-p2-exit-gaps · fill-must-haves |
| 17 | `pending_review` 的 admin 审阅面（端点 + DTO 已齐，缺控件） | 不挡 | 能（RTL） | 功能表 §4.3 | close-p2-exit-gaps · p2-exit-evidence |
| 18 | embed TPM / 堆积告警（R6-b） | 不挡（已划出） | 不能（PRD 无计数口径） | ADR-044 · 04-pipelines | close-p2-exit-gaps |
| 19 | 真 Langfuse 读取面 | 不挡；准入 = 接真 SDK | 不能 | 08-quality §Langfuse | close-p2-exit-gaps |
| 20 | `downrank` 跨 doc 去重动作 | 不挡；设计未成形 | 能但设计未成形 | 04-pipelines §5.1 | close-p2-exit-gaps |
| 21 | admin 站规清扫（原生 `<select>` 约 24 处） | 不挡 | 不能（视觉回归不可验） | 仓内站规（spec） | 四张图 |
| 22 | `drizzle/meta` 类型/默认值级人工走查 | 不挡 | 能 | 无（工程债） | fill-must-haves · close-p2-exit-gaps · p2-exit-evidence |
| 23 | 迁移未经真 PG apply 验证 | **已解（2026-09-29）** | 能（本机 Docker 可用） | 无 | migration-default-parity · 多图 · real-stack-evidence |
| 24 | B8 真 ES+IK / 多租户独立索引 | P3b 部门隔离全文与生产话术 | **部分解（2026-09-29）**：真 ES 路径真跑通；IK 非命中必要条件；独立索引未动 | 03-data ES PRD | 多图 Out of scope · real-stack-evidence |
| 25 | B9 真 RustFS / Mongo 正文 | 生产；不挡半产品 | 不能 | 03-data | 多图 Out of scope |
| 26 | LangGraph 编排重构（现为线性状态机） | 不挡语义；架构路线 | 能（回归面极大） | 01-architecture 技术栈 | fill-must-haves |
| 27 | P3a Full 图（CRAG / multi_hop） | P3a | 不能（硬门在 L2 人签） | 10-delivery 路线图 | 多图 Out of scope |
| 28 | P4/P5 其余（τ* 接运行时 · live judge 真跑 · 独立入队 · Grafana · 真 OCR…） | P4/P5 | 不能 | 10-delivery 路线图 | 多图 Out of scope |
| 29 | 门禁口径差（L2 规模 15 vs 建议 30～50 · `hitAtKCase` 的 k 语义 · §1 不可答下限 · `l1RerunBound` 回退 · `sessionEnabledDefault` 出口未冻） | 不挡；要动先裁 | 多数能，但须先裁 | 08-quality §1/§3/§6 | quality-gate-parity |
| 30 | S6：admin 菜单按当前 KB 角色裁剪（`/auth/me` 无 `byKb`） | 不挡；产品/契约决定 | 能（须裁，涉契约变更） | 09-security / ADR-056 | p2-exit-evidence |
| 31 | 覆盖表余量（约 76 行部分测，其中 16 行源码与 Then 不一致） | 不挡；先裁哪侧错 | 部分 | 交付剧本全集 | p2-exit-evidence · close-p2-exit-gaps |
| 32 | 两处镜像不在版本库（`/prds` 与 `.trellis/tasks/` 被 gitignore） | 不挡；所有者决策 | 能但须所有者决定 | 无 | p2-exit-evidence |
| 33 | 敏感语料入池 | P3b 之后安全另签 | 不能 | 10-delivery 路线图 | p3b-doc-acl · p3b-principal-forms |
| 34 | 在线编写完整体验（`editor-draft` + BlockNote）· admin 文档 ACL 编辑面 | 不挡；P2.x | 能但落点/选型未冻 | 功能表 §4.3/§5.2 | fill-must-haves |
| 35 | 缺前置小项（「高度重复」阈值 · L0 vs L1 Hit@k 载体 · 魔数嗅探） | 不挡；各缺前置 | 不能 | 03-data（阈值未写）· ADR-053 | fill-must-haves |
| 36 | 孤儿清理周期调度 | 不挡；缺调度基建 | 不能 | 03-data 存储边界 §2.4 | close-p2-exit-gaps |
| 37 | 自动 reindex-on-tighten / dense 反向构造（B2-3 剩余） | 不挡 | **仍不能（但阻塞方已精确）**：「自动 reindex」已裁为人工触发，剩「真 ES 上 reindex 覆盖旧 principals」半截，须真 PG/ES | ADR-009 决策 4 · ES PRD §4.3 | fill-must-haves · p3b-doc-acl |
| 39 | **半产品端到端「问答」段不可复现**（无 Gateway 时 `smoke:half` 末步必失败；`GATEWAY_MODE=http` 要求上游同时提供 chat + embeddings + **rerank** 三契约，而常见本地模型服务只给前两条，也不提供 `/rerank`） | 「第三人拉起 → 问答」这条 DoD；不挡 P2 签字（签字另需真模型与人签） | 能建（须先裁：**是否允许**一个 dev-only 的 JSON 桩 Gateway / 本地适配器），**或**如实记为环境前置 | 05-api · 07-models（Gateway 契约）· `docs/ops/half-smoke.md` | real-stack-evidence |
| 38 | 迁移 0015 历史回填值真伪（`0` / `'[]'` 替历史行断言「无重复」） | 不挡 | 不能（改可空须 ADR） | 03-data schema | migration-default-parity |

## 挑目的地时的三条读法

1. **最集中的离线可推进块**：簇 1（L2 采集面）+ 簇 2（§8 字段）+ 簇 4/5（人工抽检 / 打分器接线）——都是「读源码 + 写纯函数 + 补测例 + 回写」的形态，只在**真判定**一步依赖真模型。**本图（`l1-signoff-evidence`）挑的是簇 4 + 5 + 2 的 L1 侧**；簇 1 的 L2 侧仍空着，是下一张图的首选。
2. **被多图反复点到 ≠ 新雾**：簇 6/7/24/25 被 4–5 张图点名，全部是「业务外依赖」（真引擎 / 真集群 / 真模型 / 人签），已被各图显式划出，不要在实现型图里顺手做。
3. **须先裁再动的一类**：簇 3、9、20、29、30、38 都撞「改冻结语义须 ADR」或「两侧口径各有理由」。**不要**与实现型簇混在同一张图——要么单独开裁定图，要么留在雾里。
