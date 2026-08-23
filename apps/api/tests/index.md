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
| `kb/` | 知识库列表与设置 | B2 / B2-W |
| `sessions/` | 会话壳、近窗 | 历史≠evidence · rewrite 默认关 |
| `feedback/` | 答案反馈 API | B13 |
| `gateway/` | 模型绑定 / mock / 双节点 | B3 · QUAL-3 |
| `eval/` | L1/L2 工程 seed | B10 · **≠ 准出** |
| `obs/` | 指标、限流、写审计 | ARCH-P2-4 · ARCH-P1b-2 |
| `env/` | env、health/ready、OpenAPI | P0 骨架 |
| `docs-guard/` | 交付文档护栏 | 控制台 §0.5 |

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 待处理

### ask

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/graph/graph.test.ts` | 多意图混居：路由、预算、min 否决、verify | P0 R8/R9 | 多意图混居；须单独变更，禁止顺手拆 | 待处理 |
| `../src/services/retrieve/corpus.test.ts` | 未 ready∧active 不得进检索集 | P0 R7 | 生产装载路径，非仅 db 纯函数 | 待处理 |
| `../src/services/retrieve/retrieve.test.ts` | 混合检索装配 | `prds/04-pipelines` | 默认 mock ES | 待处理 |
| `../src/services/retrieve/es-sparse.test.ts` | 稀疏检索 HTTP 切片 | OPS-1 | | 待处理 |
| `../src/services/retrieve/dept-acl.test.ts` | 检索期部门过滤 | DEPT_ACL | 默认 enforce 关 | 待处理 |
| `../src/routes/ask.test.ts` | POST ask HTTP / 流式终态 | `prds/05-api` | 含 execute throw → final | 待处理 |
| `../src/routes/ask.mode-gate.test.ts` | mode/docTypes 闸 | B2-W | | 待处理 |
| `../src/services/ask/session-window.test.ts` | 近窗裁剪 | 历史≠evidence | 不把历史当 citation | 待处理 |

### ingest

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/gates/complete-size.test.ts` | complete 体积闸 | 上传/complete 限 | | 待处理 |
| `../src/gates/approval-scan.test.ts` | 审批扫描闸 | 审批未过不得 complete | | 待处理 |
| `../src/services/chunk-strategies.test.ts` | 已实现策略可写；未实现 400 | B12 · X-03 | 禁静默 default | 待处理 |
| `../src/services/chunks.test.ts` | 分片只读查询 | ADR-052 · B1 | | 待处理 |
| `../src/services/ingest-jobs.test.ts` | 任务查询 | `prds/06-async` | 入队在 api，消费在 worker | 待处理 |
| `../src/routes/chunks.test.ts` | chunks HTTP | B1 | | 待处理 |
| `../src/routes/documents/validation.test.ts` | 文档写入校验 | 入库 HTTP | | 待处理 |
| `../src/routes/documents/mappers.test.ts` | 列表/详情 DTO 映射 | | 纯函数 | 待处理 |
| `../src/routes/documents/reindex.test.ts` | reindex 须显式策略 | B12 | 未实现 400 | 待处理 |
| `../src/routes/documents/gates.live.test.ts` | live 闸组合 | complete 闸 | | 待处理 |
| `../src/routes/documents/sensitive-complete.test.ts` | 敏感 complete | 审批/密级 | | 待处理 |
| `../src/routes/documents/meta.test.ts` | 文档元数据 PATCH | P3b-META | 部门两字段 | 待处理 |
| `../src/scripts/seed-es-sparse-probe.test.ts` | 稀疏探针脚本 | OPS-1 | 非生产 ES 宣称 | 待处理 |

### auth / acl

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/auth/auth-enforce.redline.test.ts` | enforce 开且无 Bearer → 401 | QUAL-1 | | 待处理 |
| `../src/auth/auth-enforce-pilot.doc.test.ts` | 试点文档与开关一致 | `docs/ops/auth-enforce-pilot.md` | 文档护栏 | 待处理 |
| `../src/auth/identity/token-service.test.ts` | access jti / refresh 轮转 | `prds/09-security` | 同秒可区分 | 待处理 |
| `../src/auth/role-hydrate.test.ts` | 每请求角色 hydrate 与超时回退 | B4-W | ≤5s 缓存 | 待处理 |
| `../src/auth/kb-scope.test.ts` | KB 成员查找请求内缓存 | ARCH-P1b-1 | | 待处理 |
| `../src/auth/middleware.kb-member.test.ts` | 无成员 403 | 以码为准 | | 待处理 |
| `../src/auth/permissions/resolve.test.ts` | 有效码 = 模板 ∪ grants − denies | ADR-051 | | 待处理 |
| `../src/routes/members.test.ts` | 成员 CRUD HTTP | 成员码 | | 待处理 |
| `../src/routes/departments.test.ts` | 部门壳 HTTP | B5 | | 待处理 |
| `../src/routes/dept-grants.test.ts` | 跨部门 grant | DEPT_ACL | | 待处理 |
| `../src/routes/chunks.dept-acl.test.ts` | chunks 列表部门过滤 | DEPT_ACL | | 待处理 |
| `../src/routes/documents/dept-acl.test.ts` | 文档列表部门过滤 | DEPT_ACL | | 待处理 |
| `../src/routes/platform-users-roles.test.ts` | 平台用户角色 | B4 | 写路径 invalidate 缓存 | 待处理 |

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
