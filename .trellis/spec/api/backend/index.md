# @strict-rag/api · Hono HTTP 后端

> 路径：`apps/api` · 目标端口 **4000**  
> 现状：**P0/P1 入库** + **S2 最小 ask** + **B1–B6** + **08-11 接线**（B2-W mode/docTypes · B3-W/B4-W · B12 策略注册表 · B13 feedback UI 闭环 API · QUAL-1/3 · OPS-1 live 切片 · B10 工程 seed）。  
> 默认：`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false`（dogfood 可开；**禁止**默认改 true）· Gateway 缺 URL→mock；**B3-W/B2-W** `getGatewayForTenant(tenant, kbId)` = env+platform+KB 覆盖（失败回退 env）· **B4-W** JWT 身份 + 每请求 DB hydrate（≤5s 缓存 · 超时回退 claims）· 文档部门字段 **已落**（GET/PATCH/complete）· `DEPT_ACL_ENFORCE` **默认 false**（开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树（无树/缺节点只精确；grant 子树不读 inheritDown）；超管可绕过；列表同滤且列表项带部门列；`DEPT_INHERIT_DOWN` 默认 true；KB `deptInheritDown` 可覆盖 env；设置页可勾选且未改不写回；KB `deptAclEnforce` 可覆盖 env，未写跟 env，GET 未写回读 false；设置页可勾选且未改不写回；ES 查询期已强制 tenantId+kbId（共享索引安全隔离），部门/ACL principals 查询期对称仍无） · L1 真跑数字已落（live+规模）**≠** 业务签字 PASS。

---

## Pre-Development Checklist

