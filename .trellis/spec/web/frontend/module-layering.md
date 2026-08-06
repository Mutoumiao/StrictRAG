# web · 前端模块分层纪要

> **目标**：遇到需求能迅速找到改点（局部性）。  
> **布局策略（现状）**：界面仍薄 → 业务 HTTP **集中** `src/api/<domain>.ts`；编排在 `hooks/` 或日后 `features`/路由模块的 `services`。  
> **纪律同构**：与 admin 相同的 **api / services / hooks / 组件 / page** 语义；**不要为对称提前拆碎**路由私有 api。  
> admin 对照：[admin/frontend/module-layering](../../admin/frontend/module-layering.md)

---

## 1. 当前与目标布局

### 1.1 当前（S2 薄壳 · 有效）

```text
apps/web/src/
  lib/http.ts
  auth/api.ts · client-session.ts
  api/                    # 集中：按资源域
    ask.ts                # transport 装配（无业务 path 外泄到 UI）
    sessions.ts
    feedback.ts
  hooks/
    use-knowledge-ask.ts  # React 绑定 + 流式状态机（深）
  components/             # 壳 + 页面级 UI（体量小时可暂不 _features）
  app/
    page.tsx              # 薄
    login/page.tsx
```

### 1.2 域变复杂时的演进（按需，禁止空建）

**触发**：单域组件 ≥3～4 且仅服务该域，或出现明确 services 编排簇。

```text
# 选项 A：features 聚合（多入口复用时优先）
features/<domain>/
  _components/ | components/
  hooks/
  services.ts | *.services.ts
  store.ts                    # 可选
  # api 仍优先用 src/api/<domain>.ts（跨页共享时）

# 选项 B：与 admin 同构路由 colocation（独立功能路由且无跨模块互调 api 时）
app/<segment>/
  page.tsx
  api.ts                      # 仅当该路由独占接口时
  services.ts
  hooks/
  _components/
```

**不要**在仍只有 AskPanel 单壳时，为对称把 `src/api` 拆进多个空 `app/**/api.ts`。

---

## 2. 分层职责总表

| 层 | 放什么 | 不放什么 |
|----|--------|----------|
| **`page.tsx`** | 路由入口；组合组件；极薄 | 业务编排、path、`fetch`、流协议解析 |
| **`components` / `_components`** | 展示、本地纯 UI 状态；事件绑到 hooks/services | 后端 path、手写 SSE、盲 `as` 终态 |
| **`src/api/*` · `auth/api`** | path / method / contracts；ask 的 `DefaultChatTransport` 装配 | toast、业务 store、JSX、手写 SSE 分帧 |
| **`services` / `*.services.ts`** | 用例编排：调 api、校验、toast、写 store、导航 | **后端 URL/path 字面量**；JSX |
| **`hooks/*`** | React 订阅、与渲染绑定的状态机（如 `useChat` + 三态视图） | 可纯函数完成的编排（放 services）；path |
| **`store.ts`** | 模块私有客户端状态（可选） | 服务端唯一真相；与 admin 共用 session key |
| **类型** | wire → contracts；默认无 `types.ts` | 平行 wire DTO；把 UI 专用字段写进 contracts |

### 调用链

```text
page → components / hooks
         → services（有编排时）或 api（仅透传时）
             → lib/http 或 AI SDK transport
```

- **有编排** → 经 services（或 hooks→services）。  
- **无编排单次调用** → 允许直接调 `src/api/*` 导出函数；**禁止**组件内写 path / 裸 `fetch`。  

流式特例（已冻结）：

```text
components/ask-panel
  → hooks/use-knowledge-ask   # 视图状态机 + useChat
      → api/ask.createAskTransport  # 无 UI；path 与 body 装配
```

此时 **hook 承担「深模块」**（必须绑 React）；若再抽无 React 的纯函数（错误映射、body 构造辅助），可放同域 util 或 services，**仍不写 path**（path 留在 `api/ask.ts`）。

---

## 3. `page.tsx`（薄）

与 admin 相同：只组合；Client 业务入口下沉到组件/hooks。

---

## 4. 组件（偏 UI）

| 可留在组件 | 必须下沉 |
|------------|----------|
| 输入框、三态展示、本地 `question` / `lastQuestion` UI 状态 | 调 sessions/feedback 的多步编排 + toast（→ services） |
| 把「提交」绑到 `submitQuestion` / hook 返回值 | 手写 SSE；不经 schema 的 final |

