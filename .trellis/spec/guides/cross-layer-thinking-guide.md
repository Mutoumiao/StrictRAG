# 跨层思考指南 · StrictRAG

> 目的：在改动穿越 api / worker / db / contracts / 前端前，先画清数据与责任边界。

---

## 典型数据流

### 在线 ask（S2 已接线 · 目标形状）

```text
web → HTTP + AI SDK UI Message Stream → api
  (auth 验码 · options 白名单 · scope 顶层分轨)
  → 线性图: route → retrieve → generate → verify → finalize
  → packages/db (traces · sessions) · 检索 · Gateway
  → 终态 data-ask-final（contracts AskResponse）；信封 packages/contracts
```

| 已接线（S2） | 仍 mock / 未做（禁止当生产完成） |
|--------------|----------------------------------|
| ask HTTP + 流式终态 · 会话壳 · 反馈 | ES 默认 `RETRIEVE_ES_MODE=mock` |
| 检索闸 ready∧active · Gateway 可 resolve | rewrite **强制关**；非 CRAG/multi_hop |
| contracts ask 域 · web AI SDK 消费 | L1 业务签字真跑；生产 ES+IK（B8） |

流协议细节 → [ask-pipeline](../api/backend/ask-pipeline.md)（`data-ask-final` · 禁自研 SSE final）。  
完成度细节 → `docs/module-status/`（**非**本文件 SSOT）。

### 离线入库（P1 已接线 · 目标形状）

```text
admin/api 上传 complete → 入队 → worker: scan → parse → chunk → embed → es_index
  → packages/db 状态机 · 正文/向量（现阶段多在 PG）· 对象存储 · ES
  → 双就绪才 ready；lifecycle active 才进默认检索
```

| 已接线（P1） | 仍 mock / 债 |
|--------------|--------------|
| 审批闸 · scan 状态机 · chunk/manifest · embed→es 串行 | mock/off 仅 dev；`on`/prod mock **fail-closed**（X-01/X-02）；真引擎 QUAL-2 |
| mock ES 按 docId+indexVersion | Mongo body / 真 RustFS 生产路径延期 |
| 策略码写入 + 执行 ⊆ contracts `IMPLEMENTED_*`（X-03 已封） | roadmap 码（fixed_window 等）不可写、不可静默段落切 |

入库 HOW → [worker quality](../worker/backend/quality-guidelines.md)。  
新增代码仍须按边界落文件（route 禁 SQL/ES DSL/长 Prompt），避免平行实现。

---

## 边界问题表

| 边界 | 常见问题 | 本仓约定 |
|------|----------|----------|
| 前端 ↔ API | 类型两套、错误码字符串漂移 | 共用 `@strict-rag/contracts` |
| 前端内部分层 | path/toast/UI 搅在一处难改 | path 仅 `api`；用例在 services；须 React 用 hooks；page 薄（[admin](../admin/frontend/module-layering.md) · [web](../web/frontend/module-layering.md)） |
| 前端 services ↔ 授权 | services 内第二套码表/role 放行 | **API 硬验码**；UI 裁剪按钮；services 只映射 403（不做权限引擎） |
| API ↔ DB | 时间 ISO 写库、ID 策略不一 | 本地时间串 + uuid v7（PRD ORM） |
| API ↔ Worker | schema 分叉、队列 payload 无 Zod | 共享 db；payload 放 contracts |
| Handler ↔ 检索/LLM | route 内 SQL/DSL/Prompt | 禁止；下沉模块 |
| UI 菜单 ↔ API 授权 | 只藏按钮不验码 | UI ≠ API；handler 独立验码 |
| admin ↔ web | 无码进管理壳 | 根拦 **`admin.shell`**；pure read 仅 web（ADR-045/051） |
| 身份 ↔ 授权 | JWT roles 直接放行 | 身份只出 userId/app；**有效码**再放行（见 [auth-authorization](../api/backend/auth-authorization.md)） |
| admin ↔ web 会话 | 共用 localStorage | 分 key：`strict-rag:admin:…` / `strict-rag:web:…` |
| refresh 状态 | 无状态 refresh | jti 有状态 + replay 吊销 session |

---

## 契约优先步骤

1. **先定 contracts**（Zod schema · BizCode · 响应类型）  
2. **再定 db 字段**（`packages/db`，api/worker 共用）  
3. **再写 api 路由 + worker processor**  
4. **最后 web/admin 消费**（类型从 contracts 导入）

不要前端先写 any 再倒推后端。

---

## 本仓跨层检查清单

- [ ] 新字段是否同时出现在 contracts、OpenAPI/路由校验、DB（若持久化）、前端展示？  
- [ ] 错误是系统 4xx/5xx 还是业务 200+`ok:false` / ask 业务 status？见 `prds/05-api`  
- [ ] 写库时间是否本地格式串（非 `toISOString()`）？  
- [ ] 日志是否带 `requestId, tenantId, userId, kbId?, sessionId?`？  
- [ ] env 是否在 app 边界 Zod 校验，密钥是否隔离？  
- [ ] 权限：菜单有无 **不**替代 API 验码？  

---

## 常见错误

### 1. 隐式格式假设

**Bad**：前端假设 timestamp 一定是 ISO，后端写的是 `yyyy-MM-dd HH:mm:ss`  
**Good**：在 contracts 标明语义；边界显式转换

### 2. 散落校验

**Bad**：同一 options 白名单在 web、api、graph 各写一份  
**Good**：Zod 在 contracts 一处；api 入口强制 parse

### 3. 泄漏抽象

**Bad**：React 组件知道 `chunk_embeddings` 表结构  
**Good**：组件只认 API DTO

### 4. 重复解析 payload

**Bad**：多处 `(ev as { x?: string }).x`  
**Good**：contracts schema parse 一次，向下传类型结果

---

## 与 PRD 的分工

| 问题 | 去哪 |
|------|------|
| 端点路径、options 白名单、状态机 | `prds/05-api` · `prds/04-pipelines` |
| 表结构 | `prds/03-data` · db spec |
| 怎么组织代码文件 | 各包 `directory-structure.md` |
