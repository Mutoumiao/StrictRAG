# @strict-rag/api · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：HTTP、ask 图、检索装载、鉴权验码、入库受理。入库状态机在 worker；用户端三态在 web。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | 单轮信任路径、mode/docTypes、检索装载 | `prds/04-pipelines` · `prds/08-quality` · P0 R7–R9 |
| `ingest/` | 入库 HTTP、体积/审批闸、分片策略、文档元数据 | `prds/04-pipelines/01-offline-ingest.md` · B12 |
| `auth/` | JWT、AUTH_ENFORCE、hydrate | `prds/09-security` · QUAL-1 |
| `acl/` | 成员、部门、kb-scope、列表同滤、文档级 principals | ADR-051 · DEPT_ACL · P3b 文档 ACL |
| `kb/` | 知识库列表与设置 | B2 / B2-W |
| `sessions/` | 会话壳、近窗 | 历史≠evidence · rewrite 默认关 |
| `feedback/` | 答案反馈 API | B13 |
| `gateway/` | 模型绑定 / mock / 双节点 / generate fallback | B3 · QUAL-3 · P4 generate fallback |
| `eval/` | L1/L2 工程 seed | B10 · **≠ 准出** |
| `obs/` | 指标、限流、三平面配额、写审计、L3 进程内熔断 | ARCH-P2-4 · ARCH-P1b-2 · P2.5-L3 · 剧本 R5/R8/R9 |
| `env/` | env、health/ready、OpenAPI | P0 骨架 |
| `docs-guard/` | 交付文档护栏 | 控制台 §0.5 |
| `ops/` | 数据面板 HTTP | B6 |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `acl/chunk-body-patch-denied.test.ts` | PATCH/PUT chunk body 必须拒绝，且不走写仓。 | 剧本 Z7 · ADR-052 | `PATCH/PUT /documents/:docId/chunks/:chunkId` | 仅 GET 路由；404/405；无写仓调用。≠ Mongo 正文未变。 | 现行 |
| `acl/chunks-dept-filter.test.ts` | chunks 列表必须套部门过滤。 | DEPT_ACL | `GET /documents/:docId/chunks` | chunks 列表部门过滤。 | 现行 |
| `acl/departments-http.test.ts` | 部门壳 HTTP 按契约读写；AE1 同一剧本建树 + 指定负责人 + 员工主部门。 | B5 · 剧本 AE1 | `createDepartmentsRoutes` | 部门壳 HTTP；负责人与主部门可回读。 | 现行 |
| `acl/dept-grants-http.test.ts` | 跨部门 grant HTTP 按 DEPT_ACL 约束。 | DEPT_ACL | `createDeptGrantsRoutes` | 跨部门 grant。 | 现行 |
| `acl/doc-acl-principals.test.ts` | 文档级用户 uuid 名单必须按 null/[]/命中/未命中/bypass 过滤，失败则非名单用户可读。 | P3b 文档 ACL · 覆盖 B2-4 / B2-1 最小 | `isDocVisibleForAclPrincipals / filterDocsForAclPrincipals` | null 可见、[] 不可见、命中可见、未命中/无 userId 不可见、bypass 可见。 | 现行 |
| `acl/acl-tighten-index-lag.test.ts` | ACL 收紧后索引滞后（ES 持旧 principals）不得构成泄漏：旧命中必须在 PG 闸被丢掉。 | 功能表 §5.5「收紧须 reindex」· ADR-009 决策 4 · ES PRD §4.3 · 覆盖 B2-2 / B2-3 最小 | `runRetrieve（sparse 命中 → PG 语料求交）` | 语料只剩可读块时旧 chunkId 不进 evidence；语料被清空 → `kb_not_ready`，不凭空 answered。 | 现行 |
| `acl/documents-acl-endpoint.test.ts` | 文档 ACL 专用端点须按三态读写，可见性闸与详情同口径，收紧须提示 reindex。 | prds/05-api §2.4 · prds/09-security §3.6.1 · 功能表 §5.2 / §5.5 | `GET/PUT /documents/:docId/acl` | GET 三态回读；名单外 403、超管旁路 200；PUT null/[]/名单后回读一致 + `reindexRequired`（收紧 true / 放宽 false）；非法 body 400；缺文 404；AUTH_ENFORCE 开时 401/403。 | 现行 |
| `acl/documents-acl-principals.test.ts` | 文档 aclPrincipals 必须可 PATCH 三态回读，且列表/详情/语料同滤。 | P3b 文档 ACL · 覆盖 B2-4 / B2-1 最小 | `PATCH/GET /documents/:docId · GET /knowledge-bases/:kbId/documents · filterDocsForAclPrincipals` | null 可读、[] 非超管不可读；名单内外分滤；bypass 200；retrieve 语料不含未授权文档。 | 现行 |
| `acl/documents-dept-filter.test.ts` | 文档列表必须套部门过滤。 | DEPT_ACL | `documents list dept filter` | 文档列表部门过滤。 | 现行 |
| `acl/doc-write-kb-member-gate.test.ts` | 路径只有 :docId 的文档写入口必须查 KB 成员资格，持码非成员不得写他库文档。 | ADR-035 §决策 4 · ADR-045 焊死 #1 · prds/09-security §3.2 / §3.4 · 剧本 S5 | `PATCH /documents/:docId · PUT …/acl · POST …/dedupe-conflicts/:chunkId/resolve · PATCH …/lifecycle · POST …/approve` | 非成员 403 非成员文案且不落仓；成员 200；super_admin 非成员旁路；`whenEnforced` 入口姿态随 AUTH_ENFORCE。 | 现行 |
| `acl/grant-dashboard-view.test.ts` | 授 `dashboard.view` 后该 kb_admin 打面板必须 200；未授 403。 | 剧本 W8 · ADR-049/051 | `PUT /admin/roles/:roleId/permissions · GET /admin/dashboard/summary` | 授权真值走 DB 角色并集；扩授后可访问，对照无码 403。 | 现行 |
| `acl/kb-member-gate.test.ts` | 无 KB 成员必须 403，授权以码为准；超管非成员显式全权。 | 以码为准 · 剧本 B1-5 / Y5 · ADR-051 | `requireKbMember / requirePermission · GET /knowledge-bases/:kbId/documents` | 无成员 403；超管非成员列文档/管理库 200，有码非超管非成员 403。 | 现行 |
| `acl/kb-scope-cache.test.ts` | KB 成员查找在同一请求内复用缓存。 | ARCH-P1b-1 | `lookupKbMembership / membershipCacheKey` | KB 成员查找请求内缓存。 | 现行 |
| `acl/kb-scope-write-isolation.test.ts` | 同一用户跨两库写权限必须按库成员资格隔离。 | 剧本 S5 · ADR-035 §4 · ADR-051 | `createKbSettingsRoutes / createMemberRoutes` | 成员库写 200/201；非成员库写 403 非成员；有成员资格但无码仍 403。 | 现行 |
| `acl/me-permissions.test.ts` | GET /me/permissions 必须回角色并集有效码，且与 /auth/me 同源。 | prds/05-api §2.11 · 功能表 §5.1 · 剧本 Y1 | `GET /api/v1/me/permissions` | 超管含 admin.shell / dashboard.view / role.perm.manage；不废 /auth/me。 | 现行 |
| `acl/members-http.test.ts` | 成员 CRUD HTTP 按成员码授权；doc_operator 邀请/移除必须 403 且无副作用。 | 成员码 · 剧本 B1-3 | `createMemberRoutes` | 成员 CRUD HTTP（含 PUT 只改 role、B1-3 双向 403）。 | 现行 |
| `acl/permission-resolve.test.ts` | 有效权限码 = 模板 ∪ grants − denies。 | ADR-051 | `resolveEffectiveCodes / canAccessKbScoped` | 有效码求值。 | 现行 |
| `acl/platform-users-roles.test.ts` | 平台用户角色写路径必须失效缓存；绑自定义角色后 /me/permissions 即该角色并集。 | B4 · ADR-056 · 剧本 AD5 · 工单「写路径锁超管全码」 | `platform-users-roles routes · GET /me/permissions` | 写路径 invalidate；改少超管码 400；DB 角色并集为授权真值。 | 现行 |
| `acl/retrieve-dept-acl.test.ts` | 检索期按部门 ACL 过滤可见文档。 | DEPT_ACL | `filterDocsForDeptAcl` | 默认 enforce 关。 | 现行 |
| `acl/system-roles-skip-reseed.test.ts` | 已有 isSystem 角色则不再 insert 系统角色。 | 剧本 AD3（部分） | `ensureSystemRoles` | 只锁跳过重种子，≠ 补码、≠ 不重置密码。补码见 `superadmin-bootstrap`。 | 现行 |
| `acl/superadmin-bootstrap.test.ts` | 空库须能按 env 引导出 active 超管与 catalog 全码；缺 env 须失败；已有超管不得改哈希。 | 剧本 AD1–AD3 · ADR-056 | `bootstrapSuperAdmin` · `createApp` | 直接调引导函数；AD2 抛错；createApp 不自动跑；upsert 不静默删；kb_admin 自定义码不覆盖。 | 现行 |
| `ask/abstain-suggested-actions.test.ts` | 拒答轮必须给出非空且随 reason 变的 suggestedActions，同步与 SSE 同形。 | 剧本 A4 · P2必签 · prds/08-quality/01-verification-and-abstention.md | `POST /knowledge-bases/:kbId/ask（sync / SSE）` | 三种拒答 reason 各有主按钮且互不相同。 | 现行 |
| `ask/answer-kind.test.ts` | 库内 verified 轮必须回 answerKind=knowledge，寒暄轮 chitchat，拒答轮不谎报。 | 剧本 A3 · P2必签 · prds/05-api | `POST /knowledge-bases/:kbId/ask（sync / SSE）` | 同步与 data-ask-final 同判 answerKind。 | 现行 |
| `ask/body-lt-passthrough.test.ts` | 制度正文中的 `<` 必须原样进入 generate，不得被 HTML escape 成 `&lt;`。 | 剧本 K6 · prds/10-delivery/03-acceptance-scenarios.md · ADR-037 | `runAskGraph（generate / claim_split user 消息）` | evidence.text 含尖括号时 prompt 保留原字符。feedback 脚本消毒不在本包。 | 现行 |
| `ask/budget.test.ts` | mode 预算表与 tryCharge 闸；检索/LLM 额度耗尽不得 answered。 | ADR-032 · prds/04-pipelines | `budgetForMode / tryChargeLlm / tryChargeRetrieve / runAskGraph 预算路径` | 校验 mode 默认额度与 tryCharge；检索/LLM 耗尽须 abstained。 | 现行 |
| `ask/citations.test.ts` | 非法 citation 不得 answered；引用必须落在 scope 语料内。 | prds/08-quality · 剧本 X7 | `runAskGraph（generate+citations）` | 非法引用拒答；混合引用只留证据 id；场外 chunk 引用被丢弃。 | 现行 |
| `ask/embed-budget.test.ts` | query embed 只发生在 retrieve，次数不超过 retrieve 次且不计入 LLM 预算。 | 剧本 R1 · 剧本 R2 · 剧本 R3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-044 | `runRetrieve embed / runAskGraph` | 两次 retrieve 只 embed 两次；图节点不调 embed；不得把 chunk 正文传入 embed。 | 现行 |
| `ask/es-sparse-probe.test.ts` | 稀疏探针脚本在缺少 KB 时必须拒绝误跑。 | OPS-1 | `requireProbeKbId` | 非生产 ES 宣称。 | 现行 |
| `ask/es-dept-query-filter.test.ts` | ES 查询期按部门 ownerDeptId 收窄，缺字段不得当全员可见。 | DEPT_ACL · 工单 ES 查询期部门对称 | `buildAclFilter / searchSparseEs / collectVisibleOwnerDeptIds / runRetrieve` | enforce 默认关；开且非超管才 terms；超管不加；PG 可见级闸仍保留。 | 现行 |
| `ask/es-principals-query-filter.test.ts` | ES 查询期按文档 aclPrincipals 收窄，缺字段=未设可读，空数组不可命中。 | P3b 文档 ACL · 工单 ES 查询期 principals 对称 | `buildAclFilter / searchSparseEs / sparseBulkSource / runRetrieve` | 不跟 DEPT_ACL_ENFORCE；超管不加 clause；PG 名单闸仍保留；显式空写哨兵。 | 现行 |
| `ask/es-builder-tenant-required.test.ts` | 无 tenantId 的 ES query / bulk builder 必须失败，不得静默少过滤或回退全租户。 | 剧本 O4 · ADR-041 | `buildAclFilter / sparseBulkSource` | 缺 / 空 / 纯空白 tenantId 即抛；带 tenantId 时租户 + kbId filter 逐位不变（未放宽既有闸）。 | 现行 |
| `ask/es-sparse.test.ts` | 稀疏检索 HTTP 切片按 env 解析，失败不得静默回 mock；默认查共享索引名。 | OPS-1 · 剧本 O2 | `esConfigFromEnv / searchSparseEs / buildAclFilter` | 稀疏检索 HTTP 切片 + ACL filter；默认索引名与查询 URL 同源。 | 现行 |
| `ask/evidence-verbatim.test.ts` | 当轮 evidence.text 进入 generate/verify 与 citation 必须逐字一致，不得改写（含工号与手机号片段）。 | 剧本 K1 · 剧本 K4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-037 | `runAskGraph（generateUserPrompt / claim_split / citation.preview）` | 现权威为 evidence.text / PG body，≠ Mongo。 | 现行 |
| `ask/execute-trace.test.ts` | executeAsk 落 trace 时历史文不得进入 evidence。 | prds/05-api · 历史≠evidence | `executeAsk` | 落库 trace 时只记录本轮 evidence，不把历史文写进快照。 | 现行 |
| `ask/false-premise.test.ts` | 库外假前提问句必须拒答，不得被当成 chitchat answered，也不得拿不对题证据硬答。 | 剧本 D3 · P2必签 · prds/08-quality | `runAskGraph（route + retrieve + generate 拒答边）· ruleRoute` | 无证据 low_retrieval；仅有不对题邻居证据 model_abstained。 | 现行 |
| `ask/final-mapper.test.ts` | 终态回读必须与在线终态逐字段同形；不可同形时必须 ready=false 而不是假 answered。 | 功能表 §3 断线重拉终态 · prds/05-api §2.7 契约铁律 5 | `toAskFinal` | verified / 拒答轮重建结果与 executeAsk 在线响应深等；citations 未落库的通过轮、未知 status/reason、坏引用形状一律 ready=false。 | 现行 |
| `ask/final-replay.test.ts` | 流式断线后必须能按 requestId 取回该轮终态，且读不回时如实说读不回。 | 功能表 §3 断线重拉终态 · prds/05-api §2.7 契约铁律 5 | `GET /ask/:requestId/final` · POST ask 的 running part | 成员得同形终态；通过轮 citations 未落库 → ready=false；拒答旧轮仍可回读；非成员 403；缺失 404；审计口语义不变；running part 带本轮 requestId。 | 现行 |
| `ask/gateway-chain-fail.test.ts` | generate 绑定全链失败时走图必须 abstained internal_guard，禁止 knowledge 胡答。 | 剧本 H5 · P2必签 · prds/07-models · ADR-055 | `runAskGraph · chatFromGateway · createMockGateway（generate 链）` | primary 与备用都失败仍拒答；有证据也不 answered，且不再进 verify。 | 现行 |
| `ask/history-not-evidence.test.ts` | 会话历史与加深窗文本不得进入 evidence / 不得充当 verify 依据。 | 历史≠evidence · prds/04-pipelines | `runAskGraph（history / evidence_snapshot）` | 有 session 仍只凭 evidence 验证；历史与加深窗文本不得进 snapshot/citations。 | 现行 |
| `ask/http-audit.test.ts` | GET /ask/:requestId 必须按 KB 成员权限回读当时 evidence_snapshot 与 graph_trace。 | prds/05-api §2.9 · 功能表 §5.2 引用回溯 · 剧本 F3 | `GET /ask/:requestId` | 成员 200 得快照；非成员 403；缺失 404；preview 截断；不依赖现网分片。 | 现行 |
| `ask/http-ask-modes.test.ts` | 成员必须能读库 allowedModes/defaultMode，且不得经此口拿到 τ。 | 功能表 §3 问答档位 | `GET /knowledge-bases/:kbId/ask-modes` | 成员 200；非成员 403；缺库 404；缺设置回默认档；响应无 tauClaim。 | 现行 |
| `ask/http-doc-types.test.ts` | 成员必须能读库文档类型枚举，且不得经此口拿到 τ。 | 功能表 §5.2 文档类型 · ADR-050 · 工单「文档类型成员面最小闭环」 | `GET /knowledge-bases/:kbId/doc-types` | 成员 200 与 settings 枚举一致；catalog 启用项真 label；停用不出；空枚举 items=[]；非成员 403；缺库 404；响应无 tauClaim。 | 现行 |
| `ask/http-stream.test.ts` | 同步与 SSE 终态字段必须一致；空库走 200 拒答；execute 抛错仍要给出 final；拒答轮不得推伪流式 token。 | prds/05-api · 剧本 H6 | `POST /knowledge-bases/:kbId/ask sync / SSE` | 同步与流式终态一致；kb_not_ready 为 200 拒答信封；execute 抛错仍须给出 final；拒答无 text-delta。 | 现行 |
| `ask/http-validation.test.ts` | POST ask 校验、鉴权与 sessionId 闸必须按契约拒绝非法请求。 | prds/05-api | `POST /knowledge-bases/:kbId/ask` | 非法 body、无鉴权与非法 sessionId 须按契约拒绝。 | 现行 |
| `ask/idempotency-key.test.ts` | 带 Idempotency-Key 的重试不得重跑问答图，必须复用同一 requestId 的终态；在途与不可回读要可辨。 | prds/05-api §2.7 契约铁律 6 · prds/04-pipelines §8 · prds/03-data §2.1 | `POST /knowledge-bases/:kbId/ask（Idempotency-Key 分支）` | 不带键行为不变；同键重放不跑图且与终态回读口同形；在途 409 `in_flight`；不可同形 409 `not_replayable`；跨用户不命中；非成员 403 不占键；重试不吃配额；超长键 400；空白键视为未带；流式重放写 `data-ask-final`；跑图抛错释放键。 | 现行 |
| `ask/idempotency-store.test.ts` | 幂等键作用域与后端适配必须可核对：键含 tenant/user/kb 且抢占/复用/释放语义确定。 | prds/03-data §2.1 · prds/01-architecture §3 | `services/ask/idempotency.ts` | TTL 600s；同原始键不同用户/库得到不同键；二次 claim 复用首次 requestId；释放后可重抢；ioredis 适配发 `SET key value EX ttl NX`。 | 现行 |
| `ask/min-veto.test.ts` | claim 级 min 不达标时整答必须拒答，禁止均值洗白后 answered。 | P0 R8 · prds/08-quality/01-verification-and-abstention.md | `runAskGraph（judge 分数路径）` | 单条低分 claim 即整答拒答，不看均值。 | 现行 |
| `ask/needs-ocr-not-retrievable.test.ts` | 卡在 OCR 闸的文档即使已上架也不得进默认检索，ask 必须拒答。 | 剧本 Q1 · prds/10-delivery/03-acceptance-scenarios.md · ADR-043 | `POST /knowledge-bases/:kbId/ask（loadCorpus 语料装载）` | needs_ocr 不进语料 → kb_not_ready；对照 ready 后可答。默认 mock ES。 | 现行 |
| `ask/pending-not-retrievable.test.ts` | 未审批文档不得被默认问答应答；ready 但未上架同样不可检。 | 剧本 V2 · ADR-048 · P0 R7 | `POST /knowledge-bases/:kbId/ask（loadCorpus 语料装载）` | pending/uploaded/draft → kb_not_ready；对照 ready∧active 才可答。 | 现行 |
| `ask/mode-doc-types-gate.test.ts` | ask 入口按 KB 允许的 mode/docTypes 拦截非法请求。 | B2-W | `POST /knowledge-bases/:kbId/ask mode/docTypes 闸` | mode/docTypes 闸。 | 现行 |
| `ask/mongo-body.test.ts` | 融合后正文必须从 Mongo 批取权威切片，缺块或拉取失败须 fail-closed。 | prds/03-data/02 §3.2 · prds/04-pipelines §5 步骤 6 · ADR-037 | `batchLoadChunkBodies / composeChunkSlice / runRetrieve loadBodies` | 切片口径 prefix+"\n"+text；注入后 evidence 用批取结果。 | 现行 |
| `ask/question-html-passthrough.test.ts` | 含 HTML/特殊字符的问句必须原样进入 retrieve，不得被 escape 破坏检索语义。 | 剧本 H7 · prds/10-delivery/03-acceptance-scenarios.md | `runAskGraph（retrieve.question）` | 问句含 HTML 片段时 retrieve 收到的 question 等于原始字符串。 | 现行 |
| `ask/ready-active-corpus.test.ts` | 未 ready∧active 的文档不得进入检索集。 | P0 R7 | `filterDocsForRetrieve / loadCorpus 同形` | 生产装载路径，非仅 db 纯函数。 | 现行 |
| `ask/effective-window-corpus.test.ts` | 语料装载必须叠生效窗口，未生效或已到期不得进检索集。 | 功能表 §5.4 | `filterDocsForRetrieve` | 注入 now；双闸仍由 ready-active-corpus 钉。 | 现行 |
| `ask/retrieve-mode-budget.test.ts` | 档位检索预算必须由服务端按 mode 注入，客户端不得透传 retrieveK / rerankTopN。 | 功能表 §5.4 · ADR-032 · prds/04-pipelines | `retrieveBudgetForMode / runAskGraph 档位传参` | fast 60/10；balanced/strict 150/20。仅服务端。 | 现行 |
| `ask/retrieve-outcomes.test.ts` | 检索阶段失败或闲聊短路时不得用假 evidence 洗成 answered。 | prds/04-pipelines · prds/08-quality | `runAskGraph（route+retrieve）` | 闲聊不检索；空证据/rerank/kb 未就绪须拒答，userId 透传到 retrieve。 | 现行 |
| `ask/retrieve-run.test.ts` | runRetrieve 双闸、preferred 提升、跨库召回负向与语料责任边界必须成立。 | prds/04-pipelines · 剧本 B1-A3 | `runRetrieve / promotePreferredDocChunks` | 默认 mock ES；双闸由 caller corpus 负责；他库 chunkId 被求交丢弃。 | 现行 |
| `ask/rewrite-disabled.test.ts` | rewrite 关闭或无 loader 时不得改写问句、不得 500。 | SESSION_REWRITE_ENABLED 默认关 | `runAskGraph（rewrite 关）` | 关开关、无会话、fast、无 loader 时不调用 rewrite，也不 500。 | 现行 |
| `ask/rewrite-min.test.ts` | rewrite 最小开路径：弱指代独立问句、未解析则不检索、回指四态派生正确。 | prds/04-pipelines P2.5 rewrite min | `runAskGraph（rewrite 开）` | 开 rewrite 时检索用独立问句；未解析不检索；session/document/external 回指四态。 | 现行 |
| `ask/rewrite-parse.test.ts` | 改写输出必须是合法独立问句；resolved=false / 非法 JSON / 空白须抛错。 | prds/04-pipelines rewrite | `parseRewriteOutput` | standalone 合法才通过；resolved=false、非法 JSON、空白 standalone 抛错。 | 现行 |
| `ask/route-rules.test.ts` | 闲聊走 chitchat，知识/政策问句走 single，禁止政策句被当成闲聊；fast 档不得调 LLM route。 | prds/04-pipelines/02-online-ask-langgraph.md · 剧本 D-fast | `ruleRoute · runAskGraph（chat purpose 序列）` | 问候为 chitchat；带知识/政策词的问句必须 single；fast 模糊短句走 single 且无 purpose=route。 | 现行 |
| `ask/scope-hr-excludes-finance.test.ts` | hr scope 不得用 finance 文档作答，answered 轮 citation 也只能来自 hr。 | 剧本 X2 / X3 | `filterDocsForRetrieve / runRetrieve / runAskGraph` | scope.docTypes=hr 滤掉 finance；整轮 citation 与 evidence 都无 finance。 | 现行 |
| `ask/scoring-rrf.test.ts` | 混合检索的余弦相似与 RRF 融合按预期排序。 | prds/04-pipelines | `cosine / rrfFuse` | 打分与倒数秩融合的纯函数。 | 现行 |
| `ask/sparse-kb-filter.test.ts` | 共享索引查询必须带 tenantId + kbId term，外库 chunk 不得进 evidence。 | 剧本 O1 | `searchSparseEs / runRetrieve` http sparse | 默认 mock ES；锁 tenantId + kbId filter；部门 terms 另见 es-dept-query-filter。≠ 生产独立索引。 | 现行 |
| `ask/trace-citations-column.test.ts` | 当轮 citations 必须真的落进 ask_traces 列（断线重拉终态的前提）。 | 功能表 §3 断线重拉终态 · prds/03-data §3.4 | `saveAskTrace` | 传 citations 落列；拒答落 `[]`（≠ 未记录）；未传落 null。 | 现行 |
| `ask/verify-required.test.ts` | 合法 draft 必须完整 verify；拆句失败或网关错不得 answered。 | P0 R9 · prds/08-quality | `runAskGraph（verify / claim_split）` | happy 必经 generate+claim_split+judge；拆句失败或网关错不得 answered。 | 现行 |
| `auth/enforce-401.test.ts` | AUTH_ENFORCE 开启且无 Bearer 时必须 401。 | QUAL-1 | `requirePermissionWhenEnforced` | enforce 开且无 Bearer → 401。 | 现行 |
| `auth/enforce-permission-matrix.test.ts` | enforce=true 时写入口必须按码 403：read 六类入口全拒、doc_operator 审批拒；绕过壳也无效。 | 剧本 B1-2 / B1-8 / S2 / S3 / S8 / Y3 · ADR-051 | `requirePermissionWhenEnforced / requirePermission（documents · members · kb-settings · eval · ask）` | 夹具在测试内 stubEnv 开 enforce；403 只来自缺码；对照 ask 仍 200。 | 现行 |
| `auth/role-hydrate.test.ts` | 每请求角色 hydrate 超时必须回退，缓存不超过 5s。 | B4-W | `role-hydrate middleware` | ≤5s 缓存。 | 现行 |
| `auth/token-service.test.ts` | access jti 与 refresh 轮转在同一秒内可区分。 | prds/09-security | `issueTokenPair / rotateRefresh` | 同秒可区分。 | 现行 |
| `docs-guard/auth-enforce-pilot.test.ts` | 试点文档与 AUTH_ENFORCE 开关默认值保持一致。 | docs/ops/auth-enforce-pilot.md | `docs/ops/auth-enforce-pilot.md · .env.example` | 文档护栏。 | 现行 |
| `docs-guard/delivery-s05.test.ts` | 交付控制台 §0.5 已闭合待盘点行不得回退。 | 交付控制台 | `prds/12-delivery-guides/04-交付控制台.md` | 读 PRD 文件，非 mock。 | 现行 |
| `docs-guard/gold-review-guard.test.ts` | 黄金集名录只能人审后手工维护：源码里写文件 API 附近不得出现 gold.yaml。 | 剧本 G3 · ADR-019 | `apps 各包 src / packages 各包 src 源码护栏` | 读仓库文件扫写 API 邻域；L1 只读侧 + 运营纳入落 gold_questions。 | 现行 |
| `env/body-limit.test.ts` | 超限 JSON body 必须 413 PAYLOAD_TOO_LARGE。 | prds/05-api · ARCH-P0 | `createApp body-limit` | 超限 JSON body 必须 413 PAYLOAD_TOO_LARGE。 | 现行 |
| `env/defaults.test.ts` | api env 默认值保持关闭态，tauClaim 双源冲突必须拒绝。 | 基建: api env Zod | `env Zod 对齐（不启动进程）` | rewrite / AUTH_ENFORCE 默认关；ask/ingest RPM 默认 0。 | 现行 |
| `env/error-envelope.test.ts` | 未知路径与未处理异常必须走统一错误信封，且不得泄漏 stack。 | prds/05-api · ARCH-P0 | `createApp onError / isAskTimeoutExcept / isBodyLimitExcept` | 未知路径与未处理异常走统一信封，且不得泄漏 stack。 | 现行 |
| `env/health-ready.test.ts` | health 探针必须返回 ok。 | P0 | `GET /health` | health/ready。 | 现行 |
| `env/openapi-document.test.ts` | OpenAPI 文档必须从 contracts 生成。 | ARCH-P2-1 | `buildOpenApiDocument / isOpenApiDocsEnabled` | OpenAPI 文档自 contracts 生成。 | 现行 |
| `env/openapi-routes.test.ts` | /openapi.json 与 /docs 路由按开关暴露。 | ARCH-P2-1 | `createOpenApiRoutes` | /openapi.json · /docs。 | 现行 |
| `env/pg-error.test.ts` | PG 错误码必须映射到业务码。 | 基建: PG 错误映射 | `extractPgError / mapPgErrorToBiz` | PG 错误映射。 | 现行 |
| `env/ready-hard-deps.test.ts` | GET /ready 在 PG 或 Redis 不可用时必须 503 且 ready 为 false。 | 剧本 H3 · prds/10-delivery/03-acceptance-scenarios.md | `GET /ready · runReadyChecks（postgres/redis 硬依赖）` | mock createDb 抛错或 ioredis ping 失败 → 503；不停本机 PG。 | 现行 |
| `env/ready-soft-gateway.test.ts` | Gateway 不可用时 GET /ready 仍 200，不得因软依赖否决。 | 剧本 H4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-028 | `GET /ready · checkGateway` | PG/Redis mock 为 up、Gateway fetch 失败时 checks.gateway 为 down 且 ready 为 true。 | 现行 |
| `eval/adr046-snapshot.test.ts` | 评测快照绑定硬门不得松于试点；未声明加严锚定试点包，放宽不得生效。 | ADR-046 · 剧本 T1 / T2 / P6 | `evaluateAdr046Bind / bindQualitySnapshotToEval` | 评测快照绑定硬门；pilot 默认、looser 拒绝、门禁无 aux_*。 | 现行 |
| `eval/http-eval-runs.test.ts` | POST eval/runs 只入队；空题集拒绝；L2 不依赖 gold_questions；内口靠口令并可带窗。 | prds/05-api §2.8 · 功能表 §5.2 · 覆盖 C4 · 覆盖 C2 | `POST/GET …/eval/runs · POST /internal/eval/execute-ask` | 请求线程不跑批；内口回 evidenceDocIds / minSupport；GET 可带 Hit@k / tauStar。 | 现行 |
| `eval/http-gold-questions.test.ts` | 有 eval.run 才能维护黄金集；重复题号冲突。 | prds/05-api §2.8 · 功能表 §4.1 | `GET/POST/PATCH/DELETE …/gold-questions` | 运营题面落库；不是 CLI seed。 | 现行 |
| `eval/l1-cli.test.ts` | L1 CLI 注入路径可跑且 skipTrace，不打 live。 | B10 · 覆盖 C4 · 覆盖 C2 · 覆盖 C3 | `runL1Golden / loadGold / writeL1Report` | 注入路径可跑且跳过落库 trace；有 expectedDocIds 时写 Hit@k；有 minSupport 时写 tauStar；注入校准打分器时写 judgeAuroc。 | 现行 |
| `eval/l1-matrix.test.ts` | L1 2×2 纯函数累计与覆盖计算正确，且不得当作签字。 | B10 | `cellFor / accumulate / coverage / computeSignoffEligible` | ≠ 签字；error 出格。 | 现行 |
| `eval/l2-cli.test.ts` | L2 CLI 注入可跑；signoffEligible 走工程公式，mock 必 false。 | P2.5-L2 | `runL2Golden / parseL2CliEnv` | 工程可签字 ≠ 准出 PASS。 | 现行 |
| `eval/l2-fingerprint.test.ts` | rewrite 指纹纯函数稳定，且不因此打开 rewrite。 | ADR-046 相关 | `l2RewriteFingerprint` | 非开 rewrite。 | 现行 |
| `eval/l2-gold.test.ts` | L2 题面加载拒绝非法文件，且不得当作准出。 | P2.5-L2 | `loadL2Gold / l2TypeCoverage / defaultL2GoldPath` | ≠ 准出。 | 现行 |
| `eval/signoff-package-derive.test.ts` | 签字包 ID / 生效时刻须从 eval_runs 读时派生，无合格 run 时保持 null。 | ADR-046 四要素之四 · ADR-061 · 05-api §2.1 | `isSignoffPackageRow / latestSignoffPackage` | 合格=golden_2x2 ∧ succeeded ∧ live ∧ signoff_eligible；任一不满足即 null；不代签（RACI 是文件产物）。 | 现行 |
| `eval/stricter-than-pilot-bind.test.ts` | 加严快照必须标 stricterThanPilot，并带相对默认 diff 与 evalRunId 关联；未重跑不得标已签字。 | 剧本 T3 / T7 · prds/10-delivery/03-acceptance-scenarios.md · ADR-046 | `bindQualitySnapshotToEval` | stricterThanPilot=true 但无 2×2 绑定/人签时 signedPackage=false。不测人签/审计 HTTP。 | 现行 |
| `feedback/http.test.ts` | 答案反馈 POST/PATCH 必须具备 kb 码；missing_doc 开单与 linked_doc 关单闭环可用。 | B13 · 剧本 G1 / G2 / S3 | `createFeedbackRoutes` | 须 kb 码；abstained 轮开单 open、运营 linked_doc 关单并可过滤。 | 现行 |
| `feedback/promote-gold.test.ts` | 运营纳入黄金集必须写入 gold_questions；用户提交与缺 eval.run 不得写题。 | ADR-019 · prds/05-api §2.6 · 功能表 §4.1 · 覆盖 G3 | `createFeedbackRoutes` PATCH `promoted_to_gold` | 审核闸 = 队列点纳入；不写 gold.yaml、不入队评测。 | 现行 |
| `gateway/bindings-http.test.ts` | 供应商绑定 HTTP 按 B3 契约读写。 | B3 | `model-gateway routes` | 供应商绑定 HTTP。 | 现行 |
| `gateway/generate-fallback.test.ts` | generate 绑定 fallbacks 必须在运行时切链，无备用行为不变。 | P4 多模型 fallback · B3-W | `applyBindingsToGatewayConfig / resolveChatNodes / mock+http chat` | opt-in 备用 ModelRef；auth 不盲切；judge 不走 generate 链。≠ GENERATE_MIN_NODES。 | 现行 |
| `gateway/resolve-mock.test.ts` | 网关解析缺 URL 时走 mock，绑定覆盖与重试保持契约；KB 选择覆盖平台后解析即 KB 端点。 | B3 · QUAL-3 · 剧本 AC6 | `buildGatewayConfig / applyBindingsToGatewayConfig / mock+http retry` | 缺 URL → mock；KB 绑定覆盖平台时可解析到 KB 供应商。 | 现行 |
| `ingest/approval-scan.test.ts` | 审批未过不得 complete / 入扫描。 | 审批未过不得 complete | `canEnqueueScan / canBecomeActive / scanDeniedCode` | 审批扫描闸。 | 现行 |
| `ingest/approve-then-scan.test.ts` | kb_admin 审批通过后必须可 scan 入队。 | 剧本 Y4 | `POST /documents/:docId/approve` · `POST /documents/:docId/scan` | approve 200 后 scan 200 且 enqueue stage=scan。AUTH_ENFORCE 默认关。禁自审见 `ingest/no-self-approve.test.ts`。 | 现行 |
| `ingest/chunk-strategies.test.ts` | 已实现分片策略可写；未实现必须 400，禁止静默 default。仅 1 个可自动，≥2 未选须 400。 | B12 · X-03 · 功能表 §4.5 | `chunk-strategies` | 禁静默 default；绑定/reindex 选择规则。 | 现行 |
| `ingest/chunks-http.test.ts` | chunks HTTP 只读路由按成员与文档闸返回；授码后可读，历史版本不提供浏览。 | B1 · 剧本 Z5 / Z6 | `createChunkRoutes` | chunks HTTP；默认 doc_operator 403，授 chunk.view 后 200；version 参数被忽略。 | 现行 |
| `ingest/chunks-query.test.ts` | 分片只读查询返回 preview/body 契约。 | ADR-052 · B1 | `buildPreview / buildBody` | 分片只读查询。 | 现行 |
| `ingest/dedupe-conflict-resolve.test.ts` | 待审重复块的人工二选一必须只动该块两列，且不代替持 doc.reindex 的人重跑。 | 剧本 E4 · 入库 PRD §5.1 · 数据 PRD §3.2 | `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve` | winner=other 保留 duplicate_of；winner=this 清并回 reindexRequired；非待审 400 / 不存在 404 / 坏 body 400。 | 现行 |
| `ingest/complete-size.test.ts` | complete 体积超限必须拒绝。 | 上传/complete 限 | `checkUploadByteSize` | complete 体积闸。 | 现行 |
| `ingest/complete-size-http.test.ts` | complete 的体积闸必须以对象 Head 为权威：超限对象不得进审批。 | 剧本 M1 · prds/10-delivery/03-acceptance-scenarios.md · ADR-039 | `POST …/documents/:docId/complete` | mock 仓 + headObject 超限 → 413 且不 markCompletePending、不读正文；限额内对照 200。 | 现行 |
| `ingest/complete-head-authority.test.ts` | 改前端/预签名声明都不得改变 complete 的体积判定。 | 剧本 M5 · 剧本 M6 · ADR-039 | `POST …/documents/upload-url · POST …/complete` | declaredByteSize 与 upload-url 的 maxBytes 只是声明；Head 超限仍 413，反向声明超大也放行合规对象。 | 现行 |
| `ingest/upload-media.test.ts` | upload-url / PUT 必须拒绝未知 MIME，不得默许 octet-stream。 | ADR-039 · 功能表 §5.2 | `checkUploadMedia · POST upload-url · PUT /internal/objects` | 415 `UNSUPPORTED_MEDIA_TYPE`；不建档。 | 现行 |
| `ingest/upload-size-tier.test.ts` | 上传生效上限须按族取档：MD/TXT 更严（默认 10 MiB），其余 50 MiB，族级可关。 | 功能表 §5.2 / §6「MD/TXT 可更严」· prds/09-security §7 | `effectiveMaxUploadBytes` | 默认 10/50 MiB；族级 0 = 关闭；仍受 min 约束。 | 现行 |
| `ingest/complete-media.test.ts` | complete 必须拒绝未知 MIME，checksum 不一致不得进审批。 | ADR-039 · 功能表 §5.2 | `POST …/complete` | 合法类型写入 checksum；octet-stream 415。 | 现行 |
| `ingest/document-mappers.test.ts` | 文档列表/详情 DTO 映射稳定。 | 基建: 文档 DTO 映射 | `document mappers` | 纯函数；含分片策略与参数快照只读回读。 | 现行 |
| `ingest/document-doctype.test.ts` | 文档类型 PATCH 必须属于该 KB 已有枚举，非法码须 400。 | 功能表 §4.3 | `PATCH /documents/:docId docType · assertDocTypeAllowed` | 空枚举不可写非空码；停用码不得新标。 | 现行 |
| `ingest/document-lifecycle-http.test.ts` | 文档 lifecycle 四态可写；上架仍须 status=ready。 | 功能表 §4.3 | `PATCH /documents/:docId/lifecycle` | 不测生效区间。 | 现行 |
| `ingest/document-meta.test.ts` | 文档元数据 PATCH 正确处理部门两字段。 | P3b-META | `documents meta PATCH` | 部门两字段。 | 现行 |
| `ingest/document-effective-window.test.ts` | 文档生效区间 PATCH 必须可写可回读，乱序与非法格式须 400。 | 功能表 §4.3 / §5.4 | `PATCH /documents/:docId effectiveFrom/effectiveTo` | 不改 lifecycle；检索真值在 corpus。 | 现行 |
| `ingest/document-supersede.test.ts` | 文档替代必须写两列并把旧文关检索、后继升 active。 | 功能表 §4.3 / §5.2 · ADR-020 · 剧本 E2 | `evaluateSupersedeLink · POST /documents/:docId/supersede` | 无后继 PATCH superseded 不在本文件；R7 主锚仍双闸。 | 现行 |
| `ingest/document-delete.test.ts` | 文档删除必须先 archived 再入队 purge，PATCH 归档不得入队。 | 功能表 §5.2 · ADR-020 · 剧本 E3 | `evaluateDocumentDelete · DELETE /documents/:docId` | PATCH archived 不入队。R7 主锚仍双闸。无 PG 硬删。 | 现行 |
| `ingest/document-validation.test.ts` | 文档写入校验拒绝非法字段。 | 入库 HTTP | `documents validation` | 文档写入校验。 | 现行 |
| `ingest/gates-live.test.ts` | live 闸组合在真实 handler 下拒绝未审批 complete。 | complete 闸 | `createApp document gates` | 无 Docker / not ready 时 skip。 | 现行 |
| `ingest/jobs-query.test.ts` | 入库任务列表项映射保持查询契约。 | prds/06-async | `toIngestJobListItem` | 入队在 api，消费在 worker。 | 现行 |
| `ingest/no-self-approve.test.ts` | 提交人不得批自己的单（四眼）；认不出 actor 或提交人时不得误伤运营台。 | prds/09-security 禁自审默认（P2）· ADR-048 #4 · 剧本 V3 | `POST /documents/:docId/approve` · `POST /documents/:docId/reject` | 自审 403 且不写审批；他人审批 200 并记审批人；无 actor / 提交人未知不拦；已通过幂等不改判。 | 现行 |
| `ingest/upload-to-active-retrievable.test.ts` | 上传 complete 进审批后仍不可检索；只有双就绪（ready∧active）才允许成员 ask 命中该文档。 | 剧本 A2 · P2必签 · P0 R7 · prds/04-pipelines/01-offline-ingest.md | `documents upload-url / complete / lifecycle · POST /knowledge-bases/:kbId/ask` | 未就绪 ask 拒答 kb_not_ready、PATCH active 409；ready 后 active 才 answered 且 citation 指该文档。 | 现行 |
| `ingest/write-document-http.test.ts` | 在线编写必须落 Markdown 对象并进 pending，不得入队 scan。 | 功能表 §4.3 · 剧本 V7 最小 · 工单「上传表单标部门最小闭环」 | `POST …/documents/write` | sourceType=write；空白拒；未实现策略 400；可带部门两字段；提交人随令牌落库。无 BlockNote。 | 现行 |
| `ingest/ocr-rerun-http.test.ts` | 卡在 OCR 闸的文档 reindex 必须入队 ocr；短 utf8 与 ready 仍入队 chunk。 | 剧本 Q7 · ADR-043 · P5 历史 needs_ocr 重跑 | `POST /documents/:docId/reindex` · `reindexEnqueueStage` | 无新 HTTP。不自动全库。≠ 真引擎。 | 现行 |
| `ingest/ingest-report-http.test.ts` | 库级 GET ingest-report 须成员可读、空列表 200、缺库 404。 | prds/05-api GET ingest-report · 功能表 §5.2 | `GET /knowledge-bases/:kbId/ingest-report` | 回已落库行含跨 doc 冲突对；不是 doc 级路径。 | 现行 |
| `ingest/ingest-report-map.test.ts` | 入库报告行映射不得把 null 对账、未记录的去重率或未记录的 contextualize 计数填成 0 装齐。 | 功能表 §5.2 · prds/04-pipelines §5.2 | `toIngestReportItem` | 查询契约；落库在 worker；去重率与 L1/L0 计数 null 原样回读。 | 现行 |
| `ingest/reindex-strategy.test.ts` | reindex / complete 按库可用策略计数：仅 1 个可自动，未实现 400。 | B12 · 功能表 §4.5 | `documents reindex / complete` | 未实现 400；选择规则走 available。 | 现行 |
| `ingest/complete-no-scan-enqueue.test.ts` | complete 合法文件后只进审批，不得入队 ingest.scan。 | 剧本 V1 · ADR-048 | `POST …/documents/:docId/complete · services/queue.js` | complete 200 → enqueueIngest 零调用且 pending；对照：显式 scan 才入队、未批仍 403。 | 现行 |
| `ingest/complete-pending-role.test.ts` | doc_operator 上传 complete 必须 200 进 pending 且不自动 scan，调审批仍 403。 | 剧本 Y2 / Y3 · ADR-048/051 | `POST …/documents/:docId/complete · POST …/approve` | enforce 开 + doc_operator 令牌 + mock 仓；enqueue 零调用。 | 现行 |
| `ingest/no-forged-ready.test.ts` | 不存在「跳过审批直写 ready」的 API；approve 也不等于 ready。 | 剧本 V6 · 剧本 V8 · ADR-048 | `PATCH /documents/:docId · PATCH …/lifecycle · POST …/approve · POST …/scan` | 夹带 status 400 且不写仓；/documents/:docId/status 404；approve 后 PATCH active 409。 | 现行 |
| `ingest/reindex-version.test.ts` | reindex 的新 indexVersion 由 worker 物化：api 不得复用旧版本或假装已抬版本。 | 剧本 AA6 · ADR-053 / ADR-038 | `POST /documents/:docId/reindex · services/queue.js 载荷` | 载荷 stage=chunk 且无 indexVersion；响应无该字段；不写文档 version/ready 位。 | 现行 |
| `ingest/reject-http.test.ts` | admin 驳回后不得入队 scan。 | 剧本 V5 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048 | `POST /documents/:docId/reject` · `POST …/scan` | reject 200 后 scan 403 且不入队；无独立重提 API。 | 现行 |
| `ingest/sensitive-complete.test.ts` | 敏感文档 complete 必须过 ACL 就绪闸。 | 审批/密级 · P3b-SENS 解禁 | `documents sensitive complete` | 部门路径或显式名单；null 仍挡。 | 现行 |
| `kb/ask-mode-doc-types.test.ts` | KB 允许的 mode/docTypes 必须正确解析，非法请求拒绝。 | B2-W | `resolveAskMode / parseDocTypesFromConfig / assertScopeDocTypesAllowed` | B2-W resolveAskMode / docTypes。 | 现行 |
| `kb/chunk-strategies-http.test.ts` | 分片策略 catalog / for-upload / 库启用 PATCH 必须落库语义，无码 403，未知码 400；contextMode 非法拒写。 | 功能表 §4.5 · ADR-053 · 入库 PRD §4 | `createChunkStrategyRoutes` | kb.config.write 写面；for-upload 给上传人选。 | 现行 |
| `kb/chunk-strategy-preserves-docs.test.ts` | 保存分片策略必须不改既有文档的 index_version、chunk 边界与参数快照。 | 剧本 AA1 · ADR-053 | `createChunkStrategyRoutes` PATCH · `applyKbChunkStrategyPatch` | 文档+chunk 夹具深等；文档写仓若被调用即改夹具 → 变红；含「策略行确已变」的正向对照与无 diff 不落审计。 | 现行 |
| `kb/chunk-strategy-audit.test.ts` | 分片策略 PATCH 有 diff 必须落服务端修改日志，无 diff 不得落，且不得改旧文档版本与快照。 | IA §2.2 · 功能表 §4.2 / §4.5 · 剧本 AA1 | `createChunkStrategyRoutes` PATCH · `applyKbChunkStrategyPatch` diff | 复用 KB 设置审计表（不新建表）；只动 kb_chunk_strategies。 | 现行 |
| `kb/create-kb-with-models.test.ts` | 建 KB 后必须能把 generate/embed/rerank 三个消费绑定配到位并解析成运行时网关配置。 | 剧本 A1 · P2必签 · prds/05-api §2.1 · ADR-055 | `POST /knowledge-bases · PUT /knowledge-bases/:kbId/model-bindings · applyBindingsToGatewayConfig` | 三通道解析到 DB provider（含 embed 维度）；未配通道回落 env，不假装已配。 | 现行 |
| `kb/create-kb.test.ts` | 创建知识库必须指定首位库管，且租户只认令牌、不认 body。 | prds/05-api §2.1 | `POST /knowledge-bases` | 写入 kb_members(role=admin)；缺用户 404。≠ 成员 PUT。 | 现行 |
| `kb/data-class-complete.test.ts` | sensitive 文档 complete 必须过 ACL 就绪闸。 | P3b-SENS | `parseDataClassFromConfig / isSensitiveCompleteBlocked` | 部门路径或显式名单；null 仍挡。 | 现行 |
| `kb/doc-type-catalog.test.ts` | 知识库类型分区必须从 config 解析 catalog，停用码不得进入启用列表。 | 功能表 §4.2 文档类型 · ADR-054 · 工单「类型分区 CRUD 最小闭环」 | `parseDocTypeCatalogFromConfig / parseDocTypesFromConfig / mergeKbSettingsPatch / toMemberDocTypeItems` | 旧 string[] 合成全启用；简写 PATCH 写成 catalog。 | 现行 |
| `kb/doc-type-catalog-http.test.ts` | PATCH 类型分区后 GET settings 与成员 GET /doc-types 必须回读启用项真 label。 | 功能表 §4.2 / §5.2 · ADR-054 · ADR-050 · 工单「类型分区 CRUD 最小闭环」 | `PATCH /knowledge-bases/:kbId/settings · GET /doc-types` | 重复码 400；停用不出成员枚举。 | 现行 |
| `kb/kb-consume-bindings-http.test.ts` | KB 消费绑定 PUT 只接受 generate/embed/rerank，写入 judge 必须 400。 | 功能表 §4.2 · ADR-055 · 工单「KB 消费绑定最小闭环」 | `PUT /knowledge-bases/:kbId/model-bindings` | 空 map 跟随平台；judge 不落行。 | 现行 |
| `kb/dept-acl-enforce-resolve.test.ts` | KB deptAclEnforce 覆盖 env，未写时展示与运行时分钉。 | P3b-KBENF | `parseDeptAclEnforceFromConfig / resolveDeptAclEnforce` | P3b-KBENF。 | 现行 |
| `kb/dept-inherit-down.test.ts` | KB deptInheritDown 覆盖 env，祖先在关闭向下继承时不可见子孙。 | P3b-KBINH | `parseDeptInheritDownFromConfig / resolveDeptInheritDown / filterDocsForDeptAcl` | P3b-KBINH。 | 现行 |
| `kb/settings-http.test.ts` | 知识库设置 HTTP 按 B2 契约读写；PATCH 后同一 app 立刻按新 mode 白名单问。 | B2 · 剧本 AB2 | `kb-settings routes · POST /ask` | 设置 HTTP；PATCH → ask 用新 allowedModes（旧档 400）。 | 现行 |
| `kb/settings-audit-http.test.ts` | PATCH settings 有 diff 须落可查询修改日志；空 diff / 失败不写；读面权限与空列表/缺库对齐。 | 功能表 §4.2 | `PATCH/GET /knowledge-bases/:kbId/settings-audit` | 有 diff 的 PATCH → GET 见该行；空 diff 不增行；无码 403；空列表 200；缺库 404。 | 现行 |
| `kb/visible-list.test.ts` | 可见知识库列表只返回当前身份能看到的库。 | 壳下拉数据 | `selectVisibleKbs / toKbListItem` | 可见库列表。 | 现行 |
| `obs/admin-write-audit.test.ts` | 管理写路径必须打审计日志且不落表、不含敏感键；超管非成员写仍可追溯。 | ARCH-P1b-2 · 剧本 B1-5 | `adminWriteAuditMiddleware / shouldAuditAdminWrite` | 不落表；KB 作用域写日志上下文带 kbId。 | 现行 |
| `obs/l2-stale.test.ts` | rewrite dogfood 下 L2 指纹过期才告警。 | ARCH-P2-4 | `evaluateL2Stale` | rewrite dogfood 下 L2 指纹过期才告警。 | 现行 |
| `obs/l3-ask.test.ts` | L3 ask 计数与护栏告警闩按阈值只告一次。 | ARCH-P2-4 | `recordL3Ask` | L3 ask 计数满阈只告一次，护栏告警有闩。 | 现行 |
| `obs/l3-topic-complaint.test.ts` | 主题投诉计数满阈只告一次。 | ARCH-P2-4 | `recordL3TopicComplaint` | 主题投诉计数满阈只告一次。 | 现行 |
| `obs/l3-rewrite-fuse.test.ts` | L3 护栏闩后本进程后续 ask 强制关掉 rewrite，dogfood 闩不熔断。 | prds/08-quality §0 L3 · 运维 §2.5 | `isL3RewriteFused / executeAsk` | coref/topic/l2_stale 闩后即使 env 为 true 也 rewriteUsed=false；会话壳仍落 transcript；rewrite_dogfood 不熔；复位后恢复。 | 现行 |
| `obs/metrics.test.ts` | ask/llm/rerank 指标必须可按标签聚合（含 llm 的 fallback 维与 rerank 的 node 维）。 | ARCH-P2-4 · 功能表 §10.3 | `recordAskResult / recordLlmCall / recordRerank / recordRerankNodeUsed / recordRerankAttemptFail` | 按标签聚合；fallback 未给值记 unknown；rerank 按端点记 node。 | 现行 |
| `obs/metrics-fallback-wiring.test.ts` | fallback 与 rerank 节点真值必须从 Gateway 流到指标标签，不得由 api 侧猜。 | 功能表 §10.3 · prds/07-models §5.1.1 | `chatFromGateway · createMockGateway（rerank 端点链）` | meta.fallbackUsed → 标签；换端点记 node/fallback；失败记 unknown。 | 现行 |
| `obs/plane-quota-safe-default.test.ts` | staging/production 缺 plane 配额必须回落安全默认并告警，且不拒绝启动。 | 剧本 R10 · prds/07-models §7 | `resolvePlaneQuota / planeQuotasFromEnv / logPlaneQuotaGaps` | dev·test 的 0 仍关闭；staging·production 的 0 变安全默认且只告警该平面；显式正数原样生效。 | 现行 |
| `obs/quota-planes.test.ts` | ask 与 ingest 平面配额必须隔离，触顶不得 200 空答 answered。 | 剧本 R5 / R8 / R9 · ARCH-P2-4 | `POST ask / POST complete / 分 store / plane 指标` | ask 429 带 plane=ask 与 ask_quota_exhausted；ingest 429 带 plane=ingest；打满一侧不阻断另一侧。 | 现行 |
| `obs/rate-limit.test.ts` | 超限必须返回 429 RATE_LIMITED。 | ARCH-P2-4 | `checkFixedWindowRateLimit / POST ask 429` | 超限返回 429 RATE_LIMITED；ask 路由走同一闸。 | 现行 |
| `obs/tracer.test.ts` | memory tracer 记录主链 span，executeAsk 接线不得丢 span。 | ARCH-P2-4 | `createMemoryTracer / executeAsk` | 内存 tracer 记下主链 span；executeAsk 接线不得丢 span。 | 现行 |
| `ops/dashboard-http.test.ts` | 面板 summary 按 B6 返回聚合；tracks 分开展示质量与延迟且不改 summary 信封；面板无 τ/门禁写入口。 | B6 · 剧本 I4 / W6 | `createDashboardRoutes / summarizeLatencies` | summary HTTP + 双轨 tracks；写方法与 τ 字段都不存在。 | 现行 |
| `sessions/http.test.ts` | 会话壳 HTTP 可用；列表分页与越界按契约；在 B 会话发问时近窗不得含 A 的文本。 | 剧本 U2 · 剧本 U5 · 历史≠evidence · rewrite 默认关 | `createSessionRoutes · createAskRoutes（executeAsk 近窗装载）` | 多会话建/列/详情与 limit/offset 边界；B 会话 ask 的近窗只取本 session transcript。 | 现行 |
| `sessions/session-window.test.ts` | 近窗裁剪后历史不得当作 citation。 | 历史≠evidence | `clipSessionWindow / resolveBackReference` | 不把历史当 citation。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