产品硬约束（详见 [quality-guidelines](./quality-guidelines.md)）：拒答可见、citations 不补编、重试用 `lastQuestion`——**实现位置**在 hook/services，UI 只消费结果。

---

## 5. `api`（浅 · 独占后端 path / transport）

**集中放置**：`src/api/<domain>.ts`（现状理由见 [directory-structure](./directory-structure.md)）。

```ts
// Good：sessions.ts — 仅 HTTP
export async function listSessions(kbId: string) {
  return http.get<...>(`/api/v1/knowledge-bases/${kbId}/sessions`);
}

// Good：ask.ts — transport 装配，UI 不碰 path
export function createAskTransport(opts: AskTransportOptions) { ... }
```

**规则**：

1. 类型只来自 `@strict-rag/contracts`。  
2. 禁止手写 SSE 帧解析；流式必须 AI SDK UI Message Stream。  
3. **禁止**在 components/hooks/services 中复制业务 path 字符串。  
4. refresh 固定 URL 仅允许在 `lib/http` / transport 的 401 处理中（与 auth 约定一致）。

---

## 6. `services` / `*.services.ts`

### 6.1 职责（与 admin 同）

- 调 **api 导出函数**，不写 path  
- 校验、错误映射、toast、store、用例控制流  
- 导出 **用例名**（`loadSessionList`、`submitFeedback`）  

### 6.2 与 hooks 的边界（web 更常见「深 hook」）

| 用 services | 用 hooks |
|-------------|----------|
| 登录后拉 me、会话列表加载+toast、反馈提交 | `useKnowledgeAsk`：`useChat`、onData、视图三态 |
| 无 React 也可测的编排 | 必须 `useEffect` / 订阅 / 与组件生命周期一致 |

**禁止**：

- services 与 hook **双份**同一套 list+toast 逻辑  
- 为了「都进 services」把 `useChat` 塞进非 hook 模块  

**正确**：hook 内调 `api` 或薄 services；只保留 React 增量。

### 6.3 体量大时按业务切分（强制）

与 admin 相同：

```text
# 例：日后 sessions 域
features/sessions/
  list.services.ts
  history.services.ts
  api 仍用 @/api/sessions 或同域再导出
```

- 按 **用例簇** 拆，不按 `http`/`toast` 技术层拆  
- 触发：单文件难扫、多子域并行、导出簇过多（经验 ~200 行或 3+ 用例簇）  

### 6.4 假深度

仅 `return api.x()` 且无编排 → **不要**强行建 services；允许 hook/组件直接调 `api`。  
一旦有 toast/多步/store → 必须 services（或 hook 内明确区块，优先可测的 services）。

### 6.5 权限 / 准入：services 不做授权引擎

web 为 **pure read / 用户问答**路径，不以运营码放行管理能力（见 [quality-guidelines](./quality-guidelines.md)）。

| 层 | 做什么 |
|----|--------|
| **API** | KB 成员 / 会话归属等硬约束；失败返回 401/403/业务码 |
| **UI** | 未登录走 Guard；不展示 admin 运营面 |
| **services / hooks** | 编排已触发的 ask/会话/反馈；把错误码映射为用户文案 |

**禁止**在 web services/hooks 内：

- 用运营权限码（`admin.shell` 等）做业务放行分支  
- 复制 admin 式 grants/denies 决策树  
- 因前端「觉得有权」而吞掉 API 的 403  

**允许**：登录态缺失时引导登录；API 错误 → 可见错误态 / toast（`mapBizError`）。

与 admin 同纪律摘要：**授权权威在服务端**；前端 services 只消费结果，不重算权限。

---

## 7. `hooks/` 目录

- **现状**：`src/hooks/` 集中（模块少）。  
- **域变多后**：私有 hooks 进 `features/<domain>/hooks/` 或路由模块 `hooks/`，避免无关 hook 堆在全局。  
- 全局 `src/hooks` 仅保留 **跨域** 或当前唯一域的入口 hook。

---

## 8. `store.ts`（可选）

同 admin：有跨组件客户端状态才建；不直接发 HTTP；异步在 services/hooks。  
**禁止**与 admin 共用 `localStorage` session key（必须 `strict-rag:web:client-session`）。

登录用例若需编排（toast、写 session）：放 `src/auth/services.ts`（按需），**不要**塞进 `src/api/`。

