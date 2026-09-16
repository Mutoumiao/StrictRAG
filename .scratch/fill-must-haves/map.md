# 按功能表补全必须具备

Label: wayfinder:map
Status: open

## Destination

从当前仓库现状出发，按 `prds/12-delivery-guides/14-模块需求功能表.md` 把各运行时模块的 **必须具备** 缺口补完，覆盖该表最终产品范围（P0–P5 入场项，含 P2.5 rewrite 出口、P3a Full 图、P3b 文档 ACL / 部门强制、P4 门禁包、P5 OCR）。本图携带执行。齐的口径按入场分层：该阶段先把产品语义做齐；换生产默认（B8 真 ES+IK、B9 真 RustFS、QUAL-2 真杀毒）是后续基础设施缺口，不挡更早阶段的语义行。

## Notes

- 域：StrictRAG。WHAT 冲突以 `prds/00–11` 为准；功能表是派生阅读件，不是接口契约。IS 以源码为准，`docs/module-status/` 是镜像。术语用功能表与 `prds/00-product/03-glossary.md`（必须具备、入场、拒答、双闸门、session 壳、rewrite 等）。不要为了缺文件去建 `CONTEXT.md` / `docs/adr/`。
- 每轮先读：本图、`docs/agents/issue-tracker.md`、`docs/agents/domain.md`、功能表、相关包的 `docs/module-status/`。写代码前读 `.trellis/spec/` 对应包。执行完成后跑 skill `update-module-status`。
- **覆盖「只做决策」**：工单可以动手补缺口，不只锁决策。
- **本图是执行面**：缺口只在 `.scratch/fill-must-haves/` 工单上做完。`.trellis/tasks/08-06-project-backlog/` 只留指针和勾选。同一缺口禁止再 `task.py create` 平行实现任务。这只覆盖本图，不改全仓其它流程。
- 顺序：本图 P2 语义已收官（第三批）；P2.5 出口走 **L2 归档准出**（工程路径 [L2 归档底线](./issues/14-l2-archive-floor.md) 已齐，人签仍图外）。鉴权/成员余量、入库报告、库选择器、admin 顶栏、web 关闭列表、启动引导超管、写路径锁超管全码、修改日志、三平面配额、失败 Webhook 已齐。P3b 可动手最小闭环已齐。P4 可动手代码真空已尽。P5 OCR 开闸与历史 `needs_ocr` 运营重跑已齐（默认关）；**P5 可动手代码真空已尽**。暂停已解除；在线编写最小闭环已齐（无 BlockNote）。生效区间最小闭环已齐。替代联动最小闭环已齐。删除与 purge 最小闭环已齐。文档类型成员面最小闭环已齐。上传 MIME 白名单最小闭环已齐。类型分区 CRUD 最小闭环已齐。上传表单标部门最小闭环已齐。KB 消费绑定最小闭环已齐。同 KB 跨文档去重最小闭环已齐。L0 模板 / contextMode 单控件最小闭环已齐。反馈回流黄金集最小闭环已齐。本轮裁定三张串行：[禁自审四眼](./issues/86-no-self-approve-min.md) **已齐** → [角色树状勾选](./issues/87-role-permission-tree-min.md) **已齐** → [分片策略服务端修改日志](./issues/88-chunk-strategy-audit-min.md) **已齐**。新一批三张串行：[文档策略快照只读](./issues/90-doc-strategy-snapshot-readonly.md) **已齐** → [citation chunk 级去重](./issues/91-citation-dedupe.md) **已齐** → [断线按 requestId 重拉终态](./issues/92-ask-requestid-replay.md) **已齐**（含前置：`ask_traces.citations` 落库 + migration `0017`）。本批（[裁定 98](./issues/98-after-96-order.md)）三张串行：[lint 门禁清零](./issues/99-lint-zero-warnings.md) **已齐** → [文档 ACL 端点](./issues/100-doc-acl-endpoint.md) **已齐** → [真 L1 contextualize](./issues/101-real-l1-contextualize.md) **未开工**。**孤儿清理与签字包链已撤销排序**（各缺一个前置：见 Notes 尾）。P3a 仍等 L2 人签。不默认开 `DEPT_ACL_ENFORCE`。不加角色 principal。不默认开 OCR。不自动全库重跑。
- **站规（UI）**：web / admin 新下拉必须基于 `@strict-rag/ui` 关闭列表，禁止浏览器原生 `<select>` 外壳（含现有 ui `Select`）。`Button` / `Input` / `Textarea` 仍走 ui 包。本规不改 GET / 鉴权语义。

## Decisions so far

