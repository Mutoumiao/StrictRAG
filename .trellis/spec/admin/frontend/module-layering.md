# admin · 前端模块分层纪要

> **目标**：遇到需求能迅速找到改点（局部性）。  
> **布局策略**：运营业务按 **路由模块 colocation**（`app/(ops)/<module>/`），与现有 `api.ts` 同目录扩展。  
> **纪律同构**：分层语义与 web 一致；**物理路径**以本文与 [directory-structure](./directory-structure.md) 为准（admin **禁止**再建全站大杂烩 `src/api/`）。

---

## 1. 目标模块树（路由 colocation）

```text
app/(ops)/<module>/                 # 例：documents · approvals · members
  page.tsx                          # 薄：路由壳 + layout 关注点 + 组合组件
  api.ts                            # 仅 HTTP：path / method / contracts 类型
  services.ts                       # 业务编排（可拆多个 *.services.ts）
  store.ts                          # 可选；无共享客户端状态则不建
  hooks/                            # 可选；该模块私有 hooks（无 page.tsx）
  _components/                      # 几乎纯 UI（_ 前缀 = 非路由）
```

跨模块壳 / 身份仍在模块外：

| 路径 | 职责 |
|------|------|
| `lib/http.ts` | 传输：Bearer、refresh、信封；**无**业务 path |
| `auth/api.ts` · `auth/client-session.ts` | 登录 / me / 本地会话的 **HTTP + 存储** |
| `auth/services.ts`（按需） | 登录用例编排（加密、toast、写 session、跳转）；**不写 path** |
| `app/login/page.tsx` | 薄；组合登录 UI，调 `auth` 的 services/hooks |
| `components/*` | 真·跨路由壳（`admin-shell`、`auth-guard`） |
| `lib/kb-context.ts` | 跨页 KB 选择等极少全局状态 |

> **login 不在 `(ops)/` 下**：身份域固定落在 `src/auth/*`，不要把 `loginService` 塞进某个运营模块目录。

**空目录纪律**：没有第二个文件前不要建 `hooks/`；没有共享状态不要建 `store.ts`；默认不建 `types.ts`。

---

## 2. 分层职责总表

| 层 | 放什么 | 不放什么 |
|----|--------|----------|
| **`page.tsx`** | 路由段入口；组合 `_components` / 入口 Client 壳；极薄 | 业务编排、path 字符串、`fetch`、toast 堆逻辑 |
| **`_components/*`** | 展示、本地纯 UI 状态（开关、选中高亮、表单受控值） | 拼后端 URL、直接 `http.*`、业务错误码大段 switch、写业务 store 的完整用例 |
| **`api.ts`** | 后端 path、method、请求/响应类型（**仅** `@strict-rag/contracts`）、调用 `lib/http` 或等价 transport | toast、改 store、路由跳转、业务校验文案、UI 状态 |
| **`services` / `*.services.ts`** | **用例级**业务操作：调 api 函数、校验、错误映射、toast、写 store、导航、重试策略 | **任何后端请求 URL / path 字符串**；JSX；wire DTO 平行定义 |
| **`hooks/*`** | 必须绑定 React 的逻辑：订阅、与渲染同步的状态机、封装 `useEffect` 生命周期 | 可无 React 完成的纯编排（应放 services）；后端 path |
| **`store.ts`** | 本模块跨组件客户端状态 | 服务端真相的唯一源；跨无关模块的全局垃圾桶 |
| **`types.ts`** | **默认不建**；仅 contracts 无法表达的视图/交互私有结构 | 平行 wire DTO（复制 contracts 字段） |

### 调用链（强制方向）

```text
page.tsx
  → _components / hooks
      → services（有编排时）或 api（仅透传、无 toast/store/多步时）
          → api.ts（HTTP 函数）
              → lib/http → 后端
```

- **有业务编排**（toast / store / 校验 / 多步 / 错误映射）→ UI 必须经 `services`（或 `hooks`→services）。  
- **无编排的单次资源读取** → 允许组件/hooks **直接调本模块 `api`**（避免假深度）；**禁止**跳过 `api` 写 path / 裸 `fetch` / 直接 `http.*` 拼业务 URL。  
- 需订阅时：`hooks` 内再调 services 或 api。  
- **禁止** `services` 写 `'/api/v1/...'` 或拼接后端 URL。

---

## 3. `page.tsx`（薄）

**What**：路由与组合。

**Why**：改 URL/布局壳与改业务用例分离。

```tsx
// Good：薄
export default function DocumentsPage() {
  return <DocumentsWorkspace />; // 'use client' 入口在 _components
}

// Bad：page 内 list + toast + fetch path
```

Next 注意：`page` 可为 Server Component；带 toast/store 的入口必须是 Client 子树。`page` **只 import 一个（或少数）入口组件**，避免误把整棵 client 树逻辑写进 page。

