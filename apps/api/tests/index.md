# @strict-rag/api · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：HTTP、ask 图、检索装载、鉴权验码、入库受理。入库状态机在 worker；用户端三态在 web。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与验收剧本。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | 单轮信任路径、mode/docTypes、检索装载 | `prds/04-pipelines` · `prds/08-quality` · P0 R7–R9 |
| `ingest/` | 入库 HTTP、体积/审批闸、分片策略、文档元数据 | `prds/04-pipelines/01-offline-ingest.md` · B12 |
| `auth/` | JWT、AUTH_ENFORCE、hydrate | `prds/09-security` · QUAL-1 |
| `acl/` | 成员、部门、kb-scope、列表同滤 | ADR-051 · DEPT_ACL |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
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
| `ask/budget.test.ts` | mode 预算表与 tryCharge 闸；检索/LLM 额度耗尽不得 answered。 | ADR-032 · prds/04-pipelines | `budgetForMode / tryChargeLlm / tryChargeRetrieve / runAskGraph 预算路径` | 校验 mode 默认额度与 tryCharge；检索/LLM 耗尽须 abstained。 | 现行 |
| `ask/citations.test.ts` | 非法 citation 不得 answered；混合法/非法只保留证据 id 并仍走 verify。 | prds/08-quality | `runAskGraph（generate+citations）` | 非法引用拒答；混合引用只留证据 id；insufficient 走 model_abstained。 | 现行 |
| `ask/es-sparse-probe.test.ts` | 稀疏探针脚本在缺少 KB 时必须拒绝误跑。 | OPS-1 | `requireProbeKbId` | 非生产 ES 宣称。 | 现行 |
| `ask/es-sparse.test.ts` | 稀疏检索 HTTP 切片按 env 解析，失败不得静默回 mock。 | OPS-1 | `esConfigFromEnv / searchSparseEs` | 稀疏检索 HTTP 切片。 | 现行 |
| `ask/execute-trace.test.ts` | executeAsk 落 trace 时历史文不得进入 evidence。 | prds/05-api · 历史≠evidence | `executeAsk` | 落库 trace 时只记录本轮 evidence，不把历史文写进快照。 | 现行 |
| `ask/history-not-evidence.test.ts` | 会话历史与加深窗文本不得进入 evidence / 不得充当 verify 依据。 | 历史≠evidence · prds/04-pipelines | `runAskGraph（history / evidence_snapshot）` | 有 session 仍只凭 evidence 验证；历史与加深窗文本不得进 snapshot/citations。 | 现行 |
| `ask/http-stream.test.ts` | 同步与 SSE 终态字段必须一致；execute 抛错仍要给出 final。 | prds/05-api | `POST /knowledge-bases/:kbId/ask sync / SSE` | 同步与流式终态一致；execute 抛错仍须给出 final。 | 现行 |
| `ask/http-validation.test.ts` | POST ask 校验、鉴权与 sessionId 闸必须按契约拒绝非法请求。 | prds/05-api | `POST /knowledge-bases/:kbId/ask` | 非法 body、无鉴权与非法 sessionId 须按契约拒绝。 | 现行 |
| `ask/min-veto.test.ts` | claim 级 min 不达标时整答必须拒答，禁止均值洗白后 answered。 | P0 R8 · prds/08-quality/01-verification-and-abstention.md | `runAskGraph（judge 分数路径）` | 单条低分 claim 即整答拒答，不看均值。 | 现行 |
| `ask/mode-doc-types-gate.test.ts` | ask 入口按 KB 允许的 mode/docTypes 拦截非法请求。 | B2-W | `POST /knowledge-bases/:kbId/ask mode/docTypes 闸` | mode/docTypes 闸。 | 现行 |
| `ask/ready-active-corpus.test.ts` | 未 ready∧active 的文档不得进入检索集。 | P0 R7 | `filterDocsForRetrieve / loadCorpus 同形` | 生产装载路径，非仅 db 纯函数。 | 现行 |
| `ask/retrieve-outcomes.test.ts` | 检索阶段失败或闲聊短路时不得用假 evidence 洗成 answered。 | prds/04-pipelines · prds/08-quality | `runAskGraph（route+retrieve）` | 闲聊不检索；空证据/rerank/kb 未就绪须拒答，userId 透传到 retrieve。 | 现行 |
| `ask/retrieve-run.test.ts` | runRetrieve 双闸、preferred 提升与语料责任边界必须成立。 | prds/04-pipelines | `runRetrieve / promotePreferredDocChunks` | 默认 mock ES；双闸由 caller corpus 负责。 | 现行 |
| `ask/rewrite-disabled.test.ts` | rewrite 关闭或无 loader 时不得改写问句、不得 500。 | SESSION_REWRITE_ENABLED 默认关 | `runAskGraph（rewrite 关）` | 关开关、无会话、fast、无 loader 时不调用 rewrite，也不 500。 | 现行 |
| `ask/rewrite-min.test.ts` | rewrite 最小开路径：弱指代独立问句、未解析则不检索、回指四态派生正确。 | prds/04-pipelines P2.5 rewrite min | `runAskGraph（rewrite 开）` | 开 rewrite 时检索用独立问句；未解析不检索；session/document/external 回指四态。 | 现行 |
| `ask/rewrite-parse.test.ts` | 改写输出必须是合法独立问句；resolved=false / 非法 JSON / 空白须抛错。 | prds/04-pipelines rewrite | `parseRewriteOutput` | standalone 合法才通过；resolved=false、非法 JSON、空白 standalone 抛错。 | 现行 |
| `ask/route-rules.test.ts` | 闲聊走 chitchat，知识/政策问句走 single，禁止政策句被当成闲聊。 | prds/04-pipelines/02-online-ask-langgraph.md | `ruleRoute` | 问候为 chitchat；带知识/政策词的问句必须 single。 | 现行 |
| `ask/scoring-rrf.test.ts` | 混合检索的余弦相似与 RRF 融合按预期排序。 | prds/04-pipelines | `cosine / rrfFuse` | 打分与倒数秩融合的纯函数。 | 现行 |
| `ask/verify-required.test.ts` | 合法 draft 必须完整 verify；拆句失败或网关错不得 answered。 | P0 R9 · prds/08-quality | `runAskGraph（verify / claim_split）` | happy 必经 generate+claim_split+judge；拆句失败或网关错不得 answered。 | 现行 |
| `auth/enforce-401.test.ts` | AUTH_ENFORCE 开启且无 Bearer 时必须 401。 | QUAL-1 | `requirePermissionWhenEnforced` | enforce 开且无 Bearer → 401。 | 现行 |
| `auth/role-hydrate.test.ts` | 每请求角色 hydrate 超时必须回退，缓存不超过 5s。 | B4-W | `role-hydrate middleware` | ≤5s 缓存。 | 现行 |
| `auth/token-service.test.ts` | access jti 与 refresh 轮转在同一秒内可区分。 | prds/09-security | `issueTokenPair / rotateRefresh` | 同秒可区分。 | 现行 |
| `ingest/approval-scan.test.ts` | 审批未过不得 complete / 入扫描。 | 审批未过不得 complete | `canEnqueueScan / canBecomeActive / scanDeniedCode` | 审批扫描闸。 | 现行 |
| `ingest/chunk-strategies.test.ts` | 已实现分片策略可写；未实现必须 400，禁止静默 default。 | B12 · X-03 | `chunk-strategies` | 禁静默 default。 | 现行 |
| `ingest/chunks-http.test.ts` | chunks HTTP 只读路由按成员与文档闸返回。 | B1 | `createChunkRoutes` | chunks HTTP。 | 现行 |
| `ingest/chunks-query.test.ts` | 分片只读查询返回 preview/body 契约。 | ADR-052 · B1 | `buildPreview / buildBody` | 分片只读查询。 | 现行 |
| `ingest/complete-size.test.ts` | complete 体积超限必须拒绝。 | 上传/complete 限 | `checkUploadByteSize` | complete 体积闸。 | 现行 |
| `ingest/document-mappers.test.ts` | 文档列表/详情 DTO 映射稳定。 | 基建: 文档 DTO 映射 | `document mappers` | 纯函数。 | 现行 |
| `ingest/document-meta.test.ts` | 文档元数据 PATCH 正确处理部门两字段。 | P3b-META | `documents meta PATCH` | 部门两字段。 | 现行 |
| `ingest/document-validation.test.ts` | 文档写入校验拒绝非法字段。 | 入库 HTTP | `documents validation` | 文档写入校验。 | 现行 |
| `ingest/gates-live.test.ts` | live 闸组合在真实 handler 下拒绝未审批 complete。 | complete 闸 | `createApp document gates` | 无 Docker / not ready 时 skip。 | 现行 |
| `ingest/jobs-query.test.ts` | 入库任务列表项映射保持查询契约。 | prds/06-async | `toIngestJobListItem` | 入队在 api，消费在 worker。 | 现行 |
| `ingest/reindex-strategy.test.ts` | reindex 必须显式策略；未实现返回 400。 | B12 | `documents reindex` | 未实现 400。 | 现行 |
| `ingest/sensitive-complete.test.ts` | 敏感文档 complete 必须过审批/密级闸。 | 审批/密级 | `documents sensitive complete` | 敏感 complete。 | 现行 |

