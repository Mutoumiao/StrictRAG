# 跨层思考指南 · StrictRAG

> 目的：在改动穿越 api / worker / db / contracts / 前端前，先画清数据与责任边界。

---

## 典型数据流

### 在线 ask（目标架构，Phase 2+）

```text
web/admin → HTTP/SSE → api (auth 验码 · options 白名单 · scope 顶层分轨)
  → LangGraph: route → retrieve → generate → verify → finalize
  → packages/db (traces · sessions) · ES/PG 检索 · Gateway
  → 响应信封 packages/contracts
```

### 离线入库（目标架构，Phase 1+）

```text
admin 上传 → api 入队 → worker: scan → parse → chunk → embed → es_index
  → packages/db 状态机 · Mongo body · RustFS 对象 · ES 索引
  → 双就绪才 ready；active 才进默认检索
```

### 当前骨架

跨层链路 **尚未接线**。新增代码时仍须按目标边界落文件，避免日后大搬家。

---

## 边界问题表

| 边界 | 常见问题 | 本仓约定 |
|------|----------|----------|
| 前端 ↔ API | 类型两套、错误码字符串漂移 | 共用 `@strict-rag/contracts` |
| API ↔ DB | 时间 ISO 写库、ID 策略不一 | 本地时间串 + uuid v7（PRD ORM） |
| API ↔ Worker | schema 分叉、队列 payload 无 Zod | 共享 db；payload 放 contracts |
| Handler ↔ 检索/LLM | route 内 SQL/DSL/Prompt | 禁止；下沉模块 |
| UI 菜单 ↔ API 授权 | 只藏按钮不验码 | UI ≠ API；handler 独立验码 |
| admin ↔ web | 无码进管理壳 | 根拦 **`admin.shell`**；pure read 仅 web（ADR-045/051） |

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
