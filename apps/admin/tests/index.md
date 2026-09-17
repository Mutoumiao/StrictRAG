# @strict-rag/admin · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：运营壳与薄页交互。HTTP 闸、验码、入库状态机分别在 api / worker。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `shell/` | 壳准入、菜单裁剪、Guard | ADR-045/051 · `admin.shell` |
| `auth/` | 客户端 session、HttpError 字段 | P0 R5 |
| `error-map/` | 业务码文案 | P0 R6 |
| `ops/` | 文档/审批/设置/部门/面板薄页行为 | `prds/12-delivery-guides/04-交付控制台.md`（交互，非 API 真值） |
| `kb/` | 当前 KB 选择 | 壳关闭列表 / 禁止粘贴 uuid |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `auth/client-session.test.ts` | admin session 必须与 web key 分轨，失败则两端会话互相覆盖。 | 双端 key 分轨 | `saveClientSession / readClientSession / clearClientSession` | 不写 web session key。 | 现行 |
| `auth/http-error-fields.test.ts` | ApiHttpError 必须保留 code 与 shouldRefresh，失败则刷新闸丢失字段。 | P0 R5 | `ApiHttpError` | 三参构造直断言字段。 | 现行 |
| `error-map/map-biz-error.test.ts` | 已知业务码映射后文案必须含 code，失败则运营页看不到可核对错误码。 | P0 R6 | `mapBizError` | 不透出 shouldRefresh。 | 现行 |
| `kb/upload-strategy.test.ts` | 上传人选必须走 for-upload 结果，禁止写死默认策略码。 | 功能表 §4.5 | `pickUploadChunkStrategy` | 仅 1 个用 autoCode；≥2 须人选或 recommended。 | 现行 |
| `kb/create-kb-services.test.ts` | 建库用例成功后必须把新库写成当前 KB。 | prds/05-api §2.1 | `createKbAndSelect` | 不写 URL；HTTP 真值在 api。 | 现行 |
| `kb/create-kb.test.tsx` | 有 kb.create 才显示建库入口；表单预填当前用户并可改。 | prds/05-api §2.1 | `AdminShell · CreateKbControls` | 挂 KB 选择器，不单开二级菜单。真值在 api 建库写入。 | 现行 |
| `kb/admin-kb-picker.test.tsx` | admin 顶栏当前 KB 只能选本次可见库，禁止粘贴 uuid。 | 功能表 §4 · 工单「admin 顶栏当前 KB 选择器」 | `AdminShell` 关闭列表 | 空态/失败无输入；脏缓存不打运营 API；建库成功选中新建库。 | 现行 |
| `kb/current-kb.test.ts` | 当前 KB 选择必须读写 admin 独立 key，失败则污染 web 或选库丢失。 | 壳 KB 上下文 | `readStoredKbId / writeStoredKbId` | localStorage key。 | 现行 |
| `ops/approvals-workspace.test.tsx` | 审批页必须按码显隐操作入口，失败则无 decide 仍露出通过/驳回。 | 审批闸 UI | `ApprovalsWorkspace` | 不替代 api 闸测。 | 现行 |
| `ops/approvals-submitter.test.tsx` | 审批中心必须回显提交人，认不出时显「—」；失败则四眼无从执行。 | 功能表 §4.3 · prds/05-api §approve（ADR-048）· 剧本 V3 | `ApprovalsWorkspace · submitterLabel` | HTTP 真值在 api（403 闸在 `ingest/no-self-approve`）。 | 现行 |
| `ops/dashboard-workspace.test.tsx` | 数据面板无码须保持 403、有码才加载 summary 与双轨；失败则指标页对无权限可见。 | B6 UI · 剧本 I4 | `DashboardWorkspace` | 指标真值在 api。质量/延迟分区只读。 | 现行 |
| `ops/departments-workspace.test.tsx` | 部门薄页必须按码显隐授权与归属入口，失败则无权限用户看到写操作。 | B5 UI | `DepartmentsWorkspace · grantVisibilityLabel / grantExpiresLabel` | ACL 真值在 api。 | 现行 |
| `ops/document-lifecycle.test.ts` | 文档生命周期入口闸必须按状态判断，失败则未就绪也可发布。 | 功能表 §4.3 | `canPublish / canRevertDraft / canArchive / canSupersede / eligibleSuccessorOptions / canSubmitSupersede` | 上架仅 ready+draft；后继排除自己与未 ready。 | 现行 |
| `ops/document-ops-label.test.ts` | 文档列表运营标签必须按 status × lifecycle 映射八态，失败则合成一个模糊状态。 | 功能表 §4.3 | `opsLabel` | 终态优先；原串另列。 | 现行 |
| `ops/document-reindex.test.ts` | Reindex 人选在可用策略 ≥2 时未选不得提交。 | 功能表 §4.3 | `pickReindexChunkStrategy` | HTTP 闸在 api。 | 现行 |
| `ops/chunk-strategy-panel.test.tsx` | 知识库设置分片策略弹窗必须能启用策略并保存 recommended，且可把 contextMode 打到 L0。 | 功能表 §4.5 · 入库 PRD §4 | `ChunkStrategyPanel` | HTTP 真值在 api。l0_template 标召回增强关闭。 | 现行 |
| `ops/document-upload.test.ts` | 上传服务必须按 upload-url → PUT → complete 调用，失败则入口顺序错乱。 | 上传入口 · ADR-039 · 工单「上传表单标部门最小闭环」 | `uploadAdminDocument · resolveUploadContentType · toCreateDocAclFields` | 未知类型不调 upload-url；complete 带 checksum 与可选部门字段。体积闸真值在 api。 | 现行 |
| `ops/document-write.test.ts` | 在线编写提交必须带非空标题与正文，并走 write HTTP。 | 功能表 §4.3 在线编写 · 工单「上传表单标部门最小闭环」 | `canSubmitWrite · writeAdminDocument` | HTTP 真值在 api。可带部门两字段。无 BlockNote。 | 现行 |
| `ops/document-strategy-snapshot.test.ts` | 文档详情必须只读看到绑定的分片策略与快照，未记录时如实说「未记录」。 | 功能表 §4.5 · prds/05-api 文档元数据 · ADR-053 | `strategySnapshotLabel` | 不新增写路径；HTTP 真值在 api 列表项。 | 现行 |
| `ops/documents-workspace.test.tsx` | 文档列表薄页必须按码控制详情/保存/部门列，失败则运营交互与权限不符。 | 文档运营 UI · 工单「上传表单标部门最小闭环」 · 工单「文档绑定策略参数快照只读审计最小闭环」 | `DocumentsWorkspace · deptLabel / readyColLabel / visibilityLabel / strategySnapshotLabel` | 含类型列、运营标签、Reindex、归档、删除、在线编写区、创建面部门关闭列表；行展开名单与生效区间、入库报告、**分片策略（历史，只读）**；PATCH 含 effectiveFrom/To；有码可选后继替代；删除走 DELETE 不走 PATCH。 | 现行 |
| `ops/ingest-report.test.tsx` | 文档行展开须展示入库报告（含跨文档去重率与 contextualize 两计数）；无报告出「暂无入库报告」；未记录的率与计数不得显示 0。 | 功能表 §4.3 · prds/04-pipelines §5.2 | `DocumentsWorkspace · reportsForDoc · dedupeRateLabel · contextualizeCountsLabel` | 库级 GET 后按本行过滤；展示跨 doc 计数、去重率、冲突对与 L1 成功/L0 回退；未记录就明说未记录。 | 现行 |
| `ops/eval-workspace.test.tsx` | 评测薄页无码须 403；有码才列出题目并入队 L1/L2。 | 功能表 §4.1 · prds/05-api §2.8 · 覆盖 C4 · 覆盖 C2 · 覆盖 C3 | `EvalWorkspace` | HTTP 真值在 api；本页不跑批；L1 有 scored 时展示 Hit@k；有 tauStar / judgeAuroc 时展示该值。 | 现行 |
| `ops/feedback-comment-escape.test.tsx` | 反馈 comment 含 `<script>` 必须当文本展示，不得当 HTML 解析。 | 剧本 K6 · prds/10-delivery/03-acceptance-scenarios.md | `FeedbackWorkspace` | comment 走 React 文本节点原样可见。 | 现行 |
| `ops/feedback-promote-gold.test.tsx` | 有 feedback.queue 与 eval.run 才能纳入黄金集；无 eval.run 不得展示按钮。 | ADR-019 · 功能表 §4.1 · prds/05-api §2.6 | `FeedbackWorkspace` | HTTP 真值在 api；ClosedSelect 题型。不是 gold.yaml。 | 现行 |
| `ops/kb-settings-services.test.ts` | 设置服务必须把类型分区草稿编成 catalog，失败则 PATCH 写出错误 docTypeItems。 | 功能表 §4.2 文档类型 · ADR-054 · 工单「类型分区 CRUD 最小闭环」· 工单「KB 消费绑定最小闭环」 | `draftsFromSettings / draftsToCatalog / catalogsEqual / draftsToKbConsumeBindings` | 不写 URL；不再把逗号串当主路径；KB 绑定空档跟随平台。 | 现行 |
| `ops/kb-settings-doc-types.test.tsx` | 知识库设置文档类型必须逐条增删改，禁止逗号串当主路径。 | 功能表 §4.2 文档类型 · ADR-054 · 工单「类型分区 CRUD 最小闭环」 | `SettingsWorkspace` 类型分区 | HTTP 真值在 api；本页只断言 PATCH 发 docTypeItems。 | 现行 |
| `ops/kb-settings-workspace.test.tsx` | KB 设置薄页必须按 kb.config.write 显隐，未改勾选不得 PATCH 强制/继承。 | B2 设置 UI · 工单「KB 消费绑定最小闭环」 | `SettingsWorkspace` | mode 真值在 api；sensitive 说明为 ACL 就绪；消费绑定三档 ClosedSelect。 | 现行 |
| `ops/roles-permission-tree.test.tsx` | 角色授码必须按菜单树分组，且任何 catalog 码都不得被静默丢掉。 | IA §2.4 · 功能表 §4.1 · prds/09-security 角色树 UI | `buildPermissionTree · RolesWorkspace` | 分组来自 `MENU_TREE`；未挂菜单的码仍可见可勾。鉴权真值在 api。 | 现行 |
| `ops/settings-audit.test.tsx` | 知识库设置页必须展示本库修改日志；无行时须出「暂无修改日志」。 | 功能表 §4.2 | `SettingsWorkspace` | mock services；有行展示时间 / 操作者 / 字段旧→新。 | 现行 |
| `ops/members-workspace.test.tsx` | 成员页有 member.manage 才能改角色；改下拉须走 PUT 用例。 | prds/05-api §2.2 · 功能表 §5.2 成员 | `MembersWorkspace` | HTTP 真值在 api。 | 现行 |
| `ops/last-superadmin-hint.test.tsx` | 用户页唯一在职超管的禁用和剥超管角色必须不可点并出说明。 | 功能表 §4.4 · ADR-056 | `UsersWorkspace · isLastActiveSuperAdmin` | HTTP 真值在 api 400 闸。 | 现行 |
| `ops/superadmin-codes-lock.test.tsx` | 角色页编辑超管时权限勾选与保存必须不可点并出说明。 | 功能表 §4.4 · ADR-056 · 工单「写路径锁超管全码」 | `RolesWorkspace · isLockedSuperAdminRole` | HTTP 真值在 api 400 闸；其它角色仍可授码。 | 现行 |
| `shell/auth-guard.test.tsx` | 无会话或无 admin.shell 必须跳转登录，失败则壳内页对无权限用户可见。 | admin.shell | `AdminAuthGuard` | mock 须持续 resolve。 | 现行 |
| `shell/menu-clip.test.tsx` | 菜单必须按权限码裁剪，失败则无码用户仍看到落地路由。 | ADR-056 clip | `AdminShell` | 非完整运营台。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