---

## 9. 类型

1. Wire → `@strict-rag/contracts` 唯一。  
2. 默认不建 `types.ts`。  
3. 视图映射用函数/常量；复杂交互结构再私有类型。  
4. 流式 data parts 类型可与 transport 同文件导出（如 `AskDataParts`），**不**平行复制 `AskResponse` 字段集。

---

## 10. Wrong vs Correct

### Wrong

```ts
// hook/组件内写 path
await fetch(`${baseURL()}/api/v1/knowledge-bases/${kbId}/sessions`);

// services 写 URL
export async function loadSessions(kbId: string) {
  return http.get(`/api/v1/.../sessions`);
}

// 双轨编排
// services.loadSessions + useSessions 内再写一遍 list+toast

// 自写 SSE / 盲 as final
eventSource.onmessage = (e) => setAnswer(JSON.parse(e.data) as AskResponse);
```

### Correct

```ts
// api/sessions.ts
export function listSessions(kbId: string) {
  return http.get<SessionListItem[]>(`/api/v1/knowledge-bases/${kbId}/sessions`);
}

// list.services.ts（需要 toast/store 时）
export async function loadSessionList(kbId: string) {
  try {
    const items = await listSessions(kbId);
    // store / return
    return { ok: true as const, items };
  } catch (e) {
    toast.error(mapBizError(e));
    return { ok: false as const, message: mapBizError(e) };
  }
}

// ask：path 只在 api/ask；终态只信 schema 校验后的 data-ask-final
// hooks/use-knowledge-ask.ts 调 createAskTransport + AskResponseSchema.safeParse
```

---

## 11. 改需求导航（局部性速查）

| 需求类型 | 优先打开 |
|----------|----------|
| 改路由组合 | `app/**/page.tsx` |
| 改问答 UI 展示 | `components/ask-panel` 等 |
| 改流式三态 / 订阅 / 终态校验 | `hooks/use-knowledge-ask.ts` |
| 改 ask path / transport / body 装配 | `src/api/ask.ts` |
| 改 sessions/feedback HTTP | `src/api/sessions.ts` · `feedback.ts` |
| 改非流式业务编排（toast/store/多步） | 按需 `*.services.ts`（features 或同域） |
| 改登录 / token | `auth/*` |
| 改传输 refresh | `lib/http.ts` |
| 改 wire 类型 | `@strict-rag/contracts` |
| 改「能否 ask / 读会话」 | **API**（成员/鉴权）；UI Guard + 错误态；hooks/services 不重算权限 |

---

## 12. 实现前检查清单

- [ ] 业务 path 是否只在 `src/api/*` 或 `auth/api`（及 http/transport 的 refresh）？  
- [ ] UI 是否不碰 path、不手写 SSE？（无编排时可调 api 函数）  
- [ ] 无 React 的编排是否在 services（若已引入）？需订阅的是否在 hooks？  
- [ ] 是否禁止 services↔hooks 双份同一用例？  
- [ ] services 膨胀是否按 **业务** 拆 `*.services.ts`？  
- [ ] `page` 是否薄？  
- [ ] store/types 是否按需？  
- [ ] 类型是否 contracts 优先？  
- [ ] 是否未为对称空建 `app/**/api.ts` / 空 features？  
- [ ] ask 是否只信 `data-ask-final` + schema；重试是否 `lastQuestion`？  
- [ ] services/hooks 是否 **未** 实现权限/运营码引擎；401/403 是否交 API + 用户可见错误？  

---

## 13. Design Decision: web 集中 api vs admin 路由 api

**Context**：web 单壳、ask/sessions 跨同一 AskPanel 共享；admin 多运营路由一页一域。

**Decision**：

- web：**集中** `src/api/<domain>.ts` 直到出现「独立功能路由且无跨模块 API 互调」再考虑 colocation。  
- admin：路由模块私有 `api.ts` + 同目录 services（见 admin module-layering）。

**Why**：纪律同构（path 在 api、业务在 services/hooks），形状按局部性选择，不为对称牺牲导航成本。

---

## Related

- [directory-structure](./directory-structure.md)  
- [quality-guidelines](./quality-guidelines.md)  
- [ask-pipeline](../../api/backend/ask-pipeline.md)（服务端流契约）  
- [contracts-patterns](../../contracts/library/contracts-patterns.md)