## 待处理

### ask

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/services/ask/session-window.test.ts` | 近窗裁剪 | 历史≠evidence | 不把历史当 citation | 待处理 |

### ingest

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|

### auth / acl

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/auth/auth-enforce-pilot.doc.test.ts` | 试点文档与开关一致 | `docs/ops/auth-enforce-pilot.md` | 文档护栏 | 待处理 |

### kb / sessions / feedback / gateway

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/services/kb-list.test.ts` | 可见库列表 | 壳下拉数据 | | 待处理 |
| `../src/services/kb-settings-mode.test.ts` | KB mode 策略 | B2-W | | 待处理 |
| `../src/routes/kb-settings.test.ts` | 设置 HTTP | B2 | | 待处理 |
| `../src/routes/sessions.test.ts` | 会话壳 HTTP | rewrite 默认关 | | 待处理 |
| `../src/routes/feedback.test.ts` | 反馈 POST/PATCH | B13 | 须 kb 码 | 待处理 |
| `../src/services/gateway/gateway.test.ts` | Gateway 解析与 mock | B3 · QUAL-3 | 缺 URL → mock | 待处理 |
| `../src/routes/model-gateway.test.ts` | 供应商绑定 HTTP | B3 | | 待处理 |

### eval / obs / env

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/eval/l1-matrix.test.ts` | L1 2×2 纯函数 | B10 | **≠ 签字**；error 出格 | 待处理 |
| `../src/eval/l2-gold.test.ts` | L2 题面加载 | P2.5-L2 | **≠ 准出** | 待处理 |
| `../src/eval/l2-fingerprint.test.ts` | rewrite 指纹纯函数 | ADR-046 相关 | 非开 rewrite | 待处理 |
| `../src/eval/adr046-snapshot.test.ts` | 评测快照绑定硬门 | ADR-046 | | 待处理 |
| `../src/scripts/run-l1-golden.test.ts` | L1 CLI 注入（不跑 live） | B10 | skipTrace | 待处理 |
| `../src/scripts/run-l2-golden.test.ts` | L2 CLI 注入 | P2.5-L2 | signoffEligible 恒 false | 待处理 |
| `../src/obs/obs.test.ts` | 指标与限流骨架 | ARCH-P2-4 | | 待处理 |
| `../src/middleware/admin-write-audit.test.ts` | 管理写路径审计日志 | ARCH-P1b-2 | 不落表 | 待处理 |
| `../src/env.test.ts` | api env Zod | | | 待处理 |
| `../src/app.health.test.ts` | health/ready | P0 | | 待处理 |
| `../src/app.error.test.ts` | 全局错误信封 | `prds/05-api` | | 待处理 |
| `../src/lib/pg-error.test.ts` | PG 错误映射 | | | 待处理 |
| `../src/openapi/document.test.ts` | OpenAPI 文档自 contracts 生成 | ARCH-P2-1 | | 待处理 |
| `../src/openapi/routes.test.ts` | /openapi.json · /docs | ARCH-P2-1 | | 待处理 |
| `../src/routes/dashboard.test.ts` | 面板 summary HTTP | B6 | | 待处理 |
| `../src/delivery-s05-inventory.test.ts` | 控制台 §0.5 待盘点行不得回退 | 交付控制台 | 读 PRD 文件，非 mock | 待处理 |