- [ ] 任务是否属于已批准范围？（勿把 backlog B1–B11 静默塞进已关 S2 epic）  
- [ ] DTO/错误码是否来自 `@strict-rag/contracts`，且对外 code 为 **PRD §4 短名**？  
- [ ] 触及 ask / 检索 / 验证时是否读 [quality-redlines](../../guides/quality-redlines.md) + [ask-pipeline](./ask-pipeline.md) + `docs/testing/p0-redlines.md`（R7–R9）？  
- [ ] 权限是否 **以码为准**（读 [auth-authorization](./auth-authorization.md)）；改角色是否 `invalidateRoleCache`？  
- [ ] ask / sessions / members / **chunks** / **kb settings** / **model-gateway** / **users·roles** / **departments** / **dashboard** / **feedback.queue** 是否 **始终**验码（与 `AUTH_ENFORCE` 无关）？平台码无 kb 成员闸  
- [ ] `GET /ask/:requestId` 是否走该 trace 的 KB 成员闸、只回 snapshot+trace、**禁止**当断线重拉 / 禁止漏正文？  
- [ ] complete/reindex 是否读 [chunk-strategies](./chunk-strategies.md)（多策略禁静默 default）？  
- [ ] Gateway/rerank 是否读 [model-gateway](./model-gateway.md)（双节点 · 无假 answered）？  
- [ ] 新登录/refresh/会话/ask 字段是否改 contracts + 双端 http？  
- [ ] DB 是否经 `@strict-rag/db`（禁止 app 私有 schema）？  
- [ ] 是否避免 route 内 SQL / ES DSL / 长 Prompt？  
- [ ] 是否误把 `SESSION_REWRITE_ENABLED` **默认**改 true、宣称连续追问已开或生产 ES？  
- [ ] 触及 rewrite 图边时是否读 [ask-pipeline](./ask-pipeline.md) 开/关两态？
- [ ] 触及按需加深 / `sessionDeepened` / `documentBackref` / `externalBackref` / `backReference` 时是否读 [ask-pipeline](./ask-pipeline.md)（session 加深 + document 加码 + external 抑制已落；四态派生已落；禁 intent LLM / 默认改窗）？
- [ ] 密钥是否仅服务端 env（JWT 禁止 prod 默认 dev-only）？  
- [ ] 触及 L1 评测时是否读 [l1-eval](./l1-eval.md)（`skipTrace` · error 出格 · mock 禁签字 · turbo `L1_*`）？  
- [ ] 触及 L2 题面/runner 时是否读 [l2-eval](./l2-eval.md)（图边/CLI/persist 落地 ≠ 准出；**禁止**默认开 rewrite / 把 runner 或 persist 当准出）？  
- [ ] 是否误把 L2 persist / `evalRunId` 写成准出或算出 `signoffEligible=true`？  
- [ ] 触及 L3 打点/告警时是否读 [l3-metrics](./l3-metrics.md)（打点+告警+主题投诉已计 + L2 过期闩 ≠ 准出 / ≠ 熔断；**禁止**按计数或告警改默认；**禁止**每问查 `eval_runs`）？  
- [ ] 新测例是否按 [testing](../../guides/testing.md) 落 `tests/<能力>/` 并更新 `tests/index.md`（禁止再同域镜像）？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/api check-types` · `lint` · `test`  
- [ ] 鉴权改动含 resolve / token rotation 测试  
- [ ] 新测例是否落在 `tests/<能力>/`、文件头含目标/需求、并已写入 `tests/index.md`？（HOW：[testing](../../guides/testing.md)）  
- [ ] ask 改动含 graph/route 拒答与成员 403 断言；R8/R9（含负向 verify）仍绿  
- [ ] 检索闸改动：R7 钉 **corpus `filterDocsForRetrieve`**（非仅 db 纯函数）  
- [ ] 改 AI SDK 流路径时：是否有 **execute throw → data-ask-final + internal_guard** 回归测？  
- [ ] 新增/已有 `*QuerySchema` 是否在对应 GET route `safeParse`（禁止契约死代码）？  
- [ ] 提交说明写清 S2 最小 / mock / 未做项；禁止「全文 Phase 2 完成」  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状布局 |
| [ask-pipeline](./ask-pipeline.md) | **Ask 信任路径 code-spec**（图 · AI SDK 流 · 检索 · Gateway · env） |
| [quality-guidelines](./quality-guidelines.md) | 质量与禁项 |
| [error-handling](./error-handling.md) | 错误与信封 |
| [logging-guidelines](./logging-guidelines.md) | Pino 上下文 |
| [auth-authorization](./auth-authorization.md) | 身份双 token + 权限码 |
| [chunk-readonly](./chunk-readonly.md) | **B1 分片只读** list/detail · `chunk.view` · UTF-8 64KiB |
| [chunk-strategies](./chunk-strategies.md) | **B12 分片策略** 注册表 · complete/reindex 闸 · 旧文档不自动切 |
| [kb-settings](./kb-settings.md) | **B2/B2-W** GET/PATCH · mode/docTypes 写生效 · ask 入口闸 · rewrite 锁 |
| [model-gateway](./model-gateway.md) | **B3/B3-W** 供应商/绑定 · runtime resolve · **QUAL-3** rerank 双节点 |
| [platform-users-roles](./platform-users-roles.md) | **B4 用户/角色** · `user.manage` / `role.perm.manage` · 最后超管 · codes ⊆ catalog |
| [departments](./departments.md) | **B5 部门壳** · grant 可存可配 · 过滤默认关（开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树；超管可绕过；列表同滤；可关继承；grant 子树不读 inheritDown） · **≠** 全文隔离 |
| [dashboard](./dashboard.md) | **B6 数据面板薄壳** · `dashboard.view` · 只读 summary ≤5 · **≠** APM |
| [l1-eval](./l1-eval.md) | **B10** L1 工程 seed + eval_runs · OPS-1 `retrieve_mode` · **≠** 业务签字真跑 |
| [l2-eval](./l2-eval.md) | **P2.5-L2/L2R/L2P** 多轮题面 + 工程 runner + 可选 persist · **≠** 准出 / **≠** 默认开 rewrite |
| [l3-metrics](./l3-metrics.md) | **P2.5-L3/L3A/L3F/L2S** 多轮护栏打点+告警+主题投诉已计 + L2 过期闩 · **≠** 准出 / **≠** 自动熔断 / **≠** 面板 |

## 依赖（package.json）

`@strict-rag/contracts` · `@strict-rag/db` · `@strict-rag/admin-catalog`

## PRD 映射

- `prds/05-api/01-http-api-hono.md`  
- `prds/04-pipelines/02-online-ask-langgraph.md`  
- `prds/07-models` · `prds/08-quality` · `prds/09-security`  
- IS：`docs/module-status/api.md`