- [盘点 P2 必须具备缺口](./issues/01-inventory-p2-must-haves.md) — P2 语义主路径大体齐；缺口在建库/Reindex/策略三层/评测 HTTP/引用回溯/空库 409 与 web 档位空态。全文 [inventory-p2.md](./inventory-p2.md)。
- [裁定第一批 P2 执行顺序](./issues/02-first-p2-execution-order.md) — 按能力切；第一批只做空库拒答对齐 200 与建库闭环（并行前沿，编号先取空库）；第二批 grilling 等这两张都完成。
- [空库拒答对齐 200](./issues/03-align-kb-not-ready-200.md) — 空库 ask 同步+SSE 改为 200 + `abstained` + `kb_not_ready`；web 走拒答卡；08-06 只留指针。
- [建库闭环](./issues/04-create-kb-closed-loop.md) — 建库必填首位库管并写入成员；租户令牌覆盖；admin 顶栏入口。
- [裁定第二批 P2 执行顺序](./issues/05-second-p2-execution-order.md) — 第二批只做策略三层最小闭环 → 文档运营余量最小闭环（真实挡住）；第三批 grilling 等这两张都完成。
- [策略三层最小闭环](./issues/06-strategy-three-layer-min.md) — 两张表 + catalog/for-upload + 设置启用/recommended + 上传人选 + 参数快照。
- [文档运营余量最小闭环](./issues/07-document-ops-remainder-min.md) — Reindex 人选、类型列+PATCH、双轴运营标签、archived/superseded。
- [裁定第三批 P2 执行顺序](./issues/08-third-p2-execution-order.md) — 四块全收串行：检索补钉→ask 审计→web 消费→评测；未进 §6 半接线与前批明确不做全划出；LangGraph 硬性标准、源码需重构。
- [检索语义补钉](./issues/09-retrieval-semantics-patch.md) — ES 查询期 tenantId+kbId、sparse_unavailable、档位 retrieveK 60/10、Mongo chunk_bodies 批取；dense 查询期 WHERE / 生效区间 / 召回扩展划出。
- [ask 审计与引用](./issues/10-ask-audit-citations.md) — `GET /ask/:requestId` 成员闸回读当时 evidence_snapshot + graph_trace；web 引用点回快照；断线重拉 / 审计管理台 / Langfuse SDK 划出。
- [web 消费余量](./issues/11-web-consumption-remainder.md) — 档位读 ask-modes 并传 mode；无库空态阻断；建议动作主按钮；429 配额文案；反馈报错/缺文档。库选择器只列成员库 / 在线编写划出。
- [评测底线](./issues/12-eval-floor.md) — gold-questions CRUD + admin `/eval`；`POST eval/runs` 入队 `sr-eval`；worker 跑 L1；GET 回读 2×2。回流黄金集 / 签字包 / 看板 / 多模型 fallback / 在线抽样划出。
- [裁定 P2 收官后下一步](./issues/13-after-p2-close-order.md) — 第三批即 P2 语义收官；出口走 L2 归档准出；下一张只做 L2 归档底线。剩余 P2 半接线留雾；人签 / 默认开 rewrite / 永久关不进执行。
- [L2 归档底线](./issues/14-l2-archive-floor.md) — HTTP 入队 session_multiturn + worker 多轮窗 + admin 跑 L2；工程 signoffEligible；未归档禁止默认开 rewrite。准出人签 / 默认开 / 连续追问 UI 划出。
- [裁定 L2 归档底线后下一步](./issues/15-after-l2-floor-order.md) — 继续补 P2.5 剩余必须具备；本批串行 web 连续追问消费 → L3 自动熔断。不回补 P2 半接线、不转 P3b、不等人签。
- [web 连续追问消费](./issues/16-web-multiturn-consumption.md) — `coref_unresolved` 拒答卡 + 主按钮「用完整问题重述」回填不重发；禁止宣传连续追问 / 准出。
- [L3 自动熔断](./issues/17-l3-auto-fuse.md) — 三 kind 闩后进程内关 rewrite 路径；`rewrite_dogfood` 不熔；不写 env / 窗 / 面板。
- [裁定 L3 自动熔断后下一步](./issues/18-after-l3-fuse-order.md) — 回头收剩余 P2 半接线；本批串行鉴权路径与成员 PUT → 末位超管前端提示。不转 P3b、不跳 P4、不等人签。
- [鉴权路径与成员 PUT](./issues/19-authz-path-and-member-put.md) — `GET /me/permissions` 与 `/auth/me` 同源；PUT members 只改 `role`；admin 可改角色；无 `allowedDocIds`。
- [末位超管前端提示](./issues/20-last-superadmin-hint.md) — 用户页唯一 active 超管禁用/剥超管角色不可点并出说明；API 400 闸不改。
- [裁定末位超管前端提示后下一步](./issues/21-after-last-superadmin-order.md) — 继续剩余 P2；本批只做入库报告最小闭环。不转 P3b、不跳 P4、不等人签。
- [入库报告最小闭环](./issues/22-ingest-report-min.md) — worker 落可查询报告；库级 GET；admin 文档行展开；只写真事。
- [裁定入库报告最小闭环后下一步](./issues/23-after-ingest-report-order.md) — 继续剩余 P2；本批只做库选择器只列成员库。不转 P3b、不跳 P4、不等人签。
- [库选择器只列成员库](./issues/24-kb-picker-members-only.md) — web 原生下拉只列本次 GET 可见库；空态开通成员；失败重试无输入；脏缓存不采用。
- [裁定库选择器只列成员库后下一步](./issues/25-after-kb-picker-order.md) — 继续剩余 P2；本批只做 admin 顶栏当前 KB 选择器。站规：新下拉必须用 ui 关闭列表。web 回改另张。不转 P3b、不跳 P4、不等人签。
- [admin 顶栏当前 KB 选择器](./issues/26-admin-kb-picker.md) — ui `ClosedSelect` + admin 顶栏只列本次 GET；禁止粘贴；空态/失败/未选中三套文案；脏缓存不采用；建库成功选中新建库。web 回改仍是下一张。
- [web 下拉换 ui 关闭列表](./issues/27-web-select-ui-library.md) — web 知识库与档位改用同一 `ClosedSelect`；过滤/空态/失败/脏缓存语义不变。
- [裁定 web 下拉换 ui 关闭列表后下一步](./issues/28-after-web-select-order.md) — 继续剩余 P2；本批只做启动引导超管（env 创建，不是页）。不转 P3b、不跳 P4、不等人签。
- [启动引导超管](./issues/29-superadmin-bootstrap.md) — listen 前对默认租户 upsert `permission_definitions`、超管角色写成 catalog 全码、无 active 超管按 env 创建或缺则失败。不是引导页、不是密码登录。
- [裁定启动引导超管后下一步](./issues/30-after-superadmin-bootstrap-order.md) — 继续剩余 P2；本批只做写路径锁超管全码。不转 P3b、不跳 P4、不等人签。
- [写路径锁超管全码](./issues/31-lock-superadmin-full-codes.md) — PUT/PATCH 改少 `super_admin` 绑码 400；全码幂等 200；admin 角色页勾选/保存不可点。
- [裁定写路径锁超管全码后下一步](./issues/32-after-superadmin-codes-lock-order.md) — 继续剩余 P2；本批只做修改日志最小闭环。不转 P3b、不跳 P4、不等人签。
- [修改日志最小闭环](./issues/33-settings-audit-min.md) — PATCH 有 diff 落 `kb_settings_audits`；GET settings-audit 可查询；admin 设置页一节。ARCH-P1b-2 仍是 Pino、不落表。
- [裁定修改日志最小闭环后下一步](./issues/34-after-settings-audit-order.md) — 继续剩余 P2；本批只做三平面配额最小闭环。不转 P3b、不跳 P4、不等人签。
- [三平面配额最小闭环](./issues/35-quota-planes-min.md) — ask/ingest 分 store 固定窗口（默认 0=关）互不阻断；ask 触顶 429 `RATE_LIMITED` + `ask_quota_exhausted`；指标带 `plane`；aux 只留常量。embed TPM / maxEmbedCalls / staging fail-closed 划出。
- [裁定三平面配额最小闭环后下一步](./issues/36-after-quota-planes-order.md) — 继续剩余 P2；本批只做失败 Webhook 最小闭环。在线编写仍 P2.x。不转 P3b、不跳 P4、不等人签。
- [失败 Webhook 最小闭环](./issues/37-ingest-failure-webhook-min.md) — env 可选 URL，空不发；`recordStageEnd` 失败 POST `ingest.failed` JSON 一次；超时约 3s；失败 warn 不阻断。HMAC / 重试队列 / admin 页 / ask webhook 划出。
- [裁定失败 Webhook 最小闭环后下一步](./issues/38-after-ingest-webhook-order.md) — 在线编写留雾（P2.x）；转向 P3b；本批只做 ES 查询期部门对称。不默认开强制、不解禁。
- [ES 查询期部门对称最小闭环](./issues/39-es-dept-query-filter-min.md) — mapping/bulk 写可选 `ownerDeptId`；enforce 开且非超管 ES terms 收窄；关或超管仍只 tenantId+kbId；PG 可见级闸保留。默认仍关强制。
- [裁定 ES 查询期部门对称后下一步](./issues/40-after-es-dept-filter-order.md) — 在线编写留雾；继续 P3b；本批只做 aclPrincipals 全文最小闭环。不默认开强制、不解禁、不跳 P4、不等人签。
- [aclPrincipals 全文最小闭环](./issues/41-acl-principals-min.md) — 可空用户 uuid 数组；null=成员可读；`[]`=非超管不可读；列表/详情/chunks/retrieve 同滤；不跟部门强制。无角色码 / 无 ES terms / 无默认开。
- [裁定 aclPrincipals 全文最小闭环后下一步](./issues/42-after-acl-principals-order.md) — 在线编写留雾；继续 P3b；本批只做 ES 查询期 principals 对称。不默认开强制、不解禁、不加角色码、不跳 P4、不等人签。
- [ES 查询期 principals 对称最小闭环](./issues/43-es-principals-query-filter-min.md) — mapping/bulk 写 keyword；null 不写；`[]` 写哨兵；非超管 should 收窄；不跟部门强制。PG 闸保留。无角色码 / 无默认开。
- [裁定 ES 查询期 principals 对称后下一步](./issues/44-after-es-principals-order.md) — 在线编写留雾；继续 P3b；本批只做敏感解禁。不默认开强制、不加角色码、不跳 P4、不等人签。
- [敏感解禁最小闭环](./issues/45-sensitive-complete-unlock-min.md) — sensitive complete 须 ACL 就绪：部门路径或显式名单（含 `[]`）；`null` 仍挡。complete 可同写名单。无默认开 / 无角色码。
- [裁定敏感解禁后下一步](./issues/46-after-sensitive-unlock-order.md) — 在线编写留雾；P3b 可动手闭环已齐，默认开强制与角色 principal 仍锁；转向 P4；本批只做 L1 Hit@k。不等人签。
- [L1 Hit@k 最小闭环](./issues/47-l1-hit-at-k-min.md) — 有非空 `expectedDocIds` 按 evidence `docId` 交集计 Hit@k；不改 2×2 / `signoffEligible`。脏名单抛错。逻辑 id 映射仍缺口。
- [裁定 L1 Hit@k 后下一步](./issues/48-after-l1-hit-at-k-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做 L1 τ 扫描。不写 env、不新开 `tau_sweep` 入队。
- [L1 τ 扫描最小闭环](./issues/49-l1-tau-sweep-min.md) — 按 minSupport 离线扫网格得 tau*；无分数不得写成网格上沿。不改 2×2 / `signoffEligible`、不写 env。
- [裁定 L1 τ 扫描后下一步](./issues/50-after-l1-tau-sweep-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做 Judge AUROC。不用黄金题型当 label、不新开 `verifier_calib` 入队。
- [Judge AUROC 最小闭环](./issues/51-l1-judge-auroc-min.md) — 独立校准集 Mann-Whitney 得 judgeAuroc；无打分器或单类为 null。不改 2×2 / `signoffEligible`、不接 `judgeAurocMin`。
- [裁定 Judge AUROC 后下一步](./issues/52-after-l1-judge-auroc-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做 generate fallback。不做再认证 / 双轨看板 / 数据面板。不加 `GENERATE_MIN_NODES`。
- [generate 多模型 fallback 最小闭环](./issues/53-generate-fallback-min.md) — 绑定 generate fallbacks 运行时 opt-in 切链；切到备用才 `fallbackUsed=true`。无 `GENERATE_MIN_NODES`；图层不二次计费。
- [裁定 generate fallback 后下一步](./issues/54-after-generate-fallback-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做双轨看板。不做再认证 / 数据面板增强。不改 B6 信封。
- [双轨看板最小闭环](./issues/55-dual-dashboard-tracks-min.md) — 独立 tracks GET；质量=最近一笔 L1 工程账本；延迟=24h avg/p95。不改 B6 summary。≠ APM / ≠ 准出。
- [裁定双轨看板后下一步](./issues/56-after-dual-dashboard-order.md) — P4 可动手真空已尽；在线编写留雾；P3b 站规仍锁；不暂停；转向 P5；本批只做 OCR 开闸。不默认开、不加真引擎。
- [OCR 开闸最小闭环](./issues/57-ocr-gate-min.md) — `INGEST_OCR_ENABLED` 默认关；逻辑 stage `ocr`；可注入抽取器；低置信 `needs_review` 且不留可 chunk 正文。无真引擎。
- [裁定 OCR 开闸后下一步](./issues/58-after-ocr-gate-order.md) — 在线编写留雾；P3b 站规仍锁；不暂停；继续 P5；本批只做历史 needs_ocr 重跑。不默认开、不加真引擎、不自动全库。
- [历史 needs_ocr 重跑最小闭环](./issues/59-ocr-rerun-min.md) — 现有 reindex 对卡在 OCR 闸的扫描件入队 `ocr`；短 utf8 不洗；失败不抬 version。无真引擎 / 无自动全库。
- [裁定历史 needs_ocr 重跑后下一步](./issues/60-after-ocr-rerun-order.md) — P5 可动手真空已尽；本图暂停执行，等 L2 人签或真 OCR 引擎选型。无本批执行工单。
- [裁定暂停后继续走哪条](./issues/61-after-pause-continue-order.md) — 用户继续即解除暂停；本批只做在线编写最小闭环。无 BlockNote / 无草稿 HTTP / 不跳过审批。
- [在线编写最小闭环](./issues/62-online-write-min.md) — Markdown write 进 pending；闸在落库前；无 BlockNote / 不入队 scan。
- [裁定在线编写后下一步](./issues/63-after-online-write-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做生效区间最小闭环。
- [生效区间最小闭环](./issues/64-effective-window-min.md) — 默认检索叠窗口；PATCH 可写；admin 可填。无 DELETE / 无 dense WHERE / 无 ES terms。
- [裁定生效区间后下一步](./issues/65-after-effective-window-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做替代联动最小闭环。
- [替代联动最小闭环](./issues/66-supersede-link-min.md) — POST supersede 写两列；后继升 active；旧文关默认检索。无 DELETE / 无三存对齐。
- [裁定替代联动后下一步](./issues/67-after-supersede-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做删除与 purge 最小闭环。
- [删除与 purge 最小闭环](./issues/68-document-delete-purge-min.md) — DELETE 先 archived 再入队 purge；worker 清对象与 mock ES。PATCH archived 不入队。无 PG 硬删 / 无 HTTP ES。
- [裁定删除与 purge 后下一步](./issues/69-after-delete-purge-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做文档类型成员面最小闭环。
- [文档类型成员面最小闭环](./issues/70-doc-types-member-surface-min.md) — 成员 GET /doc-types；类型收窄空集 `no_docs_in_scope`；web ClosedSelect。无类型分区 CRUD / 无 ES terms。
- [裁定文档类型成员面后下一步](./issues/71-after-doc-types-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做上传 MIME 白名单最小闭环。
- [上传 MIME 白名单最小闭环](./issues/72-upload-mime-whitelist-min.md) — complete/upload-url/PUT 拒未知 MIME 与 octet-stream；checksum 落库/比对。无魔数嗅探 / 无 MD/TXT 更严体积。
- [裁定上传 MIME 白名单后下一步](./issues/73-after-mime-whitelist-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做类型分区 CRUD 最小闭环。
- [类型分区 CRUD 最小闭环](./issues/74-doc-type-catalog-min.md) — PATCH settings catalog `{code,label,sort,enabled}`；GET /doc-types 只回启用项真 label。无新表 / 无上传标部门。
- [裁定类型分区 CRUD 后下一步](./issues/75-after-doc-type-catalog-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做上传表单标部门最小闭环。
- [上传表单标部门最小闭环](./issues/76-upload-dept-fields-min.md) — 创建面 ClosedSelect 标部门/可见级；complete/write 带字段。无强制必填 / 无默认开强制。
- [裁定上传表单标部门后下一步](./issues/77-after-upload-dept-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做 KB 消费绑定最小闭环。
- [KB 消费绑定最小闭环](./issues/78-kb-consume-bindings-min.md) — PUT 只 generate/embed/rerank；设置页三档 ClosedSelect。无再认证 / 无改 judge。
- [裁定 KB 消费绑定后下一步](./issues/79-after-kb-consume-bindings-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做同 KB 跨文档去重最小闭环。
- [同 KB 跨文档去重最小闭环](./issues/80-cross-doc-dedupe-min.md) — 同库近重复默认 skip_index；报告写冲突对。无 pending_review / 无生产 LSH。
- [裁定跨文档去重后下一步](./issues/81-after-cross-doc-dedupe-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做 L0 模板真用快照 / contextMode 单控件最小闭环。
- [L0 模板真用快照 / contextMode 单控件最小闭环](./issues/82-l0-context-mode-min.md) — worker 服从快照写 L0 prefix；l1_llm 本轮 l0_fallback。无真 L1 / 无表单引擎。
- [裁定 L0/contextMode 后下一步](./issues/83-after-l0-context-mode-order.md) — 不选余量/真引擎/解锁站规/暂停/P4 雾；本批只做反馈回流黄金集最小闭环。
- [反馈回流黄金集最小闭环](./issues/84-feedback-promote-gold-min.md) — 队列纳入写 gold_questions；须 goldType + eval.run。无 gold.yaml / 无自动入队评测。
- [裁定反馈回流黄金集后下一步](./issues/85-after-feedback-promote-gold-order.md) — 本批串行三张：禁自审四眼 → 角色树状勾选 → 分片策略服务端修改日志；孤儿清理下一轮首张。缺口只在 `.scratch` 工单做。
- [提交者不可自审四眼最小闭环](./issues/86-no-self-approve-min.md) — complete / write 记 `uploaded_by`、approve 记 `approved_by`；自审 403 `FORBIDDEN` + `reason=self_approve_forbidden`（approve / reject 同口径，不写审批）；无 actor / 提交人未知不拦；列表项 `submittedBy`，admin 回显提交人。无 `allowSelfApprove` 开关。
- [角色与权限树状勾选最小闭环](./issues/87-role-permission-tree-min.md) — 角色页按 `MENU_TREE` 编 L1/L2 + 操作码；未挂菜单的码进「其他（未挂菜单）」仍可勾，测例钉死「每码仅出现一次」。不改码表 / 契约 / 鉴权语义。
- [分片策略保存写服务端修改日志最小闭环](./issues/88-chunk-strategy-audit-min.md) — PATCH 有 diff 落 `kb_settings_audits`（键 `chunkStrategy.<code>.<field>`，复用不新建表）；无 diff 不落；只动库启用表，旧文档版本与快照不变。
- [裁定分片策略审计后下一步](./issues/89-after-chunk-strategy-audit-order.md) — 本批串行三张：文档策略快照只读 → citation 去重 → 断线重拉。**撤销孤儿清理首位排序**（仓库无「激活 version」表示，硬做会删掉上一版可检索数据）与**签字包链**（`gatePackageId` / `effectiveAt` 唯一生产者写死 null，真实快照只落文件，无数据源）。两者各需一张决定工单。
- [文档绑定策略参数快照只读审计最小闭环](./issues/90-doc-strategy-snapshot-readonly.md) — 列表项增 `chunkStrategy` + `chunkStrategyParams`（只读，缺省 null）；admin 行展开「分片策略（历史，只读）」，未记录如实说未记录。不加写路径。
- [citation chunk 级去重最小闭环](./issues/91-citation-dedupe.md) — generate 段合法引用按 `chunkId` 去重保序，引用数与 `citationCount` 不再虚高；拒答判定不变。
- [断线按 requestId 重拉终态最小闭环](./issues/92-ask-requestid-replay.md) — 前置落 `ask_traces.citations`（jsonb，**无默认**：`NULL`=旧文未记录 / `[]`=当时零引用）+ migration `0017`；`toAskFinal` 重建终态（与在线**深等**，非近似）；`GET /ask/:requestId/final`（成员闸同审计口；不可同形 → `ready=false`，无 trace → 404）；`running` part 带本轮 id + 客户端自铸 `x-request-id`；web 断线**单次**重拉重挂（4xx 业务拒不重拉）。不做：起始标记 / `Idempotency-Key` / 轮询 / SSE 重连。
- **下一批候选（未裁定）**：见 `Not yet specified` 首条与「回归债 / 工程债」三条 —— 孤儿清理（前置：激活 version 表示）· 签字包链（前置：数据来源）· `Idempotency-Key`（PRD §2.7 铁律 6，断线场景的「还在跑 vs 不存在」）· `pnpm lint` 清零 · api 脆弱测例超时 · drizzle meta 基线缺失。
- [裁定断线重拉后下一步](./issues/93-after-92-order.md) — 本批串行三张：metrics `fallback` / `node_used` 维 → 入库报告 `dedupe_cross_doc_rate` → MD/TXT 更严体积档。**下调三个候选**：L0 vs L1 Hit@k（无「同文档两份可检索数据」载体，ADR-053 禁同 version 双索引）· `pending_review`（落点 / 端点 / KB 策略位三处未冻）· QUAL-G3（功能表无此行）。**admin 站规清扫虽无前置但不进本批**（无浏览器验证手段，24 处外壳替换视觉回归不可验）。魔数嗅探显式不做（PRD 无依据）；「高度重复」阈值显式不发明（数据 PRD 无定义）。下一批首选：真 L1 `contextualize`（无硬前置）+ 三条债。
- [metrics `fallback` / `node_used` 维最小闭环](./issues/94-metrics-fallback-node-dim.md) — `llm_call_total` 加 `fallback` 维（真值只取 Gateway `meta.fallbackUsed`；**失败拿不到 → `unknown`，不谎报 `false`**）；rerank 补 `rerank_node_used{provider,model}` / `rerank_fallback_used_total` / `rerank_fail_total{kind}`，**node = 本轮实际尝试的端点**（rerank 无 DB `ModelRef`），与调用级 `rerank_total` 两个口径。不做 P4 直方图 / 远端导出。
- [入库报告 `dedupe_cross_doc_rate` 最小闭环](./issues/95-ingest-report-dedupe-rate.md) — 口径 `crossDocDropped / (存活 + 文档内丢弃 + 跨文档丢弃)`（PRD 只给指标名，本仓钉公式）；**分母 0 → NULL 不写 0**；落库列（migration `0018`，无默认）+ DTO + api 原样回读 + admin 百分比展示（未记录就明说未记录）。不做「高度重复」阈值提示（数据 PRD 无定义）/ `pending_review` / `downrank` / 真 LSH。
- [MD/TXT 更严体积档最小闭环](./issues/96-md-txt-size-tier.md) — 新增 `INGEST_MAX_TEXT_FILE_BYTES`（**默认 10 MiB**，行为变更；0 = 关闭族级）；族判定复用 contracts `isTextIngestContentType`（与 MIME 白名单同表）；四个生效点（complete / write / PUT / upload-url maxBytes）全带族判定；族级 > 通用 → 启动即拒。**魔数嗅探显式不做**（PRD 无依据）。
- [api 脆弱测例超时热修最小闭环](./issues/97-flaky-test-timeout.md) — 体内 `await import(重模块)` 的集成式用例在并行负载下越过默认 5s（实测 6.3s）；`apps/api/vitest.config.ts` 显式 `testTimeout: 20_000` 并写明理由。只调超时预算，不动断言 / mock / 覆盖。
- [裁定 MD/TXT 体积档后下一步](./issues/98-after-96-order.md) — 本批三张：**lint 门禁清零（债）** → **文档 ACL 端点** `GET/PUT /documents/:docId/acl`（PRD 05 §2.4 冻结，判定/闸/ES 对称都已落，只缺口子）→ **真 L1 `contextualize`**（功能表 §6 P1；worker 已有 `embed-http` 同型先例；**仓库默认关**）。不做：admin ACL 编辑面 · reindex-on-tighten（**不是安全洞**）· dense 单路负向夹具 · 成员 `allowedDocIds` 面 · `Idempotency-Key`（需先研究）· drizzle meta 基线 · admin 站规清扫（无浏览器验证手段）。
- [lint 门禁清零最小闭环](./issues/99-lint-zero-warnings.md) — 逐处消除 4 个测试文件里的未使用绑定（`loadBodies` 形参 / `RedisMock` 构造形参 / `approve` 形参）；**未**放宽 eslint、**未**加 disable、**未**改断言。全仓 `pnpm lint` 现 8/8、零 warning。
- [文档 ACL 端点最小闭环](./issues/100-doc-acl-endpoint.md) — `GET/PUT /api/v1/documents/:docId/acl`（PRD 05 §2.4）：三态 `null`/`[]`/名单；GET 与详情**共用同一可见性判定**（把详情内联闸提为 `docReadDenied`，两处不再各写一遍）；PUT 用 `doc.editor`（同 PATCH 码）且**刻意不叠可见性闸**（否则 `[]` 文档谁都修不回来）。不做 admin 编辑面 / reindex-on-tighten（**不是安全洞**）。

## Not yet specified

- **断线重拉的残余面（工单 92 未做的部分)**：`ask_traces` 仍只在 **finalize 后**写（PRD §2.7 铁律 5），所以「这一轮还在跑」与「从来没有这一轮」在 API 层**不可辨**（都是 404）；真要区分要么加起始标记（会污染 `status`/审计口径），要么按 PRD §2.7 铁律 6 做 `Idempotency-Key`（未 finalize 前同 key 可重连、已 finalize 返回同一 DTO、**不得**开第二条并行图）。另：`status=ready` 但流里没有 final 的路径仍走原 error 兜底（R1），不自动重拉
- **孤儿清理（剧本 L7 / `ingest.maintenance`）**：存储边界 §2.4「必须」已冻（触发=周期 + 文档 failed、对象=单边有向量或 ES、护栏=**激活版永不删**、动作=PG 向量 + ES 双侧）。**前置未解**：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败后它指向失败版本而上一个可检索版本的数据仍在 → 今天没有「当前激活 version」可断言，硬做会误删。需先开一张决定工单钉表示（列 / 表 / 由 `status=ready` 快照派生）；触发=周期另依赖调度基建
- **签字包链**（功能表 §4.2）：**前置未解** —— `qualitySnapshot` 的 `gatePackageId` / `effectiveAt` 唯一生产者 `defaultQuality()` 写死 null，真实 ADR-046 快照只由 `scripts/run-l1-golden.ts` 落文件。需先钉数据来源（落库 / 由 `eval_runs` 派生）
- 剩余必须具备（本批已收齐 94/95/96）：`dedupe_cross_doc_rate` **已齐（95）**· metrics `fallback` / `node_used` 维 **已齐（94）**· MD/TXT 更严体积档 **已齐（96）**。仍后批：在线编写完整体验其余（BlockNote / editor-draft）· 魔数嗅探（**PRD 无依据，属加固**）· 真 L1 `contextualize`（下一批首选，无硬前置）· 入场 `aclPrincipals` 剩余面（`GET/PUT /documents/:docId/acl` + admin 用户选择器；无硬前置但属 P3b 提前面）· 入库报告 L0 vs L1 Hit@k（**前置：同文档两份可检索数据的载体**）· 「高度重复」提示阈值（**前置：数据 PRD 给阈值**）· reindex-on-tighten（需先说明它修索引一致性而非安全洞）· `pending_review`（**前置：落点 / 人工端点 / KB 策略位三处先冻**）· QUAL-G3 `gold.yaml` 审核闸（**功能表无此行**，出自测试覆盖表，与人签类锁定项相邻）
- **站规债（UI）**：admin 仍有 20 处原生 `<select>` + 4 处旧 ui `Select`（documents 7 · departments 6 · models 3 · settings 2 · chunk-strategy-panel 1 · eval 1；login / chunks / members 用旧 ui `Select`）；web 已清零。是站规余量，不是功能表语义，可另批清扫
- **回归债（门禁）→ 已清零**：见 [lint 门禁清零](./issues/99-lint-zero-warnings.md)。原先 `apps/api` 7 条 `no-unused-vars` warning（`--max-warnings 0`）让 `pnpm lint` 在 HEAD 即红；已逐处消除未使用绑定（**未**放宽 eslint、**未**加 disable、**未**改 `--max-warnings`、**未**动断言）。现全仓 `pnpm lint` 8/8 成功、零 warning
- **回归债（脆弱测例）→ 已修**：见 [脆弱测例超时热修](./issues/97-flaky-test-timeout.md)。根因是「**测试体内** `await import(重模块)`」的集成式用例把导入时间算进用例超时（收集期的同类导入不在此列），并行 worker 抢 CPU 时越过 vitest 默认 5000ms；`apps/api/vitest.config.ts` 已显式 `testTimeout: 20_000`。**只调超时预算，未动任何断言 / mock / 覆盖**
- **工程债（迁移工具）**：`packages/db/drizzle/meta/` 只留 `0000_snapshot.json`（`0001–0016` 快照未入库）→ `db:generate` 不产增量、会重写全部 26 张表的 `CREATE TABLE`。当前靠**手写 migration SQL + 手写 `_journal.json` 条目**维持（migration `0017` 即如此）。补基线快照 / 恢复 generate 流程另开工单；在此之前**禁止**提交 generate 的全量产出
- LangGraph 编排重构：技术栈冻结为 LangGraph.js（硬性标准）；源码现为线性状态机（`apps/api/src/graph/run.ts`），需后续重构为官方 LangGraph.js。另起路线
- P3a Full 图（CRAG / multi_hop）；硬门在 L2 归档准出（工程路径是 L2 归档底线；人签不进本图）
- P3b 尚未齐的强制检索面：仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal
- P4 其余：L1 门禁包人签与再认证、数据面板增强；独立 `tau_sweep` / `verifier_calib` 入队、把 tau* 接到运行时、live judge 真跑、Grafana 时序仍缺口
- P5 其余（开闸+重跑语义已齐）：OCR 真引擎 / Cloud OCR、容量、熔断生产调优、在线抽样常态化、CoVe / 超长异步、启动自动全库 needs_ocr 重跑
- 基础设施缺口的切入时机：B8 / B9 / QUAL-2（不挡更早语义，但最终产品仍须收）

## Out of scope

- 功能表 §14 冻结非目标（微调私有权重、跨会话记忆、客户端调 τ、未审批就 scan、同一 `indexVersion` 双策略双索引等）
- 用本图改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 未冻召回扩展冒充必达（parent-child / HyDE / 文档多样性 / 生成式模型冒充 rerank）
- 为同一缺口再建 Trellis 实现任务
- 把可演示 / S2 最小 / P-HALF 已完成当成「最终必须具备已齐」
- 双就绪自动升 `lifecycle=active`
- 改全仓 Trellis 开工纪律（仅本图覆盖）