---

## 4. `_components`（偏 UI）

| 属于 UI（可留在组件） | 属于业务（进 services / hooks） |
|----------------------|----------------------------------|
| open/close、选中行高亮、input 受控 | 调后端、统一错误码 → 用户文案 |
| 纯展示格式化（简单） | 写模块 store、登出清会话、业务导航 |
| 把点击绑到 `services.xxx()` | 加密、合并请求、乐观更新策略 |

组件通过 **用例函数名** 调用（如 `loadDocuments`、`submitApproval`），不通过「原始 path」。

---

## 5. `api.ts`（浅 · 独占后端 path）

**What**：该模块需要的 HTTP 函数；类型来自 contracts。

**Why**：path 与 wire 一处变更；services 不复制字符串。

```ts
// Good
import type { DocumentListItem } from '@strict-rag/contracts';
import { http } from '@/lib/http';

export async function listDocuments(kbId: string) {
  return http.get<DocumentListItem[]>(`/api/v1/knowledge-bases/${kbId}/documents`);
}
```

**规则**：

1. 请求/响应类型 **只** `@strict-rag/contracts`；禁止模块内平行 wire DTO。  
2. 无 toast、无 store、无 `window.location`。  
3. 跨模块复用资源时：**优先 import 对方 `api` 导出函数**，禁止复制 path 字符串。  
4. **慎 import 对方 `services`**（会拖来 toast/store 语义）；跨模块编排在本模块 services 内调对方 api。

---

## 6. `services` / `*.services.ts`（深 · 业务操作面）

### 6.1 负责什么

| 职责 | 例 |
|------|-----|
| 调 **api 函数**（不写 path） | `await listDocuments(kbId)` |
| 入参/业务前校验 | 空 id、非法状态不可提交 |
| 错误映射与用户反馈 | `error.code` → 文案；`toast.error` |
| 写模块 store / 会话副作用 | `setItems`、`clearAuth` |
| 用例级控制流 | 失败重试一次、串行「先刷新再列表」 |
| 给 UI 的窄接口 | `Promise<{ ok: true } \| { ok: false; message: string }>` |

参考形态（partner）：`loginService` 调 `loginApi`、加密、错误映射、toast、写 store——**无一处 path 字面量**。

### 6.2 严禁

```ts
// Bad：services 写后端 URL
await fetch(`${base}/api/v1/knowledge-bases/${id}/documents`);

// Bad：services 只做无逻辑透传且到处直接调 api 时仍强制建空 services
export const load = (id: string) => listDocuments(id);
```

透传且无编排时：**允许**组件/hooks 直接调 `api`（避免假深度）。一旦出现 toast/store/多步/错误映射 → **必须**进 services。

### 6.3 体量大时按 **业务用例** 切分（强制）

**触发**：单文件难以扫描、多人或多子域并行、导出超过「一眼扫完」时（经验：**~200 行或 3+ 独立用例簇** 起拆，以可读为准而非教条）。

```text
documents/
  api.ts
  list.services.ts          # 列表加载 / 刷新 / 筛选用例
  detail.services.ts        # 详情
  ingest-actions.services.ts  # 入库相关动作（例）
  # 不要按技术切：http.services.ts / toast.services.ts
```

- 文件名 = **用户意图 / 用例簇**，动词或名词短语。  
- 导出函数名 = **用例名**（`loadDocumentList`、`retryIngest`），禁止 `handleClick`、`doStuff`、`onSubmit` 作为 services 导出公共名。  
- 共享的纯函数（错误映射）可放同模块 `error-map.ts` 或 `services` 内 private，**仍不写 path**。

### 6.4 toast / 导航副作用

当前约定：**允许** services 内 toast 与必要导航（UI 更薄）。

代价：单测需 mock toast；同一用例「有时 toast、有时内联错误」时不要用布尔迷宫——拆函数或返回 `Result` 由调用方展示。

**前端路由 path**（`/login`、运营 href）≠ 后端 URL：

- 禁止在 services 里散落魔法字符串多处复制；优先常量、catalog 落地 href、或单一 `routes`/`router-register` 式来源。  
- **后端** path 仍只允许出现在 `api.ts` / `auth/api` / `lib/http` 的 refresh。

### 6.5 权限：services 不做权限引擎

**What**：services 只编排 **已被允许执行的操作**（调 api、toast、写 store、用例控制流）。

**Why**：授权 SSOT 在 API 验码 + `admin-catalog`；前端再做一套「码表引擎」会与 PRD/ADR 双轨漂移，并制造「前端拦了 = 已安全」的假安全感。

