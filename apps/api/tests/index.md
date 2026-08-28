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
| `acl/` | 成员、部门、kb-scope、列表同滤 | ADR-051 · DEPT_ACL |
| `kb/` | 知识库列表与设置 | B2 / B2-W |
| `sessions/` | 会话壳、近窗 | 历史≠evidence · rewrite 默认关 |
| `feedback/` | 答案反馈 API | B13 |
| `gateway/` | 模型绑定 / mock / 双节点 | B3 · QUAL-3 |
| `eval/` | L1/L2 工程 seed | B10 · **≠ 准出** |
| `obs/` | 指标、限流、写审计 | ARCH-P2-4 · ARCH-P1b-2 |
| `env/` | env、health/ready、OpenAPI | P0 骨架 |
| `docs-guard/` | 交付文档护栏 | 控制台 §0.5 |
| `ops/` | 数据面板 HTTP | B6 |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `acl/chunk-body-patch-denied.test.ts` | PATCH/PUT chunk body 必须拒绝，且不走写仓。 | 剧本 Z7 · ADR-052 | `PATCH/PUT /documents/:docId/chunks/:chunkId` | 仅 GET 路由；404/405；无写仓调用。≠ Mongo 正文未变。 | 现行 |
| `acl/chunks-dept-filter.test.ts` | chunks 列表必须套部门过滤。 | DEPT_ACL | `GET /documents/:docId/chunks` | chunks 列表部门过滤。 | 现行 |
| `acl/departments-http.test.ts` | 部门壳 HTTP 按契约读写。 | B5 | `createDepartmentsRoutes` | 部门壳 HTTP。 | 现行 |
| `acl/dept-grants-http.test.ts` | 跨部门 grant HTTP 按 DEPT_ACL 约束。 | DEPT_ACL | `createDeptGrantsRoutes` | 跨部门 grant。 | 现行 |
| `acl/documents-dept-filter.test.ts` | 文档列表必须套部门过滤。 | DEPT_ACL | `documents list dept filter` | 文档列表部门过滤。 | 现行 |
| `acl/kb-member-gate.test.ts` | 无 KB 成员必须 403，授权以码为准。 | 以码为准 | `requireKbMember / requirePermission` | 无成员 403。 | 现行 |
| `acl/kb-scope-cache.test.ts` | KB 成员查找在同一请求内复用缓存。 | ARCH-P1b-1 | `lookupKbMembership / membershipCacheKey` | KB 成员查找请求内缓存。 | 现行 |
| `acl/members-http.test.ts` | 成员 CRUD HTTP 按成员码授权。 | 成员码 | `createMemberRoutes` | 成员 CRUD HTTP。 | 现行 |
| `acl/permission-resolve.test.ts` | 有效权限码 = 模板 ∪ grants − denies。 | ADR-051 | `resolveEffectiveCodes / canAccessKbScoped` | 有效码求值。 | 现行 |
| `acl/platform-users-roles.test.ts` | 平台用户角色写路径必须失效缓存。 | B4 | `platform-users-roles routes` | 写路径 invalidate 缓存。 | 现行 |
| `acl/retrieve-dept-acl.test.ts` | 检索期按部门 ACL 过滤可见文档。 | DEPT_ACL | `filterDocsForDeptAcl` | 默认 enforce 关。 | 现行 |
| `acl/system-roles-skip-reseed.test.ts` | 已有 isSystem 角色则不再 insert 系统角色。 | 剧本 AD3（部分） | `ensureSystemRoles` | 只锁跳过重种子，≠ 补码、≠ 不重置密码（无该启动器）。 | 现行 |
| `ask/body-lt-passthrough.test.ts` | 制度正文中的 `<` 必须原样进入 generate，不得被 HTML escape 成 `&lt;`。 | 剧本 K6 · prds/10-delivery/03-acceptance-scenarios.md · ADR-037 | `runAskGraph（generate / claim_split user 消息）` | evidence.text 含尖括号时 prompt 保留原字符。feedback 脚本消毒不在本包。 | 现行 |
| `ask/budget.test.ts` | mode 预算表与 tryCharge 闸；检索/LLM 额度耗尽不得 answered。 | ADR-032 · prds/04-pipelines | `budgetForMode / tryChargeLlm / tryChargeRetrieve / runAskGraph 预算路径` | 校验 mode 默认额度与 tryCharge；检索/LLM 耗尽须 abstained。 | 现行 |
| `ask/citations.test.ts` | 非法 citation 不得 answered；混合法/非法只保留证据 id 并仍走 verify。 | prds/08-quality | `runAskGraph（generate+citations）` | 非法引用拒答；混合引用只留证据 id；insufficient 走 model_abstained。 | 现行 |
| `ask/embed-budget.test.ts` | query embed 只发生在 retrieve，次数不超过 retrieve 次且不计入 LLM 预算。 | 剧本 R1 · 剧本 R2 · 剧本 R3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-044 | `runRetrieve embed / runAskGraph` | 两次 retrieve 只 embed 两次；图节点不调 embed；不得把 chunk 正文传入 embed。 | 现行 |
| `ask/es-sparse-probe.test.ts` | 稀疏探针脚本在缺少 KB 时必须拒绝误跑。 | OPS-1 | `requireProbeKbId` | 非生产 ES 宣称。 | 现行 |
| `ask/es-sparse.test.ts` | 稀疏检索 HTTP 切片按 env 解析，失败不得静默回 mock。 | OPS-1 | `esConfigFromEnv / searchSparseEs` | 稀疏检索 HTTP 切片。 | 现行 |
| `ask/evidence-verbatim.test.ts` | 当轮 evidence.text 进入 generate/verify 与 citation 必须逐字一致，不得改写。 | 剧本 K4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-037 | `runAskGraph（generateUserPrompt / claim_split / citation.preview）` | 现权威为 evidence.text / PG body，≠ Mongo。 | 现行 |
| `ask/execute-trace.test.ts` | executeAsk 落 trace 时历史文不得进入 evidence。 | prds/05-api · 历史≠evidence | `executeAsk` | 落库 trace 时只记录本轮 evidence，不把历史文写进快照。 | 现行 |
| `ask/history-not-evidence.test.ts` | 会话历史与加深窗文本不得进入 evidence / 不得充当 verify 依据。 | 历史≠evidence · prds/04-pipelines | `runAskGraph（history / evidence_snapshot）` | 有 session 仍只凭 evidence 验证；历史与加深窗文本不得进 snapshot/citations。 | 现行 |
| `ask/http-stream.test.ts` | 同步与 SSE 终态字段必须一致；空库走 200 拒答；execute 抛错仍要给出 final。 | prds/05-api | `POST /knowledge-bases/:kbId/ask sync / SSE` | 同步与流式终态一致；kb_not_ready 为 200 拒答信封；execute 抛错仍须给出 final。 | 现行 |
| `ask/http-validation.test.ts` | POST ask 校验、鉴权与 sessionId 闸必须按契约拒绝非法请求。 | prds/05-api | `POST /knowledge-bases/:kbId/ask` | 非法 body、无鉴权与非法 sessionId 须按契约拒绝。 | 现行 |
| `ask/min-veto.test.ts` | claim 级 min 不达标时整答必须拒答，禁止均值洗白后 answered。 | P0 R8 · prds/08-quality/01-verification-and-abstention.md | `runAskGraph（judge 分数路径）` | 单条低分 claim 即整答拒答，不看均值。 | 现行 |
| `ask/mode-doc-types-gate.test.ts` | ask 入口按 KB 允许的 mode/docTypes 拦截非法请求。 | B2-W | `POST /knowledge-bases/:kbId/ask mode/docTypes 闸` | mode/docTypes 闸。 | 现行 |
| `ask/question-html-passthrough.test.ts` | 含 HTML/特殊字符的问句必须原样进入 retrieve，不得被 escape 破坏检索语义。 | 剧本 H7 · prds/10-delivery/03-acceptance-scenarios.md | `runAskGraph（retrieve.question）` | 问句含 HTML 片段时 retrieve 收到的 question 等于原始字符串。 | 现行 |
| `ask/ready-active-corpus.test.ts` | 未 ready∧active 的文档不得进入检索集。 | P0 R7 | `filterDocsForRetrieve / loadCorpus 同形` | 生产装载路径，非仅 db 纯函数。 | 现行 |
| `ask/retrieve-outcomes.test.ts` | 检索阶段失败或闲聊短路时不得用假 evidence 洗成 answered。 | prds/04-pipelines · prds/08-quality | `runAskGraph（route+retrieve）` | 闲聊不检索；空证据/rerank/kb 未就绪须拒答，userId 透传到 retrieve。 | 现行 |
| `ask/retrieve-run.test.ts` | runRetrieve 双闸、preferred 提升与语料责任边界必须成立。 | prds/04-pipelines | `runRetrieve / promotePreferredDocChunks` | 默认 mock ES；双闸由 caller corpus 负责。 | 现行 |
| `ask/rewrite-disabled.test.ts` | rewrite 关闭或无 loader 时不得改写问句、不得 500。 | SESSION_REWRITE_ENABLED 默认关 | `runAskGraph（rewrite 关）` | 关开关、无会话、fast、无 loader 时不调用 rewrite，也不 500。 | 现行 |
| `ask/rewrite-min.test.ts` | rewrite 最小开路径：弱指代独立问句、未解析则不检索、回指四态派生正确。 | prds/04-pipelines P2.5 rewrite min | `runAskGraph（rewrite 开）` | 开 rewrite 时检索用独立问句；未解析不检索；session/document/external 回指四态。 | 现行 |
| `ask/rewrite-parse.test.ts` | 改写输出必须是合法独立问句；resolved=false / 非法 JSON / 空白须抛错。 | prds/04-pipelines rewrite | `parseRewriteOutput` | standalone 合法才通过；resolved=false、非法 JSON、空白 standalone 抛错。 | 现行 |
| `ask/route-rules.test.ts` | 闲聊走 chitchat，知识/政策问句走 single，禁止政策句被当成闲聊。 | prds/04-pipelines/02-online-ask-langgraph.md | `ruleRoute` | 问候为 chitchat；带知识/政策词的问句必须 single。 | 现行 |
| `ask/scope-hr-excludes-finance.test.ts` | hr scope 不得用 finance 文档作答。 | 剧本 X3 | `filterDocsForRetrieve / runRetrieve / runAskGraph` | scope.docTypes=hr 滤掉 finance；无证据或非法 citation 则拒答。 | 现行 |
| `ask/scoring-rrf.test.ts` | 混合检索的余弦相似与 RRF 融合按预期排序。 | prds/04-pipelines | `cosine / rrfFuse` | 打分与倒数秩融合的纯函数。 | 现行 |
| `ask/sparse-kb-filter.test.ts` | 共享索引查询必须带 kbId term，外库 chunk 不得进 evidence。 | 剧本 O1 | `searchSparseEs / runRetrieve` http sparse | 默认 mock ES；锁 kbId filter。≠ 独立索引；≠ tenantId 门禁（O4）。 | 现行 |
| `ask/verify-required.test.ts` | 合法 draft 必须完整 verify；拆句失败或网关错不得 answered。 | P0 R9 · prds/08-quality | `runAskGraph（verify / claim_split）` | happy 必经 generate+claim_split+judge；拆句失败或网关错不得 answered。 | 现行 |
| `auth/enforce-401.test.ts` | AUTH_ENFORCE 开启且无 Bearer 时必须 401。 | QUAL-1 | `requirePermissionWhenEnforced` | enforce 开且无 Bearer → 401。 | 现行 |
| `auth/role-hydrate.test.ts` | 每请求角色 hydrate 超时必须回退，缓存不超过 5s。 | B4-W | `role-hydrate middleware` | ≤5s 缓存。 | 现行 |
| `auth/token-service.test.ts` | access jti 与 refresh 轮转在同一秒内可区分。 | prds/09-security | `issueTokenPair / rotateRefresh` | 同秒可区分。 | 现行 |
| `docs-guard/auth-enforce-pilot.test.ts` | 试点文档与 AUTH_ENFORCE 开关默认值保持一致。 | docs/ops/auth-enforce-pilot.md | `docs/ops/auth-enforce-pilot.md · .env.example` | 文档护栏。 | 现行 |
| `docs-guard/delivery-s05.test.ts` | 交付控制台 §0.5 已闭合待盘点行不得回退。 | 交付控制台 | `prds/12-delivery-guides/04-交付控制台.md` | 读 PRD 文件，非 mock。 | 现行 |
| `env/body-limit.test.ts` | 超限 JSON body 必须 413 PAYLOAD_TOO_LARGE。 | prds/05-api · ARCH-P0 | `createApp body-limit` | 超限 JSON body 必须 413 PAYLOAD_TOO_LARGE。 | 现行 |
| `env/defaults.test.ts` | api env 默认值保持关闭态，tauClaim 双源冲突必须拒绝。 | 基建: api env Zod | `env Zod 对齐（不启动进程）` | rewrite / AUTH_ENFORCE 默认关。 | 现行 |
| `env/error-envelope.test.ts` | 未知路径与未处理异常必须走统一错误信封，且不得泄漏 stack。 | prds/05-api · ARCH-P0 | `createApp onError / isAskTimeoutExcept / isBodyLimitExcept` | 未知路径与未处理异常走统一信封，且不得泄漏 stack。 | 现行 |
| `env/health-ready.test.ts` | health 探针必须返回 ok。 | P0 | `GET /health` | health/ready。 | 现行 |
| `env/openapi-document.test.ts` | OpenAPI 文档必须从 contracts 生成。 | ARCH-P2-1 | `buildOpenApiDocument / isOpenApiDocsEnabled` | OpenAPI 文档自 contracts 生成。 | 现行 |
| `env/openapi-routes.test.ts` | /openapi.json 与 /docs 路由按开关暴露。 | ARCH-P2-1 | `createOpenApiRoutes` | /openapi.json · /docs。 | 现行 |
| `env/pg-error.test.ts` | PG 错误码必须映射到业务码。 | 基建: PG 错误映射 | `extractPgError / mapPgErrorToBiz` | PG 错误映射。 | 现行 |
| `env/ready-hard-deps.test.ts` | GET /ready 在 PG 或 Redis 不可用时必须 503 且 ready 为 false。 | 剧本 H3 · prds/10-delivery/03-acceptance-scenarios.md | `GET /ready · runReadyChecks（postgres/redis 硬依赖）` | mock createDb 抛错或 ioredis ping 失败 → 503；不停本机 PG。 | 现行 |
| `env/ready-soft-gateway.test.ts` | Gateway 不可用时 GET /ready 仍 200，不得因软依赖否决。 | 剧本 H4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-028 | `GET /ready · checkGateway` | PG/Redis mock 为 up、Gateway fetch 失败时 checks.gateway 为 down 且 ready 为 true。 | 现行 |
| `eval/adr046-snapshot.test.ts` | 评测快照绑定硬门不得松于试点。 | ADR-046 | `evaluateAdr046Bind / bindQualitySnapshotToEval` | 评测快照绑定硬门。 | 现行 |
| `eval/l1-cli.test.ts` | L1 CLI 注入路径可跑且 skipTrace，不打 live。 | B10 | `runL1Golden / loadGold / writeL1Report` | 注入路径可跑且跳过落库 trace，不打 live。 | 现行 |
| `eval/l1-matrix.test.ts` | L1 2×2 纯函数累计与覆盖计算正确，且不得当作签字。 | B10 | `cellFor / accumulate / coverage / computeSignoffEligible` | ≠ 签字；error 出格。 | 现行 |
| `eval/l2-cli.test.ts` | L2 CLI 注入可跑且 signoffEligible 恒为 false。 | P2.5-L2 | `runL2Golden / parseL2CliEnv` | 注入可跑，且准出资格恒为否。 | 现行 |
| `eval/l2-fingerprint.test.ts` | rewrite 指纹纯函数稳定，且不因此打开 rewrite。 | ADR-046 相关 | `l2RewriteFingerprint` | 非开 rewrite。 | 现行 |
| `eval/l2-gold.test.ts` | L2 题面加载拒绝非法文件，且不得当作准出。 | P2.5-L2 | `loadL2Gold / l2TypeCoverage / defaultL2GoldPath` | ≠ 准出。 | 现行 |
| `eval/stricter-than-pilot-bind.test.ts` | 加严快照必须标 stricterThanPilot，并带相对默认 diff 与 evalRunId 关联。 | 剧本 T7 · prds/10-delivery/03-acceptance-scenarios.md · ADR-046 | `bindQualitySnapshotToEval` | coverageMin 上调后 stricterThanPilot 为 true，evalBindId 含该 evalRunId。不测人签/审计 HTTP。 | 现行 |
| `feedback/http.test.ts` | 答案反馈 POST/PATCH 必须具备 kb 码。 | B13 | `createFeedbackRoutes` | 须 kb 码。 | 现行 |
| `gateway/bindings-http.test.ts` | 供应商绑定 HTTP 按 B3 契约读写。 | B3 | `model-gateway routes` | 供应商绑定 HTTP。 | 现行 |
| `gateway/resolve-mock.test.ts` | 网关解析缺 URL 时走 mock，绑定覆盖与重试保持契约。 | B3 · QUAL-3 | `buildGatewayConfig / applyBindingsToGatewayConfig / mock+http retry` | 缺 URL → mock。 | 现行 |
| `ingest/approval-scan.test.ts` | 审批未过不得 complete / 入扫描。 | 审批未过不得 complete | `canEnqueueScan / canBecomeActive / scanDeniedCode` | 审批扫描闸。 | 现行 |
| `ingest/approve-then-scan.test.ts` | kb_admin 审批通过后必须可 scan 入队。 | 剧本 Y4 | `POST /documents/:docId/approve` · `POST /documents/:docId/scan` | approve 200 后 scan 200 且 enqueue stage=scan。AUTH_ENFORCE 默认关。不测禁自审。 | 现行 |
| `ingest/chunk-strategies.test.ts` | 已实现分片策略可写；未实现必须 400，禁止静默 default。仅 1 个可自动，≥2 未选须 400。 | B12 · X-03 · 功能表 §4.5 | `chunk-strategies` | 禁静默 default；绑定/reindex 选择规则。 | 现行 |
| `ingest/chunks-http.test.ts` | chunks HTTP 只读路由按成员与文档闸返回。 | B1 | `createChunkRoutes` | chunks HTTP。 | 现行 |
| `ingest/chunks-query.test.ts` | 分片只读查询返回 preview/body 契约。 | ADR-052 · B1 | `buildPreview / buildBody` | 分片只读查询。 | 现行 |
| `ingest/complete-size.test.ts` | complete 体积超限必须拒绝。 | 上传/complete 限 | `checkUploadByteSize` | complete 体积闸。 | 现行 |
| `ingest/document-mappers.test.ts` | 文档列表/详情 DTO 映射稳定。 | 基建: 文档 DTO 映射 | `document mappers` | 纯函数。 | 现行 |
| `ingest/document-doctype.test.ts` | 文档类型 PATCH 必须属于该 KB 已有枚举，非法码须 400。 | 功能表 §4.3 | `PATCH /documents/:docId docType · assertDocTypeAllowed` | 空枚举不可写非空码。 | 现行 |
| `ingest/document-lifecycle-http.test.ts` | 文档 lifecycle 四态可写；上架仍须 status=ready。 | 功能表 §4.3 | `PATCH /documents/:docId/lifecycle` | 不测生效区间。 | 现行 |
| `ingest/document-meta.test.ts` | 文档元数据 PATCH 正确处理部门两字段。 | P3b-META | `documents meta PATCH` | 部门两字段。 | 现行 |
| `ingest/document-validation.test.ts` | 文档写入校验拒绝非法字段。 | 入库 HTTP | `documents validation` | 文档写入校验。 | 现行 |
| `ingest/gates-live.test.ts` | live 闸组合在真实 handler 下拒绝未审批 complete。 | complete 闸 | `createApp document gates` | 无 Docker / not ready 时 skip。 | 现行 |
| `ingest/jobs-query.test.ts` | 入库任务列表项映射保持查询契约。 | prds/06-async | `toIngestJobListItem` | 入队在 api，消费在 worker。 | 现行 |
| `ingest/reindex-strategy.test.ts` | reindex / complete 按库可用策略计数：仅 1 个可自动，未实现 400。 | B12 · 功能表 §4.5 | `documents reindex / complete` | 未实现 400；选择规则走 available。 | 现行 |
| `ingest/reject-http.test.ts` | admin 驳回后不得入队 scan。 | 剧本 V5 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048 | `POST /documents/:docId/reject` · `POST …/scan` | reject 200 后 scan 403 且不入队；无独立重提 API。 | 现行 |
| `ingest/sensitive-complete.test.ts` | 敏感文档 complete 必须过审批/密级闸。 | 审批/密级 | `documents sensitive complete` | 敏感 complete。 | 现行 |
| `kb/ask-mode-doc-types.test.ts` | KB 允许的 mode/docTypes 必须正确解析，非法请求拒绝。 | B2-W | `resolveAskMode / parseDocTypesFromConfig / assertScopeDocTypesAllowed` | B2-W resolveAskMode / docTypes。 | 现行 |
| `kb/chunk-strategies-http.test.ts` | 分片策略 catalog / for-upload / 库启用 PATCH 必须落库语义，无码 403，未知码 400。 | 功能表 §4.5 · ADR-053 | `createChunkStrategyRoutes` | kb.config.write 写面；for-upload 给上传人选。 | 现行 |
| `kb/create-kb.test.ts` | 创建知识库必须指定首位库管，且租户只认令牌、不认 body。 | prds/05-api §2.1 | `POST /knowledge-bases` | 写入 kb_members(role=admin)；缺用户 404。≠ 成员 PUT。 | 现行 |
| `kb/data-class-complete.test.ts` | sensitive 文档 complete 必须过密级闸。 | P3b-SENS | `parseDataClassFromConfig / isSensitiveCompleteBlocked` | P3b-SENS dataClass / complete 闸。 | 现行 |
| `kb/dept-acl-enforce-resolve.test.ts` | KB deptAclEnforce 覆盖 env，未写时展示与运行时分钉。 | P3b-KBENF | `parseDeptAclEnforceFromConfig / resolveDeptAclEnforce` | P3b-KBENF。 | 现行 |
| `kb/dept-inherit-down.test.ts` | KB deptInheritDown 覆盖 env，祖先在关闭向下继承时不可见子孙。 | P3b-KBINH | `parseDeptInheritDownFromConfig / resolveDeptInheritDown / filterDocsForDeptAcl` | P3b-KBINH。 | 现行 |
| `kb/settings-http.test.ts` | 知识库设置 HTTP 按 B2 契约读写。 | B2 | `kb-settings routes` | 设置 HTTP。 | 现行 |
| `kb/visible-list.test.ts` | 可见知识库列表只返回当前身份能看到的库。 | 壳下拉数据 | `selectVisibleKbs / toKbListItem` | 可见库列表。 | 现行 |
| `obs/admin-write-audit.test.ts` | 管理写路径必须打审计日志且不落表、不含敏感键。 | ARCH-P1b-2 | `adminWriteAuditMiddleware / shouldAuditAdminWrite` | 不落表。 | 现行 |
| `obs/l2-stale.test.ts` | rewrite dogfood 下 L2 指纹过期才告警。 | ARCH-P2-4 | `evaluateL2Stale` | rewrite dogfood 下 L2 指纹过期才告警。 | 现行 |
| `obs/l3-ask.test.ts` | L3 ask 计数与护栏告警闩按阈值只告一次。 | ARCH-P2-4 | `recordL3Ask` | L3 ask 计数满阈只告一次，护栏告警有闩。 | 现行 |
| `obs/l3-topic-complaint.test.ts` | 主题投诉计数满阈只告一次。 | ARCH-P2-4 | `recordL3TopicComplaint` | 主题投诉计数满阈只告一次。 | 现行 |
| `obs/metrics.test.ts` | ask/llm/rerank 指标必须可按标签聚合。 | ARCH-P2-4 | `recordAskResult / recordLlmCall / recordRerank / metricGet` | 按标签聚合 ask / llm / rerank 计数。 | 现行 |
| `obs/rate-limit.test.ts` | 超限必须返回 429 RATE_LIMITED。 | ARCH-P2-4 | `checkFixedWindowRateLimit / POST ask 429` | 超限返回 429 RATE_LIMITED；ask 路由走同一闸。 | 现行 |
| `obs/tracer.test.ts` | memory tracer 记录主链 span，executeAsk 接线不得丢 span。 | ARCH-P2-4 | `createMemoryTracer / executeAsk` | 内存 tracer 记下主链 span；executeAsk 接线不得丢 span。 | 现行 |
| `ops/dashboard-http.test.ts` | 面板 summary HTTP 按 B6 返回聚合。 | B6 | `createDashboardRoutes` | 面板 summary HTTP。 | 现行 |
| `sessions/http.test.ts` | 会话壳 HTTP 在 rewrite 默认关闭下可用。 | rewrite 默认关 | `createSessionRoutes` | 会话壳 HTTP。 | 现行 |
| `sessions/session-window.test.ts` | 近窗裁剪后历史不得当作 citation。 | 历史≠evidence | `clipSessionWindow / resolveBackReference` | 不把历史当 citation。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
