# @strict-rag/api · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：HTTP、ask 图、检索装载、鉴权验码、入库受理。入库状态机在 worker；用户端三态在 web。

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

## 遗留（待迁）

### ask

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/graph/graph.test.ts` | 多意图混居：路由、预算、min 否决、verify | P0 R8/R9 | **待拆** 为 min-veto / verify-required / route / budget | 遗留 |
| `../src/services/retrieve/corpus.test.ts` | 未 ready∧active 不得进检索集 | P0 R7 | 生产装载路径，非仅 db 纯函数 | 遗留 |
| `../src/services/retrieve/retrieve.test.ts` | 混合检索装配 | `prds/04-pipelines` | 默认 mock ES | 遗留 |
| `../src/services/retrieve/es-sparse.test.ts` | 稀疏检索 HTTP 切片 | OPS-1 | | 遗留 |
| `../src/services/retrieve/dept-acl.test.ts` | 检索期部门过滤 | DEPT_ACL | 默认 enforce 关 | 遗留 |
| `../src/routes/ask.test.ts` | POST ask HTTP / 流式终态 | `prds/05-api` | 含 execute throw → final | 遗留 |
| `../src/routes/ask.mode-gate.test.ts` | mode/docTypes 闸 | B2-W | | 遗留 |
| `../src/services/ask/session-window.test.ts` | 近窗裁剪 | 历史≠evidence | 不把历史当 citation | 遗留 |

### ingest

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/gates/complete-size.test.ts` | complete 体积闸 | 上传/complete 限 | | 遗留 |
| `../src/gates/approval-scan.test.ts` | 审批扫描闸 | 审批未过不得 complete | | 遗留 |
| `../src/services/chunk-strategies.test.ts` | 已实现策略可写；未实现 400 | B12 · X-03 | 禁静默 default | 遗留 |
| `../src/services/chunks.test.ts` | 分片只读查询 | ADR-052 · B1 | | 遗留 |
| `../src/services/ingest-jobs.test.ts` | 任务查询 | `prds/06-async` | 入队在 api，消费在 worker | 遗留 |
| `../src/routes/chunks.test.ts` | chunks HTTP | B1 | | 遗留 |
| `../src/routes/documents/validation.test.ts` | 文档写入校验 | 入库 HTTP | | 遗留 |
| `../src/routes/documents/mappers.test.ts` | 列表/详情 DTO 映射 | | 纯函数 | 遗留 |
| `../src/routes/documents/reindex.test.ts` | reindex 须显式策略 | B12 | 未实现 400 | 遗留 |
| `../src/routes/documents/gates.live.test.ts` | live 闸组合 | complete 闸 | | 遗留 |
| `../src/routes/documents/sensitive-complete.test.ts` | 敏感 complete | 审批/密级 | | 遗留 |
| `../src/routes/documents/meta.test.ts` | 文档元数据 PATCH | P3b-META | 部门两字段 | 遗留 |
| `../src/scripts/seed-es-sparse-probe.test.ts` | 稀疏探针脚本 | OPS-1 | 非生产 ES 宣称 | 遗留 |