| 层 | 做什么 | 不做什么 |
|----|--------|----------|
| **API** | 每个动作独立验权限码（硬拦） | — |
| **菜单 / 壳** | catalog + `filterMenuByCodes` 裁剪入口 | 用裁剪代替 API 验码 |
| **组件 / 按钮** | 按 **有效权限码** 控制可见/可点（体验） | `if (role === 'admin')` 写死；把码表复制进业务模块 |
| **services** | 在用户已触发的路径上执行用例；把 API 的 403/`error.code` 映射成文案/toast | 在 services 内维护 grants/denies、重算有效码、二次「权限决策树」 |

**允许**（薄适配，不是引擎）：

- 调用方已带齐业务参数时直接提交；收到 **403 / 业务码** 后 `mapBizError` → toast。  
- 组件侧「无码则不渲染按钮」，services **假定**能点到即应尝试请求（最终以 API 为准）。

**禁止**：

```ts
// Bad：services 内第二套权限引擎
export async function approveDoc(...) {
  const codes = useAuthStore.getState().permissions;
  if (!codes.includes('kb.doc.approve') && !codes.includes('admin.shell')) {
    toast.error('无权限');
    return;
  }
  // ...
}

// Bad：services 内 if (role === 'platform_admin')
```

```ts
// Good：services 只做用例；无权限由 API 返回
export async function approveDoc(...) {
  try {
    await approveDocumentApi(...);
    toast.success('已提交审批');
  } catch (e) {
    toast.error(mapBizError(e)); // 含 403 / FORBIDDEN 等
  }
}
```

与 [quality-guidelines](./quality-guidelines.md) **双罪禁止**一致：UI 误露 + API 漏检都不可接受；**补 UI 裁剪不能代替 API**，也**不能**用 services 权限分支代替 API。

---

## 7. `hooks` vs `services`（必须划清）

| | **services** | **hooks** |
|--|--------------|-----------|
| 何时用 | **不需要** React API 的业务编排 | **必须** hook/订阅/与挂载卸载绑定 |
| 调用方 | 组件事件、其它 services、hooks 内部 | 仅 React 组件（或其它 hooks） |
| 测试 | 优先单测 services（无渲染） | 需 renderHook / 组件测 |
| 反模式 | 为了「都叫 service」把 `useChat` 硬塞进非 hook 文件 | 把可纯函数的 `loadX` 只放在 hook 里导致无法复用 |

**禁止双轨**：同一用例不要同时存在 `loadDocuments`（services）与 `useLoadDocuments` 内复制粘贴同一套编排。  
正确：`useX` 内调用 `services` 或 `api`，只保留「订阅/本地 React 状态」增量。

```ts
// Good
export function useDocumentList(kbId: string) {
  const [items, setItems] = useState(...);
  const refresh = useCallback(() => loadDocumentList(kbId).then(...), [kbId]);
  // loadDocumentList 在 services 中：调 api + toast
}

// Bad：hook 与 services 各写一遍 list + toast
```

---

## 8. `store.ts`（可选）

- **建**：多组件共享、离开子树仍需保留的客户端状态（选中 id、草稿、面板开关且跨路由段）。  
- **不建**：仅单组件 `useState` 足够时。  
- store **不**直接发 HTTP；异步在 services，services 调 `store.getState()` / 外部 action。

---

## 9. 类型（contracts 优先）

1. Wire（请求/响应/错误码）→ **`@strict-rag/contracts` 唯一**。  
2. **默认不建** 模块 `types.ts`。  
3. 需要时再补：  
   - 视图映射用函数（`formatStatus`）或组件内常量；  
   - 仅当交互结构复杂再 `types.ts`（**禁止**把 UI 专用字段写进 contracts 污染协议 SSOT）。

---

## 10. 路由与 Next 约定

1. 仅 `page` / `layout` / `loading` / `error` / `route` 等特殊文件参与路由。  
2. `api.ts`、`services.ts`、`hooks/*` **不是**路由；`hooks/` 内 **禁止**误放 `page.tsx`。  
3. UI 目录优先 **`_components`**（`_` = 私有，排除路由）。  
4. 嵌套路由时：`api` / `services` 放在 **父模块目录**，子段 ` [id]/page.tsx` 复用父级，禁止每层复制 path。

```text
documents/
  page.tsx
  api.ts
  services.ts
  _components/
  [id]/
    page.tsx              # import 父级 services / 子 _components
```

---

## 11. 跨模块与上提信号

| 场景 | 做法 |
|------|------|
| 复用对方 HTTP 资源 | import 对方 **`api`** |
| 复用对方「带 toast 的用例」 | 优先本模块 services 调对方 api 自编排；避免依赖对方 store 语义 |
| **≥2 个无关路由**依赖同一业务树 | 将域上提到 `src/features/<domain>/` 或共享模块，`app/.../page` 只挂载；**不要**长期从深层 page 文件夹反向乱引 |

