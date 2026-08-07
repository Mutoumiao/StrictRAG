# web · 目录结构

## 当前

```text
apps/web/
  vitest.config.ts            # jsdom · 同域 *.test.ts(x)
  src/
    test/                     # setup · re-export · fixtures（非业务）
    env.client.ts
    lib/
      http.ts                 # 传输层（Bearer / refresh / 重试）
      map-biz-error.ts        # services 共用错误映射（无 path）
    auth/
      client-session.ts
      api.ts                  # 登录 / me HTTP（仅 path；不写 session）
      services.ts             # 登录/登出：写清 session + 错误映射
    api/                      # 业务 HTTP（界面简单 → 集中）
      ask.ts                  # DefaultChatTransport（AI SDK，不自解析 SSE）
      sessions.ts
      feedback.ts
    services/
      sessions.services.ts    # 会话列表/新建/历史回放编排（无 path）
    hooks/
      use-knowledge-ask.ts    # useChat + data-status / data-ask-final
    components/
      auth-guard.tsx
      ask-panel.tsx           # UI；会话用例经 services；ask 经 hook
    app/
      page.tsx                # 薄：Guard + AskPanel
      login/page.tsx          # 薄：表单 UI → auth/services
```

> **分层纪律全文**（page / api / services / hooks / store / 类型）→ [module-layering.md](./module-layering.md)

## 职责分层（摘要）

| 层 | 路径 | 放什么 | 不放什么 |
|----|------|--------|----------|
| 传输 | `lib/http.ts` | 通用 HTTP 客户端 | 业务 path、流协议 |
| 身份 | `auth/api.ts` | 登录会话相关 HTTP | 问答/会话业务编排 |
| 业务 API | `src/api/<domain>.ts` | path + contracts；ask transport 装配 | toast、JSX、手写 SSE |
| hooks | `src/hooks/*`（域多后可下沉 feature） | React 绑定 / 流式状态机 | 后端 path；与 services 双份编排 |
| services | 按需：`features/.../*.services.ts` 等 | 用例编排（调 api、toast、store） | **后端 URL/path** |
| 页面 | `app/**/page.tsx` | 薄组合 | 散落 `fetch`、业务 path |

## 为何 web 用集中 `src/api/` 而非 app 下私有 api.ts

当前用户端界面简单（登录 + 问答壳 + 会话），**没有**多路由运营模块边界；接口少、跨页面共享（AskPanel 同时用 ask + sessions）。  
因此业务调用集中在 `src/api/` 按**资源域**分文件即可。

若日后 web 拆成多个独立功能路由、且**无**跨模块 API 互调，可再改为各 `app/<module>/api.ts`（与 admin 同构）。**不要**为了对称提前拆碎。

## 规则

1. **类型**一律 `@strict-rag/contracts`；默认不建平行 `types.ts`。  
2. `src/api/*` **只**放业务 HTTP / transport 装配；**独占**后端 path；禁止手写 SSE 帧解析。  
3. **services（若引入）禁止写请求 URL**；只调 api 函数。体量大时按 **业务用例** 拆 `*.services.ts`。  
3b. **services/hooks 不做授权引擎**：不以运营码/自造权限树放行；鉴权与成员约束以 **API** 为准（见 module-layering §6.5）。  
4. **hooks vs services**：须 React/订阅 → hooks；无 React 编排 → services。禁止双轨。 
5. ask 流式：**必须** `@ai-sdk/react` + 服务端 UI Message Stream（`data-status` / `data-ask-final`）。  
6. 组件通过明确路径引入；禁止页面/组件散落业务 path 的 `fetch`。  
7. **store / 空 hooks 目录 / types**：不需要不建。  
8. `page.tsx` 保持薄（路由 + 组合）。  
9. **抽公共时机**（欠抽 / 过抽）：见 [module-layering §12.1](./module-layering.md)（与 admin 同纪律）；check 必查。  
10. **测试**：行为测与源码同域 `*.test.ts(x)`；`src/test/` **只** setup/fixtures/re-export；禁止业务 import `*.test.*`；E2E 不进 `src/`。约定见 [quality-guidelines · 前端测试](./quality-guidelines.md)。

## 职责（产品）

| 职责 | 说明 |
|------|------|
| 用户 ask | 默认 AI SDK 流（`data-status` / `data-ask-final`）；三态 UI；重试用 `lastQuestion` |
| 会话壳 | 列表/历史；历史 ≠ citation |
| pure read | 无 admin 运营面 |

## 端口

**3005**。