### auth / acl

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/auth/auth-enforce.redline.test.ts` | enforce 开且无 Bearer → 401 | QUAL-1 | | 遗留 |
| `../src/auth/auth-enforce-pilot.doc.test.ts` | 试点文档与开关一致 | `docs/ops/auth-enforce-pilot.md` | 文档护栏 | 遗留 |
| `../src/auth/identity/token-service.test.ts` | access jti / refresh 轮转 | `prds/09-security` | 同秒可区分 | 遗留 |
| `../src/auth/role-hydrate.test.ts` | 每请求角色 hydrate 与超时回退 | B4-W | ≤5s 缓存 | 遗留 |
| `../src/auth/kb-scope.test.ts` | KB 成员查找请求内缓存 | ARCH-P1b-1 | | 遗留 |
| `../src/auth/middleware.kb-member.test.ts` | 无成员 403 | 以码为准 | | 遗留 |
| `../src/auth/permissions/resolve.test.ts` | 有效码 = 模板 ∪ grants − denies | ADR-051 | | 遗留 |
| `../src/routes/members.test.ts` | 成员 CRUD HTTP | 成员码 | | 遗留 |
| `../src/routes/departments.test.ts` | 部门壳 HTTP | B5 | | 遗留 |
| `../src/routes/dept-grants.test.ts` | 跨部门 grant | DEPT_ACL | | 遗留 |
| `../src/routes/chunks.dept-acl.test.ts` | chunks 列表部门过滤 | DEPT_ACL | | 遗留 |
| `../src/routes/documents/dept-acl.test.ts` | 文档列表部门过滤 | DEPT_ACL | | 遗留 |
| `../src/routes/platform-users-roles.test.ts` | 平台用户角色 | B4 | 写路径 invalidate 缓存 | 遗留 |

### kb / sessions / feedback / gateway

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/services/kb-list.test.ts` | 可见库列表 | 壳下拉数据 | | 遗留 |
| `../src/services/kb-settings-mode.test.ts` | KB mode 策略 | B2-W | | 遗留 |
| `../src/routes/kb-settings.test.ts` | 设置 HTTP | B2 | | 遗留 |
| `../src/routes/sessions.test.ts` | 会话壳 HTTP | rewrite 默认关 | | 遗留 |
| `../src/routes/feedback.test.ts` | 反馈 POST/PATCH | B13 | 须 kb 码 | 遗留 |
| `../src/services/gateway/gateway.test.ts` | Gateway 解析与 mock | B3 · QUAL-3 | 缺 URL → mock | 遗留 |
| `../src/routes/model-gateway.test.ts` | 供应商绑定 HTTP | B3 | | 遗留 |

### eval / obs / env

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/eval/l1-matrix.test.ts` | L1 2×2 纯函数 | B10 | **≠ 签字**；error 出格 | 遗留 |
| `../src/eval/l2-gold.test.ts` | L2 题面加载 | P2.5-L2 | **≠ 准出** | 遗留 |
| `../src/eval/l2-fingerprint.test.ts` | rewrite 指纹纯函数 | ADR-046 相关 | 非开 rewrite | 遗留 |
| `../src/eval/adr046-snapshot.test.ts` | 评测快照绑定硬门 | ADR-046 | | 遗留 |
| `../src/scripts/run-l1-golden.test.ts` | L1 CLI 注入（不跑 live） | B10 | skipTrace | 遗留 |
| `../src/scripts/run-l2-golden.test.ts` | L2 CLI 注入 | P2.5-L2 | signoffEligible 恒 false | 遗留 |
| `../src/obs/obs.test.ts` | 指标与限流骨架 | ARCH-P2-4 | | 遗留 |
| `../src/middleware/admin-write-audit.test.ts` | 管理写路径审计日志 | ARCH-P1b-2 | 不落表 | 遗留 |
| `../src/env.test.ts` | api env Zod | | | 遗留 |
| `../src/app.health.test.ts` | health/ready | P0 | | 遗留 |
| `../src/app.error.test.ts` | 全局错误信封 | `prds/05-api` | | 遗留 |
| `../src/lib/pg-error.test.ts` | PG 错误映射 | | | 遗留 |
| `../src/openapi/document.test.ts` | OpenAPI 文档自 contracts 生成 | ARCH-P2-1 | | 遗留 |
| `../src/openapi/routes.test.ts` | /openapi.json · /docs | ARCH-P2-1 | | 遗留 |
| `../src/routes/dashboard.test.ts` | 面板 summary HTTP | B6 | | 遗留 |
| `../src/delivery-s05-inventory.test.ts` | 控制台 §0.5 待盘点行不得回退 | 交付控制台 | 读 PRD 文件，非 mock | 遗留 |