---

## 12. 假深度与渐进

| 情况 | 做法 |
|------|------|
| 单次 get、无 toast/store | 可直接 `api`（或极薄） |
| 出现编排/反馈/多步 | 抽 services |
| 单文件 services 膨胀 | 按用例拆 `*.services.ts` |
| 为对称建空 store/hooks/types | **禁止** |

**删除测试**：删掉该 services 后，若复杂度只是「调用方多写一行 api 调用」且无行为丢失 → 该层过浅，可内联。

---

## 13. Wrong vs Correct

### Wrong

```ts
// services 内写 path
export async function loadDocs(kbId: string) {
  return http.get(`/api/v1/knowledge-bases/${kbId}/documents`);
}

// 组件内业务 path + toast
async function onRefresh() {
  const r = await fetch(`${base}/api/v1/...`);
  toast.error('失败');
}

// 上帝 services 不拆 + 导出 onClick
export async function handleClick() { /* 列表+详情+审批+导出 */ }

// services 内第二套权限引擎
if (!perms.includes('kb.doc.approve')) { toast.error('无权限'); return }
```

### Correct

```ts
// api.ts
export async function listDocuments(kbId: string) {
  return http.get<DocumentListItem[]>(`/api/v1/knowledge-bases/${kbId}/documents`);
}

// list.services.ts
export async function loadDocumentList(kbId: string): Promise<LoadResult> {
  if (!kbId.trim()) {
    toast.error('请选择知识库');
    return { ok: false, message: '请选择知识库' };
  }
  try {
    const items = await listDocuments(kbId);
    useDocumentsStore.getState().setItems(items);
    return { ok: true, items };
  } catch (e) {
    const message = mapBizError(e);
    toast.error(message);
    return { ok: false, message };
  }
}

// _components：只调 loadDocumentList
```

---

## 14. 改需求导航（局部性速查）

| 需求类型 | 优先打开 |
|----------|----------|
| 改 URL / 段 layout / 组合方式 | `app/.../page.tsx` · `layout.tsx` |
| 改按钮展示、表格列、纯交互 | `_components/*` |
| 改「点了之后整段业务」（校验/toast/写 store/多步） | `*.services.ts` |
| 改后端 path / method / wire 字段 | 模块 `api.ts` + `packages/contracts` |
| 改须订阅的流式/生命周期逻辑 | `hooks/*` |
| 改本模块跨组件客户端状态 | `store.ts`（若有） |
| 改登录 / token / me | `auth/api` · `auth/services`（按需）· `client-session` |
| 改传输层 refresh / 信封 | `lib/http.ts` |
| 改菜单码 / 壳准入 | `admin-catalog` + quality-guidelines（**非**本模块 services 权限树） |
| 改某动作是否真允许 | **API 验码**（权威）；UI 只裁剪按钮；services 只映射 403 文案 |

---

## 15. 实现前检查清单

- [ ] 后端 path **只**出现在 `api.ts`（或 `auth/api`、`lib/http` 的 refresh 固定地址）？  
- [ ] 有编排的用例在 `services` / `*.services.ts`，导出为用例名？无编排是否未强行空 services？  
- [ ] services 体量是否需按业务拆分？  
- [ ] hooks 是否仅保留 React 绑定部分，且不与 services 双份编排？  
- [ ] `page` 是否保持薄组合？  
- [ ] 组件是否避免直接业务 `fetch`/path？（无编排时可调 `api` 函数）  
- [ ] store/types/hooks 目录是否「有需要才建」？  
- [ ] wire 类型是否只来自 contracts？  
- [ ] 跨模块是否优先复用 `api` 而非复制 path、慎用对方 services？  
- [ ] 登录相关是否落在 `src/auth/*` 而非误塞进 `(ops)/` 某模块？  
- [ ] services 是否 **未** 实现权限码引擎（无 grants 重算 / 无 role 放行）；403 是否交 API + 文案映射？  

---

## 16. Design Decision: 路由 colocation 而非独立 `features/`

**Context**：admin 一页一运营域；已有模块私有 `api.ts`。

**Options**：

1. `src/features/<domain>/` 与 `app` 分离  
2. `app/(ops)/<module>/` 就地扩展 services/hooks/_components  

**Decision**：现阶段采用 **(2)**，与「按路由找代码」一致；当域被多个无关路由消费时再 **上提** 到 features（见 §11）。

**Why**：局部性最优；避免为对称空建 features 树。

---

## Related

- [directory-structure](./directory-structure.md)  
- [quality-guidelines](./quality-guidelines.md)  
- [contracts-patterns](../../contracts/library/contracts-patterns.md)  
- web 同构纪律：[web/frontend/module-layering](../../web/frontend/module-layering.md)（物理路径不同）
